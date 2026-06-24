<template>
  <div class="leads-tab" :class="{ 'sidebar-open': !!selectedLead }">
    <!-- Main Content -->
    <div class="main-content">
      <!-- Toolbar -->
      <div class="leads-toolbar">
        <div class="toolbar-left">
          <SearchBar v-model="searchQuery" class="leads-search-bar" placeholder="Leads durchsuchen…" aria-label="Leads suchen" />
          <button v-if="!isMobile" class="btn btn-primary" @click="openCreateModal">
            <font-awesome-icon :icon="['fas', 'plus']" /> Lead
          </button>
        </div>

        <div class="toolbar-right">
          <template v-if="!isMobile">
            <button class="btn-icon-toolbar" @click="showFieldManager = true" title="Spalten / Eigene Felder verwalten">
              <font-awesome-icon :icon="['fas', 'sliders']" />
            </button>
            <button
              class="btn-icon-toolbar"
              :class="{ active: showColPanel || colConfig.some(c => !c.visible) }"
              @click="openColPanel($event)"
              title="Spalten anpassen"
            >
              <font-awesome-icon :icon="['fas', 'table-columns']" />
            </button>
          </template>
          <!-- Mobile overflow menu (kebab) -->
          <div v-else class="mobile-toolbar-overflow">
            <button
              class="btn-icon-toolbar"
              @click="mobileToolbarMenuOpen = !mobileToolbarMenuOpen"
              title="Weitere Aktionen"
            >
              <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
            </button>
            <div v-if="mobileToolbarMenuOpen" class="mobile-overflow-backdrop" @click="mobileToolbarMenuOpen = false"></div>
            <div v-if="mobileToolbarMenuOpen" class="mobile-overflow-menu" @click.stop>
              <button class="mobile-overflow-item" @click="mobileToolbarMenuOpen = false; showFieldManager = true">
                <font-awesome-icon :icon="['fas', 'sliders']" /> Eigene Felder
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile stage filter chips -->
      <div v-if="isMobile" class="mobile-stage-chips">
        <button
          class="mobile-stage-chip"
          :class="{ active: mobileStageFilter === 'all' }"
          @click="mobileStageFilter = 'all'"
        >
          Alle <span class="mobile-stage-count">{{ mobileStageCounts.all }}</span>
        </button>
        <button
          v-for="s in stufeSteps"
          :key="s.value"
          class="mobile-stage-chip"
          :class="[`mobile-stage-chip--${s.value}`, { active: mobileStageFilter === s.value }]"
          @click="mobileStageFilter = s.value"
        >
          {{ s.label }} <span class="mobile-stage-count">{{ mobileStageCounts[s.value] || 0 }}</span>
        </button>
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

      <!-- Mobile vertical list -->
      <div v-else-if="isMobile" class="mobile-lead-list">
        <div v-if="mobileVisibleLeads.length === 0" class="empty-list mobile-empty-stage">
          <p>Keine Leads in dieser Stufe.</p>
        </div>
        <template v-for="group in mobileGroupedLeads" :key="group.stufe">
          <div class="mobile-list-group-header" :class="`mobile-list-group-header--${group.stufe}`">
            <span class="mobile-list-group-dot" :class="`stufe-${group.stufe}`"></span>
            <span class="mobile-list-group-label">{{ group.label }}</span>
            <span class="mobile-list-group-count">{{ group.leads.length }}</span>
          </div>
          <LeadCard
            v-for="lead in group.leads"
            :key="lead._id"
            :lead="lead"
            :is-active="selectedLead?._id === lead._id"
            :custom-labels="visibleCustomLabels"
            :show-created="visibleStdCreated"
            :quelle-options="leadConfig.quelleOptions || []"
            :class="['mobile-lead-card', `mobile-lead-card--${group.stufe}`]"
            @open="openLead(lead)"
            @toggle-favorite="toggleFavorite(lead)"
            @row-menu="(e, l) => openRowMenu(e, l)"
          />
        </template>
      </div>

      <LeadBoard
        v-else
        :leads="filteredLeads"
        :active-lead-id="selectedLead?._id || null"
        :custom-labels="visibleCustomLabels"
        :show-created="visibleStdCreated"
        :quelle-options="leadConfig.quelleOptions || []"
        @open="openLead"
        @toggle-favorite="toggleFavorite"
        @row-menu="openRowMenu"
        @stage-change="onStageChange"
      />
    </div>

    <!-- Mobile FAB: new lead -->
    <button
      v-if="isMobile && !selectedLead"
      class="mobile-fab"
      title="Neuen Lead anlegen"
      @click="openCreateModal"
    >
      <font-awesome-icon :icon="['fas', 'plus']" />
    </button>

    <!-- Right Sidebar -->
    <transition name="sidebar-slide">
      <aside v-if="selectedLead" class="detail-sidebar" :class="{ 'detail-sidebar--mobile': isMobile }">
        <header class="sidebar-header">
          <button v-if="isMobile" class="mobile-back-btn" @click="closeSidebar" title="Zurück">
            <font-awesome-icon :icon="['fas', 'chevron-left']" />
          </button>
          <div class="sidebar-title-area">
            <h3>{{ selectedLead.title }}</h3>
            <div class="sidebar-status">
              <span class="stufe-chip" :class="`stufe-${selectedLead.stufe}`">
                {{ stufeLabel(selectedLead.stufe) }}
              </span>
              <span v-if="selectedLeadOwnerLabel" class="sidebar-owner">
                <font-awesome-icon :icon="['fas', 'user']" />
                {{ selectedLeadOwnerLabel }}
              </span>
            </div>
          </div>
          <template v-if="!isMobile">
            <button class="btn-archive" @click="archiveLead" :disabled="savingDetail" title="Archivieren">
              <font-awesome-icon :icon="['fas', 'box-archive']" />
            </button>
            <button class="close-btn" @click="closeSidebar">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </template>
          <div v-else class="mobile-sidebar-overflow">
            <button class="close-btn" @click="mobileSidebarMenuOpen = !mobileSidebarMenuOpen" title="Aktionen">
              <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
            </button>
            <div v-if="mobileSidebarMenuOpen" class="mobile-overflow-backdrop" @click="mobileSidebarMenuOpen = false"></div>
            <div v-if="mobileSidebarMenuOpen" class="mobile-overflow-menu mobile-overflow-menu--sidebar" @click.stop>
              <button class="mobile-overflow-item" :disabled="savingDetail" @click="mobileSidebarMenuOpen = false; archiveLead()">
                <font-awesome-icon :icon="['fas', 'box-archive']" /> Archivieren
              </button>
            </div>
          </div>
        </header>

        <div class="sidebar-body">
          <!-- Standard Fields -->
          <section class="info-section" :class="{ 'mobile-collapsed': isMobile && !mobileSectionsOpen.daten }">
            <h4 class="section-title" :class="{ 'section-title--mobile-clickable': isMobile }" @click="isMobile && toggleMobileSection('daten')">
              <font-awesome-icon :icon="['fas', 'info-circle']" /> Lead-Daten
              <font-awesome-icon v-if="isMobile" class="section-chevron" :icon="['fas', mobileSectionsOpen.daten ? 'chevron-up' : 'chevron-down']" />
            </h4>
            <div class="kv-grid">
              <div class="kv-item">
                <label>Organisation</label>
                <input v-model="detailForm.title" class="form-input" @blur="saveDetail" />
              </div>

              <div class="kv-item">
                <label>Standort <span class="req">*</span></label>
                <select v-model="detailForm.standort" class="form-input" @change="saveDetail">
                  <option value="Hamburg">Hamburg</option>
                  <option value="Berlin">Berlin</option>
                  <option value="Köln">Köln</option>
                </select>
              </div>

              <div class="kv-item">
                <label>Quelle</label>
                <select v-model="detailForm.quelle" class="form-input" @change="saveDetail">
                  <option :value="null">—</option>
                  <option v-for="opt in leadConfig.quelleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="kv-item">
                <label>Erw. Abschluss</label>
                <input
                  ref="expectedCloseDateInput"
                  v-model="detailForm.erwartetesAbschlussDatum"
                  type="date"
                  class="form-input"
                  @click="openExpectedCloseDatePicker"
                  @blur="saveDetail"
                />
              </div>

              <!-- Custom Fields inline (always all labels, regardless of table column visibility) -->
              <template v-for="lbl in labels" :key="lbl._id">
                <div class="kv-item">
                  <label>
                    {{ lbl.name }} <span v-if="lbl.required" class="req">*</span>
                    <a
                      v-if="lbl.fieldType === 'url' && detailForm.customFields[lbl.key]"
                      :href="detailForm.customFields[lbl.key]"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="url-open-btn"
                      title="Link öffnen"
                    >
                      <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                    </a>
                    <a
                      v-if="lbl.fieldType === 'address' && addressMapsUrl(detailForm.customFields[lbl.key])"
                      :href="addressMapsUrl(detailForm.customFields[lbl.key])"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="url-open-btn"
                      title="In Google Maps öffnen"
                    >
                      <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                    </a>
                  </label>

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

                  <div v-else-if="lbl.fieldType === 'address'" class="address-preview" @click="openAddressModal(lbl.key)">
                    <span v-if="detailForm.customFields[lbl.key]?.street || detailForm.customFields[lbl.key]?.city" class="address-preview-text">
                      {{ [detailForm.customFields[lbl.key]?.street, [detailForm.customFields[lbl.key]?.zip, detailForm.customFields[lbl.key]?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}
                    </span>
                    <span v-else class="address-placeholder">Adresse eingeben…</span>
                    <font-awesome-icon :icon="['fas', 'sliders']" class="address-edit-icon" />
                  </div>
                </div>
              </template>
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
          <section class="info-section" :class="{ 'mobile-collapsed': isMobile && !mobileSectionsOpen.kontakte }">
            <h4 class="section-title" :class="{ 'section-title--mobile-clickable': isMobile }" @click="isMobile && toggleMobileSection('kontakte')">
              <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakte
              <font-awesome-icon v-if="isMobile" class="section-chevron" :icon="['fas', mobileSectionsOpen.kontakte ? 'chevron-up' : 'chevron-down']" />
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
                <font-awesome-icon :icon="['fas', 'link']" /> Verknüpfen
              </button>
              <button
                class="btn-add-contact btn-add-contact--new"
                @click="openKontaktAnlegenModal('sidebar')"
              >
                <font-awesome-icon :icon="['fas', 'plus']" /> Neu anlegen
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

          <!-- ─── Aktivitäten ─────────────────────────────── -->
          <section class="info-section" :class="{ 'mobile-collapsed': isMobile && !mobileSectionsOpen.aktivitaeten }">
            <h4 class="section-title" :class="{ 'section-title--mobile-clickable': isMobile }" @click="isMobile && toggleMobileSection('aktivitaeten')">
              <font-awesome-icon :icon="['fas', 'calendar-check']" /> Aktivitäten
              <font-awesome-icon v-if="isMobile" class="section-chevron" :icon="['fas', mobileSectionsOpen.aktivitaeten ? 'chevron-up' : 'chevron-down']" />
            </h4>

            <!-- Add activity button (shown when form is closed) -->
            <div v-if="!showAktForm" class="add-contact-row">
              <button class="btn-add-contact" @click="openAktForm">
                <font-awesome-icon :icon="['fas', 'plus']" /> Aktivität planen
              </button>
            </div>

            <!-- Inline create form -->
            <div v-if="showAktForm" class="akt-form">
              <!-- Asana button — top-right corner -->
              <button
                class="btn-asana-corner"
                :class="{ active: asanaView.mode === 'create' }"
                @click="toggleAsanaView('create')"
                title="Als Asana-Task planen"
              >
                <svg class="asana-logo-icon" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <circle cx="120" cy="28" r="28"/>
                  <circle cx="52" cy="152" r="28"/>
                  <circle cx="188" cy="152" r="28"/>
                </svg>
              </button>

              <!-- Normal activity form -->
              <template v-if="asanaView.mode !== 'create'">
                <div class="akt-type-row">
                  <button
                    v-for="t in AKT_TYPES" :key="t.value"
                    class="akt-type-btn"
                    :class="{ active: aktForm.type === t.value }"
                    @click="aktForm.type = t.value"
                    :title="t.label"
                  >
                    <font-awesome-icon :icon="t.icon" />
                    <span>{{ t.label }}</span>
                  </button>
                </div>
                <input
                  v-model="aktForm.titel"
                  class="form-input"
                  placeholder="Titel / Betreff (optional)"
                />
                <div class="akt-datetime-row">
                  <label class="akt-date-label" @click.prevent="$event.currentTarget.querySelector('input[type=date]').showPicker()">
                    <font-awesome-icon :icon="['fas', 'calendar']" class="akt-date-icon" />
                    <span class="akt-date-text">{{ aktForm.date ? new Date(aktForm.date + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Datum wählen' }}</span>
                    <input v-model="aktForm.date" type="date" class="akt-date-hidden" />
                  </label>
                  <div class="akt-time-picker">
                    <input
                      v-model="aktForm.timeHour"
                      type="number" min="0" max="23"
                      class="form-input akt-time-hour"
                      placeholder="Std"
                    />
                    <div class="akt-min-btns">
                      <button v-for="m in ['00','15','30','45']" :key="m" type="button"
                        class="akt-min-btn" :class="{ active: aktForm.timeMin === m }"
                        @click="aktForm.timeMin = m"
                      >{{ m }}</button>
                    </div>
                    <template v-if="aktForm.timeHour !== ''">
                      <input
                        v-if="aktTimeManual"
                        type="time"
                        class="form-input akt-time-override"
                        :value="`${String(aktForm.timeHour).padStart(2,'0')}:${aktForm.timeMin}`"
                        @change="e => { applyManualTime(aktForm, e.target.value); aktTimeManual = false }"
                        @blur="aktTimeManual = false"
                      />
                      <span v-else class="akt-time-result" @click="aktTimeManual = true">
                        {{ String(aktForm.timeHour).padStart(2,'0') }}:{{ aktForm.timeMin }}
                      </span>
                    </template>
                  </div>
                </div>
                <select
                  v-if="leadContacts.length > 0"
                  v-model="aktForm.kontaktId"
                  class="form-input"
                >
                  <option value="">Kein Kontakt</option>
                  <option v-for="c in leadContacts" :key="c.id" :value="c.id">{{ c.displayName }}</option>
                </select>
                <div class="akt-form-actions">
                  <button class="btn btn-secondary" @click="showAktForm = false">Abbrechen</button>
                  <div class="btn-save-wrap">
                    <button class="btn btn-primary" :disabled="!aktForm.date || savingAkt" @click="saveAkt">
                      <font-awesome-icon v-if="savingAkt" :icon="['fas', 'spinner']" spin />
                      <svg v-else-if="asanaView.enabled" class="asana-logo-icon" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="120" cy="28" r="28"/><circle cx="52" cy="152" r="28"/><circle cx="188" cy="152" r="28"/></svg>
                      Erstellen
                    </button>
                    <button
                      class="btn-asana-badge"
                      :class="{ active: asanaView.enabled }"
                      :title="asanaView.enabled ? 'Asana Task wird erstellt' : 'Kein Asana Task'"
                      @click.stop="asanaView.enabled = !asanaView.enabled"
                    >
                      <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="120" cy="28" r="28"/><circle cx="52" cy="152" r="28"/><circle cx="188" cy="152" r="28"/></svg>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Asana task creation view -->
              <div v-else class="asana-task-view">
                <div class="asana-view-header">
                  <svg class="asana-logo-icon asana-logo-icon--lg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <circle cx="120" cy="28" r="28"/>
                    <circle cx="52" cy="152" r="28"/>
                    <circle cx="188" cy="152" r="28"/>
                  </svg>
                  <span>Asana Task erstellen</span>
                </div>
                <div class="asana-view-field">
                  <label class="asana-view-label">Titel</label>
                  <input v-model="asanaView.titel" class="form-input" placeholder="Task-Titel" />
                </div>
                <div class="asana-view-field">
                  <label class="asana-view-label">Fälligkeitsdatum</label>
                  <span class="asana-view-value">{{ asanaView.datum ? formatAktDate(asanaView.datum) : '—' }}</span>
                </div>
                <div class="asana-view-field">
                  <label class="asana-view-label">Verantwortlich</label>
                  <span class="asana-view-value">{{ selectedLead?.eigentuemer?.name || selectedLead?.eigentuemer?.email || '—' }}</span>
                </div>
                <div class="asana-view-field">
                  <label class="asana-view-label">Projekt</label>
                  <span class="asana-view-value">Sales {{ selectedLead?.standort }}</span>
                </div>
                <div class="asana-view-field">
                  <label class="asana-view-label">Beschreibung</label>
                  <textarea v-model="asanaView.notes" class="form-input asana-notes-area" rows="3" placeholder="Beschreibung" />
                </div>
                <div v-if="asanaView.result" class="asana-view-result">
                  <font-awesome-icon :icon="['fas', 'circle-check']" />
                  Task erstellt:
                  <a :href="asanaView.result.url" target="_blank" rel="noopener noreferrer">{{ asanaView.result.name }}</a>
                </div>
                <div v-if="asanaView.error" class="asana-view-error">
                  <font-awesome-icon :icon="['fas', 'circle-exclamation']" /> {{ asanaView.error }}
                </div>
                <div class="akt-form-actions">
                  <button class="btn btn-secondary" @click="toggleAsanaView(null)">Zurück</button>
                </div>
              </div>
            </div>

            <!-- Activity list -->
            <div v-if="leadAktivitaeten.length === 0 && !showAktForm" class="akt-empty">
              Keine geplanten Aktivitäten.
            </div>
            <div v-else class="akt-list">
              <template v-for="akt in leadAktivitaeten" :key="akt._id">
                <!-- Inline edit form -->
                <div v-if="editingAktId === akt._id" class="akt-form">
                  <!-- Asana button — top-right corner -->
                  <button
                    class="btn-asana-corner"
                    :class="{ active: asanaView.mode === 'edit' }"
                    @click="toggleAsanaView('edit')"
                    title="Als Asana-Task planen"
                  >
                    <svg class="asana-logo-icon" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <circle cx="120" cy="28" r="28"/>
                      <circle cx="52" cy="152" r="28"/>
                      <circle cx="188" cy="152" r="28"/>
                    </svg>
                  </button>

                  <!-- Normal edit form -->
                  <template v-if="asanaView.mode !== 'edit'">
                    <div class="akt-type-row">
                      <button
                        v-for="t in AKT_TYPES" :key="t.value"
                        class="akt-type-btn"
                        :class="{ active: editAktForm.type === t.value }"
                        @click="editAktForm.type = t.value"
                        :title="t.label"
                      >
                        <font-awesome-icon :icon="t.icon" />
                        <span>{{ t.label }}</span>
                      </button>
                    </div>
                    <input v-model="editAktForm.titel" class="form-input" placeholder="Titel / Betreff (optional)" />
                    <div class="akt-datetime-row">
                      <label class="akt-date-label" @click.prevent="$event.currentTarget.querySelector('input[type=date]').showPicker()">
                        <font-awesome-icon :icon="['fas', 'calendar']" class="akt-date-icon" />
                        <span class="akt-date-text">{{ editAktForm.date ? new Date(editAktForm.date + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Datum wählen' }}</span>
                        <input v-model="editAktForm.date" type="date" class="akt-date-hidden" />
                      </label>
                      <div class="akt-time-picker">
                        <input
                          v-model="editAktForm.timeHour"
                          type="number" min="0" max="23"
                          class="form-input akt-time-hour"
                          placeholder="Std"
                        />
                        <div class="akt-min-btns">
                          <button v-for="m in ['00','15','30','45']" :key="m" type="button"
                            class="akt-min-btn" :class="{ active: editAktForm.timeMin === m }"
                            @click="editAktForm.timeMin = m"
                          >{{ m }}</button>
                        </div>
                        <template v-if="editAktForm.timeHour !== ''">
                          <input
                            v-if="editAktTimeManual"
                            type="time"
                            class="form-input akt-time-override"
                            :value="`${String(editAktForm.timeHour).padStart(2,'0')}:${editAktForm.timeMin}`"
                            @change="e => { applyManualTime(editAktForm, e.target.value); editAktTimeManual = false }"
                            @blur="editAktTimeManual = false"
                          />
                          <span v-else class="akt-time-result" @click="editAktTimeManual = true">
                            {{ String(editAktForm.timeHour).padStart(2,'0') }}:{{ editAktForm.timeMin }}
                          </span>
                        </template>
                      </div>
                    </div>
                    <select v-if="leadContacts.length > 0" v-model="editAktForm.kontaktId" class="form-input">
                      <option value="">Kein Kontakt</option>
                      <option v-for="c in leadContacts" :key="c.id" :value="c.id">{{ c.displayName }}</option>
                    </select>
                    <div class="akt-form-actions">
                      <button class="btn btn-secondary" @click="editingAktId = null">Abbrechen</button>
                      <div class="btn-save-wrap">
                        <button class="btn btn-primary" :disabled="!editAktForm.date || savingAkt" @click="saveEditAkt(akt)">
                          <font-awesome-icon v-if="savingAkt" :icon="['fas', 'spinner']" spin />
                          <svg v-else-if="asanaView.enabled" class="asana-logo-icon" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="120" cy="28" r="28"/><circle cx="52" cy="152" r="28"/><circle cx="188" cy="152" r="28"/></svg>
                          Update
                        </button>
                        <button
                          class="btn-asana-badge"
                          :class="{ active: asanaView.enabled }"
                          :title="asanaView.enabled ? 'Asana Task wird erstellt' : 'Kein Asana Task'"
                          @click.stop="asanaView.enabled = !asanaView.enabled"
                        >
                          <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><circle cx="120" cy="28" r="28"/><circle cx="52" cy="152" r="28"/><circle cx="188" cy="152" r="28"/></svg>
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- Asana task creation view -->
                  <div v-else class="asana-task-view">
                    <div class="asana-view-header">
                      <svg class="asana-logo-icon asana-logo-icon--lg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <circle cx="120" cy="28" r="28"/>
                        <circle cx="52" cy="152" r="28"/>
                        <circle cx="188" cy="152" r="28"/>
                      </svg>
                      <span>Asana Task erstellen</span>
                    </div>
                    <div class="asana-view-field">
                      <label class="asana-view-label">Titel</label>
                      <input v-model="asanaView.titel" class="form-input" placeholder="Task-Titel" />
                    </div>
                    <div class="asana-view-field">
                      <label class="asana-view-label">Fälligkeitsdatum</label>
                      <span class="asana-view-value">{{ asanaView.datum ? formatAktDate(asanaView.datum) : '—' }}</span>
                    </div>
                    <div class="asana-view-field">
                      <label class="asana-view-label">Verantwortlich</label>
                      <span class="asana-view-value">{{ selectedLead?.eigentuemer?.name || selectedLead?.eigentuemer?.email || '—' }}</span>
                    </div>
                    <div class="asana-view-field">
                      <label class="asana-view-label">Projekt</label>
                      <span class="asana-view-value">Sales {{ selectedLead?.standort }}</span>
                    </div>
                    <div class="asana-view-field">
                      <label class="asana-view-label">Beschreibung</label>
                      <textarea v-model="asanaView.notes" class="form-input asana-notes-area" rows="3" placeholder="Beschreibung" />
                    </div>
                    <div v-if="asanaView.result" class="asana-view-result">
                      <font-awesome-icon :icon="['fas', 'circle-check']" />
                      Task erstellt:
                      <a :href="asanaView.result.url" target="_blank" rel="noopener noreferrer">{{ asanaView.result.name }}</a>
                    </div>
                    <div v-if="asanaView.error" class="asana-view-error">
                      <font-awesome-icon :icon="['fas', 'circle-exclamation']" /> {{ asanaView.error }}
                    </div>
                    <div class="akt-form-actions">
                      <button class="btn btn-secondary" @click="toggleAsanaView(null)">Zurück</button>
                    </div>
                  </div>
                </div>

                <!-- Normal view -->
                <div
                  v-else
                  class="akt-item"
                  :class="{ 'akt-item--done': akt.erledigt, 'akt-item--overdue': isOverdue(akt), 'akt-item--has-asana': !!akt.asanaTaskUrl }"
                >
                  <button
                    class="akt-check"
                    :class="{ done: akt.erledigt }"
                    @click="toggleAktErledigt(akt)"
                    :title="akt.erledigt ? 'Erledigt (Klick zum Rückgängig)' : 'Als erledigt markieren'"
                  >
                    <font-awesome-icon :icon="['fas', akt.erledigt ? 'circle-check' : 'circle']" />
                  </button>
                  <div class="akt-info">
                    <div class="akt-top-row">
                      <span class="akt-type-icon" :title="aktTypeLabel(akt.type)">
                        <font-awesome-icon :icon="aktTypeIcon(akt.type)" />
                      </span>
                      <span class="akt-titel">{{ akt.titel || aktTypeLabel(akt.type) }}</span>
                    </div>
                    <div class="akt-meta">
                      <span class="akt-date">{{ formatAktDate(akt.datum) }}</span>
                      <span v-if="akt.kontakt && akt.kontakt.displayName" class="akt-contact">
                        <font-awesome-icon :icon="['fas', 'user']" /> {{ akt.kontakt.displayName }}
                      </span>
                    </div>
                  </div>
                  <div class="akt-actions">
                    <a
                      v-if="akt.asanaTaskUrl"
                      :href="akt.asanaTaskUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="akt-asana-link"
                      title="In Asana öffnen"
                    >
                      <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <circle cx="120" cy="40"  r="40"/>
                        <circle cx="40"  cy="160" r="40"/>
                        <circle cx="200" cy="160" r="40"/>
                      </svg>
                    </a>
                    <button class="akt-edit" @click="openEditAkt(akt)" title="Bearbeiten">
                      <font-awesome-icon :icon="['fas', 'pen']" />
                    </button>
                    <button class="akt-delete" @click="deleteAkt(akt)" title="Löschen">
                      <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </section>

          <!-- ─── Dateien ─────────────────────────────────── -->
          <section class="info-section" :class="{ 'mobile-collapsed': isMobile && !mobileSectionsOpen.dateien }">
            <h4 class="section-title" :class="{ 'section-title--mobile-clickable': isMobile }" @click="isMobile && toggleMobileSection('dateien')">
              <font-awesome-icon :icon="['fas', 'paperclip']" /> Dateien
              <span v-if="selectedLead.attachments?.length" class="section-count">{{ selectedLead.attachments.length }}</span>
              <font-awesome-icon v-if="isMobile" class="section-chevron" :icon="['fas', mobileSectionsOpen.dateien ? 'chevron-up' : 'chevron-down']" />
            </h4>

            <!-- Upload area -->
            <div
              class="attach-upload-area"
              :class="{ 'attach-drag-over': attachDragOver }"
              @dragover.prevent="attachDragOver = true"
              @dragleave.prevent="attachDragOver = false"
              @drop.prevent="onAttachDrop"
            >
              <input ref="attachInput" type="file" multiple class="attach-file-input" @change="onAttachFileChange" />
              <button class="btn-add-contact" @click="attachInput.click()" :disabled="attachUploading">
                <font-awesome-icon v-if="attachUploading" :icon="['fas', 'spinner']" spin />
                <font-awesome-icon v-else :icon="['fas', 'plus']" />
                {{ attachUploading ? 'Lädt hoch…' : 'Dateien wählen oder hier ablegen' }}
              </button>
            </div>

            <!-- Upload progress -->
            <div v-if="attachProgress > 0" class="attach-progress">
              <div class="attach-progress-bar" :style="{ width: attachProgress + '%' }"></div>
            </div>

            <!-- File list -->
            <div v-if="!selectedLead.attachments?.length && !attachUploading" class="akt-empty">
              Noch keine Dateien angehängt.
            </div>
            <ul v-else class="attach-list">
              <li v-for="att in selectedLead.attachments" :key="att.id" class="attach-item">
                <span class="attach-icon">
                  <font-awesome-icon :icon="attachIcon(att.contentType)" />
                </span>
                <span class="attach-name" :title="att.filename">{{ att.filename }}</span>
                <span class="attach-size">{{ formatBytes(att.size) }}</span>
                <button v-if="isPreviewable(att)" class="attach-btn" @click="openAttachment(att)" title="Im Browser öffnen">
                  <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                </button>
                <button class="attach-btn" @click="downloadAttachment(att)" title="Herunterladen">
                  <font-awesome-icon :icon="['fas', 'download']" />
                </button>
                <button class="attach-btn attach-btn--delete" @click="deleteAttachment(att)" title="Löschen">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </li>
            </ul>
          </section>

          <!-- ─── Chronik (Mobile-only) ──────────────────── -->
          <section
            v-if="isMobile"
            class="info-section info-section--chronik-mobile"
            :class="{ 'mobile-collapsed': !mobileSectionsOpen.chronik }"
          >
            <h4
              class="section-title section-title--mobile-clickable"
              @click="toggleMobileSection('chronik')"
            >
              <font-awesome-icon :icon="['fas', 'clock-rotate-left']" /> Chronik
              <span v-if="chronikEntries.length + (chronikLead?.aktivitaeten?.length || 0) > 0" class="section-count">
                {{ chronikEntries.length + (chronikLead?.aktivitaeten?.length || 0) }}
              </span>
              <font-awesome-icon class="section-chevron" :icon="['fas', mobileSectionsOpen.chronik ? 'chevron-up' : 'chevron-down']" />
            </h4>

            <div v-if="loadingChronik" class="chronik-empty">
              <font-awesome-icon :icon="['fas', 'spinner']" spin />
            </div>
            <div v-else-if="mergedTimeline.length === 0" class="chronik-empty">
              Noch keine Einträge.
            </div>
            <div v-else class="chronik-timeline chronik-timeline--mobile">
              <template v-for="item in mergedTimeline" :key="item.kind === 'divider' ? '__divider__' : (item.kind === 'chronik' ? item.entry._id : item.akt._id)">
                <div v-if="item.kind === 'divider'" class="chronik-divider-now">
                  <span class="chronik-divider-label">Jetzt</span>
                </div>
                <div
                  v-else-if="item.kind === 'chronik'"
                  class="chronik-entry"
                  :class="{ 'chronik-entry--system': item.entry.isSystem }"
                >
                  <div class="chronik-dot">
                    <font-awesome-icon
                      v-if="item.entry.isSystem"
                      :icon="['fas', 'circle-dot']"
                      class="dot-icon dot-icon--system"
                    />
                    <span v-else class="dot-avatar">{{ initials(item.entry.author) }}</span>
                  </div>
                  <div class="chronik-content">
                    <div class="chronik-meta">
                      <span v-if="!item.entry.isSystem" class="chronik-author">{{ item.entry.author }}</span>
                      <span class="chronik-time">{{ formatDateTime(item.entry.createdAt) }}</span>
                    </div>
                    <div class="chronik-text-wrap">
                      <p class="chronik-text">{{ item.entry.text }}</p>
                      <button
                        v-if="!item.entry.isSystem && canDeleteChronik(item.entry)"
                        class="ctx-delete-btn"
                        @click="deleteChronikEntry(item.entry._id)"
                        title="Löschen"
                      >
                        <font-awesome-icon :icon="['fas', 'trash']" />
                      </button>
                    </div>
                  </div>
                </div>
                <div
                  v-else-if="item.kind === 'aktivitaet'"
                  class="chronik-entry chronik-entry--akt"
                  :class="{ 'chronik-entry--akt-done': item.akt.erledigt, 'chronik-entry--akt-overdue': isOverdue(item.akt) }"
                >
                  <div class="chronik-dot">
                    <button class="chronik-akt-check" @click="toggleAktErledigt(item.akt)" :title="item.akt.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'">
                      <font-awesome-icon :icon="['fas', item.akt.erledigt ? 'circle-check' : 'circle']" />
                    </button>
                  </div>
                  <div class="chronik-content">
                    <div class="chronik-meta">
                      <font-awesome-icon :icon="aktTypeIcon(item.akt.type)" class="chronik-akt-type-icon" />
                      <span class="chronik-akt-type-label">{{ aktTypeLabel(item.akt.type) }}</span>
                      <span class="chronik-time">{{ formatAktDate(item.akt.datum) }}</span>
                    </div>
                    <p class="chronik-text" :class="{ 'chronik-text--done': item.akt.erledigt }">
                      {{ item.akt.titel || '(kein Titel)' }}
                    </p>
                    <span v-if="item.akt.kontakt?.displayName" class="chronik-akt-kontakt">
                      <font-awesome-icon :icon="['fas', 'user']" /> {{ item.akt.kontakt.displayName }}
                    </span>
                  </div>
                </div>
              </template>
            </div>

            <div class="chronik-inline-compose chronik-compose--mobile">
              <div class="compose-dot">
                <span class="dot-avatar">{{ initials(auth.user?.name) }}</span>
              </div>
              <div class="compose-input-wrap">
                <textarea
                  v-model="newChronikText"
                  placeholder="Kommentar hinzufügen…"
                  class="note-textarea"
                  rows="1"
                  @keydown.ctrl.enter.prevent="addChronikEntry"
                ></textarea>
                <button
                  class="btn btn-primary compose-send-btn"
                  :disabled="!newChronikText.trim() || addingChronik"
                  @click="addChronikEntry"
                >
                  <font-awesome-icon :icon="['fas', addingChronik ? 'spinner' : 'paper-plane']" :spin="addingChronik" />
                </button>
              </div>
            </div>
          </section>

        </div>
      </aside>
    </transition>

    <!-- Chronik bottom drawer (slides up when a lead is open) -->
    <LeadChronikDrawer
      :show="!!selectedLead && !isMobile"
      :sidebar-open="!!selectedLead"
      :count="chronikEntries.length + (chronikLead?.aktivitaeten?.length || 0)"
      :lead-title="chronikLead?.title || ''"
      @close="closeSidebar"
    >
      <div class="chronik-drawer-inner">
        <div v-if="loadingChronik" class="chronik-empty">
          <font-awesome-icon :icon="['fas', 'spinner']" spin />
        </div>
        <div v-else-if="mergedTimeline.length === 0" class="chronik-empty">
          Noch keine Einträge.
        </div>
        <div v-else ref="chronikFeedEl" class="chronik-timeline">
          <template v-for="item in mergedTimeline" :key="item.kind === 'divider' ? '__divider__' : (item.kind === 'chronik' ? item.entry._id : item.akt._id)">
            <div v-if="item.kind === 'divider'" class="chronik-divider-now">
              <span class="chronik-divider-label">Jetzt</span>
            </div>
            <div
              v-else-if="item.kind === 'chronik'"
              class="chronik-entry"
              :class="{ 'chronik-entry--system': item.entry.isSystem }"
            >
              <div class="chronik-dot">
                <font-awesome-icon
                  v-if="item.entry.isSystem"
                  :icon="['fas', 'circle-dot']"
                  class="dot-icon dot-icon--system"
                />
                <span v-else class="dot-avatar">{{ initials(item.entry.author) }}</span>
              </div>
              <div class="chronik-content">
                <div class="chronik-meta">
                  <span v-if="!item.entry.isSystem" class="chronik-author">{{ item.entry.author }}</span>
                  <span class="chronik-time">{{ formatDateTime(item.entry.createdAt) }}</span>
                </div>
                <div class="chronik-text-wrap">
                  <p class="chronik-text">{{ item.entry.text }}</p>
                  <button
                    v-if="!item.entry.isSystem && canDeleteChronik(item.entry)"
                    class="ctx-delete-btn"
                    @click="deleteChronikEntry(item.entry._id)"
                    title="Löschen"
                  >
                    <font-awesome-icon :icon="['fas', 'trash']" />
                  </button>
                </div>
              </div>
            </div>
            <div
              v-else-if="item.kind === 'aktivitaet'"
              class="chronik-entry chronik-entry--akt"
              :class="{ 'chronik-entry--akt-done': item.akt.erledigt, 'chronik-entry--akt-overdue': isOverdue(item.akt) }"
            >
              <div class="chronik-dot">
                <button class="chronik-akt-check" @click="toggleAktErledigt(item.akt)" :title="item.akt.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'">
                  <font-awesome-icon :icon="['fas', item.akt.erledigt ? 'circle-check' : 'circle']" />
                </button>
              </div>
              <div class="chronik-content">
                <div class="chronik-meta">
                  <font-awesome-icon :icon="aktTypeIcon(item.akt.type)" class="chronik-akt-type-icon" />
                  <span class="chronik-akt-type-label">{{ aktTypeLabel(item.akt.type) }}</span>
                  <span class="chronik-time">{{ formatAktDate(item.akt.datum) }}</span>
                </div>
                <p class="chronik-text" :class="{ 'chronik-text--done': item.akt.erledigt }">
                  {{ item.akt.titel || '(kein Titel)' }}
                </p>
                <span v-if="item.akt.kontakt?.displayName" class="chronik-akt-kontakt">
                  <font-awesome-icon :icon="['fas', 'user']" /> {{ item.akt.kontakt.displayName }}
                </span>
              </div>
            </div>
          </template>
        </div>

        <div class="chronik-inline-compose chronik-compose--drawer">
          <div class="compose-dot">
            <span class="dot-avatar">{{ initials(auth.user?.name) }}</span>
          </div>
          <div class="compose-input-wrap">
            <textarea
              v-model="newChronikText"
              placeholder="Kommentar hinzufügen…"
              class="note-textarea"
              rows="1"
              @keydown.ctrl.enter.prevent="addChronikEntry"
            ></textarea>
            <button
              class="btn btn-primary compose-send-btn"
              :disabled="!newChronikText.trim() || addingChronik"
              @click="addChronikEntry"
            >
              <font-awesome-icon :icon="['fas', addingChronik ? 'spinner' : 'paper-plane']" :spin="addingChronik" />
            </button>
          </div>
        </div>
      </div>
    </LeadChronikDrawer>

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
                <label>Standort <span class="req">*</span></label>
                <select v-model="createForm.standort" class="form-input">
                  <option value="Hamburg">Hamburg</option>
                  <option value="Berlin">Berlin</option>
                  <option value="Köln">Köln</option>
                </select>
              </div>

              <div class="kv-item">
                <label>Organisation <span class="req">*</span></label>
                <input v-model="createForm.title" class="form-input" placeholder="z.B. EventRent" />
              </div>

              <div class="kv-item">
                <label>Quelle</label>
                <select v-model="createForm.quelle" class="form-input">
                  <option :value="null">—</option>
                  <option v-for="opt in leadConfig.quelleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
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
                <div v-if="linkedContact" class="linked-contact-chip">
                  <font-awesome-icon :icon="['fas', 'circle-check']" class="chip-icon" />
                  <div class="chip-info">
                    <strong>{{ linkedContact.displayName }}</strong>
                    <span>{{ primaryEmailOf(linkedContact) || linkedContact.companyName || '' }}</span>
                  </div>
                  <button class="chip-remove" @click="linkedContact = null">
                    <font-awesome-icon :icon="['fas', 'xmark']" />
                  </button>
                </div>
                <template v-else>
                  <button
                    class="btn-open-kontakt-modal"
                    @click="openKontaktAnlegenModal('create')"
                  >
                    <div class="ms-logo-grid" aria-hidden="true">
                      <span style="background:#f25022"></span>
                      <span style="background:#7fba00"></span>
                      <span style="background:#00a4ef"></span>
                      <span style="background:#ffb900"></span>
                    </div>
                    Kontakt in Microsoft anlegen
                  </button>
                  <p class="picker-hint">
                    <font-awesome-icon :icon="['fas', 'info-circle']" />
                    Öffnet ein Formular zum Anlegen eines neuen Microsoft-Kontakts.
                  </p>
                </template>
              </div>

              <!-- Mode: Überspringen -->
              <div v-if="contactPickerMode === 'skip'" class="skip-hint">
                <font-awesome-icon :icon="['fas', 'info-circle']" />
                Kein Microsoft-Kontakt wird verknüpft.
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

    <!-- Kontakt Anlegen Modal -->
    <KontaktAnlegenModal
      v-if="showKontaktAnlegenModal"
      :prefilled-company-name="kontaktAnlegenPrefill.companyName"
      :prefilled-team="kontaktAnlegenPrefill.team"
      @close="showKontaktAnlegenModal = false"
      @created="onKontaktAngelegt"
    />

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

            <div class="label-card-list">
              <div v-if="labels.length === 0" class="muted-text" style="padding: 12px 0;">Noch keine Felder definiert.</div>

              <div v-for="lbl in labels" :key="lbl._id" class="label-card">
                <!-- View mode -->
                <template v-if="editingLabelId !== lbl._id">
                  <div class="label-card-info">
                    <span class="label-card-name">{{ lbl.name }}</span>
                    <span class="label-card-type">{{ fieldTypeLabel(lbl.fieldType) }}</span>
                    <span v-if="['dropdown','multiselect'].includes(lbl.fieldType)" class="label-card-opts">
                      {{ (lbl.options || []).map(o => o.label).join(', ') || '—' }}
                    </span>
                  </div>
                  <div class="label-card-actions">
                    <label class="chip-toggle" :class="{ active: lbl.required }" title="Pflichtfeld">
                      <input type="checkbox" :checked="lbl.required" @change="toggleLabelField(lbl, 'required', $event.target.checked)" />
                      Pflicht
                    </label>
                    <label class="chip-toggle" :class="{ active: lbl.isActive }" title="Aktiv">
                      <input type="checkbox" :checked="lbl.isActive" @change="toggleLabelField(lbl, 'isActive', $event.target.checked)" />
                      Aktiv
                    </label>
                    <button class="btn-icon" @click="startEditLabel(lbl)" title="Bearbeiten">
                      <font-awesome-icon :icon="['fas', 'sliders']" />
                    </button>
                    <button class="ctx-delete-btn" @click="deleteLabel(lbl)" title="Deaktivieren">
                      <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                  </div>
                </template>

                <!-- Edit mode -->
                <template v-else>
                  <div class="label-edit-form">
                    <div class="new-field-row">
                      <input v-model="editLabelForm.name" class="form-input" placeholder="Feldname" />
                      <select v-model="editLabelForm.fieldType" class="form-input">
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
                        <option value="address">Adresse</option>
                      </select>
                    </div>
                    <div v-if="['dropdown','multiselect'].includes(editLabelForm.fieldType)" class="new-options-block">
                      <label class="muted-text">Optionen (eine pro Zeile)</label>
                      <textarea v-model="editLabelForm.optionsText" class="form-input" rows="3" placeholder="Option A&#10;Option B"></textarea>
                    </div>
                    <div class="label-edit-actions">
                      <button class="btn btn-primary btn-sm" :disabled="savingLabelEdit" @click="saveEditLabel(lbl)">
                        <font-awesome-icon :icon="['fas', savingLabelEdit ? 'spinner' : 'paper-plane']" :spin="savingLabelEdit" />
                        Speichern
                      </button>
                      <button class="btn btn-sm" @click="editingLabelId = null">Abbrechen</button>
                    </div>
                  </div>
                </template>
              </div>
            </div>

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
                <option value="address">Adresse</option>
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

            <hr class="divider" />

            <!-- ─── Standard-Felder Konfiguration ─────────────────── -->
            <h4>Standard-Felder</h4>
            <p class="muted-text" style="margin-bottom: 12px;">Konfiguriere die Optionen für die eingebauten Lead-Felder.</p>

            <!-- Quelle -->
            <div class="config-section">
              <h5 class="config-section-title">Quelle-Optionen</h5>
              <div class="config-option-list">
                <div v-for="(opt, idx) in leadConfig.quelleOptions" :key="opt.value" class="config-option-row">
                  <template v-if="editingQuelleIdx === idx">
                    <input
                      v-model="editingQuelleLabel"
                      class="form-input form-input--sm"
                      @keydown.enter="saveEditQuelle(idx)"
                      @keydown.esc="editingQuelleIdx = null"
                    />
                    <span class="config-value-hint">{{ opt.value }}</span>
                    <button class="btn btn-primary btn-sm" @click="saveEditQuelle(idx)">✓</button>
                    <button class="btn-icon" @click="editingQuelleIdx = null"><font-awesome-icon :icon="['fas', 'xmark']" /></button>
                  </template>
                  <template v-else>
                    <span class="config-opt-label">{{ opt.label }}</span>
                    <span class="config-value-hint">{{ opt.value }}</span>
                    <button class="btn-icon" @click="startEditQuelle(idx)" title="Bearbeiten">
                      <font-awesome-icon :icon="['fas', 'sliders']" />
                    </button>
                    <button class="ctx-delete-btn" @click="removeQuelleOption(idx)" title="Löschen">
                      <font-awesome-icon :icon="['fas', 'trash']" />
                    </button>
                  </template>
                </div>
              </div>
              <div class="new-field-row" style="margin-top: 8px;">
                <input
                  v-model="newQuelleLabel"
                  class="form-input"
                  placeholder="Neue Option (z.B. Partnervertrieb)"
                  @keydown.enter="addQuelleOption"
                />
                <button class="btn btn-primary" :disabled="!newQuelleLabel.trim()" @click="addQuelleOption">
                  <font-awesome-icon :icon="['fas', 'plus']" /> Hinzufügen
                </button>
              </div>
            </div>


          </div>
        </div>
      </div>
    </teleport>

    <!-- Row context menu -->
    <teleport to="body">
      <div v-if="rowMenu.leadId" class="row-menu-overlay" :class="{ 'row-menu-overlay--mobile': isMobile }" @pointerdown.self="closeRowMenu">
        <div
          class="row-menu"
          :class="{ 'row-menu--mobile': isMobile }"
          :style="isMobile ? null : { top: rowMenu.y + 'px', left: rowMenu.x + 'px' }"
          @click.stop
        >
          <button v-if="isMobile" class="row-menu-item" @click="openMobileStageMenu">
            <font-awesome-icon :icon="['fas', 'flag']" /> Stufe ändern
          </button>
          <button class="row-menu-item" @click="archiveLeadById(leads.find(l => l._id === rowMenu.leadId))">
            <font-awesome-icon :icon="['fas', 'box-archive']" /> Archivieren
          </button>
          <button class="row-menu-item row-menu-item--danger" @click="deleteLeadPermanent(leads.find(l => l._id === rowMenu.leadId))">
            <font-awesome-icon :icon="['fas', 'trash']" /> Löschen
          </button>
        </div>
      </div>
    </teleport>

    <!-- Mobile stage picker (bottom sheet) -->
    <teleport to="body">
      <div v-if="mobileStageMenuLead" class="row-menu-overlay row-menu-overlay--mobile" @pointerdown.self="closeMobileStageMenu">
        <div class="row-menu row-menu--mobile mobile-stage-sheet" @click.stop>
          <div class="row-menu-header">Stufe wählen</div>
          <div class="stufe-stepper stufe-stepper--mobile">
            <button
              v-for="s in stufeSteps"
              :key="s.value"
              class="stufe-step"
              :class="[`stufe-step--${s.value}`, {
                active: (mobileStageMenuLead.stufe || 'neu') === s.value,
                done: isStufeBefore(s.value, mobileStageMenuLead.stufe || 'neu'),
              }]"
              @click="pickMobileStage(s.value)"
              :title="s.label"
            >
              <span class="step-dot"></span>
              <span class="step-label">{{ s.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Address modal -->
    <teleport to="body">
      <div v-if="showAddressModal" class="modal-overlay" @click.self="closeAddressModal">
        <div class="modal-content address-modal">
          <header class="modal-header">
            <h3>
              <span class="addr-modal-icon"><font-awesome-icon :icon="['fas', 'address-card']" /></span>
              Adresse eingeben
            </h3>
            <button class="btn-icon" @click="closeAddressModal" title="Schließen">
              <font-awesome-icon :icon="['fas', 'xmark']" />
            </button>
          </header>
          <div class="addr-form">
            <div class="addr-field addr-field--full">
              <label class="addr-label">Straße &amp; Hausnummer</label>
              <input v-model="addressDraft.street" class="addr-input" placeholder="Musterstraße 42" @keydown.enter="saveAddress" />
            </div>
            <div class="addr-row">
              <div class="addr-field">
                <label class="addr-label">PLZ</label>
                <input v-model="addressDraft.zip" class="addr-input" placeholder="12345" @keydown.enter="saveAddress" />
              </div>
              <div class="addr-field" style="flex:2">
                <label class="addr-label">Stadt</label>
                <input v-model="addressDraft.city" class="addr-input" placeholder="Berlin" @keydown.enter="saveAddress" />
              </div>
            </div>
            <div class="addr-field addr-field--full">
              <label class="addr-label">Land</label>
              <input v-model="addressDraft.country" class="addr-input" placeholder="Deutschland" @keydown.enter="saveAddress" />
            </div>
          </div>
          <footer class="modal-footer">
            <button class="btn" @click="closeAddressModal">Abbrechen</button>
            <button class="btn btn-primary" @click="saveAddress">Speichern</button>
          </footer>
        </div>
      </div>
    </teleport>

    <!-- Column customizer panel -->
    <teleport to="body">
      <div v-if="showColPanel" class="col-panel-overlay" @click="closeColPanel">
        <div
          class="col-panel"
          :style="{ top: colPanelAnchor.y + 'px', left: colPanelAnchor.x + 'px', transform: 'translateX(-100%)' }"
          @click.stop
        >
          <div class="col-panel-header">Spalten anpassen</div>
          <div v-for="(col, idx) in colConfig" :key="col._id" class="col-panel-row" :class="{ 'col-panel-row--standard': col.type === 'standard' }">
            <label class="col-panel-label">
              <input type="checkbox" :checked="col.visible" @change="toggleColVisible(col)" />
              {{ col.name }}
            </label>
            <div class="col-panel-order">
              <button :disabled="idx === 0" class="col-order-btn" @click="moveCol(idx, -1)" title="Nach oben">
                <font-awesome-icon :icon="['fas', 'arrow-up']" />
              </button>
              <button :disabled="idx === colConfig.length - 1" class="col-order-btn" @click="moveCol(idx, 1)" title="Nach unten">
                <font-awesome-icon :icon="['fas', 'arrow-down']" />
              </button>
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
  faPhone, faUsers, faCalendarDays, faEnvelope, faTv, faCircleCheck, faCircle, faCalendarCheck,
  faFlag, faUtensils, faPen, faFile, faFilePdf, faFileImage, faFileWord, faFileExcel,
  faFileZipper, faDownload, faPaperclip,
  faChevronLeft, faChevronDown, faChevronUp, faClockRotateLeft, faFilter, faTableColumns,
} from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import ContactCard from './ContactCard.vue';
import SearchBar from './SearchBar.vue';
import KontaktAnlegenModal from './KontaktAnlegenModal.vue';
import LeadBoard from './leads/LeadBoard.vue';
import LeadCard from './leads/LeadCard.vue';
import LeadChronikDrawer from './leads/LeadChronikDrawer.vue';

library.add(
  faPlus, faXmark, faSpinner, faSliders, faUser, faInfoCircle,
  faAddressBook, faNoteSticky, faPaperPlane, faTrash, faTrophy,
  faBoxArchive, faBullseye, faEllipsisVertical, faArrowUp, faArrowDown,
  faAddressCard, faArrowUpRightFromSquare, faLinkSlash,
  faPhone, faUsers, faCalendarDays, faEnvelope, faTv, faCircleCheck, faCircle, faCalendarCheck,
  faFlag, faUtensils, faPen, faFile, faFilePdf, faFileImage, faFileWord, faFileExcel,
  faFileZipper, faDownload, faPaperclip,
  faChevronLeft, faChevronDown, faChevronUp, faClockRotateLeft, faFilter, faTableColumns
);

const auth = useAuth();

// ─── Props ───────────────────────────────────────────────────────────
const props = defineProps({
  initialLeadId: { type: String, default: null },
});

// ─── Mobile detection ───────────────────────────────────────────────
const MOBILE_BP = 768;
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= MOBILE_BP);
function onResizeMobile() { isMobile.value = window.innerWidth <= MOBILE_BP; }

// Mobile state
const mobileStageFilter = ref('all'); // 'all' or one of stufeSteps values
const mobileToolbarMenuOpen = ref(false);
const mobileSidebarMenuOpen = ref(false);
// Per-session collapsed/expanded state of sidebar sections on mobile.
// Key: section id, value: true=expanded, false=collapsed.
const mobileSectionsOpen = reactive({
  daten: true,
  kontakte: false,
  aktivitaeten: false,
  chronik: false,
  dateien: false,
});
function toggleMobileSection(key) { mobileSectionsOpen[key] = !mobileSectionsOpen[key]; }
function resetMobileSections() {
  mobileSectionsOpen.daten = true;
  mobileSectionsOpen.kontakte = false;
  mobileSectionsOpen.aktivitaeten = false;
  mobileSectionsOpen.chronik = false;
  mobileSectionsOpen.dateien = false;
}

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
  standort: 'Hamburg',
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

const rowMenu = reactive({ leadId: null, x: 0, y: 0 });
let _rowMenuOpenedAt = 0;

function openRowMenu(event, lead) {
  const rect = event.currentTarget.getBoundingClientRect();
  rowMenu.leadId = lead._id;
  rowMenu.x = rect.right;
  rowMenu.y = rect.bottom + window.scrollY;
  _rowMenuOpenedAt = Date.now();
}
function closeRowMenu(force = false) {
  if (!force && Date.now() - _rowMenuOpenedAt < 300) return;
  rowMenu.leadId = null;
}

async function archiveLeadById(lead) {
  closeRowMenu(true);
  if (!confirm(`Lead "${lead.title}" archivieren?`)) return;
  await api.delete(`/api/leads/${lead._id}`);
  leads.value = leads.value.filter((l) => l._id !== lead._id);
  if (selectedLead.value?._id === lead._id) closeSidebar();
}

async function deleteLeadPermanent(lead) {
  closeRowMenu(true);
  if (!confirm(`Lead "${lead.title}" unwiderruflich löschen?`)) return;
  await api.delete(`/api/leads/${lead._id}/permanent`);
  leads.value = leads.value.filter((l) => l._id !== lead._id);
  if (selectedLead.value?._id === lead._id) closeSidebar();
}

const showCreateModal = ref(false);
const showFieldManager = ref(false);
const showColPanel = ref(false);
const colPanelAnchor = ref({ x: 0, y: 0 });
const colConfig = ref([]);
const expectedCloseDateInput = ref(null);
const showAddressModal = ref(false);
const addressModalKey = ref('');
const addressDraft = reactive({ street: '', city: '', zip: '', country: '' });
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

// KontaktAnlegenModal state
const showKontaktAnlegenModal = ref(false);
// context: 'create' (within create-lead modal) | 'sidebar' (sidebar link)
const kontaktAnlegenContext = ref('sidebar');
const kontaktAnlegenPrefill = reactive({ companyName: '', team: 'hamburg' });

function openKontaktAnlegenModal(context) {
  kontaktAnlegenContext.value = context;
  // Determine prefill: use existing linked contact's company + team, else lead title
  let companyName = '';
  let team = 'hamburg';
  // Helper: resolve full contact from allMsContacts by id (stored entries may lack companyName)
  function resolveCompany(storedContact) {
    const full = allMsContacts.value.find((c) => c.id === storedContact.id);
    return (full?.companyName || storedContact.companyName || '');
  }
  function resolveTeam(storedContact) {
    const full = allMsContacts.value.find((c) => c.id === storedContact.id);
    return (full?._team || storedContact._team || 'hamburg');
  }

  if (context === 'sidebar') {
    const existingContacts = leadContacts.value;
    if (existingContacts.length > 0) {
      companyName = resolveCompany(existingContacts[0]);
      team = resolveTeam(existingContacts[0]);
    } else {
      companyName = selectedLead.value?.title || '';
    }
  } else {
    // create modal context
    if (linkedContact.value) {
      companyName = linkedContact.value.companyName || '';
      team = linkedContact.value._team || 'hamburg';
    } else {
      companyName = createForm.title || '';
    }
  }
  kontaktAnlegenPrefill.companyName = companyName;
  kontaktAnlegenPrefill.team = team;
  showKontaktAnlegenModal.value = true;
}

const createForm = reactive({
  title: '',
  wert: null,
  standort: 'Hamburg',
  quelle: null,
  kontakt: { vorname: '', nachname: '', email: '', telefon: '', firma: '' },
});

const newField = reactive({
  name: '',
  fieldType: 'text',
  optionsText: '',
});

// ─── Label inline edit state ──────────────────────────────────────
const editingLabelId = ref(null);
const savingLabelEdit = ref(false);
const editLabelForm = reactive({ name: '', fieldType: 'text', optionsText: '' });

function startEditLabel(lbl) {
  editingLabelId.value = lbl._id;
  editLabelForm.name = lbl.name;
  editLabelForm.fieldType = lbl.fieldType;
  editLabelForm.optionsText = (lbl.options || []).map(o => o.label).join('\n');
}

async function saveEditLabel(lbl) {
  const name = editLabelForm.name.trim();
  if (!name) return;
  savingLabelEdit.value = true;
  try {
    const options = ['dropdown', 'multiselect'].includes(editLabelForm.fieldType)
      ? editLabelForm.optionsText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .map(label => ({
            label,
            value: label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
          }))
      : [];
    const { data } = await api.patch(`/api/leads/labels/${lbl._id}`, {
      name,
      fieldType: editLabelForm.fieldType,
      options,
    });
    const idx = labels.value.findIndex(l => l._id === lbl._id);
    if (idx >= 0) labels.value.splice(idx, 1, data);
    editingLabelId.value = null;
  } catch (e) {
    console.error('Failed to save label', e);
  } finally {
    savingLabelEdit.value = false;
  }
}

const newNote = ref('');
const addingNote = ref(false);

// ─── Lead Config (configurable default fields) ────────────────────
const leadConfig = ref({ quelleOptions: [] });
const savingConfig = ref(false);
// editing state inside Field Manager
const newQuelleLabel = ref('');
const editingQuelleIdx = ref(null); // index being edited inline
const editingQuelleLabel = ref('');

// ─── Chronik ─────────────────────────────────────────────────────────
const chronikEntries = ref([]);
const loadingChronik = ref(false);
const newChronikText = ref('');
const addingChronik = ref(false);
const chronikExpandedLeadId = ref(null);
const chronikLead = ref(null);
const chronikFeedEl = ref(null);

// Merged timeline: past chronik entries + future/present activities, sorted by date
const mergedTimeline = computed(() => {
  const now = new Date();
  const items = [
    ...chronikEntries.value.map(e => ({ kind: 'chronik', date: new Date(e.createdAt), entry: e })),
    ...(chronikLead.value?.aktivitaeten || []).map(a => ({ kind: 'aktivitaet', date: new Date(a.datum), akt: a })),
  ].sort((a, b) => a.date - b.date);

  // Insert a divider between the last past item and first future item
  const firstFutureIdx = items.findIndex(i => i.date >= now);
  if (firstFutureIdx > 0 && firstFutureIdx < items.length) {
    items.splice(firstFutureIdx, 0, { kind: 'divider', date: now });
  } else if (firstFutureIdx === 0 && items.length > 0) {
    items.unshift({ kind: 'divider', date: now });
  }
  return items;
});

watch(mergedTimeline, () => {
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

async function addSystemChronikEntry(leadId, text) {
  try {
    const { data } = await api.post('/api/comments', {
      scope: 'lead_chronik',
      isSystem: true,
      text,
      context: { resourceId: leadId, resourceType: 'Lead' },
    });
    chronikEntries.value.push(data);
  } catch (e) {
    console.error('System-Chronik fehlgeschlagen', e);
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

function isStufeBefore(val, active) {
  if (active === 'verloren') return false;
  const ai = stufeOrder.indexOf(active);
  const vi = stufeOrder.indexOf(val);
  return vi < ai;
}

// ─── Standard columns (always configurable via col panel) ───────────────────
const STANDARD_COLS = [
  { _id: 'std_stufe',   name: 'Stufe',        type: 'standard', stdKey: 'stufe' },
  { _id: 'std_quelle',  name: 'Quelle',       type: 'standard', stdKey: 'quelle' },
  { _id: 'std_owner',   name: 'Besitzer',     type: 'standard', stdKey: 'owner' },
  { _id: 'std_created', name: 'Lead erstellt', type: 'standard', stdKey: 'createdAt' },
];

// ─── Column config (localStorage-persisted visibility & order) ──────────────
watch(labels, (newLabels) => {
  const stored = (() => { try { return JSON.parse(localStorage.getItem('leads_col_config') || '[]'); } catch { return []; } })();
  const active = newLabels.filter((l) => l.isActive);

  // All configurable columns: standard first, then custom fields
  const allConfigurable = [
    ...STANDARD_COLS,
    ...active.map((lbl) => ({
      _id: lbl._id, name: lbl.name, type: 'custom',
      key: lbl.key, fieldType: lbl.fieldType, options: lbl.options,
    })),
  ];

  const storedIds = stored.map((s) => s._id);
  colConfig.value = [
    // Stored entries that still exist → preserves user-defined order + visibility
    ...stored
      .filter((s) => allConfigurable.some((c) => c._id === s._id))
      .map((s) => {
        const col = allConfigurable.find((c) => c._id === s._id);
        return { ...col, visible: s.visible !== false };
      }),
    // New entries not yet in storage (new custom fields or first load of standard cols)
    ...allConfigurable
      .filter((c) => !storedIds.includes(c._id))
      .map((c) => ({ ...c, visible: true })),
  ];
}, { immediate: true });

function saveColConfig() {
  localStorage.setItem('leads_col_config', JSON.stringify(colConfig.value.map((c) => ({ _id: c._id, visible: c.visible }))));
}

function openColPanel(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  colPanelAnchor.value = { x: rect.right, y: rect.bottom + 4 };
  showColPanel.value = !showColPanel.value;
}

function closeColPanel() {
  showColPanel.value = false;
}

function toggleColVisible(col) {
  col.visible = !col.visible;
  saveColConfig();
}

function moveCol(idx, dir) {
  const arr = colConfig.value;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  saveColConfig();
}

// ─── Computed ────────────────────────────────────────────────────────
const visibleColConfig = computed(() => colConfig.value.filter((c) => c.visible));

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

  if (statusFilter.value === 'archived') {
    list = list.filter((l) => l.status === 'archived');
  } else if (statusFilter.value === 'open') {
    list = list.filter((l) => l.status !== 'archived');
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
    let av, bv;
    if (sortBy.value === 'stufe') {
      av = stufeOrder.indexOf(a.stufe ?? '');
      bv = stufeOrder.indexOf(b.stufe ?? '');
      if (av === -1) av = stufeOrder.length;
      if (bv === -1) bv = stufeOrder.length;
    } else if (sortBy.value === 'quelle') {
      av = quelleLabel(a.quelle) || '';
      bv = quelleLabel(b.quelle) || '';
    } else if (sortBy.value === 'owner') {
      av = (a.eigentuemer?.name || a.eigentuemer?.email || '').toLowerCase();
      bv = (b.eigentuemer?.name || b.eigentuemer?.email || '').toLowerCase();
    } else {
      av = a[sortBy.value];
      bv = b[sortBy.value];
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  // Favorites always pinned on top
  list.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  return list;
});

const selectedLeadOwnerLabel = computed(() => {
  const owner = selectedLead.value?.eigentuemer;
  if (!owner) return '';
  return owner.name || owner.email || '';
});

// ─── Mobile list helpers ──────────────────────────────────────────────
// Counts per stage (over the status-filtered, search-filtered list).
const mobileStageCounts = computed(() => {
  const counts = { all: filteredLeads.value.length };
  for (const s of stufeOrder) counts[s] = 0;
  for (const l of filteredLeads.value) {
    const k = counts[l.stufe] != null ? l.stufe : 'neu';
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
});

// Final list shown in the mobile vertical list (filteredLeads + stage filter).
const mobileVisibleLeads = computed(() => {
  if (mobileStageFilter.value === 'all') return filteredLeads.value;
  return filteredLeads.value.filter((l) => (l.stufe || 'neu') === mobileStageFilter.value);
});

// Grouped view for mobile: when "Alle" is active, group by stufe in stufeOrder.
// When a specific stufe is selected, returns a single group.
const mobileGroupedLeads = computed(() => {
  const items = mobileVisibleLeads.value;
  if (mobileStageFilter.value !== 'all') {
    const step = stufeSteps.find((s) => s.value === mobileStageFilter.value);
    return items.length
      ? [{ stufe: mobileStageFilter.value, label: step?.label || mobileStageFilter.value, leads: items }]
      : [];
  }
  const buckets = new Map();
  for (const s of stufeSteps) buckets.set(s.value, { stufe: s.value, label: s.label, leads: [] });
  for (const l of items) {
    const key = buckets.has(l.stufe) ? l.stufe : 'neu';
    buckets.get(key).leads.push(l);
  }
  return [...buckets.values()].filter((g) => g.leads.length > 0);
});

// Stage selector triggered from mobile row menu — reuses onStageChange.
const mobileStageMenuLead = ref(null);
function openMobileStageMenu() {
  const lead = leads.value.find((l) => l._id === rowMenu.leadId);
  if (!lead) return;
  mobileStageMenuLead.value = lead;
  closeRowMenu(true);
}
function closeMobileStageMenu() { mobileStageMenuLead.value = null; }
function pickMobileStage(stufe) {
  const lead = mobileStageMenuLead.value;
  if (!lead) return;
  closeMobileStageMenu();
  if ((lead.stufe || 'neu') === stufe) return;
  onStageChange({ lead, fromStufe: lead.stufe, toStufe: stufe });
}

// ─── Board helpers ────────────────────────────────────────────────────
// Custom labels visible as chips on board cards (uses existing colConfig).
const visibleCustomLabels = computed(() => {
  const visibleIds = new Set(
    colConfig.value.filter(c => c.visible && c.type !== 'standard').map(c => c._id),
  );
  return labels.value.filter(l => l.isActive && visibleIds.has(l._id));
});

// Standard column visibility (for showing built-in fields as chips on cards)
const visibleStdCreated = computed(() =>
  colConfig.value.some(c => c._id === 'std_created' && c.visible),
);

async function onStageChange({ lead, fromStufe, toStufe }) {
  // Optimistic local update
  const idx = leads.value.findIndex(l => l._id === lead._id);
  if (idx >= 0) leads.value[idx] = { ...leads.value[idx], stufe: toStufe };
  if (selectedLead.value?._id === lead._id) {
    selectedLead.value = { ...selectedLead.value, stufe: toStufe };
    detailForm.stufe = toStufe;
  }

  // Verloren prompts for a reason
  let verlorenGrund;
  if (toStufe === 'verloren') {
    verlorenGrund = prompt('Grund für Verloren (optional):') || undefined;
  }

  // Auto-mirror status for terminal stages
  const payload = { stufe: toStufe };
  if (toStufe === 'gewonnen') payload.status = 'won';
  else if (toStufe === 'verloren') {
    payload.status = 'lost';
    if (verlorenGrund) payload.verlorenGrund = verlorenGrund;
  }

  try {
    const { data } = await api.patch(`/api/leads/${lead._id}`, payload);
    upsertLead(data);
    if (selectedLead.value?._id === lead._id) selectedLead.value = data;
  } catch (e) {
    console.error('Stage-Change fehlgeschlagen', e);
    // Revert
    if (idx >= 0) leads.value[idx] = { ...leads.value[idx], stufe: fromStufe };
    if (selectedLead.value?._id === lead._id) {
      selectedLead.value = { ...selectedLead.value, stufe: fromStufe };
      detailForm.stufe = fromStufe;
    }
    alert('Stufe konnte nicht aktualisiert werden.');
  }
}

// ─── Loading ─────────────────────────────────────────────────────────
async function loadAll() {
  loading.value = true;
  // Contacts prefetch runs in parallel, non-blocking
  prefetchContacts();
  try {
    const [leadsRes, labelsRes, configRes] = await Promise.all([
      api.get('/api/leads'),
      api.get('/api/leads/labels'),
      api.get('/api/leads/config'),
    ]);
    leads.value = leadsRes.data;
    labels.value = labelsRes.data;
    leadConfig.value = configRes.data;
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

onMounted(async () => {
  await loadAll();
  if (props.initialLeadId) {
    const target = leads.value.find(l => l._id === props.initialLeadId);
    if (target) openLead(target);
  }
});

// ─── Favorite ────────────────────────────────────────────────────────
async function toggleFavorite(lead) {
  const newVal = !lead.isFavorite;
  lead.isFavorite = newVal; // optimistic
  try {
    const { data } = await api.patch(`/api/leads/${lead._id}`, { isFavorite: newVal });
    Object.assign(lead, data);
  } catch {
    lead.isFavorite = !newVal; // revert
  }
}

// ─── Sidebar / Detail ────────────────────────────────────────────────
function openLead(lead) {
  if (selectedLead.value && selectedLead.value._id === lead._id) {
    selectedLead.value = null;
    chronikExpandedLeadId.value = null;
    chronikLead.value = null;
    document.body.style.overflow = '';
    return;
  }
  selectedLead.value = lead;
  if (window.innerWidth <= 1100) document.body.style.overflow = 'hidden';
  if (isMobile.value) resetMobileSections();
  detailForm.title = lead.title || '';
  detailForm.wert = lead.wert ?? null;
  detailForm.waehrung = lead.waehrung || 'EUR';
  detailForm.stufe = lead.stufe || 'neu';
  detailForm.standort = lead.standort || 'Hamburg';
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
  mobileSidebarMenuOpen.value = false;
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
      standort: detailForm.standort,
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

  if (lbl.fieldType === 'address' && typeof v === 'object') {
    const parts = [v.street, [v.zip, v.city].filter(Boolean).join(' '), v.country].filter(Boolean);
    return escapeHtml(parts.join(', ') || '—');
  }

  // Shorten URLs for display
  if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
    return escapeHtml(normalizeUrlDisplay(v));
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

function normalizeUrlDisplay(url) {
  try {
    const u = new URL(url);
    let display = u.hostname;
    if (u.pathname && u.pathname !== '/') {
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        display += '/' + pathParts.slice(0, 1).join('/');
      }
    }
    if (display.length > 40) {
      display = display.substring(0, 37) + '…';
    }
    return display;
  } catch (e) {
    if (url.length > 40) {
      return url.substring(0, 37) + '…';
    }
    return url;
  }
}

// ─── Create Lead ─────────────────────────────────────────────────────
function openCreateModal() {
  Object.assign(createForm, {
    title: '',
    wert: null,
    standort: 'Hamburg',
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
      title:    createForm.title.trim(),
      wert:     createForm.wert,
      standort: createForm.standort,
      quelle:   createForm.quelle,
      kontakt:  createForm.kontakt,
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
    const removedName = currentContacts.find(c => c.id === contactId)?.displayName || contactId;
    upsertLead(data);
    selectedLead.value = data;
    await addSystemChronikEntry(data._id, `Kontakt entfernt: ${removedName}`);
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
    companyName: c.companyName || '',
  };
  const updated = [...leadContacts.value, newEntry];
  savingDetail.value = true;
  try {
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}`, { msContacts: updated });
    upsertLead(data);
    selectedLead.value = data;
    await addSystemChronikEntry(data._id, `Kontakt verknüpft: ${newEntry.displayName}`);
  } finally {
    savingDetail.value = false;
    cancelAddContact();
  }
}

// ─── KontaktAnlegenModal handler ─────────────────────────────────────
function onKontaktAngelegt(contact) {
  showKontaktAnlegenModal.value = false;

  if (kontaktAnlegenContext.value === 'create') {
    // Inside the "Lead anlegen" modal: set as linked contact
    linkedContact.value = contact;
    const email = primaryEmailOf(contact);
    const nameParts = (contact.displayName || '').split(' ');
    createForm.kontakt.vorname  = contact.givenName || (nameParts.length > 1 ? nameParts[0] : '');
    createForm.kontakt.nachname = contact.surname   || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : contact.displayName || '');
    createForm.kontakt.email    = email;
    createForm.kontakt.firma    = contact.companyName || '';
    createForm.kontakt.telefon  = contact.mobilePhone || (contact.businessPhones?.[0] ?? '');
    // Also add to prefetched contacts list
    allMsContacts.value.unshift(contact);
  } else {
    // From sidebar: link to current lead
    allMsContacts.value.unshift(contact);
    linkMsContact(contact); // linkMsContact already adds system entry
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

// ─── Lead Config (Quelle-Optionen) ──────────────────────────────────
async function saveLeadConfig() {
  savingConfig.value = true;
  try {
    const { data } = await api.put('/api/leads/config', {
      quelleOptions: leadConfig.value.quelleOptions,
      currencies: [],
    });
    leadConfig.value = data;
  } catch (e) {
    console.error('Failed to save lead config', e);
  } finally {
    savingConfig.value = false;
  }
}

function addQuelleOption() {
  const label = newQuelleLabel.value.trim();
  if (!label) return;
  const value = label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!value) return;
  if (leadConfig.value.quelleOptions.some(o => o.value === value)) return;
  leadConfig.value.quelleOptions.push({ label, value });
  newQuelleLabel.value = '';
  saveLeadConfig();
}

function removeQuelleOption(idx) {
  leadConfig.value.quelleOptions.splice(idx, 1);
  saveLeadConfig();
}

function startEditQuelle(idx) {
  editingQuelleIdx.value = idx;
  editingQuelleLabel.value = leadConfig.value.quelleOptions[idx].label;
}

function saveEditQuelle(idx) {
  const label = editingQuelleLabel.value.trim();
  if (label) leadConfig.value.quelleOptions[idx].label = label;
  editingQuelleIdx.value = null;
  saveLeadConfig();
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
function openExpectedCloseDatePicker() {
  const input = expectedCloseDateInput.value;
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
    return;
  }
  input.focus();
}

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
  if (!q) return '—';
  return leadConfig.value.quelleOptions.find(o => o.value === q)?.label || q;
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
    address: 'Adresse',
  })[t] || t;
}

// ─── Address modal ───────────────────────────────────────────────────
function addressMapsUrl(addr) {
  if (!addr) return null;
  const parts = [addr.street, addr.zip, addr.city, addr.country].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

function openAddressModal(key) {
  addressModalKey.value = key;
  const existing = detailForm.customFields[key] || {};
  addressDraft.street  = existing.street  || '';
  addressDraft.city    = existing.city    || '';
  addressDraft.zip     = existing.zip     || '';
  addressDraft.country = existing.country || '';
  showAddressModal.value = true;
}

function closeAddressModal() {
  showAddressModal.value = false;
}

function saveAddress() {
  detailForm.customFields[addressModalKey.value] = { ...addressDraft };
  saveDetail();
  closeAddressModal();
}

// ─── Aktivitäten ─────────────────────────────────────────────────────────────────────────────────

const AKT_TYPES = [
  { value: 'anruf',       label: 'Anruf',       icon: ['fas', 'phone'] },
  { value: 'meeting',     label: 'Meeting',     icon: ['fas', 'users'] },
  { value: 'aufgabe',     label: 'Aufgabe',     icon: ['fas', 'circle-check'] },
  { value: 'frist',       label: 'Frist',       icon: ['fas', 'flag'] },
  { value: 'email',       label: 'E-Mail',      icon: ['fas', 'envelope'] },
  { value: 'mittagessen', label: 'Mittagessen', icon: ['fas', 'utensils'] },
  { value: 'event',       label: 'Event',       icon: ['fas', 'calendar-days'] },
];

const showAktForm = ref(false);
const savingAkt = ref(false);
const aktForm = reactive({ type: 'anruf', titel: '', date: '', timeHour: '', timeMin: '00', kontaktId: '' });
const aktTimeManual = ref(false);

const leadAktivitaeten = computed(() => {
  const list = (selectedLead.value?.aktivitaeten || []).slice();
  const pending = list.filter(a => !a.erledigt).sort((a, b) => new Date(a.datum) - new Date(b.datum));
  const done    = list.filter(a =>  a.erledigt).sort((a, b) => new Date(b.datum) - new Date(a.datum));
  return [...pending, ...done];
});

function openAktForm() {
  const now = new Date();
  aktForm.type = 'anruf';
  aktForm.titel = '';
  aktForm.date = now.toISOString().slice(0, 10);
  aktForm.timeHour = String(now.getHours());
  aktForm.timeMin = String(Math.round(now.getMinutes() / 15) * 15 % 60).padStart(2, '0');
  aktForm.kontaktId = '';
  aktTimeManual.value = false;
  asanaView.mode = null;
  asanaView.enabled = true;
  asanaView.result = null;
  asanaView.error = null;
  showAktForm.value = true;
}

async function saveAkt() {
  if (!selectedLead.value || !aktForm.date) return;
  savingAkt.value = true;
  try {
    const timeStr = aktForm.timeHour !== '' ? `${String(aktForm.timeHour).padStart(2,'0')}:${aktForm.timeMin || '00'}` : '';
    const datumStr = timeStr ? `${aktForm.date}T${timeStr}` : aktForm.date;
    const linked = aktForm.kontaktId ? leadContacts.value.find(c => c.id === aktForm.kontaktId) : null;
    const payload = {
      type: aktForm.type,
      titel: aktForm.titel.trim(),
      datum: new Date(datumStr).toISOString(),
      kontakt: linked ? { id: linked.id, displayName: linked.displayName, email: linked.email } : {},
    };
    const { data } = await api.post(`/api/leads/${selectedLead.value._id}/aktivitaeten`, payload);
    if (!selectedLead.value.aktivitaeten) selectedLead.value.aktivitaeten = [];
    selectedLead.value.aktivitaeten.push(data);
    if (asanaView.enabled) {
      const aktId = data._id;
      submitAsanaTask('create', aktId).then(result => {
        if (result?.gid) {
          const akt = selectedLead.value.aktivitaeten.find(a => a._id === aktId);
          if (akt) {
            akt.asanaTaskGid = result.gid;
            akt.asanaTaskUrl = result.url || null;
          }
        }
      }).catch(e => console.error('Asana Task Fehler', e));
    }
    showAktForm.value = false;
  } catch (e) {
    console.error('Aktivität speichern fehlgeschlagen', e);
  } finally {
    savingAkt.value = false;
  }
}

async function toggleAktErledigt(akt) {
  const newVal = !akt.erledigt;
  akt.erledigt = newVal;
  try {
    const { data } = await api.patch(
      `/api/leads/${selectedLead.value._id}/aktivitaeten/${akt._id}`,
      { erledigt: newVal }
    );
    Object.assign(akt, data);
  } catch (e) {
    akt.erledigt = !newVal;
    console.error('Aktivität aktualisieren fehlgeschlagen', e);
  }
}

async function deleteAkt(akt) {
  if (!confirm('Aktivität löschen?')) return;
  try {
    await api.delete(`/api/leads/${selectedLead.value._id}/aktivitaeten/${akt._id}`);
    const idx = selectedLead.value.aktivitaeten.findIndex(a => a._id === akt._id);
    if (idx >= 0) selectedLead.value.aktivitaeten.splice(idx, 1);
  } catch (e) {
    console.error('Aktivität löschen fehlgeschlagen', e);
  }
}

const editingAktId = ref(null);
const editAktForm = reactive({ type: 'aufgabe', titel: '', date: '', timeHour: '', timeMin: '00', kontaktId: '' });
const editAktTimeManual = ref(false);

function openEditAkt(akt) {
  editingAktId.value = akt._id;
  const d = new Date(akt.datum);
  editAktForm.type = akt.type || 'aufgabe';
  editAktForm.titel = akt.titel || '';
  editAktForm.date = d.toISOString().slice(0, 10);
  editAktForm.timeHour = String(d.getHours());
  editAktForm.timeMin = String(d.getMinutes()).padStart(2, '0');
  editAktForm.kontaktId = akt.kontakt?.id || '';
  editAktTimeManual.value = false;
  asanaView.mode = null;
  asanaView.enabled = true;
  asanaView.result = null;
  asanaView.error = null;
}

async function saveEditAkt(akt) {
  if (!editAktForm.date) return;
  savingAkt.value = true;
  try {
    const timeStr = editAktForm.timeHour !== '' ? `${String(editAktForm.timeHour).padStart(2,'0')}:${editAktForm.timeMin || '00'}` : '';
    const datumStr = timeStr ? `${editAktForm.date}T${timeStr}` : editAktForm.date;
    const linked = editAktForm.kontaktId ? leadContacts.value.find(c => c.id === editAktForm.kontaktId) : null;
    const payload = {
      type: editAktForm.type,
      titel: editAktForm.titel.trim(),
      datum: new Date(datumStr).toISOString(),
      kontakt: linked ? { id: linked.id, displayName: linked.displayName, email: linked.email } : {},
    };
    const { data } = await api.patch(`/api/leads/${selectedLead.value._id}/aktivitaeten/${akt._id}`, payload);
    Object.assign(akt, data);
    if (asanaView.enabled) {
      submitAsanaTask('edit', akt._id).then(result => {
        if (result?.gid) {
          akt.asanaTaskGid = result.gid;
          akt.asanaTaskUrl = result.url || null;
        }
      }).catch(e => console.error('Asana Task Fehler', e));
    }
    editingAktId.value = null;
  } catch (e) {
    console.error('Aktivität bearbeiten fehlgeschlagen', e);
  } finally {
    savingAkt.value = false;
  }
}

function isOverdue(akt) {
  return !akt.erledigt && new Date(akt.datum) < new Date();
}

function applyManualTime(form, val) {
  if (!val) return;
  const [h, m] = val.split(':');
  form.timeHour = String(parseInt(h, 10));
  form.timeMin = m || '00';
}

function aktTypeLabel(type) {
  return AKT_TYPES.find(t => t.value === type)?.label || type;
}

function aktTypeIcon(type) {
  return AKT_TYPES.find(t => t.value === type)?.icon || ['fas', 'circle-check'];
}

function formatAktDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

// ─── Asana Sales Task ─────────────────────────────────────────────────────────
const asanaView = reactive({
  mode:   null,  // null | 'create' | 'edit'
  enabled: true,  // whether to create an Asana task on save
  titel:  '',
  datum:  '',
  notes:  '',
  sending: false,
  result: null,
  error:  null,
});

function toggleAsanaView(mode) {
  if (!mode || asanaView.mode === mode) {
    asanaView.mode = null;
    asanaView.result = null;
    asanaView.error = null;
    return;
  }
  asanaView.mode  = mode;
  asanaView.enabled = true;
  asanaView.result = null;
  asanaView.error  = null;

  const form = mode === 'create' ? aktForm : editAktForm;
  asanaView.titel = form.titel || aktTypeLabel(form.type);

  const timeStr = form.timeHour !== ''
    ? `${String(form.timeHour).padStart(2, '0')}:${form.timeMin || '00'}`
    : '';
  const datumStr = timeStr ? `${form.date}T${timeStr}` : form.date;
  asanaView.datum = datumStr ? new Date(datumStr).toISOString() : '';

  const lines = [];
  lines.push(`Aktivitätstyp: ${aktTypeLabel(form.type)}`);
  if (selectedLead.value?.title) lines.push(`Lead: ${selectedLead.value.title}`);
  const linked = form.kontaktId ? leadContacts.value.find(c => c.id === form.kontaktId) : null;
  if (linked) lines.push(`Kontakt: ${linked.displayName}${linked.email ? ` (${linked.email})` : ''}`);
  asanaView.notes = lines.join('\n');
}

async function submitAsanaTask(mode, aktId = null) {
  if (!selectedLead.value) return null;
  asanaView.sending = true;
  asanaView.error   = null;
  try {
    const form   = mode === 'create' ? aktForm : editAktForm;
    const linked = form.kontaktId ? leadContacts.value.find(c => c.id === form.kontaktId) : null;
    const timeStr = form.timeHour !== '' ? `${String(form.timeHour).padStart(2, '0')}:${form.timeMin || '00'}` : '';
    const datumStr = timeStr ? `${form.date}T${timeStr}` : form.date;
    const titel = form.titel?.trim() || aktTypeLabel(form.type);
    const datum = datumStr ? new Date(datumStr).toISOString() : '';
    const { data } = await api.post(`/api/leads/${selectedLead.value._id}/asana-sales-task`, {
      titel,
      datum,
      type:    form.type,
      kontakt: linked ? { displayName: linked.displayName, email: linked.email } : {},
      aktId:   aktId || null,
    });
    asanaView.result = data;
    return data;
  } catch (e) {
    asanaView.error = e.response?.data?.message || 'Asana Task konnte nicht erstellt werden.';
    return null;
  } finally {
    asanaView.sending = false;
  }
}

// ─── Dateien / Attachments ──────────────────────────────────────────────────
const attachInput = ref(null);
const attachUploading = ref(false);
const attachProgress = ref(0);
const attachDragOver = ref(false);

async function uploadAttachments(files) {
  if (!files || files.length === 0) return;
  if (!selectedLead.value) return;
  attachUploading.value = true;
  attachProgress.value = 0;
  try {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    const { data } = await api.post(
      `/api/leads/${selectedLead.value._id}/attachments`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) attachProgress.value = Math.round((e.loaded / e.total) * 100);
        },
      }
    );
    if (!selectedLead.value.attachments) selectedLead.value.attachments = [];
    selectedLead.value.attachments = data;
    const idx = leads.value.findIndex(l => l._id === selectedLead.value._id);
    if (idx >= 0) leads.value[idx].attachments = data;
  } finally {
    attachUploading.value = false;
    attachProgress.value = 0;
    if (attachInput.value) attachInput.value.value = '';
  }
}

function onAttachFileChange(e) {
  uploadAttachments(Array.from(e.target.files || []));
}

function onAttachDrop(e) {
  attachDragOver.value = false;
  uploadAttachments(Array.from(e.dataTransfer.files || []));
}

async function downloadAttachment(att) {
  const { data } = await api.get(`/api/leads/${selectedLead.value._id}/attachments/${att.id}/url`);
  window.open(data.url, '_blank', 'noopener,noreferrer');
}

function isPreviewable(att) {
  return att.contentType === 'application/pdf' || att.contentType?.startsWith('image/');
}

async function openAttachment(att) {
  const { data } = await api.get(`/api/leads/${selectedLead.value._id}/attachments/${att.id}/url?inline=true`);
  window.open(data.url, '_blank', 'noopener,noreferrer');
}

async function deleteAttachment(att) {
  if (!confirm(`Datei „${att.filename}" löschen?`)) return;
  await api.delete(`/api/leads/${selectedLead.value._id}/attachments/${att.id}`);
  selectedLead.value.attachments = (selectedLead.value.attachments || []).filter(a => a.id !== att.id);
  const idx = leads.value.findIndex(l => l._id === selectedLead.value._id);
  if (idx >= 0) leads.value[idx].attachments = selectedLead.value.attachments;
}

function attachIcon(contentType) {
  if (!contentType) return ['fas', 'file'];
  if (contentType === 'application/pdf') return ['fas', 'file-pdf'];
  if (contentType.startsWith('image/')) return ['fas', 'file-image'];
  if (contentType.includes('word') || contentType.includes('document')) return ['fas', 'file-word'];
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return ['fas', 'file-excel'];
  if (contentType.includes('zip') || contentType.includes('archive')) return ['fas', 'file-zipper'];
  return ['fas', 'file'];
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Close sidebar with ESC
function handleEsc(e) {
  if (e.key === 'Escape') {
    if (showAddressModal.value) { closeAddressModal(); return; }
    if (showCreateModal.value) showCreateModal.value = false;
    else if (showFieldManager.value) showFieldManager.value = false;
    else if (selectedLead.value) closeSidebar();
  }
}
onMounted(() => {
  document.addEventListener('keydown', handleEsc);
  window.addEventListener('resize', onResizeMobile);
});
import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEsc);
  window.removeEventListener('resize', onResizeMobile);
});
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
  padding: 24px 24px 24px 24px;
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

  &.active {
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in oklab, var(--primary) 10%, transparent);
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

  .col-fav {
    width: 36px;
    text-align: center;
  }

  .btn-fav {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 13px;
    padding: 2px;
    flex-shrink: 0;
    transition: color 0.15s, transform 0.15s;

    &.active {
      color: var(--primary);
    }

    &:hover {
      color: var(--primary);
      transform: scale(1.2);
    }
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

.row-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
}

.row-menu {
  position: absolute;
  background: var(--modal-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 160px;
  padding: 4px 0;
  z-index: 9001;
  transform: translateX(-100%);
}

.row-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  padding: 8px 14px;
  font-size: 0.85rem;
  color: var(--text);
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--hover);
  }

  &--danger {
    color: #ef4444;
    &:hover { background: #fef2f2; }
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

    .sidebar-status {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .sidebar-owner {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.2;

      svg {
        flex: 0 0 auto;
        font-size: 0.75rem;
      }
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px 16px;

    &:hover {
      color: var(--text);
    }
  }

  .btn-archive {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 8px;

    &:hover { color: #ef4444; }
    &:disabled { opacity: 0.4; cursor: default; }
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

.url-open-btn {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  font-size: 0.75rem;
  color: var(--primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
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
  gap: 0;
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
  gap: 10px;
  align-items: flex-start;
  position: relative;
  padding-top: 6px;

  /* extend the timeline line into compose */
  &::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 0;
    bottom: 50%;
    width: 1px;
    background: var(--border);
  }

  .compose-dot {
    width: 22px;
    min-width: 22px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 3px;
    position: relative;
    z-index: 1;

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

  .compose-input-wrap {
    flex: 1;
    display: flex;
    gap: 8px;
    align-items: stretch;

    .note-textarea {
      flex: 1;
      resize: vertical;
    }
  }

  .compose-send-btn {
    flex-shrink: 0;
    align-self: stretch;
    height: auto;
    min-width: 56px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* Drawer-specific overrides: wider textarea, slim height, sticky at bottom */
.chronik-compose--drawer {
  position: sticky;
  bottom: -12px; // counter .cd-body's 12px bottom padding so it pins flush
  z-index: 2;
  background: var(--tile-bg);
  margin-top: 0;
  padding-top: 8px;
  padding-bottom: 12px;

  /* Extend the timeline path line up into the gap above the compose dot */
  &::before {
    top: -8px !important;
    bottom: 50% !important;
  }

  .compose-input-wrap {
    width: 100%;
  }

  .note-textarea {
    width: 100%;
    min-height: 36px;
    padding: 8px 12px;
    font-size: 0.9rem;
    resize: vertical;
  }

  .compose-send-btn {
    min-width: 56px;
    padding: 0 14px;
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
    bottom: 0;
    width: 1px;
    background: var(--border);
  }
}

/* Jetzt-Divider */
.chronik-divider-now {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  position: relative;
  z-index: 1;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--primary);
    opacity: 0.5;
  }
}

.chronik-divider-label {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary);
  background: var(--tile-bg);
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid var(--primary);
  opacity: 0.85;
}

/* Activity entries in chronik */
.chronik-entry--akt {
  opacity: 1;

  .chronik-dot {
    padding-top: 2px;
  }
}

.chronik-entry--akt-done {
  opacity: 0.55;

  .chronik-text { text-decoration: line-through; }
}

.chronik-entry--akt-overdue {
  .chronik-meta { color: #ef4444; }
}

.chronik-akt-check {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 0.85rem;
  transition: color 0.15s;

  &:hover { color: var(--primary); }

  .chronik-entry--akt-done & { color: var(--primary); }
}

.chronik-akt-type-icon {
  font-size: 0.7rem;
  color: var(--primary);
  opacity: 0.8;
}

.chronik-akt-type-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--primary);
  opacity: 0.85;
}

.chronik-akt-kontakt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--muted);
  margin-top: 2px;
}

.chronik-text--done {
  text-decoration: line-through;
  opacity: 0.7;
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

  .ctx-delete-btn {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.15s;
    background: var(--panel);
    border-radius: 4px;
  }

  &:hover .ctx-delete-btn {
    opacity: 1;
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
    font-size: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
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

.ctx-delete-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;

  &:hover { color: #ef4444; }
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

/* Field manager — label cards */
.label-card-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.label-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  padding: 10px 14px;
}

.label-card-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.label-card-name {
  font-size: 0.88rem;
  font-weight: 600;
  min-width: 0;
}

.label-card-type {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--panel);
  color: var(--muted);
  border: 1px solid var(--border);
}

.label-card-opts {
  font-size: 0.75rem;
  color: var(--muted);
}

.label-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.label-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 12px;
  font-size: 0.75rem;
  cursor: pointer;
  border: 1px solid var(--border);
  color: var(--muted);
  user-select: none;

  input[type="checkbox"] { display: none; }

  &.active {
    border-color: var(--primary);
    color: var(--primary);
  }
}

.label-edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-edit-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.82rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  &:hover { background: var(--hover); }
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

/* ── Lead Config editor ─────────────────────────────────────────── */
.config-section {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);

  & + .config-section { margin-top: 10px; }
}

.config-section-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 10px;
}

.config-option-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  min-height: 34px;

  .config-opt-label {
    flex: 1;
    font-size: 0.85rem;
  }

  .config-value-hint {
    font-size: 0.75rem;
    color: var(--muted);
    font-family: monospace;
    margin-right: 4px;
  }

  .form-input--sm {
    flex: 1;
    font-size: 0.85rem;
    padding: 3px 8px;
    height: 28px;
  }

  .btn-sm {
    padding: 3px 10px;
    font-size: 0.8rem;
    height: 28px;
  }
}

.config-option-list--inline {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
}

.config-currency-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 3px 10px 3px 12px;
  font-size: 0.82rem;
  font-weight: 600;

  .chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    padding: 0;
    font-size: 0.7rem;
    display: flex;
    align-items: center;

    &:hover { color: #ef4444; }
  }
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-open-kontakt-modal {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
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

.ms-logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.ms-logo-grid span {
  display: block;
  border-radius: 1px;
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
  background: var(--tile-bg);
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
    color: var(--muted);
  }
}

.no-results {
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
  padding: 8px 0;
}

.linked-contact-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--primary) 16%, var(--tile-bg));
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  border-radius: 6px;
  margin-bottom: 10px;

  .chip-icon { color: #0078d4; font-size: 1.1rem; flex-shrink: 0; }

  .chip-info {
    display: flex;
    flex-direction: column;
    flex: 1;

    strong { font-size: 0.875rem; color: var(--text); }
    span   { font-size: 0.78rem;  color: var(--muted); }
  }

  .chip-remove {
    background: transparent;
    border: none;
    color: var(--muted);
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

.skip-hint {
  padding: 12px 14px;
  font-size: 0.82rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 8px;
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
  display: flex;
  gap: 6px;
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
  flex: 1;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 6%, transparent);
  }
}

.btn-add-contact--new {
  flex: 0 0 auto;
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

/* ── Address field preview & modal ─────────────────────────────── */
.address-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text);
  min-height: 36px;

  &:hover {
    border-color: var(--primary);
  }

  .address-edit-icon {
    color: var(--muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }
}

.address-placeholder {
  color: var(--muted);
  font-style: italic;
}

.address-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.address-maps-btn {
  display: inline-flex;
  align-items: center;
  color: var(--primary);
  font-size: 0.75rem;
  text-decoration: none;
  padding: 2px 4px;
  border-radius: 4px;

  &:hover {
    background: color-mix(in oklab, var(--primary) 12%, transparent);
  }
}

.address-modal {
  max-width: 400px;
}

.addr-modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--primary) 15%, transparent);
  color: var(--primary);
  font-size: 0.8rem;
}

.addr-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 20px 8px;
}

.addr-row {
  display: flex;
  gap: 12px;
}

.addr-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;

  &--full { flex: none; width: 100%; }
}

.addr-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.addr-input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;

  &::placeholder { color: var(--muted); opacity: 0.6; }
  &:focus { border-color: var(--primary); background: var(--tile-bg); }
}

/* ── Column customizer panel ───────────────────────────────────── */
.col-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
}

.col-panel {
  position: fixed;
  background: var(--modal-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.14);
  min-width: 220px;
  padding: 4px 0;
  z-index: 9001;
}

.col-panel-header {
  padding: 8px 14px 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.col-panel-empty {
  padding: 10px 14px;
  font-size: 0.82rem;
  color: var(--muted);
}

.col-panel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px 6px 14px;
  gap: 10px;

  &:hover { background: var(--hover); }
}

.col-panel-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  flex: 1;

  input[type="checkbox"] {
    accent-color: var(--primary);
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
}

.col-panel-order {
  display: flex;
  gap: 2px;
}

.col-order-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

/* ── Aktivitäten ─────────────────────────────────────────────────── */

.akt-form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px;
  padding-right: 38px; // room for Asana corner button
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--hover);
}

.btn-asana-corner {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, border-color 0.15s, background 0.15s;

  &:hover { color: #f06a6a; border-color: rgba(240, 106, 106, 0.4); }
  &.active { color: #f06a6a; border-color: #f06a6a; background: rgba(240, 106, 106, 0.08); }
}

.btn-save-wrap {
  position: relative;
  display: inline-flex;

  .btn { padding-right: 28px; }
}

.btn-asana-badge {
  position: absolute;
  top: -9px;
  right: -9px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  background: var(--tile-bg);
  color: #bbb;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  z-index: 1;

  svg { width: 11px; height: 11px; }

  &:hover { color: #d08080; border-color: #d9b0b0; background: #fdf5f5; }
  &.active {
    color: #e07070;
    border-color: #e09090;
    background: #fdeaea;
  }
}

.asana-logo-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;

  &--lg { width: 18px; height: 18px; }
}

.asana-task-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asana-view-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #f06a6a;
  margin-bottom: 2px;
}

.asana-view-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.asana-view-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.asana-view-value {
  font-size: 0.85rem;
  color: var(--text);
}

.asana-notes-area {
  resize: vertical;
  min-height: 64px;
  font-size: 0.82rem;
}

.asana-view-result {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #10b981;
  padding: 6px 8px;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 5px;

  a { color: #10b981; font-weight: 600; text-decoration: underline; }
}

.asana-view-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #ef4444;
  padding: 6px 8px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 5px;
}

.akt-type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.akt-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--tile-bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.78rem;
  transition: all 0.15s;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: transparent;
  }
  &:hover:not(.active) { background: var(--hover); color: var(--text); }
}

.akt-date-label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--tile-bg);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s;

  &:hover { border-color: var(--primary); }
}

.akt-date-icon {
  color: var(--primary);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.akt-date-text {
  font-size: 0.85rem;
  color: var(--text);
  flex: 1;
}

.akt-date-hidden {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}



.akt-datetime-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.akt-time-picker {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.akt-time-hour {
  width: 52px;
  text-align: center;
  padding-left: 6px;
  padding-right: 4px;
  flex-shrink: 0;

  // hide browser spinner arrows
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  appearance: textfield;
  -moz-appearance: textfield;
}

.akt-min-btns {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.akt-min-btn {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 5px;
  transition: background 0.12s, border-color 0.12s, color 0.12s;

  &:hover { background: var(--hover); }
  &.active { background: transparent; border-color: var(--primary); color: var(--primary); }
}

.akt-time-result {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px dashed var(--border);
  white-space: nowrap;
  transition: border-color 0.12s, color 0.12s;

  &:hover { border-color: var(--primary); color: var(--primary); }
}

.akt-time-override {
  width: 88px;
  flex-shrink: 0;
}

.akt-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.akt-empty {
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
  padding: 12px 0;
}

.akt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.akt-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  transition: opacity 0.2s;

  &--done {
    opacity: 0.5;
    .akt-titel { text-decoration: line-through; }
  }

  &--overdue:not(.akt-item--done) {
    border-color: rgba(239, 68, 68, 0.4);
    .akt-date { color: #ef4444; }
  }
}

.akt-check {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 2px;
  font-size: 1.05rem;
  flex-shrink: 0;
  margin-top: 1px;
  transition: color 0.15s;

  &.done { color: #10b981; }
  &:hover { color: var(--primary); }
}

.akt-info {
  flex: 1;
  min-width: 0;
}

.akt-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.akt-type-icon {
  color: var(--muted);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.akt-titel {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.akt-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--muted);
  align-items: center;
}

.akt-contact {
  display: flex;
  align-items: center;
  gap: 4px;
}

.akt-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;

  .akt-item:hover & { opacity: 1; }
}

.akt-edit,
.akt-delete {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.72rem;
  transition: color 0.15s, background 0.15s;

  &:hover { background: var(--hover); }
}

.akt-edit:hover { color: var(--primary); }
.akt-delete:hover { color: #ef4444; }

.akt-asana-link {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 5px;
  border-radius: 4px;
  color: #e07070;
  transition: color 0.15s, background 0.15s;

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  &:hover { background: var(--hover); color: #c05050; }
}

/* ── Dateien / Attachments ──────────────────────────────────────── */
.section-count {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  background: var(--primary);
  color: #fff;
  border-radius: 10px;
  padding: 1px 7px;
}

.attach-upload-area {
  margin-bottom: 8px;
  border: 2px dashed transparent;
  border-radius: 8px;
  transition: border-color 0.15s, background 0.15s;

  &.attach-drag-over {
    border-color: var(--primary);
    background: rgba(251, 150, 51, 0.06);
  }
}

.attach-file-input {
  display: none;
}

.attach-progress {
  position: relative;
  height: 4px;
  background: var(--card-border, #e2e8f0);
  border-radius: 2px;
  margin-bottom: 10px;
  overflow: hidden;
}

.attach-progress-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--primary);
  transition: width 0.15s;
}

.attach-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attach-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  font-size: 13px;

  &:hover { background: var(--hover); }
}

.attach-icon {
  width: 18px;
  text-align: center;
  color: var(--primary);
  flex-shrink: 0;
}

.attach-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 500;
}

.attach-size {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.attach-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  padding: 3px 5px;
  border-radius: 4px;
  transition: color 0.15s;

  &:hover { color: var(--primary); }
  &.attach-btn--delete:hover { color: #ef4444; }
}

/* ─────────────────────────────────────────────────────────────
   Mobile (≤768px) — Leads Tab
   ───────────────────────────────────────────────────────────── */

/* Toolbar overflow */
.mobile-toolbar-overflow {
  position: relative;
  display: inline-flex;
}
.mobile-overflow-backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
  z-index: 1099;
}
.mobile-overflow-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: var(--panel, var(--tile-bg));
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  padding: 6px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &--sidebar {
    top: calc(100% + 4px);
  }
}
.mobile-overflow-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 12px;
  text-align: left;
  color: var(--text);
  font-size: 14px;
  border-radius: 6px;
  width: 100%;
  min-height: 44px;

  &:hover { background: var(--hover); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  svg { color: var(--muted); width: 16px; }
}

/* Stage filter chips */
.mobile-stage-chips {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  background: var(--tile-bg);
  border-bottom: 1px solid var(--border);

  &::-webkit-scrollbar { display: none; }
}
.mobile-stage-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  scroll-snap-align: start;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--panel, var(--tile-bg));
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  min-height: 36px;
  transition: all 0.15s;
  position: relative;
  padding-left: 22px;

  /* Stage color dot */
  &::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--muted);
  }

  &--neu::before          { background: #6366f1; }
  &--qualifiziert::before { background: #06b6d4; }
  &--angebot::before      { background: #f59e0b; }
  &--verhandlung::before  { background: #ea580c; }
  &--gewonnen::before     { background: #10b981; }
  &--verloren::before     { background: #ef4444; }

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: transparent;
  }
  &.is-active {
    border-color: var(--primary);
    color: var(--primary);
    background: transparent;
  }
}
.mobile-stage-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--hover);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;

  .mobile-stage-chip.active &,
  .mobile-stage-chip.is-active & {
    background: rgba(var(--primary-rgb, 234, 88, 12), 0.15);
    color: var(--primary);
  }
}

/* Group headers in mobile list */
.mobile-list-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 4px 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  position: sticky;
  top: 0;
  background: var(--bg, #0e0f12);
  z-index: 1;

  &:not(:first-child) {
    margin-top: 6px;
  }
}
.mobile-list-group-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--muted);

  &.stufe-neu          { background: #6366f1; }
  &.stufe-qualifiziert { background: #06b6d4; }
  &.stufe-angebot      { background: #f59e0b; }
  &.stufe-verhandlung  { background: #ea580c; }
  &.stufe-gewonnen     { background: #10b981; }
  &.stufe-verloren     { background: #ef4444; }
}
.mobile-list-group-label {
  flex: 1;
  color: var(--text);
}
.mobile-list-group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--hover);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

/* Stage-colored left border on mobile lead cards */
.mobile-lead-card {
  position: relative;
  border-left: 3px solid var(--border) !important;

  &--neu          { border-left-color: #6366f1 !important; }
  &--qualifiziert { border-left-color: #06b6d4 !important; }
  &--angebot      { border-left-color: #f59e0b !important; }
  &--verhandlung  { border-left-color: #ea580c !important; }
  &--gewonnen     { border-left-color: #10b981 !important; }
  &--verloren     { border-left-color: #ef4444 !important; }
}

/* Mobile vertical list */
.mobile-lead-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.mobile-lead-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.mobile-empty-stage {
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
}

/* FAB */
.mobile-fab {
  position: fixed;
  right: 18px;
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  border: none;
  box-shadow: 0 6px 16px rgba(0,0,0,0.25);
  font-size: 22px;
  cursor: pointer;
  z-index: 950;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;

  &:active { transform: scale(0.94); }
}

/* Mobile full-screen sidebar */
.detail-sidebar--mobile {
  position: fixed !important;
  inset: 0 !important;
  margin-left: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: 100vw !important;
  border-radius: 0 !important;
  border-left: none !important;
  z-index: 1100;
  overscroll-behavior: contain;

  .sidebar-body {
    -webkit-overflow-scrolling: touch;
  }
}

.mobile-back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text);
  padding: 8px 10px;
  margin-right: 4px;
  font-size: 18px;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;

  &:hover { background: var(--hover); }
}

.mobile-sidebar-overflow {
  position: relative;
  display: inline-flex;
}

/* Section accordion (mobile) */
.section-title--mobile-clickable {
  cursor: pointer;
  user-select: none;
  position: relative;
  padding-right: 28px;
  min-height: 44px;

  .section-chevron {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    font-size: 12px;
  }
}
.info-section.mobile-collapsed {
  > *:not(.section-title) {
    display: none !important;
  }
}

/* Inline chronik (mobile-only) */
.chronik-timeline--mobile {
  max-height: none;

  // dots must sit below the sticky compose bar
  .chronik-dot { z-index: 0; }
}
.chronik-compose--mobile {
  position: sticky;
  bottom: -12px; // pull below sidebar-body's padding-bottom (12px) so no gap stays visible
  background: var(--panel, var(--tile-bg));
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px)) 8px;
  margin: 0 -12px -12px; // extend into sidebar-body's horizontal & bottom padding
  border-top: 1px solid var(--border);
  gap: 8px;
  z-index: 5;

  // override base .chronik-inline-compose::before (timeline line stub at left:10px)
  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -16px;
    height: 16px;
    background: linear-gradient(to bottom, transparent, var(--panel, var(--tile-bg)));
    pointer-events: none;
  }
}

/* Row menu as bottom sheet on mobile */
.row-menu-overlay--mobile {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1200;
  display: flex;
  align-items: flex-end;
}
.row-menu--mobile {
  position: static !important;
  transform: none !important;
  width: 100%;
  max-width: 100vw;
  border-radius: 16px 16px 0 0 !important;
  padding: 12px !important;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
  box-shadow: 0 -6px 20px rgba(0,0,0,0.2);
  max-height: 70dvh;
  overflow-y: auto;
  animation: rowMenuSlideUp 0.2s ease-out;

  .row-menu-item {
    min-height: 48px;
    padding: 12px 14px;
    font-size: 15px;
  }
  .row-menu-header {
    padding: 8px 14px 10px;
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .row-menu-item--active {
    background: var(--hover);
  }
}
@keyframes rowMenuSlideUp {
  from { opacity: 0; margin-bottom: -40px; }
  to { opacity: 1; margin-bottom: 0; }
}

/* Mobile stage picker: reuse the desktop stepper inside the bottom sheet */
.mobile-stage-sheet {
  .stufe-stepper--mobile {
    padding: 12px 4px 16px;

    // line must align with dot centers: padding-top (12px) + dot radius (11px) − line half (1px)
    &::before {
      top: 22px;
    }

    .stufe-step { min-height: 56px; }
    .step-dot {
      width: 22px;
      height: 22px;
    }
    .step-label {
      font-size: 12px;
      margin-top: 6px;
    }
  }
}

/* General mobile rules */
@media (max-width: 768px) {
  .leads-tab .toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px;
  }

  /* iOS no-zoom: inputs ≥ 16px */
  .form-input,
  .form-select,
  .form-textarea,
  textarea,
  input[type="text"],
  input[type="email"],
  input[type="number"],
  input[type="tel"],
  input[type="search"],
  select {
    font-size: 16px !important;
  }

  /* KV-Grid stacks */
  .kv-grid {
    grid-template-columns: 1fr !important;
    gap: 8px;
  }

  /* Modal full-screen on mobile */
  .modal-content {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }
  .modal-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--tile-bg);
  }
  .modal-footer {
    position: sticky;
    bottom: 0;
    z-index: 10;
    background: var(--tile-bg);
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }

  /* Column-config panel as bottom sheet */
  .col-panel {
    position: fixed !important;
    inset: auto 0 0 0 !important;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    width: 100vw !important;
    max-width: 100vw !important;
    max-height: 80dvh;
    border-radius: 16px 16px 0 0 !important;
    overflow-y: auto;
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }

  /* Aktivitäten form */
  .akt-datetime-row {
    flex-direction: column;
    gap: 8px;
  }
  .akt-type-row {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap !important;
    padding-bottom: 4px;

    > * {
      scroll-snap-align: start;
      flex-shrink: 0;
    }
  }

  /* Sidebar body padding */
  .detail-sidebar--mobile .sidebar-body {
    padding: 12px !important;
  }
  .detail-sidebar--mobile .sidebar-header {
    padding: 10px 12px !important;
  }

  /* Reduce main-content padding so cards fit screen width */
  .leads-tab .main-content {
    padding: 0 !important;
    width: 100%;
    max-width: 100vw;
    min-width: 0;
    overflow-x: hidden;
  }
  .leads-tab {
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }

  /* Hide chronik bottom-drawer remnants (just in case) */
  .leads-tab :deep(.chronik-drawer) {
    display: none !important;
  }
}
</style>
