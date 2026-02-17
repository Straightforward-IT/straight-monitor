<template>
  <main>
    <router-view />
  </main>
</template>

<script setup>
import { watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { getTheme } from "@getflip/bridge";

const route = useRoute();
const isFlipCreate = computed(() => route.name === "BenutzerErstellen");
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
const syncTheme = () => {
  try {
    const theme = getTheme(); // 'light' oder 'dark'
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {
    console.warn("Flip theme detection failed", e);
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
