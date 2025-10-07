<template>
  <form class="auth-form" @submit.prevent="submitRegister">
    <h2>Konto <strong>erstellen</strong></h2>
    <p>Einmal sauber registrieren, dann läuft der Laden.</p>

    <label class="field">
      <span>Standort</span>
      <select v-model="location" required>
        <option value="" disabled>Standort wählen</option>
        <option>Berlin</option><option>Hamburg</option><option>Köln</option>
      </select>
    </label>

    <label class="field">
      <span>Name</span>
      <input type="text" v-model.trim="name" autocomplete="name" required />
    </label>

    <label class="field">
      <span>Email</span>
      <input
        type="email"
        v-model="email"
        @input="normalizeEmail"
        :class="{error: emailError}"
        placeholder="…@straightforward.email"
        autocomplete="email"
        required
      />
      <small v-if="emailError" class="err">Nur @straightforward.email erlaubt.</small>
    </label>

    <label class="field">
      <span>Passwort</span>
      <input :type="showPw ? 'text':'password'" v-model="password" autocomplete="new-password" required />
    </label>

    <label class="field">
      <span>Passwort bestätigen</span>
      <input :type="showPw ? 'text':'password'" v-model="confirmPassword" :class="{error: passwordError}" required />
      <small v-if="passwordError" class="err">Passwörter stimmen nicht überein.</small>
    </label>

    <label class="pw-toggle">
      <input type="checkbox" v-model="showPw" />
      <small>Passwort anzeigen</small>
    </label>

    <div class="actions">
      <button type="submit" :disabled="loading">{{ loading ? 'Sende…' : 'Register' }}</button>
      <button type="button" class="ghost" @click="$emit('switch-to-login')">Login</button>
    </div>

    <teleport to="body">
      <div v-if="showModal" class="modal" @click.self="showModal=false">
        <div class="modal-card">
          <h3>Registrierung erfolgreich!</h3>
          <p>Bitte prüfe deine E-Mails, um dein Konto zu bestätigen.</p>
          <button @click="showModal=false">OK</button>
        </div>
      </div>
    </teleport>
  </form>
</template>

<script setup>
import { ref } from 'vue';
import api from '@/utils/api';

const name = ref('');
const email = ref('');
const location = ref('');
const password = ref('');
const confirmPassword = ref('');

const emailError = ref(false);
const passwordError = ref(false);
const showPw = ref(false);
const loading = ref(false);
const showModal = ref(false);

function normalizeEmail(){ email.value = email.value.toLowerCase().trim(); }

async function submitRegister(){
  if (loading.value) return;

  emailError.value = !email.value.endsWith('@straightforward.email');
  passwordError.value = password.value !== confirmPassword.value;
  if (emailError.value || passwordError.value) return;

  loading.value = true;
  try {
    await api.post('/api/users/register', {
      name: name.value,
      email: email.value,
      password: password.value,
      location: location.value,
    });
    showModal.value = true;
  } catch (err) {
    console.error('Registrierungsfehler:', err?.response?.data?.msg || err.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.auth-form{ display:flex; flex-direction:column; gap:14px; padding: 20px}
h2{ font-size:20px; color:$base-text-dark; }
p{ color:$base-text-medium; margin-top:-6px; margin-bottom:2px; }

.field{ display:flex; flex-direction:column; gap:6px; }
.field span{ font-size:12px; color:$base-text-medium; }
input, select{
  width:100%; border:1px solid $base-border-color; border-radius:8px; background:$base-panel-bg;
  padding:12px 12px; font-size:14px; color:$base-text-dark;
  transition:border-color .15s, box-shadow .15s;
}
input:focus, select:focus{ outline:none; border-color:$base-primary; box-shadow:0 0 0 3px rgba($base-primary, .15); }
input.error{ border-color:$base-error; box-shadow:0 0 0 3px rgba($base-error, .15); }
small.err{ color:$base-error; }

.pw-toggle{ display:flex; align-items:center; gap:6px; color:$base-text-medium; user-select:none; }
.pw-toggle input{ width:auto; }

.actions{ display:flex; gap:10px; margin-top:4px; }
button{
  appearance:none; border:0; padding:10px 14px; border-radius:10px; cursor:pointer; font-weight:600; font-size:14px;
  background:$base-primary; color:white; box-shadow:0 2px 6px rgba($base-primary,.35);
}
button[disabled]{ opacity:.6; cursor:default; }
button.ghost{
  background:transparent; color:$base-primary; border:1px solid $base-primary; box-shadow:none;
}

.modal{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:grid; place-items:center; z-index:999; }
.modal-card{
  background:#fff; width:min(420px, 92vw); padding:18px; border-radius:12px; text-align:center;
  border:1px solid $base-border-color; box-shadow:0 10px 30px rgba(0,0,0,.14);
}
.modal-card h3{ margin-bottom:6px; color:$base-text-dark; }
.modal-card p{ color:$base-text-notsodark; margin-bottom:10px; }
.modal-card button{ width:100%; }
</style>
