/**
 * WPForms Structure Analyzer
 * Zeigt die detaillierte Struktur der Laufzettel-Form
 */

require('dotenv').config();
const axios = require('axios');

const WP_USER = process.env.WP_USER;
const WP_PASSWORD = process.env.WP_FORMS_PASSWORD;
const WP_API_URL = process.env.WP_API_URL;

let baseUrl = WP_API_URL;
if (baseUrl.endsWith('/wp/v2')) {
  baseUrl = baseUrl.replace('/wp/v2', '');
}

const wpAxios = axios.create({
  baseURL: baseUrl,
  auth: {
    username: WP_USER,
    password: WP_PASSWORD
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

async function analyzeFormStructure() {
  try {
    console.log('\n========================================');
    console.log('WPForms Structure Analysis - Laufzettel');
    console.log('========================================\n');

    // Fetch all forms
    console.log('📋 Fetching all WPForms...\n');
    const formsResponse = await wpAxios.get('/wpforms/v1/forms?per_page=100');
    const forms = formsResponse.data.data || formsResponse.data;

    // Find Laufzettel form
    const laufzettelForm = forms.find(f => f.ID === 171 || f.id === 171);
    
    if (!laufzettelForm) {
      console.error('❌ Laufzettel form not found!');
      process.exit(1);
    }

    console.log(`✓ Found: ${laufzettelForm.post_title}\n`);
    console.log('Form Details:');
    console.log(JSON.stringify(laufzettelForm, null, 2));
    console.log('\n');

    // Try to get more detailed form data
    console.log('========================================');
    console.log('Attempting to fetch detailed form configuration...\n');

    try {
      const detailResponse = await wpAxios.get(`/wpforms/v1/forms/171`);
      const formData = detailResponse.data.data || detailResponse.data;
      
      console.log('Detailed Form Data:');
      console.log(JSON.stringify(formData, null, 2));
    } catch (error) {
      console.log('⚠️ Could not fetch /wpforms/v1/forms/171');
      console.log(`Status: ${error.response?.status}`);
      console.log('\nTrying alternative endpoints...\n');

      // Try getting the post data directly
      try {
        const postResponse = await wpAxios.get(`/wp/v2/posts/171`);
        console.log('Post Data (wp/v2/posts/171):');
        console.log(JSON.stringify(postResponse.data, null, 2));
      } catch (e) {
        console.log('Post endpoint also failed');
      }
    }

    console.log('\n========================================');
    console.log('✓ Analysis completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:');
    console.error(error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

analyzeFormStructure();
