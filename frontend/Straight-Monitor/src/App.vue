<template>
  <main>
    <router-view />
  </main>
</template>

<script setup>
import { watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isFlipCreate = computed(() => route.name === "BenutzerErstellen");

// Dynamically update `#app` margin
const updateAppMargin = () => {
  const appDiv = document.getElementById("app");
  if (appDiv) {
    appDiv.style.margin = isFlipCreate.value ? "unset" : "";
  }
};

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
