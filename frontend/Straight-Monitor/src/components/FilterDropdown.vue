<template>
  <div class="filter-dropdown" ref="dropdownRef">
    <button 
      class="dropdown-trigger" 
      :class="{ 'active': hasValue || isOpen }"
      type="button"
      @click="toggle"
    >
      <span class="trigger-label">
        <slot name="label">{{ label }}</slot>
      </span>
      <font-awesome-icon icon="fa-solid fa-chevron-down" class="chevron" :class="{ 'rotate': isOpen }" />
    </button>
    
    <div v-if="isOpen" class="dropdown-menu">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faChevronDown);

export default {
  name: "FilterDropdown",
  components: { FontAwesomeIcon },
  props: {
    label: {
      type: String,
      default: "Auswählen"
    },
    hasValue: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isOpen: false
    };
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    toggle() {
      this.isOpen = !this.isOpen;
    },
    close() {
      this.isOpen = false;
    },
    handleClickOutside(event) {
      if (this.$refs.dropdownRef && !this.$refs.dropdownRef.contains(event.target)) {
        this.close();
      }
    }
  }
};
</script>

<style scoped>
.filter-dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-trigger {
  /* Match FilterChip styles exactly */
  --brand: var(--primary);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 12px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  line-height: inherit;
  justify-content: space-between;
  min-width: 140px;
}

.dropdown-trigger:hover {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}

.dropdown-trigger.active {
  border-color: var(--brand);
  color: var(--brand);
}

.trigger-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}

.chevron {
  font-size: 0.85em;
  transition: transform 0.2s ease;
  opacity: 0.7;
}

.rotate {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--surface); /* Use surface instead of tile-bg for consistency */
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 100;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

/* Helper styles for content inside slot */
:deep(.dropdown-item) {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: background 0.15s;
}

:deep(.dropdown-item:hover) {
  background: var(--hover);
}

:deep(.dropdown-item input) {
  margin-right: 10px;
  accent-color: var(--primary);
}

:deep(.no-options) {
    padding: 12px;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
    font-style: italic;
}
</style>
