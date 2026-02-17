<template>
  <main>
    <router-view />
  </main>
</template>

<script setup>
import { watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { getTheme, initFlipBridge } from "@getflip/bridge";

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

// Theme setzen basierend auf Flip Bridge
const syncTheme = async () => {
  try {
    // Versuchen, die Bridge zu initialisieren
    // hostAppOrigin: '*' erlaubt Kommunikation mit beliebigen Origins (für Tests/Dev hilfreich),
    // in Prod wäre die spezifische Flip-Origin besser, aber '*' funktioniert oft.
    initFlipBridge({ hostAppOrigin: '*' });
    
    // Nach Init: Theme abfragen
    const theme = await getTheme(); // 'light' oder 'dark'
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {
    // Fehler abfangen: Wahrscheinlich laufen wir nicht im Flip IFrame
    console.warn("Flip Bridge init failed (running outside Flip?):", e);
    // Hier könnte man einen Fallback setzen, z.B. force light mode
    // document.documentElement.setAttribute("data-theme", "light");
  }
};

onMounted(() => {
  updateAppMargin();
  syncTheme();
});

// Watch for route changes
watch(route, () => {
  document.title = isFlipCreate.value
    ? "Benutzer Erstellen - Straight Monitor"
    : "Straight Monitor";

  updateAppMargin();
  syncTheme();
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
