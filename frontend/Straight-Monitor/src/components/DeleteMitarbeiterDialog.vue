<template>
  <ModalFrame size="sm" layer="elevated" @close="$emit('close')">
    <template #header>
      <h3 class="danger-title">Mitarbeiter löschen</h3>
    </template>

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

    <template #footer>
      <button class="btn btn-ghost" @click="$emit('close')">Abbrechen</button>
      <button class="btn btn-danger" @click="confirm" :disabled="loading">
        <font-awesome-icon
          :icon="loading ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'"
          :class="{ 'fa-spin': loading }"
        />
        Löschen
      </button>
    </template>
  </ModalFrame>
</template>

<script setup>
import { ref } from "vue";
import ModalFrame from "@/components/frames/ModalFrame.vue";

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
.danger-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #dc3545;
}

.warning-text {
  margin-bottom: 1.5rem;
  color: var(--text);
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
  background: var(--hover);
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
    color: var(--muted);
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }
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
    color: var(--muted);
    &:hover {
      color: var(--text);
      background: var(--hover);
    }
  }

  &.btn-danger {
    background: #dc3545;
    color: white;
    &:hover {
      background: color.adjust(#dc3545, $lightness: -10%);
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
