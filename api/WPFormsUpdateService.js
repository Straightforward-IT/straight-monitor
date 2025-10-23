/**
 * WPForms Update Service
 * Verwaltet die Aktualisierung von Formular-Feldern (z.B. Teamleiter-Auswahlmöglichkeiten)
 */

const axios = require('axios');
const logger = require('./utils/logger');

class WPFormsUpdateService {
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

  extractBaseUrl(url) {
    if (!url) throw new Error('WP_API_URL not configured');
    return url.endsWith('/wp/v2') ? url.replace('/wp/v2', '') : url;
  }

  /**
   * Holt die aktuelle Formular-Konfiguration
   */
  async getFormConfig(formId) {
    try {
      logger.debug(`Fetching form config for form ${formId}`);
      const response = await this.wpAxios.get(`/wp/v2/posts/${formId}`);
      
      if (!response.data || !response.data.content) {
        throw new Error('No form content found');
      }

      // Parse the JSON content
      const content = typeof response.data.content === 'string' 
        ? JSON.parse(response.data.content) 
        : response.data.content;

      return {
        postData: response.data,
        formConfig: content,
      };
    } catch (error) {
      logger.error(`Failed to fetch form config: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aktualisiert die Auswahlmöglichkeiten eines Formularfeldes
   * @param {number} formId - WPForm ID
   * @param {number} fieldId - Field ID (13, 14, oder 15 für Teamleiter)
   * @param {Array} teamleiterList - Array mit Teamleiter-Daten
   */
  async updateTeamliterChoices(formId, fieldId, teamleiterList) {
    try {
      logger.info(`Updating field ${fieldId} in form ${formId} with ${teamleiterList.length} options`);

      // Hole aktuelle Konfiguration
      const { postData, formConfig } = await this.getFormConfig(formId);

      // Prüfe ob Field existiert
      if (!formConfig.fields || !formConfig.fields[fieldId]) {
        throw new Error(`Field ${fieldId} not found in form`);
      }

      // Konvertiere Teamleiter-Liste zu WPForms-Format
      const choices = this.convertToWPFormsChoices(teamleiterList);

      // Update das Field
      formConfig.fields[fieldId].choices = choices;

      // Speichere die aktualisierte Konfiguration zurück
      const updatePayload = {
        content: JSON.stringify(formConfig),
      };

      const response = await this.wpAxios.post(`/wp/v2/posts/${formId}`, updatePayload);
      
      logger.info(`✓ Field ${fieldId} updated successfully`);
      return {
        success: true,
        fieldId,
        optionsCount: teamleiterList.length,
        message: `Field ${fieldId} updated with ${teamleiterList.length} options`,
      };
    } catch (error) {
      logger.error(`Failed to update field: ${error.message}`);
      throw error;
    }
  }

  /**
   * Konvertiert eine Mitarbeiter-Liste zu WPForms-Choice-Format
   */
  convertToWPFormsChoices(mitarbeiterList) {
    const choices = {};
    
    mitarbeiterList.forEach((ma, index) => {
      // Nutze die ID als Key
      const key = ma.id || ma._id || (index + 1).toString();
      
      choices[key] = {
        label: `${ma.vorname} ${ma.nachname}`,
        value: '',
        image: '',
        icon: 'face-smile',
        icon_style: 'regular',
      };
    });

    return choices;
  }

  /**
   * Aktualisiert alle Teamleiter-Felder für eine Niederlassung
   * @param {string} team - 'berlin', 'hamburg', oder 'koeln'
   * @param {Array} teamleiterList - Array mit Teamleiter-Daten
   */
  async updateTeamForLocation(team, teamleiterList) {
    try {
      const teamMap = {
        berlin: { formId: 171, fieldId: 13 },
        hamburg: { formId: 171, fieldId: 14 },
        koeln: { formId: 171, fieldId: 15 },
      };

      const config = teamMap[team.toLowerCase()];
      if (!config) {
        throw new Error(`Unknown team: ${team}`);
      }

      logger.info(`Updating ${team} teamleiter options...`);
      
      const result = await this.updateTeamliterChoices(
        config.formId,
        config.fieldId,
        teamleiterList
      );

      return result;
    } catch (error) {
      logger.error(`Failed to update team: ${error.message}`);
      throw error;
    }
  }

  /**
   * Aktualisiert alle Teamleiter-Felder basierend auf Mitarbeiter aus der Datenbank
   */
  async syncTeamleiterFromDatabase() {
    try {
      const Mitarbeiter = require('./models/Mitarbeiter');
      
      logger.info('Syncing teamleiter options from database...');

      // Hol alle Teamleiter gruppiert nach Niederlassung
      const teamleiterByLocation = await Mitarbeiter.aggregate([
        {
          $match: {
            is_teamleiter: true,
            standort: { $in: ['Berlin', 'Hamburg', 'Köln', 'koeln'] },
          },
        },
        {
          $group: {
            _id: '$standort',
            teamleiter: {
              $push: {
                id: '$_id',
                vorname: '$vorname',
                nachname: '$nachname',
              },
            },
          },
        },
      ]);

      const results = [];

      for (const location of teamleiterByLocation) {
        const locationKey = this.normalizeLocationKey(location._id);
        
        if (locationKey) {
          const result = await this.updateTeamForLocation(
            locationKey,
            location.teamleiter
          );
          results.push(result);
        }
      }

      logger.info(`✓ Synced ${results.length} locations`);
      return {
        success: true,
        results,
        message: `Successfully synced ${results.length} locations`,
      };
    } catch (error) {
      logger.error(`Failed to sync teamleiter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalisiert Niederlassungs-Namen für konsistentes Mapping
   */
  normalizeLocationKey(location) {
    const normalized = location.toLowerCase();
    
    if (normalized.includes('berlin')) return 'berlin';
    if (normalized.includes('hamburg')) return 'hamburg';
    if (normalized.includes('köln') || normalized.includes('koeln')) return 'koeln';
    
    return null;
  }
}

module.exports = new WPFormsUpdateService();
