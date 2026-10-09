<template>
  <DashboardWidget
    title="Flip Posts heute"
    :icon="['fas', 'bullhorn']"
    :loading="loading"
  >
    <template #actions>
      <AppIconButton
        variant="ghost"
        size="sm"
        label="Flip Posts aktualisieren"
        :loading="loading"
        @click="loadPosts"
      >
        <font-awesome-icon
          v-if="!loading"
          :icon="['fas', 'rotate-right']"
        />
      </AppIconButton>
    </template>
    <p
      v-if="error"
      class="wfp-error"
      role="alert"
    >
      {{ error }}
    </p>
    <ul
      v-else-if="posts.length"
      class="wfp-list"
    >
      <li
        v-for="post in posts"
        :key="post.id"
        class="wfp-row"
      >
        <div class="wfp-info">
          <span class="wfp-title">{{ postTitle(post) }}</span>
          <span class="wfp-author">{{ authorName(post) }}</span>
        </div>
        <span class="wfp-views">
          <font-awesome-icon :icon="['fas', 'eye']" />
          {{ formatViews(post.views_count) }} Aufrufe
        </span>
      </li>
    </ul>
    <p
      v-else
      class="wfp-empty"
    >
      Heute wurden noch keine Flip Posts der Team-Accounts gefunden.
    </p>
  </DashboardWidget>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import DashboardWidget from './DashboardWidget.vue';

const posts = ref([]);
const loading = ref(false);
const error = ref('');
const numberFormat = new Intl.NumberFormat('de-DE');

const postTitle = (post) => {
  const content = post.content ?? [];
  const localized = content.find(item => /^de(?:-|$)/i.test(item.language ?? ''))
    ?? content.find(item => item.primary_language)
    ?? content[0];
  return localized?.title || 'Ohne Titel';
};

const authorName = (post) =>
  [post.author?.first_name, post.author?.last_name].filter(Boolean).join(' ') || 'Unbekannter Autor';

const formatViews = (count) =>
  Number.isFinite(count) ? numberFormat.format(count) : '—';

async function loadPosts() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const { data: locations } = await api.get('/api/locations');
    if (!Array.isArray(locations)) throw new Error('Unexpected locations response shape.');
    const authorIds = [...new Set(locations
      .filter(location => location.isActive !== false)
      .map(location => location.flipOfficeUserId?.trim())
      .filter(Boolean))];
    if (!authorIds.length) {
      error.value = 'Für die Standorte sind noch keine Flip-Office-Benutzer-IDs hinterlegt.';
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const params = {
      status: ['PUBLISHED'],
      date_from: start.toISOString(),
      date_to: new Date(end.getTime() - 1).toISOString(),
      sort: ['PUBLISHED_AT_DESC'],
      embed: ['AUTHOR', 'VIEWS_COUNT'],
      content_format: 'PLAIN',
      page_limit: 25,
    };
    const collected = new Map();
    for (const authorId of authorIds) {
      const cursors = new Set();
      let cursor;
      do {
        const { data } = await api.get('/api/flip-posts', {
          params: { ...params, author_id: authorId, ...(cursor && { page_cursor: cursor }) },
          paramsSerializer: { indexes: null },
          headers: { 'Accept-Language': 'de-DE' },
        });
        if (!Array.isArray(data?.posts) || typeof data.pagination?.has_more !== 'boolean') {
          throw new Error('Unexpected Flip posts response shape.');
        }
        for (const post of data.posts) {
          const publishedAt = Date.parse(post.info?.published_at);
          if (post.author_id === authorId && post.info?.status === 'PUBLISHED'
            && publishedAt >= start.getTime() && publishedAt < end.getTime()) {
            collected.set(post.id, post);
          }
        }
        cursor = data.pagination.has_more ? data.pagination.next_cursor : null;
        if (data.pagination.has_more && (typeof cursor !== 'string' || !cursor || cursors.has(cursor))) {
          throw new Error('Invalid Flip posts pagination cursor.');
        }
        if (cursor) cursors.add(cursor);
      } while (cursor);
    }
    posts.value = [...collected.values()].sort((a, b) =>
      Date.parse(b.info.published_at) - Date.parse(a.info.published_at));
  } catch (cause) {
    error.value = 'Flip Posts konnten nicht geladen werden. Bitte erneut aktualisieren.';
    console.error('WidgetFlipPosts fetch error:', cause);
  } finally {
    loading.value = false;
  }
}

onMounted(loadPosts);
</script>

<style scoped lang="scss">
.wfp-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.wfp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);

  &:last-child { border-bottom: none; }
}

.wfp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wfp-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}

.wfp-author,
.wfp-views {
  font-size: 11px;
  color: var(--muted);
}

.wfp-views {
  flex-shrink: 0;
  white-space: nowrap;
}

.wfp-empty,
.wfp-error {
  font-size: 12px;
  text-align: center;
  padding: 16px 0;
  color: var(--muted);
}

.wfp-error {
  color: var(--status-danger-text);
}
</style>
