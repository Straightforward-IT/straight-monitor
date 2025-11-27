<template>
  <div class="dokumente-page">
    <!-- Document Management Section -->
    <div class="panel">
      <div class="controls">
        <div class="filter-chips">
          <div class="chip-group">
            <span class="chip-label">Status</span>
            <div class="chips">
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
            </div>
          </div>

          <span class="divider" />
          
          <div class="chip-group">
            <span class="chip-label">Standort</span>
            <div class="chips">
              <button
                class="chip"
                :class="{ active: activeDocLocationFilter === 'Alle' }"
                @click="setDocFilter('location', 'Alle')"
              >
                <font-awesome-icon icon="fa-solid fa-earth-europe" />
                Alle
              </button>
              <button
                v-for="loc in locations"
                :key="loc"
                class="chip"
                :class="{ active: activeDocLocationFilter === loc }"
                @click="setDocFilter('location', loc)"
              >
                <font-awesome-icon icon="fa-solid fa-location-dot" />
                {{ loc }}
              </button>
            </div>
          </div>

          <span class="divider" />
          
          <div class="chip-group">
            <span class="chip-label">Typ</span>
            <div class="chips">
              <button
                class="chip"
                :class="{ active: activeDocTypeFilters.includes('Laufzettel') }"
                @click="toggleDocTypeFilter('Laufzettel')"
              >
                <font-awesome-icon icon="fa-solid fa-list-check" />
                Laufzettel
              </button>
              <button
                class="chip"
                :class="{ active: activeDocTypeFilters.includes('Event-Bericht') }"
                @click="toggleDocTypeFilter('Event-Bericht')"
              >
                <font-awesome-icon icon="fa-solid fa-clipboard" />
                Event Report
              </button>
              <button
                class="chip"
                :class="{ active: activeDocTypeFilters.includes('Evaluierung') }"
                @click="toggleDocTypeFilter('Evaluierung')"
              >
                <font-awesome-icon icon="fa-solid fa-pen-clip" />
                Evaluierung
              </button>
            </div>
          </div>
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

          <!-- Pagination Controls -->
          <div v-if="!loading.documents && filteredDocumentsSorted.length > 0" class="pagination-compact">
            <div class="pagination-info-compact">
              <span class="pagination-text">{{ paginationInfo.start }}-{{ paginationInfo.end }} von {{ paginationInfo.total }}</span>
              
              <select 
                v-model="itemsPerPage" 
                @change="setItemsPerPage(Number($event.target.value))"
                class="pagination-select-compact"
              >
                <option v-for="size in pageOptions" :key="size" :value="size">
                  {{ size }}
                </option>
              </select>
            </div>
            
            <div class="pagination-controls-compact" v-if="totalPages > 1">
              <button 
                class="pagination-btn-compact" 
                :disabled="currentPage === 1" 
                @click="prevPage"
                title="Vorherige Seite"
              >
                <font-awesome-icon icon="fa-solid fa-chevron-left" />
              </button>
              
              <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
              
              <button 
                class="pagination-btn-compact" 
                :disabled="currentPage === totalPages" 
                @click="nextPage"
                title="Nächste Seite"
              >
                <font-awesome-icon icon="fa-solid fa-chevron-right" />
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
          <div @click="handleSort('docType')" class="sortable">
            Typ
            <font-awesome-icon v-if="sortKey === 'docType'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('bezeichnung')" class="sortable">
            Bezeichnung / Ort
            <font-awesome-icon v-if="sortKey === 'bezeichnung'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('datum')" class="sortable">
            Datum
            <font-awesome-icon v-if="sortKey === 'datum'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('teamleiter')" class="sortable">
            Teamleiter
            <font-awesome-icon v-if="sortKey === 'teamleiter'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('mitarbeiter')" class="sortable">
            Mitarbeiter
            <font-awesome-icon v-if="sortKey === 'mitarbeiter'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('status')" class="sortable">
            Status
            <font-awesome-icon v-if="sortKey === 'status'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div>Aktionen</div>
        </div>
        <div
          v-for="doc in paginatedDocuments"
          :key="doc.id || doc._id"
          class="row clickable-row"
          @click="openDoc(doc)"
        >
          <div>
            <span
              :class="['tag', doc.docType ? doc.docType.toLowerCase().replace(' ', '-') : '']"
            >
              {{ doc.docType || "—" }}
            </span>
          </div>
          <div class="truncate">{{ doc.bezeichnung || "—" }}</div>
          <div>{{ formatDate(doc.datum) }}</div>
          <div class="truncate person-cell">
            <CustomTooltip v-if="doc.details?.name_teamleiter" :text="getPersonTooltip(doc.details.name_teamleiter, 'teamleiter')" position="bottom" :delay-in="150" teleportToBody>
              <button class="link-btn" @click.stop="filterByTeamleiter(doc.details.name_teamleiter)">
                {{ doc.details.name_teamleiter }}
              </button>
            </CustomTooltip>
            <span v-if="!doc.details?.name_teamleiter">—</span>
          </div>
          <div class="truncate person-cell">
            <CustomTooltip v-if="doc.details?.name_mitarbeiter" :text="getPersonTooltip(doc.details.name_mitarbeiter, 'mitarbeiter')" position="bottom" :delay-in="150" teleportToBody>
              <button class="link-btn" @click.stop="filterByMitarbeiter(doc.details.name_mitarbeiter)">
                {{ doc.details.name_mitarbeiter }}
              </button>
            </CustomTooltip>
            <span v-if="!doc.details?.name_mitarbeiter">—</span>
          </div>
          <div>
            <span :class="['status', (doc.status || '').toLowerCase()]">
              {{ doc.status || "—" }}
            </span>
          </div>
          <div class="actions-col" @click.stop>
            <button class="btn-icon" @click="toggleQuickActions(doc.id || doc._id)">
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
            <div v-if="activeQuickActionId === (doc.id || doc._id)" class="quick-actions-menu">
              <button @click="openDoc(doc)">
                <font-awesome-icon icon="fa-solid fa-magnifying-glass" /> Details
              </button>
              <button 
                v-if="doc.details?.name_teamleiter && personDetails[doc.details.name_teamleiter]?.asana_id" 
                @click="openAsanaTask(doc.details.name_teamleiter, $event)"
              >
                <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Teamleiter Task
              </button>
              <button 
                v-if="doc.details?.name_mitarbeiter && doc.docType !== 'Event-Bericht' && personDetails[doc.details.name_mitarbeiter]?.asana_id" 
                @click="openAsanaTask(doc.details.name_mitarbeiter, $event)"
              >
                <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Mitarbeiter Task
              </button>
            </div>
          </div>
        </div>

        <div v-if="filteredDocumentsSorted.length === 0" class="empty">
          <font-awesome-icon icon="fa-solid fa-face-meh-blank" />
          <p>Keine Dokumente gefunden.</p>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedDoc" class="modal-overlay" @click.self="closeDoc">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ selectedDoc.docType }} Details</h3>
          <button class="close-btn" @click="closeDoc">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <label>Bezeichnung / Ort</label>
              <p>{{ selectedDoc.bezeichnung }}</p>
            </div>
            <div class="detail-item">
              <label>Datum</label>
              <p>{{ formatDate(selectedDoc.datum) }}</p>
            </div>
            <div class="detail-item">
              <label>Status</label>
              <span :class="['status', (selectedDoc.status || '').toLowerCase()]">
                {{ selectedDoc.status }}
              </span>
            </div>
            <div class="detail-item">
              <label>Teamleiter</label>
              <div v-if="selectedDoc.details?.name_teamleiter" class="person-detail">
                <CustomTooltip :text="getPersonTooltip(selectedDoc.details.name_teamleiter, 'teamleiter')" position="bottom" :delay-in="150" teleportToBody>
                  <button class="link-btn" @click="filterByTeamleiter(selectedDoc.details.name_teamleiter)">
                    {{ selectedDoc.details.name_teamleiter }}
                  </button>
                </CustomTooltip>
              </div>
              <button v-else class="btn btn-sm btn-primary" @click="demoAssign('teamleiter')">
                <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
              </button>
            </div>
            <div class="detail-item" v-if="selectedDoc.docType !== 'Event-Bericht'">
              <label>Mitarbeiter</label>
              <div v-if="selectedDoc.details?.name_mitarbeiter" class="person-detail">
                <CustomTooltip :text="getPersonTooltip(selectedDoc.details.name_mitarbeiter, 'mitarbeiter')" position="bottom" :delay-in="150" teleportToBody>
                  <button class="link-btn" @click="filterByMitarbeiter(selectedDoc.details.name_mitarbeiter)">
                    {{ selectedDoc.details.name_mitarbeiter }}
                  </button>
                </CustomTooltip>
              </div>
              <button v-else class="btn btn-sm btn-primary" @click="demoAssign('mitarbeiter')">
                <font-awesome-icon icon="fa-solid fa-link" /> Zuweisen
              </button>
            </div>
          </div>

          <div class="raw-data">
            <h4>Details</h4>
            <div class="key-value-list">
              <div v-for="(value, key) in selectedDoc.details" :key="key" class="kv-item">
                <template v-if="!['_id', '__v', 'mitarbeiter', 'teamleiter', 'laufzettel', 'task_id', 'mitarbeiter_anzahl'].includes(key)">
                  <span class="key">{{ formatKey(key) }}:</span>
                  <span class="value">{{ formatValue(key, value) }}</span>
                </template>
              </div>
              <div v-if="selectedDoc.details?.mitarbeiter_anzahl" class="kv-item">
                <span class="key">Mitarbeiter Anzahl:</span>
                <span class="value">{{ selectedDoc.details.mitarbeiter_anzahl }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <div class="actions-left">
            <button 
              v-if="selectedDoc.details?.name_teamleiter && personDetails[selectedDoc.details.name_teamleiter]?.asana_id" 
              class="btn btn-sm"
              @click="openAsanaTask(selectedDoc.details.name_teamleiter, $event)"
            >
              <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Teamleiter Task
            </button>
            <button 
              v-if="selectedDoc.details?.name_mitarbeiter && selectedDoc.docType !== 'Event-Bericht' && personDetails[selectedDoc.details.name_mitarbeiter]?.asana_id" 
              class="btn btn-sm"
              @click="openAsanaTask(selectedDoc.details.name_mitarbeiter, $event)"
            >
              <img :src="asanaLogo" alt="Asana" class="asana-icon" /> Mitarbeiter Task
            </button>
          </div>
          <button class="btn" @click="closeDoc">Schließen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import CustomTooltip from './CustomTooltip.vue';
import asanaLogo from '@/assets/asana.png';

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
  faXmark,
  faChevronUp,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faSort,
  faLink,
  faUnlink,
  faLocationDot,
  faEarthEurope,
  faEllipsisVertical,
  faExternalLink
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
  faCircleRegular,
  faXmark,
  faChevronUp,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faSort,
  faLink,
  faUnlink,
  faLocationDot,
  faEarthEurope,
  faEllipsisVertical,
  faExternalLink
);

export default {
  name: "Dokumente",
  components: { FontAwesomeIcon, CustomTooltip },

  data() {
    return {
      // assets
      asanaLogo,
      
      // auth/user
      token: localStorage.getItem("token") || null,
      userLocation: "",

      // state
      loading: { documents: true },
      error: { documents: null },

      // data sets
      documents: [],
      locations: ["Hamburg", "Berlin", "Köln"],

      // filters and search
      activeDocStatusFilter: "Alle",
      activeDocTypeFilters: ["Event-Bericht", "Evaluierung"],
      activeDocLocationFilter: "Alle",
      filteredTeamleiter: null,
      filteredMitarbeiter: null,
      documentsSearchQuery: "",
      
      // sorting
      sortKey: 'datum',
      sortOrder: 'desc',

      // pagination
      currentPage: 1,
      itemsPerPage: 100,
      pageOptions: [25, 50, 100],

      // ui
      selectedDoc: null,
      activeQuickActionId: null,
      
      // person details cache (for Asana links)
      personDetails: {},
    };
  },

  computed: {
    filteredDocuments() {
      let result = this.documents || [];

      if (this.activeDocStatusFilter !== "Alle") {
        result = result.filter((d) => (d.status || "") === this.activeDocStatusFilter);
      }
      if (this.activeDocTypeFilters.length > 0) {
        result = result.filter((d) => this.activeDocTypeFilters.includes(d.docType || ""));
      }
      if (this.activeDocLocationFilter !== "Alle") {
        result = result.filter((d) => {
          const loc = d.details?.location || d.bezeichnung || "";
          return loc === this.activeDocLocationFilter;
        });
      }

      if (this.filteredTeamleiter) {
        result = result.filter((d) => (d.details?.name_teamleiter || "") === this.filteredTeamleiter);
      }

      if (this.filteredMitarbeiter) {
        result = result.filter((d) => (d.details?.name_mitarbeiter || "") === this.filteredMitarbeiter);
      }

      const q = this.documentsSearchQuery.toLowerCase().trim();
      if (q) {
        result = result.filter((d) => {
          const v = [
            d.docType || "",
            d.bezeichnung || "",
            d.details?.name_teamleiter || "",
            d.details?.name_mitarbeiter || "",
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
      
      arr.sort((a, b) => {
        let valA = this.getSortValue(a, this.sortKey);
        let valB = this.getSortValue(b, this.sortKey);
        
        if (valA < valB) return this.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      return arr;
    },

    paginatedDocuments() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredDocumentsSorted.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredDocumentsSorted.length / this.itemsPerPage);
    },

    paginationInfo() {
      const start = (this.currentPage - 1) * this.itemsPerPage + 1;
      const end = Math.min(this.currentPage * this.itemsPerPage, this.filteredDocumentsSorted.length);
      return {
        start,
        end,
        total: this.filteredDocumentsSorted.length
      };
    },
  },

  watch: {
    documentsSearchQuery() {
      this.currentPage = 1;
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
    
    formatKey(key) {
      if (!key) return '';
      // Replace underscores with spaces and capitalize first letter
      return key
        .replace(/_/g, ' ')
        .replace(/^./, str => str.toUpperCase());
    },

    formatValue(key, value) {
      if (!value) return '—';
      if (typeof key === 'string' && (key.toLowerCase().includes('datum') || key.toLowerCase().includes('date'))) {
        return this.formatDate(value);
      }
      return value;
    },

    handleSort(key) {
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortOrder = 'desc'; // Default to newest/descending
      }
    },
    
    getSortValue(doc, key) {
      if (key === 'datum') return new Date(doc.datum).getTime();
      if (key === 'teamleiter') return (doc.details?.name_teamleiter || '').toLowerCase();
      if (key === 'mitarbeiter') return (doc.details?.name_mitarbeiter || '').toLowerCase();
      if (key === 'docType') return (doc.docType || '').toLowerCase();
      if (key === 'bezeichnung') return (doc.bezeichnung || '').toLowerCase();
      if (key === 'status') return (doc.status || '').toLowerCase();
      return '';
    },

    setDocFilter(type, value) {
      if (type === "status") this.activeDocStatusFilter = value;
      if (type === "location") this.activeDocLocationFilter = value;
      this.currentPage = 1;
    },

    toggleDocTypeFilter(type) {
      const idx = this.activeDocTypeFilters.indexOf(type);
      if (idx > -1) {
        this.activeDocTypeFilters.splice(idx, 1);
      } else {
        this.activeDocTypeFilters.push(type);
      }
      this.currentPage = 1;
    },

    filterByTeamleiter(name) {
      if (this.filteredTeamleiter === name) {
        this.filteredTeamleiter = null;
      } else {
        this.filteredTeamleiter = name;
        this.filteredMitarbeiter = null;
      }
      this.currentPage = 1;
      this.closeDoc();
    },

    filterByMitarbeiter(name) {
      if (this.filteredMitarbeiter === name) {
        this.filteredMitarbeiter = null;
      } else {
        this.filteredMitarbeiter = name;
        this.filteredTeamleiter = null;
      }
      this.currentPage = 1;
      this.closeDoc();
    },

    async fetchPersonDetails(name) {
      if (!name || this.personDetails[name]) return this.personDetails[name];
      
      try {
        const response = await api.get(`/api/personal/mitarbeiter/by-name/${encodeURIComponent(name)}`);
        if (response.data?.success && response.data?.data) {
          this.personDetails[name] = response.data.data;
          return response.data.data;
        }
      } catch (error) {
        console.warn(`Could not fetch details for ${name}:`, error.message);
      }
      return null;
    },

    async openAsanaTask(name, event) {
      event.stopPropagation();
      event.preventDefault();
      
      const person = await this.fetchPersonDetails(name);
      if (person?.asana_id) {
        const asanaWebUrl = `https://app.asana.com/0/0/${person.asana_id}`;
        window.open(asanaWebUrl, '_blank');
      } else {
        console.warn(`No Asana ID found for ${name}`);
      }
    },

    async fetchPersonDetails(name) {
      if (!name || this.personDetails[name]) return this.personDetails[name];
      
      try {
        const response = await api.get(`/api/personal/mitarbeiter/by-name/${encodeURIComponent(name)}`);
        if (response.data?.success && response.data?.data) {
          this.personDetails[name] = response.data.data;
          return response.data.data;
        }
      } catch (error) {
        console.warn(`Could not fetch details for ${name}:`, error.message);
      }
      return null;
    },

    async openAsanaTask(name, event) {
      event.stopPropagation();
      event.preventDefault();
      
      const person = await this.fetchPersonDetails(name);
      if (person?.asana_id) {
        const asanaWebUrl = `https://app.asana.com/0/0/${person.asana_id}`;
        window.open(asanaWebUrl, '_blank');
      } else {
        console.warn(`No Asana ID found for ${name}`);
      }
    },

    async fetchPersonDetails(name) {
      if (!name || this.personDetails[name]) return this.personDetails[name];
      
      try {
        const response = await api.get(`/api/personal/mitarbeiter/by-name/${encodeURIComponent(name)}`);
        if (response.data?.success && response.data?.data) {
          this.personDetails[name] = response.data.data;
          return response.data.data;
        }
      } catch (error) {
        console.warn(`Could not fetch details for ${name}:`, error.message);
      }
      return null;
    },

    async openAsanaTask(name, event) {
      event.stopPropagation();
      event.preventDefault();
      
      const person = await this.fetchPersonDetails(name);
      if (person?.asana_id) {
        const asanaWebUrl = `https://app.asana.com/0/0/${person.asana_id}`;
        window.open(asanaWebUrl, '_blank');
      } else {
        console.warn(`No Asana ID found for ${name}`);
      }
    },

    getPersonTooltip(name, role) {
      const isFiltered = role === 'teamleiter' 
        ? this.filteredTeamleiter === name 
        : this.filteredMitarbeiter === name;
      
      return isFiltered 
        ? `Filter zurücksetzen` 
        : `Filtern auf ${name}`;
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },

    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },

    setItemsPerPage(count) {
      this.itemsPerPage = count;
      this.currentPage = 1;
    },

    async openDoc(doc) {
      this.selectedDoc = doc;
      this.activeQuickActionId = null;
      
      // Fetch person details when opening document
      if (doc.details?.name_teamleiter) {
        await this.fetchPersonDetails(doc.details.name_teamleiter);
      }
      if (doc.details?.name_mitarbeiter) {
        await this.fetchPersonDetails(doc.details.name_mitarbeiter);
      }
    },

    closeDoc() {
      this.selectedDoc = null;
    },
    
    toggleQuickActions(id) {
      if (this.activeQuickActionId === id) {
        this.activeQuickActionId = null;
      } else {
        this.activeQuickActionId = id;
      }
    },

    handleClickOutside(event) {
      // Close menu if clicking outside
      if (this.activeQuickActionId && !event.target.closest('.actions-col')) {
        this.activeQuickActionId = null;
      }
    },
    
    demoAssign(role) {
      alert(`Demo: Zuweisen Dialog für ${role} würde sich öffnen.`);
    },

    /* -------------------- API wiring -------------------- */
    setAxiosAuthToken() {
      if (this.token) {
        api.defaults.headers.common["x-auth-token"] = this.token;
      }
    },

    async fetchUserData() {
      if (!this.token) return;
      try {
        const { data } = await api.get("/api/users/me");
        this.userLocation = data.location;
        
        // Setze userLocation als Standard für Location-Filter, falls verfügbar
        if (this.userLocation && this.locations.includes(this.userLocation)) {
          this.activeDocLocationFilter = this.userLocation;
        }
      } catch (e) {
        console.error("Fehler beim Abrufen der Benutzerdaten:", e);
      }
    },

    async fetchDocuments() {
      try {
        const res = await api.get("/api/wordpress/reports");
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

    // 2) User Daten & Dokumente laden
    await Promise.all([
      this.fetchUserData(),
      this.fetchDocuments()
    ]);

    document.addEventListener('click', this.handleClickOutside);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
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
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  background: var(--soft);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.chip-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  transition: all 200ms ease;
  position: relative;
}

.chip-group:hover {
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
  border-color: color-mix(in srgb, var(--brand) 30%, var(--border));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 10%, transparent);
}

.chip-group::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--brand);
  border-radius: 2px 0 0 2px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.chip-group:hover::before {
  opacity: 0.6;
}

.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip-label {
  color: var(--brand);
  font-weight: 700;
  margin-right: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 0;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 13px;
  font-weight: 500;
}

.chip:hover {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}

.chip.active {
  background: transparent;
  border-color: var(--brand);
  color: var(--brand);
  box-shadow: inset 0 0 0 1px var(--brand);
  font-weight: 600;
}

.divider {
  width: 2px;
  height: 32px;
  background: linear-gradient(to bottom, 
    transparent 0%,
    var(--border) 20%,
    var(--border) 80%,
    transparent 100%);
  border-radius: 1px;
  margin: 0 4px;
}

.search-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 640px) {
  .search-sort {
    flex-direction: column;
    align-items: stretch;
  }
}

.search {
  position: relative;
  flex: 1 1 280px;
  
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
  grid-template-columns: 1.2fr 2fr 1.2fr 1.4fr 1.4fr 1.2fr auto;
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

.table .thead .sortable {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.table .thead .sortable:hover {
  color: var(--brand);
}

.muted-icon {
  color: var(--muted);
  opacity: 0.5;
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

.btn-primary {
  background: var(--brand);
  color: white;
  border-color: var(--brand);
}

.btn-primary:hover {
  background: color-mix(in srgb, var(--brand) 85%, black);
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-danger {
  background: var(--bad);
  color: white;
  border-color: var(--bad);
}

.btn-danger:hover {
  background: color-mix(in srgb, var(--bad) 85%, black);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--surface);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1.25rem;
  padding: 4px;
  border-radius: 4px;
  transition: 0.2s;
}

.close-btn:hover {
  background: var(--soft);
  color: var(--text);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item label {
  font-size: 0.875rem;
  color: var(--muted);
  font-weight: 500;
}

.detail-item p {
  margin: 0;
  font-size: 1rem;
  color: var(--text);
}

.raw-data {
  background: var(--bg);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.raw-data h4 {
  margin: 0 0 12px 0;
  font-size: 0.875rem;
  color: var(--muted);
}

.key-value-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  font-size: 0.9rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}

.kv-item:last-child {
  border-bottom: none;
}

.kv-item .key {
  font-weight: 600;
  color: var(--muted);
}

.kv-item .value {
  color: var(--text);
  word-break: break-word;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions-left {
  display: flex;
  gap: 10px;
}

/* Compact Pagination Styles */
.pagination-compact {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-self: end;
}

.pagination-info-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-text {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.pagination-select-compact {
  padding: 0.125rem 0.25rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  min-width: 50px;
}

.pagination-select-compact:hover {
  border-color: var(--brand);
}

.pagination-select-compact:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand) 20%, transparent);
}

.pagination-controls-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-btn-compact {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.pagination-btn-compact:hover:not(:disabled) {
  background: var(--soft);
  border-color: var(--brand);
}

.pagination-btn-compact:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.8rem;
  color: var(--muted);
  padding: 0 0.25rem;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .pagination-compact {
    justify-self: start;
    width: 100%;
    justify-content: space-between;
  }
}

/* Quick Actions & Clickable Row */
.clickable-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.clickable-row:hover {
  background: var(--soft) !important;
}

.actions-col {
  position: relative;
  display: flex;
  justify-content: flex-end;
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--soft);
  color: var(--text);
}

.quick-actions-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 100;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.quick-actions-menu button {
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.15s;
}

.quick-actions-menu button:hover {
  background: var(--soft);
}

/* Clickable Link Buttons */
.link-btn {
  background: transparent;
  border: none;
  color: var(--brand);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  text-decoration: underline;
  transition: 140ms ease;
  font-family: inherit;
  font-size: inherit;
  text-align: left;
}

.link-btn:hover {
  background: color-mix(in srgb, var(--brand) 15%, transparent);
  color: var(--brand-ink);
}

/* Person Cell with Link and Icon */
.person-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.person-detail {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon-tiny {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: 140ms ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.btn-icon-tiny:hover {
  background: var(--soft);
  color: var(--brand);
}

/* Asana Icon in Menus */
.asana-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  vertical-align: middle;
}
</style>