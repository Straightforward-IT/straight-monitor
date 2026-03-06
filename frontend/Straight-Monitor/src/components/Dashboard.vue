<template>
  <section class="dash">
    <header class="dash__head">
      <h4>Straight <span>Dashboard</span></h4>
      <p class="dash__user">Benutzer: {{ userName }}</p>
    </header>

    <!-- Widget Grid -->
    <TransitionGroup
      name="widget-anim"
      tag="div"
      class="widget-grid"
    >
      <component
        v-for="w in activeWidgets"
        :key="w.id"
        :is="w.component"
      />

      <!-- Add / Configure tile – always last -->
      <button
        key="__add__"
        class="add-widget-tile"
        @click="showConfigurator = true"
        title="Dashboard anpassen"
      >
        <font-awesome-icon :icon="['fas', 'plus']" />
        <span>Anpassen</span>
      </button>
    </TransitionGroup>

    <!-- Widget Configurator -->
    <WidgetConfigurator
      :visible="showConfigurator"
      @close="showConfigurator = false"
    />
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import { useDashboardPrefs } from "@/stores/dashboardPrefs";
import WidgetConfigurator from "@/components/widgets/WidgetConfigurator.vue";

const router = useRouter();
const prefs = useDashboardPrefs();
const userName = ref("…");
const showConfigurator = ref(false);

const activeWidgets = computed(() => prefs.activeWidgets);

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
    const { data } = await api.get("/api/users/me");
    userName.value = data?.name || "";

    // Load widget preferences keyed by user id (backend prefs take priority)
    prefs.load(data?._id, data?.dashboardPrefs ?? null);
  } catch {
    router.push("/");
  }
});
</script>

<style scoped lang="scss">
/* ── Layout ──────────────────────────────────────── */
.dash {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dash__head {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

h4 {
  font-size: 24px;
  font-weight: 600;
  opacity: 0.9;
}
h4 span {
  font-weight: 700;
}
.dash__user {
  color: var(--muted);
  font-size: 14px;
  margin-top: 2px;
}

/* ── Widget Grid ─────────────────────────────────── */
.widget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

/* ── Add-widget tile (always last) ───────────────── */
.add-widget-tile {
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed var(--border);
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;

  :deep(svg) {
    font-size: 32px;
    opacity: 0.4;
    transition: opacity 0.2s ease;
  }

  span {
    font-size: 13px;
    font-weight: 500;
  }

  &:hover {
    border-color: var(--primary);
    color: var(--primary);

    :deep(svg) {
      opacity: 0.8;
    }
  }
}

/* ── TransitionGroup animations ──────────────────── */
.widget-anim-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.widget-anim-leave-active {
  transition: all 0.25s ease;
}
.widget-anim-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(8px);
}
.widget-anim-leave-to {
  opacity: 0;
  transform: scale(0.94);
}
.widget-anim-move {
  transition: transform 0.3s ease;
}

/* ── Responsive ──────────────────────────────────── */
@media (max-width: 768px) {
  .dash {
    gap: 14px;
  }

  .dash__head {
    flex-wrap: wrap;
  }

  .widget-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
}

@media (max-width: 480px) {
  .widget-grid {
    grid-template-columns: 1fr;
  }
}


</style>

