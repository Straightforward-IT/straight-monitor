<template>
  <header class="header">
    <div class="left">
      <img :src="logoSrc" :class="['logo', { 'logo--intro': playLogoIntro }]" alt="logo" />
      <h1>Monitor</h1>
      
      <!-- Desktop Navigation -->
      <nav class="desktop-nav">
        <router-link
          to="/dashboard"
          :class="{ active: $route.name === 'Dashboard' }"
          >Dashboard</router-link
        >
        <router-link to="/bestand" :class="{ active: $route.name === 'Bestand' }"
          >Bestand</router-link
        >
        <router-link to="/verlauf" :class="{ active: $route.name === 'Verlauf' }"
          >Verlauf</router-link
        >
          <router-link
          to="/dokumente"
          :class="{ active: $route.name === 'Dokumente'}"
        >
          Dokumente
        </router-link>
        <router-link
          :to="newPagesEnabled ? '/personal' : '#'"
          :class="{ active: $route.name === 'Personal', disabled: !newPagesEnabled }"
          @click="handleNewPageClick($event, '/personal')"
        >
          Personal
          <span v-if="!newPagesEnabled" class="beta-tag">IN ARBEIT</span>
          <span v-else class="beta-tag">NEU</span>
        </router-link>
        <router-link
          :to="newPagesEnabled ? '/auftraege' : '#'"
          :class="{ active: $route.name === 'Auftraege', disabled: !newPagesEnabled }"
          @click="handleNewPageClick($event, '/auftraege')"
        >
          Aufträge
          <span v-if="!newPagesEnabled" class="beta-tag">IN ARBEIT</span>
          <span v-else class="beta-tag">NEU</span>
        </router-link>
      </nav>
  
    </div>
    <div class="right">
      <!-- Desktop Buttons -->
      <div class="desktop-buttons">
        <button v-if="$route.name === 'Bestand'" @click="ui.toggle('shortcuts')">
          Shortcuts
        </button>
        <button @click="ui.toggle('tools')">Tools</button>

        <!-- Support Button -->
        <custom-tooltip text="Support" position="bottom" :delay-in="150">
          <button 
            class="icon-btn"
            @click="showSupportModal = true"
          >
            <font-awesome-icon :icon="['fas', 'ticket-alt']" />
          </button>
        </custom-tooltip>

        <!-- Theme Toggle -->
        <custom-tooltip :text="theme.isDark ? 'Helles Theme' : 'Dunkles Theme'" position="bottom" :delay-in="150">
          <button
            class="icon-btn"
            @click="theme.toggle()"
          >
            <font-awesome-icon
              :icon="theme.isDark ? ['fas', 'sun'] : ['fas', 'moon']"
            />
          </button>
        </custom-tooltip>

        <custom-tooltip text="Die Segel streichen" position="bottom" :delay-in="150">
          <button @click="logout">Logout</button>
        </custom-tooltip>
      </div>
      
      <!-- Mobile Burger Button -->
      <button class="burger-btn" @click="showMobileMenu = !showMobileMenu">
        <font-awesome-icon :icon="['fas', showMobileMenu ? 'times' : 'bars']" />
      </button>
    </div>
  </header>

  <!-- Mobile Navigation Menu -->
  <div v-if="showMobileMenu" class="mobile-menu-overlay" @click="showMobileMenu = false">
    <nav class="mobile-menu" @click.stop>
      <div class="mobile-menu-header">
        <h3>Navigation</h3>
        <button class="close-mobile-menu" @click="showMobileMenu = false">
          <font-awesome-icon :icon="['fas', 'times']" />
        </button>
      </div>
      
      <div class="mobile-menu-items">
        <router-link
          to="/dashboard"
          :class="{ active: $route.name === 'Dashboard' }"
          @click="showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'chart-line']" />
          Dashboard
        </router-link>
        
        <router-link 
          to="/bestand" 
          :class="{ active: $route.name === 'Bestand' }"
          @click="showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'list']" />
          Bestand
        </router-link>
        
        <router-link 
          to="/verlauf" 
          :class="{ active: $route.name === 'Verlauf' }"
          @click="showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'history']" />
          Verlauf
        </router-link>
        <router-link
          to="/dokumente"
          :class="{ active: $route.name === 'Dokumente' }"
          @click="showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'file-alt']" />
          Dokumente
        </router-link>
        
        <router-link
          :to="newPagesEnabled ? '/personal' : '#'"
          :class="{ active: $route.name === 'Personal', disabled: !newPagesEnabled }"
          @click="handleNewPageClick($event, '/personal'); showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'users']" />
          Personal
          <span v-if="!newPagesEnabled" class="beta-tag">IN ARBEIT</span>
          <span v-else class="beta-tag">NEU</span>
        </router-link>
        <router-link
          :to="newPagesEnabled ? '/auftraege' : '#'"
          :class="{ active: $route.name === 'Auftraege', disabled: !newPagesEnabled }"
          @click="handleNewPageClick($event, '/auftraege'); showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'calendar-alt']" />
          Aufträge
          <span v-if="!newPagesEnabled" class="beta-tag">IN ARBEIT</span>
          <span v-else class="beta-tag">NEU</span>
        </router-link>
        
        <div class="mobile-menu-divider"></div>
        
        <div class="mobile-menu-divider"></div>
        
        <!-- Mobile Tools & Support -->
        <button class="mobile-menu-btn" @click="ui.toggle('tools'); showMobileMenu = false">
          <font-awesome-icon :icon="['fas', 'tools']" />
          Tools
        </button>
        
        <button class="mobile-menu-btn" @click="showSupportModal = true; showMobileMenu = false">
          <font-awesome-icon :icon="['fas', 'ticket-alt']" />
          Support
        </button>
        
        <button class="mobile-menu-btn" @click="theme.toggle()">
          <font-awesome-icon :icon="theme.isDark ? ['fas', 'sun'] : ['fas', 'moon']" />
          {{ theme.isDark ? 'Helles Theme' : 'Dunkles Theme' }}
        </button>
        
        <custom-tooltip text="Die Segel streichen" position="left" :delay-in="150">
          <button class="mobile-menu-btn logout" @click="logout">
            <font-awesome-icon :icon="['fas', 'sign-out-alt']" />
            Logout
          </button>
        </custom-tooltip>
      </div>
    </nav>
  </div>

  <!-- Support Modal -->
  <div v-if="showSupportModal" class="modal-overlay" @click="closeSupportModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>
          <font-awesome-icon :icon="['fas', 'ticket-alt']" />
          Support anfragen
        </h2>
        <button class="close-btn" @click="closeSupportModal">
          <font-awesome-icon :icon="['fas', 'times']" />
        </button>
      </div>

      <form @submit.prevent="submitSupportRequest" class="support-form">
        <div class="form-group">
          <label for="support-type">Typ der Anfrage</label>
          <select id="support-type" v-model="supportForm.type" required>
            <option value="">Bitte wählen...</option>
            <option value="bug">🐛 Bug/Fehler melden</option>
            <option value="feature">💡 Feature-Request</option>
            <option value="question">❓ Frage/Hilfe</option>
            <option value="other">📋 Sonstiges</option>
          </select>
        </div>

        <div class="form-group">
          <label for="support-subject">Betreff</label>
          <input 
            id="support-subject" 
            v-model="supportForm.subject" 
            type="text" 
            placeholder="..."
            required
          />
        </div>

        <div class="form-group">
          <label for="support-description">Detaillierte Beschreibung</label>
          <textarea 
            id="support-description" 
            v-model="supportForm.description" 
            rows="5"
            placeholder="..."
            required
          ></textarea>
        </div>

        <div class="form-group">
          <label for="support-files">Dateien anhängen (optional)</label>
          
          <!-- Hidden File Input -->
          <input 
            id="support-files" 
            ref="fileInput"
            type="file" 
            multiple
            @change="handleFileUpload"
            accept="image/*,.pdf,.doc,.docx,.txt,.log"
            style="display: none;"
          />
          
          <!-- Custom File Upload Button -->
          <button 
            type="button" 
            class="custom-file-btn"
            @click="$refs.fileInput.click()"
          >
            <font-awesome-icon :icon="['fas', 'paperclip']" />
            Dateien auswählen
          </button>
          
          <small class="file-info">
            Screenshots, Logs oder andere relevante Dateien (max. 10MB pro Datei)
          </small>
          
          <div v-if="supportForm.files.length" class="attached-files">
            <h4>Angehängte Dateien:</h4>
            <div v-for="(file, index) in supportForm.files" :key="index" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <button type="button" @click="removeFile(index)" class="remove-file">
                <font-awesome-icon :icon="['fas', 'times']" />
              </button>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" @click="closeSupportModal" class="btn-cancel">
            Abbrechen
          </button>
          <button type="submit" class="btn-submit" :disabled="isSubmitting">
            <font-awesome-icon v-if="isSubmitting" :icon="['fas', 'spinner']" spin />
            {{ isSubmitting ? 'Wird gesendet...' : 'Senden' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount } from "vue";
import { useUi } from "@/stores/ui";
import { useTheme } from "@/stores/theme";
import { useAuth } from "@/stores/auth";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import CustomTooltip from './CustomTooltip.vue';
import api from '@/utils/api';

// Logos vorher importieren
import darkLogo from "@/assets/SF_000.svg";
import lightLogo from "@/assets/SF_002.png";

const ui = useUi();
const theme = useTheme();
const auth = useAuth();

const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));

// Page-load logo intro animation (runs once on mount)
const playLogoIntro = ref(false);
onMounted(async () => {
  // slight delay to ensure layout is ready before animating
  requestAnimationFrame(() => {
    playLogoIntro.value = true;
    // remove class after animation to avoid affecting future transforms
    setTimeout(() => (playLogoIntro.value = false), 2400);
  });
  
  // Load user data if not already loaded
  if (!auth.user && auth.token) {
    try {
      await auth.fetchMe();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }
});

// Mobile Menu State
const showMobileMenu = ref(false);

// Support Modal State
const showSupportModal = ref(false);
const isSubmitting = ref(false);

const supportForm = reactive({
  type: '',
  subject: '',
  description: '',
  files: []
});

// Feature flag für neue Pages (Now based on Role)
const newPagesEnabled = computed(() => {
  return auth.user && auth.user.role === 'ADMIN';
});

// Handler für deaktivierte neue Pages
const handleNewPageClick = (event, path) => {
  if (!newPagesEnabled.value) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
};

// Support Modal Functions
const closeSupportModal = () => {
  showSupportModal.value = false;
  // Reset form
  supportForm.type = '';
  supportForm.subject = '';
  supportForm.description = '';
  supportForm.files = [];
};

const handleFileUpload = (event) => {
  const files = Array.from(event.target.files);
  const maxFileSize = 10 * 1024 * 1024; // 10MB
  
  for (const file of files) {
    if (file.size > maxFileSize) {
      alert(`Datei "${file.name}" ist zu groß. Maximum: 10MB`);
      continue;
    }
    supportForm.files.push(file);
  }
  
  // Clear input for re-upload
  event.target.value = '';
};

const removeFile = (index) => {
  supportForm.files.splice(index, 1);
};

const submitSupportRequest = async () => {
  if (isSubmitting.value) return;
  
  isSubmitting.value = true;
  
  try {
    // Ensure user data is loaded
    if (!auth.user) {
      await auth.fetchMe();
    }
    
    const formData = new FormData();
    formData.append('type', supportForm.type);
    formData.append('subject', supportForm.subject);
    formData.append('description', supportForm.description);
    formData.append('userEmail', auth.user?.email || 'unbekannt');
    
    // Attach files
    supportForm.files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    await api.post('/api/support/request', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    alert('Support-Request wurde erfolgreich gesendet!');
    closeSupportModal();
    
  } catch (error) {
    console.error('Support request error:', error);
    alert('Fehler beim Senden des Support-Requests. Bitte versuchen Sie es später erneut.');
  } finally {
    isSubmitting.value = false;
  }
};

function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

// ESC key handler
const handleEscapeKey = (event) => {
  if (event.key === 'Escape' && showSupportModal.value) {
    closeSupportModal();
  }
};

// Setup lifecycle hooks
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscapeKey);
});

</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--panel);
  min-height: 56px;
}
.left,
.right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

/* Desktop Navigation */
.desktop-nav {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* Burger Button - versteckt auf Desktop */
.burger-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 28px;
}
.burger-btn:hover {
  background: var(--hover);
}

/* Mobile Menu Overlay */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: none;
}

.mobile-menu {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(320px, 85vw);
  background: var(--panel);
  box-shadow: -8px 0 20px rgba(0, 0, 0, 0.2);
  overflow-y: auto;
  z-index: 101;
}

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.mobile-menu-header h3 {
  margin: 0;
  color: var(--text);
  font-size: 18px;
}

.close-mobile-menu {
  background: none;
  border: none;
  color: var(--text);
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 28px;
}

.close-mobile-menu svg {
  width: 28px;
  height: 28px;
}

.close-mobile-menu:hover {
  background: var(--hover);
}

.mobile-menu-items {
  padding: 8px 0;
}

.mobile-menu-items a,
.mobile-menu-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--text);
  text-decoration: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 15px;
}

.mobile-menu-items a:hover,
.mobile-menu-btn:hover {
  background: var(--hover);
}

.mobile-menu-items a.active {
  background: var(--tile-bg);
  color: var(--accent);
  font-weight: 600;
}

.mobile-menu-items a.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mobile-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 16px;
}

.mobile-menu-btn.logout {
  color: #dc3545;
  font-weight: 600;
  margin-top: 8px;
}

/* Desktop vs Mobile Button Groups */
.desktop-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.mobile-buttons {
  display: none;
  gap: 4px;
  align-items: center;
}

/* Mobile Header Optimierungen */
@media (max-width: 768px) {
  .header {
    padding: 6px 12px;
    min-height: 48px;
    flex-wrap: nowrap; /* Verhindere Umbruch */
  }
  
  .left {
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow: hidden; /* Verhindere Overflow */
  }
  
  .right {
    gap: 4px;
    flex-shrink: 0; /* Verhindere Schrumpfung */
  }
  
  /* Button-Gruppen umschalten */
  .desktop-buttons {
    display: none; /* Verstecke Desktop Buttons */
  }
  
  .mobile-buttons {
    display: flex; /* Zeige Mobile Buttons */
  }
  
  /* Verstecke Desktop Navigation */
  .desktop-nav {
    display: none;
  }
  
  /* Zeige Burger Button */
  .burger-btn {
    display: block;
    padding: 12px;
    font-size: 32px;
  }
  
  .burger-btn svg {
    width: 32px;
    height: 32px;
  }
  
  /* Zeige Mobile Menu */
  .mobile-menu-overlay {
    display: block;
  }
  
  /* H1 Monitor kleiner */
  .left h1 {
    font-size: 20px;
    margin: 0;
    font-weight: 600;
  }
  
  /* Logo kleiner */
  .logo {
    width: 32px;
  }
  
  /* Buttons kompakter */
  .right button {
    padding: 4px 8px;
    font-size: 13px;
  }
  
  .icon-btn {
    padding: 6px;
  }
}
.logo {
    width: 36px;
  transition: opacity .25s ease;
  transform-origin: center center;
  will-change: transform;
}

/* Logo intro animation: starts vertically mirrored on the right, flies in, rotates smoothly into place */
.logo--intro {
  animation: logoIntro 2200ms cubic-bezier(0.16, 1, 0.3, 1) both; /* gentle springy ease-out */
  z-index: 100;
  position: relative;
}

@keyframes logoIntro {
  0% {
    /* Start: weit rechts außerhalb des Bildschirms, 180° gedreht */
    transform: translateX(80vw) rotate(180deg);
    opacity: 0;
  }
  70% {
    /* fast am Ziel - starkes ease-out beginnt hier, noch 180° gedreht */
    transform: translateX(10px) rotate(180deg);
    opacity: 1;
  }
  100% {
    /* Ende: normale Position im Header, zurück auf 0° gedreht */
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .logo--intro {
    animation: none !important;
  }
}
a {
  position: relative;
  color: var(--text);
  text-decoration: none;
  padding: 6px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
a.active {
  background: var(--hover);
  font-weight: 600;
}
a.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.beta-tag {
  background: #ff9500;
  color: white;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
button {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
button:hover {
  background: var(--hover);
}
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn :deep(svg) {
  width: 16px;
  height: 16px;
}



/* Support Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  font-size: 16px;
}

.close-btn:hover {
  color: var(--text);
  background: var(--hover);
}

.support-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.file-info {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

/* Custom File Upload Button */
.custom-file-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s ease;
  margin-bottom: 6px;
}

.custom-file-btn:hover {
  background: var(--hover);
  border-color: #007acc;
}

.custom-file-btn:active {
  transform: scale(0.98);
}

.custom-file-btn svg {
  font-size: 16px;
  opacity: 0.8;
}

.attached-files {
  margin-top: 12px;
  padding: 12px;
  background: var(--panel);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.attached-files h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
}

.file-item:last-child {
  border-bottom: none;
}

.file-name {
  font-size: 13px;
  color: var(--text);
  flex: 1;
}

.remove-file {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  font-size: 12px;
}

.remove-file:hover {
  background: rgba(220, 53, 69, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.btn-cancel {
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: var(--hover);
}

.btn-submit {
  padding: 10px 16px;
  border: 1px solid #ff9500;
  background: #ff9500;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-submit:hover:not(:disabled) {
  background: #e6850e;
  border-color: #cc7700;
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .modal-content {
    max-height: 95vh;
  }
  
  .modal-header,
  .support-form {
    padding: 16px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>
