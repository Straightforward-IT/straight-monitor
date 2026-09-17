<template>
  <div class="gt-node-wrap">
    <div :class="['gt-card', { 'gt-ancestor': !node.direct }]">
      <span class="gt-name">{{ node.name }}</span>
      <span v-if="node.direct" class="gt-badge">Mitglied</span>
      <button
        v-if="node.direct"
        type="button"
        class="gt-remove"
        title="Aus Gruppe entfernen"
        aria-label="Aus Gruppe entfernen"
        :disabled="removingGroupId === node.id"
        @click.stop="$emit('remove', node.id)"
      >
        <font-awesome-icon :icon="removingGroupId === node.id ? 'fa-solid fa-spinner' : 'fa-solid fa-minus'" :spin="removingGroupId === node.id" />
      </button>
    </div>

    <ul v-if="node.children?.length" class="gt-children">
      <li v-for="child in node.children" :key="child.id">
        <FlipGroupNode :node="child" :removing-group-id="removingGroupId" @remove="$emit('remove', $event)" />
      </li>
    </ul>
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

export default {
  name: 'FlipGroupNode',
  components: { FontAwesomeIcon },
  props: {
    node: { type: Object, required: true },
    removingGroupId: { type: String, default: null }
  },
  emits: ['remove']
}
</script>

<style lang="scss">
/* ── Org Chart Tree (unscoped for recursive rendering) ── */
.gt-node-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gt-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 28px 6px 12px;
  border-radius: 8px;
  background: var(--soft);
  border: 1px solid var(--border);
  font-size: 12px;
  white-space: nowrap;
  position: relative;
  cursor: default;
  user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: color-mix(in srgb, var(--primary, #e07b00) 40%, var(--border));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  }

  &.gt-ancestor {
    opacity: 0.65;
  }
}

.gt-name {
  color: var(--text);
  font-weight: 500;
}

.gt-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary, #e07b00) 15%, transparent);
  color: var(--primary, #e07b00);
  font-weight: 600;
}

.gt-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--muted, #777);
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: #c83737;
    background: color-mix(in srgb, #c83737 12%, transparent);
  }

  &:disabled {
    cursor: wait;
  }
}

/* Children container */
.gt-children {
  list-style: none;
  margin: 0;
  padding: 20px 0 0;
  display: flex;
  justify-content: center;
  position: relative;

  /* Vertical line from parent card down to the horizontal bar */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 1px;
    height: 20px;
    background: var(--muted, #999);
  }

  > li {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    padding: 20px 12px 0;

    /* Vertical line from horizontal bar down to child card */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      width: 1px;
      height: 20px;
      background: var(--muted, #999);
    }

    /* Horizontal bar spanning siblings */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--muted, #999);
    }

    /* First child: clip left half of horizontal bar */
    &:first-child::after {
      left: 50%;
    }

    /* Last child: clip right half of horizontal bar */
    &:last-child::after {
      right: 50%;
    }

    /* Only child: no horizontal bar needed */
    &:only-child::after {
      display: none;
    }
  }
}
</style>
