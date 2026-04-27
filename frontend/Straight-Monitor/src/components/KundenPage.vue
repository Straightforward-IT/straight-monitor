<template>
  <div class="kunden-page">
    
    <!-- Tabs Navigation -->
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="tab-btn" 
        :class="{ active: currentTab === tab.id }"
        @click="currentTab = tab.id"
      >
        <font-awesome-icon :icon="tab.icon" />
        {{ tab.label }}
      </button>
    </div>

    <div class="content-section">
      
      <!-- Shared Filter Panel (Not for Analytics/Kontakte) -->
      <FilterPanel 
        v-if="currentTab !== 'analytics' && currentTab !== 'kontakte'"
        v-model:expanded="filtersExpanded" 
        title="Filter & Sortierung"
        class="mb-4"
      >
        <!-- GeschSt Filter -->
        <FilterGroup label="Geschäftsstelle">
          <FilterChip :active="filters.geschSt === '1'" @click="setGeschStFilter('1')">Berlin</FilterChip>
          <FilterChip :active="filters.geschSt === '2'" @click="setGeschStFilter('2')">Hamburg</FilterChip>
          <FilterChip :active="filters.geschSt === '3'" @click="setGeschStFilter('3')">Köln</FilterChip>
          <FilterChip :active="!filters.geschSt" @click="setGeschStFilter(null)">Alle</FilterChip>
        </FilterGroup>

        <FilterDivider />

        <!-- Status Filter (Only valid for Overview tab where we have mixed Active/Inactive) -->
        <FilterGroup v-if="currentTab === 'overview'" label="Status">
          <FilterChip :active="filters.status === 2" @click="setStatusFilter(2)">Aktiv</FilterChip>
          <FilterChip :active="filters.status === 3" @click="setStatusFilter(3)">Inaktiv</FilterChip>
           <FilterChip :active="!filters.status" @click="setStatusFilter(null)">Alle</FilterChip>
        </FilterGroup>

        <FilterDivider v-if="currentTab === 'overview'" />

        <!-- Sortierung -->
        <FilterGroup label="Sortierung">
           <CustomTooltip :text="filters.sortDir === 'asc' ? 'A - Z' : 'Z - A'" position="bottom">
             <FilterChip 
              :active="filters.sortBy === 'name'" 
              @click="toggleSort('name')"
             >
               Name
               <font-awesome-icon v-if="filters.sortBy === 'name'" :icon="filters.sortDir === 'asc' ? 'sort-alpha-down' : 'sort-alpha-up'" class="ml-2" />
             </FilterChip>
           </CustomTooltip>
           
           <CustomTooltip :text="filters.sortDir === 'asc' ? 'Älteste zuerst' : 'Neueste zuerst'" position="bottom">
             <FilterChip 
              :active="filters.sortBy === 'date'" 
              @click="toggleSort('date')"
             >
               Kunde Seit
               <font-awesome-icon v-if="filters.sortBy === 'date'" :icon="filters.sortDir === 'asc' ? 'sort-numeric-down' : 'sort-numeric-up'" class="ml-2" />
             </FilterChip>
           </CustomTooltip>
        </FilterGroup>

      </FilterPanel>

      <!-- Übersicht Tab (Alle außer Status 1) -->
      <div v-if="currentTab === 'overview'" class="tab-content">
        <div class="toolbar">
           <div class="search-group">
            <input v-model="searchQuery" type="text" placeholder="Suchen..." class="search-input" />
            <span class="count-tag">{{ filteredKunden.length }} Kunden</span>
           </div>
           
           <button class="btn-group" @click="showMergeModal = true">
             <font-awesome-icon :icon="['fas', 'object-group']" />
             Gruppieren
           </button>
        </div>
        
        <div v-if="isLoading" class="loading-state">
           <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lädt...
        </div>

        <div v-else-if="filteredKunden.length === 0" class="empty-list">
           Keine aktiven Kunden gefunden.
        </div>

        <div v-else class="kunden-grid">
           <!-- Simple Card List for now -->
            <div 
              v-for="kunde in filteredKunden" 
              :key="kunde._id" 
              class="kunde-card"
              @click="openCustomer(kunde)"
            >
              <div class="card-header">
                <div class="card-title-block">
                  <h3>{{ kunde.kundName || 'Unbenannt' }}</h3>
                  <span v-if="isSuperKunde(kunde)" class="super-kunde-tag">Super-Kunde</span>
                </div>
                <div class="card-header-right">
                  <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
                    {{ getStatusText(kunde.kundStatus) }}
                  </span>
                  <button class="ctx-menu-btn" @click.stop="openContextMenu(kunde, $event)" title="Aktionen">
                    <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
                  </button>
                </div>
              </div>
              <div class="card-body">
                <p><strong>Nr:</strong> {{ kunde.kundenNr }}<span v-if="kunde.kuerzel" class="kuerzel-inline"> · {{ kunde.kuerzel }}</span></p>
                <div v-if="kunde.contacts && kunde.contacts.length" class="contact-preview">
                   <font-awesome-icon :icon="['fas', 'user']" />
                   {{ kunde.contacts[0].vorname }} {{ kunde.contacts[0].nachname }}
                   <span v-if="kunde.contacts.length > 1" class="more-contacts">+{{ kunde.contacts.length - 1 }}</span>
                </div>
              </div>
            </div>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div v-if="currentTab === 'analytics'" class="tab-content">
         <KundenAnalytics />
      </div>

      <!-- Watchlist Tab -->
      <div v-if="currentTab === 'watchlist'" class="tab-content">
        <div class="toolbar">
          <div class="search-group">
            <span class="count-tag">{{ watchlistedKunden.length }} auf der Watchlist</span>
          </div>
          <button v-if="watchlistedKunden.length > 0" class="btn-group" @click="showReportModal = true">
            <font-awesome-icon :icon="['fas', 'chart-bar']" />
            Bericht senden
          </button>
        </div>

        <div v-if="watchlistedKunden.length === 0" class="empty-list">
          <font-awesome-icon :icon="['fas', 'binoculars']" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;" />
          <p>Noch keine Kunden auf der Watchlist.</p>
          <p style="font-size: 13px;">Klicke auf das Stern-Symbol bei einem Kunden, um ihn hier hinzuzufügen.</p>
        </div>

        <div v-else class="kunden-grid">
          <div
            v-for="kunde in watchlistedKunden"
            :key="kunde._id"
            class="kunde-card"
            @click="openCustomer(kunde)"
          >
            <div class="card-header">
              <h3>{{ kunde.kundName || 'Unbenannt' }}</h3>
              <div class="card-header-right">
                <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
                  {{ getStatusText(kunde.kundStatus) }}
                </span>
                <button class="ctx-menu-btn" @click.stop="openContextMenu(kunde, $event)" title="Aktionen">
                  <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
                </button>
              </div>
            </div>
            <div class="card-body">
              <p><strong>Nr:</strong> {{ kunde.kundenNr }}<span v-if="kunde.kuerzel" class="kuerzel-inline"> · {{ kunde.kuerzel }}</span></p>
              <div v-if="kunde.contacts && kunde.contacts.length" class="contact-preview">
                <font-awesome-icon :icon="['fas', 'user']" />
                {{ kunde.contacts[0].vorname }} {{ kunde.contacts[0].nachname }}
                <span v-if="kunde.contacts.length > 1" class="more-contacts">+{{ kunde.contacts.length - 1 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

       <!-- Leads Tab (Status 1) -->
      <div v-if="currentTab === 'leads'" class="tab-content">
          <div class="toolbar">
            <h2>Potentielle Kunden (Leads)</h2>
             <span class="count-tag">{{ leads.length }} Leads</span>
          </div>

          <div v-if="isLoading" class="loading-state">
           <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lädt...
          </div>
          
           <div v-else-if="leads.length === 0" class="empty-list">
             Keine Leads vorhanden.
          </div>

           <div v-else class="kunden-list">
              <div v-for="lead in leads" :key="lead._id" class="lead-item" @click="openCustomer(lead)">
                 <div class="lead-info">
                    <h4>{{ lead.kundName }}</h4>
                    <span class="text-sm text-muted">Erstellt am: {{ formatDate(lead.createdAt) }}</span>
                 </div>
                 <button class="btn-small">Details</button>
              </div>
           </div>
      </div>

      <!-- Kontakte Tab (Microsoft Graph Contacts) -->
      <div v-if="currentTab === 'kontakte'" class="tab-content">
        <div class="contact-filters mb-4">
          <FilterGroup label="Standort">
            <FilterChip :active="contactFilters.team === 'berlin'" @click="toggleContactTeam('berlin')">Berlin</FilterChip>
            <FilterChip :active="contactFilters.team === 'hamburg'" @click="toggleContactTeam('hamburg')">Hamburg</FilterChip>
            <FilterChip :active="contactFilters.team === 'koeln'" @click="toggleContactTeam('koeln')">Köln</FilterChip>
            <FilterChip :active="!contactFilters.team" @click="toggleContactTeam(null)">Alle</FilterChip>
          </FilterGroup>
          <FilterGroup label="Verknüpfung">
            <FilterChip :active="contactFilters.linked === true" @click="toggleContactLinked(true)">Kunde</FilterChip>
            <FilterChip :active="contactFilters.linked === false" @click="toggleContactLinked(false)">Kein Kunde</FilterChip>
            <FilterChip :active="contactFilters.linked === null" @click="toggleContactLinked(null)">Alle</FilterChip>
          </FilterGroup>
        </div>

        <div class="toolbar">
          <div class="search-group">
            <input v-model="contactSearch" type="text" placeholder="Kontakt suchen..." class="search-input" />
            <span class="count-tag">{{ filteredContacts.length }} Kontakte</span>
          </div>
          <button class="btn-group" @click="loadContacts" :disabled="contactsLoading">
            <font-awesome-icon :icon="['fas', 'rotate']" :spin="contactsLoading" />
            Aktualisieren
          </button>
        </div>

        <div v-if="contactsLoading && msContacts.length === 0" class="loading-state">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lädt Kontakte...
        </div>

        <div v-else-if="filteredContacts.length === 0" class="empty-list">
          <font-awesome-icon :icon="['fas', 'address-book']" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;" />
          <p>Keine externen Kontakte gefunden.</p>
        </div>

        <div v-else class="contacts-table-wrap">
          <table class="contacts-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Telefon</th>
                <th>Firma (companyName)</th>
                <th>Verknüpfter Kunde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredContacts" :key="c.id">
                <td class="contact-name">
                  <strong>{{ c.displayName }}</strong>
                  <span v-if="c.jobTitle" class="job-title">{{ c.jobTitle }}</span>
                </td>
                <td>{{ primaryEmail(c) || '–' }}</td>
                <td>{{ c.mobilePhone || (c.businessPhones && c.businessPhones[0]) || '–' }}</td>
                <td>
                  <span>{{ c.companyName || '–' }}</span>
                </td>
                <td>
                  <span v-if="getLinkedKunde(c)" class="linked-kunde" @click="openCustomer(getLinkedKunde(c))">
                    <font-awesome-icon :icon="['fas', 'link']" />
                    {{ getLinkedKunde(c).kundName }}
                  </span>
                  <span v-else class="no-link">–</span>
                </td>
                <td class="contact-team-badge">
                  <span class="team-badge">{{ c._team }}</span>
                </td>
                <td class="contact-actions">
                  <button class="btn-icon" @click.stop="openEditContact(c)" title="Bearbeiten">
                    <font-awesome-icon :icon="['fas', 'pen']" />
                  </button>
                  <button class="btn-icon btn-delete" @click.stop="deleteContactConfirm(c)" title="Kontakt löschen">
                    <font-awesome-icon :icon="['fas', 'trash']" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <KundenMergeModal 
      :is-open="showMergeModal" 
      @close="showMergeModal = false" 
      @saved="dataCache.loadKunden(true)" 
    />

    <KundenWatchlistReportModal
      v-if="showReportModal"
      @close="showReportModal = false"
    />

    <!-- Card Context Menu -->
    <ContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :options="contextMenuOptions"
      @select="handleContextMenuAction"
      @close="contextMenu.visible = false"
    />

    <!-- Contact Edit Modal -->
    <teleport to="body">
      <div v-if="editContact" class="modal-overlay" @click="editContact = null">
        <div class="contact-edit-modal" @click.stop>
          <div class="modal-header">
            <h3>Kontakt bearbeiten</h3>
            <button class="btn-icon" @click="editContact = null">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>Vorname</label>
              <input v-model="editForm.givenName" class="form-input" />
            </div>
            <div class="form-row">
              <label>Nachname</label>
              <input v-model="editForm.surname" class="form-input" />
            </div>
            <div class="form-row">
              <label>E-Mail</label>
              <input v-model="editForm.email" type="email" class="form-input" />
            </div>
            <div class="form-row">
              <label>Telefon (Mobil)</label>
              <input v-model="editForm.mobilePhone" class="form-input" />
            </div>
            <div class="form-row">
              <label>Telefon (Geschäftlich)</label>
              <input v-model="editForm.businessPhone" class="form-input" />
            </div>
            <div class="form-row">
              <label>Position</label>
              <input v-model="editForm.jobTitle" class="form-input" />
            </div>
            <div class="form-row">
              <label>Firma (companyName)</label>
              <input v-model="editForm.companyName" class="form-input" />
              <span v-if="editFormLinkedKunde" class="edit-linked-hint">
                <font-awesome-icon :icon="['fas', 'link']" /> {{ editFormLinkedKunde.kundName }}
              </span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="editContact = null">Abbrechen</button>
            <button class="btn-primary" @click="saveEditContact" :disabled="editSaving">
              <font-awesome-icon v-if="editSaving" :icon="['fas', 'spinner']" spin />
              Speichern
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Customer Detail Modal -->
    <teleport to="body">
      <div v-if="selectedKunde" class="modal-overlay" @click="selectedKunde = null">
        <div class="modal-content-wrapper" @click.stop>
          <CustomerCard 
            :kunde="selectedKunde"
            @close="selectedKunde = null"
          />
        </div>
      </div>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDataCache } from '@/stores/dataCache';
import { useAuth } from '@/stores/auth'; // Import Auth Store
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import FilterPanel from './FilterPanel.vue';
import FilterGroup from './FilterGroup.vue';
import FilterChip from './FilterChip.vue';
import FilterDivider from './FilterDivider.vue';
import FilterDropdown from './FilterDropdown.vue';
import CustomerCard from './CustomerCard.vue';
import CustomTooltip from './CustomTooltip.vue';
import KundenAnalytics from './KundenAnalytics.vue';
import KundenMergeModal from './KundenMergeModal.vue';
import KundenWatchlistReportModal from './KundenWatchlistReportModal.vue';
import ContextMenu from './ContextMenu.vue';
import api from '@/utils/api';

const dataCache = useDataCache();
const auth = useAuth(); // Init Auth Store
const route = useRoute();
const router = useRouter();

const baseTabs = [
  { id: 'overview', label: 'Übersicht', icon: ['fas', 'list'] },
  { id: 'analytics', label: 'Analytics', icon: ['fas', 'chart-bar'] },
  { id: 'leads', label: 'Leads', icon: ['fas', 'bullseye'] },
  { id: 'watchlist', label: 'Watchlist', icon: ['fas', 'binoculars'] },
  { id: 'kontakte', label: 'Kontakte', icon: ['fas', 'address-book'], admin: true }
];

const isAdmin = computed(() => (auth.user?.roles || []).includes('ADMIN'));
const tabs = computed(() => baseTabs.filter(t => !t.admin || isAdmin.value));

const currentTab = ref('overview');
const showMergeModal = ref(false);
const showReportModal = ref(false);
const searchQuery = ref('');
const isLoading = ref(false);
const filtersExpanded = ref(false);
const selectedKunde = ref(null);

// Context Menu
const contextMenu = ref({ visible: false, x: 0, y: 0 });
const contextMenuKunde = ref(null);

const contextMenuOptions = computed(() => {
  if (!contextMenuKunde.value) return [];
  const onWatchlist = isOnWatchlist(contextMenuKunde.value);
  return [
    { label: onWatchlist ? 'Von Watchlist entfernen' : 'Zur Watchlist hinzufügen', action: 'toggleWatchlist' }
  ];
});

function openContextMenu(kunde, event) {
  event.stopPropagation();
  const rect = event.currentTarget.getBoundingClientRect();
  contextMenuKunde.value = kunde;
  contextMenu.value = { visible: true, x: rect.right, y: rect.bottom + 4 };
}

function handleContextMenuAction(action) {
  if (action === 'toggleWatchlist' && contextMenuKunde.value) {
    toggleWatchlist(contextMenuKunde.value, new Event('click'));
  }
  contextMenu.value.visible = false;
  contextMenuKunde.value = null;
}

// Helper to map user location to GeschSt ID
function getUserGeschSt() {
  const loc = auth.user?.location?.toLowerCase();
  if (loc === 'berlin') return '1';
  if (loc === 'hamburg') return '2';
  if (loc === 'köln' || loc === 'koeln') return '3';
  return null;
}

// Get stored filters or set defaults
const storedFilters = localStorage.getItem('kundenFilters');
const defaultFilters = {
  geschSt: getUserGeschSt(), 
  status: 2, 
  sortBy: 'name', 
  sortDir: 'asc' 
};

const filters = ref(storedFilters ? { ...defaultFilters, ...JSON.parse(storedFilters) } : defaultFilters);

// Watchers

// 1. Sync Tab with URL
watch(currentTab, (newTab) => {
  if (route.query.tab !== newTab) {
    router.replace({ query: { ...route.query, tab: newTab } });
  }
});

watch(() => route.query.tab, (newTab) => {
  if (newTab && ['overview', 'analytics', 'leads', 'watchlist', 'kontakte'].includes(newTab)) {
    currentTab.value = newTab;
  }
}, { immediate: true });

// 2. Persist Filters
watch(filters, (newVal) => {
  localStorage.setItem('kundenFilters', JSON.stringify(newVal));
}, { deep: true });

onMounted(async () => {
  isLoading.value = true;
  // Initialize Tab from URL if present
  if (route.query.tab && ['overview', 'analytics', 'leads', 'watchlist', 'kontakte'].includes(route.query.tab)) {
    currentTab.value = route.query.tab;
  }
  // Initialize search from URL if present
  if (route.query.search) {
    searchQuery.value = route.query.search;
  }
  
  try {
    await dataCache.loadKunden();
  } catch (e) {
    console.error(e);
  } finally {
    isLoading.value = false;
  }
  document.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape);
});

function handleEscape(e) {
  if (e.key === 'Escape' && selectedKunde.value) {
    selectedKunde.value = null;
  }
}

function openCustomer(kunde) {
  selectedKunde.value = kunde;
}

const allKunden = computed(() => dataCache.kunden || []);

function getParentKundeId(kunde) {
  if (!kunde?.parentKunde) return null;
  return typeof kunde.parentKunde === 'object' ? kunde.parentKunde._id : kunde.parentKunde;
}

const superKundeIds = computed(() => {
  const ids = new Set();
  for (const kunde of allKunden.value) {
    const parentId = getParentKundeId(kunde);
    if (parentId) ids.add(parentId.toString());
  }
  return ids;
});

const childGeschStByParentId = computed(() => {
  const map = new Map();
  for (const kunde of allKunden.value) {
    const parentId = getParentKundeId(kunde);
    if (!parentId || !kunde.geschSt) continue;

    const key = parentId.toString();
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(String(kunde.geschSt));
  }
  return map;
});

function isSuperKunde(kunde) {
  return !!kunde?._id && superKundeIds.value.has(kunde._id.toString());
}

function matchesGeschStFilter(kunde, geschSt) {
  if (!geschSt) return true;
  if (String(kunde.geschSt) === String(geschSt)) return true;
  if (!isSuperKunde(kunde)) return false;

  const childGeschSt = childGeschStByParentId.value.get(kunde._id.toString());
  return !!childGeschSt && childGeschSt.has(String(geschSt));
}

const watchlistedKunden = computed(() => {
  const ids = new Set((auth.kundenWatchlist || []).map(id => id.toString()));
  return allKunden.value.filter(k => ids.has(k._id.toString()));
});

const watchlistSaving = ref(false);

async function toggleWatchlist(kunde, event) {
  event.stopPropagation();
  if (watchlistSaving.value) return;
  watchlistSaving.value = true;
  try {
    await auth.toggleKundeWatchlist(kunde._id);
  } finally {
    watchlistSaving.value = false;
  }
}

function isOnWatchlist(kunde) {
  return (auth.kundenWatchlist || []).some(id => id.toString() === kunde._id.toString());
}

// Helper for filtering & sorting
function processData(list) {
  let result = list;

  // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(k => 
      (k.kundName && k.kundName.toLowerCase().includes(q)) || 
      (k.kundenNr && k.kundenNr.toString().includes(q)) ||
      (k.kuerzel && k.kuerzel.toLowerCase().includes(q))
    );
  }

  // Filter: GeschSt
  if (filters.value.geschSt) {
    result = result.filter(k => matchesGeschStFilter(k, filters.value.geschSt));
  }

  // Filter: Status (only applied if set)
  if (filters.value.status) {
    result = result.filter(k => k.kundStatus == filters.value.status);
  }

  // Sort
  result = [...result].sort((a, b) => {
    let valA, valB;
    
    if (filters.value.sortBy === 'date') {
      valA = a.kundeSeit ? new Date(a.kundeSeit).getTime() : 0;
      valB = b.kundeSeit ? new Date(b.kundeSeit).getTime() : 0;
    } else {
      // Name default
      valA = (a.kundName || '').toLowerCase();
      valB = (b.kundName || '').toLowerCase();
    }

    if (valA < valB) return filters.value.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return filters.value.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return result;
}

// Overview: Status != 1 (Potentiell)
const filteredKunden = computed(() => {
  // Base list: All non-leads
  const raw = allKunden.value.filter(k => k.kundStatus !== 1);
  return processData(raw);
});

// Leads: Status == 1
const leads = computed(() => {
  // Base list: All leads
  // Note: We ignore filters.status here because status is fixed to 1
  const raw = allKunden.value.filter(k => k.kundStatus === 1);
  
  // Create a copy of filters to override status for processing
  // But wait, processData uses filters.value directly. 
  // We should make processData take options or handle status separately.
  // Instead of refactoring processData heavily, let's just use it but ensure status filter doesn't hide leads if set to 2/3
  
  // If user selected Status 2 or 3 in filters, leads list would be empty if we apply it blindly.
  // For Leads tab, we only care about GeschSt and Sort.
  
  let result = raw;
  
   // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(k => 
      (k.kundName && k.kundName.toLowerCase().includes(q)) || 
      (k.kundenNr && k.kundenNr.toString().includes(q)) ||
      (k.kuerzel && k.kuerzel.toLowerCase().includes(q))
    );
  }

  // Filter: GeschSt
  if (filters.value.geschSt) {
    result = result.filter(k => k.geschSt == filters.value.geschSt);
  }

  // Sort
  result = [...result].sort((a, b) => {
    let valA, valB;
    
    if (filters.value.sortBy === 'date') {
      valA = a.kundeSeit ? new Date(a.kundeSeit).getTime() : 0;
      valB = b.kundeSeit ? new Date(b.kundeSeit).getTime() : 0;
    } else {
      // Name default
      valA = (a.kundName || '').toLowerCase();
      valB = (b.kundName || '').toLowerCase();
    }

    if (valA < valB) return filters.value.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return filters.value.sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  
  return result;
});

function toggleSort(field) {
  if (filters.value.sortBy === field) {
    filters.value.sortDir = filters.value.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    filters.value.sortBy = field;
    filters.value.sortDir = 'asc';
  }
}

function setGeschStFilter(val) {
  filters.value.geschSt = val;
}

function setStatusFilter(val) {
  if (filters.value.status === val) {
    filters.value.status = null;
  } else {
    filters.value.status = val;
  }
}

function getStatusText(status) {
  switch(status) {
    case 1: return 'Potentiell';
    case 2: return 'Aktiv';
    case 3: return 'Inaktiv';
    default: return 'Unbekannt';
  }
}

function getStatusClass(status) {
  switch(status) {
    case 1: return 'status-lead';
    case 2: return 'status-active';
    case 3: return 'status-inactive';
    default: return '';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('de-DE');
}

// ======================== Kontakte (MS Graph) ========================

const msContacts = ref([]);
const contactsLoading = ref(false);
const contactSearch = ref('');
const editingContactId = ref(null);
const editCompanyValue = ref('');
const contactFilters = ref({ team: null, linked: null });
const editContact = ref(null);
const editForm = ref({});
const editSaving = ref(false);

function toggleContactTeam(val) {
  contactFilters.value.team = contactFilters.value.team === val ? null : val;
}

function toggleContactLinked(val) {
  contactFilters.value.linked = contactFilters.value.linked === val ? null : val;
}

async function loadContacts() {
  contactsLoading.value = true;
  try {
    const { data } = await api.get('/api/graph/contacts');
    msContacts.value = data.contacts || [];
  } catch (e) {
    console.error('Failed to load contacts:', e);
  } finally {
    contactsLoading.value = false;
  }
}

const filteredContacts = computed(() => {
  let list = msContacts.value;

  // Team filter
  if (contactFilters.value.team) {
    list = list.filter(c => c._team === contactFilters.value.team);
  }

  // Linked filter
  if (contactFilters.value.linked === true) {
    list = list.filter(c => !!getLinkedKunde(c));
  } else if (contactFilters.value.linked === false) {
    list = list.filter(c => !getLinkedKunde(c));
  }

  // Search
  if (contactSearch.value) {
    const q = contactSearch.value.toLowerCase();
    list = list.filter(c =>
      (c.displayName || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (primaryEmail(c) || '').toLowerCase().includes(q)
    );
  }
  return list;
});

function primaryEmail(contact) {
  return contact.emailAddresses?.[0]?.address || '';
}

function getLinkedKunde(contact) {
  const company = (contact.companyName || '').trim();
  if (!company) return null;
  return allKunden.value.find(k => k.kuerzel && k.kuerzel.toLowerCase() === company.toLowerCase());
}

const editFormLinkedKunde = computed(() => {
  const company = (editForm.value.companyName || '').trim();
  if (!company) return null;
  return allKunden.value.find(k => k.kuerzel && k.kuerzel.toLowerCase() === company.toLowerCase());
});

function openEditContact(contact) {
  editContact.value = contact;
  editForm.value = {
    givenName: contact.givenName || '',
    surname: contact.surname || '',
    email: primaryEmail(contact),
    mobilePhone: contact.mobilePhone || '',
    businessPhone: (contact.businessPhones && contact.businessPhones[0]) || '',
    jobTitle: contact.jobTitle || '',
    companyName: contact.companyName || '',
  };
}

async function saveEditContact() {
  if (!editContact.value || editSaving.value) return;
  editSaving.value = true;
  try {
    const f = editForm.value;
    const patch = {
      upn: editContact.value._upn,
      givenName: f.givenName,
      surname: f.surname,
      jobTitle: f.jobTitle,
      companyName: f.companyName,
      mobilePhone: f.mobilePhone || null,
      businessPhones: f.businessPhone ? [f.businessPhone] : [],
      emailAddresses: f.email ? [{ address: f.email, name: `${f.givenName} ${f.surname}`.trim() }] : [],
    };
    const { data } = await api.patch(`/api/graph/contacts/${editContact.value.id}`, patch);
    // Update local data
    const c = editContact.value;
    Object.assign(c, data.contact || {});
    editContact.value = null;
  } catch (e) {
    console.error('Failed to update contact:', e);
  } finally {
    editSaving.value = false;
  }
}

function startEditCompany(contact) {
  editingContactId.value = contact.id;
  editCompanyValue.value = contact.companyName || '';
}

async function saveCompany(contact) {
  const newVal = editCompanyValue.value.trim();
  try {
    await api.patch(`/api/graph/contacts/${contact.id}`, {
      companyName: newVal,
      upn: contact._upn
    });
    contact.companyName = newVal;
  } catch (e) {
    console.error('Failed to update company:', e);
  }
  editingContactId.value = null;
}

async function deleteContactConfirm(contact) {
  if (!confirm(`Kontakt "${contact.displayName}" wirklich löschen?`)) return;
  try {
    await api.delete(`/api/graph/contacts/${contact.id}`, {
      data: { upn: contact._upn }
    });
    msContacts.value = msContacts.value.filter(c => c.id !== contact.id);
  } catch (e) {
    console.error('Failed to delete contact:', e);
  }
}

// Load contacts when switching to kontakte tab
watch(currentTab, (tab) => {
  if (tab === 'kontakte' && msContacts.value.length === 0) {
    loadContacts();
  }
});
</script>

<style scoped>
.kunden-page {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.header-section h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.subtitle {
  color: var(--muted);
  font-size: 14px;
  margin-top: 4px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 2px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  flex-shrink: 0;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 16px;
  color: var(--muted);
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-btn:hover {
  color: var(--text);
  background: var(--hover);
  border-radius: 6px 6px 0 0;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: transparent;
}

/* Content */
.content-section {
  flex: 1;
  background: var(--tile-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 24px;
  overflow-y: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.search-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-group {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 1px solid var(--border);
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--text);
    transition: background 0.2s;
}

.btn-group:hover {
    background: var(--hover-bg, #f5f5f5);
}

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  min-width: 250px;
}

.count-tag {
  background: var(--tile-bg);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--muted);
  border: 1px solid var(--border);
}

.kunden-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.kunde-card {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kunde-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.card-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ctx-menu-btn {
  background: transparent;
  border: none;
  padding: 6px 8px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.2s;
  line-height: 1;
  border-radius: 4px;
  font-size: 18px;
}

.ctx-menu-btn:hover {
  color: var(--text);
  background: var(--hover);
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.super-kunde-tag {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--primary);
  color: var(--primary);
  background: transparent;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 600;
}

.status-active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.status-inactive { background: rgba(107, 114, 128, 0.2); color: #6b7280; }
.status-lead { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }

.card-body p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--muted);
}

.card-body strong {
  color: var(--text);
}

.kuerzel-inline {
  color: var(--primary);
  font-weight: 500;
}

/* Empty & Loading States */
.empty-list, .loading-state {
  text-align: center;
  padding: 40px;
  color: var(--muted);
}

/* Flex Center Helper */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.placeholder-box {
  text-align: center;
  max-width: 400px;
}

.big-icon {
  font-size: 48px;
  color: var(--muted);
  margin-bottom: 16px;
  opacity: 0.5;
}

/* Leads List Specific */
.kunden-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lead-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.lead-info h4 {
  margin: 0 0 4px 0;
  color: var(--text);
}

.text-muted { color: var(--muted); }
.text-sm { font-size: 12px; }

.ml-2 { margin-left: 6px; }
.mb-4 { margin-bottom: 16px; }

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.kunden-grid .kunde-card {
  cursor: pointer;
}

.lead-item {
  cursor: pointer;
}

.contact-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
  margin-top: 6px;
  
  svg { color: var(--muted); }
}

.more-contacts {
  font-size: 11px;
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 10px;
  color: var(--muted);
}

/* Modal */
.modal-overlay {
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
  padding: 20px;
}

.modal-content-wrapper {
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border-radius: 12px;
}

/* Contacts Table */
.contact-filters {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.contacts-table-wrap {
  overflow-x: auto;
}

.contacts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.contacts-table th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border);
  color: var(--muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.contacts-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.contacts-table tbody tr:hover {
  background: var(--hover);
}

.contact-name strong {
  display: block;
}

.job-title {
  font-size: 11px;
  color: var(--muted);
  display: block;
}

.company-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline-edit {
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-input {
  padding: 4px 8px;
  border: 1px solid var(--primary);
  border-radius: 4px;
  font-size: 13px;
  background: var(--tile-bg);
  color: var(--text);
  min-width: 120px;
}

.btn-icon {
  background: transparent;
  border: none;
  padding: 4px 6px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.2s;
  font-size: 13px;
}

.btn-icon:hover {
  color: var(--text);
}

.linked-kunde {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--primary);
  cursor: pointer;
  font-weight: 500;
}

.linked-kunde:hover {
  text-decoration: underline;
}

.no-link {
  color: var(--muted);
}

.team-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--hover);
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 600;
}

.contact-team-badge {
  text-align: right;
}

.contact-actions {
  text-align: right;
  white-space: nowrap;
}

.btn-delete:hover {
  color: #ef4444;
}

/* Contact Edit Modal */
.contact-edit-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.contact-edit-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.contact-edit-modal .modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.contact-edit-modal .modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row label {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.edit-linked-hint {
  font-size: 12px;
  color: var(--primary);
  margin-top: 2px;
}

.contact-edit-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: var(--hover);
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---- Mobile Responsive ---- */
@media (max-width: 768px) {
  .kunden-page {
    padding: 12px;
    gap: 10px;
  }

  .content-section {
    padding: 12px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .search-group {
    width: 100%;
    flex-wrap: wrap;
  }

  .search-input {
    min-width: unset;
    flex: 1;
    width: 100%;
  }

  .btn-group {
    width: 100%;
    justify-content: center;
  }

  .kunden-grid {
    grid-template-columns: 1fr;
  }

  .contacts-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .contacts-table {
    min-width: 640px;
  }

  .contact-filters {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
