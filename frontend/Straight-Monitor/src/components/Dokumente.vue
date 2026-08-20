<template>
  <div class="dokumente-page">
    <!-- Document Management Section -->
    <div class="panel">
      <div class="controls">
        <!-- Toolbar with ToolbarFilter -->
        <Toolbar class="docs-search-toolbar">
          <ToolbarFilter v-model="filterExpanded" :active-count="activeFilterCount" @reset="resetFiltersExceptSearch">
            <FilterGroup label="Standort">
              <FilterChip
                v-for="loc in locations"
                :key="loc._id"
                class="location-filter-chip"
                :active="activeDocLocationFilter === loc._id"
                :style="{ '--location-color': loc.color || '#6b7280' }"
                @click="setDocFilter('location', activeDocLocationFilter === loc._id ? 'Alle' : loc._id)"
              >{{ loc.shortName || loc.nameFull }}</FilterChip>
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Typ">
              <FilterChip
                :active="activeDocTypeFilters.includes('Laufzettel (v2)')"
                @click="toggleDocTypeFilter('Laufzettel (v2)')"
              >Laufzettel</FilterChip>
              <FilterChip
                :active="activeDocTypeFilters.includes('Event-Bericht')"
                @click="toggleDocTypeFilter('Event-Bericht')"
              >Event Report</FilterChip>
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Status">
              <FilterChip
                :active="showOnlyOffen"
                @click="showOnlyOffen = !showOnlyOffen; currentPage = 1"
              >Offen</FilterChip>
            </FilterGroup>
            <template v-if="filteredTeamleiter || filteredMitarbeiter">
              <FilterDivider />
              <FilterGroup label="Person">
                <FilterChip
                  v-if="filteredTeamleiter"
                  :active="true"
                  @click="filterByTeamleiter(filteredTeamleiter)"
                >TL: {{ filteredTeamleiter }}</FilterChip>
                <FilterChip
                  v-if="filteredMitarbeiter"
                  :active="true"
                  @click="filterByMitarbeiter(filteredMitarbeiter)"
                >MA: {{ filteredMitarbeiter }}</FilterChip>
              </FilterGroup>
            </template>
          </ToolbarFilter>
          <div class="toolbar-inner">
            <SearchBar
              class="toolbar-search"
              v-model="documentsSearchQuery"
              placeholder="Dokumente durchsuchen..."
              aria-label="Dokumente suchen"
            />
            <button class="btn-nachpflege" @click="$router.push('/dokumente/nachpflege')">
              <font-awesome-icon :icon="['fas', 'plus']" />
              Nachpflege
            </button>
          </div>
        </Toolbar>

        <div v-if="!loading.documents && filteredDocumentsSorted.length > 0" class="search-sort">
          <div class="pagination-compact">
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
          <div @click="handleSort('datum')" class="sortable">
            Datum
            <font-awesome-icon v-if="sortKey === 'datum'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div @click="handleSort('bezeichnung')" class="sortable">
            Event
            <font-awesome-icon v-if="sortKey === 'bezeichnung'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
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
          <div @click="handleSort('status')" class="sortable" title="Status">
            <font-awesome-icon v-if="sortKey === 'status'" :icon="sortOrder === 'asc' ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
            <font-awesome-icon v-else icon="fa-solid fa-sort" class="muted-icon" />
          </div>
          <div></div>
        </div>
        <div
          v-for="doc in paginatedDocuments"
          :key="doc.id || doc._id"
          class="row clickable-row"
          @click="openDoc(doc)"
        >
          <div>
            <span :class="['tag', docTypeClass(doc.docType)]" :title="doc.docType">
              {{ docTypeShort(doc.docType) }}
            </span>
          </div>
          <div>{{ formatDate(doc.datum) }}</div>
          <div class="truncate" :title="auftragTitelMap.get(String(doc.details?.auftragnummer)) || doc.bezeichnung">{{ auftragTitelMap.get(String(doc.details?.auftragnummer)) || doc.bezeichnung || "—" }}</div>
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
          <div class="status-cell" :title="doc.status || '—'">
            <font-awesome-icon :icon="statusIcon(doc.status)" :class="['status-icon', (doc.status || '').toLowerCase()]" />
          </div>
          <div class="actions-col" @click.stop>
            <button class="btn-icon" @click="toggleQuickActions(doc.id || doc._id)">
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
            <div v-if="activeQuickActionId === (doc.id || doc._id)" class="quick-actions-menu">
              <button @click="openDoc(doc)">
                <font-awesome-icon icon="fa-solid fa-magnifying-glass" /> Details
              </button>
              <button @click="copyDocLink(doc)">
                <font-awesome-icon icon="fa-solid fa-link" /> Link kopieren
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

    <!-- Document modals are hosted by DockedModalHost in App.vue. -->

    <!-- Employee Modal (table row clicks) -->
    <EmployeeCardModal
      :mitarbeiterId="selectedMitarbeiter"
      @close="closeMitarbeiterCard"
    />
  </div>
</template>

<script>
import api from "@/utils/api";
import logger from "@/utils/logger";
import { useDataCache } from "@/stores/dataCache";
import { useDocumentModals } from "@/composables/useDocumentModals";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import CustomTooltip from './CustomTooltip.vue';
import FilterPanel from '@/components/FilterPanel.vue';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import FilterDivider from '@/components/ui-elements/FilterDivider.vue';
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
  components: { FontAwesomeIcon, CustomTooltip, FilterPanel, EmployeeCardModal, SearchBar, Toolbar, ToolbarFilter, FilterGroup, FilterChip, FilterDivider },

  setup() {
    const dataCache = useDataCache();
    const { dockedModals, openDocument } = useDocumentModals();
    return { dataCache, dockedModals, openDocumentModal: openDocument };
  },

  data() {
    // Load filter settings from sessionStorage or use defaults
    const savedFilters = sessionStorage.getItem('dokumente_filters');
    let filterDefaults = {
      activeDocTypeFilters: ["Laufzettel (v2)", "Event-Bericht"],
      activeDocLocationFilter: "Alle",
      showOnlyOffen: false,
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
      loading: { documents: true },
      error: { documents: null },

      // data sets
      documents: [],
      locations: [],
      filtersExpanded: false,
      filterExpanded: false,

      // filters and search (restored from session or defaults)
      activeDocTypeFilters: filterDefaults.activeDocTypeFilters,
      activeDocLocationFilter: filterDefaults.activeDocLocationFilter,
      showOnlyOffen: filterDefaults.showOnlyOffen || false,
      filteredTeamleiter: filterDefaults.filteredTeamleiter,
      filteredMitarbeiter: filterDefaults.filteredMitarbeiter,
      documentsSearchQuery: filterDefaults.documentsSearchQuery,
      searchExpanded: Boolean(filterDefaults.documentsSearchQuery),
      
      // sorting (restored from session or defaults)
      sortKey: filterDefaults.sortKey,
      sortOrder: filterDefaults.sortOrder,

      // pagination (restored from session or defaults)
      currentPage: filterDefaults.currentPage,
      itemsPerPage: filterDefaults.itemsPerPage,
      pageOptions: [25, 50, 100],

      // ui
      activeQuickActionId: null,
      selectedMitarbeiter: null,

      // person details cache (for Asana links)
      personDetails: {},
    };
  },

  computed: {
    activeFilterCount() {
      let count = 0;
      if (this.activeDocLocationFilter !== 'Alle') count++;
      if (this.activeDocTypeFilters.length !== 2) count++;
      if (this.showOnlyOffen) count++;
      if (this.filteredTeamleiter) count++;
      if (this.filteredMitarbeiter) count++;
      return count;
    },

    auftragTitelMap() {
      const map = new Map();
      for (const a of this.dataCache.auftraege) {
        if (a.auftragNr != null && a.eventTitel) map.set(String(a.auftragNr), a.eventTitel);
      }
      return map;
    },

    filteredDocuments() {
      let result = this.documents || [];

      if (this.activeDocTypeFilters.length > 0) {
        const typeFilterFns = {
          'Laufzettel': (d) => d.docType === 'Laufzettel' && d.version !== 'v2',
          'Laufzettel (v2)': (d) => d.docType === 'Laufzettel' && d.version === 'v2',
        };
        result = result.filter((d) =>
          this.activeDocTypeFilters.some((f) => {
            const fn = typeFilterFns[f];
            return fn ? fn(d) : (d.docType || '') === f;
          })
        );
      }
      if (this.activeDocLocationFilter !== "Alle") {
        result = result.filter((d) => this.matchesDocumentLocation(d));
      }

      if (this.showOnlyOffen) {
        result = result.filter((d) => {
          const s = (d.status || '').toLowerCase();
          return s === 'offen' || s === 'open';
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
  },

  watch: {
    documentsSearchQuery() {
      this.currentPage = 1;
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
    '$route.query.docId'(docId) {
      if (docId) this.handleDocIdParam(docId);
    },
    // Person filters pushed by the global document modal (works while already mounted)
    '$route.query.filterTeamleiter'(name) {
      if (!name) return;
      this.filterByTeamleiter(name);
      const { filterTeamleiter, ...rest } = this.$route.query;
      this.$router.replace({ query: rest });
    },
    '$route.query.filterMitarbeiter'(name) {
      if (!name) return;
      this.filterByMitarbeiter(name);
      const { filterMitarbeiter, ...rest } = this.$route.query;
      this.$router.replace({ query: rest });
    },
    // Keep local copy in sync when the cache is refreshed elsewhere (e.g. after assign)
    'dataCache.documents'(docs) {
      this.documents = docs;
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

    docTypeShort(docType) {
      if (!docType) return '—';
      if (docType.startsWith('Laufzettel')) return 'LZ';
      if (docType === 'Event-Bericht') return 'ER';
      if (docType === 'Evaluierung') return 'EV';
      return docType.substring(0, 2).toUpperCase();
    },

    docTypeClass(docType) {
      if (!docType) return '';
      if (docType.startsWith('Laufzettel')) return 'laufzettel';
      if (docType === 'Event-Bericht') return 'event-bericht';
      if (docType === 'Evaluierung') return 'evaluierung';
      return '';
    },

    statusIcon(status) {
      const s = (status || '').toLowerCase();
      if (s === 'zugewiesen') return 'fa-solid fa-list-check';
      if (s === 'abgeschlossen') return 'fa-solid fa-list-check';
      return ['far', 'circle']; // Offen
    },

    locationShort(loc) {
      const location = this.locations.find((entry) => entry.nameFull === loc || entry.shortName === loc);
      return location?.shortName || loc;
    },

    normalizeLocationName(value) {
      return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    },

    matchesDocumentLocation(doc) {
      const selectedLocation = this.locations.find(
        (location) => String(location._id) === String(this.activeDocLocationFilter)
      );
      if (!selectedLocation) return false;

      const documentLocation = doc.details?.locationV2;
      return String(documentLocation?._id || '') === String(selectedLocation._id);
    },

    handleSort(key) {
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortOrder = 'desc'; // Default to newest/descending
      }
    },

    toggleSearchExpanded() {
      this.searchExpanded = !this.searchExpanded;
      if (this.searchExpanded) {
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
        });
      }
    },

    handleSearchBlur() {
      if (!this.documentsSearchQuery) {
        this.searchExpanded = false;
      }
    },

    handleSearchEscape() {
      if (!this.documentsSearchQuery) {
        this.searchExpanded = false;
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
    openMitarbeiterCard(role, mitarbeiterId) {
      this.selectedMitarbeiter = mitarbeiterId;
    },

    closeMitarbeiterCard() {
      this.selectedMitarbeiter = null;
    },

    async openLinkedEvaluierung(evaluierungId) {
      if (!evaluierungId) return;
      const ev = this.documents.find(
        d => d.docType === 'Evaluierung' && (
          String(d._id) === String(evaluierungId) ||
          String(d.details?._id) === String(evaluierungId)
        )
      );
      if (ev) {
        await this.openDoc(ev);
        if (ev.details?.name_teamleiter) await this.fetchPersonDetails(ev.details.name_teamleiter);
        if (ev.details?.name_mitarbeiter) await this.fetchPersonDetails(ev.details.name_mitarbeiter);
      }
    },

    async openLinkedLaufzettel(laufzettelId) {
      if (!laufzettelId) return;
      // Suche den Laufzettel in den bereits geladenen Dokumenten
      // documents[i]._id ist die Top-Level-ID des formatted doc (= details._id)
      const lz = this.documents.find(
        d => d.docType === 'Laufzettel' && (
          String(d._id) === String(laufzettelId) ||
          String(d.details?._id) === String(laufzettelId)
        )
      );
      if (lz) {
        await this.openDoc(lz);
        if (lz.details?.name_teamleiter) {
          await this.fetchPersonDetails(lz.details.name_teamleiter);
        }
        if (lz.details?.name_mitarbeiter) {
          await this.fetchPersonDetails(lz.details.name_mitarbeiter);
        }
      } else {
        // Fallback: direkt via API laden
        try {
          const res = await api.get(`/api/docs/laufzettel/${laufzettelId}`);
          if (res.data) {
            await this.openDoc(res.data);
          }
        } catch (e) {
          console.error('Laufzettel nicht gefunden:', e);
        }
      }
    },

    resetFiltersExceptSearch() {
      // Reset all filters except search query
      this.filteredTeamleiter = null;
      this.filteredMitarbeiter = null;
      this.activeDocTypeFilters = ['Laufzettel (v2)', 'Event-Bericht'];
      this.activeDocLocationFilter = 'Alle';
      // Keep documentsSearchQuery as is
      
      // Save to session storage
      this.saveFilters();
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

    async handleDocIdParam(docId) {
      try {
        let targetDoc = this.documents.find(d => String(d._id) === String(docId));

        if (!targetDoc) {
          this.documents = await this.dataCache.loadDocuments(true);
          await this.$nextTick();
          targetDoc = this.documents.find(d => String(d._id) === String(docId));
        }

        if (targetDoc) {
          await this.openDoc(targetDoc);
        } else {
          console.warn(`[Dokumente] docId=${docId} nicht gefunden`);
        }
      } catch (err) {
        console.error('[Dokumente] handleDocIdParam error:', err);
      } finally {
        if (this.$route.query.docId) {
          this.$router.replace({ query: {} });
        }
      }
    },

    async openDoc(doc) {
      const assignmentTitle = this.auftragTitelMap.get(
        String(doc?.details?.auftragnummer || '')
      );
      this.openDocumentModal(doc, {
        eventTitle: assignmentTitle,
        filteredTeamleiter: this.filteredTeamleiter,
        filteredMitarbeiter: this.filteredMitarbeiter,
      });
      this.activeQuickActionId = null;

      // Reflect the open document in the URL so it can be linked/shared
      const docId = doc._id || doc.id;
      if (docId && this.$route.query.docId !== String(docId)) {
        this.$router.replace({ query: { ...this.$route.query, docId: String(docId) } });
      }
      
      // Fetch person details for the quick-actions menu
      if (doc.details?.name_teamleiter) {
        await this.fetchPersonDetails(doc.details.name_teamleiter);
      }
      if (doc.details?.name_mitarbeiter) {
        await this.fetchPersonDetails(doc.details.name_mitarbeiter);
      }
    },

    closeDoc() {
      const documentId = this.$route.query.docId;
      if (documentId) this.dockedModals.remove(`document-${documentId}`);
      // Remove docId from URL when closing
      if (this.$route.query.docId) {
        const { docId, ...rest } = this.$route.query;
        this.$router.replace({ query: rest });
      }
    },
    
    toggleQuickActions(id) {
      if (this.activeQuickActionId === id) {
        this.activeQuickActionId = null;
      } else {
        this.activeQuickActionId = id;
      }
    },

    copyDocLink(doc) {
      const docId = doc._id || doc.id;
      const url = `${window.location.origin}/dokumente?docId=${docId}`;
      navigator.clipboard.writeText(url).catch(() => {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
      this.activeQuickActionId = null;
    },

    handleClickOutside(event) {
      // Close menu if clicking outside
      if (this.activeQuickActionId && !event.target.closest('.actions-col')) {
        this.activeQuickActionId = null;
      }

      if (this.searchExpanded && !event.target.closest('.filter-search-box') && !this.documentsSearchQuery) {
        this.searchExpanded = false;
      }
    },

    handleEscapeKey(event) {
      if (event.key !== 'Escape') return;

      if (this.searchExpanded) {
        this.handleSearchEscape();
        return;
      }

      // Document/assign/customer modals are handled by the persistent host.
      if (this.selectedMitarbeiter) {
        this.closeMitarbeiterCard();
      }
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
        const userLocation = data.locationV2?._id
          ? this.locations.find((location) => String(location._id) === String(data.locationV2._id))
          : this.locations.find((location) => (
            this.normalizeLocationName(location.nameFull) === this.normalizeLocationName(this.userLocation)
            || this.normalizeLocationName(location.shortName) === this.normalizeLocationName(this.userLocation)
          ));
        if (!savedFilters && userLocation) {
          this.activeDocLocationFilter = userLocation._id;
          this.saveFilters();
        }
      } catch (e) {
        console.error("Fehler beim Abrufen der Benutzerdaten:", e);
      }
    },

    async fetchDocuments() {
      try {
        this.documents = await this.dataCache.loadDocuments();
      } catch (e) {
        this.error.documents = e?.message || "Fehler beim Laden der Dokumente.";
        console.error(this.error.documents);
      } finally {
        this.loading.documents = false;
      }
    },

    async fetchLocations() {
      try {
        const { data } = await api.get('/api/locations');
        this.locations = data || [];

        if (this.activeDocLocationFilter !== 'Alle') {
          const matchesLocationId = this.locations.some(
            (location) => String(location._id) === String(this.activeDocLocationFilter)
          );
          if (!matchesLocationId) {
            const legacyLocation = this.locations.find((location) => (
              this.normalizeLocationName(location.nameFull) === this.normalizeLocationName(this.activeDocLocationFilter)
              || this.normalizeLocationName(location.shortName) === this.normalizeLocationName(this.activeDocLocationFilter)
            ));
            this.activeDocLocationFilter = legacyLocation?._id || 'Alle';
            this.saveFilters();
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden der Standorte:', error);
        this.locations = [];
      }
    },
  },

  async mounted() {
    // 1) Token setzen
    this.setAxiosAuthToken();

    // 2) Standorte zuerst laden, damit gespeicherte Namen und der User-Standard auf IDs migriert werden können.
    await this.fetchLocations();

    // 3) User Daten & Dokumente laden (Aufträge non-blocking im Hintergrund)
    await Promise.all([
      this.fetchUserData(),
      this.fetchDocuments(),
    ]);
    this.dataCache.loadAuftraege(); // fire-and-forget: nur für auftragTitelFor() benötigt

    // 4) Query-Parameter verarbeiten (Filter aus Navigation)
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

    // 4) docId-Parameter: Dokument direkt öffnen
    const docId = this.$route.query.docId;
    if (docId) {
      await this.handleDocIdParam(docId);
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
  --surface: var(--panel);
  --soft: var(--hover);
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

.dokumente-page :deep(.location-filter-chip) {
  border-color: color-mix(in srgb, var(--location-color) 45%, var(--border));
  color: var(--location-color);
}

.dokumente-page :deep(.location-filter-chip.active) {
  background: color-mix(in srgb, var(--location-color) 12%, transparent);
  border-color: var(--location-color);
  box-shadow: inset 0 0 0 1px var(--location-color);
  color: var(--location-color);
}

.panel {
  background: var(--surface);
  border-radius: 16px;
  padding: 20px;
}

/* Controls */
.controls {
  display: grid;
  gap: 8px;
  margin-bottom: 8px;
}

/* Filter Chips */
.filter-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px;
  background: var(--soft);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.chip-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--surface);
  border-radius: 6px;
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
  gap: 5px;
  flex-wrap: wrap;
}

.chip-label {
  color: var(--brand);
  font-weight: 700;
  margin-right: 3px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 0;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 5px;
  padding: 3px 9px;
  display: inline-flex;
  gap: 5px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 12px;
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
  width: 1px;
  height: 20px;
  background: linear-gradient(to bottom, 
    transparent 0%,
    var(--border) 20%,
    var(--border) 80%,
    transparent 100%);
  border-radius: 1px;
  margin: 0 2px;
}

.search-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 640px) {
  .search-sort {
    flex-direction: column;
    align-items: stretch;
  }
}

// Docs search toolbar (hidden on mobile)
.docs-search-toolbar {
  margin-bottom: 12px;
  overflow: visible;
}

.toolbar-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.btn-nachpflege {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  &:hover { border-color: var(--primary); color: var(--primary); }
}

.filter-search-box {
  display: flex;
  align-items: center;
  position: relative;

  @media (min-width: 769px) {
    display: none;
  }
}

.filter-search-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
  line-height: 1;
}

.filter-search-toggle:hover {
  color: var(--brand);
  background: color-mix(in srgb, var(--brand) 10%, transparent);
}

.filter-search-box input {
  display: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.85rem;
  width: 0;
  background: var(--surface);
  color: var(--text);
  transition: width 0.25s ease, opacity 0.2s ease;
  opacity: 0;
}

.filter-search-box input:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent);
}

.filter-search-box.search-expanded input {
  display: block;
  width: 220px;
  opacity: 1;
}

@media (max-width: 768px) {
  .filter-search-box.search-expanded input {
    width: 150px;
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
  grid-template-columns: 40px 90px minmax(0, 1.8fr) minmax(0, 1.4fr) minmax(0, 1.2fr) 32px 32px;
  gap: 10px;
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
  justify-content: center;
  padding: 3px 7px;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 5px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  background: color-mix(in srgb, var(--brand) 12%, var(--surface));
  color: var(--brand-ink);
}

.tag.laufzettel {
  background: color-mix(in srgb, #2196f3 18%, var(--surface));
  color: color-mix(in srgb, #2196f3 80%, var(--text));
  border: 1px solid color-mix(in srgb, #2196f3 30%, transparent);
}

.tag.event-bericht {
  background: color-mix(in srgb, #ff8c00 18%, var(--surface));
  color: color-mix(in srgb, #ff8c00 80%, var(--text));
  border: 1px solid color-mix(in srgb, #ff8c00 30%, transparent);
}

.tag.evaluierung {
  background: color-mix(in srgb, #2ec27e 18%, var(--surface));
  color: color-mix(in srgb, #2ec27e 80%, var(--text));
  border: 1px solid color-mix(in srgb, #2ec27e 30%, transparent);
}

/* Status icon (replaces pill) */
.status-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon {
  font-size: 0.9rem;
  color: var(--muted);
}

.status-icon.zugewiesen { color: #2ec27e; }
.status-icon.abgeschlossen { color: #2ec27e; }
.status-icon.offen { color: #f6a019; }

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
    color: var(--brand);
    background: color-mix(in srgb, var(--brand) 15%, transparent);
    
    &:hover {
      color: var(--brand);
      background: color-mix(in srgb, var(--brand) 25%, transparent);
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

/* ── Responsive table ─────────────────────────────────────────────── */

/* Tablet (≤ 1024px): hide Mitarbeiter column */
@media (max-width: 1024px) {
  .table .thead,
  .table .row {
    grid-template-columns: 40px 90px minmax(0, 2fr) minmax(0, 1.6fr) 32px 32px;
  }

  /* Mitarbeiter = 5th child (1=type 2=ort 3=datum 4=TL 5=MA 6=status 7=actions) */
  .table .thead > :nth-child(5),
  .table .row > :nth-child(5) {
    display: none;
  }
}

/* Mobile (≤ 640px): card layout */
@media (max-width: 640px) {
  .panel {
    padding: 12px;
    border-radius: 12px;
  }

  .table {
    border-left: none;
    border-right: none;
    border-radius: 0;
    margin: 0 -12px;
  }

  /* Hide table header row */
  .table .thead { display: none; }

  /*
   * Each row becomes a compact 2-row card:
   *   Row 1: [badge] | [ort]     | [date]    | [status-icon]
   *   Row 2:         | [TL name] | [MA name] | [actions-btn]
   *
   * Grid columns: badge(auto) | main(1fr) | side(0.7fr) | right(auto)
   */
  .table .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 0.7fr) auto;
    grid-template-rows: auto auto;
    padding: 8px 12px;
    column-gap: 8px;
    row-gap: 2px;
    align-items: center;
  }

  /* 1: badge — row1, col1 */
  .table .row > :nth-child(1) { grid-row: 1; grid-column: 1; align-self: start; padding-top: 2px; }
  /* 2: date (DOM pos 2 after reorder) — row1, col3 */
  .table .row > :nth-child(2) { grid-row: 1; grid-column: 3; font-size: 0.75rem; color: var(--muted); white-space: nowrap; text-align: right; }
  /* 3: location (DOM pos 3 after reorder) — row1, col2 */
  .table .row > :nth-child(3) { grid-row: 1; grid-column: 2; font-size: 0.85rem; font-weight: 500; }
  /* 4: TL — row2, col2 */
  .table .row > :nth-child(4) { grid-row: 2; grid-column: 2; font-size: 0.76rem; color: var(--muted); min-width: 0; }
  /* 5: MA — row2, col3 */
  .table .row > :nth-child(5) { grid-row: 2; grid-column: 3; font-size: 0.76rem; color: var(--muted); min-width: 0; }
  /* 6: status icon — row1, col4 */
  .table .row > :nth-child(6) { grid-row: 1; grid-column: 4; display: flex; align-items: center; justify-content: center; }
  /* 7: actions — row2, col4 */
  .table .row > :nth-child(7) { grid-row: 2; grid-column: 4; justify-self: end; }

  /* Hide filter-icon buttons inside person cells to save space on mobile */
  .table .row .btn-icon-tiny { display: none; }

  /* Compact link buttons in person cells */
  .table .row .link-btn { font-size: 0.76rem; }
}
</style>
