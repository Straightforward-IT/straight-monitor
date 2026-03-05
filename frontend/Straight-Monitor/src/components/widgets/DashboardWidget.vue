<template>
  <article class="dash-widget">
    <header class="dash-widget__header">
      <slot name="title">
        <div class="dash-widget__title-group">
          <font-awesome-icon v-if="icon" :icon="icon" class="dash-widget__icon" />
          <h3>{{ title }}</h3>
        </div>
      </slot>
      <slot name="actions" />
    </header>

    <div class="dash-widget__body">
      <!-- Loading skeleton -->
      <div v-if="loading" class="dash-widget__skeleton">
        <div class="skel skel--line" />
        <div class="skel skel--line skel--short" />
        <div class="skel skel--line" />
      </div>
      <slot v-else />
    </div>

    <footer v-if="linkTo || $slots.footer" class="dash-widget__footer">
      <slot name="footer">
        <RouterLink v-if="linkTo" :to="linkTo" class="dash-widget__link">
          {{ linkLabel }}
          <font-awesome-icon :icon="['fas', 'arrow-right']" class="dash-widget__link-arrow" />
        </RouterLink>
      </slot>
    </footer>
  </article>
</template>

<script setup>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { RouterLink } from "vue-router";

defineProps({
  title: { type: String, default: '' },
  icon: { type: Array, default: null },
  linkTo: { type: [String, Object], default: null },
  linkLabel: { type: String, default: "Mehr anzeigen" },
  loading: { type: Boolean, default: false },
});
</script>

<style scoped lang="scss">
.dash-widget {
  display: flex;
  flex-direction: column;
  aspect-ratio: 1 / 1;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--border) 60%, var(--primary));
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
  }

  &__title-group {
    display: flex;
    align-items: center;
    gap: 10px;

    h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }
  }

  &__icon {
    font-size: 14px;
    color: var(--primary);
  }

  &__body {
    flex: 1;
    padding: 16px 20px;
    overflow-y: auto;
  }

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 0;
  }

  &__footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s ease;

    &:hover {
      color: var(--primary);

      .dash-widget__link-arrow {
        transform: translateX(3px);
      }
    }
  }

  &__link-arrow {
    font-size: 11px;
    transition: transform 0.15s ease;
  }
}

@keyframes skel-pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1;   }
}

.skel {
  height: 14px;
  border-radius: 6px;
  background: var(--border);
  animation: skel-pulse 1.5s ease-in-out infinite;

  &--short { width: 60%; }
  &--line  { width: 100%; }
}

@media (max-width: 480px) {
  .dash-widget {
    &__header {
      padding: 12px 14px 0;
    }
    &__body {
      padding: 12px 14px;
    }
    &__footer {
      padding: 10px 14px;
    }
  }
}
</style>
