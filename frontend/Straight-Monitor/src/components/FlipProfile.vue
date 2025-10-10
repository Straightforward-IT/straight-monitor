<template>
  <div class="flip-profile">
    <!-- Profile Overview -->
    <section class="profile-section">
      <h3>
        <font-awesome-icon icon="fa-solid fa-id-badge" />
        Profil
      </h3>
      <div class="data-grid">
        <div>
          <dt>Status</dt>
          <dd>
            <span :class="['status-badge', userStatus]">
              {{ formatStatus(flipUser.status) }}
            </span>
          </dd>
        </div>
        <div>
          <dt>Benutzername</dt>
          <dd>{{ flipUser.benutzername || "—" }}</dd>
        </div>
        <div>
          <dt>Erstellt</dt>
          <dd>{{ formatDate(flipUser.erstellungsdatum) }}</dd>
        </div>
        <div>
          <dt>Rolle</dt>
          <dd>{{ flipUser.rolle || "—" }}</dd>
        </div>
      </div>
    </section>

    <!-- Groups -->
    <section class="profile-section">
      <h3>
        <font-awesome-icon icon="fa-solid fa-users" />
        Gruppen
      </h3>
      <div v-if="flipUser.groups?.length" class="groups">
        <div v-for="group in flipUser.groups" :key="group.id" class="group">
          <span class="group-name">{{ group.name }}</span>
        </div>
      </div>
      <div v-else class="empty">
        Keine Gruppen zugewiesen
      </div>
    </section>

    <!-- Custom Attributes -->
    <section class="profile-section" v-if="hasAttributes">
      <h3>
        <font-awesome-icon icon="fa-solid fa-tags" />
        Attribute
      </h3>
      <div class="attributes">
        <div v-for="attr in flipUser.attributes" :key="attr.name" class="attribute">
          <dt>{{ attr.name }}</dt>
          <dd>{{ attr.value || "—" }}</dd>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useFlipAll } from '@/stores/flipAll'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

export default {
  name: 'FlipProfile',
  components: { FontAwesomeIcon },
  
  props: {
    flipUser: {
      type: Object,
      required: true
    }
  },

  setup(props) {
    const flip = useFlipAll()

    // Computed
    const userStatus = computed(() => props.flipUser.status?.toLowerCase() || 'unknown')
    const hasAttributes = computed(() => props.flipUser.attributes?.length > 0)

    // Methods
    const formatStatus = (status) => {
      const map = {
        'ACTIVE': 'Aktiv',
        'LOCKED': 'Gesperrt',
        'PENDING_DELETION': 'Wird gelöscht'
      }
      return map[status] || status
    }

    const formatDate = (date) => {
      if (!date) return '—'
      return new Date(date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    }

    return {
      userStatus,
      hasAttributes,
      formatStatus,
      formatDate
    }
  }
}
</script>

<style scoped lang="scss">
.flip-profile {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-section {
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--muted);
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
}

.data-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));

  > div {
    display: grid;
    gap: 4px;
  }

  dt {
    color: var(--muted);
    font-size: 12px;
  }

  dd {
    margin: 0;
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  
  &.active {
    background: #e8fbf3;
    color: #1f8e5d;
  }
  
  &.locked {
    background: #fff4e6;
    color: #c65d21;
  }
  
  &.pending_deletion {
    background: #fee7e7;
    color: #d42f2f;
  }
}

.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .group {
    background: var(--soft);
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 13px;
  }
}

.attributes {
  display: grid;
  gap: 8px;

  .attribute {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 8px;
    align-items: center;
    
    dt {
      color: var(--muted);
      font-size: 12px;
    }
    
    dd {
      margin: 0;
      font-size: 13px;
    }
  }
}
</style>