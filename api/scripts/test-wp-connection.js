/**
 * WordPress Connection Tester
 * Testet die Verbindung zu WordPress mit den .env Credentials
 */

require('dotenv').config();
const axios = require('axios');

const WP_USER = process.env.WP_USER;
const WP_PASSWORD = process.env.WP_FORMS_PASSWORD;
const WP_API_URL = process.env.WP_API_URL;

console.log('\n========================================');
console.log('WordPress Connection Test');
console.log('========================================\n');

// Validate env vars
if (!WP_USER || !WP_PASSWORD || !WP_API_URL) {
  console.error('❌ Error: Missing environment variables!');
  console.error(`   WP_USER: ${WP_USER ? '✓' : '✗'}`);
  console.error(`   WP_FORMS_PASSWORD: ${WP_PASSWORD ? '✓' : '✗'}`);
  console.error(`   WP_API_URL: ${WP_API_URL ? '✓' : '✗'}`);
  process.exit(1);
}

console.log('📋 Configuration:');
console.log(`   User: ${WP_USER}`);
console.log(`   API URL: ${WP_API_URL}`);
console.log(`   Password: ${'*'.repeat(Math.max(WP_PASSWORD.length - 4, 8))}${WP_PASSWORD.slice(-4)}`);
console.log('\n');

// Extract base URL (remove /wp/v2 if present)
let baseUrl = WP_API_URL;
if (baseUrl.endsWith('/wp/v2')) {
  baseUrl = baseUrl.replace('/wp/v2', '');
}

console.log(`📍 Base URL (adjusted): ${baseUrl}\n`);

// Create axios instance with Basic Auth
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

async function testConnection() {
  try {
    console.log('🔍 Testing connection to WordPress API...\n');

    // Test 1: Get WP User Info
    console.log('Test 1: Fetching current user info...');
    try {
      const userResponse = await wpAxios.get('/wp/v2/users/me');
      console.log(`   ✓ Success! User: ${userResponse.data.name} (ID: ${userResponse.data.id})`);
      console.log(`   Email: ${userResponse.data.email}`);
    } catch (error) {
      console.error(`   ✗ Failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }

    console.log('\n');

    // Test 2: List WPForms
    console.log('Test 2: Fetching WPForms...');
    try {
      // Try alternative endpoint if available
      const formsResponse = await wpAxios.get('/wpforms/v1/forms');
      console.log(`   ✓ Success! Found ${formsResponse.data.data?.length || formsResponse.data.length} forms`);
      if (formsResponse.data.data) {
        formsResponse.data.data.slice(0, 3).forEach(form => {
          console.log(`      - ${form.post_title || form.title} (ID: ${form.ID || form.id})`);
        });
      }
    } catch (error) {
      console.warn(`   ⚠ WPForms endpoint not available: ${error.response?.status}`);
      console.log(`   Trying alternative endpoints...\n`);

      // Try to get posts
      try {
        const postsResponse = await wpAxios.get('/wp/v2/posts?per_page=5');
        console.log(`   ✓ Posts endpoint works! Found ${postsResponse.data.length} posts`);
      } catch (e) {
        console.error(`   ✗ Posts endpoint failed: ${e.response?.status}`);
      }
    }

    console.log('\n');

    // Test 3: Check authentication
    console.log('Test 3: Verifying authentication...');
    try {
      const response = await wpAxios.get('/wp/v2/settings');
      console.log(`   ✓ Authentication successful!`);
      console.log(`   Site Title: ${response.data.title}`);
      console.log(`   Site URL: ${response.data.url}`);
    } catch (error) {
      console.error(`   ✗ Auth failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }

    console.log('\n');

    // Test 4: Check plugin availability
    console.log('Test 4: Checking plugin endpoints...');
    const pluginEndpoints = [
      '/wpforms/v1/forms',
      '/wpforms/v1/entries',
      '/wp/v2/pages',
      '/wp/v2/media'
    ];

    for (const endpoint of pluginEndpoints) {
      try {
        const response = await wpAxios.head(endpoint);
        console.log(`   ✓ ${endpoint.padEnd(25)} - Available (${response.status})`);
      } catch (error) {
        const status = error.response?.status || 'N/A';
        console.log(`   ✗ ${endpoint.padEnd(25)} - Not available (${status})`);
      }
    }

    console.log('\n');
    console.log('========================================');
    console.log('✓ Connection test completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Unexpected error:');
    console.error(error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    process.exit(1);
  }
}

testConnection();
