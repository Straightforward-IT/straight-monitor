<template>
  <RouterPageLayout
    :tabs="visibleDashboardTabs"
    default-tab="widgets"
    aria-label="Dashboardbereiche"
    width="full"
    content-variant="surface"
  >
    <template #header>
      <div class="dash__head">
        <h1 data-page-title="Dashboard">Straight <span>Dashboard</span></h1>
      </div>
    </template>

    <template #default="{ activeTab }">
      <DashboardOverviewTab v-if="activeTab === 'widgets'" :active-widgets="activeWidgets" />
    </template>
  </RouterPageLayout>
</template>

<script setup>
import { onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useDashboardPrefs } from "@/stores/dashboardPrefs";
import { useAuth } from "@/stores/auth";
import RouterPageLayout from "@/components/layout/RouterPageLayout.vue";
import { dashboardTabs } from '@/components/layout/pageTabDefinitions';
import DashboardOverviewTab from '@/components/DashboardOverviewTab.vue';

const router = useRouter();
const prefs = useDashboardPrefs();
const auth = useAuth();

const activeWidgets = computed(() => prefs.activeWidgets);
const visibleDashboardTabs = computed(() => dashboardTabs.filter((tab) => tab.id !== 'spaces'));

/* ── Token Version Check ─────────────────────────── */
const TOKEN_VERSION_COOKIE = "monitor_token_version";
const COOKIE_EXPIRY_DAYS = 365;
const CURRENT_TOKEN_VERSION = "2024_10_v2";

const setCookie = (name, value, days) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const checkTokenVersion = () => {
  const currentVersion = getCookie(TOKEN_VERSION_COOKIE);
  const token = localStorage.getItem("token");

  if (!currentVersion && token) {
    setCookie(TOKEN_VERSION_COOKIE, CURRENT_TOKEN_VERSION, COOKIE_EXPIRY_DAYS);
    return true;
  }

  if (currentVersion && currentVersion !== CURRENT_TOKEN_VERSION) {
    localStorage.removeItem("token");
    setCookie(TOKEN_VERSION_COOKIE, CURRENT_TOKEN_VERSION, COOKIE_EXPIRY_DAYS);
    router.push("/login");
    return false;
  }

  return true;
};

/* ── Lifecycle ───────────────────────────────────── */
onMounted(async () => {
  if (!checkTokenVersion()) return;

  try {
    const data = auth.user || await auth.fetchMe();

    // Load widget preferences keyed by user id (backend prefs take priority)
    prefs.load(data?._id, data?.dashboardPrefs ?? null, data?.roles ?? []);
  } catch {
    router.push("/");
  }
});
</script>

<style scoped lang="scss">
.dash__head h1 {
  font-size: 24px;
  font-weight: 600;
  opacity: 0.9;
}
.dash__head h1 span {
  font-weight: 700;
}
</style>
