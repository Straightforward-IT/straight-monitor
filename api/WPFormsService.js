/**
 * WPFormsService.js
 * Automatisierte Verarbeitung von WPForms Einträgen
 * 
 * Funktionen:
 * - Laufzettel automatisch aus WP-Formularen erstellen
 * - Event Reports verarbeiten
 * - Evaluierungen synchronisieren
 */

const axios = require('axios');
const logger = require('./utils/logger');
const Mitarbeiter = require('./models/Mitarbeiter');
const { Laufzettel, EventReport, EvaluierungMA } = require('./models/Classes/FlipDocs');
const {
  findMitarbeiterByName,
  assignMitarbeiter,
  assignTeamleiter,
} = require('./FlipService');
const {
  createSubtasksOnTask,
  completeTaskById,
} = require('./AsanaService');
const { sendMail } = require('./EmailService');

// Konstanten
const FORM_IDS = {
  LAUFZETTEL: 171,
  EVENT_REPORT: 31,
  EVALUIERUNG_MA: 176,
};

class WPFormsService {
  constructor() {
    this.baseUrl = this.extractBaseUrl(process.env.WP_API_URL);
    this.auth = {
      username: process.env.WP_USER,
      password: process.env.WP_FORMS_PASSWORD,
    };
    
    this.wpAxios = axios.create({
      baseURL: this.baseUrl,
      auth: this.auth,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Extrahiert die Base URL aus der WP_API_URL (entfernt /wp/v2 am Ende)
   */
  extractBaseUrl(url) {
    if (!url) throw new Error('WP_API_URL not configured');
    return url.endsWith('/wp/v2') ? url.replace('/wp/v2', '') : url;
  }

  /**
   * Holt alle WPForms
   */
  async getAllForms() {
    try {
      logger.debug('Fetching all WPForms...');
      const response = await this.wpAxios.get('/wpforms/v1/forms?per_page=100');
      const forms = response.data.data || response.data;
      logger.debug(`Found ${forms.length} WPForms`);
      return forms;
    } catch (error) {
      logger.error('Failed to fetch WPForms:', error.message);
      throw error;
    }
  }

  /**
   * Holt Formular-Details
   */
  async getFormById(formId) {
    try {
      const response = await this.wpAxios.get(`/wpforms/v1/forms/${formId}`);
      return response.data.data || response.data;
    } catch (error) {
      logger.error(`Failed to fetch form ${formId}:`, error.message);
      throw error;
    }
  }

  /**
   * Holt neue/unverarbeitete Laufzettel aus WPForms
   * Nutzt wp_postmeta um gespeicherte Einträge zu filtern
   */
  async getUnprocessedLaufzettel() {
    try {
      logger.debug('Fetching unprocessed Laufzettel from WPForms...');
      
      // Versuche, neue Einträge über WP_Query zu holen
      const response = await this.wpAxios.get('/wp/v2/posts', {
        params: {
          meta_key: 'form_id',
          meta_value: FORM_IDS.LAUFZETTEL,
          status: 'any',
          per_page: 50,
        },
      });

      return response.data || [];
    } catch (error) {
      // Fallback: Hol alle Posts und filtere manuell
      logger.warn('WP_Query failed, using fallback method');
      return this.getLaufzettelFallback();
    }
  }

  /**
   * Fallback: Hol Laufzettel-Daten direkt (benötigt ggf. Custom Endpoint)
   */
  async getLaufzettelFallback() {
    try {
      // Versuche Laufzettel-spezifischen Endpoint
      const response = await this.wpAxios.get('/wp/v2/laufzettel', {
        params: { per_page: 50 },
      });
      return response.data || [];
    } catch (error) {
      logger.warn('Laufzettel endpoint not available');
      return [];
    }
  }

  /**
   * Verarbeite Laufzettel-Eingabe vom WPForm
   */
  async processLaufzettelEntry(entryData) {
    try {
      logger.debug('Processing Laufzettel entry:', entryData);

      const {
        location,
        name_mitarbeiter,
        name_teamleiter,
        email,
        datum,
      } = entryData;

      // Validierung
      if (!location || !name_mitarbeiter || !name_teamleiter) {
        throw new Error('Missing required fields for Laufzettel');
      }

      // Prüfe ob bereits vorhanden
      const existing = await Laufzettel.findOne({
        name_mitarbeiter,
        name_teamleiter,
        datum: {
          $gte: new Date(datum).setHours(0, 0, 0, 0),
          $lte: new Date(datum).setHours(23, 59, 59, 999),
        },
      });

      if (existing) {
        logger.info('Laufzettel already exists, skipping');
        return { success: false, reason: 'Already exists', id: existing._id };
      }

      // Finde Mitarbeiter und Teamleiter
      let mitarbeiter = await Mitarbeiter.findOne({ email });
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      if (!mitarbeiter) {
        // Erstelle neuen Mitarbeiter falls nicht vorhanden
        logger.info('Creating new Mitarbeiter entry for Laufzettel');
        mitarbeiter = new Mitarbeiter({
          email,
          vorname: name_mitarbeiter.split(' ')[0],
          nachname: name_mitarbeiter.split(' ').slice(1).join(' '),
        });
        await mitarbeiter.save();
      }

      // Erstelle Laufzettel
      const laufzettel = new Laufzettel({
        location,
        name_mitarbeiter,
        name_teamleiter,
        datum: new Date(datum),
        mitarbeiter: mitarbeiter._id,
        teamleiter: teamleiterId,
        assigned: !!(mitarbeiter._id && teamleiterId),
      });

      await laufzettel.save();
      logger.info('✓ Laufzettel created:', laufzettel._id);

      // Erstelle Asana-Subtask wenn Mitarbeiter zugewiesen
      if (mitarbeiter?.asana_id) {
        try {
          const formattedDate = this.formatDate(datum);
          const taskData = {
            name: `LZ [${formattedDate}] - TL: ${name_teamleiter}`,
            notes: `${name_mitarbeiter} hat am ${formattedDate} einen Laufzettel angefragt. Teamleiter: ${name_teamleiter}. Location: ${location}`,
          };

          await createSubtasksOnTask(mitarbeiter.asana_id, taskData);
          logger.info('✓ Asana subtask created for Laufzettel');
        } catch (error) {
          logger.error('Failed to create Asana subtask:', error.message);
          await this.sendErrorNotification(
            'Laufzettel erstellt, aber Asana-Subtask fehlgeschlagen',
            laufzettel
          );
        }
      }

      // Benachrichtige bei erfolgreicher Erstellung
      await this.sendLaufzettelNotification(laufzettel);

      return {
        success: true,
        id: laufzettel._id,
        message: 'Laufzettel created successfully',
      };
    } catch (error) {
      logger.error('Error processing Laufzettel:', error.message);
      throw error;
    }
  }

  /**
   * Holt neue Event Reports
   */
  async processEventReportEntry(entryData) {
    try {
      logger.debug('Processing Event Report entry:', entryData);

      const {
        location,
        name_teamleiter,
        datum,
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        feedback_auftraggeber,
        sonstiges,
      } = entryData;

      if (!location || !name_teamleiter || !datum || !kunde) {
        throw new Error('Missing required fields for Event Report');
      }

      // Finde Teamleiter
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      // Erstelle Event Report
      const eventReport = new EventReport({
        location,
        name_teamleiter,
        datum: new Date(datum),
        kunde,
        puenktlichkeit,
        erscheinungsbild,
        team,
        mitarbeiter_job,
        feedback_auftraggeber,
        sonstiges,
        teamleiter: teamleiterId,
        assigned: !!teamleiterId,
      });

      await eventReport.save();
      logger.info('✓ Event Report created:', eventReport._id);

      return {
        success: true,
        id: eventReport._id,
        message: 'Event Report created successfully',
      };
    } catch (error) {
      logger.error('Error processing Event Report:', error.message);
      throw error;
    }
  }

  /**
   * Holt neue Evaluierungen
   */
  async processEvaluierungEntry(entryData) {
    try {
      logger.debug('Processing Evaluierung entry:', entryData);

      const {
        location,
        name_teamleiter,
        name_mitarbeiter,
        datum,
        kunde,
        puenktlichkeit,
        grooming,
        motivation,
        technische_fertigkeiten,
        lernbereitschaft,
        sonstiges,
      } = entryData;

      if (!location || !name_teamleiter || !name_mitarbeiter) {
        throw new Error('Missing required fields for Evaluierung');
      }

      // Finde Mitarbeiter und Teamleiter
      let mitarbeiter = await Mitarbeiter.findOne({
        $or: [
          { vorname: name_mitarbeiter.split(' ')[0] },
          { email: name_mitarbeiter },
        ],
      });
      const teamleiterId = await findMitarbeiterByName(name_teamleiter);

      // Erstelle Evaluierung
      const evaluierung = new EvaluierungMA({
        location,
        name_teamleiter,
        name_mitarbeiter,
        datum: new Date(datum),
        kunde,
        puenktlichkeit,
        grooming,
        motivation,
        technische_fertigkeiten,
        lernbereitschaft,
        sonstiges,
        mitarbeiter: mitarbeiter?._id,
        teamleiter: teamleiterId,
        assigned: !!(mitarbeiter?._id && teamleiterId),
      });

      await evaluierung.save();
      logger.info('✓ Evaluierung created:', evaluierung._id);

      return {
        success: true,
        id: evaluierung._id,
        message: 'Evaluierung created successfully',
      };
    } catch (error) {
      logger.error('Error processing Evaluierung:', error.message);
      throw error;
    }
  }

  /**
   * Formatiert Datum
   */
  formatDate(dateInput) {
    const date = new Date(dateInput);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  /**
   * Sendet Benachrichtigung für erstellten Laufzettel
   */
  async sendLaufzettelNotification(laufzettel) {
    try {
      const subject = `✓ Laufzettel erstellt - ${laufzettel.name_mitarbeiter}`;
      const body = `
        <h2>Neuer Laufzettel</h2>
        <p><strong>Mitarbeiter:</strong> ${laufzettel.name_mitarbeiter}</p>
        <p><strong>Teamleiter:</strong> ${laufzettel.name_teamleiter}</p>
        <p><strong>Location:</strong> ${laufzettel.location}</p>
        <p><strong>Datum:</strong> ${this.formatDate(laufzettel.datum)}</p>
        <p><strong>Status:</strong> ${laufzettel.assigned ? '✓ Zugewiesen' : '⚠ Nicht zugewiesen'}</p>
      `;

      await sendMail('it@straightforward.email', subject, body);
    } catch (error) {
      logger.error('Failed to send Laufzettel notification:', error.message);
    }
  }

  /**
   * Sendet Fehlerbenachrichtigung
   */
  async sendErrorNotification(message, data) {
    try {
      await sendMail(
        'it@straightforward.email',
        `⚠️ WPForms Automatisierung - Fehler`,
        `<p>${message}</p><pre>${JSON.stringify(data, null, 2)}</pre>`
      );
    } catch (error) {
      logger.error('Failed to send error notification:', error.message);
    }
  }

  /**
   * Synchronisiert alle unverarbeiteten Laufzettel
   * (wird von serverRoutines.js aufgerufen)
   */
  async syncAllLaufzettel() {
    try {
      logger.info('🔄 Starting WPForms Laufzettel sync...');

      // Hier können neue Einträge abgerufen werden
      // Da WP entries noch nicht vollständig konfiguriert sind,
      // starten wir mit einem Placeholder
      
      logger.info('✓ WPForms Laufzettel sync completed');
      return { success: true, processed: 0 };
    } catch (error) {
      logger.error('WPForms sync failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WPFormsService();
