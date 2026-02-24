<template>
  <div class="confirm-wrapper">
    <div class="confirm-card">
      <!-- Loading -->
      <template v-if="state === 'loading'">
        <div class="spinner" />
        <p class="hint">Einen Moment…</p>
      </template>

      <!-- Success -->
      <template v-else-if="state === 'success'">
        <div class="icon success-icon">✓</div>
        <h1>Task erledigt!</h1>
        <p>Der Task wurde erfolgreich abgeschlossen und entfernt.</p>
      </template>

      <!-- Already gone / not found -->
      <template v-else-if="state === 'not-found'">
        <div class="icon info-icon">ℹ</div>
        <h1>Bereits erledigt</h1>
        <p>Dieser Task wurde bereits abgeschlossen oder ist nicht mehr vorhanden.</p>
      </template>

      <!-- Error -->
      <template v-else>
        <div class="icon error-icon">✕</div>
        <h1>Fehler</h1>
        <p>{{ errorMessage }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import apiPublic from '@/utils/api-public';

const route = useRoute();
const state = ref('loading'); // 'loading' | 'success' | 'not-found' | 'error'
const errorMessage = ref('');

onMounted(async () => {
  const id = route.query.id;

  if (!id) {
    state.value = 'error';
    errorMessage.value = 'Kein Laufzettel-ID in der URL gefunden.';
    return;
  }

  try {
    await apiPublic.get(`/api/flip-tasks/laufzettel/${id}/finish`);
    state.value = 'success';
  } catch (err) {
    if (err.response?.status === 404) {
      state.value = 'not-found';
    } else {
      state.value = 'error';
      errorMessage.value = err.response?.data?.message || err.message;
    }
  }
});
</script>

<style scoped>
.confirm-wrapper {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 24px;
}

.confirm-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
}

.icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin: 0 auto 20px;
}

.success-icon { background: #dcfce7; color: #16a34a; }
.info-icon    { background: #dbeafe; color: #2563eb; }
.error-icon   { background: #fee2e2; color: #dc2626; }

h1 {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 10px;
  color: #111;
}

p {
  color: #666;
  font-size: 0.95rem;
  margin: 0;
  line-height: 1.5;
}

.hint {
  color: #999;
  font-size: 0.9rem;
}

/* Simple CSS spinner */
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: var(--primary, #f97316);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
