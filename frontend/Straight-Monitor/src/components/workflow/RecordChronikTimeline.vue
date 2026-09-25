<template>
  <div class="record-chronik">
    <div v-if="loading" class="record-chronik__empty"><font-awesome-icon :icon="['fas', 'spinner']" spin /></div>
    <div v-else-if="!items.length" class="record-chronik__empty">Noch keine Einträge.</div>
    <div v-else ref="feed" class="record-chronik__feed">
      <template v-for="item in items" :key="item.key || item.entry?._id || item.id">
        <div v-if="item.kind === 'divider'" class="record-chronik__divider"><span>Jetzt</span></div>
        <article v-else-if="item.kind === 'comment'" class="record-chronik__entry" :class="{ 'record-chronik__entry--system': item.entry.isSystem }">
          <div class="record-chronik__dot"><font-awesome-icon v-if="item.entry.isSystem" :icon="['fas', 'circle-dot']" /><span v-else>{{ initials(item.entry.author) }}</span></div>
          <div class="record-chronik__content"><div class="record-chronik__meta"><span v-if="!item.entry.isSystem">{{ item.entry.author }}</span><time>{{ formatDate(item.entry.createdAt) }}</time></div><div class="record-chronik__text-wrap"><p>{{ item.entry.text }}</p><button v-if="!item.entry.isSystem && canDelete(item.entry)" type="button" title="Löschen" @click="$emit('delete', item.entry._id)"><font-awesome-icon :icon="['fas', 'trash']" /></button></div></div>
        </article>
        <slot v-else name="item" :item="item" />
      </template>
    </div>
    <RecordChronikComposer
      v-if="composer"
      :draft="draft"
      :adding="adding"
      :current-user-name="currentUserName"
      @update:draft="$emit('update:draft', $event)"
      @add="$emit('add')"
    />
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCircleDot, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import RecordChronikComposer from './RecordChronikComposer.vue';
library.add(faCircleDot, faSpinner, faTrash);
const props = defineProps({ items: { type: Array, default: () => [] }, loading: { type: Boolean, default: false }, draft: { type: String, default: '' }, adding: { type: Boolean, default: false }, composer: { type: Boolean, default: true }, currentUserName: { type: String, default: '' }, canDelete: { type: Function, default: () => false }, formatDate: { type: Function, default: (value) => new Date(value).toLocaleString('de-DE') } });
defineEmits(['update:draft', 'add', 'delete']);
const feed = ref(null);
function initials(name) { return String(name || '?').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'; }
watch(() => props.items, () => nextTick(() => { if (feed.value) feed.value.scrollTop = feed.value.scrollHeight; }), { deep: true, flush: 'post' });
</script>

<style scoped lang="scss">
.record-chronik { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.record-chronik__empty { color: var(--muted); padding: 20px; text-align: center; }
.record-chronik__feed { display: flex; flex: 1; flex-direction: column; gap: 0; min-height: 0; overflow-y: auto; padding: 4px 2px; position: relative; }
:global(.cdf-body--static) .record-chronik__feed { padding-right: 18px; }
.record-chronik__feed::before { background: var(--border); bottom: 0; content: ''; left: 13px; position: absolute; top: 13px; width: 1px; }
.record-chronik__divider { align-items: center; color: var(--primary); display: flex; font-size: 11px; font-weight: 700; gap: 8px; letter-spacing: .08em; margin: 6px 0; position: relative; text-transform: uppercase; z-index: 1; }
.record-chronik__divider span { background: var(--tile-bg); border: 1px solid var(--primary); border-radius: 10px; padding: 1px 6px; }
.record-chronik__divider::before,.record-chronik__divider::after { background: var(--primary); content: ''; flex: 1; height: 1px; opacity: .5; }
.record-chronik__entry { display: flex; gap: 10px; padding: 5px 0; position: relative; }
.record-chronik__dot { align-items: center; background: var(--primary); border-radius: 50%; color: #fff; display: inline-flex; flex: 0 0 22px; font-size: 9px; font-weight: 700; height: 22px; justify-content: center; position: relative; z-index: 1; }
.record-chronik__entry--system .record-chronik__dot { background: var(--tile-bg); color: var(--muted); font-size: 12px; }
.record-chronik__content { flex: 1; margin-bottom: 2px; min-width: 0; }.record-chronik__entry--system .record-chronik__content { padding: 2px 0; }
.record-chronik__meta { align-items: center; color: var(--muted); display: flex; flex-wrap: wrap; font-size: 11px; gap: 6px; margin-bottom: 3px; }.record-chronik__entry--system .record-chronik__meta { margin-bottom: 0; }.record-chronik__meta span { color: var(--text); font-size: 12px; font-weight: 600; }.record-chronik__meta time { margin-left: auto; }
.record-chronik__text-wrap { display: block; position: relative; }.record-chronik__text-wrap p { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; line-height: 1.45; margin: 0; overflow-wrap: anywhere; padding: 6px 28px 6px 10px; white-space: pre-wrap; }.record-chronik__entry--system .record-chronik__text-wrap p { background: none; border: 0; color: var(--muted); font-size: 12px; font-style: italic; padding: 0; }
.record-chronik__text-wrap button { background: var(--panel); border: 0; border-radius: 4px; color: var(--muted); cursor: pointer; opacity: 0; padding: 2px; position: absolute; right: 6px; top: 50%; transform: translateY(-50%); transition: opacity .15s; }.record-chronik__text-wrap:hover button { opacity: 1; }
</style>
