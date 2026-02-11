<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h3>Mitarbeiter löschen</h3>
        <button class="close-btn" @click="$emit('close')">
          <font-awesome-icon icon="fa-solid fa-times" />
        </button>
      </header>

      <div class="modal-body">
        <p class="warning-text">
          Möchten Sie den Mitarbeiter <strong>{{ name }}</strong> wirklich
          löschen? Diese Aktion kann nicht rückgängig gemacht werden.
        </p>

        <div class="options-group">
          <label class="checkbox-container">
            <input type="checkbox" v-model="deleteFlip" />
            <span class="checkmark"></span>
            <div class="label-content">
              <span>Flip Profil löschen</span>
              <small class="description"
                >Entfernt den Benutzer auch aus der Flip-App.</small
              >
            </div>
          </label>

          <label class="checkbox-container">
            <input type="checkbox" v-model="completeAsana" />
            <span class="checkmark"></span>
            <div class="label-content">
              <span>Asana Task erledigen</span>
              <small class="description"
                >Markiert den verknüpften Asana-Task als abgeschlossen.</small
              >
            </div>
          </label>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Abbrechen</button>
        <button class="btn btn-danger" @click="confirm" :disabled="loading">
          <font-awesome-icon
            :icon="loading ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'"
            :class="{ 'fa-spin': loading }"
          />
          Löschen
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "confirm"]);

const deleteFlip = ref(true);
const completeAsana = ref(false);

function confirm() {
  emit("confirm", {
    deleteFlip: deleteFlip.value,
    completeAsana: completeAsana.value,
  });
}
</script>

<style scoped lang="scss">
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-color);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #dc3545;
  }
}

.modal-body {
  padding: 1.5rem;
}

.warning-text {
  margin-bottom: 1.5rem;
  color: var(--text-color);
  line-height: 1.5;
}

.options-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
  padding: 0.75rem;
  background: var(--bg-hover);
  border-radius: 8px;

  input {
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0.1rem;
    accent-color: #dc3545;
  }
}

.label-content {
  display: flex;
  flex-direction: column;

  span {
    font-weight: 500;
  }

  .description {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;

  &.btn-ghost {
    background: transparent;
    color: var(--text-muted);
    &:hover {
      color: var(--text-color);
      background: var(--bg-hover);
    }
  }

  &.btn-danger {
    background: #dc3545;
    color: white;
    &:hover {
      background: darken(#dc3545, 10%);
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem;

  &:hover {
    color: var(--text-color);
  }
}
</style>
