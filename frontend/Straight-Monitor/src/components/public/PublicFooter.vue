<template>
  <footer class="public-footer">
    <div class="footer-brand">
      <img :src="logoSrc" alt="Straight Monitor" class="footer-logo" />
      <span class="brand-name">Straight Monitor</span>
    </div>

    <p class="footer-description">
      Moderne Personalverwaltung für H. & P. Straightforward GmbH.
    </p>

    <div class="footer-links">
      <a href="#" @click.prevent="openModal('privacy')">Datenschutz</a>
      <span class="divider">·</span>
      <a href="#" @click.prevent="openModal('imprint')">Impressum</a>
    </div>

    <div class="footer-bottom">
      <p class="made-with-love">
        Entwickelt mit <font-awesome-icon :icon="['fas', 'heart']" class="heart" /> von Cedric Bleck
      </p>
      <p class="copyright">© 2024 – {{ currentYear }} Straightforward Hamburg</p>
    </div>

    <LegalModal
      :show="showLegalModal"
      :type="legalModalType"
      @close="showLegalModal = false"
    />
  </footer>
</template>

<script setup>
import { ref, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useTheme } from '@/stores/theme';
import LegalModal from '@/components/LegalModal.vue';
import darkLogo from '@/assets/SF_000.svg';
import lightLogo from '@/assets/SF_002.png';

const theme = useTheme();
const logoSrc = computed(() => theme.isDark ? darkLogo : lightLogo);
const currentYear = computed(() => new Date().getFullYear());

const showLegalModal = ref(false);
const legalModalType = ref('privacy');

function openModal(type) {
  legalModalType.value = type;
  showLegalModal.value = true;
}
</script>

<style scoped>
.public-footer {
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 1.75rem 1rem calc(1.5rem + env(safe-area-inset-bottom));
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.brand-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.footer-description {
  font-size: 0.75rem;
  color: var(--muted);
  line-height: 1.5;
  margin: 0;
  max-width: 280px;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-links a {
  font-size: 0.8rem;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s;
}

.footer-links a:hover {
  color: var(--primary);
}

.divider {
  color: var(--border);
  font-size: 0.8rem;
}

.footer-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
  width: 100%;
}

.made-with-love {
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.heart {
  color: #e74c3c;
  animation: heartbeat 1.5s ease-in-out infinite;
}

.copyright {
  font-size: 0.7rem;
  color: var(--muted);
  opacity: 0.7;
  margin: 0;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
