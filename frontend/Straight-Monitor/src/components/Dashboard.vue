<template>
  <section class="dash">
    <header class="dash__head">
      <h4>Straight <span>Dashboard</span></h4>
      <p class="dash__user">Benutzer: {{ userName }}</p>
    </header>

    <!-- Deployment Update Modal -->
    <div
      v-if="false"
      class="update-modal-overlay"
      @click="closeModal"
    >
      <div class="update-modal" @click.stop>
        <div class="modal-header">
          <h2>🎉 Großes Monitor Update!</h2>
          <button class="close-btn" @click="closeModal" aria-label="Schließen">
            <font-awesome-icon :icon="['fas', 'times']" />
          </button>
        </div>

        <div class="modal-body">
          <p>Hey {{ userFirstName }}! 👋</p>

          <p>
            Es gibt ein großes Update für den Monitor! Die Oberfläche ist jetzt
            komplett überarbeitet und sollte viel benutzerfreundlicher sein.
          </p>

          <p>
            <strong>⚠️ Hinweis:</strong> Da das ein vollständiges Rework ist,
            könnte es zu Fehlern kommen. Falls ihr welche findet, nutzt gerne
            das neue
            <font-awesome-icon
              :icon="['fas', 'ticket-alt']"
              class="ticket-icon"
            />
            Ticket-Symbol für direktes Feedback! <br />
            <br />

            Einige Funktionen sind noch in Arbeit, wie z.B. eine zentrale
            Mitarbeiterverwaltung und Dokumentenablage.
          </p>

          <p>Ich hoffe, die neue Seite gefällt dir!</p>

          <p class="signature">LG Ceddy ❤️</p>
        </div>

        <div class="modal-footer">
          <button class="understand-btn" @click="closeModal">
            Verstanden! 👍
          </button>
        </div>
      </div>
    </div>

    <!-- Monitor 2.0 Section -->
    <section class="monitor-2-section">
      <div class="features-overview">
        <div class="feature-group">
          <h3 class="group-title">
            <font-awesome-icon :icon="['fas', 'check']" />
            Veröffentlichte Features
          </h3>
          <div class="feature-list">
            <div class="feature-item">
              <font-awesome-icon :icon="['fas', 'table']" />
              <span>Teamleiter Auswertung - Evaluierungen & Performance Verbesserungen</span>
            </div>
            <div class="feature-item">
              <font-awesome-icon :icon="['fas', 'file-alt']" />
              <span>Dokumente - Event-Reports & Evaluierungen</span>
            </div>
            <!-- Ältere Features (ausklappbar) -->
            <div class="older-features">
              <button
                class="older-features-toggle"
                @click="showOlderFeatures = !showOlderFeatures"
                :aria-expanded="showOlderFeatures"
              >
                <font-awesome-icon
                  :icon="[
                    'fas',
                    showOlderFeatures ? 'chevron-up' : 'chevron-down',
                  ]"
                />
                <span>{{
                  showOlderFeatures ? "Ausblenden" : "Ältere Features anzeigen"
                }}</span>
              </button>

              <transition name="expand">
                <div v-if="showOlderFeatures" class="older-features-list">
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'dice']" />
                    <span
                      >Verlosung - Dashboard für die Adventsverlosungen</span
                    >
                  </div>
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'envelope']" />
                    <span>Automatische Bewerber-Tasks aus E-Mails</span>
                  </div>
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'file-invoice']" />
                    <span>Lohnabrechnungen mit E-Mail-Versand</span>
                  </div>
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'ticket-alt']" />
                    <span>Support-Ticket-System</span>
                  </div>
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'moon']" />
                    <span>Dark-Mode</span>
                  </div>
                  <div class="feature-item">
                    <font-awesome-icon :icon="['fas', 'mobile-alt']" />
                    <span>Für Mobile Geräte Optimiert</span>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <div class="feature-group">
          <h3 class="group-title">
            <font-awesome-icon :icon="['fas', 'spinner']" />
            In Entwicklung
          </h3>
          <div class="feature-list">
            <div class="feature-item">
              <font-awesome-icon :icon="['fas', 'users']" />
              <span
                >Personal - Mitarbeiterverwaltung mit Asana/Flip
                Verknüpfung</span
              >
            </div>
            <div class="feature-item">
              <font-awesome-icon :icon="['fas', 'calendar-days']" />
              <span>Aufträge - Schichten, Jobs, Einsätze, in Kalender-Ansicht wie in L1</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <nav class="tiles">
      <!-- Bestand -->
      <RouterLink class="tile" :to="{ name: 'Bestand' }" aria-label="Bestand">
        <font-awesome-icon :icon="['fas', 'warehouse']" />
        <span>Bestand</span>
      </RouterLink>

      <!-- Verlauf -->
      <RouterLink class="tile" to="/verlauf" aria-label="Verlauf">
        <font-awesome-icon :icon="['fas', 'timeline']" />
        <span>Verlauf</span>
      </RouterLink>

      <!-- Dokumente -->
      <RouterLink class="tile" to="/dokumente" aria-label="Dokumente">
        <font-awesome-icon :icon="['fas', 'file-alt']" />
        <span>Dokumente</span>
      </RouterLink>

      <!-- Personal -->
      <RouterLink
        v-if="newPagesEnabled"
        class="tile"
        to="/personal"
        aria-label="Personal"
      >
        <font-awesome-icon :icon="['fas', 'people-line']" />
        <span>Personal</span>
      </RouterLink>

      <!-- Teamleiter Auswertung -->
      <RouterLink class="tile" to="/teamleiter-auswertung" aria-label="Teamleiter Auswertung">
        <font-awesome-icon :icon="['fas', 'table']" />
        <span>Teamleiter Auswertung</span>
      </RouterLink>

      <!-- Lohnabrechnungen -->
      <RouterLink
        class="tile"
        to="/lohnabrechnungen"
        aria-label="Lohnabrechnungen"
      >
        <font-awesome-icon :icon="['fas', 'file-invoice']" />
        <span>Lohnabrechnungen</span>
      </RouterLink>

      <!-- Benutzer erstellen (mit Flip-Badge) -->
      <RouterLink
        class="tile"
        to="/flip/benutzer-erstellen"
        aria-label="Benutzer erstellen"
      >
        <img src="@/assets/flip_sw.png" alt="" class="badge" />
        <font-awesome-icon :icon="['fas', 'user-plus']" />
        <span>User erstellen</span>
      </RouterLink>

      <!-- Austritte (mit Flip-Badge) -->
      <RouterLink class="tile" to="/flip/austritte" aria-label="Austritte">
        <img src="@/assets/flip_sw.png" alt="" class="badge" />
        <font-awesome-icon :icon="['fas', 'person-through-window']" />
        <span>Austritte</span>
      </RouterLink>
    </nav>
  </section>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import { useAuth } from "@/stores/auth";

const router = useRouter();
const auth = useAuth();
const userName = ref("…");
const userFirstName = ref("");

// Feature flag für neue Pages
const newPagesEnabled = computed(() => {
  return auth.user && auth.user.role === 'ADMIN';
});

// Update Modal State
const showUpdateModal = ref(false);
const COOKIE_NAME = "monitor_update_v2024_10_seen";

// Older Features Toggle
const showOlderFeatures = ref(false);
const TOKEN_VERSION_COOKIE = "monitor_token_version";
const COOKIE_EXPIRY_DAYS = 365; // 1 Jahr
const CURRENT_TOKEN_VERSION = "2024_10_v2"; // Neue Version für das Update

// Cookie Helper Functions
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

// Modal Functions
const closeModal = () => {
  showUpdateModal.value = false;
  // Set Cookie für 1 Jahr
  setCookie(COOKIE_NAME, "true", COOKIE_EXPIRY_DAYS);
};

const checkShowUpdateModal = () => {
  const hasSeenUpdate = getCookie(COOKIE_NAME);
  if (!hasSeenUpdate && userFirstName.value) {
    // Kleine Verzögerung für bessere UX
    setTimeout(() => {
      showUpdateModal.value = true;
    }, 1500);
  }
};

const checkTokenVersion = () => {
  const currentVersion = getCookie(TOKEN_VERSION_COOKIE);
  const token = localStorage.getItem("token");

  // Wenn kein Cookie existiert, aber ein Token da ist = Neuer Login
  // Dann setze einfach die aktuelle Version ohne Logout
  if (!currentVersion && token) {
    console.log("🆕 Neuer User Login erkannt - Token Version wird gesetzt");
    setCookie(TOKEN_VERSION_COOKIE, CURRENT_TOKEN_VERSION, COOKIE_EXPIRY_DAYS);
    return true;
  }

  // Nur bei vorhandenem Cookie aber falscher Version = Force Logout
  if (currentVersion && currentVersion !== CURRENT_TOKEN_VERSION) {
    console.log("🔄 Token Version veraltet - Logout erzwungen");
    localStorage.removeItem("token");
    setCookie(TOKEN_VERSION_COOKIE, CURRENT_TOKEN_VERSION, COOKIE_EXPIRY_DAYS);
    router.push("/login");
    return false;
  }

  return true;
};

onMounted(async () => {
  // Erst Token Version prüfen
  if (!checkTokenVersion()) {
    return;
  }

  try {
    const { data } = await api.get("/api/users/me");
    userName.value = data?.name || "";

    // Extrahiere Vornamen aus vollem Namen
    const fullName = data?.name || "";
    userFirstName.value = fullName.split(" ")[0] || "Team";

    // Zeige Update Modal wenn User-Daten geladen sind
    checkShowUpdateModal();
  } catch {
    router.push("/");
  }
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Layout */
.dash {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  color: #666;
}

/* Tiles Grid – responsive 2..6 Spalten, quadratisch */
.tiles {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.tile {
  position: relative; /* für das Eck-Badge */
  aspect-ratio: 1 / 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg);

  text-decoration: none;
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: transform 0.12s ease, box-shadow 0.12s ease,
    border-color 0.12s ease, background 0.12s ease;

  :deep(svg) {
    font-size: 28px;
    opacity: 0.9;
  }
  span {
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    line-height: 1.2;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, black 15%, var(--border));
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    background: var(--hover);
  }
}

/* Badge oben rechts – optional */
.badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  object-fit: contain;
  opacity: 0.55;
  pointer-events: none; /* Tile bleibt überall klickbar */
}

/* größere Kacheln auf großen Screens */
@media (min-width: 1400px) {
  .tiles {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .tile :deep(svg) {
    font-size: 32px;
  }
  .badge {
    width: 24px;
    height: 24px;
  }
}

/* Monitor 2.0 Section */
.monitor-2-section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  text-align: center;
  color: var(--text);
}

.features-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.feature-group {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.group-title svg {
  width: 16px;
  height: 16px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text);
}

.feature-item svg {
  width: 16px;
  height: 16px;
  color: var(--muted);
  flex-shrink: 0;
}

.feature-item span {
  line-height: 1.4;
}

/* Ältere Features Styles */
.older-features {
  margin-top: 12px;
  border-top: 1px solid rgba(128, 128, 128, 0.15);
  padding-top: 12px;
}

.older-features-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--hover);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  padding: 10px 16px;
  font-size: 13px;
  width: 100%;
  border-radius: 8px;
  transition: all 0.2s ease;
  font-weight: 500;
}

.older-features-toggle:hover {
  background: var(--tile-bg);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-1px);
}

.older-features-toggle:active {
  transform: translateY(0);
}

.older-features-toggle svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.older-features-list {
  margin-top: 12px;
  padding-top: 8px;
}

/* Expand/Collapse Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

/* ine-height: 1.4;
}

/* Mobile Optimierungen */
@media (max-width: 768px) {
  .dash {
    gap: 12px;
    padding: 12px;
  }

  /* Header kompakter */
  .dash__head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  h4 {
    font-size: 20px;
  }

  /* Monitor 2.0 Section mobile */
  .features-overview {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .monitor-2-section {
    padding: 16px 12px;
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 18px;
    margin-bottom: 16px;
  }

  .feature-group {
    padding: 12px;
  }

  .group-title {
    font-size: 14px;
    margin-bottom: 12px;
  }

  .feature-item {
    padding: 6px 0;
    font-size: 13px;
  }

  /* Tiles Grid mobile */
  .tiles {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }

  .tile {
    padding: 12px 8px;
  }

  .tile :deep(svg) {
    font-size: 24px;
  }

  .tile span {
    font-size: 12px;
    line-height: 1.1;
  }

  .badge {
    width: 18px;
    height: 18px;
    top: 4px;
    right: 4px;
  }
}

/* Extra kleine Screens */
@media (max-width: 480px) {
  .dash {
    padding: 8px;
  }

  .tiles {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .tile {
    padding: 10px 6px;
    min-height: 90px;
  }

  .monitor-2-section {
    padding: 12px 8px;
  }

  .feature-group {
    padding: 10px;
  }
}

/* Update Modal Styles */
.update-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

.update-modal {
  background: var(--tile-bg);
  color: var(--text);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: calc(100vw - 32px);
  max-height: calc(100vh - 64px);
  overflow: hidden;
  animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.close-btn:hover {
  background: var(--hover);
  color: var(--text);
  transform: scale(1.05);
}

.modal-body {
  padding: 20px 28px;
  line-height: 1.6;
}

.modal-body p {
  margin: 0 0 16px 0;
  color: var(--text);
}

.modal-body p:last-child {
  margin-bottom: 0;
}

.ticket-icon {
  color: var(--primary);
  margin: 0 2px;
}

.signature {
  font-style: italic;
  color: var(--primary) !important;
  font-weight: 600;
  text-align: center;
  margin-top: 20px !important;
}

.modal-footer {
  padding: 16px 28px 24px;
  display: flex;
  justify-content: center;
}

.understand-btn {
  background: linear-gradient(135deg, #007bff, #f97316);
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2),
    0 4px 15px rgba(249, 115, 22, 0.2);
}

.understand-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(249, 115, 22, 0.4);
  filter: brightness(1.05);
}

.understand-btn:active {
  transform: translateY(0);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Mobile Optimierungen für Modal */
@media (max-width: 480px) {
  .update-modal {
    width: calc(100vw - 16px);
    border-radius: 12px;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding-left: 20px;
    padding-right: 20px;
  }

  .modal-header h2 {
    font-size: 1.3rem;
  }

  .modal-body {
    font-size: 0.95rem;
  }

  .understand-btn {
    width: 100%;
    padding: 14px 24px;
  }
}
</style>
