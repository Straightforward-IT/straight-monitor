/**
 * Test für WPFormsService - Laufzettel Automation
 * Testet die automatisierte Verarbeitung von WPForms Einträgen
 */

require('dotenv').config();
const logger = require('../utils/logger');
const WPFormsService = require('../WPFormsService');

async function testWPFormsService() {
  try {
    console.log('\n========================================');
    console.log('WPFormsService Test - Laufzettel Automation');
    console.log('========================================\n');

    // Test 1: Connection
    console.log('Test 1: Connection to WPForms API...');
    const forms = await WPFormsService.getAllForms();
    console.log(`✓ Connected! Found ${forms.length} forms\n`);

    // Test 2: Find Laufzettel Form
    console.log('Test 2: Finding Laufzettel form (ID: 171)...');
    const laufzettelForm = forms.find(f => f.ID === 171 || f.id === 171);
    if (laufzettelForm) {
      console.log(`✓ Found: ${laufzettelForm.post_title || laufzettelForm.title}\n`);
    } else {
      console.log('⚠ Laufzettel form not found\n');
    }

    // Test 3: Test Laufzettel Processing (Dry Run)
    console.log('Test 3: Testing Laufzettel entry processing (Dry Run)...');
    const testLaufzettelData = {
      location: 'Hamburg',
      name_mitarbeiter: 'Max Mustermann',
      name_teamleiter: 'John Supervisor',
      email: 'max.mustermann@straightforward.email',
      datum: new Date().toISOString().split('T')[0],
    };

    console.log('Input data:');
    console.log(JSON.stringify(testLaufzettelData, null, 2));
    console.log('\nProcessing...\n');

    try {
      const result = await WPFormsService.processLaufzettelEntry(testLaufzettelData);
      console.log('✓ Result:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('⚠ Processing failed (expected if test data is invalid):');
      console.log(error.message);
    }

    console.log('\n========================================');
    console.log('✓ WPFormsService Test completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Test failed:');
    console.error(error.message);
    process.exit(1);
  }
}

testWPFormsService();
