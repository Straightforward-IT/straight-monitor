#!/usr/bin/env node
/**
 * Helper script to find the folder ID for parser@straightforward.email shared mailbox
 * 
 * Usage: node scripts/get-parser-folder-id.js
 */

const axios = require('axios');
require('dotenv').config();

const TENANT = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
const IT_UPN = 'it@straightforward.email';

async function getAppToken() {
  const url = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');
  
  const { data } = await axios.post(url, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data.access_token;
}

async function listMailFolders(token, upn) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}/mailFolders`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data.value;
}

async function listChildFolders(token, upn, folderId) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}/mailFolders/${folderId}/childFolders`;
  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.value;
  } catch (e) {
    return [];
  }
}

async function listSharedMailboxes(token) {
  try {
    // Get all mailboxes that the current user has access to
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders?$top=1000`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.value || [];
  } catch (e) {
    console.error('Could not list mailboxes:', e.message);
    return [];
  }
}

async function getSharedMailboxFolders(token, sharedMailboxEmail) {
  try {
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sharedMailboxEmail)}/mailFolders`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.value || [];
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log('🔍 Finding folder ID for parser@straightforward.email shared mailbox...\n');
  
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing environment variables!');
    console.error('Make sure GRAPH_TENANT_ID, GRAPH_CLIENT_ID, and GRAPH_CLIENT_SECRET are set in .env');
    process.exit(1);
  }

  try {
    console.log('🔐 Getting access token...');
    const token = await getAppToken();
    console.log('✅ Token acquired\n');

    // First, show IT user's own folders
    console.log(`📂 Listing mail folders for ${IT_UPN}...\n`);
    const ownFolders = await listMailFolders(token, IT_UPN);

    console.log('📧 YOUR MAILBOX (it@straightforward.email):');
    console.log('─'.repeat(80));
    
    for (const folder of ownFolders) {
      console.log(`📁 ${folder.displayName}`);
      console.log(`   ID: ${folder.id}`);
      console.log(`   Total Items: ${folder.totalItemCount}`);
      console.log(`   Unread: ${folder.unreadItemCount}`);
      
      // Check for child folders
      const children = await listChildFolders(token, IT_UPN, folder.id);
      if (children.length > 0) {
        console.log(`   📦 Child folders:`);
        for (const child of children) {
          console.log(`      └─ ${child.displayName} (${child.totalItemCount} items)`);
          console.log(`         ID: ${child.id}`);
        }
      }
      console.log('');
    }

    // Now try to get shared mailbox folders directly
    console.log('\n🔓 SHARED MAILBOXES:');
    console.log('─'.repeat(80));
    
    const parserMailbox = 'parser@straightforward.email';
    console.log(`\n� Trying to access: ${parserMailbox}\n`);
    
    const sharedFolders = await getSharedMailboxFolders(token, parserMailbox);
    
    if (sharedFolders.length > 0) {
      console.log(`📁 ${parserMailbox}`);
      for (const folder of sharedFolders) {
        const isInbox = folder.displayName.toLowerCase() === 'inbox';
        const marker = isInbox ? ' ← ⭐ USE THIS ONE!' : '';
        console.log(`   📂 ${folder.displayName}${marker}`);
        console.log(`      ID: ${folder.id}`);
        console.log(`      Total Items: ${folder.totalItemCount}`);
        console.log(`      Unread: ${folder.unreadItemCount}`);
        console.log('');
      }
    } else {
      console.log(`⚠️  Could not find folders for ${parserMailbox}`);
      console.log('   This might mean the user does not have access to this shared mailbox.');
      console.log('   Check that it@straightforward.email has FullAccess permission.\n');
    }

    console.log('─'.repeat(80));
    console.log('\n💡 INSTRUCTIONS:');
    console.log('1. Find the Inbox folder ID from the "SHARED MAILBOXES" section above');
    console.log('2. Copy the ID (the long encoded string)');
    console.log('3. Update api/config/teams.json:');
    console.log('   Find the "parser" team configuration');
    console.log('   Replace folderId: "REPLACE_WITH_ACTUAL_FOLDER_ID" with your ID');
    console.log('4. Then run: curl http://localhost:5050/api/graph/ensure-subscription?team=parser\n');

    if (sharedFolders.length > 0) {
      const inbox = sharedFolders.find(f => f.displayName.toLowerCase() === 'inbox');
      if (inbox) {
        console.log(`✨ PARSER MAILBOX INBOX ID:\n   ${inbox.id}\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.error('\n🔑 Authentication failed. Check your credentials in .env');
    } else if (error.response?.status === 403) {
      console.error('\n🚫 Access denied. The IT user might not have access to this shared mailbox.');
    }
    process.exit(1);
  }
}

main();
