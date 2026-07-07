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
    
    <teleport to="body">
      <div
        v-if="isOpen"
        class="dropdown-menu"
        :style="menuStyle"
      >
        <slot></slot>
      </div>
    </teleport>
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
      isOpen: false,
      menuStyle: {}
    };
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside);
    window.addEventListener('scroll', this.updatePosition, true);
    window.addEventListener('resize', this.updatePosition);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('scroll', this.updatePosition, true);
    window.removeEventListener('resize', this.updatePosition);
  },
  methods: {
    toggle() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) this.$nextTick(this.updatePosition);
    },
    close() {
      this.isOpen = false;
    },
    updatePosition() {
      const trigger = this.$refs.dropdownRef;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      this.menuStyle = {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        zIndex: 9999,
      };
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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

@media (max-width: 768px) {
  .dropdown-trigger {
    padding: 4px 10px;
    font-size: 12px;
    min-width: 110px;
  }

  .trigger-label {
    max-width: 130px;
  }

  .dropdown-menu {
    min-width: 180px;
    max-height: 240px;
  }
}
</style>
