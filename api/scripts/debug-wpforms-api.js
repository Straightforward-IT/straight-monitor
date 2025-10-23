#!/usr/bin/env node

/**
 * Debug WPForms API Access
 * 
 * Testet den API-Zugriff auf WPForms und zeigt Debug-Informationen
 */

require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

async function testAccess() {
  try {
    logger.info('🔍 Testing WPForms API Access...\n');

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

    // Test 1: List all forms
    logger.info('1️⃣  Testing /wpforms/v1/forms (list)...');
    try {
      const listResponse = await wpAxios.get('/wpforms/v1/forms');
      logger.info(`   ✅ Success! Found ${listResponse.data?.length || 0} forms\n`);
    } catch (error) {
      logger.error(`   ❌ Failed: ${error.message}\n`);
    }

    // Test 2: Get single form (with different IDs)
    const testIds = [171, '171', 176, 31];
    
    for (const id of testIds) {
      logger.info(`2️⃣  Testing /wpforms/v1/forms/${id} (get single)...`);
      try {
        const response = await wpAxios.get(`/wpforms/v1/forms/${id}`);
        const form = response.data;
        if (form.id || form.ID) {
          logger.info(`   ✅ Success! Form "${form.title || form.name || '?'}" found`);
          
          // Show field info
          if (form.fields) {
            logger.info(`      Fields: ${Object.keys(form.fields).length}`);
            
            // Show field 13, 14, 15
            for (const fid of [13, 14, 15]) {
              if (form.fields[fid]) {
                const field = form.fields[fid];
                const choices = field.choices ? Object.keys(field.choices).length : 0;
                logger.info(`        - Field ${fid}: "${field.label}" (${field.type}, ${choices} choices)`);
              }
            }
          }
          logger.info('');
        } else {
          logger.warn(`   ⚠️  Response but no ID field\n`);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          logger.info(`   ⚠️  Not found (404)\n`);
        } else {
          logger.error(`   ❌ Error: ${error.message}\n`);
        }
      }
    }

    logger.info('\n✅ Debug completed!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

testAccess();
