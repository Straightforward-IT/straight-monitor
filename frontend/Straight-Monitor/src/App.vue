<template>
  <main>
    <router-view />

    <!-- Notification Permission Banner -->
    <Transition name="notif-banner">
      <div
        v-if="showNotifBanner && !isSpecialRoute"
        class="notif-banner"
        role="dialog"
        aria-live="polite"
      >
        <div class="notif-banner__icon">
          <i class="fa-regular fa-bell"></i>
        </div>
        <div class="notif-banner__text">
          <strong>Browser-Benachrichtigungen aktivieren?</strong>
          <span>Damit kannst du über den Browser Nachrichten erhalten.</span>
        </div>
        <div class="notif-banner__actions">
          <button class="notif-banner__btn notif-banner__btn--primary" @click="allowNotifications">
            Erlauben
          </button>
          <button class="notif-banner__btn notif-banner__btn--secondary" @click="dismissBanner">
            Nein danke
          </button>
        </div>
      </div>
    </Transition>
  </main>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { getTheme, initFlipBridge, subscribe, BridgeEventType } from "@getflip/bridge";
import { useTheme } from "@/stores/theme";
import { useDataCache } from "@/stores/dataCache";

const NOTIF_STORAGE_KEY = "notif_prompted_v1";

const route = useRoute();
const themeStore = useTheme();
const isFlipCreate = computed(() => route.name === "BenutzerErstellen");
const isPublicEinsaetze = computed(() => route.name === "PublicEinsaetze");
const isSpecialRoute = computed(() => isFlipCreate.value || isPublicEinsaetze.value);

// --- Notification Permission Banner ---
const showNotifBanner = ref(false);

function checkNotificationPrompt() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  if (localStorage.getItem(NOTIF_STORAGE_KEY)) return;
  showNotifBanner.value = true;
}

async function allowNotifications() {
  showNotifBanner.value = false;
  localStorage.setItem(NOTIF_STORAGE_KEY, "1");
  await Notification.requestPermission();
}

function dismissBanner() {
  showNotifBanner.value = false;
  localStorage.setItem(NOTIF_STORAGE_KEY, "1");
}


// Dynamically update `#app` margin
const updateAppMargin = () => {
  const appDiv = document.getElementById("app");
  if (appDiv) {
    // Wenn FlipCreate ODER PublicEinsaetze -> Margin/Padding resetten
    if (isFlipCreate.value || isPublicEinsaetze.value) {
      appDiv.style.margin = "unset";
      appDiv.style.padding = "0"; // Entfernt den schwarzen Rand
      appDiv.style.maxWidth = "100%";
    } else {
      appDiv.style.margin = "";
      appDiv.style.padding = "";
      appDiv.style.maxWidth = "";
    }
  }
};

// Zentrale Flip Bridge Initialisierung (nur EINMAL in der ganzen App)
let flipBridgeInitialized = false;
let themeUnsubscribe = null;

const initializeFlipBridge = async () => {
  if (flipBridgeInitialized) return;
  
  // Prüfen ob wir in einem iframe laufen (Flip Desktop nutzt iframes)
  const isInIframe = window.self !== window.top;
  
  try {
    // Verschiedene hostAppOrigin-Strategien für Desktop vs Mobile
    const config = {
      hostAppOrigin: isInIframe 
        ? window.location.ancestorOrigins?.[0] || 'https://straightforward.flip-app.com'
        : '*',
      debug: true 
    };
    
    console.log(`🔧 Initializing Flip Bridge with config:`, config);
    console.log(`📍 Context: isInIframe=${isInIframe}, origin=${window.location.origin}`);
    
    initFlipBridge(config);
    flipBridgeInitialized = true;
    console.log("✅ Flip Bridge initialized");
    
    // Initial theme holen
    const theme = await getTheme();
    if (theme?.activeTheme) {
      document.documentElement.setAttribute("data-theme", theme.activeTheme);
      themeStore.set(theme.activeTheme); // Sync Pinia store
      console.log(`🎨 Initial theme: ${theme.activeTheme}`);
    }
    
    // Theme changes abonnieren
    themeUnsubscribe = await subscribe(BridgeEventType.THEME_CHANGE, (event) => {
      if (event?.data?.activeTheme) {
        const newTheme = event.data.activeTheme;
        document.documentElement.setAttribute("data-theme", newTheme);
        themeStore.set(newTheme); // Sync Pinia store for logo reactivity
        console.log(`🎨 Theme changed to: ${newTheme}`);
      }
    });
    
  } catch (e) {
    console.warn("Flip Bridge not available:", {
      code: e.code || e,
      isInIframe,
      origin: window.location.origin,
      ancestorOrigins: window.location.ancestorOrigins?.[0]
    });
  }
};

// Cleanup bei Unmount
onBeforeUnmount(async () => {
  if (themeUnsubscribe) {
    await themeUnsubscribe();
  }
});

onMounted(() => {
  updateAppMargin();
  initializeFlipBridge(); // Einmalige Bridge-Initialisierung
  useDataCache().initVisibilityHandler(); // Cache-Refresh bei Tab-Rückkehr
  checkNotificationPrompt();
});

// Watch for route changes
watch(route, () => {
  document.title = isFlipCreate.value
    ? "Benutzer Erstellen - Straight Monitor"
    : "Straight Monitor";

  updateAppMargin();
});

// Ensure margin is set correctly when the app loads
onMounted(updateAppMargin);
onBeforeUnmount(() => {
  const appDiv = document.getElementById("app");
  if (appDiv) appDiv.style.margin = ""; // Reset margin when unmounting
});
</script>

<style>
/* No need to modify body styles */
</style>

<style scoped>
.notif-banner {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-left: 4px solid var(--primary, #f97316);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  max-width: 560px;
  width: calc(100vw - 48px);
}

.notif-banner__icon {
  font-size: 22px;
  color: var(--primary, #f97316);
  flex-shrink: 0;
}

.notif-banner__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.notif-banner__text strong {
  font-size: 14px;
  font-weight: 600;
}

.notif-banner__text span {
  font-size: 13px;
  opacity: 0.7;
}

.notif-banner__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.notif-banner__btn {
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
}

.notif-banner__btn:hover {
  opacity: 0.8;
}

.notif-banner__btn--primary {
  background: var(--primary, #f97316);
  color: #fff;
}

.notif-banner__btn--secondary {
  background: transparent;
  border-color: var(--border-color, #ccc);
  color: inherit;
}

/* Slide-in animation */
.notif-banner-enter-active,
.notif-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.notif-banner-enter-from,
.notif-banner-leave-to {
  transform: translateX(-50%) translateY(80px);
  opacity: 0;
}
</style>
