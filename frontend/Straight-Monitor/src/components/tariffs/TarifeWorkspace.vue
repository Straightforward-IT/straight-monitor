<template>
  <div class="tariff-workspace">
    <div v-if="!isAdmin || accessError" class="tariff-stack">
      <p role="alert">{{ accessError || 'Der Tarifbereich ist ausschließlich für Admins zugänglich.' }}</p>
      <AppButton v-if="isAdmin && accessError" variant="secondary" @click="accessError = ''">Zugriff erneut prüfen</AppButton>
    </div>
    <template v-else>
      <p class="tariff-intro">Tarifvertrag 17055 · Schreibgeschützte Tarifdaten aus Zvoove. Die Grundwertabfrage zeigt den tariflichen Wert; ÜTZ und weitere Regeln werden separat angezeigt.</p>
      <TariffOverview v-if="activeTab === 'overview'" :revision="revision" />
      <TariffEmployees v-else-if="activeTab === 'employees'" :revision="revision" />
      <TariffImport v-else-if="activeTab === 'import'" @activated="revision += 1" />
    </template>
  </div>
</template>

<script setup>
import { computed, provide, ref, watch } from 'vue';
import { useAuth } from '@/stores/auth';
import AppButton from '@/components/ui-elements/AppButton.vue';
import TariffOverview from './TariffOverview.vue';
import TariffEmployees from './TariffEmployees.vue';
import TariffImport from './TariffImport.vue';
import { TARIFF_ACCESS_DENIED } from './useTariffRequest';
import './tariffs.css';
defineProps({ activeTab: { type: String, default: 'overview' } });
const auth = useAuth();
const revision = ref(0);
const accessError = ref('');
const isAdmin = computed(() => [auth.user?.role, ...(Array.isArray(auth.user?.roles) ? auth.user.roles : [])].some((role) => String(role || '').toUpperCase() === 'ADMIN'));
provide(TARIFF_ACCESS_DENIED, (message) => { accessError.value = message; });
watch([isAdmin, () => auth.user], () => { accessError.value = ''; });
</script>
