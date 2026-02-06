<template>
  <div class="tl-page">
    <div class="header">
      <div class="title-section">
        <button class="back-btn" @click="$router.push('/dashboard')">
          <font-awesome-icon icon="arrow-left" /> Back
        </button>
        <h1>Teamleiter Auswertung</h1>
      </div>
      
      <div class="filter-section">
        <label>Zeitraum:</label>
        <input 
          type="month" 
          v-model="selectedMonth" 
          @change="fetchData" 
          @click="$event.target.showPicker && $event.target.showPicker()"
          class="month-picker" 
        />
      </div>
    </div>

    <div class="content">
      <div v-if="loading" class="loading">
        <font-awesome-icon icon="spinner" spin size="2x" />
        <p>Lade Daten...</p>
      </div>

      <div v-else-if="error" class="error">
        {{ error }}
      </div>

      <div v-else class="table-container">
        
        <!-- Document Modal -->
        <div v-if="selectedDoc" class="modal-overlay" @click.self="selectedDoc = null">
           <div class="modal-content">
             <DocumentCard 
               :doc="selectedDoc" 
               @close="selectedDoc = null"
               @open-employee="handleOpenEmployee"
             />
           </div>
        </div>

        <!-- Employee Modal -->
        <div v-if="selectedEmployee" class="modal-overlay z-high" @click.self="selectedEmployee = null">
           <div class="modal-content large">
             <div class="modal-header">
               <h2>Mitarbeiter Details</h2>
               <button class="close-btn" @click="selectedEmployee = null">×</button>
             </div>
             <div class="modal-body no-padding">
                <EmployeeCard 
                  :ma="selectedEmployee"
                  :initiallyExpanded="true"
                  @close="selectedEmployee = null"
                />
             </div>
           </div>
        </div>

        <div class="stats-cards">
          <div class="card">
            <span class="label">Anzahl Teamleiter</span>
            <span class="value">{{ teamleiterList.length }}</span>
          </div>
          <div class="card">
            <span class="label">Gesamt Einsätze</span>
            <span class="value">{{ totalEinsaetze }}</span>
          </div>
        </div>

        <table class="tl-table">
          <thead>
            <tr>
              <th @click="sortBy('nachname')">Name 
                <span v-if="sortKey === 'nachname'">{{ sortAsc ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('personalnr')">Personal-Nr.
                <span v-if="sortKey === 'personalnr'">{{ sortAsc ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('einsatzCount')">Anzahl Einsätze
                <span v-if="sortKey === 'einsatzCount'">{{ sortAsc ? '▲' : '▼' }}</span>
              </th>
              <th @click="sortBy('reportCount')">Anzahl Berichte
                <span v-if="sortKey === 'reportCount'">{{ sortAsc ? '▲' : '▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="tl in sortedTeamleiter" :key="tl._id">
              <tr @click="toggleExpand(tl._id)" class="main-row" :class="{ expanded: expandedRows.includes(tl._id) }">
                <td>
                  <font-awesome-icon :icon="expandedRows.includes(tl._id) ? 'chevron-down' : 'chevron-right'" class="chevron" />
                  {{ tl.vorname }} {{ tl.nachname }}
                </td>
                <td>{{ tl.personalnr }}</td>
                <td class="text-right">{{ tl.einsatzCount }}</td>
                <td class="text-right">{{ tl.reportCount }} / {{ tl.einsatzCount }}</td>
              </tr>
              <tr v-if="expandedRows.includes(tl._id)" class="detail-row">
                <td colspan="4">
                  <div class="detail-content">
                    <table class="inner-table">
                      <thead>
                        <tr>
                          <th class="w-date">Datum</th>
                          <th>Bezeichnung</th>
                          <th>Auftrag / Event</th>
                          <th class="w-status">Status</th>
                          <th class="w-action">Bericht</th>
                          <th class="w-action">Evaluierung</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr 
                          v-for="(einsatz, idx) in tl.einsaetze" 
                          :key="idx"
                          class="clickable-row"
                        >
                          <td @click="openOrder(einsatz.auftragNr, einsatz.geschSt, einsatz.datumVon)">
                            <CustomTooltip text="Job anzeigen" position="mouse">
                              {{ formatDate(einsatz.datumVon) }}
                            </CustomTooltip>
                          </td>
                          <td @click="openOrder(einsatz.auftragNr, einsatz.geschSt, einsatz.datumVon)">
                            <CustomTooltip text="Job anzeigen" position="mouse">
                              {{ einsatz.bezeichnung }}
                            </CustomTooltip>
                          </td>
                          <td @click="openOrder(einsatz.auftragNr, einsatz.geschSt, einsatz.datumVon)">
                            <CustomTooltip text="Job anzeigen" position="mouse">
                                <div class="cell-content">
                                    <div v-if="einsatz.eventTitel" style="font-weight:500;">{{ einsatz.eventTitel }}</div>
                                    <div class="small-sub">{{ einsatz.auftragNr }}</div>
                                </div>
                            </CustomTooltip>
                          </td>
                          <td style="text-align: center;" @click="openOrder(einsatz.auftragNr, einsatz.geschSt, einsatz.datumVon)">
                            <CustomTooltip text="Job anzeigen" position="mouse">
                              <font-awesome-icon 
                                v-if="einsatz.reportStatus === 'present' || einsatz.evalStatus === 'present'" 
                                icon="check-circle" 
                                class="status-icon success"
                              />
                              <font-awesome-icon 
                                v-else 
                                icon="times-circle" 
                                class="status-icon missing"
                              />
                            </CustomTooltip>
                          </td>
                          <td style="text-align: center;">
                            <CustomTooltip text="Event Report Öffnen" position="mouse" v-if="einsatz.eventReport">
                                <img 
                                  :src="eventReportIconUrl" 
                                  class="action-icon" 
                                  @click.stop="openReport(einsatz.eventReport)"
                                  alt="Report"
                                />
                            </CustomTooltip>
                          </td>
                          <td style="text-align: center;">                           
                             <CustomTooltip text="Evaluierung Öffnen" position="mouse" v-if="einsatz.evaluierung">
                                <img 
                                  :src="evaluierungIconUrl" 
                                  class="action-icon" 
                                  @click.stop="openReport(einsatz.evaluierung)"
                                  alt="Report"
                                />
                            </CustomTooltip>
                          </td>
                        </tr>
                         <tr v-if="!tl.einsaetze || tl.einsaetze.length === 0">
                          <td colspan="6" class="muted">Keine Details verfügbar</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="teamleiterList.length === 0">
              <td colspan="4" class="no-data">Keine Teamleiter gefunden hab den Key 50055 geprüft.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api'; 
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faChevronRight, faChevronDown, faArrowLeft, faSpinner, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import CustomTooltip from './CustomTooltip.vue';
import DocumentCard from './DocumentCard.vue';
import EmployeeCard from './EmployeeCard.vue';
import eventReportIconUrl from '@/assets/eventreport.png';
import evaluierungIconUrl from '@/assets/evaluierung.png';

library.add(faChevronRight, faChevronDown, faArrowLeft, faSpinner, faCheckCircle, faTimesCircle);

const router = useRouter();
const teamleiterList = ref([]);
const loading = ref(true);
const error = ref(null);
const sortKey = ref('einsatzCount');
const sortAsc = ref(false); 
const expandedRows = ref([]); // Array of expanded IDs
const selectedDoc = ref(null);
const selectedEmployee = ref(null);

// Default current month YYYY-MM
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const selectedMonth = ref(`${yyyy}-${mm}`);

const toggleExpand = (id) => {
  if (expandedRows.value.includes(id)) {
    expandedRows.value = expandedRows.value.filter(rowId => rowId !== id);
  } else {
    expandedRows.value.push(id);
  }
};

const formatDate = (val) => {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

const totalEinsaetze = computed(() => {
  return teamleiterList.value.reduce((acc, curr) => acc + curr.einsatzCount, 0);
});

const sortedTeamleiter = computed(() => {
  return [...teamleiterList.value].sort((a, b) => {
    let valA = a[sortKey.value];
    let valB = b[sortKey.value];

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortAsc.value ? -1 : 1;
    if (valA > valB) return sortAsc.value ? 1 : -1;
    return 0;
  });
});

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = true; // Default asc for new text columns
    // If switching to number column, maybe desc default is better?
    if (key === 'einsatzCount') sortAsc.value = false;
  }
};

const openOrder = (nr, geschSt, date) => {
  if(!nr) return;
  const query = { auftragnr: nr };
  if(geschSt) query.geschSt = geschSt;
  if(date) query.focusDate = date;
  router.push({ path: '/auftraege', query });
};

const openReport = (doc) => {
  if (doc) selectedDoc.value = doc;
};

const handleOpenEmployee = async (role, id) => {
  if (!id) return;
  try {
    const response = await api.get(`/api/personal/mitarbeiter/${id}`);
    const employeeData = response.data.data;
    
    // Load Flip profile if flip_id exists
    if (employeeData.flip_id) {
      try {
        const flipResponse = await api.get(`/api/personal/flip/by-id/${employeeData.flip_id}`);
        employeeData.flip = flipResponse.data;
      } catch (flipError) {
        console.error('Error loading Flip profile:', flipError);
      }
    }
    
    selectedEmployee.value = employeeData;
  } catch (err) {
    console.error("Fehler beim Laden des Mitarbeiters:", err);
    // Optional warning notification
  }
};

const fetchData = async () => {
  try {
    loading.value = true;
    expandedRows.value = []; // Reset expanded on reload
    
    // Parse selectedMonth (YYYY-MM)
    const [year, month] = selectedMonth.value.split('-');

    const response = await api.get('/api/personal/teamleiter-stats', {
      params: { month, year }
    }); 
    teamleiterList.value = response.data;
    loading.value = false;
  } catch (err) {
    console.error(err);
    error.value = "Fehler beim Laden der Daten.";
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.tl-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  color: var(--text);
  /* Provide surface color for child components like EmployeeCard */
  --surface: var(--tile-bg);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 16px;
  
  h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 0;
  }
}

.filter-section {
  display: flex;
  align-items: center;
  gap: 8px;
  
  label {
    font-weight: 500;
    font-size: 14px;
  }
}

.month-picker {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-body);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  position: relative; /* Position context for full click area */

  /* Make calendar icon cover entire input */
  &::-webkit-calendar-picker-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  
  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.back-btn {
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background: var(--hover);
  }
}

.stats-cards {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;

  .card {
    background: var(--tile-bg);
    border: 1px solid var(--border);
    padding: 16px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    min-width: 150px;

    .label {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .value {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
    }
  }
}

.table-container {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.tl-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  th {
    background: rgba(0,0,0,0.02);
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    color: var(--muted);
    cursor: pointer;
    user-select: none;

    &:hover {
      color: var(--text);
    }
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: var(--hover);
  }

  .text-right {
    text-align: right;
  }
  
  .no-data {
    text-align: center;
    padding: 30px;
    color: var(--muted);
  }
}

.loading, .error {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 16px;
  color: var(--muted);
}

.error {
  color: #ef4444;
}

.main-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.chevron {
  margin-right: 8px;
  width: 12px;
  color: var(--muted);
}

.detail-row {
  background: rgba(0,0,0,0.02);
  
  td {
    padding: 0 !important;
    border-bottom: 1px solid var(--border);
  }
}

.detail-content {
  padding: 16px;
  background: var(--bg-body); 
  /* leicht abgedunkelt oder aufgehellt je nach Theme, 
     var(--bg-body) ist oft der Hintergrund, var(--tile-bg) die Karte. 
     Hier wollen wir einen Kontras. Im Code ist tile-bg der Container. */
  background: rgba(128,128,128, 0.05);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
}

.clickable-row {
  cursor: pointer;

  td {
    transition: background-color 0.2s ease;
  }
  
  &:hover td {
    background-color: rgba(0,0,0,0.08) !important;
  }
}

.inner-table {
  width: 100%;
  font-size: 13px;
  table-layout: fixed; /* Ensures columns respect widths strictly */
  
  th {
    text-transform: none;
    font-size: 11px; /* Slightly smaller font for headers */
    padding: 6px 4px;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }
  
  .w-date {
    width: 75px;
  }

  .w-status {
    width: 45px;
    text-align: center;
  }
  
  .w-action {
    width: 65px; /* Enough for title but compact */
    text-align: center;
  }

  td {
    padding: 6px 4px;
    border-bottom: 1px solid rgba(128,128,128, 0.2);
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.muted {
  color: var(--muted);
  font-style: italic;
  text-align: center;
}

.status-icon {
  font-size: 16px;
}

.status-icon.success {
  color: #10b981; /* Green */
}

.status-icon.missing {
  color: #ef4444; /* Red */
  opacity: 0.5;
}

.small-sub {
  font-size: 0.85em;
  color: var(--muted);
}

.action-icon {
    width: 24px;
    height: 24px;
    cursor: pointer;
    transition: transform 0.2s;
    object-fit: contain;

    &:hover {
        transform: scale(1.1);
    }
}

.ml-2 {
    margin-left: 8px;
}

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
  
  &.z-high {
    z-index: 1100;
  }
}

.modal-content {
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  background: var(--tile-bg); /* Ensure modal container has background */
  display: flex;
  flex-direction: column;
  
  &.large {
    max-width: 900px;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--muted);
    padding: 0 8px;
    
    &:hover {
      color: var(--text);
    }
  }
}

.modal-body {
  overflow-y: auto;
  flex: 1;
  padding: 20px;
  
  &.no-padding {
    padding: 0;
  }
}
</style>
