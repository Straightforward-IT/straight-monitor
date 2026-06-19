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
   * Fetch a submission with its current status and submitters.
   * @param {number} submissionId
   * @returns {Promise<object>}
   */
  async getSubmission(submissionId) {
    this._ensureConfigured();
    return docuseal.getSubmission(submissionId);
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
}

module.exports = new DocuSealService();
