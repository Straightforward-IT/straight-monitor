<template>
  <header class="public-header">
    <div class="left">
      <template v-if="currentView === 'dashboard'">
        <img :src="logoSrc" class="logo logo--clickable" alt="logo" @click="navigate('dashboard')" />
        <h1 class="title--clickable" @click="navigate('dashboard')">Straightforward</h1>
      </template>
      <template v-else>
        <button class="header-back-btn" @click="$emit('back')">
          <font-awesome-icon icon="fa-solid fa-arrow-left" />
        </button>
        <h1 class="header-view-title">{{ viewTitle }}</h1>
      </template>
    </div>

    <!-- Debug TL Toggle (dev only) -->
    <button
      v-if="isDebugUser"
      class="debug-tl-btn"
      :class="{ active: debugTlActive }"
      @click="emit('toggle-debug-tl')"
    >
      <font-awesome-icon icon="fa-solid fa-user-tie" />
      TL
    </button>

    <!-- Burger Button -->
    <button class="burger-btn" @click="showMobileMenu = !showMobileMenu">
      <font-awesome-icon :icon="showMobileMenu ? 'times' : 'bars'" />
    </button>

    <!-- Mobile Menu -->
    <div v-if="showMobileMenu" class="mobile-menu-overlay" @click="showMobileMenu = false">
      <nav class="mobile-menu" @click.stop>
        <div class="mobile-menu-header">
          <h3>Menu</h3>
          <button class="close-btn" @click="showMobileMenu = false">
             <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="mobile-menu-content">
          <!-- Navigation -->
          <div class="menu-nav">
            <button
              class="menu-nav-item"
              :class="{ active: currentView === 'dashboard' }"
              @click="navigate('dashboard')"
            >
              <img :src="imgStraightforward" class="menu-nav-img" alt="" />
              <span>Startseite</span>
            </button>
            <button
              class="menu-nav-item"
              :class="{ active: currentView === 'kalender' }"
              @click="navigate('kalender')"
            >
              <img :src="imgCalender" class="menu-nav-img" alt="" />
              <span>Kalender</span>
            </button>
            <button
              v-if="!isTeamleiter"
              class="menu-nav-item"
              :class="{ active: currentView === 'laufzettel' }"
              @click="navigate('laufzettel')"
            >
              <img :src="imgLaufzettel" class="menu-nav-img" alt="" />
              <span>Laufzettel</span>
            </button>
            <button
              v-if="isTeamleiter"
              class="menu-nav-item"
              :class="{ active: currentView === 'evaluierungen' }"
              @click="navigate('evaluierungen')"
            >
              <img :src="imgEvaluierung" class="menu-nav-img" alt="" />
              <span>Laufzettel</span>
            </button>
            <button
              class="menu-nav-item"
              :class="{ active: currentView === 'vergangene-jobs' }"
              @click="navigate('vergangene-jobs')"
            >
              <img :src="imgTasks" class="menu-nav-img" alt="" />
              <span>Vergangene Jobs</span>
            </button>
            <button
              v-if="isTeamleiter"
              class="menu-nav-item"
              :class="{ active: currentView === 'eventreport' }"
              @click="navigate('eventreport')"
            >
              <img :src="imgEventreport" class="menu-nav-img" alt="" />
              <span>Event Report</span>
            </button>
          </div>

          <div class="menu-divider"></div>

          <div class="menu-item">
            <span>Theme</span>
            <button class="theme-toggle" @click="handleThemeToggle">
              <font-awesome-icon :icon="theme.isDark ? ['fas', 'sun'] : ['fas', 'moon']" />
              {{ theme.isDark ? 'Light Mode' : 'Dark Mode' }}
            </button>
          </div>

        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import darkLogo from "@/assets/SF_000.svg";
import lightLogo from "@/assets/SF_002.png";
import { useTheme } from "@/stores/theme";
import { getTheme } from '@getflip/bridge';
import straightforwardLight from "@/assets/straightforward.png";
import straightforwardDark from "@/assets/straightforward-dark.png";
import calenderLight from "@/assets/calender.png";
import calenderDark from "@/assets/calender-dark.png";
import laufzettelLight from "@/assets/laufzettel.png";
import laufzettelDark from "@/assets/laufzettel-dark.png";
import evaluierungLight from "@/assets/evaluierung.png";
import evaluierungDark from "@/assets/evaluierung-dark.png";
import tasksLight from "@/assets/tasks.png";
import tasksDark from "@/assets/tasks-dark.png";
import eventreportLight from "@/assets/eventreport.png";
import eventreportDark from "@/assets/eventreport-dark.png";

const props = defineProps({
  vorname: {
    type: String,
    default: ""
  },
  isTeamleiter: {
    type: Boolean,
    default: false
  },
  currentView: {
    type: String,
    default: 'dashboard'
  },
  email: {
    type: String,
    default: ''
  },
  debugTlActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['navigate', 'back', 'toggle-debug-tl']);

const DEBUG_EMAIL = 'cedricbglx@gmail.com';
const isDebugUser = computed(() => props.email === DEBUG_EMAIL);

const viewTitleMap = {
  'kalender': 'Kalender',
  'laufzettel': 'Laufzettel',
  'evaluierungen': 'Evaluierungen',
  'evaluierung': 'Evaluierung',
  'vergangene-jobs': 'Vergangene Jobs',
  'job-detail': 'Job Details',
  'eventreport': 'Event Report'
};
const viewTitle = computed(() => viewTitleMap[props.currentView] || '');

function navigate(view) {
  showMobileMenu.value = false;
  emit('navigate', view);
}

const theme = useTheme();
const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));
const imgStraightforward = computed(() => theme.isDark ? straightforwardDark : straightforwardLight);
const imgCalender = computed(() => theme.isDark ? calenderDark : calenderLight);
const imgLaufzettel = computed(() => theme.isDark ? laufzettelDark : laufzettelLight);
const imgEvaluierung = computed(() => theme.isDark ? evaluierungDark : evaluierungLight);
const imgTasks = computed(() => theme.isDark ? tasksDark : tasksLight);
const imgEventreport = computed(() => theme.isDark ? eventreportDark : eventreportLight);

const showMobileMenu = ref(false);

const handleThemeToggle = () => {
  const newTheme = theme.isDark ? 'light' : 'dark';
  theme.set(newTheme);
};

onMounted(async () => {
  try {
    // Bridge wird zentral in App.vue initialisiert, hier nur Theme abrufen
    const t = await getTheme();
    const active = t?.activeTheme || t;

    if (active === 'dark' || active === 'light') {
      theme.set(active);
      document.documentElement.setAttribute("data-theme", active);
    }
  } catch (e) {
    // App läuft außerhalb von Flip - normal behavior
  }
});
</script>

<style scoped>
.public-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--panel);
  min-height: 56px;
  color: var(--text);
}

.left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.logo {
  width: 36px;
  height: auto;
}

.logo--clickable,
.title--clickable {
  cursor: pointer;
}

.title--clickable:hover {
  color: var(--primary);
  transition: color 0.15s;
}

.header-back-btn {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px 4px 0;
  display: flex;
  align-items: center;
  -webkit-tap-highlight-color: transparent;
}

.header-view-title {
  font-size: 1.1rem;
  margin: 0;
  font-weight: 600;
  color: var(--text);
}

h1 {
  font-size: 1.1rem;
  margin: 0;
  font-weight: 600;
  color: var(--text);
}

.debug-tl-btn {
  background: none;
  border: 1px dashed var(--muted);
  color: var(--muted);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(255, 117, 24, 0.1);
  }
}

/* Right Side */
.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.theme-toggle:hover {
  background: var(--hover);
}

.theme-label {
  font-size: 0.75rem;
  color: var(--muted);
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Mobile Specific */
.burger-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text);
  cursor: pointer;
  padding: 4px;
}

.mobile-only { display: none; }
.desktop-only { display: flex; }

@media (max-width: 768px) {
  .mobile-only { display: block; }
  .desktop-only { display: none; }
}

/* Mobile Menu Overlay */
.mobile-menu-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.mobile-menu {
  width: 80%;
  max-width: 300px;
  background: var(--panel);
  height: 100%;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.mobile-menu-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mobile-menu-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text);
  cursor: pointer;
}

.mobile-menu-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.menu-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.menu-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.menu-nav-item:hover,
.menu-nav-item:active {
  background: var(--hover);
}

.menu-nav-item.active {
  background: rgba(238, 175, 103, 0.15);
  color: var(--primary);
  font-weight: 600;
  border-left: 3px solid var(--primary);
}

.menu-nav-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}

.menu-divider {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0;
}

.menu-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--text);
}

.menu-item.info {
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
