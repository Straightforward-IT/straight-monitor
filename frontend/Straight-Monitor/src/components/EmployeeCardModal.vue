<template>
  <teleport to="body">
    <div
      v-if="mitarbeiterId"
      class="ecm-overlay"
      @click.self="$emit('close')"
    >
      <div class="ecm-container" role="dialog" aria-modal="true">
        <button class="ecm-close" @click="$emit('close')" aria-label="Schließen">
          <font-awesome-icon icon="fa-solid fa-times" />
        </button>
        <EmployeeCard
          :mitarbeiterId="mitarbeiterId"
          :initiallyExpanded="true"
          @close="$emit('close')"
        />
      </div>
    </div>
  </teleport>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import EmployeeCard from "./EmployeeCard.vue";

export default {
  name: "EmployeeCardModal",
  components: { FontAwesomeIcon, EmployeeCard },
  props: {
    mitarbeiterId: { type: String, default: null },
  },
  emits: ["close"],
  mounted() {
    document.addEventListener("keydown", this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this.handleEscape);
  },
  methods: {
    handleEscape(e) {
      if (e.key === "Escape") this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
.ecm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  z-index: 1000;
  overflow-y: auto;
}

.ecm-container {
  position: relative;
  width: 100%;
  max-width: 900px;
  border-radius: 16px;
  overflow: hidden;
}

.ecm-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.14s ease, color 0.14s ease;

  &:hover {
    background: var(--soft);
    color: var(--text);
  }
}
</style>
