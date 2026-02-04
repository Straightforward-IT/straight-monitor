<template>
  <footer class="app-footer">
    <div class="footer-content">
      <!-- Linke Seite: Logo & Beschreibung -->
      <div class="footer-section footer-brand">
        <div class="brand">
          <img :src="logoSrc" alt="Straight Monitor Logo" class="footer-logo" />
          <span class="brand-name">Straight Monitor</span>
        </div>
        <p class="footer-description">
          Moderne Personalverwaltung und Bestandsüberwachung für H. & P. Straightforward GmbH.
        </p>
        <p class="footer-copyright">
          © 2024 - {{ currentYear }} Straightforward Hamburg. Alle Rechte vorbehalten.
        </p>
      </div>

      <!-- Mitte: Quick Links -->
      <div class="footer-section">
        <h4>Navigation</h4>
        <ul class="footer-links">
          <li><router-link to="/dashboard">Dashboard</router-link></li>
          <li><router-link to="/bestand">Bestand</router-link></li>
          <li><router-link to="/verlauf">Verlauf</router-link></li>
          <li><router-link to="/personal">Personal</router-link></li>
          <li><router-link to="/dokumente">Dokumente</router-link></li>
        </ul>
      </div>

      <!-- Rechts: Rechtliches -->
      <div class="footer-section">
        <h4>Rechtliches</h4>
        <ul class="footer-links">
          <li>
            <a href="#" @click.prevent="openModal('privacy')">Datenschutz</a>
          </li>
          <li>
            <a href="#" @click.prevent="openModal('imprint')">Impressum</a>
          </li>
        </ul>
      </div>

      <!-- Ganz rechts: System Info -->
      <div class="footer-section footer-meta">
        <h4>System</h4>
        <div class="meta-info">
          <div class="meta-item">
            <font-awesome-icon :icon="['fas', theme.isDark ? 'moon' : 'sun']" />
            <span>{{ theme.isDark ? 'Dark Mode' : 'Light Mode' }}</span>
          </div>
          <div v-if="auth.user" class="meta-item">
            <font-awesome-icon :icon="['fas', 'user']" />
            <span>{{ auth.user.name }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="footer-bottom">
      <p class="made-with-love">
        Entwickelt mit <font-awesome-icon :icon="['fas', 'heart']" class="heart" /> von Cedric Bleck
      </p>
    </div>

    <!-- Legal Modal -->
    <LegalModal
      :show="showLegalModal"
      :type="legalModalType"
      @close="showLegalModal = false"
    />
  </footer>
</template>

<script>
import { computed, ref } from 'vue';
import { useTheme } from '@/stores/theme';
import { useAuth } from '@/stores/auth';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { 
  faHeart, 
  faUser, 
  faSun, 
  faMoon 
} from '@fortawesome/free-solid-svg-icons';
import LegalModal from './LegalModal.vue';

// Logos importieren
import darkLogo from '@/assets/SF_000.svg';
import lightLogo from '@/assets/SF_002.png';

// Icons registrieren
library.add(faHeart, faUser, faSun, faMoon);

export default {
  name: 'AppFooter',
  components: { FontAwesomeIcon, LegalModal },
  
  setup() {
    const theme = useTheme();
    const auth = useAuth();

    const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));
    const currentYear = computed(() => new Date().getFullYear());

    // Modal State
    const showLegalModal = ref(false);
    const legalModalType = ref('privacy');

    const openModal = (type) => {
      legalModalType.value = type;
      showLegalModal.value = true;
    };

    return {
      theme,
      auth,
      logoSrc,
      currentYear,
      showLegalModal,
      legalModalType,
      openModal
    };
  }
};
</script>

<style scoped lang="scss">
.app-footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  margin-top: auto;
  padding: 48px 24px 24px;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 48px;
  margin-bottom: 32px;
}

@media (max-width: 1024px) {
  .footer-content {
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
}

@media (max-width: 640px) {
  .footer-content {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  
  .app-footer {
    padding: 32px 16px 16px;
  }
}

/* Footer Sections */
.footer-section h4 {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Brand Section */
.footer-brand {
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .footer-logo {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  
  .brand-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }
  
  .footer-description {
    font-size: 14px;
    color: var(--muted);
    line-height: 1.6;
    margin-bottom: 16px;
    max-width: 320px;
  }
  
  .footer-copyright {
    font-size: 12px;
    color: var(--muted);
  }
}

/* Links */
.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  
  li {
    margin-bottom: 12px;
  }
  
  a {
    color: var(--muted);
    text-decoration: none;
    font-size: 14px;
    transition: color 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    
    &:hover {
      color: var(--primary);
    }
    
    svg {
      font-size: 12px;
    }
  }
}

/* Meta Info */
.footer-meta {
  .meta-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    
    svg {
      font-size: 12px;
      color: var(--muted);
    }
  }
}

/* Bottom Bar */
.footer-bottom {
  max-width: 1400px;
  margin: 0 auto;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
  align-items: center;
  
  .made-with-love {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    
    .heart {
      color: #e74c3c;
      animation: heartbeat 1.5s ease-in-out infinite;
    }
  }
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@media (max-width: 640px) {
  .footer-bottom {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}
</style>
