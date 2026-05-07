<template>
  <div class="leads-tab" :class="{ 'sidebar-open': !!selectedLead }">
    <!-- Main Content -->
    <div class="main-content">
      <!-- Toolbar -->
      <div class="leads-toolbar">
        <div class="toolbar-left">
          <SearchBar v-model="searchQuery" class="leads-search-bar" placeholder="Leads durchsuchen…" aria-label="Leads suchen" />
          <button class="btn btn-primary" @click="openCreateModal">
            <font-awesome-icon :icon="['fas', 'plus']" /> Lead
          </button>
        </div>

        <div class="toolbar-right">
          <span class="count-tag">{{ filteredLeads.length }} Leads</span>

          <select v-model="statusFilter" class="filter-select">
            <option value="">Alle Status</option>
            <option value="open">Offen</option>
            <option value="won">Gewonnen</option>
            <option value="lost">Verloren</option>
            <option value="archived">Archiviert</option>
          </select>

          <button class="btn-icon-toolbar" @click="showFieldManager = true" title="Spalten / Eigene Felder verwalten">
            <font-awesome-icon :icon="['fas', 'sliders']" />
          </button>
        </div>
      </div>

      <!-- Table -->
      <div v-if="loading" class="loading-state">
        <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lädt Leads…
      </div>

      <div v-else-if="filteredLeads.length === 0" class="empty-list">
        <font-awesome-icon :icon="['fas', 'bullseye']" style="font-size: 32px; opacity: 0.3" />
        <p>Keine Leads vorhanden.</p>
        <button class="btn btn-primary" @click="openCreateModal">
          <font-awesome-icon :icon="['fas', 'plus']" /> Ersten Lead anlegen
        </button>
      </div>

      <div v-else class="leads-table-wrap">
        <table class="leads-table">
          <thead>
            <tr>
              <th class="col-check"></th>
              <th class="col-title sortable" @click="toggleSort('title')">
                Titel
                <font-awesome-icon
                  v-if="sortBy === 'title'"
                  :icon="['fas', sortDir === 'asc' ? 'arrow-up' : 'arrow-down']"
                  class="sort-icon"
                />
              </th>
              <th class="col-stufe">Stufe</th>
              <th class="col-value sortable" @click="toggleSort('wert')">
                Wert
                <font-awesome-icon
                  v-if="sortBy === 'wert'"
                  :icon="['fas', sortDir === 'asc' ? 'arrow-up' : 'arrow-down']"
                  class="sort-icon"
                />
              </th>
              <th class="col-source">Quelle</th>
              <th class="col-owner">Besitzer</th>
              <th class="col-created sortable" @click="toggleSort('createdAt')">
                Lead erstellt
                <font-awesome-icon
                  v-if="sortBy === 'createdAt'"
                  :icon="['fas', sortDir === 'asc' ? 'arrow-up' : 'arrow-down']"
                  class="sort-icon"
                />
              </th>

              <!-- Dynamic custom-field columns -->
              <th v-for="lbl in visibleLabels" :key="lbl._id" class="col-custom">
                {{ lbl.name }}
              </th>

              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="lead in filteredLeads" :key="lead._id">
            <tr
              :class="{ active: selectedLead && selectedLead._id === lead._id }"
              @click="openLead(lead)"
            >
              <td class="col-check" @click.stop>
                <input type="checkbox" />
              </td>
              <td class="col-title">
                <strong>{{ lead.title }}</strong>
              </td>
              <td class="col-stufe">
                <span class="stufe-chip" :class="`stufe-${lead.stufe}`">
                  {{ stufeLabel(lead.stufe) }}
                </span>
              </td>
              <td class="col-value">
                <span v-if="lead.wert != null">{{ formatCurrency(lead.wert, lead.waehrung) }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="col-source">
                <span v-if="lead.quelle">{{ quelleLabel(lead.quelle) }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="col-owner">
                <font-awesome-icon :icon="['fas', 'user']" class="owner-icon" />
                {{ lead.eigentuemer?.name || lead.eigentuemer?.email || '—' }}
              </td>
              <td class="col-created">
                {{ formatDateTime(lead.createdAt) }}
              </td>

              <!-- Dynamic custom-field cells -->
              <td v-for="lbl in visibleLabels" :key="lbl._id" class="col-custom">
                <span v-html="renderCustomValue(lead, lbl)" />
              </td>

              <td class="col-actions" @click.stop>
                <button class="btn-icon-row" @click="openLead(lead)" title="Details">
                  <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
                </button>
              </td>
            </tr>
            <!-- Inline Chronik row -->
            <tr
              v-if="chronikExpandedLeadId === lead._id"
              class="chronik-inline-row"
              @click.stop
            >
              <td :colspan="8 + visibleLabels.length" class="chronik-inline-cell">
                <div class="chronik-inline-panel">
                  <div class="chronik-inline-header">
                    <font-awesome-icon :icon="['fas', 'clock-rotate-left']" />
                    <strong>Chronik</strong>
                    <span class="count-pill">{{ chronikEntries.length }}</span>
                  </div>

                  <div class="chronik-inline-body">
                    <div ref="chronikFeedEl" class="chronik-inline-feed">
                      <div v-if="loadingChronik" class="chronik-empty">
                        <font-awesome-icon :icon="['fas', 'spinner']" spin />
                      </div>
                      <div v-else-if="chronikEntries.length === 0" class="chronik-empty">
                        Noch keine Einträge.
                      </div>
                      <div v-else class="chronik-timeline">
                        <div
                          v-for="entry in chronikEntries"
                          :key="entry._id"
                          class="chronik-entry"
                          :class="{ 'chronik-entry--system': entry.isSystem }"
                        >
                          <div class="chronik-dot">
                            <font-awesome-icon
                              v-if="entry.isSystem"
                              :icon="['fas', 'circle-dot']"
                              class="dot-icon dot-icon--system"
                            />
                            <span v-else class="dot-avatar">{{ initials(entry.author) }}</span>
                          </div>
                          <div class="chronik-content">
                            <div class="chronik-meta">
                              <span v-if="!entry.isSystem" class="chronik-author">{{ entry.author }}</span>
                              <span class="chronik-time">{{ formatDateTime(entry.createdAt) }}</span>
                            </div>
                            <div class="chronik-text-wrap">
                              <p class="chronik-text">{{ entry.text }}</p>
                              <button
                                v-if="!entry.isSystem && canDeleteChronik(entry)"
                                class="btn-link danger chronik-delete"
                                @click="deleteChronikEntry(entry._id)"
                                title="Löschen"
                              >
                                <font-awesome-icon :icon="['fas', 'trash']" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="chronik-inline-compose">
                      <textarea
                        v-model="newChronikText"
                        placeholder="Kommentar hinzufügen…"
                        class="note-textarea"
                        rows="2"
                        @keydown.ctrl.enter.prevent="addChronikEntry"
                      ></textarea>
                      <button
                        class="btn btn-primary"
                        :disabled="!newChronikText.trim() || addingChronik"
                        @click="addChronikEntry"
                      >
                        <font-awesome-icon :icon="['fas', addingChronik ? 'spinner' : 'paper-plane']" :spin="addingChronik" />
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Right Sidebar -->
    <transition name="sidebar-slide">
      <aside v-if="selectedLead" class="detail-sidebar">
        <header class="sidebar-header">
          <div class="sidebar-title-area">
            <h3>{{ selectedLead.title }}</h3>
            <div class="sidebar-status">
              <span class="stufe-chip" :class="`stufe-${selectedLead.stufe}`">
                {{ stufeLabel(selectedLead.stufe) }}
              </span>
              <span class="status-pill" :class="`status-${selectedLead.status}`">
                {{ statusLabel(selectedLead.status) }}
              </span>
            </div>
          </div>
          <button class="close-btn" @click="closeSidebar">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </header>

        <div class="sidebar-body">
          <!-- Quick Actions -->
          <div class="quick-actions">
            <button
              class="btn-action"
              :class="{ won: selectedLead.status === 'won' }"
              @click="updateStatus('won')"
              :disabled="savingDetail"
            >
              <font-awesome-icon :icon="['fas', 'trophy']" /> Gewonnen
            </button>
            <button
              class="btn-action"
              :class="{ lost: selectedLead.status === 'lost' }"
              @click="updateStatus('lost')"
              :disabled="savingDetail"
            >
              <font-awesome-icon :icon="['fas', 'xmark']" /> Verloren
            </button>
            <button class="btn-action danger" @click="archiveLead" :disabled="savingDetail">
              <font-awesome-icon :icon="['fas', 'box-archive']" />
            </button>
          </div>

          <!-- Standard Fields -->
          <section class="info-section">
            <h4 class="section-title">
              <font-awesome-icon :icon="['fas', 'info-circle']" /> Lead-Daten
            </h4>
            <div class="kv-grid">
              <div class="kv-item">
                <label>Titel</label>
                <input v-model="detailForm.title" class="form-input" @blur="saveDetail" />
              </div>
              <div class="kv-item">
                <label>Wert ({{ detailForm.waehrung || 'EUR' }})</label>
                <input
                  v-model.number="detailForm.wert"
                  type="number"
                  min="0"
                  step="100"
                  class="form-input"
                  @blur="saveDetail"
                />
              </div>
              <div class="kv-item">
                <label>Quelle</label>
                <select v-model="detailForm.quelle" class="form-input" @change="saveDetail">
                  <option :value="null">—</option>
                  <option value="web">Web</option>
                  <option value="messe">Messe</option>
                  <option value="empfehlung">Empfehlung</option>
                  <option value="kaltakquise">Kaltakquise</option>
                  <option value="social_media">Social Media</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div class="kv-item">
                <label>Erw. Abschluss</label>
                <input
                  v-model="detailForm.erwartetesAbschlussDatum"
                  type="date"
                  class="form-input"
                  @blur="saveDetail"
                />
              </div>
            </div>
            <!-- Stufe stepper (full-width, below the grid) -->
            <div class="stufe-stepper">
              <button
                v-for="s in stufeSteps"
                :key="s.value"
                class="stufe-step"
                :class="[`stufe-step--${s.value}`, { active: detailForm.stufe === s.value, done: isStufeBeforeActive(s.value) }]"
                @click="detailForm.stufe = s.value; saveDetail()"
                :title="s.label"
              >
                <span class="step-dot"></span>
                <span class="step-label">{{ s.label }}</span>
              </button>
            </div>
          </section>

          <!-- Contact Info -->
          <section class="info-section">
            <h4 class="section-title">
              <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakt
            </h4>
            <!-- Microsoft Contact badges (one per linked contact) -->
            <div
              v-for="c in leadContacts"
              :key="c.id"
              class="ms-contact-badge ms-contact-badge--clickable"
              @click="openContactCard(c)"
            >
              <div class="ms-logo-grid" aria-hidden="true">
                <span style="background:#f25022"></span>
                <span style="background:#7fba00"></span>
                <span style="background:#00a4ef"></span>
                <span style="background:#ffb900"></span>
              </div>
              <div class="badge-info">
                <span class="badge-name">{{ c.displayName }}</span>
                <span class="badge-email">{{ c.email }}</span>
              </div>
              <div class="badge-actions" @click.stop>
                <button class="btn-link" @click="openContactCard(c)" title="Kontakt öffnen">
                  <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                </button>
                <button class="btn-link danger" @click="unlinkMsContact(c.id)" title="Verknüpfung lösen">
                  <font-awesome-icon :icon="['fas', 'link-slash']" />
                </button>
              </div>
            </div>
            <!-- Add contact button / inline search -->
            <div v-if="!addingContact" class="add-contact-row">
              <button class="btn-add-contact" @click="startAddContact">
                <font-awesome-icon :icon="['fas', 'plus']" /> Kontakt verknüpfen
              </button>
            </div>
            <div v-else class="inline-contact-search">
              <div class="search-input-wrap">
                <input
                  ref="sidebarSearchInput"
                  v-model="sidebarContactQuery"
                  class="form-input"
                  placeholder="Name oder E-Mail suchen…"
                  @input="debouncedSidebarSearch"
                  @keydown.esc="cancelAddContact"
                />
                <button class="search-cancel" @click="cancelAddContact" title="Abbrechen">
                  <font-awesome-icon :icon="['fas', 'xmark']" />
                </button>
              </div>
              <div v-if="sidebarContactResults.length > 0" class="contact-results-list">
                <button
                  v-for="c in sidebarContactResults"
                  :key="c.id"
                  class="contact-result-item"
                  @click="linkMsContact(c)"
                >
                  <div class="result-name">{{ c.displayName }}</div>
                  <div class="result-sub">{{ primaryEmailOf(c) || c.companyName || c._team }}</div>
                </button>
              </div>
              <div v-else-if="sidebarContactQuery.trim().length > 0 && !msContactsLoading" class="no-results">
                Kein Kontakt gefunden.
              </div>
              <div v-else-if="msContactsLoading" class="no-results">
                Kontakte werden geladen…
              </div>
            </div>
            <!-- Manual fields (only when no contacts linked) -->
            <div v-if="leadContacts.length === 0" class="kv-grid">
              <div class="kv-item">
                <label>Firma</label>
                <input v-model="detailForm.kontakt.firma" class="form-input" @blur="saveDetail" />
              </div>
              <div class="kv-item">
                <label>Vorname</label>
                <input v-model="detailForm.kontakt.vorname" class="form-input" @blur="saveDetail" />
              </div>
              <div class="kv-item">
                <label>Nachname</label>
                <input v-model="detailForm.kontakt.nachname" class="form-input" @blur="saveDetail" />
              </div>
              <div class="kv-item">
                <label>E-Mail</label>
                <input v-model="detailForm.kontakt.email" type="email" class="form-input" @blur="saveDetail" />
              </div>
              <div class="kv-item">
                <label>Telefon</label>
                <input v-model="detailForm.kontakt.telefon" class="form-input" @blur="saveDetail" />
              </div>
            </div>
          </section>

          <!-- Custom Fields -->
          <section v-if="visibleLabels.length > 0" class="info-section">
            <h4 class="section-title">
              <font-awesome-icon :icon="['fas', 'sliders']" /> Eigene Felder
              <button class="btn-link" @click="showFieldManager = true">verwalten</button>
            </h4>
            <div class="kv-grid">
              <div v-for="lbl in visibleLabels" :key="lbl._id" class="kv-item">
                <label>{{ lbl.name }} <span v-if="lbl.required" class="req">*</span></label>

                <input
                  v-if="lbl.fieldType === 'text' || lbl.fieldType === 'phone' || lbl.fieldType === 'email' || lbl.fieldType === 'url'"
                  v-model="detailForm.customFields[lbl.key]"
                  :type="lbl.fieldType === 'text' ? 'text' : lbl.fieldType"
                  class="form-input"
                  @blur="saveDetail"
                />

                <input
                  v-else-if="lbl.fieldType === 'number' || lbl.fieldType === 'currency'"
                  v-model.number="detailForm.customFields[lbl.key]"
                  type="number"
                  step="any"
                  class="form-input"
                  @blur="saveDetail"
                />

                <input
                  v-else-if="lbl.fieldType === 'date'"
                  v-model="detailForm.customFields[lbl.key]"
                  type="date"
                  class="form-input"
                  @blur="saveDetail"
                />

                <label v-else-if="lbl.fieldType === 'checkbox'" class="checkbox-row">
                  <input
                    type="checkbox"
                    :checked="!!detailForm.customFields[lbl.key]"
                    @change="setCustomCheckbox(lbl.key, $event.target.checked)"
                  />
                  Aktiv
                </label>

                <select
                  v-else-if="lbl.fieldType === 'dropdown'"
                  v-model="detailForm.customFields[lbl.key]"
                  class="form-input"
                  @change="saveDetail"
                >
                  <option :value="undefined">—</option>
                  <option v-for="opt in lbl.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>

                <div v-else-if="lbl.fieldType === 'multiselect'" class="multiselect-row">
                  <label v-for="opt in lbl.options" :key="opt.value" class="checkbox-row">
                    <input
                      type="checkbox"
                      :checked="isMultiSelected(lbl.key, opt.value)"
                      @change="toggleMulti(lbl.key, opt.value)"
                    />
                    {{ opt.label }}
                  </label>
                </div>
              </div>
            </div>
          </section>

        </div>
      </aside>
    </transition>

    <!-- Create Modal -->
    <teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal-content" @click.stop>
          <header class="modal-header">
            <h3>Neuen Lead anlegen</h3>
            <button class="btn-icon" @click="showCreateModal = false">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>
          <div class="modal-body">

            <!-- Lead basics -->
            <div class="kv-grid" style="margin-bottom: 16px;">
              <div class="kv-item">
                <label>Titel <span class="req">*</span></label>
                <input v-model="createForm.title" class="form-input" placeholder="z.B. EventRent – Q3 2026" />
              </div>
              <div class="kv-item">
                <label>Wert (EUR)</label>
                <input v-model.number="createForm.wert" type="number" min="0" class="form-input" />
              </div>
              <div class="kv-item">
                <label>Quelle</label>
                <select v-model="createForm.quelle" class="form-input">
                  <option :value="null">—</option>
                  <option value="web">Web</option>
                  <option value="messe">Messe</option>
                  <option value="empfehlung">Empfehlung</option>
                  <option value="kaltakquise">Kaltakquise</option>
                  <option value="social_media">Social Media</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
            </div>

            <!-- Microsoft Contact Picker -->
            <div class="contact-picker-section">
              <div class="contact-picker-header">
                <font-awesome-icon :icon="['fab', 'microsoft']" class="ms-icon" />
                <span>Microsoft Kontakt</span>
                <div class="mode-tabs">
                  <button
                    class="mode-tab"
                    :class="{ active: contactPickerMode === 'search' }"
                    @click="contactPickerMode = 'search'"
                  >Suchen</button>
                  <button
                    class="mode-tab"
                    :class="{ active: contactPickerMode === 'new' }"
                    @click="contactPickerMode = 'new'; linkedContact = null"
                  >Neu anlegen</button>
                  <button
                    class="mode-tab"
                    :class="{ active: contactPickerMode === 'skip' }"
                    @click="contactPickerMode = 'skip'; linkedContact = null"
                  >Überspringen</button>
                </div>
              </div>

              <!-- Mode: Suchen -->
              <div v-if="contactPickerMode === 'search'" class="contact-search-area">
                <!-- Linked contact chip -->
                <div v-if="linkedContact" class="linked-contact-chip">
                  <font-awesome-icon :icon="['fas', 'circle-check']" class="chip-icon" />
                  <div class="chip-info">
                    <strong>{{ linkedContact.displayName }}</strong>
                    <span>{{ primaryEmailOf(linkedContact) || linkedContact.companyName || '' }}</span>
                  </div>
                  <button class="chip-remove" @click="linkedContact = null; createForm.kontakt = blankKontakt()">
                    <font-awesome-icon :icon="['fas', 'xmark']" />
                  </button>
                </div>

                <template v-else>
                  <div class="search-input-wrap">
                    <input
                      v-model="contactSearchQuery"
                      class="form-input"
                      placeholder="Name oder E-Mail suchen…"
                      @input="debouncedContactSearch"
                    />
                    <font-awesome-icon v-if="msContactsLoading" :icon="['fas', 'spinner']" spin class="search-spin" />
                  </div>
                  <div v-if="contactSearchResults.length > 0" class="contact-results-list">
                    <button
                      v-for="c in contactSearchResults"
                      :key="c.id"
                      class="contact-result-item"
                      @click="selectContact(c)"
                    >
                      <div class="result-name">{{ c.displayName }}</div>
                      <div class="result-sub">{{ primaryEmailOf(c) || c.companyName || c._team }}</div>
                    </button>
                  </div>
                  <div v-else-if="contactSearchQuery.trim().length > 0 && !msContactsLoading" class="no-results">
                    Kein Kontakt gefunden.
                  </div>
                  <div v-else-if="msContactsLoading" class="no-results">
                    Kontakte werden geladen…
                  </div>
                </template>
              </div>

              <!-- Mode: Neu anlegen -->
              <div v-if="contactPickerMode === 'new'" class="new-contact-area">
                <div class="kv-grid">
                  <div class="kv-item">
                    <label>Mailbox (Team) <span class="req">*</span></label>
                    <select v-model="newContactTeam" class="form-input">
                      <option value="berlin">Berlin</option>
                      <option value="hamburg">Hamburg</option>
                      <option value="koeln">Köln</option>
                      <option value="rs">RS</option>
                    </select>
                  </div>
                  <div class="kv-item">
                    <label>Vorname</label>
                    <input v-model="createForm.kontakt.vorname" class="form-input" />
                  </div>
                  <div class="kv-item">
                    <label>Nachname</label>
                    <input v-model="createForm.kontakt.nachname" class="form-input" />
                  </div>
                  <div class="kv-item">
                    <label>Firma</label>
                    <input v-model="createForm.kontakt.firma" class="form-input" />
                  </div>
                  <div class="kv-item">
                    <label>E-Mail</label>
                    <input v-model="createForm.kontakt.email" type="email" class="form-input" />
                  </div>
                  <div class="kv-item">
                    <label>Telefon</label>
                    <input v-model="createForm.kontakt.telefon" class="form-input" />
                  </div>
                </div>
                <p class="picker-hint">
                  <font-awesome-icon :icon="['fas', 'circle-info']" />
                  Der Kontakt wird in der Microsoft-Mailbox des gewählten Teams angelegt.
                </p>
              </div>

              <!-- Mode: Überspringen -->
              <div v-if="contactPickerMode === 'skip'" class="kv-grid">
                <div class="kv-item">
                  <label>Firma</label>
                  <input v-model="createForm.kontakt.firma" class="form-input" />
                </div>
                <div class="kv-item">
                  <label>Kontakt-Name</label>
                  <input v-model="createForm.kontakt.nachname" class="form-input" />
                </div>
                <div class="kv-item">
                  <label>E-Mail</label>
                  <input v-model="createForm.kontakt.email" type="email" class="form-input" />
                </div>
              </div>
            </div>
          </div>
          <footer class="modal-footer">
            <button class="btn btn-secondary" @click="showCreateModal = false">Abbrechen</button>
            <button class="btn btn-primary" :disabled="!createForm.title.trim() || creating" @click="createLead">
              <font-awesome-icon v-if="creating" :icon="['fas', 'spinner']" spin />
              {{ contactPickerMode === 'new' ? 'Anlegen & Kontakt erstellen' : 'Anlegen' }}
            </button>
          </footer>
        </div>
      </div>
    </teleport>

    <!-- Contact Card Modal -->
    <teleport to="body">
      <div v-if="selectedMsContact" class="modal-overlay" @click.self="selectedMsContact = null">
        <ContactCard
          :contact="selectedMsContact"
          @close="selectedMsContact = null"
          @deleted="onContactDeleted"
          @updated="onContactUpdated"
        />
      </div>
    </teleport>

    <!-- Field Manager Modal (Custom Fields / LeadLabels) -->
    <teleport to="body">
      <div v-if="showFieldManager" class="modal-overlay" @click="showFieldManager = false">
        <div class="modal-content modal-large" @click.stop>
          <header class="modal-header">
            <h3>
              <font-awesome-icon :icon="['fas', 'sliders']" /> Eigene Felder verwalten
            </h3>
            <button class="btn-icon" @click="showFieldManager = false">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>
          <div class="modal-body">
            <p class="muted-text">
              Definiere eigene Felder, die als zusätzliche Spalten in der Lead-Tabelle angezeigt
              werden und beim Lead-Detail editierbar sind.
            </p>

            <table class="fields-manager-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Typ</th>
                  <th>Optionen</th>
                  <th>Pflicht</th>
                  <th>Aktiv</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="lbl in labels" :key="lbl._id">
                  <td>{{ lbl.name }}</td>
                  <td>{{ fieldTypeLabel(lbl.fieldType) }}</td>
                  <td class="opts-cell">
                    <span v-if="['dropdown','multiselect'].includes(lbl.fieldType)">
                      {{ (lbl.options || []).map(o => o.label).join(', ') || '—' }}
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <input type="checkbox" :checked="lbl.required" @change="toggleLabelField(lbl, 'required', $event.target.checked)" />
                  </td>
                  <td>
                    <input type="checkbox" :checked="lbl.isActive" @change="toggleLabelField(lbl, 'isActive', $event.target.checked)" />
                  </td>
                  <td>
                    <button class="btn-icon" @click="deleteLabel(lbl)" title="Deaktivieren">
                      <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <hr class="divider" />

            <h4>Neues Feld</h4>
            <div class="new-field-row">
              <input v-model="newField.name" class="form-input" placeholder="Feldname (z.B. Quellenherkunft)" />
              <select v-model="newField.fieldType" class="form-input">
                <option value="text">Text</option>
                <option value="number">Zahl</option>
                <option value="currency">Währung</option>
                <option value="date">Datum</option>
                <option value="checkbox">Checkbox</option>
                <option value="dropdown">Dropdown</option>
                <option value="multiselect">Mehrfachauswahl</option>
                <option value="phone">Telefon</option>
                <option value="email">E-Mail</option>
                <option value="url">URL</option>
              </select>
              <button class="btn btn-primary" :disabled="!newField.name.trim() || creatingField" @click="createField">
                <font-awesome-icon :icon="['fas', creatingField ? 'spinner' : 'plus']" :spin="creatingField" />
                Hinzufügen
              </button>
            </div>

            <div v-if="['dropdown','multiselect'].includes(newField.fieldType)" class="new-options-block">
              <label class="muted-text">Optionen (eine pro Zeile, Format: <code>Anzeigename</code>)</label>
              <textarea v-model="newField.optionsText" class="form-input" rows="4" placeholder="HOT&#10;WARM&#10;COLD"></textarea>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, reactive, nextTick } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faPlus, faXmark, faSpinner, faSliders, faUser, faInfoCircle,
  faAddressBook, faNoteSticky, faPaperPlane, faTrash, faTrophy,
  faBoxArchive, faBullseye, faEllipsisVertical, faArrowUp, faArrowDown,
  faAddressCard, faArrowUpRightFromSquare, faLinkSlash,
} from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import ContactCard from './ContactCard.vue';
import SearchBar from './SearchBar.vue';

library.add(
  faPlus, faXmark, faSpinner, faSliders, faUser, faInfoCircle,
  faAddressBook, faNoteSticky, faPaperPlane, faTrash, faTrophy,
  faBoxArchive, faBullseye, faEllipsisVertical, faArrowUp, faArrowDown,
  faAddressCard, faArrowUpRightFromSquare, faLinkSlash
);

const auth = useAuth();

// ─── State ───────────────────────────────────────────────────────────
const loading = ref(false);
const leads = ref([]);
const labels = ref([]);
const selectedLead = ref(null);
const detailForm = reactive({
  title: '',
  wert: null,
  waehrung: 'EUR',
  stufe: 'neu',
  quelle: null,
  erwartetesAbschlussDatum: '',
  kontakt: { vorname: '', nachname: '', email: '', telefon: '', firma: '' },
  customFields: {},
});
const savingDetail = ref(false);

const searchQuery = ref('');
const statusFilter = ref('open');
const sortBy = ref('createdAt');
const sortDir = ref('desc');

const showCreateModal = ref(false);
const showFieldManager = ref(false);
const creating = ref(false);
const creatingField = ref(false);

// Contact picker state (create modal)
const contactPickerMode = ref('search'); // 'search' | 'new' | 'skip'
const contactSearchQuery = ref('');
const contactSearchResults = ref([]);
const contactSearchLoading = ref(false);
const linkedContact = ref(null);
const newContactTeam = ref('berlin');

// Prefetched MS contacts (loaded on mount, filtered client-side)
const allMsContacts = ref([]);
const msContactsLoading = ref(false);

// Sidebar inline contact search
const addingContact = ref(false);
const sidebarContactQuery = ref('');
const sidebarContactResults = ref([]);
const sidebarSearchInput = ref(null);

const createForm = reactive({
  title: '',
  wert: null,
  quelle: null,
  kontakt: { vorname: '', nachname: '', email: '', telefon: '', firma: '' },
});

const newField = reactive({
  name: '',
  fieldType: 'text',
  optionsText: '',
});

const newNote = ref('');
const addingNote = ref(false);

// ─── Chronik ─────────────────────────────────────────────────────────
const chronikEntries = ref([]);
const loadingChronik = ref(false);
const newChronikText = ref('');
const addingChronik = ref(false);
const chronikExpandedLeadId = ref(null);
const chronikLead = ref(null);
const chronikFeedEl = ref(null);

watch(chronikEntries, () => {
  requestAnimationFrame(() => {
    const el = Array.isArray(chronikFeedEl.value) ? chronikFeedEl.value[0] : chronikFeedEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}, { flush: 'post' });

async function loadChronik(leadId) {
  loadingChronik.value = true;
  try {
    const { data } = await api.get('/api/comments', {
      params: { scope: 'lead_chronik', resourceId: leadId },
    });
    chronikEntries.value = data;
  } catch (e) {
    console.error('Chronik laden fehlgeschlagen', e);
  } finally {
    loadingChronik.value = false;
  }
}

async function addChronikEntry() {
  if (!chronikLead.value || !newChronikText.value.trim()) return;
  addingChronik.value = true;
  try {
    const { data } = await api.post('/api/comments', {
      scope: 'lead_chronik',
      text: newChronikText.value.trim(),
      context: {
        resourceId: chronikLead.value._id,
        resourceType: 'Lead',
      },
    });
    chronikEntries.value.push(data);
    newChronikText.value = '';
  } catch (e) {
    console.error('Chronik-Eintrag fehlgeschlagen', e);
  } finally {
    addingChronik.value = false;
  }
}

async function deleteChronikEntry(id) {
  try {
    await api.delete(`/api/comments/${id}`);
    chronikEntries.value = chronikEntries.value.filter((e) => e._id !== id);
  } catch (e) {
    console.error('Chronik-Eintrag löschen fehlgeschlagen', e);
  }
}

function canDeleteChronik(entry) {
  const uid = auth.user?._id || auth.user?.id;
  return uid && String(entry.authorId) === String(uid);
}

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Stufe stepper ───────────────────────────────────────────────────
const stufeSteps = [
  { value: 'neu',          label: 'Neu' },
  { value: 'qualifiziert', label: 'Qualif.' },
  { value: 'angebot',      label: 'Angebot' },
  { value: 'verhandlung',  label: 'Verhdl.' },
  { value: 'gewonnen',     label: 'Gewon.' },
  { value: 'verloren',     label: 'Verloren' },
];

const stufeOrder = stufeSteps.map((s) => s.value);

function isStufeBeforeActive(val) {
  const active = detailForm.stufe;
  if (active === 'verloren') return false; // don't color anything "done" for lost
  const ai = stufeOrder.indexOf(active);
  const vi = stufeOrder.indexOf(val);
  return vi < ai;
}

// ─── Computed ────────────────────────────────────────────────────────
const visibleLabels = computed(() => labels.value.filter((l) => l.isActive));

// All MS contacts for the currently selected lead (array, handles legacy single-contact field)
const leadContacts = computed(() => {
  const lead = selectedLead.value;
  if (!lead) return [];
  if (Array.isArray(lead.msContacts) && lead.msContacts.length > 0) return lead.msContacts;
  if (lead.msContact?.id) return [lead.msContact]; // legacy
  return [];
});

// Helper for table rows (same logic without reactive dependency)
function getLeadContacts(lead) {
  if (Array.isArray(lead.msContacts) && lead.msContacts.length > 0) return lead.msContacts;
  if (lead.msContact?.id) return [lead.msContact];
  return [];
}

const filteredLeads = computed(() => {
  let list = leads.value.slice();

  if (statusFilter.value) {
    list = list.filter((l) => l.status === statusFilter.value);
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((l) => {
      return (
        (l.title || '').toLowerCase().includes(q) ||
        (l.kontakt?.firma || '').toLowerCase().includes(q) ||
        (l.kontakt?.nachname || '').toLowerCase().includes(q) ||
        (l.kontakt?.email || '').toLowerCase().includes(q)
      );
    });
  }

  const dir = sortDir.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    const av = a[sortBy.value];
    const bv = b[sortBy.value];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  return list;
});

// ─── Loading ─────────────────────────────────────────────────────────
async function loadAll() {
  loading.value = true;
  // Contacts prefetch runs in parallel, non-blocking
  prefetchContacts();
  try {
    const [leadsRes, labelsRes] = await Promise.all([
      api.get('/api/leads'),
      api.get('/api/leads/labels'),
    ]);
    leads.value = leadsRes.data;
    labels.value = labelsRes.data;
  } catch (e) {
    console.error('Failed to load leads', e);
  } finally {
    loading.value = false;
  }
}

async function prefetchContacts() {
  msContactsLoading.value = true;
  try {
    const { data } = await api.get('/api/graph/contacts');
    allMsContacts.value = Array.isArray(data?.contacts) ? data.contacts : [];
  } catch (e) {
    console.error('Failed to prefetch MS contacts', e);
  } finally {
    msContactsLoading.value = false;
  }
}

onMounted(loadAll);

// ─── Sidebar / Detail ────────────────────────────────────────────────
function openLead(lead) {
  selectedLead.value = lead;
  if (window.innerWidth <= 1100) document.body.style.overflow = 'hidden';
  detailForm.title = lead.title || '';
  detailForm.wert = lead.wert ?? null;
  detailForm.waehrung = lead.waehrung || 'EUR';
  detailForm.stufe = lead.stufe || 'neu';
  detailForm.quelle = lead.quelle || null;
  detailForm.erwartetesAbschlussDatum = lead.erwartetesAbschlussDatum
    ? lead.erwartetesAbschlussDatum.substring(0, 10)
    : '';
  detailForm.kontakt = {
    vorname:  lead.kontakt?.vorname  || '',
    nachname: lead.kontakt?.nachname || '',
    email:    lead.kontakt?.email    || '',
    telefon:  lead.kontakt?.telefon  || '',
    firma:    lead.kontakt?.firma    || '',
  };
  detailForm.customFields = { ...(lead.customFields || {}) };
  chronikExpandedLeadId.value = lead._id;
  chronikLead.value = lead;
  chronikEntries.value = [];
  loadChronik(lead._id);
}

function closeSidebar() {
  selectedLead.value = null;
  chronikExpandedLeadId.value = null;
  chronikLead.value = null;
  chronikEntries.value = [];
  document.body.style.overflow = '';
}

onUnmounted(() => {
  document.body.style.overflow = '';
});

async function saveDetail() {
  if (!selectedLead.value) return;
  savingDetail.value = true;
  try {
    const payload = {
      title: detailForm.title,
      wert: detailForm.wert,
      stufe: detailForm.stufe,
      quelle: detailForm.quelle,
      erwartetesAbschlussDatum: detailForm.erwartetesAbschlussDatum || null,
      kontakt: detailForm.kontakt,
      customFields: detailForm.customFields,
    };
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}`, payload);
    upsertLead(data);
    selectedLead.value = data;
  } catch (e) {
    console.error('Failed to save lead', e);
  } finally {
    savingDetail.value = false;
  }
}

async function updateStatus(status) {
  if (!selectedLead.value) return;
  savingDetail.value = true;
  try {
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}`, { status });
    upsertLead(data);
    selectedLead.value = data;
    detailForm.stufe = data.stufe;
  } finally {
    savingDetail.value = false;
  }
}

async function archiveLead() {
  if (!selectedLead.value) return;
  if (!confirm(`Lead "${selectedLead.value.title}" archivieren?`)) return;
  savingDetail.value = true;
  try {
    await api.delete(`/api/leads/${selectedLead.value._id}`);
    leads.value = leads.value.filter((l) => l._id !== selectedLead.value._id);
    closeSidebar();
  } finally {
    savingDetail.value = false;
  }
}

async function addNote() {
  if (!selectedLead.value || !newNote.value.trim()) return;
  addingNote.value = true;
  try {
    const { data } = await api.post(`/api/leads/${selectedLead.value._id}/notizen`, {
      text: newNote.value.trim(),
    });
    if (!selectedLead.value.notizen) selectedLead.value.notizen = [];
    selectedLead.value.notizen.push(data);
    newNote.value = '';
  } finally {
    addingNote.value = false;
  }
}

function upsertLead(lead) {
  const idx = leads.value.findIndex((l) => l._id === lead._id);
  if (idx >= 0) leads.value.splice(idx, 1, lead);
  else leads.value.unshift(lead);
}

// ─── Custom Field helpers ────────────────────────────────────────────
function setCustomCheckbox(key, val) {
  detailForm.customFields[key] = val;
  saveDetail();
}

function isMultiSelected(key, value) {
  const arr = detailForm.customFields[key];
  return Array.isArray(arr) && arr.includes(value);
}

function toggleMulti(key, value) {
  const arr = Array.isArray(detailForm.customFields[key])
    ? detailForm.customFields[key].slice()
    : [];
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
  detailForm.customFields[key] = arr;
  saveDetail();
}

function renderCustomValue(lead, lbl) {
  const v = lead.customFields?.[lbl.key];
  if (v === undefined || v === null || v === '') return '<span class="muted">—</span>';

  if (lbl.fieldType === 'checkbox') {
    return v
      ? '<span class="cell-pill ok">Ja</span>'
      : '<span class="cell-pill">Nein</span>';
  }

  if (lbl.fieldType === 'currency') {
    const n = Number(v);
    if (!isNaN(n)) return `${n.toLocaleString('de-DE')} €`;
  }

  if (lbl.fieldType === 'date') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('de-DE');
  }

  if (lbl.fieldType === 'dropdown') {
    const opt = (lbl.options || []).find((o) => o.value === v);
    const label = opt?.label || v;
    const color = opt?.color;
    return color
      ? `<span class="cell-pill" style="background:${escapeHtml(color)};color:#fff">${escapeHtml(label)}</span>`
      : `<span class="cell-pill">${escapeHtml(label)}</span>`;
  }

  if (lbl.fieldType === 'multiselect' && Array.isArray(v)) {
    return v
      .map((val) => {
        const opt = (lbl.options || []).find((o) => o.value === val);
        const label = opt?.label || val;
        const color = opt?.color;
        return color
          ? `<span class="cell-pill" style="background:${escapeHtml(color)};color:#fff">${escapeHtml(label)}</span>`
          : `<span class="cell-pill">${escapeHtml(label)}</span>`;
      })
      .join(' ');
  }

  return escapeHtml(String(v));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Create Lead ─────────────────────────────────────────────────────
function openCreateModal() {
  Object.assign(createForm, {
    title: '',
    wert: null,
    quelle: null,
    kontakt: blankKontakt(),
  });
  contactPickerMode.value = 'search';
  contactSearchQuery.value = '';
  contactSearchResults.value = [];
  linkedContact.value = null;
  newContactTeam.value = 'berlin';
  showCreateModal.value = true;
}

async function createLead() {
  if (!createForm.title.trim()) return;
  creating.value = true;
  try {
    let msContact = null;

    if (contactPickerMode.value === 'search' && linkedContact.value) {
      // User selected an existing MS contact
      msContact = {
        id:          linkedContact.value.id,
        upn:         linkedContact.value._upn,
        displayName: linkedContact.value.displayName,
        email:       primaryEmailOf(linkedContact.value),
      };
    } else if (contactPickerMode.value === 'new') {
      // Create new MS contact first
      try {
        const { data } = await api.post('/api/graph/contacts', {
          team:      newContactTeam.value,
          givenName: createForm.kontakt.vorname,
          surname:   createForm.kontakt.nachname,
          companyName: createForm.kontakt.firma || undefined,
          email:     createForm.kontakt.email   || undefined,
          mobilePhone: createForm.kontakt.telefon || undefined,
        });
        if (data.ok) {
          const c = data.contact;
          msContact = {
            id:          c.id,
            upn:         c._upn,
            displayName: c.displayName,
            email:       primaryEmailOf(c),
          };
        }
      } catch (err) {
        console.error('MS contact creation failed', err);
        // Not fatal — proceed without msContact
      }
    }

    const { data } = await api.post('/api/leads', {
      title:   createForm.title.trim(),
      wert:    createForm.wert,
      quelle:  createForm.quelle,
      kontakt: createForm.kontakt,
      msContact,
    });
    leads.value.unshift(data);
    showCreateModal.value = false;
    openLead(data);
  } catch (e) {
    console.error('Failed to create lead', e);
    alert('Lead konnte nicht angelegt werden.');
  } finally {
    creating.value = false;
  }
}

// ─── Contact Picker helpers ──────────────────────────────────────────
function blankKontakt() {
  return { vorname: '', nachname: '', email: '', telefon: '', firma: '' };
}

function primaryEmailOf(contact) {
  if (!contact) return '';
  if (Array.isArray(contact.emailAddresses) && contact.emailAddresses.length > 0) {
    return contact.emailAddresses[0].address || '';
  }
  return '';
}

function debouncedContactSearch() {
  // Client-side filter against prefetched contacts — instant, no API call
  const q = contactSearchQuery.value.trim().toLowerCase();
  if (q.length < 1) {
    contactSearchResults.value = [];
    return;
  }
  contactSearchResults.value = allMsContacts.value.filter((c) => {
    return (
      (c.displayName  || '').toLowerCase().includes(q) ||
      (c.givenName    || '').toLowerCase().includes(q) ||
      (c.surname      || '').toLowerCase().includes(q) ||
      (c.companyName  || '').toLowerCase().includes(q) ||
      primaryEmailOf(c).toLowerCase().includes(q)
    );
  }).slice(0, 25);
}

function selectContact(c) {
  linkedContact.value = c;
  // Pre-fill kontakt fields from MS contact
  const email = primaryEmailOf(c);
  const nameParts = (c.displayName || '').split(' ');
  createForm.kontakt.vorname  = c.givenName || (nameParts.length > 1 ? nameParts[0] : '');
  createForm.kontakt.nachname = c.surname   || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : c.displayName || '');
  createForm.kontakt.email    = email;
  createForm.kontakt.firma    = c.companyName || '';
  createForm.kontakt.telefon  = c.mobilePhone || (c.businessPhones?.[0] ?? '');
  contactSearchResults.value  = [];
}

// ─── ContactCard ─────────────────────────────────────────────────────
const selectedMsContact = ref(null);

function openContactCard(msContact) {
  if (!msContact?.id) return;
  selectedMsContact.value = { ...msContact };
}

function onContactDeleted(contactId) {
  leads.value.forEach((lead) => {
    if (Array.isArray(lead.msContacts)) {
      lead.msContacts = lead.msContacts.filter((c) => c.id !== contactId);
    }
    if (lead.msContact?.id === contactId) {
      lead.msContact = { id: null, upn: null, displayName: null, email: null };
    }
  });
  if (selectedLead.value) {
    if (Array.isArray(selectedLead.value.msContacts)) {
      selectedLead.value.msContacts = selectedLead.value.msContacts.filter((c) => c.id !== contactId);
    }
    if (selectedLead.value.msContact?.id === contactId) {
      selectedLead.value.msContact = { id: null, upn: null, displayName: null, email: null };
    }
  }
  selectedMsContact.value = null;
}

function onContactUpdated(updatedContact) {
  const newDisplay = updatedContact.displayName || '';
  const newEmail = updatedContact.emailAddresses?.[0]?.address || updatedContact.email || '';
  leads.value.forEach((lead) => {
    const arr = Array.isArray(lead.msContacts) ? lead.msContacts : [];
    arr.forEach((c) => {
      if (c.id === updatedContact.id) { c.displayName = newDisplay; c.email = newEmail; }
    });
    if (lead.msContact?.id === updatedContact.id) {
      lead.msContact.displayName = newDisplay;
      lead.msContact.email = newEmail;
    }
  });
  if (selectedLead.value) {
    const arr = Array.isArray(selectedLead.value.msContacts) ? selectedLead.value.msContacts : [];
    arr.forEach((c) => {
      if (c.id === updatedContact.id) { c.displayName = newDisplay; c.email = newEmail; }
    });
    if (selectedLead.value.msContact?.id === updatedContact.id) {
      selectedLead.value.msContact.displayName = newDisplay;
      selectedLead.value.msContact.email = newEmail;
    }
  }
  selectedMsContact.value = updatedContact;
}

async function unlinkMsContact(contactId) {
  if (!selectedLead.value) return;
  if (!confirm('Microsoft Kontakt-Verknüpfung aufheben?')) return;
  const currentContacts = leadContacts.value;
  const updated = currentContacts.filter((c) => c.id !== contactId);
  savingDetail.value = true;
  try {
    const patch = { msContacts: updated };
    // If migrating from legacy single-contact field, clear it too
    if (selectedLead.value.msContact?.id === contactId) {
      patch.msContact = { id: null, upn: null, displayName: null, email: null };
    }
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}`, patch);
    upsertLead(data);
    selectedLead.value = data;
  } finally {
    savingDetail.value = false;
  }
}

// ─── Sidebar contact search ──────────────────────────────────────────
function startAddContact() {
  addingContact.value = true;
  sidebarContactQuery.value = '';
  sidebarContactResults.value = [];
  nextTick(() => sidebarSearchInput.value?.focus());
}

function cancelAddContact() {
  addingContact.value = false;
  sidebarContactQuery.value = '';
  sidebarContactResults.value = [];
}

function debouncedSidebarSearch() {
  const q = sidebarContactQuery.value.trim().toLowerCase();
  if (q.length < 1) { sidebarContactResults.value = []; return; }
  const existingIds = new Set(leadContacts.value.map((c) => c.id));
  sidebarContactResults.value = allMsContacts.value
    .filter((c) => !existingIds.has(c.id))
    .filter((c) =>
      (c.displayName  || '').toLowerCase().includes(q) ||
      (c.givenName    || '').toLowerCase().includes(q) ||
      (c.surname      || '').toLowerCase().includes(q) ||
      (c.companyName  || '').toLowerCase().includes(q) ||
      primaryEmailOf(c).toLowerCase().includes(q)
    ).slice(0, 25);
}

async function linkMsContact(c) {
  if (!selectedLead.value) return;
  const newEntry = {
    id: c.id,
    upn: c._upn || c.upn || '',
    displayName: c.displayName || '',
    email: primaryEmailOf(c) || '',
  };
  const updated = [...leadContacts.value, newEntry];
  savingDetail.value = true;
  try {
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}`, { msContacts: updated });
    upsertLead(data);
    selectedLead.value = data;
  } finally {
    savingDetail.value = false;
    cancelAddContact();
  }
}

// ─── Field Manager ───────────────────────────────────────────────────
async function createField() {
  if (!newField.name.trim()) return;
  creatingField.value = true;
  try {
    let options = [];
    if (['dropdown', 'multiselect'].includes(newField.fieldType)) {
      options = newField.optionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label) => ({
          label,
          value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        }));
    }

    const { data } = await api.post('/api/leads/labels', {
      name: newField.name.trim(),
      fieldType: newField.fieldType,
      options,
    });
    labels.value.push(data);
    newField.name = '';
    newField.optionsText = '';
  } catch (e) {
    console.error('Failed to create field', e);
    alert('Feld konnte nicht angelegt werden.');
  } finally {
    creatingField.value = false;
  }
}

async function toggleLabelField(lbl, field, value) {
  try {
    const { data } = await api.patch(`/api/leads/labels/${lbl._id}`, { [field]: value });
    const idx = labels.value.findIndex((l) => l._id === lbl._id);
    if (idx >= 0) labels.value.splice(idx, 1, data);
  } catch (e) {
    console.error('Failed to update field', e);
  }
}

async function deleteLabel(lbl) {
  if (!confirm(`Feld "${lbl.name}" deaktivieren?`)) return;
  try {
    await api.delete(`/api/leads/labels/${lbl._id}`);
    const idx = labels.value.findIndex((l) => l._id === lbl._id);
    if (idx >= 0) labels.value[idx].isActive = false;
  } catch (e) {
    console.error('Failed to delete field', e);
  }
}

// ─── Sorting ─────────────────────────────────────────────────────────
function toggleSort(field) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortDir.value = 'desc';
  }
}

// ─── Formatters ──────────────────────────────────────────────────────
function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(n, currency = 'EUR') {
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency });
}

function stufeLabel(s) {
  return ({
    neu: 'Neu',
    qualifiziert: 'Qualifiziert',
    angebot: 'Angebot',
    verhandlung: 'Verhandlung',
    gewonnen: 'Gewonnen',
    verloren: 'Verloren',
  })[s] || s;
}

function statusLabel(s) {
  return ({
    open: 'Offen',
    won: 'Gewonnen',
    lost: 'Verloren',
    archived: 'Archiviert',
  })[s] || s;
}

function quelleLabel(q) {
  return ({
    web: 'Web',
    messe: 'Messe',
    empfehlung: 'Empfehlung',
    kaltakquise: 'Kaltakquise',
    social_media: 'Social Media',
    sonstiges: 'Sonstiges',
  })[q] || q;
}

function fieldTypeLabel(t) {
  return ({
    text: 'Text',
    number: 'Zahl',
    currency: 'Währung',
    date: 'Datum',
    checkbox: 'Checkbox',
    dropdown: 'Dropdown',
    multiselect: 'Mehrfachauswahl',
    phone: 'Telefon',
    email: 'E-Mail',
    url: 'URL',
  })[t] || t;
}

// Close sidebar with ESC
function handleEsc(e) {
  if (e.key === 'Escape') {
    if (showCreateModal.value) showCreateModal.value = false;
    else if (showFieldManager.value) showFieldManager.value = false;
    else if (selectedLead.value) closeSidebar();
  }
}
onMounted(() => document.addEventListener('keydown', handleEsc));
import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => document.removeEventListener('keydown', handleEsc));
</script>

<style scoped lang="scss">
.leads-tab {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-height: 600px;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: 24px 0 24px 24px;
}

/* ── Toolbar ─────────────────────────────────────────────────────── */
.leads-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 16px;
  flex-wrap: wrap;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-right {
    margin-left: auto;
  }
}

.search-input {
  width: 100%;
  max-width: 360px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.9rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.filter-select {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: var(--hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.btn-primary {
    background: transparent;
    color: var(--primary);
    border-color: var(--primary);

    &:hover:not(:disabled) {
      background: color-mix(in oklab, var(--primary) 12%, transparent);
    }
  }

  &.btn-secondary {
    background: transparent;
  }
}

.btn-icon-toolbar {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
}

.count-tag {
  font-size: 0.85rem;
  color: var(--muted);
  padding: 4px 10px;
  background: var(--hover);
  border-radius: 12px;
}

/* ── Table ───────────────────────────────────────────────────────── */
.leads-table-wrap {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: auto;
  max-width: 100%;
  container-type: inline-size;
}

.leads-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;

  thead {
    background: var(--panel);
    position: sticky;
    top: 0;
    z-index: 1;

    th {
      text-align: left;
      padding: 10px 12px;
      color: var(--muted);
      font-weight: 600;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;

      &.sortable {
        cursor: pointer;
        user-select: none;

        &:hover {
          color: var(--text);
        }
      }
    }
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.1s;

    &:hover {
      background: var(--hover);
    }

    &.active {
      background: color-mix(in oklab, var(--primary) 10%, transparent);
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
      color: var(--text);
      vertical-align: middle;

      .row-sub {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.75rem;
        color: var(--muted);
        margin-top: 2px;

        &--clickable {
          cursor: pointer;
          color: var(--primary);
          &:hover { text-decoration: underline; }
        }

        .row-sub-icon {
          font-size: 0.7rem;
          opacity: 0.75;
        }
      }
    }
  }

  .col-check {
    width: 36px;
    text-align: center;
  }

  .col-actions {
    width: 40px;
    text-align: right;
  }

  .col-title {
    min-width: 200px;
  }

  .sort-icon {
    font-size: 0.65rem;
    margin-left: 4px;
  }
}

.btn-icon-row {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;

  &:hover {
    background: var(--hover);
    color: var(--text);
  }

  &.chronik-toggle-active {
    color: var(--primary);
  }
}

.muted {
  color: var(--muted);
}

.owner-icon {
  color: var(--muted);
  margin-right: 4px;
}

/* Stufe chip */
.stufe-chip {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--text);

  &.stufe-neu          { background: #e0e7ff; color: #3730a3; }
  &.stufe-qualifiziert { background: #cffafe; color: #155e75; }
  &.stufe-angebot      { background: #fef3c7; color: #92400e; }
  &.stufe-verhandlung  { background: #fed7aa; color: #9a3412; }
  &.stufe-gewonnen     { background: #d1fae5; color: #065f46; }
  &.stufe-verloren     { background: #fee2e2; color: #991b1b; }
}

.status-pill {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--hover);
  color: var(--muted);
  margin-left: 6px;

  &.status-won  { background: #d1fae5; color: #065f46; }
  &.status-lost { background: #fee2e2; color: #991b1b; }
}

/* Cell pills (custom field rendering) */
:deep(.cell-pill) {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--hover);
  color: var(--text);
  margin-right: 3px;

  &.ok { background: #d1fae5; color: #065f46; }
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
.detail-sidebar {
  position: sticky;
  top: 88px;
  width: 440px;
  min-width: 440px;
  height: calc(100vh - 88px);
  overflow-y: auto;
  background: var(--tile-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  margin-left: 16px;

  @media (max-width: 1100px) {
    position: fixed;
    right: 0;
    left: 0;
    top: 88px;
    height: calc(100vh - 88px);
    z-index: 1000;
    width: 100vw;
    min-width: 320px;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
  }
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: width 0.3s cubic-bezier(0.25, 1, 0.5, 1),
              min-width 0.3s cubic-bezier(0.25, 1, 0.5, 1),
              opacity 0.2s ease,
              transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  overflow: hidden;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  width: 0 !important;
  min-width: 0 !important;
  opacity: 0;
  transform: translateX(100%);
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);

  .sidebar-title-area {
    flex: 1;
    min-width: 0;

    h3 {
      margin: 0 0 6px;
      font-size: 1.1rem;
      color: var(--text);
      word-break: break-word;
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px 8px;

    &:hover {
      color: var(--text);
    }
  }
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.quick-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;

  .btn-action {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    background: var(--tile-bg);
    color: var(--text);
    cursor: pointer;
    border-radius: 6px;
    font-size: 0.82rem;

    &:hover:not(:disabled) {
      background: var(--hover);
    }

    &.won {
      background: #10b981;
      color: #fff;
      border-color: #10b981;
    }

    &.lost {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }

    &.danger {
      flex: 0 0 auto;
      width: 36px;
      color: #ef4444;
    }
  }
}

.info-section {
  margin-bottom: 20px;

  .section-title {
    margin: 0 0 10px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    display: flex;
    align-items: center;
    gap: 6px;

    .count-pill {
      font-size: 0.7rem;
      background: var(--hover);
      padding: 2px 7px;
      border-radius: 10px;
      color: var(--text);
      margin-left: auto;
    }

    .btn-link {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--primary);
      cursor: pointer;
      font-size: 0.75rem;
      text-decoration: underline;
      padding: 0;
    }
  }
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  .kv-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    label {
      font-size: 0.72rem;
      color: var(--muted);
      font-weight: 500;
    }
  }
}

.form-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.85rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.req {
  color: #ef4444;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--text);
}

.multiselect-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Inline Chronik row ─────────────────────────────────────────── */
.chronik-inline-row {
  background: var(--surface);

  &:hover {
    background: var(--surface) !important;
  }
}

.chronik-inline-cell {
  padding: 0 !important;
  border-top: 2px solid var(--primary);
}

.chronik-inline-panel {
  padding: 16px 20px;
  overflow-x: hidden;
  max-width: 100cqi;
  box-sizing: border-box;
}

.chronik-inline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  strong {
    color: var(--text);
    font-size: 0.85rem;
    text-transform: none;
    letter-spacing: 0;
  }
}

.chronik-inline-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chronik-inline-feed {
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  direction: rtl;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.chronik-inline-compose {
  display: flex;
  gap: 8px;
  align-items: flex-end;

  .note-textarea {
    flex: 1;
    resize: vertical;
  }
}

/* ── Chronik ────────────────────────────────────────────────────── */
.chronik-input-row {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.note-textarea {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.85rem;
  font-family: inherit;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.chronik-empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
  padding: 16px 0;
  direction: ltr;
}

.chronik-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  direction: ltr;

  &::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background: var(--border);
  }
}

.chronik-entry {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  position: relative;
}

.chronik-dot {
  width: 22px;
  min-width: 22px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 3px;
  position: relative;
  z-index: 1;

  .dot-icon--system {
    font-size: 0.7rem;
    color: var(--muted);
    background: var(--tile-bg);
    padding: 2px 0;
  }

  .dot-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--primary);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
}

.chronik-content {
  flex: 1;
  min-width: 0;
  margin-bottom: 2px;

  .chronik-entry--system & {
    padding: 2px 0;
  }
}

.chronik-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  flex-wrap: wrap;

  .chronik-entry--system & {
    margin-bottom: 0;
  }
}

.chronik-author {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
}

.chronik-time {
  font-size: 0.72rem;
  color: var(--muted);
  margin-left: auto;
}

.chronik-text-wrap {
  position: relative;
  display: block;

  .chronik-delete {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.15s;
    font-size: 0.72rem;
    padding: 2px 4px;
    color: var(--muted);
    background: var(--panel);
    border-radius: 4px;
  }

  &:hover .chronik-delete {
    opacity: 1;

    &:hover { color: #ef4444; }
  }
}

.chronik-text {
  font-size: 0.83rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;

  .chronik-entry--system & {
    color: var(--muted);
    font-style: italic;
    font-size: 0.8rem;
  }

  .chronik-entry:not(.chronik-entry--system) & {
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    padding-right: 28px;
  }
}

/* ── Modals ──────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 10px;
  width: 90%;
  max-width: 540px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;

  &.modal-large {
    max-width: 820px;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.05rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.btn-icon {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;

  &:hover {
    color: var(--text);
  }
}

.modal-body {
  padding: 18px;
  overflow-y: auto;
}

.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Field manager */
.fields-manager-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin-top: 8px;

  th, td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  th {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .opts-cell {
    color: var(--muted);
    font-size: 0.78rem;
  }
}

.muted-text {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0 0 10px;
}

.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 16px 0;
}

.new-field-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .form-input {
    flex: 1;
  }

  select.form-input {
    flex: 0 0 180px;
  }
}

.new-options-block {
  margin-top: 10px;
}

/* States */
.loading-state,
.empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--muted);
  gap: 10px;
}

/* ── Contact Picker ─────────────────────────────────────────────── */
.contact-picker-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.contact-picker-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 600;

  .ms-icon { color: #0078d4; font-size: 1rem; }

  span { flex: 1; }

  .mode-tabs {
    display: flex;
    gap: 4px;
  }

  .mode-tab {
    padding: 3px 10px;
    font-size: 0.78rem;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;

    &.active {
      border-color: var(--primary);
      color: var(--primary);
      background: transparent;
    }

    &:hover:not(.active) {
      background: var(--hover);
    }
  }
}

.contact-search-area,
.new-contact-area {
  padding: 12px 14px;
}

.search-input-wrap {
  position: relative;

  .search-spin {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.8rem;
  }
}

.contact-results-list {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  max-height: 200px;
  overflow-y: auto;
}

.contact-result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 8px 12px;
  background: var(--card-bg);
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  &:hover { background: var(--hover); }
  &:not(:last-child) { border-bottom: 1px solid var(--border); }

  .result-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text);
  }
  .result-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
}

.no-results {
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
}

.linked-contact-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: color.adjust(#0078d4, $lightness: 40%, $saturation: -30%);
  border-radius: 6px;
  margin-bottom: 10px;

  .chip-icon { color: #0078d4; font-size: 1.1rem; flex-shrink: 0; }

  .chip-info {
    display: flex;
    flex-direction: column;
    flex: 1;

    strong { font-size: 0.875rem; color: var(--text); }
    span   { font-size: 0.78rem;  color: var(--text-muted); }
  }

  .chip-remove {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 2px 4px;
    &:hover { color: #ef4444; }
  }
}

.picker-hint {
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* MS contact badge in sidebar */
.ms-contact-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 12px;
  transition: border-color 0.15s, background 0.15s;

  &--clickable {
    cursor: pointer;
    &:hover {
      background: var(--soft);
      border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
    }
  }

  .ms-logo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    width: 20px;
    height: 20px;
    flex-shrink: 0;

    span {
      border-radius: 2px;
      display: block;
    }
  }

  .badge-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;

    .badge-name { font-size: 0.875rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge-email { font-size: 0.78rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }

  .badge-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-link {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.8rem;
    padding: 4px 6px;
    border-radius: 5px;
    transition: background 0.12s, color 0.12s;

    &:hover { background: var(--soft); color: var(--text); }
    &.danger { &:hover { color: #ef4444; } }
  }
}

/* Add-contact row below badges */
.add-contact-row {
  margin-top: 4px;
}

.btn-add-contact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 0.82rem;
  color: var(--muted);
  cursor: pointer;
  width: 100%;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 6%, transparent);
  }
}

/* Inline contact search inside sidebar */
.inline-contact-search {
  margin-top: 4px;

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;

    input { flex: 1; }
  }

  .search-cancel {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 8px;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.8rem;
    flex-shrink: 0;
    transition: color 0.12s;
    &:hover { color: var(--text); }
  }

  .contact-results-list {
    margin-top: 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface);
  }

  .contact-result-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s;

    &:last-child { border-bottom: none; }
    &:hover { background: var(--hover); }

    .result-name { font-size: 0.875rem; color: var(--text); }
    .result-sub  { font-size: 0.78rem; color: var(--muted); }
  }

  .no-results { font-size: 0.82rem; color: var(--muted); padding: 8px 0; }
}

/* Count badge in table row */
.contact-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  color: var(--primary);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  margin-left: 4px;
}

/* Stufe stepper */
.stufe-stepper {
  display: flex;
  align-items: flex-start;
  margin-top: 12px;
  position: relative;

  // connecting line behind dots
  &::before {
    content: '';
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    height: 2px;
    background: var(--border);
    z-index: 0;
  }
}

.stufe-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  position: relative;
  z-index: 1;

  .step-dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--surface);
    transition: background 0.18s, border-color 0.18s, transform 0.15s;
    display: block;
    flex-shrink: 0;
  }

  .step-label {
    font-size: 0.68rem;
    color: var(--muted);
    text-align: center;
    line-height: 1.2;
    transition: color 0.15s, font-weight 0.15s;
    white-space: nowrap;
  }

  &:hover .step-dot {
    transform: scale(1.15);
    border-color: #93c5fd;
  }

  // Done (before active) — blue
  &.done {
    .step-dot {
      background: #60a5fa;
      border-color: #60a5fa;
    }
    .step-label { color: #3b82f6; }
  }

  // neu active — light blue
  &--neu.active .step-dot   { background: #93c5fd; border-color: #3b82f6; transform: scale(1.2); }
  &--neu.active .step-label { color: #2563eb; font-weight: 600; }

  // qualifiziert — medium blue
  &--qualifiziert.active .step-dot   { background: #60a5fa; border-color: #2563eb; transform: scale(1.2); }
  &--qualifiziert.active .step-label { color: #1d4ed8; font-weight: 600; }

  // angebot — blue-yellow transition
  &--angebot.active .step-dot   { background: #fcd34d; border-color: #f59e0b; transform: scale(1.2); }
  &--angebot.active .step-label { color: #d97706; font-weight: 600; }

  // verhandlung — yellow/amber
  &--verhandlung.active .step-dot   { background: #fbbf24; border-color: #d97706; transform: scale(1.2); }
  &--verhandlung.active .step-label { color: #b45309; font-weight: 600; }

  // gewonnen — green
  &--gewonnen.active .step-dot   { background: #4ade80; border-color: #16a34a; transform: scale(1.2); }
  &--gewonnen.active .step-label { color: #15803d; font-weight: 600; }

  // verloren — red/gray
  &--verloren.active .step-dot   { background: #f87171; border-color: #dc2626; transform: scale(1.2); }
  &--verloren.active .step-label { color: #dc2626; font-weight: 600; }
}
</style>
