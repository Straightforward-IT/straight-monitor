<template>
  <article class="card" :data-expanded="expanded" :data-theme="effectiveTheme">
    <!-- Selection Checkbox (always visible in grid view) -->
    <div class="selection-overlay" @click.stop>
      <input
        type="checkbox"
        :checked="isSelected"
        @change="$emit('toggle-selection')"
        class="selection-checkbox"
      />
    </div>

    <!-- Header (togglable) -->
    <header
      class="card-header"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <!-- Avatar & Title -->
      <div class="left">
        <!-- Initialen-Avatar als Fallback -->
        <div
          class="avatar"
          v-if="!photoUrl"
          :style="{ '--hue': avatarHue(ma) }"
        >
          {{ initials(ma) }}
        </div>
        <img v-else class="avatar-img" :src="photoUrl" alt="" />

        <div class="title">
          <div class="name">{{ ma.vorname }} {{ ma.nachname }}</div>
          <div class="meta">
            <span class="pill" :class="ma.isActive ? 'ok' : 'muted'">
              <font-awesome-icon
                :icon="
                  ma.isActive
                    ? 'fa-solid fa-circle-check'
                    : 'fa-regular fa-circle'
                "
              />
              {{ ma.isActive ? "Aktiv" : "Inaktiv" }}
            </span>

            <!-- Personalnr mit visueller Warnung wenn fehlend -->
            <span class="pill" :class="ma.personalnr ? 'ok' : 'warn'">
              <font-awesome-icon icon="fa-solid fa-id-badge" />
              {{ ma.personalnr || "Personalnr fehlt" }}
            </span>

            <!-- Standort aus Flip (profile.location -> attributes.location -> fallback) -->
            <span class="pill" v-if="displayLocation">
              <font-awesome-icon icon="fa-solid fa-location-dot" />
              {{ displayLocation }}
            </span>

            <!-- Bereich aus Flip (profile.department -> attributes.department -> fallback) -->
            <span class="pill" v-if="displayDepartment">
              <font-awesome-icon icon="fa-solid fa-briefcase" />
              {{ displayDepartment }}
            </span>
            
            <!-- Teamleiter Badge -->
            <span class="pill featured-badge" v-if="isTeamleiter">
              <font-awesome-icon icon="fa-solid fa-user-tie" />
              TL
            </span>
          </div>
        </div>
      </div>

      <!-- Actions rechts angedockt -->
      <div class="card-actions" v-show="expanded" @click.stop>
        <!-- Straight Button -->
        <template v-if="showTooltips">
          <custom-tooltip
            text="Straight-Profil"
            :position="tooltipPosition"
            :delay-in="150"
          >
            <button
              class="icon-btn"
              :class="{ active: view === 'straight' }"
              @click="view = 'straight'"
              :aria-pressed="view === 'straight'"
            >
              <img
                :src="straightLight"
                class="logo logo--light"
                alt="Straight Logo light"
              />
              <img
                :src="straightDark"
                class="logo logo--dark"
                alt="Straight Logo dark"
              />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'straight' }"
            @click="view = 'straight'"
            :aria-pressed="view === 'straight'"
          >
            <img
              :src="straightLight"
              class="logo logo--light"
              alt="Straight Logo light"
            />
            <img
              :src="straightDark"
              class="logo logo--dark"
              alt="Straight Logo dark"
            />
          </button>
        </template>

        <!-- Flip Button -->
        <template v-if="showTooltips">
          <custom-tooltip
            text="Flip-Profil"
            :position="tooltipPosition"
            :delay-in="150"
          >
            <button
              class="icon-btn"
              :class="{ active: view === 'flip' }"
              @click="view = 'flip'"
              :aria-pressed="view === 'flip'"
            >
              <img :src="flipLogo" alt="Flip Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'flip' }"
            @click="view = 'flip'"
            :aria-pressed="view === 'flip'"
          >
            <img :src="flipLogo" alt="Flip Logo" class="logo" />
          </button>
        </template>

        <!-- Asana Button -->
        <template v-if="showTooltips">
          <custom-tooltip
            text="Asana-Task"
            :position="tooltipPosition"
            :delay-in="150"
          >
            <button
              class="icon-btn"
              :class="{ active: view === 'asana' }"
              @click="view = 'asana'"
              :aria-pressed="view === 'asana'"
            >
              <img :src="asanaLogo" alt="Asana Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button
            class="icon-btn"
            :class="{ active: view === 'asana' }"
            @click="view = 'asana'"
            :aria-pressed="view === 'asana'"
          >
            <img :src="asanaLogo" alt="Asana Logo" class="logo" />
          </button>
        </template>

        <!-- Actions Button -->
        <template v-if="showTooltips">
          <custom-tooltip
            text="Aktionen"
            :position="tooltipPosition"
            :delay-in="150"
          >
            <button class="icon-btn" @click="$emit('quick-actions', $event)">
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button class="icon-btn" @click="$emit('quick-actions', $event)">
            <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
          </button>
        </template>

        <button
          class="icon-btn chevron"
          :aria-label="expanded ? 'Zuklappen' : 'Aufklappen'"
          :aria-expanded="expanded"
          @click="toggle"
        >
          <font-awesome-icon
            :icon="
              expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'
            "
          />
        </button>
      </div>
    </header>

    <!-- Expandable body -->
    <transition name="expand">
      <div v-show="expanded" class="card-body">
        <!-- Straight View -->
        <section v-if="view === 'straight'" class="straight-view">
          <h4 class="section-title">
            <img 
              :src="effectiveTheme === 'dark' ? straightDark : straightLight" 
              alt="Monitor" 
              class="section-icon" 
            />
            Monitor Profil
          </h4>
          
          <div class="kv">
            <div>
              <dt>Personalnr</dt>
              <dd>
                <div v-if="!editingPersonalnr && ma.personalnr" class="personalnr-display">
                  {{ ma.personalnr }}
                </div>
                <div v-else-if="!editingPersonalnr && !ma.personalnr" class="personalnr-missing">
                  <button 
                    class="btn btn-sm btn-primary"
                    @click="startEditingPersonalnr"
                  >
                    <font-awesome-icon icon="fa-solid fa-plus" />
                    Hinzufügen
                  </button>
                </div>
                <div v-else class="personalnr-edit">
                  <input
                    v-model="personalnrInput"
                    type="text"
                    placeholder="Personalnr eingeben..."
                    class="form-input"
                    @keyup.enter="savePersonalnr"
                    @keyup.esc="cancelEditingPersonalnr"
                  />
                  <button 
                    class="btn btn-sm btn-primary"
                    @click="savePersonalnr"
                    :disabled="!personalnrInput.trim() || savingPersonalnr"
                  >
                    <font-awesome-icon 
                      :icon="savingPersonalnr ? 'fa-solid fa-spinner' : 'fa-solid fa-check'"
                      :class="{ 'fa-spin': savingPersonalnr }"
                    />
                  </button>
                  <button 
                    class="btn btn-sm btn-ghost"
                    @click="cancelEditingPersonalnr"
                    :disabled="savingPersonalnr"
                  >
                    <font-awesome-icon icon="fa-solid fa-times" />
                  </button>
                </div>
              </dd>
            </div>
            <div>
              <dt>E-Mail</dt>
              <dd>{{ ma.email || "—" }}</dd>
            </div>
            <div v-if="ma.additionalEmails && ma.additionalEmails.length > 0">
              <dt>Alternative E-Mails</dt>
              <dd>
                <div class="email-list">
                  <span v-for="(email, idx) in ma.additionalEmails" :key="idx" class="email-badge">
                    {{ email }}
                  </span>
                </div>
              </dd>
            </div>
            <div>
              <dt>Standort</dt>
              <dd>{{ displayLocation || "—" }}</dd>
            </div>
            <div>
              <dt>Bereich</dt>
              <dd>{{ displayDepartment || "—" }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ ma.isActive ? "Aktiv" : "Inaktiv" }}</dd>
            </div>
          </div>

          <!-- Dokumente Section -->
          <div class="documents-section">
            <h4 class="section-title">
              <font-awesome-icon icon="fa-solid fa-file-lines" class="section-icon" />
              Dokumente
            </h4>

            <!-- Laufzettel Erhalten (als Mitarbeiter) -->
            <div v-if="ma.laufzettel_received && ma.laufzettel_received.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-inbox" />
                Laufzettel erhalten ({{ ma.laufzettel_received.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in ma.laufzettel_received" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Laufzettel')"
                >
                  <font-awesome-icon icon="fa-solid fa-file-lines" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.name_teamleiter || (doc.teamleiter ? `${doc.teamleiter.vorname} ${doc.teamleiter.nachname}` : 'Unbekannt') }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Laufzettel Abgegeben (als Teamleiter) -->
            <div v-if="ma.laufzettel_submitted && ma.laufzettel_submitted.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-paper-plane" />
                Laufzettel abgegeben ({{ ma.laufzettel_submitted.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in ma.laufzettel_submitted" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Laufzettel')"
                >
                  <font-awesome-icon icon="fa-solid fa-file-lines" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.name_mitarbeiter || (doc.mitarbeiter ? `${doc.mitarbeiter.vorname} ${doc.mitarbeiter.nachname}` : 'Unbekannt') }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Event Reports (als Teamleiter) -->
            <div v-if="ma.eventreports && ma.eventreports.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-clipboard" />
                Event Reports ({{ ma.eventreports.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in ma.eventreports" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Event-Bericht')"
                >
                  <font-awesome-icon icon="fa-solid fa-clipboard" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.kunde || 'Unbekannt' }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evaluierungen Erhalten (als Mitarbeiter) -->
            <div v-if="ma.evaluierungen_received && ma.evaluierungen_received.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-inbox" />
                Evaluierungen erhalten ({{ ma.evaluierungen_received.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in ma.evaluierungen_received" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Evaluierung')"
                >
                  <font-awesome-icon icon="fa-solid fa-star" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.name_teamleiter || (doc.teamleiter ? `${doc.teamleiter.vorname} ${doc.teamleiter.nachname}` : 'Unbekannt') }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evaluierungen Abgegeben (als Teamleiter) -->
            <div v-if="ma.evaluierungen_submitted && ma.evaluierungen_submitted.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-paper-plane" />
                Evaluierungen abgegeben ({{ ma.evaluierungen_submitted.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in ma.evaluierungen_submitted" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Evaluierung')"
                >
                  <font-awesome-icon icon="fa-solid fa-star" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.name_mitarbeiter || (doc.mitarbeiter ? `${doc.mitarbeiter.vorname} ${doc.mitarbeiter.nachname}` : 'Unbekannt') }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Keine Dokumente -->
            <div v-if="!hasAnyDocuments" class="no-documents">
              <font-awesome-icon icon="fa-solid fa-inbox" />
              <p>Keine Dokumente verknüpft</p>
            </div>
          </div>
        </section>

        <!-- Flip View -->
        <section v-else-if="view === 'flip'" class="flip-view">
          <div v-if="ma.flip" class="flip-content">
            <!-- Flip Profile -->
            <div class="flip-profile-section">
              <h4 class="section-title">
                <img :src="flipLogo" alt="Flip" class="section-icon" />
                Flip-Profil
              </h4>
              <FlipProfile :flip-user="ma.flip" />
            </div>
            
            <!-- Flip Tasks -->
            <div class="flip-tasks-section">
              <h4 class="section-title">
                <font-awesome-icon icon="fa-solid fa-clipboard-list" class="section-icon" />
                Flip Tasks
                
                <!-- Task Filter Toggle -->
                <div class="task-filters" v-if="flipTasks.total > 0">
                  <button 
                    @click="showFinishedTasks = false"
                    class="filter-btn"
                    :class="{ active: !showFinishedTasks }"
                    title="Offene Aufgaben anzeigen"
                  >
                    <font-awesome-icon icon="fa-solid fa-hourglass-half" />
                    Offen
                  </button>
                  <button 
                    @click="showFinishedTasks = true"
                    class="filter-btn"
                    :class="{ active: showFinishedTasks }"
                    title="Erledigte Aufgaben anzeigen"
                  >
                    <font-awesome-icon icon="fa-solid fa-check-circle" />
                    Erledigt
                  </button>
                </div>
                
                <button 
                  v-if="!loadingTasks"
                  @click="loadFlipTasks" 
                  class="refresh-btn"
                  :disabled="loadingTasks"
                  title="Aufgaben neu laden"
                >
                  <font-awesome-icon icon="fa-solid fa-rotate-right" />
                </button>
              </h4>
              
              <!-- Loading State -->
              <div v-if="loadingTasks" class="tasks-loading">
                <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
                <span>Lade Aufgaben...</span>
              </div>
              
              <!-- Tasks List -->
              <div v-else-if="flipTasks.total > 0" class="tasks-categorized">
                
                <!-- Assigned to Me -->
                <div v-if="filteredTasksToMe.length > 0" class="task-category">
                  <h5 class="category-title">
                    <font-awesome-icon icon="fa-solid fa-inbox" />
                    Zugewiesen an {{ ma.flip.vorname }} ({{ filteredTasksToMe.length }})
                  </h5>
                  <div class="category-tasks">
                    <div 
                      v-for="task in filteredTasksToMe" 
                      :key="task.id"
                      class="task-item assigned-to-me"
                      :class="{ 'task-in-progress': task.progress_status === 'IN_PROGRESS' }"
                    >
                      <div class="task-header">
                        <h6 class="task-title">{{ task.title }}</h6>
                        <span 
                          class="task-status" 
                          :class="`status-${(task.progress_status || 'OPEN').toLowerCase()}`"
                        >
                          {{ formatTaskStatus(task.progress_status) }}
                        </span>
                      </div>
                      
                      <div v-if="task.body?.plain" class="task-description" v-html="formatTaskDescription(task.body.plain)">
                      </div>
                      
                      <div class="task-meta">
                        <div v-if="task.due_at?.date" class="task-due">
                          <font-awesome-icon icon="fa-solid fa-calendar" />
                          <span>{{ formatDueDate(task.due_at.date) }}</span>
                        </div>
                        <div class="task-created">
                          <font-awesome-icon icon="fa-solid fa-clock" />
                          <span>{{ formatCreatedDate(task.created_at) }}</span>
                        </div>
                      </div>
                      
                      <div class="task-actions">
                        <button 
                          v-if="task.link"
                          @click="openFlipTask(task.link)"
                          class="btn btn-sm btn-primary"
                        >
                          <font-awesome-icon icon="fa-solid fa-external-link-alt" />
                          Öffnen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Assigned by Me -->
                <div v-if="filteredTasksByMe.length > 0" class="task-category">
                  <h5 class="category-title">
                    <font-awesome-icon icon="fa-solid fa-paper-plane" />
                    Zugewiesen von {{ ma.flip.vorname }} ({{ filteredTasksByMe.length }})
                  </h5>
                  <div class="category-tasks">
                    <div 
                      v-for="task in filteredTasksByMe" 
                      :key="task.id"
                      class="task-item assigned-by-me"
                      :class="{ 'task-in-progress': task.progress_status === 'IN_PROGRESS' }"
                    >
                      <div class="task-header">
                        <h6 class="task-title">{{ task.title }}</h6>
                        <span 
                          class="task-status" 
                          :class="`status-${(task.progress_status || 'OPEN').toLowerCase()}`"
                        >
                          {{ formatTaskStatus(task.progress_status) }}
                        </span>
                      </div>
                      
                      <div v-if="task.body?.plain" class="task-description" v-html="formatTaskDescription(task.body.plain)">
                      </div>
                      
                      <div class="task-meta">
                        <div v-if="task.due_at?.date" class="task-due">
                          <font-awesome-icon icon="fa-solid fa-calendar" />
                          <span>{{ formatDueDate(task.due_at.date) }}</span>
                        </div>
                        <div class="task-created">
                          <font-awesome-icon icon="fa-solid fa-clock" />
                          <span>{{ formatCreatedDate(task.created_at) }}</span>
                        </div>
                      </div>
                      
                      <div class="task-actions">
                        <button 
                          v-if="task.link"
                          @click="openFlipTask(task.link)"
                          class="btn btn-sm btn-primary"
                        >
                          <font-awesome-icon icon="fa-solid fa-external-link-alt" />
                          Öffnen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Available Tasks -->
                <div v-if="filteredAvailableTasks.length > 0" class="task-category">
                  <h5 class="category-title">
                    <font-awesome-icon icon="fa-solid fa-clipboard-list" />
                    Zugewiesen an {{ ma.flip.vorname }} ({{ filteredAvailableTasks.length }})
                  </h5>
                  <div class="category-tasks">
                    <div 
                      v-for="task in filteredAvailableTasks" 
                      :key="task.id"
                      class="task-item available-task"
                      :class="{ 'task-in-progress': task.progress_status === 'IN_PROGRESS' }"
                    >
                      <div class="task-header">
                        <h6 class="task-title">{{ task.title }}</h6>
                        <span 
                          class="task-status" 
                          :class="`status-${(task.progress_status || 'OPEN').toLowerCase()}`"
                        >
                          {{ formatTaskStatus(task.progress_status) }}
                        </span>
                      </div>
                      
                      <div v-if="task.body?.plain" class="task-description" v-html="formatTaskDescription(task.body.plain)">
                      </div>
                      
                      <div class="task-meta">
                        <div v-if="task.due_at?.date" class="task-due">
                          <font-awesome-icon icon="fa-solid fa-calendar" />
                          <span>{{ formatDueDate(task.due_at.date) }}</span>
                        </div>
                        <div class="task-created">
                          <font-awesome-icon icon="fa-solid fa-clock" />
                          <span>{{ formatCreatedDate(task.created_at) }}</span>
                        </div>
                      </div>
                      
                      <div class="task-actions">
                        <button 
                          v-if="task.link"
                          @click="openFlipTask(task.link)"
                          class="btn btn-sm btn-primary"
                        >
                          <font-awesome-icon icon="fa-solid fa-external-link-alt" />
                          Öffnen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Empty State -->
              <div v-else class="tasks-empty">
                <font-awesome-icon icon="fa-solid fa-clipboard" />
                <p>Keine Aufgaben verfügbar</p>
                <small>Aufgaben werden automatisch über den API-Client erstellt</small>
                
                <!-- Debug Info -->
                <div v-if="flipTasks.debug" class="debug-info">
                  <details>
                    <summary>Debug Info</summary>
                    <div class="debug-details">
                      <div>Tasks in Flip: {{ flipTasks.debug.totalTasksInFlip }}</div>
                      <div>Assignments in Flip: {{ flipTasks.debug.totalAssignmentsInFlip }}</div>
                      <div>User assignments: {{ flipTasks.debug.userAssignments }}</div>
                      <div>User authored: {{ flipTasks.debug.userAuthoredTasks }}</div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
          
          <!-- No Flip Connection -->
          <div v-else class="emptystate">
            <font-awesome-icon icon="fa-solid fa-plug-circle-xmark" />
            <p>Keine Flip-Verknüpfung vorhanden</p>
          </div>
        </section>

        <!-- Asana View -->
        <section v-else class="asana-view">
          <!-- Asana Verknüpfung vorhanden -->
          <div v-if="ma.asana_id" class="asana-linked">
            <div class="asana-info">
              <h4 class="section-title">
                <img :src="asanaLogo" alt="Asana" class="section-icon" />
                Asana-Verknüpfung
              </h4>
              <div class="asana-id">
                <strong>Task-ID:</strong> {{ ma.asana_id }}
                <button
                  class="copy-btn"
                  @click="copyToClipboard(ma.asana_id)"
                  title="ID kopieren"
                >
                  <font-awesome-icon icon="fa-solid fa-copy" />
                </button>
              </div>
              <div class="asana-actions">
                <button
                  class="btn btn-ghost btn-sm"
                  @click="openAsanaTask"
                  :disabled="loadingAsana"
                >
                  <font-awesome-icon icon="fa-solid fa-external-link-alt" />
                  Task öffnen
                </button>
                <button
                  class="btn btn-danger btn-sm"
                  @click="removeAsanaLink"
                  :disabled="savingAsana"
                >
                  <font-awesome-icon icon="fa-solid fa-unlink" />
                  Verknüpfung entfernen
                </button>
              </div>
            </div>
          </div>

          <!-- Keine Asana Verknüpfung -->
          <div v-else class="asana-unlinked">
            <div v-if="!showAsanaLinkForm" class="emptystate">
              <font-awesome-icon icon="fa-solid fa-clipboard-list" />
              <p>Keine Asana-Verknüpfung vorhanden</p>
              <button
                class="btn btn-primary btn-sm"
                @click="showAsanaLinkForm = true"
              >
                <font-awesome-icon icon="fa-solid fa-link" />
                Asana-Task verknüpfen
              </button>
            </div>

            <!-- Asana Link Formular -->
            <div v-else class="asana-link-form">
              <h4 class="section-title">
                <img :src="asanaLogo" alt="Asana" class="section-icon" />
                Asana-Task verknüpfen
              </h4>

              <!-- Direkte GID Eingabe -->
              <div class="form-section">
                <label for="asana-gid">Task-GID direkt eingeben:</label>
                <div class="input-group">
                  <input
                    id="asana-gid"
                    v-model="asanaGidInput"
                    type="text"
                    placeholder="z.B. 1234567890123456"
                    class="form-input"
                    @keyup.enter="linkAsanaTaskById"
                  />
                  <button
                    class="btn btn-primary btn-sm"
                    @click="linkAsanaTaskById"
                    :disabled="!asanaGidInput.trim() || savingAsana"
                  >
                    Verknüpfen
                  </button>
                </div>
              </div>

              <div class="divider-text">oder</div>

              <!-- Task-Suche -->
              <div class="form-section">
                <label for="asana-search">Task nach Namen suchen:</label>
                <div class="search-group">
                  <input
                    id="asana-search"
                    v-model="asanaSearchQuery"
                    type="text"
                    placeholder="Task-Name eingeben..."
                    class="form-input"
                    @input="searchAsanaTasks"
                    @keyup.enter="searchAsanaTasks"
                  />
                  <button
                    class="btn btn-secondary btn-sm"
                    @click="searchAsanaTasks"
                    :disabled="!asanaSearchQuery.trim() || searchingAsana"
                  >
                    <font-awesome-icon
                      :icon="
                        searchingAsana
                          ? 'fa-solid fa-spinner'
                          : 'fa-solid fa-search'
                      "
                      :class="{ 'fa-spin': searchingAsana }"
                    />
                    Suchen
                  </button>
                </div>

                <!-- Suchergebnisse -->
                <div
                  v-if="asanaSearchResults.length > 0"
                  class="search-results"
                >
                  <div
                    v-for="task in asanaSearchResults"
                    :key="task.gid"
                    :class="[
                      'search-result-item',
                      { 'featured-task': task.containsEmployeeEmail },
                    ]"
                    @click="selectAsanaTask(task)"
                  >
                    <div class="task-info">
                      <div class="task-header">
                        <strong>{{ task.name }}</strong>
                        <div
                          v-if="task.containsEmployeeEmail"
                          class="featured-badge"
                          title="Task enthält E-Mail-Adresse des Mitarbeiters"
                        >
                          <font-awesome-icon
                            icon="fa-solid fa-link"
                            class="featured-icon"
                          />
                          <span>Best Match</span>
                        </div>
                      </div>
                      <small>{{ task.gid }}</small>
                      <span
                        v-if="task.memberships?.[0]?.project?.name"
                        class="project-tag"
                      >
                        {{ task.memberships[0].project.name }}
                      </span>
                      <div
                        v-if="task.containsEmployeeEmail"
                        class="featured-hint"
                      >
                        <font-awesome-icon icon="fa-solid fa-envelope" />
                        Enthält {{ ma.email }}
                      </div>
                    </div>
                    <div class="task-status">
                      <span
                        :class="[
                          'status-badge',
                          task.completed ? 'completed' : 'active',
                        ]"
                      >
                        {{ task.completed ? "Abgeschlossen" : "Aktiv" }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-else-if="asanaSearchQuery.trim() && !searchingAsana"
                  class="no-results"
                >
                  Keine Tasks gefunden für "{{ asanaSearchQuery }}"
                </div>
              </div>

              <!-- Formular-Aktionen -->
              <div class="form-actions">
                <button
                  class="btn btn-ghost btn-sm"
                  @click="cancelAsanaLinking"
                >
                  Abbrechen
                </button>
              </div>

              <!-- Loading/Error States -->
              <div v-if="savingAsana" class="loading-state">
                <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
                Verknüpfung wird gespeichert...
              </div>
            </div>
          </div>
        </section>
      </div>
    </transition>

    <!-- Footer nur im expanded state -->
    <footer v-if="expanded" class="card-footer">
      <button class="btn btn-ghost" @click="$emit('edit', ma)">
        Bearbeiten
      </button>
    </footer>

    <!-- Document Modal -->
    <teleport to="body">
      <div v-if="selectedDocument" class="modal-overlay" @click.self="selectedDocument = null">
        <div class="modal-content modal-document">
          <DocumentCard
            :doc="selectedDocument"
            @close="selectedDocument = null"
            @open-employee="handleOpenEmployee"
            @filter-teamleiter="handleFilterTeamleiter"
            @filter-mitarbeiter="handleFilterMitarbeiter"
          />
        </div>
      </div>
    </teleport>
  </article>
</template>
<script>
import { computed, ref, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { useRouter } from "vue-router";
import CustomTooltip from "./CustomTooltip.vue";
import FlipProfile from "./FlipProfile.vue";
import DocumentCard from "./DocumentCard.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useTheme } from "@/stores/theme";
import { useFlipAll } from "@/stores/flipAll";
import api from "@/utils/api";
import { fetchFlipTasks } from "@/utils/flipApi";

// Assets importieren (Vite handled cache+preload)
import straightLight from "@/assets/SF_002.png";
import straightDark from "@/assets/SF_000.svg";
import flipLogo from "@/assets/flip.png";
import asanaLogo from "@/assets/asana.png";

export default {
  name: "EmployeeCard",
  components: { CustomTooltip, FontAwesomeIcon, FlipProfile, DocumentCard },
  props: {
    ma: { type: Object, required: true },
    initiallyExpanded: { type: Boolean, default: false },
    showCheckbox: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["open", "edit", "toggle-selection", "quick-actions", "close", "open-employee"],

  setup(props) {
    const theme = useTheme(); // { current: 'light' | 'dark' | 'system' }
    const router = useRouter();

    // System-Theme live auslesen
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const systemDark = ref(media ? media.matches : false);
    const handleMedia = (e) => (systemDark.value = e.matches);
    onMounted(() => media && media.addEventListener?.("change", handleMedia));
    onBeforeUnmount(
      () => media && media.removeEventListener?.("change", handleMedia)
    );

    const effectiveTheme = computed(() => {
      if (theme.current === "system")
        return systemDark.value ? "dark" : "light";
      return theme.current || "light";
    });

    // Tooltips nur auf Desktop anzeigen
    const isMobile = ref(window.innerWidth <= 768);
    const showTooltips = computed(() => !isMobile.value);
    const tooltipPosition = computed(() => "bottom"); // Immer bottom da nur auf Desktop

    const updateScreenSize = () => {
      isMobile.value = window.innerWidth <= 768;
    };

    onMounted(() => {
      window.addEventListener("resize", updateScreenSize);
    });

    onBeforeUnmount(() => {
      window.removeEventListener("resize", updateScreenSize);
    });

    // Flip helpers (attributes als Array von {name,value})
    const getFlipAttr = (name) =>
      props.ma?.flip?.attributes?.find?.((a) => a?.name === name)?.value;

    const displayLocation = computed(() => {
        // 1. Flip Location
        const flipLoc = props.ma?.flip?.profile?.location || getFlipAttr("location");
        if (flipLoc) return flipLoc;

        // 2. Database Location
        if (props.ma?.standort) return props.ma?.standort;

        // 3. Fallback: Personalnr Logic
        // 1xxxx = Berlin, 2xxxx = Hamburg, 3xxxx = Köln
        const pnr = props.ma?.personalnr;
        if (pnr) {
          const s = String(pnr).trim();
          if (s.startsWith("1")) return "Berlin";
          if (s.startsWith("2")) return "Hamburg";
          if (s.startsWith("3")) return "Köln";
        }

        return "";
    });
    const displayDepartment = computed(
      () =>
        props.ma?.flip?.profile?.department ||
        getFlipAttr("department") ||
        props.ma?.abteilung ||
        ""
    );
    // FLip Profile Picture
    const flip = useFlipAll();
    const photoUrl = ref("");
    watchEffect(async () => {
      if (!flip.enablePhotos) {
        photoUrl.value = "";
        return;
      }
      const id = props.ma?.flip?.id;
      photoUrl.value = id ? (await flip.ensurePhoto(id)) || "" : "";
    });
    
    // Check if user is a Teamleiter
    const isTeamleiter = computed(() => {
      return props.ma?.flip ? flip.isTeamleiter(props.ma.flip) : false;
    });
    
    // Logos via imports (Vite preloaded) – kein src-Swap → kein Flackern
    return {
      theme,
      effectiveTheme,
      showTooltips,
      tooltipPosition,
      straightLight,
      straightDark,
      flipLogo,
      asanaLogo,
      photoUrl,
      displayLocation,
      displayDepartment,
      isTeamleiter,
      router,
    };
  },

  data() {
    return {
      expanded: this.initiallyExpanded,
      view: "straight",
      // Personalnr editing
      editingPersonalnr: false,
      personalnrInput: "",
      savingPersonalnr: false,
      // Asana-Verknüpfung States
      showAsanaLinkForm: false,
      asanaGidInput: "",
      asanaSearchQuery: "",
      asanaSearchResults: [],
      searchingAsana: false,
      savingAsana: false,
      loadingAsana: false,
      // Flip-Tasks States
      flipTasks: {
        assignedToMe: [],
        assignedByMe: [], 
        available: [],
        total: 0,
        summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
      },
      loadingTasks: false,
      tasksLoaded: false,
      showFinishedTasks: false, // Toggle für erledigte Tasks
      // Document modal
      selectedDocument: null,
    };
  },

  computed: {
    // Filtere Tasks nach Status (offen vs. erledigt)
    filteredTasksToMe() {
      if (!this.flipTasks.assignedToMe) return [];
      return this.flipTasks.assignedToMe.filter(task => {
        const isFinished = task.progress_status === 'FINISHED' || task.progress_status === 'DONE';
        return this.showFinishedTasks ? isFinished : !isFinished;
      });
    },
    filteredTasksByMe() {
      if (!this.flipTasks.assignedByMe) return [];
      return this.flipTasks.assignedByMe.filter(task => {
        const isFinished = task.progress_status === 'FINISHED' || task.progress_status === 'DONE';
        return this.showFinishedTasks ? isFinished : !isFinished;
      });
    },
    filteredAvailableTasks() {
      if (!this.flipTasks.available) return [];
      return this.flipTasks.available.filter(task => {
        const isFinished = task.progress_status === 'FINISHED' || task.progress_status === 'DONE';
        return this.showFinishedTasks ? isFinished : !isFinished;
      });
    },
    hasAnyDocuments() {
      return (
        (this.ma.laufzettel_received && this.ma.laufzettel_received.length > 0) ||
        (this.ma.laufzettel_submitted && this.ma.laufzettel_submitted.length > 0) ||
        (this.ma.eventreports && this.ma.eventreports.length > 0) ||
        (this.ma.evaluierungen_received && this.ma.evaluierungen_received.length > 0) ||
        (this.ma.evaluierungen_submitted && this.ma.evaluierungen_submitted.length > 0)
      );
    }
  },

  watch: {
    view(newView) {
      // Load tasks when switching to flip view
      if (newView === 'flip' && this.expanded && this.ma.flip?.id && !this.tasksLoaded) {
        this.loadFlipTasks();
      }
    }
  },

  mounted() {
    document.addEventListener('keydown', this.handleEscapeKey);
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  },

  methods: {
    toggle() {
      this.expanded = !this.expanded;

      if (this.expanded) {
        this.$emit("open", this.ma);
        console.log("Mitarbeiter Data:", this.ma);
        
        // Debug documents
        if (this.ma.laufzettel_received?.length > 0) {
          console.log("Laufzettel Received Sample:", this.ma.laufzettel_received[0]);
        }
        if (this.ma.laufzettel_submitted?.length > 0) {
          console.log("Laufzettel Submitted Sample:", this.ma.laufzettel_submitted[0]);
        }
        if (this.ma.eventreports?.length > 0) {
          console.log("EventReports Sample:", this.ma.eventreports[0]);
        }
        if (this.ma.evaluierungen_received?.length > 0) {
          console.log("Evaluierungen Received Sample:", this.ma.evaluierungen_received[0]);
        }
        if (this.ma.evaluierungen_submitted?.length > 0) {
          console.log("Evaluierungen Submitted Sample:", this.ma.evaluierungen_submitted[0]);
        }
        
        // Auto-load tasks if flip view and not loaded yet
        if (this.view === 'flip' && this.ma.flip?.id && !this.tasksLoaded) {
          this.loadFlipTasks();
        }
      }
    },
    initials(ma) {
      const a = (ma?.vorname || "").trim()[0] || "";
      const b = (ma?.nachname || "").trim()[0] || "";
      return (a + b).toUpperCase() || "•";
    },
    avatarHue(ma) {
      const seed = (ma?._id || ma?.email || "")
        .split("")
        .reduce((s, c) => s + c.charCodeAt(0), 0);
      return seed % 360;
    },
    formatDate(dateString) {
      if (!dateString) return '—';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return '—';
      }
    },

    // Personalnr Methods
    startEditingPersonalnr() {
      this.editingPersonalnr = true;
      this.personalnrInput = this.ma.personalnr || "";
    },

    cancelEditingPersonalnr() {
      this.editingPersonalnr = false;
      this.personalnrInput = "";
    },

    async savePersonalnr() {
      if (!this.personalnrInput.trim()) return;

      this.savingPersonalnr = true;

      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.ma._id}/personalnr`,
          {
            personalnr: this.personalnrInput.trim(),
          }
        );

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.ma.personalnr = this.personalnrInput.trim();
          this.cancelEditingPersonalnr();
          console.log("✅ Personalnr gespeichert:", this.personalnrInput.trim());
        } else {
          throw new Error(response.data?.message || "Unbekannter Fehler");
        }
      } catch (error) {
        console.error("❌ Fehler beim Speichern der Personalnr:", error);
        
        let userMessage = "Fehler beim Speichern: ";
        if (error.response?.data?.conflict) {
          // Unique constraint violation
          userMessage = `⚠️ Konflikt: Diese Personalnr wird bereits verwendet!\n\nVerwendet von: ${error.response.data.conflict.name}`;
        } else if (error.response?.data?.message) {
          userMessage += error.response.data.message;
        } else if (error.response?.status) {
          userMessage += `HTTP ${error.response.status} - ${
            error.response.statusText || "Unbekannter Fehler"
          }`;
        } else {
          userMessage += error.message;
        }

        alert(userMessage);
      } finally {
        this.savingPersonalnr = false;
      }
    },

    // Asana-Verknüpfung Methoden
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        // Optional: Toast-Notification zeigen
        console.log("📋 Asana-ID kopiert:", text);
      } catch (error) {
        console.error("❌ Fehler beim Kopieren:", error);
      }
    },

    openAsanaTask() {
      if (!this.ma.asana_id) return;

      // Asana Task-URL generieren
      const url = `https://app.asana.com/0/0/${this.ma.asana_id}`;
      window.open(url, "_blank");
    },

    async removeAsanaLink() {
      if (!confirm("Asana-Verknüpfung wirklich entfernen?")) {
        return;
      }

      this.savingAsana = true;

      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.ma._id}`,
          {
            asana_id: null,
          }
        );

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.ma.asana_id = null;
          console.log("✅ Asana-Verknüpfung entfernt");
        } else {
          throw new Error(response.data?.message || "Unbekannter Fehler");
        }
      } catch (error) {
        console.error("❌ Fehler beim Entfernen der Asana-Verknüpfung:", error);
        alert(
          "Fehler beim Entfernen der Asana-Verknüpfung: " +
            (error.response?.data?.message || error.message)
        );
      } finally {
        this.savingAsana = false;
      }
    },

    async linkAsanaTaskById() {
      if (!this.asanaGidInput.trim()) return;

      console.log("🔄 Verknüpfe per GID:", {
        gid: this.asanaGidInput.trim(),
        mitarbeiterId: this.ma._id,
        mitarbeiterName: `${this.ma.vorname} ${this.ma.nachname}`,
      });

      this.savingAsana = true;

      try {
        // Validiere GID Format (sollte numerisch sein)
        if (!/^\d+$/.test(this.asanaGidInput.trim())) {
          throw new Error(
            "Asana-GID muss numerisch sein (z.B. 1234567890123456)"
          );
        }

        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.ma._id}`,
          {
            asana_id: this.asanaGidInput.trim(),
          }
        );

        console.log("📡 API Response (GID):", response.data);

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.ma.asana_id = this.asanaGidInput.trim();
          this.cancelAsanaLinking();
          console.log("✅ Asana-Verknüpfung erstellt");
        } else {
          const errorMsg = response.data?.message || "Unbekannter Fehler";
          console.error("❌ API returned success=false (GID):", response.data);
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error("❌ Fehler beim Verknüpfen mit Asana (GID):", {
          error: error.message,
          status: error.response?.status,
          responseData: error.response?.data,
          fullError: error,
        });

        let userMessage = "Fehler beim Verknüpfen: ";
        if (error.response?.data?.message) {
          userMessage += error.response.data.message;
        } else if (error.response?.status) {
          userMessage += `HTTP ${error.response.status} - ${
            error.response.statusText || "Unbekannter Fehler"
          }`;
        } else {
          userMessage += error.message;
        }

        alert(userMessage);
      } finally {
        this.savingAsana = false;
      }
    },

    async searchAsanaTasks() {
      if (
        !this.asanaSearchQuery.trim() ||
        this.asanaSearchQuery.trim().length < 2
      ) {
        return;
      }

      console.log("🔍 Suche Asana-Tasks:", this.asanaSearchQuery.trim());

      this.searchingAsana = true;
      this.asanaSearchResults = [];

      try {
        const response = await api.get("/api/asana/tasks/search", {
          params: {
            query: this.asanaSearchQuery.trim(),
            employeeEmail: this.ma.email, // Pass employee email for featured suggestions
            employeeLocation: this.displayLocation || this.ma.standort, // Pass location for prioritization
          },
        });

        console.log("📡 Search Response:", response.data);

        if (response.data.success) {
          this.asanaSearchResults = response.data.data || [];
          console.log(
            `🔍 ${this.asanaSearchResults.length} Asana-Tasks gefunden (${
              response.data.featuredCount || 0
            } featured):`,
            this.asanaSearchResults
          );
        } else {
          throw new Error(response.data.message || "Suche fehlgeschlagen");
        }
      } catch (error) {
        console.error("❌ Fehler bei der Asana-Suche:", {
          error: error.message,
          status: error.response?.status,
          responseData: error.response?.data,
          fullError: error,
        });

        this.asanaSearchResults = [];

        let userMessage = "Fehler bei der Suche: ";
        if (error.response?.data?.message) {
          userMessage += error.response.data.message;
        } else if (error.response?.status) {
          userMessage += `HTTP ${error.response.status} - ${
            error.response.statusText || "Unbekannter Fehler"
          }`;
        } else {
          userMessage += error.message;
        }

        alert(userMessage);
      } finally {
        this.searchingAsana = false;
      }
    },

    async selectAsanaTask(task) {
      if (!task.gid) return;

      console.log("🔄 Verknüpfe Asana-Task:", {
        taskGid: task.gid,
        taskName: task.name,
        mitarbeiterId: this.ma._id,
        mitarbeiterName: `${this.ma.vorname} ${this.ma.nachname}`,
      });

      this.savingAsana = true;

      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.ma._id}`,
          {
            asana_id: task.gid,
          }
        );

        console.log("📡 API Response:", {
          status: response.status,
          success: response.data?.success,
          data: response.data,
        });

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.ma.asana_id = task.gid;
          this.cancelAsanaLinking();
          console.log("✅ Asana-Task verknüpft:", task.name);
        } else {
          const errorMsg =
            response.data?.message || "Verknüpfung fehlgeschlagen";
          console.error("❌ API returned success=false:", response.data);
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error("❌ Fehler beim Verknüpfen mit Asana-Task:", {
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          fullError: error,
        });

        let userMessage = "Fehler beim Verknüpfen: ";
        if (error.response?.data?.message) {
          userMessage += error.response.data.message;
        } else if (error.response?.status) {
          userMessage += `HTTP ${error.response.status} - ${
            error.response.statusText || "Unbekannter Fehler"
          }`;
        } else {
          userMessage += error.message;
        }

        alert(userMessage);
      } finally {
        this.savingAsana = false;
      }
    },

    cancelAsanaLinking() {
      this.showAsanaLinkForm = false;
      this.asanaGidInput = "";
      this.asanaSearchQuery = "";
      this.asanaSearchResults = [];
      this.searchingAsana = false;
      this.savingAsana = false;
    },

    // Flip Tasks Methoden
    async loadFlipTasks() {
      if (!this.ma.flip?.id) {
        console.log("❌ No Flip ID available for", this.ma.vorname, this.ma.nachname);
        return;
      }

      console.log("🔄 Loading Flip tasks for user:", this.ma.flip.id);
      this.loadingTasks = true;

      try {
        const response = await fetchFlipTasks(this.ma.flip.id);
        this.flipTasks = response || {
          assignedToMe: [],
          assignedByMe: [], 
          available: [],
          total: 0,
          summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
        };
        this.tasksLoaded = true;
        
        console.log(`✅ Loaded ${this.flipTasks.total} Flip tasks for ${this.ma.vorname} ${this.ma.nachname}:`, this.flipTasks.summary);
        
        if (this.flipTasks.debug) {
          console.log(`🔍 Debug info:`, this.flipTasks.debug);
        }
      } catch (error) {
        console.error("❌ Error loading Flip tasks:", error);
        this.flipTasks = {
          assignedToMe: [],
          assignedByMe: [], 
          available: [],
          total: 0,
          summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
        };
        // Don't show error to user, just log it
      } finally {
        this.loadingTasks = false;
      }
    },

    formatTaskStatus(status) {
      const statusMap = {
        'OPEN': 'Offen',
        'IN_PROGRESS': 'In Bearbeitung', 
        'DONE': 'Erledigt',
        'FINISHED': 'Abgeschlossen',
        'NEW': 'Neu'
      };
      return statusMap[status] || status || 'Offen';
    },

    formatDueDate(dateString) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return dateString;
      }
    },

    formatCreatedDate(dateString) {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          return 'Heute';
        } else if (diffDays === 1) {
          return 'Gestern';
        } else if (diffDays < 7) {
          return `vor ${diffDays} Tagen`;
        } else {
          return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        }
      } catch {
        return dateString;
      }
    },

    openFlipTask(link) {
      if (link) {
        window.open(link, '_blank');
      }
    },

    openDocument(doc, docType) {
      // Transform document to match DocumentCard expected format
      this.selectedDocument = {
        _id: doc._id,
        docType: docType,
        bezeichnung: this.getDocumentTitle(doc, docType),
        datum: doc.datum,
        status: doc.assigned ? 'Zugewiesen' : 'Offen',
        details: doc
      };
    },

    getDocumentTitle(doc, docType) {
      if (docType === 'Laufzettel') {
        return `${doc.location || 'Unbekannt'} - ${doc.name_mitarbeiter || 'Unbekannt'}`;
      } else if (docType === 'Event-Bericht') {
        return `${doc.kunde || 'Unbekannt'} - ${doc.location || 'Unbekannt'}`;
      } else if (docType === 'Evaluierung') {
        return `${doc.name_mitarbeiter || 'Unbekannt'} - ${doc.kunde || 'Unbekannt'}`;
      }
      return 'Dokument';
    },

    handleEscapeKey(event) {
      if (event.key === 'Escape') {
        if (this.selectedDocument) {
          this.selectedDocument = null;
        }
      }
    },

    async handleOpenEmployee(role, employeeId) {
      if (!employeeId) return;
      
      try {
        // Schließe aktuelles DocumentCard Modal
        this.selectedDocument = null;
        
        // Emitte Event zum Öffnen des neuen Mitarbeiters
        // role und employeeId werden weitergegeben
        this.$emit('open-employee', role, employeeId);
      } catch (error) {
        console.error('Fehler beim Öffnen des Mitarbeiters:', error);
      }
    },

    handleFilterTeamleiter(name) {
      // Schließe aktuelles Modal
      this.selectedDocument = null;
      this.$emit('close');
      
      // Navigiere zu Dokumente.vue mit Filter
      this.$router.push({
        name: 'Dokumente',
        query: { filterTeamleiter: name }
      });
    },

    handleFilterMitarbeiter(name) {
      // Schließe aktuelles Modal
      this.selectedDocument = null;
      this.$emit('close');
      
      // Navigiere zu Dokumente.vue mit Filter
      this.$router.push({
        name: 'Dokumente',
        query: { filterMitarbeiter: name }
      });
    },

    formatTaskDescription(description) {
      if (!description) return '';
      
      console.log('Original description:', description);
      
      // Replace URLs with a link icon
      const urlRegex = /(https?:\/\/[^\s\[\]]+)/g;
      const result = description.replace(urlRegex, '<span class="task-link-icon" title="Link verfügbar">[Link]</span>');
      
      console.log('Formatted description:', result);
      return result;
    },
  },
};
</script>

<style scoped lang="scss">
/* ---------- Card ---------- */
.card {
  position: relative; /* Positioning context for absolute elements */
  display: flex;
  flex-direction: column;
  background: var(--surface);
  /* stärkerer, klarer Border */
  border: 1px solid
    var(--border-strong, color-mix(in srgb, var(--border) 75%, var(--text) 10%));
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.18s ease, transform 0.12s ease,
    border-color 0.2s ease;
  overflow: hidden;
}
.card:hover {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}
.card:focus-within {
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
}

/* ---------- Header ---------- */
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 14px;
  background: var(--surface);
  cursor: pointer;
}

/* Linke Seite (Avatar + Titel) füllt, damit Actions rechts andocken */
.left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #fff;
  background: hsl(0, 0%, calc(15% + (var(--hue, 0) / 360 * 55%)));
  flex: 0 0 auto;
}
.avatar-img {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  flex: 0 0 auto;
}

.title {
  min-width: 0;
}
.title .name {
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.title .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--text);
}
.pill.ok {
  background: #e8fbf3;
  color: #1f8e5d;
}
.pill.muted {
  background: #f1f3f6;
  color: var(--muted);
}
.pill.warn {
  background: #fff3cd;
  color: #856404;
  font-weight: 600;
}

/* ---------- Actions rechts ---------- */
.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);
  transition: background 0.14s ease, color 0.14s ease, border-color 0.2s ease,
    box-shadow 0.2s ease, transform 0.08s ease;
}
.icon-btn:hover {
  background: var(--soft);
  color: var(--text);
}
.icon-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 25%, transparent);
}
.icon-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
  outline-offset: 2px;
}
.icon-btn.chevron {
  transform: rotate(0deg);
}
.card[data-expanded="true"] .icon-btn.chevron {
  transform: rotate(180deg);
}

/* Logos – NICHT src-swappen, nur zeigen/verstecken */
.icon-btn .logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
}
.icon-btn .logo--light {
  display: block;
}
.icon-btn .logo--dark {
  display: none;
}
.card[data-theme="dark"] .icon-btn .logo--light {
  display: none;
}
.card[data-theme="dark"] .icon-btn .logo--dark {
  display: block;
}

/* ---------- Body ---------- */
.card-body {
  padding: 16px;
  background: var(--surface);
}

/* Key-Value */
.kv {
  display: grid;
  gap: 10px;
}
.kv > div {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px;
  align-items: center;
}
.kv dt {
  color: var(--muted);
  font-size: 12px;
}
.kv dd {
  color: var(--text);
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.kv dd.missing-value {
  color: #d9534f;
  font-weight: 600;
}

/* Email badges for alternative emails */
.email-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.email-badge {
  display: inline-block;
  padding: 4px 10px;
  background: #e7f3ff;
  color: #0066cc;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

/* Empty */
.emptystate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  opacity: 0.5;

  svg {
    font-size: 2rem;
  }
}

/* Straight View */
.straight-view {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      width: 18px;
      height: 18px;
    }
  }
}

.personalnr-display {
  color: var(--text);
  font-weight: 500;
}

.personalnr-missing {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .missing-text {
    color: #d9534f;
    font-weight: 600;
  }
}

.personalnr-edit {
  display: flex;
  gap: 6px;
  align-items: center;
  
  .form-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    transition: border-color 0.2s ease;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }

    &::placeholder {
      color: var(--muted);
    }
  }
}

/* Documents Section */
.documents-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      width: 18px;
      height: 18px;
      color: var(--muted);
    }
  }
}

.doc-category {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  .category-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    margin: 0 0 8px 0;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);

    svg {
      font-size: 11px;
      opacity: 0.7;
    }
  }
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background: var(--hover);
    border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  }

  .doc-icon {
    color: var(--primary);
    font-size: 14px;
    flex-shrink: 0;
  }

  .doc-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;

    .doc-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .doc-date {
      font-size: 11px;
      color: var(--muted);
    }
  }
}

.no-documents {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  color: var(--muted);
  text-align: center;

  svg {
    font-size: 32px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

.flip-view {
  height: 100%;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--soft);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }

  &:hover::-webkit-scrollbar-thumb {
    background: var(--text);
  }
}

.flip-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.flip-profile-section,
.flip-tasks-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      width: 18px;
      height: 18px;
    }
    
    .task-filters {
      display: flex;
      gap: 4px;
      margin-left: auto;
      margin-right: 8px;
      
      .filter-btn {
        padding: 4px 8px;
        border: 1px solid var(--border);
        background: var(--surface);
        border-radius: 4px;
        cursor: pointer;
        color: var(--muted);
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
        
        &:hover {
          color: var(--text);
          background: var(--soft);
          border-color: var(--primary);
        }
        
        &.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        
        svg {
          font-size: 10px;
        }
      }
    }
    
    .refresh-btn {
      padding: 4px;
      border: none;
      background: var(--surface);
      border-radius: 4px;
      cursor: pointer;
      color: var(--muted);
      transition: all 0.2s ease;
      
      &:hover {
        color: var(--text);
        background: var(--soft);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}

.tasks-loading,
.tasks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: var(--muted);
  text-align: center;
  
  svg {
    font-size: 24px;
  }
  
  p {
    margin: 0;
    font-weight: 500;
  }
  
  small {
    font-size: 12px;
    opacity: 0.7;
  }
}

.tasks-categorized {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-category {
  .category-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    padding: 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    
    svg {
      font-size: 12px;
      opacity: 0.7;
    }
  }
  
  .category-tasks {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.task-item {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  transition: all 0.2s ease;
  
  &:hover {
    border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  
  &.task-in-progress {
    border-left: 3px solid var(--primary);
    background: color-mix(in srgb, var(--primary) 5%, var(--surface));
  }
  
  // Kategorie-spezifische Farben
  &.assigned-to-me {
    border-left: 3px solid #10b981; // Grün für "an mich"
    background: color-mix(in srgb, #10b981 3%, var(--surface));
    
    &:hover {
      border-color: #10b981;
    }
  }
  
  &.assigned-by-me {
    border-left: 3px solid #3b82f6; // Blau für "von mir"
    background: color-mix(in srgb, #3b82f6 3%, var(--surface));
    
    &:hover {
      border-color: #3b82f6;
    }
  }
  
  &.available-task {
    border-left: 3px solid #f59e0b; // Orange für "verfügbar"
    background: color-mix(in srgb, #f59e0b 3%, var(--surface));
    
    &:hover {
      border-color: #f59e0b;
    }
  }
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
  
  .task-title {
    flex: 1;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }
  
  .task-status {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
    
    &.status-open,
    &.status-new {
      background: #f1f3f6;
      color: var(--muted);
    }
    
    &.status-in_progress {
      background: #e8fbf3;
      color: #1f8e5d;
    }
    
    &.status-done,
    &.status-finished {
      background: #e0f2fe;
      color: #0277bd;
    }
  }
}

.task-description {
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text);
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  
  .task-link-icon {
    display: inline-block;
    background: var(--primary);
    color: white;
    padding: 2px 4px;
    border-radius: 4px;
    margin: 0 4px;
    font-size: 12px;
    cursor: help;
    text-decoration: none;
    
    &:hover {
      background: color-mix(in srgb, var(--primary) 80%, black);
      transform: scale(1.1);
    }
  }
}

.task-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--muted);
  
  .task-due,
  .task-created {
    display: flex;
    align-items: center;
    gap: 4px;
    
    svg {
      font-size: 10px;
    }
  }
  
  .task-due {
    color: #e67e22;
    font-weight: 500;
  }
}

.task-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.debug-info {
  margin-top: 16px;
  padding: 8px;
  background: var(--soft);
  border-radius: 4px;
  font-size: 11px;
  
  details {
    summary {
      cursor: pointer;
      color: var(--muted);
      font-weight: 500;
      
      &:hover {
        color: var(--text);
      }
    }
  }
  
  .debug-details {
    margin-top: 8px;
    padding-left: 12px;
    
    div {
      padding: 2px 0;
      color: var(--muted);
      
      strong {
        color: var(--text);
      }
    }
  }
}

/* Footer – nur wenn expanded sichtbar */
.card-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

/* Buttons */
.btn {
  border: 1px solid var(--border);
  background: var(--primary);
  color: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: 0.14s ease;
}
.btn:hover {
  filter: brightness(0.96);
}
.btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent);
  outline-offset: 2px;
}
.btn.btn-ghost {
  background: var(--surface);
  color: var(--text);
}
.btn.btn-ghost:hover {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}

/* Expanded: volle Breite + 2 Spalten für Content */
.card[data-expanded="true"] {
  grid-column: 1 / -1;
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
.card[data-expanded="true"] .card-body {
  display: grid;
  gap: 16px;
  grid-template-columns: 1.2fr 1fr;
}
/* Mobile Optimierungen */
@media (max-width: 768px) {
  /* Card Actions auf Mobile nach unten verschieben */
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

.left {
  flex-direction: row;
  align-items: center;
  gap: 14px;
}

.title {
  flex: 1;
  min-width: 0;
}

.title .name {
  white-space: normal; /* Erlaube Zeilenumbruch auf Mobile */
  overflow: visible;
  text-overflow: unset;
  line-height: 1.3;
  word-break: break-word;
}

.card-actions {
  justify-content: center;
  margin-left: 0;
  order: 2;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

/* Avatar etwas kleiner auf Mobile */
.avatar {
  width: 40px;
  height: 40px;
}
.avatar-img {
  width: 40px;
  height: 40px;
}

/* Icon Buttons kleiner und kompakter */
.icon-btn {
  width: 36px;
  height: 36px;
}

/* KV-Pairs für Mobile optimieren */
.kv > div {
  grid-template-columns: 1fr;
  gap: 4px;
}

.kv dt {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.kv dd {
  font-size: 14px;
  word-break: break-all; /* Erlaube Zeilenumbruch für E-Mails */
  margin-bottom: 12px;
  line-height: 1.4;
}

/* Pills auf Mobile kleiner */
@media (max-width: 768px) {
  .title .meta {
    gap: 4px;
    margin-top: 6px;
  }

  .pill {
    font-size: 11px;
    padding: 3px 6px;
  }
}

/* Kleine Mobile Bildschirme - Buttons seitlich aber kompakter */
@media (max-width: 480px) {
  .card-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .card-actions {
    flex-direction: column;
    gap: 4px;
    order: 0;
    margin-left: auto;
    border-top: none;
    padding-top: 0;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
  }

  .left {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 900px) {
  .card[data-expanded="true"] .card-body {
    grid-template-columns: 1fr;
  }
}

/* Expand animation */
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.28s ease, opacity 0.2s ease;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 480px;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .expand-enter-active,
  .expand-leave-active {
    transition: none;
  }
}

/* Selection and Quick Actions - Hidden by default, shown on hover */
.selection-overlay {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.2s ease;
  transform: translateY(-4px);
}

.card:hover .selection-overlay {
  opacity: 1;
  transform: translateY(0);
}

.selection-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--border);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:checked {
    background: var(--primary);
    border-color: var(--primary);
  }

  &:hover {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, white);
    transform: scale(1.1);
  }
}

/* Quick Actions jetzt in card-actions integriert - alte Position nicht mehr benötigt */

/* Asana View Styles */
.asana-view {
  min-height: 200px;
}

.asana-linked {
  .asana-info {
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      
      .section-icon {
        width: 18px;
        height: 18px;
      }
    }

    .asana-id {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: var(--soft);
      border-radius: 8px;
      font-family: "Monaco", "Menlo", monospace;
      font-size: 13px;

      .copy-btn {
        padding: 4px;
        border: none;
        background: var(--surface);
        border-radius: 4px;
        cursor: pointer;
        color: var(--muted);
        transition: all 0.2s ease;

        &:hover {
          color: var(--text);
          background: var(--border);
        }
      }
    }

    .asana-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.asana-link-form {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    
    .section-icon {
      width: 18px;
      height: 18px;
    }
  }

  .form-section {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 600;
      color: var(--text);
      font-size: 13px;
    }

    .input-group,
    .search-group {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }

    .form-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 14px;
      transition: border-color 0.2s ease;

      &:focus {
        outline: none;
        border-color: var(--primary);
      }

      &::placeholder {
        color: var(--muted);
      }
    }
  }

  .divider-text {
    text-align: center;
    margin: 20px 0;
    position: relative;
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--border);
      z-index: 1;
    }

    &::after {
      content: attr(data-text);
      background: var(--surface);
      padding: 0 12px;
      position: relative;
      z-index: 2;
    }
  }

  .search-results {
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;
  }

  .search-result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid var(--border);
    position: relative;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: var(--soft);
    }

    &.featured-task {
      background: linear-gradient(
        135deg,
        rgba(16, 185, 129, 0.08) 0%,
        rgba(16, 185, 129, 0.04) 100%
      );
      border-left: 3px solid #10b981;

      &:hover {
        background: linear-gradient(
          135deg,
          rgba(16, 185, 129, 0.12) 0%,
          rgba(16, 185, 129, 0.06) 100%
        );
      }
    }
  }

  .task-info {
    flex: 1;
    min-width: 0;

    .task-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;

      strong {
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
    }

    small {
      color: var(--muted);
      font-family: "Monaco", "Menlo", monospace;
      font-size: 11px;
      margin-right: 8px;
    }

    .project-tag {
      background: var(--primary);
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .featured-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: #059669;
      margin-top: 4px;
      font-weight: 500;

      svg {
        font-size: 10px;
      }
    }
  }

  .task-status {
    .status-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;

      &.active {
        background: #e8fbf3;
        color: #1f8e5d;
      }

      &.completed {
        background: #f1f3f6;
        color: var(--muted);
      }
    }
  }
}

.no-results {
  padding: 20px;
  text-align: center;
  color: var(--muted);
  font-style: italic;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--soft);
  border-radius: 8px;
  margin-top: 16px;
  color: var(--text);
  font-size: 14px;

  .fa-spin {
    color: var(--primary);
  }
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-secondary {
  background: var(--soft);
  color: var(--text);
  border: 1px solid var(--border);

  &:hover:not(:disabled) {
    background: var(--border);
  }
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: 1px solid #dc3545;

  &:hover:not(:disabled) {
    background: #c82333;
    border-color: #bd2130;
  }
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.featured-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);

  .featured-icon {
    font-size: 8px;
  }
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  background: var(--surface);
  border-radius: 14px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-document {
  max-width: 900px;
}
</style>
