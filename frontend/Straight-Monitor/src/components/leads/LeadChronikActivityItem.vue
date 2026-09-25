<template>
  <article class="lead-chronik-activity" :class="{ 'lead-chronik-activity--done': activity.erledigt, 'lead-chronik-activity--overdue': isOverdue(activity) }">
    <div class="lead-chronik-activity__dot"><button type="button" :title="activity.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'" @click="$emit('toggle', activity)"><font-awesome-icon :icon="['fas', activity.erledigt ? 'circle-check' : 'circle']" /></button></div>
    <div class="lead-chronik-activity__content"><div class="lead-chronik-activity__meta"><font-awesome-icon :icon="typeIcon(activity.type)" /><span>{{ typeLabel(activity.type) }}</span><time>{{ formatDate(activity.datum) }}</time></div><p>{{ activity.titel || '(kein Titel)' }}</p><span v-if="activity.kontakt?.displayName"><font-awesome-icon :icon="['fas', 'user']" /> {{ activity.kontakt.displayName }}</span></div>
  </article>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
const props = defineProps({ activity: { type: Object, required: true } });
defineEmits(['toggle']);
const iconByType = { anruf: ['fas', 'phone'], meeting: ['fas', 'users'], email: ['fas', 'envelope'], aufgabe: ['fas', 'circle-check'], sonstiges: ['fas', 'calendar-days'] };
function typeIcon(type) { return iconByType[type] || ['fas', 'calendar-days']; }
function typeLabel(type) { return { anruf: 'Anruf', meeting: 'Termin', email: 'E-Mail', aufgabe: 'Aufgabe', sonstiges: 'Aktivität' }[type] || 'Aktivität'; }
function formatDate(value) { return value ? new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
function isOverdue(activity) { return !activity.erledigt && activity.datum && new Date(activity.datum) < new Date(); }
</script>

<style scoped lang="scss">
.lead-chronik-activity { display: flex; gap: 10px; padding: 5px 0; position: relative; }.lead-chronik-activity__dot { align-items: center; background: var(--tile-bg); display: flex; flex: 0 0 22px; justify-content: center; position: relative; z-index: 1; }.lead-chronik-activity__dot button { background: var(--tile-bg); border: 0; color: var(--muted); cursor: pointer; font-size: 16px; padding: 0; }.lead-chronik-activity__dot button:hover { color: var(--primary); }.lead-chronik-activity__content { flex: 1; min-width: 0; }.lead-chronik-activity__meta { align-items: center; color: var(--muted); display: flex; font-size: 11px; gap: 6px; }.lead-chronik-activity__meta span { color: var(--primary); font-weight: 600; }.lead-chronik-activity__meta time { margin-left: auto; }.lead-chronik-activity__content p { background: var(--panel); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px; margin: 3px 0; padding: 6px 10px; }.lead-chronik-activity__content > span { color: var(--muted); font-size: 11px; }.lead-chronik-activity--done { opacity: .55; }.lead-chronik-activity--done .lead-chronik-activity__content p { text-decoration: line-through; }.lead-chronik-activity--overdue .lead-chronik-activity__content p { color: var(--danger, #b91c1c); }
</style>
