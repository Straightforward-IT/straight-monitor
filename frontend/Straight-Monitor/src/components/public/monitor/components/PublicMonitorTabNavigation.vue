<template>
  <nav
    class="public-monitor-tab-navigation"
    :class="`public-monitor-tab-navigation--${mode}`"
    aria-label="Hauptnavigation"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="{ active: activeTab === item.id }"
      @click="$emit('select', item.id)"
    >
      <span class="public-monitor-tab-navigation__icon">
        <img
          v-if="item.id === 'profile' && profileImageUrl"
          :src="profileImageUrl"
          class="profile-avatar profile-avatar--nav"
          alt=""
        />
        <span v-else-if="item.id === 'profile'" class="profile-avatar profile-avatar--nav">{{ initials }}</span>
        <font-awesome-icon v-else :icon="item.icon" />
        <i v-if="item.badge">{{ item.badge }}</i>
      </span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  activeTab: { type: String, required: true },
  initials: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  mode: { type: String, default: 'mobile' },
  profileImageUrl: { type: String, default: '' },
});

defineEmits(['select']);
</script>
