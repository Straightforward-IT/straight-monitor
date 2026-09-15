<template>
  <MitarbeiterEinsatzortMapModal @close="close" />
</template>

<script setup>
import { useRouter } from 'vue-router';
import MitarbeiterEinsatzortMapModal from '@/components/Modals/MitarbeiterEinsatzortMapModal.vue';

const router = useRouter();

function close() {
  // Tools opens this route from within the app. Direct links still land on the
  // dashboard instead of navigating away from the application.
  if (window.history.state?.back) router.back();
  else router.replace('/dashboard');
}
</script>
