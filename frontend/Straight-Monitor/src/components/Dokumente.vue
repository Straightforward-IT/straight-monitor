<template>
  <div class="dokumente-page">
    <!-- Document Management Section -->
    <div class="panel">
      <div class="controls">
        <FilterPanel v-model:expanded="filtersExpanded" :locked="!!(filteredTeamleiter || filteredMitarbeiter)">
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

          <!-- Person Filter Chips (wenn aktiv) -->
          <template v-if="filteredTeamleiter || filteredMitarbeiter">
            <span class="divider" />
            
            <div class="chip-group">
              <span class="chip-label">Person</span>
              <div class="chips">
                <button
                  v-if="filteredTeamleiter"
                  class="chip active"
                  @click="filterByTeamleiter(filteredTeamleiter)"
                  :title="`Filter aktiv: ${filteredTeamleiter} - klicken zum Zurücksetzen`"
                >
                  <font-awesome-icon icon="fa-solid fa-user-tie" />
                  TL: {{ filteredTeamleiter }}
                </button>
                <button
                  v-if="filteredMitarbeiter"
                  class="chip active"
                  @click="filterByMitarbeiter(filteredMitarbeiter)"
                  :title="`Filter aktiv: ${filteredMitarbeiter} - klicken zum Zurücksetzen`"
                >
                  <font-awesome-icon icon="fa-solid fa-user" />
                  MA: {{ filteredMitarbeiter }}
                </button>
              </div>
            </div>
          </template>
        </div>
        </FilterPanel>

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
            <template v-if="doc.details?.name_teamleiter">
              <template v-if="doc.details?.teamleiter">
                <button 
                  :class="['btn-icon-tiny', { 'filter-active': filteredTeamleiter === doc.details.name_teamleiter }]"
                  @click.stop="filterByTeamleiter(doc.details.name_teamleiter)"
                  :title="filteredTeamleiter === doc.details.name_teamleiter ? 'Filter aktiv - klicken zum Zurücksetzen' : 'Nach diesem Teamleiter filtern'"
                >
                  <font-awesome-icon icon="fa-solid fa-filter" />
                </button>
                <button class="link-btn" @click.stop="openMitarbeiterCard('teamleiter', getEmployeeId(doc, 'teamleiter'))">
                  {{ doc.details.name_teamleiter }}
                </button>
              </template>
              <span v-else class="unassigned-name">
                {{ doc.details.name_teamleiter }}
                <CustomTooltip text="Nicht zugeordnet" position="bottom" :delay-in="150" teleportToBody>
                  <font-awesome-icon icon="fa-solid fa-circle-exclamation" class="warn-icon" />
                </CustomTooltip>
              </span>
            </template>
            <span v-else>—</span>
          </div>
          <div class="truncate person-cell">
            <template v-if="doc.details?.name_mitarbeiter">
              <template v-if="doc.details?.mitarbeiter">
                <button 
                  :class="['btn-icon-tiny', { 'filter-active': filteredMitarbeiter === doc.details.name_mitarbeiter }]"
                  @click.stop="filterByMitarbeiter(doc.details.name_mitarbeiter)"
                  :title="filteredMitarbeiter === doc.details.name_mitarbeiter ? 'Filter aktiv - klicken zum Zurücksetzen' : 'Nach diesem Mitarbeiter filtern'"
                >
                  <font-awesome-icon icon="fa-solid fa-filter" />
                </button>
                <button class="link-btn" @click.stop="openMitarbeiterCard('mitarbeiter', getEmployeeId(doc, 'mitarbeiter'))">
                  {{ doc.details.name_mitarbeiter }}
                </button>
              </template>
              <span v-else class="unassigned-name">
                {{ doc.details.name_mitarbeiter }}
                <CustomTooltip text="Nicht zugeordnet" position="bottom" :delay-in="150" teleportToBody>
                  <font-awesome-icon icon="fa-solid fa-circle-exclamation" class="warn-icon" />
                </CustomTooltip>
              </span>
            </template>
            <span v-else>—</span>
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
      <div class="modal document-modal">
        <div class="modal-header">
          <h3>{{ selectedDoc.docType }} Details</h3>
          <button class="close-btn" @click="closeDoc">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
        <div class="modal-body modal-document-body">
          <DocumentCard
            :doc="selectedDoc"
            :personDetails="personDetails"
            :filteredTeamleiter="filteredTeamleiter"
            :filteredMitarbeiter="filteredMitarbeiter"
            @close="closeDoc"
            @assign="openAssignDialog"
            @filter-teamleiter="filterByTeamleiter"
            @filter-mitarbeiter="filterByMitarbeiter"
            @open-employee="openMitarbeiterCard"
          />
        </div>
      </div>
    </div>

    <!-- Employee Modal -->
    <div v-if="selectedMitarbeiter" class="modal-overlay" @click.self="closeMitarbeiterCard">
      <div class="modal-container">
        <div v-if="loadingMitarbeiter" class="loading-state">
          <font-awesome-icon icon="fa-solid fa-spinner" spin />
          Lade Mitarbeiterdaten...
        </div>
        <EmployeeCard
          v-else-if="fullMitarbeiterData"
          :ma="fullMitarbeiterData"
          :initiallyExpanded="true"
          @close="closeMitarbeiterCard"
          @open-employee="openMitarbeiterCard"
        />
      </div>
    </div>

    <!-- Assignment Modal -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="closeAssignModal">
      <div class="modal assign-modal">
        <div class="modal-header">
          <h3>{{ assignRole === 'teamleiter' ? 'Teamleiter' : 'Mitarbeiter' }} zuweisen</h3>
          <button class="close-btn" @click="closeAssignModal">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
        <div class="modal-body">
          <div class="assign-info">
            <div class="info-row">
              <span class="label">Dokument:</span>
              <span class="value">{{ selectedDoc?.bezeichnung }}</span>
            </div>
            <div class="info-row">
              <span class="label">Name im Formular:</span>
              <span class="value unassigned-name">{{ selectedDoc?.details?.[`name_${assignRole}`] }}</span>
            </div>
          </div>

          <div class="search">
            <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="search-ic" />
            <input
              v-model="assignSearchQuery"
              type="text"
              placeholder="Mitarbeiter suchen…"
              aria-label="Mitarbeiter suchen"
              ref="assignSearchInput"
            />
          </div>

          <div v-if="loading.employees" class="loading-state">
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            Lade Mitarbeiter…
          </div>

          <div v-else-if="filteredEmployees.length === 0" class="empty-state">
            <font-awesome-icon icon="fa-solid fa-user-slash" />
            <p>Keine Mitarbeiter gefunden</p>
          </div>

          <div v-else class="employee-list">
            <button
              v-for="employee in filteredEmployees"
              :key="employee._id"
              class="employee-item"
              @click="selectEmployee(employee)"
            >
              <div class="employee-info">
                <span class="employee-name">{{ employee.vorname }} {{ employee.nachname }}</span>
                <span v-if="employee.email" class="employee-email">{{ employee.email }}</span>
              </div>
              <font-awesome-icon icon="fa-solid fa-chevron-right" class="chevron" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "@/utils/api";
import logger from "@/utils/logger";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import CustomTooltip from './CustomTooltip.vue';
import FilterPanel from '@/components/FilterPanel.vue';
import DocumentCard from '@/components/DocumentCard.vue';
import EmployeeCard from '@/components/EmployeeCard.vue';
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
  faExternalLink,
  faCircleExclamation,
  faUserSlash,
  faSpinner,
  faFilter
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
  faExternalLink,
  faCircleExclamation,
  faUserSlash,
  faSpinner,
  faFilter
);

export default {
  name: "Dokumente",
  components: { FontAwesomeIcon, CustomTooltip, FilterPanel, DocumentCard, EmployeeCard },

  data() {
    // Load filter settings from sessionStorage or use defaults
    const savedFilters = sessionStorage.getItem('dokumente_filters');
    let filterDefaults = {
      activeDocStatusFilter: "Alle",
      activeDocTypeFilters: ["Event-Bericht", "Evaluierung"],
      activeDocLocationFilter: "Alle",
      filteredTeamleiter: null,
      filteredMitarbeiter: null,
      documentsSearchQuery: "",
      sortKey: 'datum',
      sortOrder: 'desc',
      currentPage: 1,
      itemsPerPage: 100,
    };

    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        filterDefaults = { ...filterDefaults, ...parsed };
      } catch (e) {
        console.warn('Could not parse saved filters:', e);
      }
    }

    return {
      // assets
      asanaLogo,
      
      // auth/user
      token: localStorage.getItem("token") || null,
      userLocation: "",

      // state
      loading: { documents: true, employees: false },
      error: { documents: null },

      // data sets
      documents: [],
      locations: ["Hamburg", "Berlin", "Köln"],
      filtersExpanded: false,

      // filters and search (restored from session or defaults)
      activeDocStatusFilter: filterDefaults.activeDocStatusFilter,
      activeDocTypeFilters: filterDefaults.activeDocTypeFilters,
      activeDocLocationFilter: filterDefaults.activeDocLocationFilter,
      filteredTeamleiter: filterDefaults.filteredTeamleiter,
      filteredMitarbeiter: filterDefaults.filteredMitarbeiter,
      documentsSearchQuery: filterDefaults.documentsSearchQuery,
      
      // sorting (restored from session or defaults)
      sortKey: filterDefaults.sortKey,
      sortOrder: filterDefaults.sortOrder,

      // pagination (restored from session or defaults)
      currentPage: filterDefaults.currentPage,
      itemsPerPage: filterDefaults.itemsPerPage,
      pageOptions: [25, 50, 100],

      // ui
      selectedDoc: null,
      activeQuickActionId: null,
      showAssignModal: false,
      assignRole: null, // 'teamleiter' or 'mitarbeiter'
      assignSearchQuery: '',
      selectedMitarbeiter: null,
      fullMitarbeiterData: null,
      loadingMitarbeiter: false,
      
      // person details cache (for Asana links)
      personDetails: {},
      employees: [],
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
          // Collect all searchable values
          const values = [
            d.docType || "",
            d.bezeichnung || "",
            d.status || "",
            this.formatDate(d.datum) || "",
          ];
          
          // Add all detail fields (full-text search)
          if (d.details && typeof d.details === 'object') {
            Object.entries(d.details).forEach(([key, value]) => {
              // Skip internal MongoDB fields and references
              if (!['_id', '__v', 'mitarbeiter', 'teamleiter', 'laufzettel', 'task_id'].includes(key)) {
                if (value) {
                  // Format dates for searching
                  if (typeof key === 'string' && (key.toLowerCase().includes('datum') || key.toLowerCase().includes('date'))) {
                    values.push(this.formatDate(value));
                  } else {
                    values.push(String(value));
                  }
                }
              }
            });
          }
          
          const searchText = values.join(" ").toLowerCase();
          return searchText.includes(q);
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

    filteredEmployees() {
      if (!this.assignSearchQuery.trim()) {
        return this.employees;
      }
      const query = this.assignSearchQuery.toLowerCase();
      return this.employees.filter(emp => {
        const fullName = `${emp.vorname} ${emp.nachname}`.toLowerCase();
        const email = (emp.email || '').toLowerCase();
        return fullName.includes(query) || email.includes(query);
      });
    },
  },

  watch: {
    documentsSearchQuery() {
      this.currentPage = 1;
      this.saveFilters();
    },
    activeDocStatusFilter() {
      this.saveFilters();
    },
    activeDocTypeFilters: {
      handler() {
        this.saveFilters();
      },
      deep: true,
    },
    activeDocLocationFilter() {
      this.saveFilters();
    },
    filteredTeamleiter() {
      this.saveFilters();
    },
    filteredMitarbeiter() {
      this.saveFilters();
    },
    sortKey() {
      this.saveFilters();
    },
    sortOrder() {
      this.saveFilters();
    },
    itemsPerPage() {
      this.saveFilters();
    },
    currentPage() {
      this.saveFilters();
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
      // Special cases
      if (key === 'date') return 'Geschrieben am';
      
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

    saveFilters() {
      const filters = {
        activeDocStatusFilter: this.activeDocStatusFilter,
        activeDocTypeFilters: this.activeDocTypeFilters,
        activeDocLocationFilter: this.activeDocLocationFilter,
        filteredTeamleiter: this.filteredTeamleiter,
        filteredMitarbeiter: this.filteredMitarbeiter,
        documentsSearchQuery: this.documentsSearchQuery,
        sortKey: this.sortKey,
        sortOrder: this.sortOrder,
        currentPage: this.currentPage,
        itemsPerPage: this.itemsPerPage,
      };
      sessionStorage.setItem('dokumente_filters', JSON.stringify(filters));
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
        // Filter-Sektion automatisch öffnen
        this.filtersExpanded = true;
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
        // Filter-Sektion automatisch öffnen
        this.filtersExpanded = true;
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

    getEmployeeId(doc, role) {
      const employee = doc.details?.[role];
      if (!employee) return null;
      // If it's already a string (ObjectId), return it
      if (typeof employee === 'string') return employee;
      // If it's an object (populated), return the _id
      return employee._id || null;
    },

    // Mitarbeiter-Card öffnen
    async openMitarbeiterCard(role, mitarbeiterId) {
      console.log('Opening employee card:', role, mitarbeiterId);
      this.loadingMitarbeiter = true;
      this.selectedMitarbeiter = { _id: mitarbeiterId };

      try {
        // Load full Mitarbeiter data with all relationships
        const response = await api.get(`/api/personal/mitarbeiter/${mitarbeiterId}`);
        const mitarbeiterData = response.data.data;

        // Load Flip profile if flip_id exists
        if (mitarbeiterData.flip_id) {
          try {
            const flipResponse = await api.get(`/api/personal/flip/by-id/${mitarbeiterData.flip_id}`);
            mitarbeiterData.flip = flipResponse.data;
          } catch (flipError) {
            console.error('Error loading Flip profile:', flipError);
          }
        }

        this.fullMitarbeiterData = mitarbeiterData;
      } catch (error) {
        console.error('Error loading Mitarbeiter:', error);
        alert('Fehler beim Laden der Mitarbeiterdaten');
        this.selectedMitarbeiter = null;
      } finally {
        this.loadingMitarbeiter = false;
      }
    },

    closeMitarbeiterCard() {
      this.selectedMitarbeiter = null;
      this.fullMitarbeiterData = null;
    },

    resetFiltersExceptSearch() {
      // Reset all filters except search query
      this.filteredTeamleiter = null;
      this.filteredMitarbeiter = null;
      this.activeDocStatusFilter = 'Alle';
      this.activeDocTypeFilters = ['Event-Bericht', 'Evaluierung'];
      this.activeDocLocationFilter = 'Alle';
      // Keep documentsSearchQuery as is
      
      // Save to session storage
      this.saveFilters();
    },

    async openAssignDialog(role) {
      this.assignRole = role;
      this.assignSearchQuery = '';
      this.showAssignModal = true;
      
      // Fetch employees if not already loaded
      if (this.employees.length === 0) {
        await this.fetchEmployees();
      }
      
      // Focus search input after modal opens
      this.$nextTick(() => {
        this.$refs.assignSearchInput?.focus();
      });
    },

    closeAssignModal() {
      this.showAssignModal = false;
      this.assignRole = null;
      this.assignSearchQuery = '';
    },

    async selectEmployee(employee) {
      // Bestätigung anfordern
      const roleName = this.assignRole === 'teamleiter' ? 'Teamleiter' : 'Mitarbeiter';
      const formularName = this.selectedDoc.details?.[`name_${this.assignRole}`] || '(nicht angegeben)';
      
      const confirmed = confirm(
        `${employee.vorname} ${employee.nachname} als ${roleName} zuweisen?\n\n` +
        `Dokument: ${this.selectedDoc.bezeichnung}\n` +
        `Name im Formular: ${formularName}\n\n` +
        `Bitte bestätigen Sie die Zuweisung.`
      );
      
      if (!confirmed) {
        logger.debug('Assignment cancelled by user');
        return;
      }
      
      try {
        const documentId = this.selectedDoc._id || this.selectedDoc.id;
        const payload = {
          documentId,
        };
        
        // Set the appropriate ID field based on role
        if (this.assignRole === 'teamleiter') {
          payload.teamleiterId = employee._id;
          payload.name_teamleiter = this.selectedDoc.details?.name_teamleiter;
        } else {
          payload.mitarbeiterId = employee._id;
          payload.name_mitarbeiter = this.selectedDoc.details?.name_mitarbeiter;
        }
        
        logger.debug('Assigning employee to document:', payload);
        
        const response = await api.post('/api/wordpress/assign', payload);
        
        if (response.data?.success) {
          logger.info(`✅ ${employee.vorname} ${employee.nachname} assigned as ${this.assignRole}`);
          
          this.closeAssignModal();
          this.closeDoc();
          
          // Refresh documents to show updated status
          await this.fetchDocuments();
          
          // Show success message
          alert(`✅ ${employee.vorname} ${employee.nachname} wurde erfolgreich als ${roleName} zugewiesen.`);
        } else {
          throw new Error(response.data?.error || 'Unbekannter Fehler');
        }
      } catch (error) {
        logger.error('Assignment error:', error);
        alert('❌ Fehler beim Zuweisen: ' + (error.response?.data?.error || error.message));
      }
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

    handleEscapeKey(event) {
      if (event.key !== 'Escape') return;

      // Close modals in order of priority (topmost = last opened)
      // Priority: Assign Modal > Employee Modal > Document Modal
      if (this.showAssignModal) {
        this.closeAssignModal();
      } else if (this.selectedMitarbeiter) {
        this.closeMitarbeiterCard();
      } else if (this.selectedDoc) {
        this.closeDoc();
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
        
        // Setze userLocation als Standard nur wenn noch keine Session-Daten vorhanden
        const savedFilters = sessionStorage.getItem('dokumente_filters');
        if (!savedFilters && this.userLocation && this.locations.includes(this.userLocation)) {
          this.activeDocLocationFilter = this.userLocation;
          this.saveFilters();
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

    async fetchEmployees() {
      this.loading.employees = true;
      try {
        const res = await api.get("/api/personal/mitarbeiter");
        // Filter active employees and sort by name
        this.employees = (res.data?.data || [])
          .filter(emp => emp.isActive !== false)
          .sort((a, b) => {
            const nameA = `${a.vorname} ${a.nachname}`.toLowerCase();
            const nameB = `${b.vorname} ${b.nachname}`.toLowerCase();
            return nameA.localeCompare(nameB, 'de');
          });
      } catch (e) {
        console.error("Fehler beim Laden der Mitarbeiter:", e);
        this.employees = [];
      } finally {
        this.loading.employees = false;
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

    // 3) Query-Parameter verarbeiten (Filter aus Navigation)
    const hasFilterParam = this.$route.query.filterTeamleiter || this.$route.query.filterMitarbeiter;
    
    if (hasFilterParam) {
      // Reset all other filters when navigating with a specific person filter
      this.resetFiltersExceptSearch();
      
      // Set the specific person filter
      if (this.$route.query.filterTeamleiter) {
        this.filteredTeamleiter = this.$route.query.filterTeamleiter;
      }
      if (this.$route.query.filterMitarbeiter) {
        this.filteredMitarbeiter = this.$route.query.filterMitarbeiter;
      }
      
      // Open filter panel to show active person filters
      this.filtersExpanded = true;
      
      // Save the new filter settings
      this.saveFilters();
      
      // Clear query params from URL after applying (use setTimeout to ensure filters are applied first)
      this.$nextTick(() => {
        this.$router.replace({ query: {} });
      });
    }

    document.addEventListener('click', this.handleClickOutside);
    document.addEventListener('keydown', this.handleEscapeKey);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleEscapeKey);
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

/* Document Modal */
.document-modal {
  max-width: 700px;
  width: 95%;
}

.modal-document-body {
  padding: 0;
  max-height: 80vh;
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

.unassigned-name {
  color: var(--muted);
  opacity: 0.7;
  font-style: italic;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.warn-icon {
  color: var(--warn);
  font-size: 0.85em;
  opacity: 0.8;
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

  &:hover {
    background: var(--soft);
    color: var(--brand);
  }

  &.filter-active {
    color: #ff8c00;
    background: color-mix(in srgb, #ff8c00 15%, transparent);
    
    &:hover {
      color: #ff8c00;
      background: color-mix(in srgb, #ff8c00 25%, transparent);
    }
  }
}

/* Asana Icon in Menus */
.asana-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  vertical-align: middle;
}

/* Assignment Modal */
.assign-modal {
  max-width: 500px;
  height: 600px;
  max-height: 85vh;
}

.assign-modal .modal-body {
  padding: 24px;
}

.assign-info {
  background: var(--bg);
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 20px;
  flex-shrink: 0;
}

.info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  font-weight: 600;
  color: var(--muted);
  min-width: 140px;
}

.info-row .value {
  color: var(--text);
  flex: 1;
}

.employee-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
  padding: 2px;
  min-height: 0;
}

.employee-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.employee-item:hover {
  background: var(--soft);
  border-color: var(--brand);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 10%, transparent);
}

.employee-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-name {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
}

.employee-email {
  font-size: 0.8rem;
  color: var(--muted);
}

.chevron {
  color: var(--muted);
  font-size: 0.9rem;
  transition: transform 0.15s ease;
}

.employee-item:hover .chevron {
  transform: translateX(3px);
  color: var(--brand);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--muted);
  gap: 12px;
}

.loading-state svg,
.empty-state svg {
  font-size: 32px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 0.95rem;
}

/* Employee Modal Container */
.modal-container {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  max-width: 95vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
}

.modal-container .loading-state {
  padding: 60px 40px;
}
</style>