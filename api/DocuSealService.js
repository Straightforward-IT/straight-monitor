const axios = require('axios');
const docuseal = require('@docuseal/api');
const logger = require('./utils/logger');
const R2Service = require('./R2Service');

/**
 * DocuSealService
 *
 * Thin wrapper around the official @docuseal/api SDK (EU Cloud by default).
 * Templates are authored in the DocuSeal dashboard; this service only creates
 * and tracks signature requests (submissions) and stores signed PDFs in R2.
 *
 * Mirrors the singleton export pattern used by R2Service.
 */
class DocuSealService {
  constructor() {
    this.configured = false;
    this.baseUrl = process.env.DOCUSEAL_BASE_URL || 'https://api.docuseal.eu';
    this._configure();
  }

  _configure() {
    const key = process.env.DOCUSEAL_API_TOKEN;
    if (!key) {
      logger.warn('DocuSealService: DOCUSEAL_API_TOKEN is not set — DocuSeal calls will fail.');
      return;
    }
    docuseal.configure({ key, url: this.baseUrl });
    this.configured = true;
  }

  _ensureConfigured() {
    if (!this.configured) {
      this._configure();
      if (!this.configured) {
        throw new Error('DocuSeal is not configured (missing DOCUSEAL_API_TOKEN).');
      }
    }
  }

  /**
   * List available templates from the DocuSeal dashboard (for the create-request UI).
   * @param {object} params - Optional query params (e.g. { limit, q }).
   * @returns {Promise<object>} { data: [...templates], pagination }
   */
  async listTemplates(params = {}) {
    this._ensureConfigured();
    return docuseal.listTemplates(params);
  }

  /**
   * Create a signature request (submission) for a dashboard template.
   *
   * @param {object} opts
   * @param {number} opts.templateId   - DocuSeal template id.
   * @param {Array<object>} opts.submitters - [{ role, name, email, send_email, external_id, values }]
   * @param {('preserved'|'random')} [opts.order='preserved'] - Signing order.
   * @param {object} [opts.message]    - Optional { subject, body } for request emails.
   * @returns {Promise<Array<object>>} Array of submitter objects (each with submission_id, slug, embed_src).
   */
  async createSubmission({ templateId, submitters, order = 'preserved', message }) {
    this._ensureConfigured();
    if (!templateId) throw new Error('createSubmission: templateId is required.');
    if (!Array.isArray(submitters) || submitters.length === 0) {
      throw new Error('createSubmission: at least one submitter is required.');
    }

    const payload = {
      template_id: templateId,
      order,
      submitters,
    };
    if (message) payload.message = message;

    const result = await docuseal.createSubmission(payload);
    logger.info(`DocuSeal submission created (template ${templateId}, ${submitters.length} submitter(s)).`);
    return result;
  }

  /**
   * Create a one-off signature request directly from a PDF buffer.
   *
   * Fillable fields are defined via embedded text tags inside the PDF
   * (e.g. `{{Entleiher;role=Entleiher;type=signature}}`), so this works for
   * dynamically generated documents of any page count. Requires a DocuSeal plan
   * that allows raw-PDF submissions (runs in sandbox/test mode on free tiers).
   *
   * @param {object} opts
   * @param {string} opts.name        - Document/submission name.
   * @param {Buffer} opts.fileBuffer  - Raw PDF buffer.
   * @param {Array<object>} opts.submitters - [{ role, name, email, send_email }]
   * @param {('preserved'|'random')} [opts.order='preserved'] - Signing order.
   * @param {object} [opts.message]   - Optional { subject, body }.
   * @returns {Promise<Array<object>>} Array of submitter objects (slug, embed_src, submission_id).
   */
  async createSubmissionFromPdf({ name, fileBuffer, submitters, order = 'preserved', message }) {
    this._ensureConfigured();
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('createSubmissionFromPdf: fileBuffer (PDF) is required.');
    }
    if (!Array.isArray(submitters) || submitters.length === 0) {
      throw new Error('createSubmissionFromPdf: at least one submitter is required.');
    }

    const docName = name || 'Document';
    const payload = {
      name: docName,
      documents: [{ name: `${docName}.pdf`, file: fileBuffer.toString('base64') }],
      submitters,
      order,
    };
    if (message) payload.message = message;

    const result = await docuseal.createSubmissionFromPdf(payload);
    logger.info(`DocuSeal PDF submission created ("${docName}", ${submitters.length} submitter(s)).`);
    return result;
  }

  /**
   * Fetch a submission with its current status and submitters.
   * @param {number} submissionId
   * @returns {Promise<object>}
   */
  async getSubmission(submissionId) {
    this._ensureConfigured();
    return docuseal.getSubmission(submissionId);
  }

  /**
   * Archive (soft-delete) a template in DocuSeal.
   * @param {number} templateId
   * @returns {Promise<object>}
   */
  async archiveTemplate(templateId) {
    this._ensureConfigured();
    return docuseal.archiveTemplate(templateId);
  }

  /**
   * Update a template (e.g. rename).
   * @param {number} templateId
   * @param {object} data - e.g. { name }
   * @returns {Promise<object>}
   */
  async updateTemplate(templateId, data) {
    this._ensureConfigured();
    return docuseal.updateTemplate(templateId, data);
  }

  /**
   * Archive (soft-delete) a submission in DocuSeal.
   * @param {number} submissionId
   * @returns {Promise<object>}
   */
  async archiveSubmission(submissionId) {
    this._ensureConfigured();
    return docuseal.archiveSubmission(submissionId);
  }

  /**
   * Get the (signed, if completed) documents for a submission.
   * @param {number} submissionId
   * @returns {Promise<object>} { id, documents: [{ name, url }] }
   */
  async getSubmissionDocuments(submissionId) {
    this._ensureConfigured();
    return docuseal.getSubmissionDocuments(submissionId);
  }

  /**
   * Download the signed PDF for a completed submission and store it in R2.
   *
   * @param {number} submissionId - DocuSeal submission id.
   * @param {string} keyPrefix    - R2 key prefix, e.g. `docuseal/<vorgangId>`.
   * @returns {Promise<{ key: string, sourceUrl: string }|null>} R2 key + source URL, or null if no document.
   */
  async storeSignedPdf(submissionId, keyPrefix) {
    this._ensureConfigured();

    const result = await this.getSubmissionDocuments(submissionId);
    const documents = (result && result.documents) || [];
    if (documents.length === 0) {
      logger.warn(`DocuSeal: no documents available for submission ${submissionId}.`);
      return null;
    }

    // Prefer a merged/combined document if present, otherwise take the first.
    const doc = documents[0];
    const sourceUrl = doc.url;
    if (!sourceUrl) {
      logger.warn(`DocuSeal: document for submission ${submissionId} has no URL.`);
      return null;
    }

    const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const key = `${keyPrefix}/signed-${submissionId}.pdf`;
    await R2Service.uploadFile(key, buffer, 'application/pdf');
    logger.info(`DocuSeal: stored signed PDF for submission ${submissionId} at R2 key ${key}.`);

    return { key, sourceUrl };
  }

  /**
   * Download the DocuSeal audit trail PDF for a completed submission and store it in R2.
   *
   * @param {number} submissionId    - DocuSeal submission id.
   * @param {string} keyPrefix       - R2 key prefix, e.g. `Signatures/kunden/sfhh/stundenliste/2026-06-25`.
   * @param {string} [auditLogUrl]   - Optional pre-known audit URL from the webhook payload.
   *                                   If omitted, the URL is fetched via getSubmission().
   * @returns {Promise<{ key: string, sourceUrl: string }|null>}
   */
  async storeAuditPdf(submissionId, keyPrefix, auditLogUrl) {
    this._ensureConfigured();

    let sourceUrl = auditLogUrl || null;

    if (!sourceUrl) {
      const submission = await this.getSubmission(submissionId);
      sourceUrl = (submission && submission.audit_log_url) || null;
    }

    if (!sourceUrl) {
      logger.warn(`DocuSeal: no audit_log_url available for submission ${submissionId}.`);
      return null;
    }

    const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
    const buffer   = Buffer.from(response.data);

    const key = `${keyPrefix}/audit-${submissionId}.pdf`;
    await R2Service.uploadFile(key, buffer, 'application/pdf');
    logger.info(`DocuSeal: stored audit PDF for submission ${submissionId} at R2 key ${key}.`);

    return { key, sourceUrl };
  }
}

module.exports = new DocuSealService();
