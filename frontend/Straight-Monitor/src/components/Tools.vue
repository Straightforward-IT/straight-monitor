<template>
  <div class="tools">
    <div class="tools-header">
      <h4>Tools</h4>
      <button class="close-btn" @click="ui.close()">
        <font-awesome-icon :icon="['fas', 'times']" />
      </button>
    </div>

    <div class="actions">
      <!-- Admin/Bestand -->
      <button class="s-btn" @click="go('/teamleiter-auswertung')">
        <img :src="logoSrc" alt="" />
        <span>Teamleiter&nbsp;Auswertung</span>
      </button>

      <button class="s-btn" @click="go('/lohnabrechnungen')">
        <img :src="logoSrc" alt="" />
        <span>Lohnabrechnungen</span>
      </button>

      <button class="s-btn" @click="go('/daten-import')">
        <img :src="logoSrc" alt="" />
        <span>Daten Import</span>
      </button>

      <div class="sep"></div>

      <!-- Flip integriert -->
      <button class="s-btn" @click="go('/flip/benutzer-erstellen')">
        <img :src="logoSrc" alt="" />
        <span>Flip: Benutzer erstellen</span>
      </button>

      <button class="s-btn" @click="go('/flip/austritte')">
        <img :src="logoSrc" alt="" />
        <span>Flip: Austritte</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '@/stores/theme';
import { useUi } from '@/stores/ui';
import { useAuth } from '@/stores/auth';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const router = useRouter();
const go = (path) => router.push(path);

const theme = useTheme();
const ui = useUi();
const auth = useAuth();

const newPagesEnabled = computed(() => auth.user && auth.user.role === 'ADMIN');

const logoSrc = computed(() =>
  theme.isDark
    ? new URL('@/assets/SF_000.svg', import.meta.url).href  // weiß (Dark Mode)
    : new URL('@/assets/SF_002.png', import.meta.url).href  // schwarz (Light Mode)
);
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Gleiches Layout wie Shortcuts */
.tools{ display:flex; flex-direction:column; gap:8px; padding:8px 6px; color: var(--text); }

.tools-header{ 
  display:flex; justify-content:space-between; align-items:center; 
  margin:0 0 6px; 
}
h4{ font-size:15px; font-weight:700; opacity:.9; margin:0; }

.close-btn{
  display:none; /* Desktop versteckt */
  background:none; border:none; color: var(--text);
  padding:4px; border-radius:4px; cursor:pointer;
  opacity:.6; transition: opacity .2s, background .2s;
}
.close-btn:hover{ opacity:1; background: var(--hover); }

@media (max-width: 768px){
  .close-btn{ display:block; } /* Nur auf Mobile sichtbar */
}

.actions{ display:flex; flex-direction:column; gap:6px; }
.s-btn{
  display:flex; align-items:center; gap:8px;
  width:100%; padding:6px 8px;
  background: var(--tile-bg);
  border:1px solid var(--border);
  border-radius:8px;
  color: var(--text);
  cursor:pointer; font-size:12.5px; line-height:1.2;
  transition: background .2s, transform .08s, border-color .2s;
}
.s-btn:hover{ background: var(--hover); transform: translateY(-1px); }
.s-btn:disabled{ opacity:.6; cursor:not-allowed; transform:none; }
.s-btn img{ width:16px; height:16px; opacity:.6; }
.s-btn .icon{ width:16px; height:16px; opacity:.6; }

.sep{ height:4px; }
</style>
