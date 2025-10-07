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

    <!-- Tasks -->
    <section class="profile-section">
      <h3>
        <font-awesome-icon icon="fa-solid fa-list-check" />
        Aktive Aufgaben
      </h3>
      <div class="tasks-loading" v-if="loadingTasks">
        <font-awesome-icon icon="fa-solid fa-spinner" spin />
        <span>Lade Aufgaben...</span>
      </div>
      <div v-else-if="tasks.length" class="tasks">
        <div v-for="task in tasks" :key="task.id" class="task">
          <div class="task-title">{{ task.title }}</div>
          <div class="task-meta">
            <span :class="['task-status', task.progress_status.toLowerCase()]">
              {{ formatTaskStatus(task.progress_status) }}
            </span>
            <span v-if="task.due_at?.date" class="task-due">
              Fällig: {{ formatDate(task.due_at.date) }}
            </span>
          </div>
          <div class="task-actions" v-if="task.link">
            <a :href="task.link" target="_blank" class="task-link">
              <font-awesome-icon icon="fa-solid fa-external-link-alt" /> In Flip öffnen
            </a>
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <font-awesome-icon icon="fa-solid fa-clipboard-check" />
        <p>Keine aktiven Aufgaben vorhanden</p>
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
    const tasks = ref([])
    const loadingTasks = ref(false)

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

    const formatTaskStatus = (status) => {
      const map = {
        'OPEN': 'Offen',
        'IN_PROGRESS': 'In Bearbeitung',
        'DONE': 'Erledigt',
        'BLOCKED': 'Blockiert'
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

    // Load tasks on mount
    onMounted(async () => {
      if (props.flipUser.id) {
        loadingTasks.value = true
        try {
          tasks.value = await flip.fetchFlipTasks(props.flipUser.id)
        } catch (error) {
          console.error('Fehler beim Laden der Tasks:', error)
          tasks.value = []
        } finally {
          loadingTasks.value = false
        }
      }
    })

    return {
      tasks,
      loadingTasks,
      userStatus,
      hasAttributes,
      formatStatus,
      formatTaskStatus,
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

.tasks {
  display: grid;
  gap: 12px;

  .task {
    background: var(--soft);
    padding: 10px 12px;
    border-radius: 10px;

    .task-title {
      font-weight: 500;
      margin-bottom: 6px;
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
    }

    .task-status {
      padding: 3px 8px;
      border-radius: 999px;
      
      &.open {
        background: #fff7e6;
        color: #b46c00;
      }
      
      &.in_progress {
        background: #e9f8ff;
        color: #1976d2;
      }
      
      &.done {
        background: #e8fbf3;
        color: #1f8e5d;
      }
      
      &.blocked {
        background: #fee7e7;
        color: #d42f2f;
      }
    }

    .task-due {
      color: var(--muted);
    }
    
    .task-actions {
      margin-top: 8px;
      text-align: right;
      
      .task-link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--accent);
        font-size: 12px;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 20px;
  background: var(--soft);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  
  svg {
    font-size: 20px;
    opacity: 0.6;
  }
  
  p {
    margin: 0;
  }
}

.tasks-loading {
  text-align: center;
  color: var(--muted);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  
  svg {
    font-size: 20px;
  }
}
</style>