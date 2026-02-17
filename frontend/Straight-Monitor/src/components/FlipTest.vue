<template>
  <div class="flip-test-container">
    <h1>Flip Integration Test</h1>
    <div class="card">
      <h2>Received Parameters</h2>
      <div v-if="Object.keys(queryParams).length > 0">
        <div v-for="(value, key) in queryParams" :key="key" class="param-row">
          <span class="param-key">{{ key }}:</span>
          <span class="param-value">{{ value }}</span>
        </div>
      </div>
      <div v-else>
        <p>No query parameters received.</p>
      </div>
    </div>
    
    <div class="actions">
      <button @click="$router.push('/')">Back to Home</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const queryParams = computed(() => route.query);
</script>

<style scoped>
.flip-test-container {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  font-family: sans-serif;
}

h1 {
  color: #333;
  margin-bottom: 1.5rem;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.param-row {
  display: flex;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.param-key {
  font-weight: bold;
  min-width: 150px;
  color: #555;
}

.param-value {
  word-break: break-all;
  color: #0066cc;
}

.actions button {
  padding: 0.5rem 1rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
