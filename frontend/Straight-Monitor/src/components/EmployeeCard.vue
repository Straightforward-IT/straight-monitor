<template>
  <article class="card" :data-expanded="expanded" :data-theme="effectiveTheme">
    <!-- Selection Checkbox (always visible in grid view) -->
    <div class="selection-overlay" @click.stop>
      <input 
        type="checkbox" 
        :checked="isSelected"
        @change="$emit('toggle-selection')"
        class="selection-checkbox"
      />
    </div>
    
    <!-- Header (togglable) -->
    <header
      class="card-header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <!-- Avatar & Title -->
      <div class="left">
        <!-- Initialen-Avatar als Fallback -->
        <div class="avatar" v-if="!photoUrl" :style="{ '--hue': avatarHue(ma) }">
          {{ initials(ma) }}
        </div>
        <img v-else class="avatar-img" :src="photoUrl" alt="" />

        <div class="title">
          <div class="name">{{ ma.vorname }} {{ ma.nachname }}</div>
          <div class="meta">
            <span class="pill" :class="ma.isActive ? 'ok' : 'muted'">
              <font-awesome-icon :icon="ma.isActive ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'" />
              {{ ma.isActive ? "Aktiv" : "Inaktiv" }}
            </span>

            <!-- Standort aus Flip (profile.location -> attributes.location -> fallback) -->
            <span class="pill" v-if="displayLocation">
              <font-awesome-icon icon="fa-solid fa-location-dot" />
              {{ displayLocation }}
            </span>

            <!-- Bereich aus Flip (profile.department -> attributes.department -> fallback) -->
            <span class="pill" v-if="displayDepartment">
              <font-awesome-icon icon="fa-solid fa-briefcase" />
              {{ displayDepartment }}
            </span>
          </div>
        </div>
      </div>

      <!-- Actions rechts angedockt -->
      <div class="card-actions" v-show="expanded" @click.stop>
        <!-- Straight Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Straight-Profil" :position="tooltipPosition" :delay-in="150">
            <button
              class="icon-btn"
              :class="{ active: view === 'straight' }"
              @click="view = 'straight'"
              :aria-pressed="view === 'straight'"
            >
              <img :src="straightLight" class="logo logo--light" alt="Straight Logo light" />
              <img :src="straightDark"  class="logo logo--dark"  alt="Straight Logo dark" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'straight' }"
            @click="view = 'straight'"
            :aria-pressed="view === 'straight'"
          >
            <img :src="straightLight" class="logo logo--light" alt="Straight Logo light" />
            <img :src="straightDark"  class="logo logo--dark"  alt="Straight Logo dark" />
          </button>
        </template>

        <!-- Flip Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Flip-Profil" :position="tooltipPosition" :delay-in="150">
            <button
              class="icon-btn"
              :class="{ active: view === 'flip' }"
              @click="view = 'flip'"
              :aria-pressed="view === 'flip'"
            >
              <img :src="flipLogo" alt="Flip Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'flip' }"
            @click="view = 'flip'"
            :aria-pressed="view === 'flip'"
          >
            <img :src="flipLogo" alt="Flip Logo" class="logo" />
          </button>
        </template>

        <!-- Asana Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Asana-Task" :position="tooltipPosition" :delay-in="150">
            <button
              class="icon-btn"
              :class="{ active: view === 'asana' }"
              @click="view = 'asana'"
              :aria-pressed="view === 'asana'"
            >
              <img :src="asanaLogo" alt="Asana Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'asana' }"
            @click="view = 'asana'"
            :aria-pressed="view === 'asana'"
          >
            <img :src="asanaLogo" alt="Asana Logo" class="logo" />
          </button>
        </template>

        <!-- Actions Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Aktionen" :position="tooltipPosition" :delay-in="150">
            <button
              class="icon-btn"
              @click="$emit('quick-actions', $event)"
            >
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            @click="$emit('quick-actions', $event)"
          >
            <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
          </button>
        </template>

        <button
          class="icon-btn chevron"
          :aria-label="expanded ? 'Zuklappen' : 'Aufklappen'"
          :aria-expanded="expanded"
          @click="toggle"
        >
          <font-awesome-icon :icon="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
        </button>
      </div>
    </header>

    <!-- Expandable body -->
    <transition name="expand">
      <div v-show="expanded" class="card-body">
        <!-- Straight View -->
        <section v-if="view === 'straight'" class="kv">
          <div>
            <dt>E-Mail</dt>
            <dd>{{ ma.email || "—" }}</dd>
          </div>
          <div>
            <dt>Standort</dt>
            <dd>{{ displayLocation || "—" }}</dd>
          </div>
          <div>
            <dt>Bereich</dt>
            <dd>{{ displayDepartment || "—" }}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{{ ma.isActive ? "Aktiv" : "Inaktiv" }}</dd>
          </div>
        </section>

        <!-- Flip View -->
        <section v-else-if="view === 'flip'" class="flip-view">
          <FlipProfile v-if="ma.flip" :flip-user="ma.flip" />
          <div v-else class="emptystate">
            <font-awesome-icon icon="fa-solid fa-plug-circle-xmark" />
            <p>Keine Flip-Verknüpfung vorhanden</p>
          </div>
        </section>

        <!-- Asana View -->
        <section v-else class="emptystate">
          <font-awesome-icon icon="fa-solid fa-clipboard-list" />
          <p>Asana-Verknüpfung/Task-Infos anzeigen.</p>
        </section>
      </div>
    </transition>

    <!-- Footer nur im expanded state -->
    <footer v-if="expanded" class="card-footer">
      <button class="btn btn-ghost" @click="$emit('edit', ma)">Bearbeiten</button>
    </footer>
  </article>
</template>
<script>
import { computed, ref, onMounted, onBeforeUnmount, watchEffect } from "vue";
import CustomTooltip from './CustomTooltip.vue';
import FlipProfile from './FlipProfile.vue';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useTheme } from "@/stores/theme";
import { useFlipAll } from '@/stores/flipAll'

// Assets importieren (Vite handled cache+preload)
import straightLight from "@/assets/SF_002.png";
import straightDark from "@/assets/SF_000.svg";
import flipLogo from "@/assets/flip.png";
import asanaLogo from "@/assets/asana.png";

export default {
  name: "EmployeeCard",
  components: { CustomTooltip, FontAwesomeIcon, FlipProfile },
  props: { 
    ma: { type: Object, required: true },
    initiallyExpanded: { type: Boolean, default: false },
    showCheckbox: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false }
  },
  emits: ['open', 'edit', 'toggle-selection', 'quick-actions'],

  setup(props) {
    const theme = useTheme(); // { current: 'light' | 'dark' | 'system' }

    // System-Theme live auslesen
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const systemDark = ref(media ? media.matches : false);
    const handleMedia = (e) => (systemDark.value = e.matches);
    onMounted(() => media && media.addEventListener?.("change", handleMedia));
    onBeforeUnmount(
      () => media && media.removeEventListener?.("change", handleMedia)
    );

    const effectiveTheme = computed(() => {
      if (theme.current === "system")
        return systemDark.value ? "dark" : "light";
      return theme.current || "light";
    });

    // Tooltips nur auf Desktop anzeigen
    const isMobile = ref(window.innerWidth <= 768);
    const showTooltips = computed(() => !isMobile.value);
    const tooltipPosition = computed(() => 'bottom'); // Immer bottom da nur auf Desktop
    
    const updateScreenSize = () => {
      isMobile.value = window.innerWidth <= 768;
    };
    
    onMounted(() => {
      window.addEventListener('resize', updateScreenSize);
    });
    
    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateScreenSize);
    });

     // Flip helpers (attributes als Array von {name,value})
    const getFlipAttr = (name) =>
      props.ma?.flip?.attributes?.find?.((a) => a?.name === name)?.value;

      const displayLocation = computed(() =>
      props.ma?.flip?.profile?.location ||
      getFlipAttr("location") ||
      props.ma?.standort ||
      ""
    );
     const displayDepartment = computed(() =>
      props.ma?.flip?.profile?.department ||
      getFlipAttr("department") ||
      props.ma?.abteilung ||
      ""
    );
    // FLip Profile Picture
    const flip = useFlipAll()
  const photoUrl = ref('')
  watchEffect(async () => {
    if(!flip.enablePhotos) {
      photoUrl.value = "";
      return;
    }
    const id = props.ma?.flip?.id
    photoUrl.value = id ? (await flip.ensurePhoto(id)) || '' : ''
  })
    // Logos via imports (Vite preloaded) – kein src-Swap → kein Flackern
    return {
       theme,
      effectiveTheme,
      showTooltips,
      tooltipPosition,
      straightLight,
      straightDark,
      flipLogo,
      asanaLogo,
      photoUrl,
      displayLocation,
      displayDepartment,
    };
  },

  data() {
    return { expanded: this.initiallyExpanded, view: "straight" };
  },

  methods: {
    toggle() {
      this.expanded = !this.expanded;

      if (this.expanded) {
        this.$emit("open", this.ma);
        console.log(this.ma);
      }
    },
    initials(ma) {
      const a = (ma?.vorname || "").trim()[0] || "";
      const b = (ma?.nachname || "").trim()[0] || "";
      return (a + b).toUpperCase() || "•";
    },
    avatarHue(ma) {
      const seed = (ma?._id || ma?.email || "")
        .split("")
        .reduce((s, c) => s + c.charCodeAt(0), 0);
      return seed % 360;
    },
  },
};
</script>

<style scoped lang="scss">
/* ---------- Card ---------- */
.card {
  position: relative; /* Positioning context for absolute elements */
  display: flex;
  flex-direction: column;
  background: var(--surface);
  /* stärkerer, klarer Border */
  border: 1px solid
    var(--border-strong, color-mix(in srgb, var(--border) 75%, var(--text) 10%));
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.18s ease, transform 0.12s ease,
    border-color 0.2s ease;
  overflow: hidden;
}
.card:hover {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}
.card:focus-within {
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
}

/* ---------- Header ---------- */
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 14px;
  background: var(--surface);
  cursor: pointer;
}

/* Linke Seite (Avatar + Titel) füllt, damit Actions rechts andocken */
.left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  background: hsl(var(--hue, 200), 80%, 45%);
  flex: 0 0 auto;
}
.avatar-img { width:44px; height:44px; border-radius:12px; object-fit:cover; flex:0 0 auto; }

.title {
  min-width: 0;
}
.title .name {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.title .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--text);
}
.pill.ok {
  background: #e8fbf3;
  color: #1f8e5d;
}
.pill.muted {
  background: #f1f3f6;
  color: var(--muted);
}

/* ---------- Actions rechts ---------- */
.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);
  transition: background 0.14s ease, color 0.14s ease, border-color 0.2s ease,
    box-shadow 0.2s ease, transform 0.08s ease;
}
.icon-btn:hover {
  background: var(--soft);
  color: var(--text);
}
.icon-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent);
}
.icon-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
  outline-offset: 2px;
}
.icon-btn.chevron {
  transform: rotate(0deg);
}
.card[data-expanded="true"] .icon-btn.chevron {
  transform: rotate(180deg);
}

/* Logos – NICHT src-swappen, nur zeigen/verstecken */
.icon-btn .logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
}
.icon-btn .logo--light {
  display: block;
}
.icon-btn .logo--dark {
  display: none;
}
.card[data-theme="dark"] .icon-btn .logo--light {
  display: none;
}
.card[data-theme="dark"] .icon-btn .logo--dark {
  display: block;
}

/* ---------- Body ---------- */
.card-body {
  padding: 16px;
  background: var(--surface);
}

/* Key-Value */
.kv {
  display: grid;
  gap: 10px;
}
.kv > div {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  align-items: center;
}
.kv dt {
  color: var(--muted);
  font-size: 12px;
}
.kv dd {
  color: var(--text);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Empty */
.emptystate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  opacity: 0.5;

  svg {
    font-size: 2rem;
  }
}

.flip-view {
  height: 100%;
  overflow: auto;
  padding: 1rem;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--vs-background);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--vs-border);
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb {
    background: var(--vs-border-hover);
  }
}

/* Footer – nur wenn expanded sichtbar */
.card-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

/* Buttons */
.btn {
  border: 1px solid var(--border);
  background: var(--primary);
  color: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: 0.14s ease;
}
.btn:hover {
  filter: brightness(0.96);
}
.btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
  outline-offset: 2px;
}
.btn.btn-ghost {
  background: var(--surface);
  color: var(--text);
}
.btn.btn-ghost:hover {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}

/* Expanded: volle Breite + 2 Spalten für Content */
.card[data-expanded="true"] {
  grid-column: 1 / -1;
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.card[data-expanded="true"] .card-body {
  display: grid;
  gap: 16px;
  grid-template-columns: 1.2fr 1fr;
}
/* Mobile Optimierungen */
@media (max-width: 768px) {
  /* Card Actions auf Mobile nach unten verschieben */
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}
  
  .left {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
  
  .title {
    flex: 1;
    min-width: 0;
  }
  
  .title .name {
    white-space: normal; /* Erlaube Zeilenumbruch auf Mobile */
    overflow: visible;
    text-overflow: unset;
    line-height: 1.3;
    word-break: break-word;
  }
  
  .card-actions {
    justify-content: center;
    margin-left: 0;
    order: 2;
    padding-top: 8px;
    border-top: 1px solid var(--border);
  }
  
  /* Avatar etwas kleiner auf Mobile */
  .avatar {
    width: 40px;
    height: 40px;
  }
  .avatar-img {
    width: 40px;
    height: 40px;
  }
  
  /* Icon Buttons kleiner und kompakter */
  .icon-btn {
    width: 36px;
    height: 36px;
  }
  
  /* KV-Pairs für Mobile optimieren */
  .kv > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  
  .kv dt {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  
  .kv dd {
    font-size: 14px;
    word-break: break-all; /* Erlaube Zeilenumbruch für E-Mails */
    margin-bottom: 12px;
    line-height: 1.4;
  }

/* Pills auf Mobile kleiner */
@media (max-width: 768px) {
  .title .meta {
    gap: 4px;
    margin-top: 6px;
  }
  
  .pill {
    font-size: 11px;
    padding: 3px 6px;
  }
}

/* Kleine Mobile Bildschirme - Buttons seitlich aber kompakter */
@media (max-width: 480px) {
  .card-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  
  .card-actions {
    flex-direction: column;
    gap: 4px;
    order: 0;
    margin-left: auto;
    border-top: none;
    padding-top: 0;
  }
  
  .icon-btn {
    width: 32px;
    height: 32px;
  }
  
  .left {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 900px) {
  .card[data-expanded="true"] .card-body {
    grid-template-columns: 1fr;
  }
}

/* Expand animation */
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.28s ease, opacity 0.2s ease;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 480px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .expand-enter-active,
  .expand-leave-active {
    transition: none;
  }
}

/* Selection and Quick Actions - Hidden by default, shown on hover */
.selection-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.2s ease;
  transform: translateY(-4px);
}

.card:hover .selection-overlay {
  opacity: 1;
  transform: translateY(0);
}

.selection-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--border);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  &:checked {
    background: var(--primary);
    border-color: var(--primary);
  }
  
  &:hover {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, white);
    transform: scale(1.1);
  }
}

/* Quick Actions jetzt in card-actions integriert - alte Position nicht mehr benötigt */
</style>
