<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Kunden zusammenfügen</h3>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      
      <div class="modal-body">
        <p class="desc">Wähle Kunden aus, die gruppiert werden sollen. Diese werden in Analytics unter einem Super-Kunden zusammengefasst.</p>

        <!-- Step 1: Select Children -->
        <div class="form-group">
          <label class="label">Kunden auswählen (werden zu Unter-Kunden)</label>
          <div class="multi-select-box">
             <label v-for="k in filteredCustomers" :key="k._id" class="checkbox-row" :class="{ disabled: k.parentKunde }">
               <input type="checkbox" :value="k._id" v-model="selectedChildIds">
               <span class="cust-name">
                 {{ k.kundName }} 
                 <small>(#{{ k.kundenNr }})</small>
                 <span v-if="k.parentKunde" class="tag-parent">hat Parent</span>
               </span>
             </label>
          </div>
          <input type="text" v-model="search" placeholder="Suche..." class="mini-search" />
        </div>

        <!-- Step 2: Choose Parent Mode -->
        <div class="form-group toggle-group">
          <label class="label">Ziel (Super-Kunde)</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" value="new" v-model="mode"> Neuen erstellen
            </label>
            <label class="radio-label">
              <input type="radio" value="existing" v-model="mode"> Bestehenden zuweisen
            </label>
          </div>
        </div>

        <!-- Step 3a: New Parent -->
        <div v-if="mode === 'new'" class="form-group">
          <label class="label">Name des neuen Super-Kunden</label>
          <input type="text" v-model="newParentName" placeholder="Z.B. Konzern XY" class="input-text">
        </div>

        <!-- Step 3b: Existing Parent -->
        <div v-else class="form-group">
           <label class="label">Bestehenden Kunden wählen</label>
           <select v-model="selectedParentId" class="select-box">
             <option :value="null">Bitte wählen...</option>
             <option v-for="k in potentialParents" :key="k._id" :value="k._id">
               {{ k.kundName }} (#{{ k.kundenNr }})
             </option>
           </select>
        </div>

      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="close">Abbrechen</button>
        <button class="btn-save" :disabled="!isValid" @click="save">
          <span v-if="saving">Speichert...</span>
          <span v-else>Speichern & Gruppieren</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDataCache } from '@/stores/dataCache';
import api from '@/utils/api';

const props = defineProps({
  isOpen: Boolean
});
const emit = defineEmits(['close', 'saved']);

const dataCache = useDataCache();
const customers = computed(() => dataCache.kunden || []);

const search = ref('');
const selectedChildIds = ref([]);
const mode = ref('new');
const newParentName = ref('');
const selectedParentId = ref(null);
const saving = ref(false);

const filteredCustomers = computed(() => {
  const q = search.value.toLowerCase();
  return customers.value
    .filter(k => (k.kundName || '').toLowerCase().includes(q) || String(k.kundenNr).includes(q))
    .sort((a,b) => (a.kundName||'').localeCompare(b.kundName||''));
});

const potentialParents = computed(() => {
    // Cannot be one of the selected children
    return customers.value.filter(k => !selectedChildIds.value.includes(k._id));
});

function close() {
  emit('close');
  selectedChildIds.value = [];
  newParentName.value = '';
  selectedParentId.value = null;
  mode.value = 'new';
}

const isValid = computed(() => {
  if (selectedChildIds.value.length === 0) return false;
  if (mode.value === 'new') return newParentName.value.length > 2;
  return !!selectedParentId.value;
});

async function save() {
  if (!isValid.value) return;
  saving.value = true;
  try {
    const payload = {
      childIds: selectedChildIds.value,
      parentId: mode.value === 'existing' ? selectedParentId.value : undefined,
      newParentName: mode.value === 'new' ? newParentName.value : undefined
    };
    
    await api.post('/api/kunden/group', payload);
    await dataCache.fetchKunden(); // Refresh data
    emit('saved');
    close();
  } catch (err) {
    alert('Fehler beim Gruppieren: ' + (err.response?.data?.message || err.message));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { 
  position: fixed; 
  inset: 0; 
  background: rgba(0,0,0,0.6); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  z-index: 9999;
  backdrop-filter: blur(2px);
}
.modal-content { 
  background: var(--tile-bg, #fff); 
  color: var(--text-color, #333);
  padding: 24px; 
  border-radius: 12px; 
  width: 500px; 
  max-width: 90%; 
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  display: flex; 
  flex-direction: column;
}
.modal-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 20px; 
}
.modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 600; }
.close-btn { 
  background: none; 
  border: none; 
  font-size: 24px; 
  cursor: pointer; 
  color: var(--muted);
}
.desc { margin-bottom: 20px; font-size: 0.9rem; color: var(--muted); }

.multi-select-box { 
  height: 200px; 
  overflow-y: auto; 
  border: 1px solid var(--border); 
  padding: 8px; 
  border-radius: 6px; 
  display: flex; 
  flex-direction: column; 
  gap: 2px;
  background: var(--bg-body);
}

.checkbox-row { 
  display: flex; 
  gap: 8px; 
  align-items: center; 
  cursor: pointer; 
  padding: 4px 8px;
  border-radius: 4px;
}
.checkbox-row:hover { background: var(--hover-bg); }
.checkbox-row.disabled { opacity: 0.6; }

.cust-name { font-size: 0.9rem; display: flex; align-items: center; gap: 6px; flex: 1; justify-content: space-between; }
.tag-parent { font-size: 0.7rem; background: var(--bg-item); padding: 1px 4px; border-radius: 3px; }

.mini-search {
  width: 100%;
  padding: 6px;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: var(--bg-card);
  color: var(--text-color);
  font-size: 0.85rem;
}

.form-group { margin-bottom: 18px; display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 0.85rem; fontWeight: 600; text-transform: uppercase; color: var(--muted); }

.radio-group { display: flex; gap: 16px; margin-top: 4px; }
.radio-label { display: flex; gap: 6px; align-items: center; cursor: pointer; font-size: 0.95rem; }

.input-text, .select-box { 
  width: 100%; 
  padding: 10px; 
  border: 1px solid var(--border); 
  border-radius: 6px; 
  background: var(--bg-body); 
  color: var(--text-color);
  font-size: 1rem;
}

.modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.btn-save { 
  background: var(--primary); 
  color: white; 
  padding: 10px 20px; 
  border: none; 
  border-radius: 6px; 
  cursor: pointer; 
  font-weight: 500;
  transition: opacity 0.2s;
}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-cancel { 
  background: transparent; 
  color: var(--text-color);
  border: 1px solid var(--border); 
  padding: 10px 20px; 
  border-radius: 6px; 
  cursor: pointer; 
}
.btn-cancel:hover { background: var(--hover-bg); }
</style>