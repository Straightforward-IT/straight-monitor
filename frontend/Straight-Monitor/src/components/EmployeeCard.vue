<template>
  <article class="card" :class="{ 'card--has-user': resolvedMa?.hasUser }" :data-expanded="expanded" :data-theme="effectiveTheme">
    <!-- Self-loading skeleton -->
    <div v-if="selfLoading && !resolvedMa" class="card-self-loading">
      <font-awesome-icon icon="fa-solid fa-spinner" spin />
      <span>Lade Mitarbeiter...</span>
    </div>

    <template v-if="resolvedMa">
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
          :style="{ '--hue': avatarHue(resolvedMa) }"
        >
          {{ initials(resolvedMa) }}
        </div>
        <img v-else class="avatar-img" :src="photoUrl" alt="" />

        <div class="title">
          <div class="name">{{ resolvedMa.vorname }} {{ resolvedMa.nachname }}</div>
          <div class="meta">
            <span class="pill" :class="resolvedMa.isActive ? 'ok' : 'muted'">
              <font-awesome-icon
                :icon="
                  resolvedMa.isActive
                    ? 'fa-solid fa-circle-check'
                    : 'fa-regular fa-circle'
                "
              />
              {{ resolvedMa.isActive ? "Aktiv" : "Inaktiv" }}
            </span>

            <!-- Personalnr mit visueller Warnung wenn fehlend -->
            <span class="pill" :class="resolvedMa.personalnr ? 'ok' : 'warn'">
              <font-awesome-icon icon="fa-solid fa-id-badge" />
              {{ resolvedMa.personalnr || "Personalnr fehlt" }}
            </span>
            
            <!-- Teamleiter Badge -->
            <TlBadge v-if="isTeamleiter" />

            <!-- Monitor Badge (User linked) -->
            <span v-if="resolvedMa?.hasUser" class="pill pill--monitor">
              <img :src="straightDark" class="pill-monitor-icon" alt="" />
              Monitor
            </span>

            <!-- Location Badge -->
            <span class="pill muted" v-if="displayLocation">
              <font-awesome-icon icon="fa-solid fa-location-dot" />
              {{ displayLocation }}
            </span>
            
            <!-- Department Badge -->
            <span class="pill muted" v-if="displayDepartment">
              <font-awesome-icon icon="fa-solid fa-layer-group" />
              {{ displayDepartment }}
            </span>
            
            <!-- Personengruppe Badge -->
            <span class="pill" style="background:var(--soft);color:var(--muted);" v-if="persgruppeLabel">
              <font-awesome-icon icon="fa-solid fa-user" />
              {{ persgruppeLabel }}
            </span>
          </div>
        </div>
      </div>

    </header>

    <!-- Expandable body -->
    <transition name="expand">
      <div v-show="expanded" class="card-body">
        <!-- Straight View -->
        <section v-if="view === 'straight'" class="straight-view">
          <div class="section-header-row">
            <h4 class="section-title">
              <img 
                :src="effectiveTheme === 'dark' ? straightDark : straightLight" 
                alt="Monitor" 
                class="section-icon" 
              />
              Monitor Profil
            </h4>
          </div>
          
          <div class="kv">
            <div class="kv-inline">
              <div>
                <dt>E-Mail</dt>
                <dd>{{ resolvedMa.email || "—" }}</dd>
              </div>
              <div v-if="resolvedMa.telefon">
                <dt>Telefon</dt>
                <dd>
                  <a :href="generateSipgateLink(resolvedMa.telefon)" class="phone-link" @click.prevent="executeQuickAction('sipgate')">
                    <font-awesome-icon icon="fa-solid fa-phone" /> {{ resolvedMa.telefon }}
                  </a>
                </dd>
              </div>
            </div>
            <div v-if="resolvedMa.erstellt_von">
              <dt>Erstellt von</dt>
              <dd>{{ resolvedMa.erstellt_von }}</dd>
            </div>
            <div v-if="resolvedMa.additionalEmails && resolvedMa.additionalEmails.length > 0">
              <dt>Alternative E-Mails</dt>
              <dd>
                <div class="email-list">
                  <span v-for="(email, idx) in resolvedMa.additionalEmails" :key="idx" class="email-badge">
                    {{ email }}
                  </span>
                </div>
              </dd>
            </div>
          </div>

          <!-- Skills Section (Berufe & Qualifikationen) -->
          <div v-if="resolvedMa.berufe?.length || resolvedMa.qualifikationen?.length" class="skills-section">
            <h4 class="section-title">
              <font-awesome-icon icon="fa-solid fa-star" class="section-icon" />
              Kompetenzen
            </h4>

            <div v-if="resolvedMa.berufe?.length" class="skill-group">
              <h5 class="skill-group-title">
                <font-awesome-icon icon="fa-solid fa-briefcase" class="skill-icon-sm" />
                Berufe
              </h5>
              <ul class="skill-list">
                <li 
                  v-for="beruf in resolvedMa.berufe" 
                  :key="beruf.jobKey || beruf._id" 
                  class="skill-item skill-clickable"
                  @click.stop="$emit('filter-beruf', beruf._id)"
                  title="Klicken um nach diesem Beruf zu filtern"
                >
                  <span class="skill-name">{{ beruf.designation }}</span>
                  <span class="skill-badge">{{ beruf.jobKey }}</span>
                </li>
              </ul>
            </div>

            <div v-if="resolvedMa.qualifikationen?.length" class="skill-group">
              <h5 class="skill-group-title">
                <font-awesome-icon icon="fa-solid fa-graduation-cap" class="skill-icon-sm" />
                Qualifikationen
              </h5>
              <ul class="skill-list">
                <li 
                  v-for="quali in resolvedMa.qualifikationen" 
                  :key="quali.qualificationKey || quali._id" 
                  class="skill-item skill-clickable"
                  @click.stop="$emit('filter-qualifikation', quali._id)"
                  title="Klicken um nach dieser Qualifikation zu filtern"
                >
                  <span class="skill-name">{{ quali.designation }}</span>
                  <span class="skill-badge">{{ quali.qualificationKey }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Dokumente Section -->
          <div class="documents-section">
            <h4 class="section-title">
              <font-awesome-icon icon="fa-solid fa-file-lines" class="section-icon" />
              Dokumente
            </h4>

            <!-- Event Reports (als Teamleiter) — geschrieben, immer zuerst -->
            <div v-if="resolvedMa.eventreports && resolvedMa.eventreports.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-clipboard" />
                Event Reports – geschrieben ({{ resolvedMa.eventreports.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in resolvedMa.eventreports" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Event-Bericht')"
                >
                  <font-awesome-icon icon="fa-solid fa-clipboard" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.kunde || doc.location || 'Unbekannt' }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- EventReport Feedback (als Mitarbeiter) — lazy-loaded -->
            <div class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-comment-dots" />
                Event Report – Feedback erhalten
                <span v-if="!loadingFeedback && eventreportFeedback.length > 0">({{ eventreportFeedback.length }})</span>
              </h5>
              <div v-if="loadingFeedback" class="doc-loading">
                <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" /> Lade Feedback...
              </div>
              <div v-else-if="eventreportFeedback.length > 0" class="feedback-inline-list">
                <div 
                  v-for="fb in eventreportFeedback" 
                  :key="fb._id" 
                  class="feedback-inline-item"
                >
                  <div class="feedback-inline-header">
                    <span class="feedback-inline-event">{{ fb.kunde || fb.location || 'Unbekannt' }}</span>
                    <span class="feedback-inline-date">{{ formatDate(fb.datum) }}</span>
                    <button class="btn-report-small" @click.stop="openDocument(fb, 'Event-Bericht')" title="Report öffnen">
                      <font-awesome-icon icon="fa-solid fa-file-lines" />
                      Report
                    </button>
                  </div>
                  <p class="feedback-inline-text">{{ fb.feedback_text || '—' }}</p>
                </div>
              </div>
              <div v-else class="doc-empty-inline">Kein Feedback vorhanden</div>
            </div>

            <!-- Laufzettel Erhalten (als Mitarbeiter) -->
            <div v-if="resolvedMa.laufzettel_received && resolvedMa.laufzettel_received.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-inbox" />
                Laufzettel erhalten ({{ resolvedMa.laufzettel_received.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in resolvedMa.laufzettel_received" 
                  :key="doc._id" 
                  class="doc-item"
                  @click="openDocument(doc, 'Laufzettel')"
                >
                  <font-awesome-icon icon="fa-solid fa-file-lines" class="doc-icon" />
                  <div class="doc-info">
                    <span class="doc-title">{{ doc.kunde || doc.location || 'Unbekannt' }}</span>
                    <span class="doc-date">{{ formatDate(doc.datum) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Laufzettel Abgegeben (als Teamleiter) -->
            <div v-if="resolvedMa.laufzettel_submitted && resolvedMa.laufzettel_submitted.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-paper-plane" />
                Laufzettel abgegeben ({{ resolvedMa.laufzettel_submitted.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in resolvedMa.laufzettel_submitted" 
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

            <!-- Evaluierungen Erhalten (als Mitarbeiter) -->
            <div v-if="resolvedMa.evaluierungen_received && resolvedMa.evaluierungen_received.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-inbox" />
                Evaluierungen erhalten ({{ resolvedMa.evaluierungen_received.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in resolvedMa.evaluierungen_received" 
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
            <div v-if="resolvedMa.evaluierungen_submitted && resolvedMa.evaluierungen_submitted.length > 0" class="doc-category">
              <h5 class="category-title">
                <font-awesome-icon icon="fa-solid fa-paper-plane" />
                Evaluierungen abgegeben ({{ resolvedMa.evaluierungen_submitted.length }})
              </h5>
              <div class="doc-list">
                <div 
                  v-for="doc in resolvedMa.evaluierungen_submitted" 
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
          <div v-if="resolvedMa.flip" class="flip-content">
            <!-- Flip Profile -->
            <div class="flip-profile-section">
              <h4 class="section-title">
                <img :src="flipLogo" alt="Flip" class="section-icon" />
                Flip-Profil
              </h4>
              <FlipProfile :flip-user="resolvedMa.flip" />
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
                    Zugewiesen an {{ resolvedMa.flip.vorname }} ({{ filteredTasksToMe.length }})
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
                    Zugewiesen von {{ resolvedMa.flip.vorname }} ({{ filteredTasksByMe.length }})
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
                    Zugewiesen an {{ resolvedMa.flip.vorname }} ({{ filteredAvailableTasks.length }})
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
          <div v-else class="flip-no-connection">
            <div class="emptystate">
              <font-awesome-icon icon="fa-solid fa-plug-circle-xmark" />
              <p>Keine aktive Flip-Verknüpfung</p>
            </div>

            <!-- Status Messages -->
            <div v-if="flipActionError" class="flip-action-msg error">
              <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
              <span>{{ flipActionError }}</span>
              <button class="close-msg" @click="flipActionError = ''">×</button>
            </div>
            <div v-if="flipActionSuccess" class="flip-action-msg success">
              <font-awesome-icon icon="fa-solid fa-check-circle" />
              <span>{{ flipActionSuccess }}</span>
              <button class="close-msg" @click="flipActionSuccess = ''">×</button>
            </div>

            <!-- Case 1: MA has flip_id → try restore -->
            <div v-if="resolvedMa.flip_id" class="flip-action-section">
              <p class="hint-text">
                <font-awesome-icon icon="fa-solid fa-info-circle" />
                Dieser Mitarbeiter hat eine gespeicherte Flip-ID (<code>{{ resolvedMa.flip_id }}</code>), aber der Account ist nicht aktiv.
              </p>
              <button
                class="btn btn-primary btn-sm"
                @click="restoreFlipUser"
                :disabled="flipActionLoading"
              >
                <font-awesome-icon :icon="flipActionLoading ? 'fa-solid fa-spinner' : 'fa-solid fa-rotate-left'" :class="{ 'fa-spin': flipActionLoading }" />
                {{ flipActionLoading ? 'Wird wiederhergestellt...' : 'Flip-User wiederherstellen' }}
              </button>
            </div>

            <!-- Case 2: No flip_id → create or link -->
            <div v-else class="flip-action-section">
              <p class="hint-text">
                <font-awesome-icon icon="fa-solid fa-info-circle" />
                Kein Flip-Account verknüpft. Du kannst einen neuen erstellen oder einen bestehenden verknüpfen.
              </p>
              <div class="flip-action-buttons">
                <button
                  class="btn btn-primary btn-sm"
                  @click="openFlipCreateForm"
                  :disabled="flipActionLoading"
                >
                  <font-awesome-icon icon="fa-solid fa-user-plus" />
                  Flip-User erstellen
                </button>
                <button
                  class="btn btn-ghost btn-sm"
                  @click="openFlipLinkModal"
                  :disabled="flipActionLoading"
                >
                  <font-awesome-icon icon="fa-solid fa-link" />
                  Bestehenden verknüpfen
                </button>
              </div>
            </div>

            <!-- Create Form (inline) -->
            <div v-if="showFlipCreateConfirm" class="flip-confirm-box flip-create-form">
              <div class="fc-header">
                <strong>Flip-User erstellen</strong>
                <span class="fc-name">{{ resolvedMa.vorname }} {{ resolvedMa.nachname }} &middot; <span class="fc-email">{{ resolvedMa.email }}</span></span>
              </div>

              <div class="fc-row">
                <label class="fc-label">Standort <span class="fc-required">*</span></label>
                <select v-model="flipCreateOptions.location" class="fc-select">
                  <option value="">— auswählen —</option>
                  <option value="Hamburg">Hamburg</option>
                  <option value="Berlin">Berlin</option>
                  <option value="Köln">Köln</option>
                </select>
              </div>

              <div class="fc-checkboxes">
                <label class="fc-check-item">
                  <input type="checkbox" v-model="flipCreateOptions.isService" @change="flipCreateSetDepartment" />
                  Service
                </label>
                <label class="fc-check-item">
                  <input type="checkbox" v-model="flipCreateOptions.isLogistik" @change="flipCreateSetDepartment" />
                  Logistik
                </label>
                <label class="fc-check-item">
                  <input type="checkbox" v-model="flipCreateOptions.isTeamleiter" @change="flipCreateUpdateJobTitle" />
                  Teamleiter
                </label>
                <label class="fc-check-item">
                  <input type="checkbox" v-model="flipCreateOptions.isFestangestellt" />
                  Festangestellt
                </label>
                <label class="fc-check-item">
                  <input type="checkbox" v-model="flipCreateOptions.isOffice" />
                  Office
                </label>
              </div>

              <div class="fc-row">
                <label class="fc-label">Job-Titel</label>
                <input v-model="flipCreateOptions.job_title" type="text" class="fc-input" />
              </div>

              <div v-if="flipCreateOptions.department" class="fc-row">
                <label class="fc-label">Abteilung</label>
                <span class="fc-value-muted">{{ flipCreateOptions.department }}</span>
              </div>

              <div class="flip-confirm-actions">
                <button
                  class="btn btn-primary btn-sm"
                  @click="createFlipUserForMa"
                  :disabled="flipActionLoading || !flipCreateOptions.location"
                >
                  <font-awesome-icon :icon="flipActionLoading ? 'fa-solid fa-spinner' : 'fa-solid fa-check'" :class="{ 'fa-spin': flipActionLoading }" />
                  {{ flipActionLoading ? 'Erstelle...' : 'Erstellen' }}
                </button>
                <button class="btn btn-ghost btn-sm" @click="showFlipCreateConfirm = false" :disabled="flipActionLoading">
                  Abbrechen
                </button>
              </div>
            </div>

            <!-- Link Modal (inline) -->
            <div v-if="showFlipLinkModal" class="flip-link-section">
              <h5 class="section-subtitle">
                <font-awesome-icon icon="fa-solid fa-link" />
                Flip-User verknüpfen
              </h5>
              <div v-if="loadingUnlinkedUsers" class="tasks-loading">
                <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
                <span>Lade verfügbare Flip-User...</span>
              </div>
              <template v-else>
                <input
                  type="text"
                  v-model="flipLinkSearch"
                  placeholder="Flip-User suchen (Name oder Email)..."
                  class="flip-link-search"
                />
                <div class="flip-link-list">
                  <div
                    v-for="user in filteredUnlinkedUsers"
                    :key="user.id"
                    class="flip-link-item"
                    :class="{ selected: selectedFlipUser?.id === user.id }"
                    @click="selectedFlipUser = user"
                  >
                    <div class="flip-link-name">{{ user.first_name }} {{ user.last_name }}</div>
                    <div class="flip-link-email">{{ user.email }}</div>
                  </div>
                  <div v-if="filteredUnlinkedUsers.length === 0" class="flip-link-empty">
                    Keine unverknüpften Flip-User gefunden.
                  </div>
                </div>
                <div class="flip-link-actions">
                  <button
                    class="btn btn-primary btn-sm"
                    @click="linkFlipUser"
                    :disabled="!selectedFlipUser || linkingFlip"
                  >
                    <font-awesome-icon :icon="linkingFlip ? 'fa-solid fa-spinner' : 'fa-solid fa-link'" :class="{ 'fa-spin': linkingFlip }" />
                    {{ linkingFlip ? 'Verknüpfe...' : 'Verknüpfen' }}
                  </button>
                  <button class="btn btn-ghost btn-sm" @click="closeFlipLinkModal">
                    Abbrechen
                  </button>
                </div>
              </template>
            </div>
          </div>
        </section>

        <!-- Asana View -->
        <section v-else-if="view === 'asana'" class="asana-view">
          <!-- Asana Verknüpfung vorhanden -->
          <div v-if="resolvedMa.asana_id" class="asana-linked">
            <div class="asana-info">
              <h4 class="section-title">
                <img :src="asanaLogo" alt="Asana" class="section-icon" />
                Asana-Verknüpfung
              </h4>
              <div class="asana-id">
                <strong>Task-ID:</strong> {{ resolvedMa.asana_id }}
                <button
                  class="copy-btn"
                  @click="copyToClipboard(resolvedMa.asana_id)"
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
                        Enthält {{ resolvedMa.email }}
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

        <!-- Inventar View -->
        <section v-else-if="view === 'inventar'" class="inventar-view">
          <div v-if="inventarLoading" class="inventar-loading">
            <font-awesome-icon icon="fa-solid fa-spinner" class="fa-spin" />
            Inventar wird geladen...
          </div>
          <template v-else>
            <!-- Aktuell im Besitz -->
            <div class="inventar-section">
              <h4 class="section-title">
                <font-awesome-icon icon="fa-solid fa-box-open" class="section-icon" />
                Aktuell im Besitz
              </h4>
              <div v-if="currentHoldings.length > 0" class="holdings-list">
                <div v-for="item in currentHoldings" :key="item.itemId || item.bezeichnung" class="holding-item">
                  <span class="holding-name">{{ item.bezeichnung }}</span>
                  <span v-if="item.groesse" class="holding-size">{{ item.groesse }}</span>
                  <span class="holding-count">× {{ item.net }}</span>
                </div>
              </div>
              <div v-else class="emptystate">
                <font-awesome-icon icon="fa-solid fa-box-open" />
                <p>Keine Gegenstände im Besitz</p>
              </div>
            </div>

            <!-- Monitoring Verlauf -->
            <div class="inventar-section">
              <h4 class="section-title">
                <font-awesome-icon icon="fa-solid fa-clock-rotate-left" class="section-icon" />
                Verlauf
              </h4>
              <div v-if="inventarLogs.length > 0" class="inventar-log-list">
                <div v-for="log in inventarLogs" :key="log._id" class="inventar-log-card">
                  <div class="inventar-log-header">
                    <span class="inventar-log-art" :class="'art--' + log.art">{{ log.art }}</span>
                    <span class="inventar-log-date">{{ formatDate(log.timestamp) }}</span>
                    <span class="inventar-log-user">{{ log.benutzerMail }}</span>
                  </div>
                  <div class="inventar-log-items">
                    <span v-for="(item, i) in log.items" :key="i" class="inventar-log-item">
                      {{ item.bezeichnung }}<template v-if="item.groesse"> ({{ item.groesse }})</template>
                      × {{ item.anzahl }}
                    </span>
                  </div>
                  <p v-if="log.anmerkung" class="inventar-log-annotation">{{ log.anmerkung }}</p>
                </div>
              </div>
              <div v-else class="emptystate">
                <font-awesome-icon icon="fa-solid fa-clock-rotate-left" />
                <p>Keine Transaktionen vorhanden</p>
              </div>
            </div>
          </template>
        </section>

      </div>
    </transition>

    <!-- Hero Panel (right column, flush top-right corner) -->
    <aside v-show="expanded" class="hero-panel" @click.stop>
      <!-- Card Actions (view switcher + quick actions) -->
      <div class="card-actions">
        <!-- Straight Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Monitor-Profil" :position="tooltipPosition" :delay-in="150">
            <button class="icon-btn" :class="{ active: view === 'straight' }" @click="view = 'straight'" :aria-pressed="view === 'straight'">
              <img :src="straightLight" class="logo logo--light" alt="Straight Logo light" />
              <img :src="straightDark" class="logo logo--dark" alt="Straight Logo dark" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button class="icon-btn" :class="{ active: view === 'straight' }" @click="view = 'straight'" :aria-pressed="view === 'straight'">
            <img :src="straightLight" class="logo logo--light" alt="Straight Logo light" />
            <img :src="straightDark" class="logo logo--dark" alt="Straight Logo dark" />
          </button>
        </template>

        <!-- Flip Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Flip-Profil" :position="tooltipPosition" :delay-in="150">
            <button class="icon-btn" :class="{ active: view === 'flip' }" @click="view = 'flip'" :aria-pressed="view === 'flip'">
              <img :src="flipLogo" alt="Flip Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button class="icon-btn" :class="{ active: view === 'flip' }" @click="view = 'flip'" :aria-pressed="view === 'flip'">
            <img :src="flipLogo" alt="Flip Logo" class="logo" />
          </button>
        </template>

        <!-- Asana Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Asana-Task" :position="tooltipPosition" :delay-in="150">
            <button class="icon-btn" :class="{ active: view === 'asana' }" @click="view = 'asana'" :aria-pressed="view === 'asana'">
              <img :src="asanaLogo" alt="Asana Logo" class="logo" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button class="icon-btn" :class="{ active: view === 'asana' }" @click="view = 'asana'" :aria-pressed="view === 'asana'">
            <img :src="asanaLogo" alt="Asana Logo" class="logo" />
          </button>
        </template>

        <!-- Inventar Button -->
        <template v-if="showTooltips">
          <custom-tooltip text="Inventar" :position="tooltipPosition" :delay-in="150">
            <button class="icon-btn" :class="{ active: view === 'inventar' }" @click="view = 'inventar'" :aria-pressed="view === 'inventar'">
              <font-awesome-icon icon="fa-solid fa-box-open" />
            </button>
          </custom-tooltip>
        </template>
        <template v-else>
          <button class="icon-btn" :class="{ active: view === 'inventar' }" @click="view = 'inventar'" :aria-pressed="view === 'inventar'">
            <font-awesome-icon icon="fa-solid fa-box-open" />
          </button>
        </template>

        <!-- Actions Button with Dropdown -->
        <div class="quick-actions-wrapper" @click.stop>
          <template v-if="showTooltips">
            <custom-tooltip text="Aktionen" :position="tooltipPosition" :delay-in="150">
              <button class="icon-btn" :class="{ active: showQuickActionsMenu }" @click="toggleQuickActions">
                <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
              </button>
            </custom-tooltip>
          </template>
          <template v-else>
            <button class="icon-btn" :class="{ active: showQuickActionsMenu }" @click="toggleQuickActions">
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
          </template>
          <teleport to="body">
            <div v-if="showQuickActionsMenu" class="qa-overlay" @click="showQuickActionsMenu = false">
              <div class="qa-menu" :style="quickActionsMenuStyle" @click.stop>
                <div v-if="getPhoneNumber() || resolvedMa?.email" class="qa-group">
                  <div class="qa-group-label">Kontakt</div>
                  <button v-if="getPhoneNumber()" class="qa-item" @click="executeQuickAction('sipgate')">
                    <font-awesome-icon icon="fa-solid fa-phone" /> {{ getPhoneNumber() }}
                  </button>
                  <button v-if="resolvedMa.email" class="qa-item" @click="executeQuickAction('outlook')">
                    <font-awesome-icon icon="fa-solid fa-envelope" /> {{ resolvedMa.email }}
                  </button>
                </div>
                <div class="qa-group">
                  <div class="qa-group-label">Aktionen</div>
                  <button class="qa-item" @click="executeQuickAction('share-link')">
                    <font-awesome-icon :icon="linkCopied ? 'fa-solid fa-check' : 'fa-solid fa-link'" />
                    {{ linkCopied ? 'Link kopiert!' : 'Link teilen' }}
                  </button>
                  <button class="qa-item" @click="executeQuickAction('upload-photo')">
                    <font-awesome-icon icon="fa-solid fa-camera" /> Bild hochladen
                  </button>
                  <button class="qa-item" @click="executeQuickAction('edit')">
                    <font-awesome-icon icon="fa-solid fa-edit" /> Bearbeiten
                  </button>
                  <button class="qa-item" @click="executeQuickAction('toggle-active')">
                    <font-awesome-icon :icon="resolvedMa.isActive ? 'fa-regular fa-circle' : 'fa-solid fa-circle-check'" />
                    {{ resolvedMa.isActive ? 'Deaktivieren' : 'Reaktivieren' }}
                  </button>
                  <button class="qa-item qa-item--danger" @click="executeQuickAction('delete')">
                    <font-awesome-icon icon="fa-solid fa-trash" /> Löschen
                  </button>
                </div>
              </div>
            </div>
          </teleport>
        </div>
      </div>

      <div class="hero-media" :class="{ 'hero-media--clickable': !photoUrl }" @click="!photoUrl && (showImageCropModal = true)" :title="!photoUrl ? 'Bild hochladen' : undefined">
        <img v-if="photoUrl" :src="photoUrl" :alt="`${resolvedMa.vorname} ${resolvedMa.nachname}`" class="hero-img" />
        <div v-else class="hero-initials" :style="{ '--hue': avatarHue(resolvedMa) }">
          {{ initials(resolvedMa) }}
        </div>
        <div v-if="!photoUrl" class="hero-upload-hint">
          <font-awesome-icon icon="fa-solid fa-camera" />
        </div>
      </div>
    </aside>

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

    <teleport to="body">
      <ContextMenu
        v-if="showContextMenu"
        :x="contextMenuX"
        :y="contextMenuY"
        :options="contextMenuOptions"
        @select="handleContextMenuSelect"
        @close="showContextMenu = false"
      />
    </teleport>

    <!-- Modals -->
    <teleport to="body">
      <EditMitarbeiterDialog
        v-if="showEditModal"
        :mitarbeiter="resolvedMa"
        :saving="savingEdit"
        :conflict-info="editConflictInfo"
        @close="closeEditModal"
        @save="saveEdit"
        @save-force="saveEditForce"
        @cancel-conflict="editConflictInfo = null"
      />
      
      <DeleteMitarbeiterDialog
        v-if="showDeleteModal"
        :name="`${resolvedMa.vorname} ${resolvedMa.nachname}`"
        :loading="deletingMitarbeiter"
        @close="closeDeleteModal"
        @confirm="confirmDelete"
      />
    </teleport>

    <!-- Profilbild Upload Modal -->
    <teleport to="body">
      <ImageCropModal
        v-if="showImageCropModal"
        :mitarbeiter-id="resolvedMa._id"
        @close="showImageCropModal = false"
        @uploaded="onProfilbildUploaded"
      />
    </teleport>

  </template>

  </article>
</template>
<script>
import { computed, ref, onMounted, onBeforeUnmount, watchEffect } from "vue";
import { useRouter } from "vue-router";
import CustomTooltip from "./CustomTooltip.vue";
import FlipProfile from "./FlipProfile.vue";
import DocumentCard from "./DocumentCard.vue";
import ContextMenu from "./ContextMenu.vue";
import EditMitarbeiterDialog from "./EditMitarbeiterDialog.vue";
import DeleteMitarbeiterDialog from "./DeleteMitarbeiterDialog.vue";
import ImageCropModal from "./ImageCropModal.vue";
import TlBadge from "./ui-elements/TlBadge.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useTheme } from "@/stores/theme";
import { useFlipAll } from "@/stores/flipAll";
import { useDataCache } from "@/stores/dataCache";
import api from "@/utils/api";
import { fetchFlipTasks } from "@/utils/flipApi";
import FlipMappings from "@/assets/FlipMappings.json";

// Assets importieren (Vite handled cache+preload)
import straightLight from "@/assets/SF_002.png";
import straightDark from "@/assets/SF_000.svg";
import flipLogo from "@/assets/flip.png";
import asanaLogo from "@/assets/asana.png";

export default {
  name: "EmployeeCard",
  components: { CustomTooltip, FontAwesomeIcon, FlipProfile, DocumentCard, EditMitarbeiterDialog, DeleteMitarbeiterDialog, ImageCropModal, ContextMenu, TlBadge },
  props: {
    ma: { type: Object, required: false, default: null },
    mitarbeiterId: { type: String, default: null },
    initiallyExpanded: { type: Boolean, default: false },
    showCheckbox: { type: Boolean, default: false },
    isSelected: { type: Boolean, default: false },
  },
  emits: ["open", "edit", "toggle-selection", "quick-actions", "close", "open-employee", "filter-beruf", "filter-qualifikation"],

  setup(props) {
    const theme = useTheme(); // { current: 'light' | 'dark' | 'system' }
    const router = useRouter();

    // Self-loading state (used when only mitarbeiterId prop is passed)
    const selfLoadedMa = ref(null);
    const selfLoading = ref(false);
    // Resolves to the passed ma prop, or the self-loaded one
    const resolvedMaSetup = computed(() => props.ma || selfLoadedMa.value);

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
      resolvedMaSetup.value?.flip?.attributes?.find?.((a) => a?.name === name)?.value;

    const displayLocation = computed(() => {
        // 1. Flip Location
        const flipLoc = resolvedMaSetup.value?.flip?.profile?.location || getFlipAttr("location");
        if (flipLoc) return flipLoc;

        // 2. Database Location
        if (resolvedMaSetup.value?.standort) return resolvedMaSetup.value?.standort;

        // 3. Fallback: Personalnr Logic
        // 1xxxx = Berlin, 2xxxx = Hamburg, 3xxxx = Köln
        const pnr = resolvedMaSetup.value?.personalnr;
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
        resolvedMaSetup.value?.flip?.profile?.department ||
        getFlipAttr("department") ||
        resolvedMaSetup.value?.abteilung ||
        ""
    );
    // FLip Profile Picture
    const flip = useFlipAll();
    const photoUrl = ref("");
    watchEffect(async () => {
      // 1. Try Flip profile picture
      if (flip.enablePhotos) {
        const id = resolvedMaSetup.value?.flip?.id;
        if (id) {
          const flipUrl = await flip.ensurePhoto(id);
          if (flipUrl) {
            photoUrl.value = flipUrl;
            return;
          }
        }
      }
      // 2. Fallback: R2 profilbild
      if (resolvedMaSetup.value?.profilbild) {
        try {
          const res = await api.get(`/api/personal/mitarbeiter/${resolvedMaSetup.value?._id}/profilbild`);
          if (res.data?.url) {
            photoUrl.value = res.data.url;
            return;
          }
        } catch (_) { /* ignore */ }
      }
      photoUrl.value = "";
    });
    
    // Check if user is a Teamleiter
    const isTeamleiter = computed(() => {
      // Logic update: Teamleiter is defined by qualification key '50055' only
      if (resolvedMaSetup.value?.qualifikationen?.length > 0) {
        return resolvedMaSetup.value.qualifikationen.some(q => {
            const key = String(q.qualificationKey).trim();
            // Checking for '50055'
            return parseInt(key, 10) === 50055;
        });
      }
      return false;
    });

    const dataCache = useDataCache();

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
      dataCache,
      selfLoadedMa,
      selfLoading,
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
      
      // Edit Dialog
      showEditModal: false,
      savingEdit: false,
      editConflictInfo: null,
      
      // Delete Dialog
      showDeleteModal: false,
      deletingMitarbeiter: false,

      // Context Menu
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,

      // Quick Actions Menu
      showQuickActionsMenu: false,
      linkCopied: false,
      quickActionsMenuStyle: {},

      // EventReport Feedback (lazy-loaded on expand)
      eventreportFeedback: [],
      loadingFeedback: false,

      // Flip Management (restore/create/link)
      flipActionLoading: false,
      flipActionError: "",
      flipActionSuccess: "",
      showFlipCreateConfirm: false,
      flipCreateOptions: {
        location: '',
        isService: false,
        isLogistik: false,
        isTeamleiter: false,
        isFestangestellt: false,
        isOffice: false,
        job_title: 'Mitarbeiter/in',
        department: '',
      },
      showFlipLinkModal: false,
      flipLinkSearch: "",
      flipUnlinkedUsers: [],
      loadingUnlinkedUsers: false,
      selectedFlipUser: null,
      linkingFlip: false,

      // Inventar
      inventarLogs: [],
      inventarLoading: false,

      // Profilbild Upload
      showImageCropModal: false,
    };
  },

  computed: {
    resolvedMa() {
      return this.ma || this.selfLoadedMa;
    },
    contextMenuOptions() {
      return [
        { label: 'Bearbeiten', action: 'edit' },
        { label: this.resolvedMa?.isActive ? 'Deaktivieren' : 'Reaktivieren', action: 'toggle-active' },
        { label: 'Löschen', action: 'delete' }
      ];
    },
    persgruppeLabel() {
      const map = { 101: 'Festi', 110: 'KZF', 109: 'Mini', 106: 'Werkst.' };
      return this.resolvedMa?.persgruppe ? map[this.resolvedMa.persgruppe] ?? null : null;
    },
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
        (this.resolvedMa?.laufzettel_received && this.resolvedMa.laufzettel_received.length > 0) ||
        (this.resolvedMa?.laufzettel_submitted && this.resolvedMa.laufzettel_submitted.length > 0) ||
        (this.resolvedMa?.eventreports && this.resolvedMa.eventreports.length > 0) ||
        (this.resolvedMa?.evaluierungen_received && this.resolvedMa.evaluierungen_received.length > 0) ||
        (this.resolvedMa?.evaluierungen_submitted && this.resolvedMa.evaluierungen_submitted.length > 0) ||
        this.eventreportFeedback.length > 0
      );
    },
    filteredUnlinkedUsers() {
      const q = this.flipLinkSearch.toLowerCase().trim();
      if (!q) return this.flipUnlinkedUsers.slice(0, 50);
      return this.flipUnlinkedUsers.filter(u => {
        const name = `${u.first_name} ${u.last_name}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      }).slice(0, 50);
    },
    currentHoldings() {
      const holdings = {};
      for (const log of this.inventarLogs) {
        // entnahme = item was taken out of stock and given TO the employee → positive
        // zugabe   = item was returned by the employee back to stock → negative
        const isAdd = log.art === 'entnahme';
        const isRemove = log.art === 'zugabe';
        if (!isAdd && !isRemove) continue;
        for (const item of (log.items || [])) {
          const key = item.itemId || item.bezeichnung;
          if (!holdings[key]) {
            holdings[key] = { itemId: item.itemId, bezeichnung: item.bezeichnung, groesse: item.groesse, net: 0 };
          }
          holdings[key].net += isAdd ? (item.anzahl || 1) : -(item.anzahl || 1);
          // Never go below 0 — old returns without tracked entnahme don't create -1 entries
          holdings[key].net = Math.max(0, holdings[key].net);
        }
      }
      return Object.values(holdings).filter(h => h.net > 0);
    },
  },

  watch: {
    mitarbeiterId(newId) {
      if (newId && !this.ma) this.loadSelf();
    },
    'ma._id'(newId, oldId) {
      if (newId !== oldId) {
        // Reset inventar state when a different mitarbeiter is shown
        this.inventarLogs = [];
        this.inventarLoading = false;
        if (this.view === 'inventar' && this.expanded) {
          this.fetchInventar();
        }
      }
    },
    view(newView) {
      // Load tasks when switching to flip view
      if (newView === 'flip' && this.expanded && this.resolvedMa?.flip?.id && !this.tasksLoaded) {
        this.loadFlipTasks();
      }
      // Load inventar when switching to inventar view
      if (newView === 'inventar' && this.expanded && this.inventarLogs.length === 0 && !this.inventarLoading) {
        this.fetchInventar();
      }
    }
  },

  mounted() {
    document.addEventListener('keydown', this.handleEscapeKey);

    // Self-load if only mitarbeiterId was passed
    if (this.mitarbeiterId && !this.ma) {
      this.loadSelf();
      return; // expanded lazy-loads will trigger after data arrives via loadSelf()
    }

    // When opened with initiallyExpanded=true, toggle() is never called,
    // so we must trigger lazy-loading manually.
    if (this.expanded) {
      if (this.eventreportFeedback.length === 0 && !this.loadingFeedback) {
        this.loadEventReportFeedback();
      }
      if (this.view === 'flip' && this.resolvedMa?.flip?.id && !this.tasksLoaded) {
        this.loadFlipTasks();
      }
      if (this.view === 'inventar' && this.inventarLogs.length === 0 && !this.inventarLoading) {
        this.fetchInventar();
      }
    }
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscapeKey);
  },

  methods: {
    async loadSelf() {
      const id = this.mitarbeiterId;
      if (!id) return;
      this.selfLoading = true;
      try {
        const response = await api.get(`/api/personal/mitarbeiter/${id}`);
        const data = response.data?.data || response.data;
        if (data.flip_id) {
          try {
            const flipRes = await api.get(`/api/personal/flip/by-id/${data.flip_id}`);
            data.flip = flipRes.data;
          } catch { /* flip profile will show on next load */ }
        }
        this.selfLoadedMa = data;
        // Trigger lazy-loads that depend on expanded state
        if (this.expanded) {
          if (this.eventreportFeedback.length === 0 && !this.loadingFeedback) {
            this.loadEventReportFeedback();
          }
          if (this.view === 'flip' && this.resolvedMa?.flip?.id && !this.tasksLoaded) {
            this.loadFlipTasks();
          }
          if (this.view === 'inventar' && this.inventarLogs.length === 0 && !this.inventarLoading) {
            this.fetchInventar();
          }
        }
      } catch (err) {
        console.error('[EmployeeCard] loadSelf failed:', err);
      } finally {
        this.selfLoading = false;
      }
    },
    toggle() {
      this.expanded = !this.expanded;

      if (this.expanded) {
        this.$emit("open", this.resolvedMa);

        // Lazy-load EventReport feedback
        if (this.eventreportFeedback.length === 0 && !this.loadingFeedback) {
          this.loadEventReportFeedback();
        }

        // Auto-load tasks if flip view and not loaded yet
        if (this.view === 'flip' && this.resolvedMa?.flip?.id && !this.tasksLoaded) {
          this.loadFlipTasks();
        }
      }
    },
    async loadEventReportFeedback() {
      if (!this.resolvedMa?._id) return;
      this.loadingFeedback = true;
      try {
        const res = await api.get(`/api/personal/mitarbeiter/${this.resolvedMa._id}/eventreport-feedback`);
        this.eventreportFeedback = res.data?.data || [];
      } catch (err) {
        console.error('Error loading EventReport feedback:', err);
        this.eventreportFeedback = [];
      } finally {
        this.loadingFeedback = false;
      }
    },
    async fetchInventar() {
      if (!this.resolvedMa?._id) return;
      this.inventarLoading = true;
      try {
        const { data } = await api.get(`/api/monitoring/mitarbeiter/${this.resolvedMa._id}`);
        this.inventarLogs = data || [];
      } catch (e) {
        console.error('Fehler beim Laden des Inventars:', e);
        this.inventarLogs = [];
      } finally {
        this.inventarLoading = false;
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
      this.personalnrInput = this.resolvedMa?.personalnr || "";
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
          `/api/personal/mitarbeiter/${this.resolvedMa._id}/personalnr`,
          {
            personalnr: this.personalnrInput.trim(),
          }
        );

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.resolvedMa.personalnr = this.personalnrInput.trim();
          this.dataCache.updateOneMitarbeiter(this.resolvedMa);
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
      if (!this.resolvedMa?.asana_id) return;

      // Asana Task-URL generieren
      const url = `https://app.asana.com/0/0/${this.resolvedMa.asana_id}`;
      window.open(url, "_blank");
    },

    async removeAsanaLink() {
      if (!confirm("Asana-Verknüpfung wirklich entfernen?")) {
        return;
      }

      this.savingAsana = true;

      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.resolvedMa._id}`,
          {
            asana_id: null,
          }
        );

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.resolvedMa.asana_id = null;
          this.dataCache.updateOneMitarbeiter(this.resolvedMa);
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
        mitarbeiterId: this.resolvedMa._id,
        mitarbeiterName: `${this.resolvedMa.vorname} ${this.resolvedMa.nachname}`,
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
          `/api/personal/mitarbeiter/${this.resolvedMa._id}`,
          {
            asana_id: this.asanaGidInput.trim(),
          }
        );

        console.log("📡 API Response (GID):", response.data);

        if (response.data?.success) {
          // Update lokales Mitarbeiter-Objekt
          this.resolvedMa.asana_id = this.asanaGidInput.trim();
          this.dataCache.updateOneMitarbeiter(this.resolvedMa);
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
            employeeEmail: this.resolvedMa?.email, // Pass employee email for featured suggestions
            employeeLocation: this.displayLocation || this.resolvedMa?.standort, // Pass location for prioritization
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
        mitarbeiterId: this.resolvedMa._id,
        mitarbeiterName: `${this.resolvedMa.vorname} ${this.resolvedMa.nachname}`,
      });

      this.savingAsana = true;

      try {
        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.resolvedMa._id}`,
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
          this.resolvedMa.asana_id = task.gid;
          this.dataCache.updateOneMitarbeiter(this.resolvedMa);
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
      if (!this.resolvedMa?.flip?.id) {
        console.log("❌ No Flip ID available for", this.resolvedMa?.vorname, this.resolvedMa?.nachname);
        return;
      }

      console.log("🔄 Loading Flip tasks for user:", this.resolvedMa.flip.id);
      this.loadingTasks = true;

      try {
        const response = await fetchFlipTasks(this.resolvedMa.flip.id);
        this.flipTasks = response || {
          assignedToMe: [],
          assignedByMe: [], 
          available: [],
          total: 0,
          summary: { assignedToMe: 0, assignedByMe: 0, available: 0 }
        };
        this.tasksLoaded = true;
        
        console.log(`✅ Loaded ${this.flipTasks.total} Flip tasks for ${this.resolvedMa?.vorname} ${this.resolvedMa?.nachname}:`, this.flipTasks.summary);
        
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

    // ── Flip Management Methods ──────────────────────────────────────
    async restoreFlipUser() {
      if (!this.resolvedMa?.flip_id) return;
      this.flipActionLoading = true;
      this.flipActionError = "";
      this.flipActionSuccess = "";
      try {
        await api.post(`/api/personal/flip/restore/${this.resolvedMa.flip_id}`);
        // Re-fetch the flip user data
        const flipRes = await api.get(`/api/personal/flip/by-id/${this.resolvedMa.flip_id}`);
        this.resolvedMa.flip = flipRes.data;
        this.dataCache.updateOneMitarbeiter(this.resolvedMa);
        this.flipActionSuccess = "Flip-User erfolgreich wiederhergestellt!";
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data?.error?.title || err.message;
        this.flipActionError = `Wiederherstellung fehlgeschlagen: ${msg}`;
      } finally {
        this.flipActionLoading = false;
      }
    },

    openFlipCreateForm() {
      const rawLoc = this.displayLocation || this.resolvedMa?.standort || '';
      const canonMap = { 'hamburg': 'Hamburg', 'berlin': 'Berlin', 'köln': 'Köln', 'koeln': 'Köln', 'koln': 'Köln' };
      const canonLoc = canonMap[rawLoc.toLowerCase()] || (['Hamburg','Berlin','Köln'].includes(rawLoc) ? rawLoc : '');
      const isTl = this.isTeamleiter;
      const isFesti = this.resolvedMa?.persgruppe === 101;
      this.flipCreateOptions = {
        location: canonLoc,
        isService: false,
        isLogistik: false,
        isTeamleiter: isTl,
        isFestangestellt: isFesti,
        isOffice: false,
        job_title: isTl ? 'Teamleiter/in' : 'Mitarbeiter/in',
        department: '',
      };
      this.showFlipCreateConfirm = true;
    },

    flipCreateSetDepartment() {
      const depts = [];
      if (this.flipCreateOptions.isService) depts.push('Service');
      if (this.flipCreateOptions.isLogistik) depts.push('Logistik');
      this.flipCreateOptions.department = depts.join('/');
    },

    flipCreateUpdateJobTitle() {
      this.flipCreateOptions.job_title = this.flipCreateOptions.isTeamleiter ? 'Teamleiter/in' : 'Mitarbeiter/in';
    },

    buildFlipAttributesFromOptions() {
      const o = this.flipCreateOptions;
      return [
        { name: 'job_title',  value: o.job_title },
        { name: 'location',   value: o.location },
        { name: 'department', value: o.department },
        { name: 'isService',  value: String(o.isService) },
        { name: 'isLogistik', value: String(o.isLogistik) },
        { name: 'isTeamLead', value: String(o.isTeamleiter) },
        { name: 'isOffice',   value: String(o.isOffice) },
        { name: 'isFesti',    value: String(o.isFestangestellt) },
      ];
    },

    buildFlipUserGroupIds() {
      const o = this.flipCreateOptions;
      const gids = FlipMappings.user_group_ids;
      const locKey = o.location.toLowerCase()
        .replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ä/g, 'ae');
      const ids = [];
      if (gids.all_users) ids.push(gids.all_users);
      if (gids[locKey]) ids.push(gids[locKey]);
      if (o.isService       && gids[`${locKey}_service`])        ids.push(gids[`${locKey}_service`]);
      if (o.isLogistik      && gids[`${locKey}_logistik`])       ids.push(gids[`${locKey}_logistik`]);
      if (o.isFestangestellt && gids[`${locKey}_festangestellte`]) ids.push(gids[`${locKey}_festangestellte`]);
      if (o.isOffice        && gids[`${locKey}_office`])         ids.push(gids[`${locKey}_office`]);
      if (o.isTeamleiter    && gids[`${locKey}_teamleiter`])     ids.push(gids[`${locKey}_teamleiter`]);
      return ids;
    },

    async createFlipUserForMa() {
      this.flipActionLoading = true;
      this.flipActionError = "";
      this.flipActionSuccess = "";
      try {
        const locKey = this.flipCreateOptions.location.toLowerCase()
          .replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ä/g, 'ae');
        const res = await api.post("/api/personal/flip/create-for-mitarbeiter", {
          mitarbeiterId: this.resolvedMa._id,
          attributes: this.buildFlipAttributesFromOptions(),
          user_group_ids: this.buildFlipUserGroupIds(),
          primary_user_group_id: FlipMappings.user_group_ids[locKey] || null,
        });
        // Update local data
        this.resolvedMa.flip_id = res.data.flipUser?.id;
        // Re-fetch flip data
        if (this.resolvedMa.flip_id) {
          try {
            const flipRes = await api.get(`/api/personal/flip/by-id/${this.resolvedMa.flip_id}`);
            this.resolvedMa.flip = flipRes.data;
          } catch { /* flip profile will show on next load */ }
        }
        this.dataCache.updateOneMitarbeiter(this.resolvedMa);
        this.flipActionSuccess = "Flip-User erfolgreich erstellt und verknüpft!";
        this.showFlipCreateConfirm = false;
      } catch (err) {
        const data = err.response?.data;
        this.flipActionError = data?.message || "Fehler beim Erstellen des Flip-Users.";
        this.showFlipCreateConfirm = false;
      } finally {
        this.flipActionLoading = false;
      }
    },

    async openFlipLinkModal() {
      this.showFlipLinkModal = true;
      this.flipLinkSearch = "";
      this.selectedFlipUser = null;
      this.loadingUnlinkedUsers = true;
      try {
        const res = await api.get("/api/personal/flip/unlinked");
        this.flipUnlinkedUsers = res.data.data || [];
      } catch (err) {
        console.error("Fehler beim Laden unverknüpfter Flip-User:", err);
        this.flipUnlinkedUsers = [];
      } finally {
        this.loadingUnlinkedUsers = false;
      }
    },

    closeFlipLinkModal() {
      this.showFlipLinkModal = false;
      this.flipLinkSearch = "";
      this.selectedFlipUser = null;
      this.flipUnlinkedUsers = [];
    },

    async linkFlipUser() {
      if (!this.selectedFlipUser) return;
      this.linkingFlip = true;
      this.flipActionError = "";
      this.flipActionSuccess = "";
      try {
        const res = await api.patch(`/api/personal/mitarbeiter/${this.resolvedMa._id}/link-flip`, {
          flip_id: this.selectedFlipUser.id,
        });
        this.resolvedMa.flip_id = this.selectedFlipUser.id;
        // Re-fetch full flip data
        try {
          const flipRes = await api.get(`/api/personal/flip/by-id/${this.selectedFlipUser.id}`);
          this.resolvedMa.flip = flipRes.data;
        } catch { /* will show on next load */ }
        this.dataCache.updateOneMitarbeiter(this.resolvedMa);
        this.flipActionSuccess = `Verknüpft mit ${this.selectedFlipUser.first_name} ${this.selectedFlipUser.last_name}`;
        this.closeFlipLinkModal();
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        this.flipActionError = msg;
      } finally {
        this.linkingFlip = false;
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


    // --- Context Menu ---
    openContextMenu(event) {
      const rect = event.target.closest('button').getBoundingClientRect();
      this.contextMenuX = rect.left;
      this.contextMenuY = rect.bottom + 5;
      this.showContextMenu = true;
    },

    async handleContextMenuSelect(action) {
      if (action === 'edit') {
        this.openEditModal();
      } else if (action === 'delete') {
        this.openDeleteModal();
      } else if (action === 'toggle-active') {
        await this.toggleActiveStatus();
      }
    },

    // --- Quick Actions Menu (Header 3-dot) ---
    toggleQuickActions(event) {
      if (this.showQuickActionsMenu) {
        this.showQuickActionsMenu = false;
        return;
      }
      const btn = event.target.closest('button');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        this.quickActionsMenuStyle = {
          position: 'fixed',
          top: rect.bottom + 4 + 'px',
          left: Math.min(rect.left, window.innerWidth - 220) + 'px',
        };
      }
      this.showQuickActionsMenu = true;
    },

    getPhoneNumber() {
      // Prefer direct telefon field from Mitarbeiter model (imported from Zvoove)
      if (this.resolvedMa?.telefon) return this.resolvedMa.telefon;
      // Fallback: extract from Flip attributes
      if (!this.resolvedMa?.flip?.attributes) return null;
      const phoneAttribute = this.resolvedMa?.flip?.attributes?.find(attr => {
        const name = attr.name?.toLowerCase() || '';
        return name.includes('telefon') || name.includes('phone') || 
               name.includes('handy') || name.includes('mobile') || name.includes('tel');
      });
      return phoneAttribute?.value || null;
    },

    generateSipgateLink(phoneNumber) {
      if (!phoneNumber) return null;
      let cleanNumber = phoneNumber.toString().replace(/[^\d+]/g, '');
      if (!cleanNumber) return null;
      if (cleanNumber.startsWith('0') && !cleanNumber.startsWith('+')) {
        cleanNumber = '+49' + cleanNumber.substring(1);
      }
      return `sipgate://phone/call?number=${cleanNumber}`;
    },

    executeQuickAction(action) {
      this.showQuickActionsMenu = false;
      switch (action) {
        case 'sipgate': {
          const phone = this.getPhoneNumber();
          if (phone) {
            const url = this.generateSipgateLink(phone);
            window.open(url, '_self');
          }
          break;
        }
        case 'outlook':
          if (this.resolvedMa?.email) {
            window.open(`mailto:${this.resolvedMa.email}`, '_self');
          }
          break;
        case 'edit':
          this.openEditModal();
          break;
        case 'toggle-active':
          this.toggleActiveStatus();
          break;
        case 'delete':
          this.openDeleteModal();
          break;
        case 'share-link':
          this.copyShareLink();
          return; // Don't close menu yet
        case 'upload-photo':
          this.showImageCropModal = true;
          break;
      }
    },

    async onProfilbildUploaded(r2Key) {
      this.showImageCropModal = false;
      this.resolvedMa.profilbild = r2Key;
      // Immediately fetch the signed URL and show it
      try {
        const res = await api.get(`/api/personal/mitarbeiter/${this.resolvedMa._id}/profilbild`);
        if (res.data?.url) {
          this.photoUrl = res.data.url;
        }
      } catch (_) { /* watchEffect will pick it up on next cycle */ }
    },

    copyShareLink() {
      const resolved = this.$router.resolve({ name: 'Personal', query: { mitarbeiter_id: this.resolvedMa._id } });
      const url = window.location.origin + resolved.href;
      navigator.clipboard.writeText(url).then(() => {
        this.linkCopied = true;
        setTimeout(() => {
          this.linkCopied = false;
          this.showQuickActionsMenu = false;
        }, 1200);
      });
    },

    async toggleActiveStatus() {
      try {
        const newStatus = !this.resolvedMa?.isActive;
        const response = await api.patch(`/api/personal/mitarbeiter/${this.resolvedMa._id}`, {
          isActive: newStatus
        });
        
        if (response.data?.success) {
          this.resolvedMa.isActive = newStatus;
          this.dataCache.updateOneMitarbeiter(this.resolvedMa);
        }
      } catch (error) {
        console.error("❌ Fehler beim Ändern des Status:", error);
        alert("Fehler beim Ändern des Status.");
      }
    },

    // --- Edit Dialog Methods ---
    openEditModal() {
      this.showEditModal = true;
    },
    
    closeEditModal() {
      this.showEditModal = false;
      this.editConflictInfo = null;
    },
    
    async saveEdit(formData) {
      this.savingEdit = true;
      this.editConflictInfo = null;
      try {
        const updatePayload = {
          vorname: formData.vorname,
          nachname: formData.nachname,
          personalnr: formData.personalnr,
          email: formData.email,
          erstellt_von: formData.erstellt_von,
          additionalEmails: formData.additionalEmails,
          personalnrHistory: formData.personalnrHistory
        };

        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.resolvedMa._id}`,
          updatePayload
        );

        if (response.data?.success) {
           Object.assign(this.resolvedMa, response.data.data);
           this.dataCache.updateOneMitarbeiter(response.data.data);
           this.closeEditModal();
        } else {
           throw new Error(response.data?.message || "Fehler beim Speichern");
        }
      } catch (error) {
        if (error.response?.status === 409 && error.response.data?.conflict) {
          this.editConflictInfo = error.response.data.conflict;
          this._pendingEditFormData = formData;
        } else {
          console.error("❌ Fehler beim Bearbeiten:", error);
          alert(`Fehler beim Speichern: ${error.response?.data?.message || error.message}`);
        }
      } finally {
        this.savingEdit = false;
      }
    },

    async saveEditForce(formData) {
      this.savingEdit = true;
      try {
        const updatePayload = {
          vorname: formData.vorname,
          nachname: formData.nachname,
          personalnr: formData.personalnr,
          email: formData.email,
          erstellt_von: formData.erstellt_von,
          additionalEmails: formData.additionalEmails,
          personalnrHistory: formData.personalnrHistory,
          forcePersonalnr: true
        };

        const response = await api.patch(
          `/api/personal/mitarbeiter/${this.resolvedMa._id}`,
          updatePayload
        );

        if (response.data?.success) {
          Object.assign(this.resolvedMa, response.data.data);
          this.dataCache.updateOneMitarbeiter(response.data.data);
          this.closeEditModal();
        } else {
          throw new Error(response.data?.message || "Fehler beim Speichern");
        }
      } catch (error) {
        console.error("❌ Fehler beim Force-Speichern:", error);
        alert(`Fehler beim Speichern: ${error.response?.data?.message || error.message}`);
      } finally {
        this.savingEdit = false;
      }
    },

    // --- Delete Dialog Methods ---
    openDeleteModal() {
      this.showDeleteModal = true;
    },
    
    closeDeleteModal() {
      this.showDeleteModal = false;
    },
    
    async confirmDelete(options) {
      this.deletingMitarbeiter = true;
      try {
        await api.delete("/api/personal/mitarbeiter", {
          data: {
            ids: [this.resolvedMa._id],
            deleteFlip: options.deleteFlip,
            completeAsana: options.completeAsana
          }
        });
        
        this.dataCache.removeCachedMitarbeiter(this.resolvedMa._id);
        this.$emit("deleted", this.resolvedMa._id); 
        this.closeDeleteModal();
      } catch (error) {
        console.error("❌ Fehler beim Löschen:", error);
        alert(`Fehler beim Löschen: ${error.response?.data?.message || error.message}`);
      } finally {
         this.deletingMitarbeiter = false;
      }
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

/* ── User-verknüpfte Karte: 2 diagonale Streifen ── */
.card--has-user::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    -45deg,
    transparent 5%,
    rgba(238, 175, 103, 0.18) 5%,
    rgba(238, 175, 103, 0.18) 20%,
    transparent 20%,
    transparent 30%,
    rgba(0, 0, 0, 0.07) 30%,
    rgba(0, 0, 0, 0.07) 45%,
    transparent 45%
  );
  border-radius: 14px;
  z-index: 10;
  pointer-events: none;
}

.card--has-user[data-theme="dark"]::after {
  background: linear-gradient(
    -45deg,
    transparent 5%,
    rgba(238, 175, 103, 0.22) 5%,
    rgba(238, 175, 103, 0.22) 20%,
    transparent 20%,
    transparent 30%,
    rgba(255, 255, 255, 0.1) 30%,
    rgba(255, 255, 255, 0.1) 45%,
    transparent 45%
  );
}

/* Self-loading skeleton state */
.card-self-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 16px;
  color: var(--muted);
  font-size: 14px;
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
  align-items: flex-start;
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
  position: relative;
  z-index: 11;
}
.avatar-img {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  flex: 0 0 auto;
  position: relative;
  z-index: 11;
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
  background: var(--soft);
  color: var(--muted);
}
.pill.warn {
  background: #fff3cd;
  color: #856404;
  font-weight: 600;
}
.pill--monitor {
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  font-weight: 500;
}
.pill-monitor-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) saturate(100%) invert(72%) sepia(46%) saturate(500%) hue-rotate(340deg) brightness(101%) contrast(92%);
}

/* ---------- Actions ---------- */
.card-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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

/* KV inline row: two fields side by side */
.kv-inline {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
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

    .doc-subtitle {
      font-size: 12px;
      color: var(--text);
      opacity: 0.75;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-style: italic;
    }

    .doc-date {
      font-size: 11px;
      color: var(--muted);
    }
  }
}

.doc-empty-inline {
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
  padding: 6px 0 4px;
}

.doc-loading {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 0 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.feedback-inline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.feedback-inline-item {
  background: var(--bg-card, rgba(0,0,0,0.04));
  border: 1px solid var(--border-color, rgba(0,0,0,0.08));
  border-radius: 6px;
  padding: 8px 10px;
}

.feedback-inline-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.feedback-inline-event {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feedback-inline-date {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.btn-report-small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--primary, #e07b00);
  color: var(--primary, #e07b00);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--primary, #e07b00);
    color: #fff;
  }
}

.feedback-inline-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
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

/* Skills Section */
.skills-section {
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
  }

  .skill-group {
    margin-bottom: 20px;
  }

  .skill-group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 10px 0;

    .skill-icon-sm {
      width: 14px;
    }
  }

  .skill-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .skill-item {
    display: inline-flex;
    align-items: center;
    background: var(--soft);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    gap: 8px;
    font-size: 13px;
    transition: all 0.2s ease;

    &:hover {
      background: var(--surface);
      border-color: var(--primary);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
  }
  
  .skill-clickable {
    cursor: pointer;
    
    &:hover {
      background: color-mix(in srgb, var(--primary) 15%, var(--surface));
      border-color: var(--primary);
      
      .skill-name {
        color: var(--primary);
      }
    }
    
    &:active {
      transform: translateY(0);
    }
  }

  .skill-name {
    color: var(--text);
    font-weight: 500;
  }

  .skill-badge {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
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
  min-width: 0;
}

/* ── Flip No Connection (Restore / Create / Link) ──────────────── */
.flip-no-connection {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flip-action-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;

  .close-msg {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: inherit;
    opacity: 0.7;
    &:hover { opacity: 1; }
  }

  &.error {
    background: rgba(239, 68, 68, 0.08);
    color: #dc2626;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  &.success {
    background: rgba(16, 185, 129, 0.08);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
}

.flip-action-section {
  .hint-text {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.5;

    code {
      font-size: 11px;
      background: var(--soft);
      padding: 1px 5px;
      border-radius: 4px;
      word-break: break-all;
    }
  }
}

.flip-action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.flip-confirm-box {
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  color: var(--text);

  p { margin: 0 0 6px; }

  .flip-confirm-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
}

/* ── Flip Create Form ─────────────────────────────────────────────── */
.flip-create-form {
  .fc-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .fc-name { font-size: 13px; color: var(--text); }
  .fc-email { color: var(--muted); font-size: 12px; }

  .fc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .fc-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    min-width: 80px;
    flex-shrink: 0;
  }
  .fc-required { color: #e07b00; }

  .fc-select, .fc-input {
    flex: 1;
    padding: 6px 10px;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg, var(--surface));
    color: var(--text);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: var(--primary); }
  }

  .fc-value-muted {
    font-size: 13px;
    color: var(--muted);
    font-style: italic;
  }

  .fc-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 12px;
    padding: 10px 12px;
    background: var(--hover);
    border-radius: 8px;
    border: 1px solid var(--border);
  }
  .fc-check-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
    input[type="checkbox"] { cursor: pointer; accent-color: var(--primary); }
  }
}

.flip-link-section {
  background: var(--soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;

  .section-subtitle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 12px;
  }
}

.flip-link-search {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 13px;
  margin-bottom: 8px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.flip-link-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  margin-bottom: 10px;
}

.flip-link-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &:hover { background: rgba(var(--primary-rgb), 0.06); }
  &.selected {
    background: rgba(var(--primary-rgb), 0.12);
    border-left: 3px solid var(--primary);
  }

  .flip-link-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }
  .flip-link-email {
    font-size: 11px;
    color: var(--muted);
  }
}

.flip-link-empty {
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

.flip-link-actions {
  display: flex;
  gap: 8px;
}

.flip-profile-section,
.flip-tasks-section {
  min-width: 0;

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

/* Expanded: 2-column grid – content left, hero+actions right */
.card[data-expanded="true"] {
  grid-column: 1 / -1;
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  display: grid;
  grid-template-columns: 1fr 340px;
  grid-template-rows: auto 1fr;
}

.card[data-expanded="true"] .card-header {
  grid-column: 1;
  grid-row: 1;
}

.card[data-expanded="true"] .card-body {
  grid-column: 1;
  grid-row: 2;
  display: block;
  min-width: 0;
}

/* ---------- Hero Photo Panel ---------- */
.hero-panel {
  grid-column: 2;
  grid-row: 1 / -1;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.hero-media {
  flex: none;
  width: 300px;
  height: 300px;
  overflow: hidden;
  background: var(--soft);
  position: relative;
  z-index: 11;
}

.hero-media--clickable {
  cursor: pointer;
}

.hero-upload-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 2.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.hero-media--clickable:hover .hero-upload-hint {
  opacity: 1;
}

.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.hero-media:hover .hero-img {
  transform: scale(1.03);
}

.hero-initials {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 96px;
  font-weight: 800;
  color: #fff;
  background: hsl(0, 0%, calc(15% + (var(--hue, 0) / 360 * 55%)));
  user-select: none;
}

/* Card actions as vertical strip on left of image */
.hero-panel .card-actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 6px;
  padding: 10px 6px;
  margin: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  order: 0;
  border-top: none;
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
  align-items: flex-start;
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
  .card[data-expanded="true"] {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .card[data-expanded="true"] .card-header {
    grid-row: 1;
    position: relative;
  }

  .hero-panel {
    position: absolute;
    top: 8px;
    right: 8px;
    grid-column: unset;
    grid-row: unset;
    overflow: visible;
    background: none;
    z-index: 2;
  }

  .hero-media {
    display: none;
  }

  .hero-panel .card-actions {
    flex-direction: row;
    flex-wrap: nowrap;
    border-right: none;
    border-bottom: none;
    padding: 0;
    gap: 2px;
    background: none;
  }

  .hero-panel .card-actions .icon-btn {
    width: 30px;
    height: 30px;
    font-size: 12px;
  }

  .card[data-expanded="true"] .card-body {
    grid-row: 2;
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
  max-height: 2000px;
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
  z-index: 12;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.2s ease;
  transform: translateY(-4px);
}

.card:hover .selection-overlay,
.selection-overlay:has(.selection-checkbox:checked) {
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

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  
  .section-title {
    margin-bottom: 0;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn-sm {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  
  &:hover {
    background: var(--bg-hover) !important;
  }
}

.text-danger {
  color: #dc3545;
  &:hover {
    background: rgba(220, 53, 69, 0.1) !important;
  }
}

.email-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.email-badge {
  background: var(--soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.text-xs { font-size: 0.75rem; }

/* Quick Actions Wrapper in header */
.quick-actions-wrapper {
  position: relative;
}

/* Quick Actions Overlay + Menu (teleported to body, so not scoped) */
</style>

<style lang="scss">
/* Global styles for teleported quick actions menu */
.qa-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
}

.qa-menu {
  min-width: 200px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  z-index: 100000;
  padding: 6px 0;
  
  .qa-group {
    &:not(:last-child) {
      border-bottom: 1px solid var(--border, #e5e7eb);
      margin-bottom: 6px;
      padding-bottom: 6px;
    }
  }
  
  .qa-group-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted, #9ca3af);
    padding: 4px 12px 6px;
  }
  
  .qa-item {
    width: 100%;
    border: none;
    background: transparent;
    padding: 8px 12px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text, #1f2937);
    transition: all 0.15s ease;
    
    &:hover {
      background: var(--soft, #f3f4f6);
      color: var(--primary, #3b82f6);
    }
    
    .fa-phone { color: #22c55e; }
    .fa-envelope { color: #f59e0b; }
    .fa-edit { color: #8b5cf6; }
    .fa-user { color: var(--primary, #3b82f6); }
  }
  
  .qa-item--danger {
    &:hover {
      background: rgba(220, 53, 69, 0.08);
      color: #dc3545;
    }
  }
}

// ─── Inventar View ────────────────────────────────────────────────────────────
.inventar-view {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.inventar-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2rem;
  color: var(--muted);
  font-size: 0.95rem;
}

.inventar-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    .section-icon { font-size: 14px; color: var(--primary); }
  }
}

.holdings-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.holding-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--soft, var(--tile-bg));
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.9rem;
}

.holding-name { flex: 1; font-weight: 500; color: var(--text); }
.holding-size { color: var(--muted); font-size: 0.82rem; }
.holding-count {
  font-weight: 700;
  color: var(--primary);
  font-size: 0.88rem;
  background: color-mix(in oklab, var(--primary) 12%, transparent);
  padding: 2px 7px;
  border-radius: 5px;
}

.inventar-log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inventar-log-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 0.88rem;
}

.inventar-log-header {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  background: var(--soft, var(--tile-bg));
  border-bottom: 1px solid var(--border);
  font-size: 0.83rem;
  color: var(--muted);
}

.inventar-log-art {
  font-weight: 600;
  text-transform: capitalize;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.78rem;
  &.art--zugabe  { background: rgba(34,197,94,.15); color: #16a34a; }
  &.art--entnahme { background: rgba(239,68,68,.15); color: #dc2626; }
  &.art--änderung { background: rgba(234,179,8,.15);  color: #ca8a04; }
}

.inventar-log-date { margin-left: auto; }

.inventar-log-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
}

.inventar-log-item {
  padding: 2px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.82rem;
  color: var(--text);
}

.inventar-log-annotation {
  margin: 0;
  padding: 6px 12px;
  background: color-mix(in oklab, var(--primary) 8%, var(--surface));
  border-top: 1px solid var(--border);
  font-size: 0.82rem;
  color: var(--muted);
  font-style: italic;
}
</style>
