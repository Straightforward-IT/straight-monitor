<template>
  <header class="public-header">
    <div class="left">
      <img :src="logoSrc" class="logo" alt="logo" />
      <h1 v-if="vorname">{{ vorname }}</h1>
      <h1 v-else>Straight Monitor</h1>
    </div>

    <!-- Right Side (Desktop) -->
    <div class="right desktop-only">
      <small v-if="flipResponse" class="theme-label" title="Theme from Flip">Flip: {{ flipResponse }}</small>
      <button class="theme-toggle" @click="handleThemeToggle">
        {{ theme.isDark ? '☀️' : '🌙' }}
      </button>
    </div>

    <!-- Burger Button (Mobile) -->
    <button class="burger-btn mobile-only" @click="showMobileMenu = !showMobileMenu">
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
          <div class="menu-item">
            <span>Theme</span>
            <button class="theme-toggle" @click="handleThemeToggle">
              {{ theme.isDark ? '☀️ Light Mode' : '🌙 Dark Mode' }}
            </button>
          </div>
          <div v-if="flipResponse" class="menu-item info">
            <span>Flip Status:</span>
            <small>{{ flipResponse }}</small>
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
import { getTheme, initFlipBridge } from '@getflip/bridge';

const props = defineProps({
  vorname: {
    type: String,
    default: ""
  }
});

const theme = useTheme();
const logoSrc = computed(() => (theme.isDark ? darkLogo : lightLogo));

const showMobileMenu = ref(false);
const flipResponse = ref('');

const handleThemeToggle = () => {
  const newTheme = theme.isDark ? 'light' : 'dark';
  theme.set(newTheme);
};

onMounted(async () => {
  try {
    // Try to ensure bridge is inited (App.vue does this too but safe to re-call or check)
    // initFlipBridge({ hostAppOrigin: '*' }); // Commented out to avoid double init if not needed or potential error
    
    // Check if flip bridge is available
    const t = await getTheme();
    
    // Correctly handle the object response { activeTheme, preferredTheme }
    const active = t?.activeTheme || t; // Fallback if it returns just string (older versions)

    if (active === 'dark' || active === 'light') {
      flipResponse.value = active;
      theme.set(active);
    } else {
      flipResponse.value = 'default';
    }
  } catch (e) {
    flipResponse.value = 'extern';
    // console.warn('Flip theme fetch failed in header', e);
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
  border-bottom: 1px solid var(--border);
  min-height: 56px;
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
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

h1 {
  font-size: 1.1rem;
  margin: 0;
  font-weight: 600;
  color: var(--text);
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
