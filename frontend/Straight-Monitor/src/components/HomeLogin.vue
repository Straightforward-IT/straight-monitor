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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import LoginForm from '@/components/LoginForm.vue';
import RegisterForm from '@/components/RegisterForm.vue';
import { jwtDecode } from 'jwt-decode';

const currentForm = ref('login');
const router = useRouter();

// Check if user is already logged in and redirect
onMounted(() => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const decoded = jwtDecode(token);
      const isExpired = decoded.exp < (Date.now() / 1000);
      
      if (!isExpired) {
        // User is already logged in, redirect to last visited page
        const lastPath = localStorage.getItem('lastVisitedPath');
        if (lastPath && lastPath !== '/' && lastPath !== '/dashboard') {
          router.push(lastPath);
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      // Invalid token, stay on login page
      localStorage.removeItem('token');
    }
  }
});
</script>

<style scoped lang="scss">
// nutzt automatisch deine Variablen aus global.scss (per Vite additionalData)
.auth-shell{
  min-height:100dvh; display:grid; place-items:center; background:var(--bg);
  padding:24px;
  
  // Mobile: Less padding but keep centered
  @media (max-width: 768px) {
    padding: 16px;
    // Keep centered but with safe area consideration
    padding-top: max(16px, env(safe-area-inset-top, 16px));
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    min-height: 100vh; // Fallback for older browsers
    min-height: 100svh; // Small viewport height for mobile
    // Ensure it stays centered even on small screens
    place-items: center;
  }
}

.auth-card{
  width:min(520px, 100%); background:#fff; border-radius:12px;
  box-shadow:0 10px 30px rgba(0,0,0,.10); overflow:hidden;
  border:1px solid $base-border-color;
  
  // Mobile: Full width with max constraints
  @media (max-width: 768px) {
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
  }
  
  @media (max-width: 480px) {
    max-width: none;
    margin: 0;
  }
}

.auth-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 16px; background:$base-panel-bg; border-bottom:1px solid $base-border-color;
  
  // Mobile: Stack vertically for better space usage
  @media (max-width: 480px) {
    flex-direction: column;
    gap: 12px;
    padding: 16px 12px;
  }
}

.brand{ 
  display:flex; align-items:center; gap:10px; font-weight:700; color:$base-text-dark;
  
  // Mobile: Smaller brand on mobile
  @media (max-width: 480px) {
    gap: 8px;
    font-size: 14px;
  }
}

.brand img{ 
  width:28px; 
  height:auto; 
  filter: brightness(1.2) opacity(0.7);
  
  // Mobile: Smaller logo
  @media (max-width: 480px) {
    width: 24px;
  }
}

.segmented{
  display:flex; gap:6px; background:$base-input-bg; padding:4px; border-radius:999px;
  border:1px solid $base-border-color;
  
  // Mobile: Full width buttons for easier touch
  @media (max-width: 480px) {
    width: 100%;
    max-width: 280px;
  }
}

.segmented button{
  appearance:none; border:0; background:transparent; padding:6px 12px; border-radius:999px; cursor:pointer;
  font-weight:600; color:$base-text-notsodark; font-size: 14px;
  
  // Mobile: Better touch targets
  @media (max-width: 480px) {
    flex: 1;
    padding: 8px 16px;
    font-size: 13px;
  }
}

.segmented button.active{
  background:$base-highlight-accent; color:$base-text-dark; border:1px solid mix($base-primary, $base-border-color, 40%);
}

.auth-body{ padding:18px 18px 22px; }
</style>
