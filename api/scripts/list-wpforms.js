#!/usr/bin/env node

/**
 * List all WPForms on WordPress
 * 
 * Listet alle verfügbaren WPForms auf und zeigt ihre IDs an.
 * 
 * Verwendung:
 * node scripts/list-wpforms.js
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

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

async function listForms() {
  try {
    logger.info('📋 Listing all WPForms...\n');

    // Try different endpoints to find forms
    const endpoints = [
      '/wp/v2/posts?type=wpforms',
      '/wpforms/v1/forms',
      '/wp/v2/posts',
    ];

    for (const endpoint of endpoints) {
      try {
        logger.debug(`Trying endpoint: ${endpoint}`);
        const response = await wpAxios.get(endpoint);
        
        if (response.data) {
          logger.info(`✅ Found data at: ${endpoint}\n`);
          
          let forms = [];
          
          if (Array.isArray(response.data)) {
            forms = response.data;
          } else if (response.data.forms) {
            forms = response.data.forms;
          } else if (response.data.data) {
            forms = response.data.data;
          }

          if (forms.length > 0) {
            console.log('┌────────┬──────────────────────────────────────────┐');
            console.log('│ ID     │ Title                                    │');
            console.log('├────────┼──────────────────────────────────────────┤');

            forms.forEach(form => {
              const id = (form.id || form.ID || '').toString().padEnd(6);
              const title = (form.title || form.post_title || form.name || '(no title)').substring(0, 40).padEnd(40);
              console.log(`│ ${id} │ ${title} │`);
            });

            console.log('└────────┴──────────────────────────────────────────┘\n');
            
            logger.info(`📊 Total forms found: ${forms.length}\n`);
            process.exit(0);
          }
        }
      } catch (error) {
        logger.debug(`Endpoint ${endpoint} failed: ${error.message}`);
      }
    }

    logger.error('❌ No forms found at any endpoint');
    logger.info('\nTry these debugging steps:');
    logger.info('1. Test WordPress API access directly:');
    logger.info(`   curl -u "${process.env.WP_USER}:${process.env.WP_FORMS_PASSWORD}" \\`);
    logger.info('     https://flipcms.de/integration/flipcms/hpstraightforward/wp-json/wp/v2/posts');
    logger.info('\n2. Check if WPForms is installed and activated');
    logger.info('\n3. Verify the post type is "wpforms"');
    process.exit(1);

  } catch (error) {
    logger.error('❌ Failed to list forms:', error.message);
    if (error.response?.data) {
      logger.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

listForms();
