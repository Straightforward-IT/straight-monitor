<template>
  <div class="auth-shell">
    <section class="auth-card">
      <header class="auth-head">
        <div class="brand">
          <img src="@/assets/SF_002.png" alt="Logo" />
          <span>Straightforward</span>
        </div>
        <nav class="segmented">
          <button :class="{active: currentForm==='login'}" @click="currentForm='login'">Login</button>
          <button :class="{active: currentForm==='register'}" @click="currentForm='register'">Registrieren</button>
        </nav>
      </header>

      <div class="auth-body">
        <LoginForm v-if="currentForm==='login'" @switch-to-register="currentForm='register'" />
        <RegisterForm v-else @switch-to-login="currentForm='login'" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import LoginForm from '@/components/LoginForm.vue';
import RegisterForm from '@/components/RegisterForm.vue';

const currentForm = ref('login');
</script>

<style scoped lang="scss">
// nutzt automatisch deine Variablen aus global.scss (per Vite additionalData)
.auth-shell{
  min-height:100dvh; display:grid; place-items:center; background:$base-light-gray;
  padding:24px;
}

.auth-card{
  width:min(520px, 100%); background:#fff; border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.10); overflow:hidden;
  border:1px solid $base-border-color;
}

.auth-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px; background:$base-panel-bg; border-bottom:1px solid $base-border-color;
}
.brand{ display:flex; align-items:center; gap:10px; font-weight:700; color:$base-text-dark; }
.brand img{ 
  width:28px; 
  height:auto; 
  filter: brightness(1.2) opacity(0.7);
}

.segmented{
  display:flex; gap:6px; background:$base-input-bg; padding:4px; border-radius:999px;
  border:1px solid $base-border-color;
}
.segmented button{
  appearance:none; border:0; background:transparent; padding:6px 12px; border-radius:999px; cursor:pointer;
  font-weight:600; color:$base-text-notsodark;
}
.segmented button.active{
  background:$base-highlight-accent; color:$base-text-dark; border:1px solid mix($base-primary, $base-border-color, 40%);
}

.auth-body{ padding:18px 18px 22px; }
</style>
