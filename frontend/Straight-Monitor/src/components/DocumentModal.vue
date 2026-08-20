<template>
  <template v-if="doc">
    <!-- ESC priority is handled here (assign > employee > kunde > doc), so frame ESC is off -->
    <DocumentCard
      :doc="doc"
      :personDetails="personDetails"
      :filteredTeamleiter="filteredTeamleiter"
      :filteredMitarbeiter="filteredMitarbeiter"
      minimizable
      :minimize-id="modalId"
      :minimize-title="modalTitle"
      :close-on-escape="false"
      @close="closeDoc"
      @assign="openAssignDialog"
      @filter-teamleiter="filterByPerson('filterTeamleiter', $event)"
      @filter-mitarbeiter="filterByPerson('filterMitarbeiter', $event)"
      @open-employee="openEmployee"
      @open-kunde="openKundeCard"
    />

    <!-- Employee Modal -->
    <EmployeeCardModal
      :mitarbeiterId="selectedMitarbeiter"
      @close="selectedMitarbeiter = null"
    />

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
              <span class="value">{{ doc.bezeichnung }}</span>
            </div>
            <div class="info-row">
              <span class="label">Name im Formular:</span>
              <span class="value unassigned-name">{{ doc.details?.[`name_${assignRole}`] }}</span>
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

          <div v-if="loadingEmployees" class="loading-state">
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
  </template>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { computed } from 'vue';
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock';
import { useDataCache } from '@/stores/dataCache';
import { useCustomerModals } from '@/composables/useCustomerModals';
import DocumentCard from '@/components/Modals/DocumentCard.vue';
import EmployeeCardModal from '@/components/EmployeeCardModal.vue';
import api from '@/utils/api';
import logger from '@/utils/logger';
import { getDocumentModalTitle } from '@/utils/documentModalTitle';

import {
  faXmark,
  faSpinner,
  faMagnifyingGlass,
  faUserSlash,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { library } from '@fortawesome/fontawesome-svg-core';

library.add(faXmark, faSpinner, faMagnifyingGlass, faUserSlash, faChevronRight);

export default {
  name: 'DocumentModal',
  components: { FontAwesomeIcon, DocumentCard, EmployeeCardModal },

  props: {
    doc: { type: Object, required: true },
    filteredTeamleiter: { type: String, default: null },
    filteredMitarbeiter: { type: String, default: null },
  },
  emits: ['close'],

  setup() {
    const dataCache = useDataCache();
    const dockedModal = useCurrentDockedModal();
    const { openCustomer } = useCustomerModals();
    const isMinimized = dockedModal?.minimized ?? computed(() => false);
    const isTopmost = dockedModal?.topmost ?? computed(() => true);
    return { dataCache, isMinimized, isTopmost, openCustomer };
  },

  data() {
    return {
      personDetails: {},
      selectedMitarbeiter: null,
      showAssignModal: false,
      assignRole: null,
      assignSearchQuery: '',
      employees: [],
      loadingEmployees: false,
    };
  },

  computed: {
    modalId() {
      const doc = this.doc;
      return `document-${doc?._id || doc?.id || 'active'}`;
    },
    modalTitle() {
      const doc = this.doc;
      const assignmentNumber = doc?.details?.auftragnummer;
      const assignment = this.dataCache.auftraege?.find(
        item => String(item.auftragNr) === String(assignmentNumber)
      );
      return getDocumentModalTitle(doc, assignment?.eventTitel);
    },
    filteredEmployees() {
      if (!this.assignSearchQuery.trim()) return this.employees;
      const query = this.assignSearchQuery.toLowerCase();
      return this.employees.filter(emp => {
        const fullName = `${emp.vorname} ${emp.nachname}`.toLowerCase();
        const email = (emp.email || '').toLowerCase();
        return fullName.includes(query) || email.includes(query);
      });
    },
  },

  watch: {
    doc: {
      immediate: true,
      handler(doc, oldDoc) {
        if (oldDoc && doc !== oldDoc) this.resetSatellites();
        if (!doc) return;
        if (doc.details?.name_teamleiter) this.fetchPersonDetails(doc.details.name_teamleiter);
        if (doc.details?.name_mitarbeiter) this.fetchPersonDetails(doc.details.name_mitarbeiter);
      },
    },
  },

  mounted() {
    document.addEventListener('keydown', this.handleEscape);
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
  },

  methods: {
    resetSatellites() {
      this.selectedMitarbeiter = null;
      this.showAssignModal = false;
      this.assignRole = null;
      this.assignSearchQuery = '';
    },

    closeDoc() {
      this.$emit('close');
      // Keep the shareable URL in sync when closing on /dokumente
      if (this.$route.query.docId) {
        const { docId, ...rest } = this.$route.query;
        this.$router.replace({ query: rest });
      }
    },

    handleEscape(e) {
      if (e.key !== 'Escape' || this.isMinimized || !this.isTopmost) return;
      if (this.showAssignModal) this.closeAssignModal();
      else if (this.selectedMitarbeiter) this.selectedMitarbeiter = null;
      else this.closeDoc();
    },

    openEmployee(role, mitarbeiterId) {
      this.selectedMitarbeiter = mitarbeiterId;
    },

    filterByPerson(queryKey, name) {
      // Close first (old UX), then let Dokumente.vue apply/toggle the filter via query param
      this.$emit('close');
      this.$router.push({ path: '/dokumente', query: { [queryKey]: name } });
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

    async openKundeCard(kundeId) {
      try {
        const response = await api.get(`/api/kunden/${kundeId}`);
        this.openCustomer(response.data);
      } catch (error) {
        console.error('Error loading Kunde:', error);
      }
    },

    async openAssignDialog(role) {
      this.assignRole = role;
      this.assignSearchQuery = '';
      this.showAssignModal = true;
      if (this.employees.length === 0) await this.fetchEmployees();
      this.$nextTick(() => {
        this.$refs.assignSearchInput?.focus();
      });
    },

    closeAssignModal() {
      this.showAssignModal = false;
      this.assignRole = null;
      this.assignSearchQuery = '';
    },

    async fetchEmployees() {
      this.loadingEmployees = true;
      try {
        const res = await api.get('/api/personal/mitarbeiter');
        this.employees = (res.data?.data || [])
          .filter(emp => emp.isActive !== false)
          .sort((a, b) => {
            const nameA = `${a.vorname} ${a.nachname}`.toLowerCase();
            const nameB = `${b.vorname} ${b.nachname}`.toLowerCase();
            return nameA.localeCompare(nameB, 'de');
          });
      } catch (e) {
        console.error('Fehler beim Laden der Mitarbeiter:', e);
        this.employees = [];
      } finally {
        this.loadingEmployees = false;
      }
    },

    async selectEmployee(employee) {
      const doc = this.doc;
      const roleName = this.assignRole === 'teamleiter' ? 'Teamleiter' : 'Mitarbeiter';
      const formularName = doc.details?.[`name_${this.assignRole}`] || '(nicht angegeben)';

      const confirmed = confirm(
        `${employee.vorname} ${employee.nachname} als ${roleName} zuweisen?\n\n` +
        `Dokument: ${doc.bezeichnung}\n` +
        `Name im Formular: ${formularName}\n\n` +
        `Bitte bestätigen Sie die Zuweisung.`
      );
      if (!confirmed) {
        logger.debug('Assignment cancelled by user');
        return;
      }

      try {
        const documentId = doc._id || doc.id;
        const payload = { documentId };
        if (this.assignRole === 'teamleiter') {
          payload.teamleiterId = employee._id;
          payload.name_teamleiter = doc.details?.name_teamleiter;
        } else {
          payload.mitarbeiterId = employee._id;
          payload.name_mitarbeiter = doc.details?.name_mitarbeiter;
        }

        logger.debug('Assigning employee to document:', payload);
        const response = await api.post('/api/reports/assign', payload);

        if (response.data?.success) {
          logger.info(`✅ ${employee.vorname} ${employee.nachname} assigned as ${this.assignRole}`);
          this.closeAssignModal();
          this.closeDoc();
          // Refresh the shared cache so open pages (e.g. Dokumente) pick up the new status
          await this.dataCache.loadDocuments(true);
          alert(`✅ ${employee.vorname} ${employee.nachname} wurde erfolgreich als ${roleName} zugewiesen.`);
        } else {
          throw new Error(response.data?.error || 'Unbekannter Fehler');
        }
      } catch (error) {
        logger.error('Assignment error:', error);
        alert('❌ Fehler beim Zuweisen: ' + (error.response?.data?.error || error.message));
      }
    },
  },
};
</script>

<style scoped lang="scss">
/* Overlay chrome for the satellite modals (moved from Dokumente.vue) */
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
  background: var(--surface, var(--panel));
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
}

.modal.large {
  max-width: 900px;
  height: 90vh;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }
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

  &:hover {
    background: var(--hover);
    color: var(--text);
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;

  &.no-padding {
    padding: 0;
  }
}

/* Assignment modal */
.assign-modal {
  max-width: 500px;
  height: 600px;
  max-height: 85vh;

  .modal-body {
    padding: 24px;
  }
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

  &:last-child {
    margin-bottom: 0;
  }

  .label {
    font-weight: 600;
    color: var(--muted);
    min-width: 140px;
  }

  .value {
    color: var(--text);
    flex: 1;
  }
}

.unassigned-name {
  color: var(--muted);
  opacity: 0.7;
  font-style: italic;
}

.search {
  position: relative;
  display: flex;
  align-items: center;

  .search-ic {
    position: absolute;
    left: 12px;
    color: var(--muted);
    font-size: 0.9rem;
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: 10px 12px 10px 36px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface, var(--panel));
    color: var(--text);
    font-size: 0.9rem;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
    }
  }
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
  background: var(--surface, var(--panel));
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    background: var(--hover);
    border-color: var(--primary);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 10%, transparent);

    .chevron {
      transform: translateX(3px);
      color: var(--primary);
    }
  }
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

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--muted);
  gap: 12px;

  svg {
    font-size: 32px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
  }
}
</style>
