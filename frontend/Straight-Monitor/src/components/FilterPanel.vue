
<template>
  <div class="filter-panel" :class="{ 'is-expanded': expanded, 'is-locked': locked }">
    <div class="filter-header" @click="toggle" :title="locked ? 'Filter kann nicht zugeklappt werden (aktiver Personenfilter)' : (expanded ? 'Filter einklappen' : 'Filter ausklappen')">
      <h3>
        <slot name="title">Filter</slot>
      </h3>
      <div class="header-actions">
        <slot name="header-actions"></slot>
        <button class="collapse-btn" type="button" :disabled="locked">
          <font-awesome-icon :icon="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" />
        </button>
      </div>
    </div>
    
    <div v-show="expanded" class="filter-content">
      <div class="filter-layout">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faChevronUp, faChevronDown, faFilter } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faChevronUp, faChevronDown, faFilter);

export default {
  name: "FilterPanel",
  components: { FontAwesomeIcon },
  props: {
    expanded: {
      type: Boolean,
      default: false
    },
    locked: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:expanded'],
  methods: {
    toggle() {
      // Nur verhindern, dass zugeklappt wird wenn gelockt, aber Öffnen erlauben
      if (this.locked && this.expanded) return;
      this.$emit('update:expanded', !this.expanded);
    }
  }
};
</script>

<style scoped lang="scss">
.filter-panel {
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  /* Use conditional overflow for dropdowns */
  overflow: hidden; 
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  --soft: var(--hover);
  --brand: var(--primary);
}

.filter-panel.is-expanded {
  overflow: visible;
}

.filter-panel.is-locked {
  .filter-header {
    cursor: not-allowed;
    
    &:hover {
      background: var(--bg);
      
      .collapse-btn {
        background: transparent;
        border-color: var(--border);
        color: var(--muted);
        cursor: not-allowed;
      }
    }
  }
  
  .collapse-btn {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg);
  border-bottom: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    background: var(--hover);
    
    .collapse-btn {
        background: var(--bg);
        border-color: var(--primary);
        color: var(--primary);
    }
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;

    &::before {
      content: '';
      display: inline-block;
      width: 16px; 
      height: 16px;
      /* Legacy icon, keeping it */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%2364748b' d='M3.9 54.9C10.5 40.9 24.5 32 40 32l432 0c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9 320 448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6l0-79.1L9 97.3C-1 85.4-2.8 68.8 3.9 54.9z'/%3E%3C/svg%3E");
      opacity: 0.7;
      background-size: contain;
      background-repeat: no-repeat;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  opacity: 0.8;
  font-size: 0.9rem;
}

.filter-content {
  padding: 20px;
  background: var(--bg);
  border-top: 1px solid var(--border);
  animation: slideDown 0.3s ease-out;
}

/* New Standard Layout */
.filter-layout {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  background: var(--soft);
  border-radius: 12px;
  border: 1px solid var(--border);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile Optimierung */
@media (max-width: 768px) {
  .filter-panel {
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .filter-header {
    padding: 10px 16px;
    
    h3 {
      font-size: 0.95rem;
    }
  }
  
  .filter-content {
    padding: 12px;
  }

  /* Responsive layout adjustment */
  .filter-layout {
      padding: 12px;
      gap: 8px;
  }
}
</style>
