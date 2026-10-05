<template>
  <header class="header">
    <div class="header-top">
      <div class="left">
        <img :src="logoSrc" :class="['logo', { 'logo--intro': playLogoIntro }]" alt="logo" width="36" height="36" />
        <h1>Monitor</h1>
        <span v-if="currentViewTitle" class="header-view-title" :title="currentViewTitle">{{ currentViewTitle }}</span>
      </div>
      <nav class="desktop-nav">
        <template v-for="item in navigationItems" :key="item.id">
          <div v-if="!item.mobileOnly && item.desktopChildren.length" :class="['nav-group', item.groupClass]">
            <router-link
              :to="item.disabled ? '#' : item.to"
              :class="{ active: item.active, disabled: item.disabled, 'dev-role--vertrieb': item.devRole }"
              @click="handleNavigationClick($event, item)"
            >
              {{ item.label }}
              <span v-if="item.beta" class="beta-tag beta-tag--payroll">IN ARBEIT</span>
            </router-link>
            <div class="nav-submenu" :aria-label="`${item.label} Untermenue`">
              <router-link
                v-for="child in item.desktopChildren"
                :key="child.id"
                :to="child.to"
                class="nav-submenu__link"
                @click="handleNavigationClick($event, child)"
              >
                {{ child.label }}
              </router-link>
            </div>
          </div>
          <router-link
            v-else-if="!item.mobileOnly"
            :to="item.disabled ? '#' : item.to"
            :class="{ active: item.active, disabled: item.disabled, 'dev-role--vertrieb': item.devRole }"
            @click="handleNavigationClick($event, item)"
          >
            {{ item.label }}
          </router-link>
        </template>
      </nav>
      <div class="right">
      <div class="desktop-user-area">
        <span v-if="auth.user" class="header-user-name">Benutzer: {{ auth.user.name || auth.user.email }}</span>
        <!-- Desktop Buttons -->
        <div class="desktop-buttons">
        <custom-tooltip v-if="$route.name === 'Dispo'" text="Kommentar-Feed [C]" position="bottom" :delay-in="150">
          <button class="icon-btn kf-btn" @click="ui.toggle('kommentare')">
            <font-awesome-icon :icon="['fas', 'comments']" />
            <CommentBubbleBadge :count="comments.unreadCount" class="kf-badge" />
          </button>
        </custom-tooltip>
        <custom-tooltip text="Einstellungen" position="bottom" :delay-in="150">
          <button
            class="icon-btn"
            :class="{ active: $route.name === 'UserSettings' }"
            aria-label="Einstellungen"
            @click="$router.push('/einstellungen')"
          >
            <font-awesome-icon :icon="['fas', 'gear']" />
          </button>
        </custom-tooltip>
        <!-- Theme Toggle -->
        <custom-tooltip :text="theme.isDark ? 'Helles Theme' : 'Dunkles Theme'" position="bottom" :delay-in="150">
          <button
            class="icon-btn"
            @click="toggleTheme"
          >
            <font-awesome-icon
              :icon="theme.isDark ? ['fas', 'sun'] : ['fas', 'moon']"
            />
          </button>
        </custom-tooltip>

        <!-- Support Button -->
        <custom-tooltip text="Nachricht an Cedi" position="bottom" :delay-in="150">
          <button 
            class="icon-btn"
            @click="showSupportModal = true"
          >
            Ticket
          </button>
        </custom-tooltip>

        <button @click="ui.toggle('tools')">Tools</button>

        <custom-tooltip text="Die Segel streichen" position="bottom" :delay-in="150">
          <button @click="logout">Logout</button>
        </custom-tooltip>
        </div>
      </div>
      
      <!-- Mobile Burger Button -->
      <button class="burger-btn" :aria-label="showMobileMenu ? 'Menü schließen' : 'Menü öffnen'" :aria-expanded="showMobileMenu" @click="showMobileMenu = !showMobileMenu">
        <font-awesome-icon :icon="['fas', showMobileMenu ? 'times' : 'bars']" />
      </button>
    </div>
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
        <template v-for="item in navigationItems" :key="`mobile-${item.id}`">
          <div v-if="!item.mobileOnly && item.children.length" class="mobile-menu-group">
            <button
              class="mobile-menu-btn mobile-menu-toggle"
              :class="{ active: item.active, 'mobile-menu-toggle--open': isMobileNavGroupOpen(item.id), disabled: item.disabled }"
              @click="toggleMobileNavGroup(item)"
            >
              <span class="mobile-menu-toggle__label">
                <font-awesome-icon :icon="item.icon" />
                {{ item.mobileLabel }}
              </span>
              <span class="mobile-menu-toggle__meta">
                <span v-if="item.beta" class="beta-tag beta-tag--payroll">IN ARBEIT</span>
                <font-awesome-icon :icon="['fas', isMobileNavGroupOpen(item.id) ? 'chevron-up' : 'chevron-down']" />
              </span>
            </button>
            <div v-if="isMobileNavGroupOpen(item.id)" class="mobile-submenu">
              <router-link
                v-for="child in item.children"
                :key="`mobile-${child.id}`"
                :to="child.to"
                class="mobile-submenu__link"
                :class="{ active: child.active }"
                @click="handleNavigationClick($event, child, true)"
              >
                <font-awesome-icon :icon="child.icon" />
                {{ child.mobileLabel || child.label }}
              </router-link>
            </div>
          </div>
          <router-link
            v-else-if="!item.mobileOnly"
            :to="item.disabled ? '#' : item.to"
            class="mobile-menu-btn"
            :class="{ active: item.active, disabled: item.disabled }"
            @click="handleNavigationClick($event, item, true)"
          >
            <font-awesome-icon :icon="item.icon" />
            {{ item.label }}
            <span v-if="item.beta" class="beta-tag beta-tag--payroll">IN ARBEIT</span>
          </router-link>
        </template>

        
        <div class="mobile-menu-divider"></div>
        
        <!-- Mobile Tools & Support -->
        <button
          v-if="$route.name === 'Bestand'"
          class="mobile-menu-btn"
          @click="ui.toggle('shortcuts'); showMobileMenu = false"
        >
          <font-awesome-icon :icon="['fas', 'bolt']" />
          Pakete
        </button>

        <button class="mobile-menu-btn" @click="ui.toggle('tools'); showMobileMenu = false">
          <font-awesome-icon :icon="['fas', 'tools']" />
          Tools
        </button>

        <router-link
          v-if="settingsNavigationItem"
          :to="settingsNavigationItem.to"
          class="mobile-menu-btn"
          :class="{ active: settingsNavigationItem.active }"
          @click="closeMobileMenu"
        >
          <font-awesome-icon :icon="settingsNavigationItem.icon" />
          {{ settingsNavigationItem.mobileLabel }}
        </router-link>
        
        <button class="mobile-menu-btn" @click="showSupportModal = true; showMobileMenu = false">
          <font-awesome-icon :icon="['fas', 'ticket-alt']" />
          Nachricht an Cedi
        </button>
        
        <button class="mobile-menu-btn" @click="toggleTheme">
          <font-awesome-icon :icon="theme.isDark ? ['fas', 'sun'] : ['fas', 'moon']" />
          {{ theme.isDark ? 'Helles Theme' : 'Dunkles Theme' }}
        </button>
        
        <custom-tooltip text="Die Segel streichen" position="left" :delay-in="150">
          <button class="mobile-menu-btn logout" @click="logout">
            Logout
          </button>
        </custom-tooltip>
      </div>
    </nav>
  </div>

  <!-- Support Modal -->
  <ModalFrame
    v-model="showSupportModal"
    class="support-modal"
    title="Support anfragen"
    size="md"
    @close="resetSupportForm"
  >
      <form class="support-form" @submit.prevent="submitSupportRequest">
        <div class="form-row">
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
            <label for="support-priority">Priorität</label>
            <select id="support-priority" v-model="supportForm.priority" required>
              <option value="low">🟢 Niedrig</option>
              <option value="normal">🔵 Normal</option>
              <option value="high">🟠 Hoch</option>
              <option value="critical">🔴 Kritisch</option>
            </select>
          </div>
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

        <details class="optional-fields">
          <summary>Optionale Angaben (helfen bei der Bearbeitung)</summary>
          <div class="optional-fields__grid">
            <div class="form-group">
              <label for="support-personalnr">Personalnummer</label>
              <input
                id="support-personalnr"
                v-model="supportForm.personalNr"
                type="text"
                placeholder="z. B. 12345"
              />
            </div>
            <div class="form-group">
              <label for="support-reference">Referenz-ID (Auftrag / MA / Datensatz)</label>
              <input
                id="support-reference"
                v-model="supportForm.referenceId"
                type="text"
                placeholder="z. B. Auftrags- oder Datensatz-ID"
              />
            </div>
            <div class="form-group">
              <label for="support-area">Betroffener Bereich / Seite</label>
              <input
                id="support-area"
                v-model="supportForm.affectedArea"
                type="text"
                placeholder="z. B. Dispo, Personal, Aufträge"
              />
            </div>
            <div class="form-group">
              <label for="support-name">Name (Mitarbeiter / Kunde)</label>
              <input
                id="support-name"
                v-model="supportForm.relatedName"
                type="text"
                placeholder="z. B. Max Mustermann"
              />
            </div>
          </div>
        </details>

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
  </ModalFrame>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useUi } from "@/stores/ui";
import { useTheme } from "@/stores/theme";
import { useAuth } from "@/stores/auth";
import { useComments } from "@/stores/comments";
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import CustomTooltip from './CustomTooltip.vue';
import CommentBubbleBadge from './CommentBubbleBadge.vue';
import ModalFrame from './frames/ModalFrame.vue';
import api from '@/utils/api';
import { setTheme } from '@getflip/bridge';

// Logos vorher importieren
import darkLogo from "@/assets/SF_000.svg";
import lightLogo from "@/assets/SF_002.png";

defineProps({
  currentViewTitle: {
    type: String,
    default: '',
  },
});

const ui = useUi();
const theme = useTheme();
const auth = useAuth();
const comments = useComments();
const route = useRoute();

// In dev mode, role-restricted nav items are highlighted with their required role color.
const isDev = import.meta.env.DEV;

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
const mobileNavGroupsOpen = ref({});

// Support Modal State
const showSupportModal = ref(false);
const isSubmitting = ref(false);
let lockedScrollY = 0;

const supportForm = reactive({
  type: '',
  priority: 'normal',
  subject: '',
  description: '',
  personalNr: '',
  referenceId: '',
  affectedArea: '',
  relatedName: '',
  files: []
});

const syncBodyScrollLock = (locked) => {
  const body = document.body;

  if (!body) return;

  if (locked) {
    if (body.dataset.scrollLock === 'true') return;

    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    body.dataset.scrollLock = 'true';
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return;
  }

  if (body.dataset.scrollLock !== 'true') return;

  body.dataset.scrollLock = 'false';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  body.style.overflow = '';
  window.scrollTo(0, lockedScrollY);
};

watch(
  () => showMobileMenu.value,
  (isLocked) => {
    syncBodyScrollLock(isLocked);
  }
);

// Neue Pages für alle authentifizierten Nutzer freigeschaltet
const newPagesEnabled = computed(() => !!auth.user);

const isAdmin = computed(() => auth.user?.roles?.includes('ADMIN'));
const canSeePayroll = computed(() => isAdmin.value);
const isPayrollSectionActive = computed(() => route.name === 'Payroll');
const isKundenSectionActive = computed(() => route.name === 'Kunden');
const kundenNavLabel = computed(() => {
  if (route.name !== 'Kunden') return 'Kunden';
  const labels = { analytics: 'Analytics', leads: 'Leads', watchlist: 'Watchlist', kontakte: 'Kontakte' };
  return labels[route.query.tab] || 'Kunden';
});
const kundenNavTarget = computed(() => {
  const tab = route.name === 'Kunden' ? route.query.tab : null;
  return tab ? { path: '/kunden', query: { tab } } : '/kunden';
});
const isAuftraegeSectionActive = computed(() => route.name === 'Auftraege');
const auftraegeNavLabel = computed(() => (
  route.name === 'Auftraege' && route.query.tab === 'list' ? 'Liste' : 'Aufträge'
));
const auftraegeNavTarget = computed(() => (
  auftraegeNavLabel.value === 'Liste'
    ? { path: '/auftraege', query: { tab: 'list' } }
    : '/auftraege'
));
const isBestandSectionActive = computed(() => ['Bestand', 'Verlauf'].includes(route.name));
const bestandNavLabel = computed(() => {
  if (route.name === 'Verlauf') return route.query.tab === 'graph' ? 'Graph' : 'Verlauf';
  return 'Bestand';
});
const bestandNavTarget = computed(() => {
  if (bestandNavLabel.value === 'Graph') return { path: '/verlauf', query: { tab: 'graph' } };
  if (bestandNavLabel.value === 'Verlauf') return '/verlauf';
  return '/bestand';
});
const isReportsSectionActive = computed(() => ['Dokumente', 'DokumenteNachpflegen', 'TeamleiterAuswertung'].includes(route.name));
const reportsNavLabel = computed(() => {
  const m = { Dokumente: 'Reports', DokumenteNachpflegen: 'Nachpflege', TeamleiterAuswertung: 'Auswertung' };
  return m[route.name] || 'Reports';
});
const reportsNavTarget = computed(() => {
  if (route.name === 'DokumenteNachpflegen') return '/dokumente-nachpflegen';
  if (route.name === 'TeamleiterAuswertung') return '/teamleiter-auswertung';
  return '/dokumente';
});
const isPersonalSectionActive = computed(() => ['Personal', 'BenutzerErstellen'].includes(route.name));
const personalNavLabel = computed(() => {
  if (route.name === 'BenutzerErstellen') return 'MA erstellen';
  if (route.name === 'Personal' && route.query.tab === 'bewerber') return 'Bewerber';
  return 'Personal';
});
const personalNavTarget = computed(() => {
  if (personalNavLabel.value === 'MA erstellen') return '/flip/benutzer-erstellen';
  if (personalNavLabel.value === 'Bewerber') return { path: '/personal', query: { tab: 'bewerber' } };
  return '/personal';
});
const isSignSectionActive = computed(() => route.name === 'SignaturenPage');
const signNavLabel = computed(() => {
  if (route.name !== 'SignaturenPage') return 'Signatur';
  const labels = { templates: 'Templates', ablage: 'Ablage' };
  return labels[route.query.tab] || 'Signatur';
});
const signNavTarget = computed(() => {
  const tab = route.name === 'SignaturenPage' ? route.query.tab : null;
  return tab ? { path: '/signaturen', query: { tab } } : '/signaturen';
});

const navigationItems = computed(() => {
  const child = (id, label, to, active, icon = ['fas', 'layer-group'], mobileLabel = label) => ({
    id, label, mobileLabel, to, active, icon, disabled: false
  });
  const items = [
    {
      id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: ['fas', 'chart-line'],
      mobileLabel: 'Dashboard',
      active: route.name === 'Dashboard', groupClass: 'nav-group--dashboard',
      children: [child('dashboard-overview', 'Übersicht', '/dashboard', route.name === 'Dashboard' && !route.query.tab, ['fas', 'table-cells-large'], 'Dashboard')]
    },
    {
      id: 'dispo', label: 'Dispo', to: '/dispo', icon: ['fas', 'table-columns'],
      mobileLabel: 'Dispo',
      active: route.name === 'Dispo', children: []
    },
    {
      id: 'auftraege', label: auftraegeNavLabel.value, to: auftraegeNavTarget.value,
      mobileLabel: 'Aufträge', icon: ['fas', 'calendar-alt'], active: isAuftraegeSectionActive.value,
      disabled: !newPagesEnabled.value, groupClass: 'nav-group--auftraege',
      children: [
        child('auftraege-overview', 'Aufträge', '/auftraege', route.name === 'Auftraege' && !route.query.tab, ['fas', 'layer-group'], 'Kalender'),
        child('auftraege-list', 'Liste', { path: '/auftraege', query: { tab: 'list' } }, route.name === 'Auftraege' && route.query.tab === 'list', ['fas', 'list'])
      ]
    },
    {
      id: 'signaturen', label: signNavLabel.value, to: signNavTarget.value,
      mobileLabel: 'Signatur', icon: ['fas', 'file-signature'], active: isSignSectionActive.value, groupClass: 'nav-group--sign',
      children: [
        child('signaturen-default', 'Signatur', '/signaturen', route.name === 'SignaturenPage' && !route.query.tab, ['fas', 'list-check'], 'Übersicht'),
        child('signaturen-templates', 'Templates', { path: '/signaturen', query: { tab: 'templates' } }, route.name === 'SignaturenPage' && route.query.tab === 'templates', ['fas', 'file-lines']),
        child('signaturen-ablage', 'Ablage', { path: '/signaturen', query: { tab: 'ablage' } }, route.name === 'SignaturenPage' && route.query.tab === 'ablage', ['fas', 'folder-open'])
      ]
    },
    {
      id: 'personal', label: personalNavLabel.value, to: personalNavTarget.value,
      mobileLabel: 'Personal', icon: ['fas', 'users'], active: isPersonalSectionActive.value,
      disabled: !newPagesEnabled.value, groupClass: 'nav-group--personal',
      children: [
        child('personal-default', 'Personal', '/personal', route.name === 'Personal' && !route.query.tab, ['fas', 'layer-group'], 'Übersicht'),
        child('personal-bewerber', 'Bewerber', { path: '/personal', query: { tab: 'bewerber' } }, route.name === 'Personal' && route.query.tab === 'bewerber', ['fas', 'user-plus']),
        child('personal-create', 'MA erstellen', '/flip/benutzer-erstellen', route.name === 'BenutzerErstellen', ['fas', 'user-plus'])
      ]
    },
    {
      id: 'payroll', label: 'Stunden', to: '/payroll', icon: ['fas', 'calculator'],
      mobileLabel: 'Stunden',
      active: isPayrollSectionActive.value, disabled: !canSeePayroll.value, beta: true,
      groupClass: 'nav-group--payroll', desktopChildren: [],
      children: [
        child('payroll-capture', 'Stundenerfassung', '/payroll', route.name === 'Payroll' && (!route.query.tab || route.query.tab === 'stundenerfassung'), ['fas', 'clock']),
        child('payroll-review', 'Monatsprüfung', { path: '/payroll', query: { tab: 'monatspruefung' } }, route.name === 'Payroll' && route.query.tab === 'monatspruefung', ['fas', 'list-check'])
      ]
    },
    {
      id: 'reports', label: reportsNavLabel.value, to: reportsNavTarget.value,
      mobileLabel: 'Reports', icon: ['fas', 'file-alt'], active: isReportsSectionActive.value, groupClass: 'nav-group--reports',
      children: [
        child('reports-default', 'Reports', '/dokumente', route.name === 'Dokumente', ['fas', 'layer-group'], 'Übersicht'),
        child('reports-maintenance', 'Nachpflege', '/dokumente-nachpflegen', route.name === 'DokumenteNachpflegen', ['fas', 'pen-to-square']),
        child('reports-evaluation', 'Auswertung', '/teamleiter-auswertung', route.name === 'TeamleiterAuswertung', ['fas', 'user-tie'])
      ]
    },
    {
      id: 'bestand', label: bestandNavLabel.value, to: bestandNavTarget.value,
      mobileLabel: 'Bestand', icon: ['fas', 'list'], active: isBestandSectionActive.value, groupClass: 'nav-group--bestand',
      children: [
        child('bestand-default', 'Bestand', '/bestand', route.name === 'Bestand', ['fas', 'layer-group'], 'Übersicht'),
        child('bestand-history', 'Verlauf', '/verlauf', route.name === 'Verlauf' && route.query.tab !== 'graph', ['fas', 'history']),
        child('bestand-graph', 'Graph', { path: '/verlauf', query: { tab: 'graph' } }, route.name === 'Verlauf' && route.query.tab === 'graph', ['fas', 'chart-line'])
      ]
    },
    {
      id: 'kunden', label: kundenNavLabel.value, to: kundenNavTarget.value,
      mobileLabel: 'Kunden', icon: ['fas', 'building'], active: isKundenSectionActive.value, devRole: isDev, groupClass: 'nav-group--kunden',
      children: [
        child('kunden-default', 'Kunden', '/kunden', route.name === 'Kunden' && !route.query.tab, ['fas', 'layer-group'], 'Übersicht'),
        child('kunden-analytics', 'Analytics', { path: '/kunden', query: { tab: 'analytics' } }, route.name === 'Kunden' && route.query.tab === 'analytics', ['fas', 'chart-line']),
        child('kunden-leads', 'Leads', { path: '/kunden', query: { tab: 'leads' } }, route.name === 'Kunden' && route.query.tab === 'leads', ['fas', 'bullseye']),
        child('kunden-watchlist', 'Watchlist', { path: '/kunden', query: { tab: 'watchlist' } }, route.name === 'Kunden' && route.query.tab === 'watchlist', ['fas', 'star']),
        child('kunden-contacts', 'Kontakte', { path: '/kunden', query: { tab: 'kontakte' } }, route.name === 'Kunden' && route.query.tab === 'kontakte', ['fas', 'address-book'])
      ]
    },
    {
      id: 'settings', label: 'Einstellungen', mobileLabel: 'Einstellungen', to: '/einstellungen',
      icon: ['fas', 'gear'], active: route.name === 'UserSettings', children: [], mobileOnly: true
    }
  ];

  return items.map((item) => ({
    ...item,
    children: item.children.map((entry) => ({ ...entry, disabled: item.disabled })),
    desktopChildren: (item.desktopChildren || item.children
      .filter((entry) => entry.label !== item.label))
      .map((entry) => ({ ...entry, disabled: item.disabled }))
  }));
});

const settingsNavigationItem = computed(() => navigationItems.value.find((item) => item.id === 'settings'));

const isMobileNavGroupOpen = (id) => !!mobileNavGroupsOpen.value[id];
const toggleMobileNavGroup = (item) => {
  if (item.disabled) return;
  mobileNavGroupsOpen.value = {
    ...mobileNavGroupsOpen.value,
    [item.id]: !isMobileNavGroupOpen(item.id)
  };
};
const handleNavigationClick = (event, item, closeMenu = false) => {
  if (item.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
  if (closeMenu) closeMobileMenu();
  return true;
};

const closeMobileMenu = () => {
  showMobileMenu.value = false;
  mobileNavGroupsOpen.value = {};
};

watch(
  () => route.fullPath,
  () => {
    const activeGroups = {};
    navigationItems.value.forEach((item) => {
      if (item.active) activeGroups[item.id] = true;
    });
    mobileNavGroupsOpen.value = activeGroups;
  },
  { immediate: true }
);

// Support Modal Functions
const resetSupportForm = () => {
  supportForm.type = '';
  supportForm.priority = 'normal';
  supportForm.subject = '';
  supportForm.description = '';
  supportForm.personalNr = '';
  supportForm.referenceId = '';
  supportForm.affectedArea = '';
  supportForm.relatedName = '';
  supportForm.files = [];
};

const closeSupportModal = () => {
  showSupportModal.value = false;
  resetSupportForm();
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
    formData.append('priority', supportForm.priority);
    formData.append('subject', supportForm.subject);
    formData.append('description', supportForm.description);
    formData.append('personalNr', supportForm.personalNr);
    formData.append('referenceId', supportForm.referenceId);
    formData.append('affectedArea', supportForm.affectedArea);
    formData.append('relatedName', supportForm.relatedName);
    formData.append('currentRoute', route.fullPath);
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

// Theme Toggle with Flip Bridge sync
const toggleTheme = async () => {
  const newTheme = theme.isDark ? 'light' : 'dark';
  
  try {
    await theme.setForUser(newTheme);
  } catch (error) {
    console.error('Theme preference could not be saved:', error);
    return;
  }
  
  // Try to sync with Flip Bridge (may not be supported in all contexts)
  try {
    await setTheme(newTheme);
    console.log(`🎨 Flip theme updated to: ${newTheme}`);
  } catch (e) {
    // INVALID_REQUEST means setTheme is not available in this context (e.g., regular app vs admin)
    // This is expected behavior - Flip Bridge subscription still works for Flip → App sync
    if (e?.code !== 'INVALID_REQUEST') {
      console.warn('Flip Bridge setTheme failed:', e.code || e);
    }
  }
};

function logout() {
  auth.logout();
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
  syncBodyScrollLock(false);
  document.removeEventListener('keydown', handleEscapeKey);
});

</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 8px 16px;
  background: var(--panel);
  min-height: 56px;
}
.header-top {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "left right"
    "nav  nav";
  align-items: center;
  column-gap: 12px;
}
.header-top .left {
  grid-area: left;
}
.header-top .right {
  grid-area: right;
  justify-self: end;
}
.header-top .desktop-nav {
  grid-area: nav;
  margin-top: 4px;
}
.left,
.right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.desktop-user-area {
  display: grid;
  justify-items: end;
  gap: 3px;
}

.header-user-name {
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1;
  white-space: nowrap;
}

/* Desktop Navigation */
.desktop-nav {
  display: flex;
  gap: 12px;
  align-items: center;
}

.nav-group {
  position: relative;
  display: flex;
  align-items: center;
}

.nav-submenu {
  position: absolute;
  top: 100%;
  left: 0;
  padding: 6px 0 4px;
  min-width: max-content;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--panel);
  border-radius: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
  z-index: 20;
}

.nav-group:hover .nav-submenu,
.nav-group:focus-within .nav-submenu {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0);
}

.nav-submenu__link {
  justify-content: flex-start;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  color: color-mix(in oklab, var(--text) 72%, var(--muted) 28%);
  font-family: inherit;
  font-size: 14px;
  line-height: normal;
  font-weight: 300;
  white-space: nowrap;
}

.nav-submenu__link.active,
.nav-submenu__link:hover,
.nav-submenu__link:focus-visible {
  color: var(--primary);
  background: transparent;
}

.header-view-title {
  display: none;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 500;
  color: var(--text);
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
  overscroll-behavior: contain;
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
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
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

.mobile-menu-items > a,
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
  border-radius: 0;
  box-shadow: none;
}

.mobile-menu-group {
  display: flex;
  flex-direction: column;
}

.mobile-menu-toggle {
  justify-content: space-between;
}

.mobile-menu-toggle__label,
.mobile-menu-toggle__meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-submenu {
  display: flex;
  flex-direction: column;
  padding: 0 0 8px;
}

.mobile-submenu__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px 8px 56px;
  color: var(--muted);
  text-decoration: none;
  transition: background 0.2s;
  font-size: 13px;
  font-weight: 400;
}

.mobile-submenu__link :deep(svg) {
  width: 14px;
  height: 14px;
  color: inherit;
  opacity: 0.9;
}

.mobile-submenu .mobile-submenu__link.active {
  color: var(--primary);
  font-weight: 600;
}

.mobile-menu-items > a.active,
.mobile-menu-toggle.active {
  color: var(--primary);
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
  color: #333;
  font-weight: 600;
  margin-top: 8px;
}

@media (hover: hover) and (pointer: fine) {
  .burger-btn:hover,
  .close-mobile-menu:hover,
  .mobile-menu-items a:hover,
  .mobile-menu-btn:hover,
  button:hover {
    background: var(--hover);
  }

  .close-btn:hover {
    color: var(--text);
    background: var(--hover);
  }
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

/* Compact Header Optimierungen */
@media (max-width: 900px) {
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
    flex-wrap: nowrap;
  }
  
  .right {
    gap: 4px;
    flex-shrink: 0; /* Verhindere Schrumpfung */
    flex-wrap: nowrap;
  }
  
  /* Button-Gruppen umschalten */
  .desktop-buttons {
    display: none; /* Verstecke Desktop Buttons */
  }

  .desktop-user-area {
    display: none;
  }
  
  .mobile-buttons {
    display: flex; /* Zeige Mobile Buttons */
  }
  
  /* Verstecke Desktop Navigation */
  .desktop-nav {
    display: none;
  }

  .header-view-title {
    display: block;
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
  height: auto;
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
  font-weight: 600;
}

.mobile-submenu .mobile-submenu__link,
.mobile-submenu .mobile-submenu__link.active {
  padding: 8px 16px 8px 56px;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
  gap: 10px;
}

.mobile-submenu .mobile-submenu__link.active {
  color: var(--primary);
}

@media (hover: hover) and (pointer: fine) {
  .desktop-nav > a:hover,
  .desktop-nav > .nav-group > a:hover,
  .nav-submenu__link:hover,
  .nav-submenu__link:focus-visible {
    color: var(--primary);
    background: transparent;
  }
}

a.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.beta-tag {
  background: color-mix(in srgb, var(--primary) 52%, var(--surface));
  color: color-mix(in srgb, var(--text) 68%, var(--primary));
  font-size: 8px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

@media (min-width: 901px) {
  .nav-group--payroll > a { overflow: visible; }
  .beta-tag--payroll { position: absolute; top: -8px; right: -5px; }
}

.neu-tag {
  background: var(--primary, #ff9500);
  color: white;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-left: 4px;
}
button {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.icon-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

/* Kommentar-Feed button badge */
.kf-btn {
  position: relative;
}
.kf-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 20px;
}

/* Support Modal */
:deep(.support-modal) {
  --mf-max-width: 600px;
  --mf-body-padding: 0;
  --mf-surface: var(--tile-bg);
}

.support-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.optional-fields {
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 8px 12px;
}

.optional-fields > summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
  padding: 4px 0;
  list-style: none;
  user-select: none;
}

.optional-fields > summary::-webkit-details-marker {
  display: none;
}

.optional-fields > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 8px;
  transition: transform 0.2s ease;
  color: var(--muted);
}

.optional-fields[open] > summary::before {
  transform: rotate(90deg);
}

.optional-fields__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 12px;
}

.optional-fields__grid .form-group {
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}

.optional-fields__grid .form-group label {
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 500;
}

.optional-fields__grid .form-group input {
  margin-top: auto;
}

@media (max-width: 768px) {
  .form-row,
  .optional-fields__grid {
    grid-template-columns: 1fr;
  }
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
  box-sizing: border-box;
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
  :deep(.support-modal) {
    --mf-overlay-padding: 10px;
    --mf-max-height: 95vh;
  }

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
