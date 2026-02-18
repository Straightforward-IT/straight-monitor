<template>
  <main>
    <router-view />
  </main>
</template>

<script setup>
import { watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { getTheme, initFlipBridge, subscribe, BridgeEventType } from "@getflip/bridge";

const route = useRoute();
const isFlipCreate = computed(() => route.name === "BenutzerErstellen");
// Make sure to match the route name, kept 'PublicEinsaetze' in router.js for now, but component Changed
const isPublicEinsaetze = computed(() => route.name === "PublicEinsaetze");

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
      console.log(`🎨 Initial theme: ${theme.activeTheme}`);
    }
    
    // Theme changes abonnieren
    themeUnsubscribe = await subscribe(BridgeEventType.THEME_CHANGE, (event) => {
      if (event?.data?.activeTheme) {
        document.documentElement.setAttribute("data-theme", event.data.activeTheme);
        console.log(`🎨 Theme changed to: ${event.data.activeTheme}`);
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
