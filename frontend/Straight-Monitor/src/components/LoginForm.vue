<template>
  <form class="auth-form" @submit.prevent="submitLogin" autocomplete="off">
    <h2>Wir sind <strong>Straightforward</strong></h2>
    <p>Schön, dass du hier bist. Bitte melde dich an.</p>

    <label class="field">
      <span>Email</span>
      <input
        type="email"
        v-model.trim="email"
        autocomplete="username"
        required
      />
    </label>

    <label class="field">
      <span>Passwort</span>
      <div class="pw">
        <input
          :type="showPw ? 'text' : 'password'"
          v-model="password"
          autocomplete="current-password"
          required
        />
        <label class="pw-toggle">
          <input type="checkbox" v-model="showPw" />
          <small>anzeigen</small>
        </label>
      </div>
    </label>

    <div class="actions">
      <button type="submit" :disabled="loading">
        {{ loading ? "Anmelden…" : "Log in" }}
      </button>
      <button type="button" class="ghost" @click="$emit('switch-to-register')">
        Register
      </button>
    </div>

    <teleport to="body">
      <div v-if="showModal" class="modal" @click.self="closeModal">
        <div class="modal-card">
          <h3>Anmeldung fehlgeschlagen</h3>
          <p>{{ modalMessage }}</p>
          <button @click="closeModal">OK</button>
        </div>
      </div>
    </teleport>
  </form>
</template>

<script setup>
import { ref } from "vue";
import api from "@/utils/api";
import { useRouter } from "vue-router";

const router = useRouter();
const email = ref("");
const password = ref("");
const showPw = ref(false);
const loading = ref(false);
const showModal = ref(false);
const modalMessage = ref("");

function closeModal() {
  showModal.value = false;
}

async function submitLogin() {
  if (loading.value) return;
  loading.value = true;
  try {
    const { data } = await api.post("/api/users/login", {
      email: email.value,
      password: password.value,
    });
    localStorage.setItem("token", data.token);
    router.push("/dashboard");
  } catch (err) {
    modalMessage.value = err?.response?.data?.msg || "Unbekannter Fehler.";
    showModal.value = true;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}
h2 {
  font-size: 20px;
  color: $base-text-dark;
}
p {
  color: $base-text-medium;
  margin-top: -6px;
  margin-bottom: 2px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field span {
  font-size: 12px;
  color: $base-text-medium;
}
input {
  width: 100%;
  border: 1px solid $base-border-color;
  border-radius: 8px;
  background: $base-panel-bg;
  padding: 12px 12px;
  font-size: 14px;
  color: $base-text-dark;
  transition: border-color 0.15s, box-shadow 0.15s;
}
input:focus {
  outline: none;
  border-color: $base-primary;
  box-shadow: 0 0 0 3px rgba($base-primary, 0.15);
}

.pw {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pw-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $base-text-medium;
  user-select: none;
}
.pw-toggle input {
  width: auto;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
button {
  appearance: none;
  border: 0;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  background: $base-primary;
  color: white;
  box-shadow: 0 2px 6px rgba($base-primary, 0.35);
  transition: transform 0.05s ease, filter 0.15s ease;
}
button:active {
  transform: translateY(1px);
}
button[disabled] {
  opacity: 0.6;
  cursor: default;
}
button.ghost {
  background: transparent;
  color: $base-primary;
  border: 1px solid $base-primary;
  box-shadow: none;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  z-index: 999;
}
.modal-card {
  background: #fff;
  width: min(420px, 92vw);
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid $base-border-color;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
}
.modal-card h3 {
  margin-bottom: 6px;
  color: $base-text-dark;
}
.modal-card p {
  color: $base-text-notsodark;
  margin-bottom: 10px;
}
.modal-card button {
  width: 100%;
}
</style>
