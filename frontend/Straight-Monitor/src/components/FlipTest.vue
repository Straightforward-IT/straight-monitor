
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
      <h2>4. Cookies</h2>
      <p>Could session info be in cookies?</p>
      <div class="code-block">{{ cookies || 'No cookies found' }}</div>
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

const route = useRoute();
const queryParams = computed(() => route.query);
const currentPath = computed(() => route.fullPath);
const userAgent = navigator.userAgent;
const cookies = document.cookie;

const windowProps = ref([]);

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

function refreshPage() {
  window.location.reload();
}

onMounted(() => {
  checkWindowObjects();
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

.actions { display: flex; gap: 10px; margin-top: 2rem; }
.actions button {
  padding: 0.8rem 1.5rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
</style>

