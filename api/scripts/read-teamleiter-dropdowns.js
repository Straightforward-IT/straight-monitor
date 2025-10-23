#!/usr/bin/env node

/**
 * Read WPForms Teamleiter Dropdowns
 * 
 * Liest die aktuellen Inhalte der Teamleiter-Dropdowns aus WPForms aus
 * und zeigt sie formatiert an.
 * 
 * Verwendung:
 * node scripts/read-teamleiter-dropdowns.js
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

const FORM_ID = 171;
const FIELD_IDS = {
  berlin: 13,
  hamburg: 14,
  koeln: 15,
};

// Create WP API client
const wpAxios = axios.create({
  baseURL: 'https://flipcms.de/integration/flipcms/hpstraightforward/wp-json',
  auth: {
    username: process.env.WP_USER,
    password: process.env.WP_FORMS_PASSWORD,
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

async function readDropdowns() {
  try {
    logger.info('📖 Reading WPForms Teamleiter Dropdowns...\n');

    // Fetch the form via WPForms REST API
    logger.debug(`Fetching form ${FORM_ID} from WPForms API...`);
    
    let formConfig;
    try {
      const response = await wpAxios.get(`/wpforms/v1/forms/${FORM_ID}`);
      
      if (!response.data) {
        throw new Error('No form data returned');
      }

      formConfig = response.data;
      logger.debug('Form fetched successfully');
    } catch (error) {
      if (error.response?.status === 404) {
        logger.error(`❌ Form ${FORM_ID} not found on WordPress`);
        logger.error('\nAvailable forms:');
        logger.error('  - 408: Adventsverlosung | Atento Kulturgutschein');
        logger.error('  - 291: Terminfindung für Teamleiterschulung');
        logger.error('  - 189: Feedback');
        logger.error('  - 176: Evaluierung MA');
        logger.error('  - 171: Laufzettel (THIS ONE)');
        logger.error('  - 65: Unterlagen einreichen');
        logger.error('  - 31: Event Report');
        logger.error('  - 24: Lohnvorschuss');
        logger.error('  - 10: Urlaubsantrag');
        logger.error('  - 6: Krankmeldung');
        process.exit(1);
      }
      throw error;
    }

    for (const [team, fieldId] of Object.entries(FIELD_IDS)) {
      logger.info(`\n${'='.repeat(70)}`);
      logger.info(`📍 ${team.toUpperCase()} (Field ${fieldId})`);
      logger.info(`${'='.repeat(70)}\n`);

      if (!formConfig.fields || !formConfig.fields[fieldId]) {
        logger.warn(`⚠️  Field ${fieldId} not found in form ${FORM_ID}`);
        continue;
      }

      const field = formConfig.fields[fieldId];
      const choices = field.choices || {};
      const choiceCount = Object.keys(choices).length;

      logger.info(`Field Label: ${field.label}`);
      logger.info(`Field Type: ${field.type}`);
      logger.info(`Total Options: ${choiceCount}\n`);

      if (choiceCount === 0) {
        logger.warn('⚠️  No options found in this dropdown');
        continue;
      }

      // Tabelle für bessere Anzeige
      console.log('┌──────────────────────────────────────────────────────────────────┐');
      console.log('│ ID                    │ Name                                      │');
      console.log('├──────────────────────────────────────────────────────────────────┤');

      Object.entries(choices).forEach(([id, choice], index) => {
        const name = choice.label || '(no label)';
        const idStr = id.substring(0, 20).padEnd(20);
        const nameStr = name.substring(0, 40).padEnd(40);
        console.log(`│ ${idStr} │ ${nameStr} │`);
      });

      console.log('└──────────────────────────────────────────────────────────────────┘\n');

    }

    logger.info(`\n${'='.repeat(70)}`);
    logger.info('✅ Dropdown reading completed!');
    logger.info(`${'='.repeat(70)}\n`);

    process.exit(0);

  } catch (error) {
    logger.error('❌ Failed to read dropdowns:', error.message);
    if (error.response?.data) {
      logger.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

readDropdowns();
