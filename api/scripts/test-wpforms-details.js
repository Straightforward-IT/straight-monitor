/**
 * WPForms Details Tester
 * Listet alle WPForms auf und zeigt ihre Struktur
 */

require('dotenv').config();
const axios = require('axios');

const WP_USER = process.env.WP_USER;
const WP_PASSWORD = process.env.WP_FORMS_PASSWORD;
const WP_API_URL = process.env.WP_API_URL;

// Extract base URL
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

async function getWPFormsDetails() {
  try {
    console.log('\n========================================');
    console.log('WPForms Details');
    console.log('========================================\n');

    // Fetch all forms
    const formsResponse = await wpAxios.get('/wpforms/v1/forms?per_page=100');
    const forms = formsResponse.data.data || formsResponse.data;

    console.log(`📋 Found ${forms.length} WPForms:\n`);

    forms.forEach((form, index) => {
      const formName = form.post_title || form.title || `Form ${form.ID || form.id}`;
      const formId = form.ID || form.id;
      
      console.log(`${index + 1}. ${formName}`);
      console.log(`   ID: ${formId}`);
      if (form.post_date) console.log(`   Created: ${form.post_date}`);
      if (form.status) console.log(`   Status: ${form.status}`);
      console.log('');
    });

    // Fetch detailed info for first form if available
    if (forms.length > 0) {
      const firstFormId = forms[0].ID || forms[0].id;
      console.log(`\n📊 Fetching detailed info for first form (ID: ${firstFormId})...\n`);
      
      try {
        const detailResponse = await wpAxios.get(`/wpforms/v1/forms/${firstFormId}`);
        const formData = detailResponse.data.data || detailResponse.data;
        
        console.log('Available fields in form:');
        console.log(JSON.stringify(formData, null, 2).substring(0, 1000));
        console.log('...\n');
      } catch (error) {
        console.log(`Could not fetch detailed form data: ${error.response?.status}`);
      }

      // Try to get form entries
      console.log(`\n📝 Trying to fetch entries for form ${firstFormId}...\n`);
      try {
        const entriesResponse = await wpAxios.get(`/wpforms/v1/entries?form_id=${firstFormId}&per_page=5`);
        const entries = entriesResponse.data.data || entriesResponse.data;
        
        if (entries && entries.length > 0) {
          console.log(`✓ Found ${entries.length} entries:`);
          entries.slice(0, 2).forEach((entry, i) => {
            console.log(`\n   Entry ${i + 1}:`);
            console.log(`   ID: ${entry.id || entry.entry_id}`);
            console.log(`   Data preview:`, JSON.stringify(entry).substring(0, 200));
          });
        } else {
          console.log(`✓ No entries found for this form`);
        }
      } catch (error) {
        console.log(`Could not fetch entries: ${error.response?.status} - ${error.response?.statusText}`);
      }
    }

    console.log('\n========================================');
    console.log('✓ Details completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:');
    console.error(error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    process.exit(1);
  }
}

getWPFormsDetails();
