
<template>
  <div class="flip-test-container">
    <h1>Flip Debugger V2</h1>
    
    <div class="card">
      <h2>1. URL & Query Params</h2>
      <p class="url-text"><strong>Full Path:</strong> {{ currentPath }}</p>
      <div v-if="Object.keys(queryParams).length > 0">
        <div v-for="(value, key) in queryParams" :key="key" class="param-row">
          <span class="param-key">{{ key }}:</span>
          <span class="param-value">{{ value }}</span>
        </div>
      </div>
      <div v-else class="empty-state">No query parameters found in URL.</div>
    </div>

    <div class="card">
      <h2>2. User Agent (Detect Flip App)</h2>
      <div class="code-block">{{ userAgent }}</div>
    </div>

    <div class="card">
      <h2>3. Window Objects (Injected JS)</h2>
      <p>Searching for known app-bridge objects...</p>
      <div v-if="windowProps.length > 0">
        <div v-for="prop in windowProps" :key="prop.key" class="param-row">
          <span class="param-key">window.{{ prop.key }}:</span>
          <span class="param-value">{{ prop.value }}</span>
        </div>
      </div>
      <div v-else class="empty-state">No specific global objects found (checked for: flip, Flip, oidc, user, android, webkit).</div>
    </div>

    <div class="card">
      <h2>5. Flip Bridge (Experimental)</h2>
      <p>Status: {{ bridgeStatus }}</p>
      <div v-if="bridgeError" class="error-text">{{ bridgeError }}</div>
      <div class="actions-mini">
        <button @click="testToast">Test Toast Notification</button>
        <button @click="testTheme">Get Theme</button>
        <button @click="testThemeSubscription">Subscribe to Theme Changes</button>
      </div>
      <p class="small-text" v-if="bridgeResult">Last Result: {{ bridgeResult }}</p>
    </div>

    <div class="card">
      <h2>6. IndexedDB Probe</h2>
      <div class="actions-mini">
        <button @click="probeIndexedDB">Read Flip KeyValue</button>
        <button @click="listAllDatabases">List All DBs</button>
      </div>
      <div v-if="databaseList.length" class="code-block">
        <strong>Found Databases:</strong>
        <div v-for="dbVal in databaseList" :key="dbVal">{{ dbVal }}</div>
      </div>
      <div v-if="indexedDBStatus" class="status-text">{{ indexedDBStatus }}</div>
      <div v-if="indexedDBValue" class="code-block">{{ indexedDBValue }}</div>
    </div>

    <div class="actions">
      <button @click="refreshPage">Refresh Page</button>
      <button @click="$router.push('/')">Back to Home</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
// Import Flip Bridge
import { initFlipBridge, showToast, getTheme, subscribe, BridgeEventType } from '@getflip/bridge';

const route = useRoute();
const queryParams = computed(() => route.query);
const currentPath = computed(() => route.fullPath);
const userAgent = navigator.userAgent;
const cookies = document.cookie;

const windowProps = ref([]);
const bridgeStatus = ref('Not Initialized');
const bridgeError = ref('');
const bridgeResult = ref('');

const indexedDBStatus = ref('');
const indexedDBValue = ref('');
const databaseList = ref([]);

async function listAllDatabases() {
  databaseList.value = [];
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      databaseList.value = dbs.map(d => `${d.name} (v${d.version})`);
      if (dbs.length === 0) databaseList.value.push('No databases found.');
    } else {
      databaseList.value.push('indexedDB.databases() API not supported.');
    }
  } catch (e) {
    databaseList.value.push('Error: ' + e.message);
  }
}

async function probeIndexedDB() {
  indexedDBStatus.value = 'Opening DB: flip-keyvalue-db...';
  indexedDBValue.value = '';
  
  try {
    const dbName = 'flip-keyvalue-db';
    const storeName = 'generalPurpose';
    const key = 'token';

    const request = indexedDB.open(dbName);
    
    request.onerror = (event) => {
      indexedDBStatus.value = `Error opening DB: ${event.target.error}`;
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(storeName)) {
        indexedDBStatus.value = `Store "${storeName}" not found in DB "${dbName}".`;
        // List available stores for debugging
        const stores = Array.from(db.objectStoreNames);
        indexedDBValue.value = `Available stores: ${JSON.stringify(stores)}`;
        return;
      }

      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          indexedDBStatus.value = 'Success!';
          // If result is an object, display formatted JSON, else string
          indexedDBValue.value = typeof getRequest.result === 'object' 
            ? JSON.stringify(getRequest.result, null, 2) 
            : String(getRequest.result);
        } else {
          indexedDBStatus.value = `Key "${key}" not found in store "${storeName}".`;
          
          // Try to list all keys in store to see what IS there
          const allKeysReq = store.getAllKeys();
          allKeysReq.onsuccess = () => {
             indexedDBValue.value = `Available keys: ${JSON.stringify(allKeysReq.result)}`;
          };
        }
      };

      getRequest.onerror = (err) => {
        indexedDBStatus.value = `Error reading key: ${err.target.error}`;
      };
    };

  } catch (err) {
    indexedDBStatus.value = `Exception: ${err.message}`;
  }
}

const fetchStatus = ref('');
const fetchResult = ref('');

async function fetchFlipUser() {
  fetchStatus.value = 'Fetching...';
  fetchResult.value = '';
  
  // Endpoint guessed based on typical Flip API patterns or the user's specific domain
  const url = 'https://straightforward.flip-app.com/api/v2/users/me';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // We do NOT set Authorization header here, hoping the browser sends cookies
      },
      credentials: 'include' // This asks the browser to send cookies for flip-app.com
    });
    
    fetchStatus.value = `Response Status: ${response.status}`;
    
    if (response.ok) {
      const data = await response.json();
      fetchResult.value = JSON.stringify(data, null, 2);
    } else {
      fetchResult.value = `Request failed: ${response.statusText}`;
      try {
        const errText = await response.text();
        fetchResult.value += `\nBody: ${errText.substring(0, 200)}`;
      } catch (e) { /* ignore */ }
    }
  } catch (err) {
    fetchStatus.value = 'Fetch Failed (Likely CORS)';
    fetchResult.value = err.message;
  }
}

function checkWindowObjects() {
  const keys = ['flip', 'Flip', 'FLIP', 'oidc', 'user', 'User', 'Android', 'webkit', 'external'];
  const found = [];
  
  keys.forEach(key => {
    if (window[key]) {
      try {
        const val = window[key];
        found.push({ key, value: typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val) });
      } catch (e) {
        found.push({ key, value: '(Object exists but cannot stringify)' });
      }
    }
  });
  windowProps.value = found;
}

async function initBridge() {
  try {
    bridgeStatus.value = 'Initializing...';
    // Initialize the bridge
    initFlipBridge({
      hostAppOrigin: '*', // Allow any origin for testing
      debug: true        // Enable debug logs in console
    });
    bridgeStatus.value = 'Initialized (Check Console)';
  } catch (err) {
    console.error("Bridge Init Error:", err);
    bridgeStatus.value = 'Failed';
    bridgeError.value = String(err);
  }
}

async function testToast() {
  try {
    await showToast({
      text: 'Hello from StraightMonitor!',
      intent: 'success',
      duration: 3000
    });
    bridgeResult.value = 'Toast sent successfully';
  } catch (err) {
    bridgeResult.value = 'Toast Error: ' + err.message;
  }
}

async function testTheme() {
  try {
    const theme = await getTheme();
    bridgeResult.value = 'Theme: ' + JSON.stringify(theme);
  } catch (err) {
    bridgeResult.value = 'Theme Error: ' + err.message;
  }
}

async function testThemeSubscription() {
  try {
    const unsubscribe = await subscribe(BridgeEventType.THEME_CHANGE, (event) => {
      bridgeResult.value = 'Theme changed! New theme: ' + JSON.stringify(event.data);
      console.log('Theme change event:', event);
    });
    bridgeResult.value = 'Theme subscription active! Change the theme in Flip to see updates.';
    // Store unsubscribe for later cleanup if needed
    window.flipThemeUnsubscribe = unsubscribe;
  } catch (err) {
    bridgeResult.value = 'Theme Subscription Error: ' + err.message;
  }
}

function refreshPage() {
  window.location.reload();
}

onMounted(() => {
  checkWindowObjects();
  initBridge();
});
</script>

<style scoped>
.flip-test-container {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: sans-serif;
  background-color: #f4f6f8;
  min-height: 100vh;
}

h1 { color: #333; font-size: 1.5rem; margin-bottom: 1rem; }
h2 { font-size: 1.1rem; margin-top: 0; color: #444; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  padding: 1rem;
  margin-bottom: 1rem;
}

.url-text { word-break: break-all; color: #666; font-size: 0.9rem; }
.code-block { 
  background: #2d2d2d; 
  color: #76ff03; 
  padding: 0.8rem; 
  border-radius: 4px; 
  font-family: monospace; 
  font-size: 0.85rem; 
  white-space: pre-wrap;
  word-break: break-word;
}

.param-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #f9f9f9;
  border-left: 3px solid #0066cc;
  border-radius: 2px;
}
.param-key { font-weight: bold; color: #333; font-size: 0.9rem; }
.param-value { word-break: break-all; color: #0066cc; font-family: monospace; margin-top: 0.2rem; }

.empty-state { color: #999; font-style: italic; }

.error-text { color: #dc3545; font-weight: bold; margin: 0.5rem 0; }
.small-text { font-size: 0.8rem; color: #666; margin-top: 0.5rem; }

.actions { display: flex; gap: 10px; margin-top: 2rem; }
.actions-mini { display: flex; gap: 10px; margin: 1rem 0; }

.actions button, .actions-mini button {
  padding: 0.6rem 1rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.actions-mini button { background: #6c757d; font-size: 0.9rem; }
</style>

