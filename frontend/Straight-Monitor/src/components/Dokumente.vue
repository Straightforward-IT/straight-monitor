<template>
  <div class="dokumente-page">
    <!-- Document Management Section -->
    <div class="panel">
      <div class="controls">
        <div class="chips">
          <span class="chip-label">Status</span>
          <button
            class="chip"
            :class="{ active: activeDocStatusFilter === 'Alle' }"
            @click="setDocFilter('status', 'Alle')"
          >
            <font-awesome-icon icon="fa-solid fa-filter-circle-xmark" />
            Alle
          </button>
          <button
            class="chip"
            :class="{ active: activeDocStatusFilter === 'Zugewiesen' }"
            @click="setDocFilter('status', 'Zugewiesen')"
          >
            <font-awesome-icon icon="fa-solid fa-user-check" />
            Zugewiesen
          </button>
          <button
            class="chip"
            :class="{ active: activeDocStatusFilter === 'Offen' }"
            @click="setDocFilter('status', 'Offen')"
          >
            <font-awesome-icon icon="fa-regular fa-circle" />
            Offen
          </button>

          <span class="divider" />
          <span class="chip-label">Typ</span>
          <button
            class="chip"
            :class="{ active: activeDocTypeFilter === 'Alle' }"
            @click="setDocFilter('type', 'Alle')"
          >
            <font-awesome-icon icon="fa-solid fa-asterisk" />
            Alle
          </button>
          <button
            class="chip"
            :class="{ active: activeDocTypeFilter === 'Laufzettel' }"
            @click="setDocFilter('type', 'Laufzettel')"
          >
            <font-awesome-icon icon="fa-solid fa-list-check" />
            Laufzettel
          </button>
          <button
            class="chip"
            :class="{ active: activeDocTypeFilter === 'Event-Bericht' }"
            @click="setDocFilter('type', 'Event-Bericht')"
          >
            <font-awesome-icon icon="fa-solid fa-clipboard" />
            Event-Berichte
          </button>
          <button
            class="chip"
            :class="{ active: activeDocTypeFilter === 'Evaluierung' }"
            @click="setDocFilter('type', 'Evaluierung')"
          >
            <font-awesome-icon icon="fa-solid fa-pen-clip" />
            Evaluierungen
          </button>
        </div>

        <div class="search-sort">
          <div class="search">
            <font-awesome-icon
              icon="fa-solid fa-magnifying-glass"
              class="search-ic"
            />
            <input
              v-model="documentsSearchQuery"
              type="text"
              placeholder="Dokumente durchsuchen…"
              aria-label="Dokumente suchen"
            />
          </div>

          <div class="sort">
            <button class="btn-ghost" @click="toggleDocSort">
              <font-awesome-icon icon="fa-solid fa-arrow-up-wide-short" />
              Sortieren
            </button>
            <div
              v-if="showDocSort"
              class="menu"
              @click.outside="showDocSort = false"
            >
              <button @click="setDocumentsSort('datum')">Datum</button>
              <button @click="setDocumentsSort('docType')">Typ</button>
              <button @click="setDocumentsSort('bezeichnung')">
                Bezeichnung
              </button>
              <button class="sep" disabled />
              <button @click="documentsIsAscending = !documentsIsAscending">
                Richtung:
                {{ documentsIsAscending ? "Aufsteigend" : "Absteigend" }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading.documents" class="table skeleton">
        <div v-for="n in 5" :key="'row-' + n" class="row skel"></div>
      </div>

      <div v-else class="table">
        <div class="thead">
          <div>Typ</div>
          <div>Bezeichnung / Ort</div>
          <div>Datum</div>
          <div>Personen</div>
          <div>Status</div>
          <div>Aktionen</div>
        </div>
        <div
          v-for="doc in filteredDocumentsSorted"
          :key="doc.id || doc._id"
          class="row"
        >
          <div>
            <span
              :class="['tag', doc.docType ? doc.docType.toLowerCase() : '']"
            >
              {{ doc.docType || "—" }}
            </span>
          </div>
          <div class="truncate">{{ doc.bezeichnung || "—" }}</div>
          <div>{{ formatDate(doc.datum) }}</div>
          <div class="truncate">{{ doc.personen || "—" }}</div>
          <div>
            <span :class="['status', (doc.status || '').toLowerCase()]">
              {{ doc.status || "—" }}
            </span>
          </div>
          <div>
            <button class="btn btn-ghost" @click="openDoc(doc)">
              Details
            </button>
          </div>
        </div>

        <div v-if="filteredDocumentsSorted.length === 0" class="empty">
          <font-awesome-icon icon="fa-solid fa-face-meh-blank" />
          <p>Keine Dokumente gefunden.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

import {
  faMagnifyingGlass,
  faArrowUpWideShort,
  faFilterCircleXmark,
  faUserCheck,
  faAsterisk,
  faListCheck,
  faClipboard,
  faPenClip,
  faFaceMehBlank,
} from "@fortawesome/free-solid-svg-icons";
import { faCircle as faCircleRegular } from "@fortawesome/free-regular-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(
  faMagnifyingGlass,
  faArrowUpWideShort,
  faFilterCircleXmark,
  faUserCheck,
  faAsterisk,
  faListCheck,
  faClipboard,
  faPenClip,
  faFaceMehBlank,
  faCircleRegular
);

export default {
  name: "Dokumente",
  components: { FontAwesomeIcon },

  data() {
    return {
      // auth/user
      token: localStorage.getItem("token") || null,

      // state
      loading: { documents: true },
      error: { documents: null },

      // data sets
      documents: [],

      // filters and search
      activeDocStatusFilter: "Alle",
      activeDocTypeFilter: "Alle",
      documentsSearchQuery: "",
      documentsSortBy: "datum",
      documentsIsAscending: true,

      // ui
      showDocSort: false,
    };
  },

  computed: {
    filteredDocuments() {
      let result = this.documents || [];

      if (this.activeDocStatusFilter !== "Alle") {
        result = result.filter((d) => (d.status || "") === this.activeDocStatusFilter);
      }
      if (this.activeDocTypeFilter !== "Alle") {
        result = result.filter((d) => (d.docType || "") === this.activeDocTypeFilter);
      }

      const q = this.documentsSearchQuery.toLowerCase().trim();
      if (q) {
        result = result.filter((d) => {
          const v = [
            d.docType || "",
            d.bezeichnung || "",
            d.personen || "",
            this.formatDate(d.datum) || "",
          ]
            .join(" ")
            .toLowerCase();
          return v.includes(q);
        });
      }

      return result;
    },

    filteredDocumentsSorted() {
      const arr = [...this.filteredDocuments];
      const key = this.documentsSortBy;
      arr.sort((a, b) => {
        let av = a?.[key];
        let bv = b?.[key];

        if (key === "datum") {
          const ad = av ? new Date(av) : new Date(0);
          const bd = bv ? new Date(bv) : new Date(0);
          return this.documentsIsAscending ? ad - bd : bd - ad;
        }

        av = (av ?? "").toString().toLowerCase();
        bv = (bv ?? "").toString().toLowerCase();
        if (av < bv) return this.documentsIsAscending ? -1 : 1;
        if (av > bv) return this.documentsIsAscending ? 1 : -1;
        return 0;
      });
      return arr;
    },
  },

  methods: {
    formatDate(val) {
      if (!val) return "—";
      const d = new Date(val);
      if (isNaN(d)) return "—";
      return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },

    toggleDocSort() {
      this.showDocSort = !this.showDocSort;
    },

    setDocumentsSort(key) {
      this.documentsSortBy = key;
      this.showDocSort = false;
    },

    setDocFilter(type, value) {
      if (type === "status") this.activeDocStatusFilter = value;
      if (type === "type") this.activeDocTypeFilter = value;
    },

    openDoc(doc) {
      console.log("Open document:", doc?.id || doc?._id);
      // TODO: Implement document opening logic
    },

    /* -------------------- API wiring -------------------- */
    setAxiosAuthToken() {
      if (this.token) {
        api.defaults.headers.common["x-auth-token"] = this.token;
      }
    },

    async fetchDocuments() {
      try {
        const res = await api.get("/api/reports");
        this.documents = res.data?.data || [];
      } catch (e) {
        this.error.documents = e?.message || "Fehler beim Laden der Dokumente.";
        console.error(this.error.documents);
      } finally {
        this.loading.documents = false;
      }
    },
  },

  async mounted() {
    // 1) Token setzen
    this.setAxiosAuthToken();

    // 2) Dokumente laden
    await this.fetchDocuments();
  },
};
</script>

<style scoped lang="scss">
/* Tokens an globale Variablen anbinden */
.dokumente-page {
  --bg: var(--bg);
  --surface: var(--panel);
  --soft: var(--hover);
  --border: var(--border);
  --muted: var(--muted);
  --text: var(--text);
  --brand: var(--primary);
  --brand-ink: var(--primary);
  --ok: #21a26a;
  --warn: #f6a019;
  --bad: #e25555;
  --shadow: var(
    --shadow,
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.06)
  );
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  padding: 20px;
}

/* Controls */
.controls {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

/* Filter Chips */
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip-label {
  color: var(--muted);
  font-weight: 600;
  margin-right: 2px;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 12px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: 140ms ease;
}

.chip:hover {
  box-shadow: var(--shadow);
}

.chip.active {
  background: color-mix(in srgb, var(--brand) 12%, var(--surface));
  border-color: color-mix(in srgb, var(--brand) 35%, var(--border));
  color: var(--brand-ink);
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--border);
}

.search-sort {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 12px;
  align-items: center;
}

@media (max-width: 640px) {
  .search-sort {
    grid-template-columns: 1fr;
  }
}

.search {
  position: relative;
  
  input {
    width: 100%;
    padding: 12px 38px 12px 40px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    outline: none;
    transition: 140ms ease;
  }
  
  input:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 15%, transparent);
  }
  
  .search-ic {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
  }
}

.sort {
  position: relative;
  justify-self: end;
}

.btn-ghost {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: 140ms ease;
}

.btn-ghost:hover {
  box-shadow: var(--shadow);
}

.menu {
  position: absolute;
  right: 0;
  margin-top: 6px;
  min-width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 10;
  display: grid;
}

.menu button {
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 10px;
  border-radius: 10px;
  color: var(--text);
}

.menu button:hover {
  background: var(--soft);
}

.menu .sep {
  border-top: 1px dashed var(--border);
  margin: 4px 8px;
  height: 0;
}

/* Table Styles */
.table {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: clip;
}

.table .thead,
.table .row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 1.2fr 1.4fr 1.2fr auto;
  gap: 12px;
  align-items: center;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.table .thead {
  background: var(--soft);
  padding: 10px 14px;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.table .row {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.table .row:nth-child(odd) {
  background: color-mix(in srgb, var(--surface) 92%, var(--bg));
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand) 12%, var(--surface));
  color: var(--brand-ink);
}

.tag.laufzettel {
  background: #e9f8ff;
  color: #1976d2;
}

.tag.event-bericht {
  background: #fff0ea;
  color: #d55a1f;
}

.tag.evaluierung {
  background: #eaf8f0;
  color: #1e8e57;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--muted);
}

.status.zugewiesen {
  background: #e9f8ff;
  color: #1976d2;
}

.status.offen {
  background: #fff7e6;
  color: #b46c00;
}

/* Skeleton */
.table.skeleton {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.table.skeleton .skel {
  height: 60px;
  background: var(--soft);
  border-bottom: 1px solid var(--border);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { 
    opacity: 1; 
  }
  50% { 
    opacity: 0.5; 
  }
}

/* Empty state */
.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
}

.empty svg {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty p {
  font-size: 16px;
  margin: 0;
}

.btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: 140ms ease;
}

.btn:hover {
  background: var(--soft);
}
</style>