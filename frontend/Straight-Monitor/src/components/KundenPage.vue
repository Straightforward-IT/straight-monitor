<template>
  <div class="kunden-page">
    <div class="header-section">
      <h1>Kunden</h1>
      <p class="subtitle">Verwaltung und Übersicht der Kunden</p>
    </div>

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
      
      <!-- Shared Filter Panel (Not for Analytics) -->
      <FilterPanel 
        v-if="currentTab !== 'analytics'"
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
           <input v-model="searchQuery" type="text" placeholder="Suchen..." class="search-input" />
           <span class="count-tag">{{ filteredKunden.length }} Kunden</span>
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
                <h3>{{ kunde.kundName || 'Unbenannt' }}</h3>
                <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
                  {{ getStatusText(kunde.kundStatus) }}
                </span>
              </div>
              <div class="card-body">
                <p><strong>Nr:</strong> {{ kunde.kundenNr }}</p>
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

    </div>

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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
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

const dataCache = useDataCache();
const auth = useAuth(); // Init Auth Store

const tabs = [
  { id: 'overview', label: 'Übersicht', icon: ['fas', 'list'] },
  { id: 'analytics', label: 'Analytics', icon: ['fas', 'chart-bar'] },
  { id: 'leads', label: 'Leads', icon: ['fas', 'bullseye'] }
];

const currentTab = ref('overview');
const searchQuery = ref('');
const isLoading = ref(false);
const filtersExpanded = ref(false);
const selectedKunde = ref(null);

// Helper to map user location to GeschSt ID
const getUserGeschSt = () => {
  const loc = auth.user?.location?.toLowerCase();
  if (loc === 'berlin') return '1';
  if (loc === 'hamburg') return '2';
  if (loc === 'köln' || loc === 'koeln') return '3';
  return null;
};

const filters = ref({
  geschSt: getUserGeschSt(), // Default to user location
  status: 2, // Default to Aktiv (2)
  sortBy: 'name', 
  sortDir: 'asc' 
});

onMounted(async () => {
  isLoading.value = true;
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

// Helper for filtering & sorting
function processData(list) {
  let result = list;

  // Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(k => 
      (k.kundName && k.kundName.toLowerCase().includes(q)) || 
      (k.kundenNr && k.kundenNr.toString().includes(q))
    );
  }

  // Filter: GeschSt
  if (filters.value.geschSt) {
    result = result.filter(k => k.geschSt == filters.value.geschSt);
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
      (k.kundenNr && k.kundenNr.toString().includes(q))
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

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
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
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  border-radius: 12px;
}
</style>
