<template>
  <div class="auftraege-page" :class="{ 'sidebar-open': selectedEvent }">
    <div class="main-content">
    <FilterPanel v-model:expanded="filtersExpanded" title="Filter Optionen">
      <!-- Mobile search toggle in filter header -->
      <template #header-actions>
        <div class="filter-search-box" :class="{ 'search-expanded': searchExpanded }">
          <button class="filter-search-toggle" @click.stop="toggleSearchExpanded" type="button" title="Suche">
            <font-awesome-icon icon="fa-solid fa-magnifying-glass" />
          </button>
          <input 
            ref="searchInput"
            v-model="searchQuery" 
            type="text" 
            placeholder="Suchen..."
            @input="debouncedSearch"
            @keydown.escape="searchExpanded = false"
            @blur="handleSearchBlur"
            @click.stop
          />
        </div>
      </template>
          <!-- GeschSt Filter -->
          <FilterGroup label="Geschäftsstelle">
            <FilterChip
              :active="filters.geschSt === '1'"
              @click="setGeschStFilter('1')"
            >
              Berlin
            </FilterChip>
            <FilterChip
              :active="filters.geschSt === '2'"
              @click="setGeschStFilter('2')"
            >
              Hamburg
            </FilterChip>
            <FilterChip
              :active="filters.geschSt === '3'"
              @click="setGeschStFilter('3')"
            >
              Köln
            </FilterChip>
             <FilterChip
              :active="!filters.geschSt"
              @click="setGeschStFilter(null)"
            >
              Alle
            </FilterChip>
          </FilterGroup>

          <FilterDivider />

          <!-- Bediener Filter -->
          <FilterGroup label="Bediener">
            <FilterDropdown :has-value="filters.bediener.length > 0">
              <template #label>
                <span v-if="filters.bediener.length === 0">Alle Bediener</span>
                <span v-else>{{ filters.bediener.length }} ausgewählt</span>
              </template>
              
              <div v-if="filterOptions.bediener.length === 0" class="no-options">Keine Bediener gefunden</div>
              <label v-for="bed in filterOptions.bediener" :key="bed" class="dropdown-item">
                <input 
                  type="checkbox" 
                  :checked="filters.bediener.includes(bed)"
                  @change="toggleBedienerFilter(bed)"
                >
                <span class="label-text">{{ bed }}</span>
              </label>
            </FilterDropdown>
          </FilterGroup>

          <FilterDivider />

          <!-- Kunden Filter -->
          <FilterGroup label="Kunden">
            <FilterDropdown :has-value="filters.kunden.length > 0">
              <template #label>
                <span v-if="filters.kunden.length === 0">Alle Kunden</span>
                <span v-else>{{ filters.kunden.length }} ausgewählt</span>
              </template>
              
              <div v-if="filterOptions.kunden.length === 0" class="no-options">Keine Kunden gefunden</div>
              <label v-for="kunde in filterOptions.kunden" :key="kunde.kundenNr" class="dropdown-item">
                <input 
                  type="checkbox" 
                  :checked="filters.kunden.includes(kunde.kundenNr)"
                  @change="toggleKundeFilter(kunde.kundenNr)"
                >
                <span class="label-text">{{ kunde.kundName }}</span>
              </label>
            </FilterDropdown>
          </FilterGroup>

          <FilterDivider />
          
           <!-- Reset Button -->
          <FilterChip class="reset-chip" @click="resetAllFilters" title="Alle Filter zurücksetzen">
            <font-awesome-icon icon="fa-solid fa-rotate-left" />
            Zurücksetzen
          </FilterChip>

          <!-- Stand der Auftragsdaten -->
          <div v-if="dataStatus" class="data-status-badge" title="Stand der Daten (Zvoove Import)">
            <font-awesome-icon icon="fa-solid fa-clock" />
            <span>Stand: {{ formatDataStatus(dataStatus) }}</span>
          </div>
      </FilterPanel>

    <div class="calendar-navigation">
      <button class="nav-btn" @click="previousWeek">
        <span>← Vorherige Woche</span>
      </button>
      <div class="current-range">
        {{ formatDateRange(currentWeekStart, currentWeekEnd) }}
      </div>
      <button class="nav-btn" @click="nextWeek">
        <span>Nächste Woche →</span>
      </button>
      <button class="nav-btn today-btn" @click="goToToday">Heute</button>
      <label class="nav-btn calendar-btn" title="Zu Woche springen (Datum wählen)">
        <font-awesome-icon icon="fa-solid fa-calendar" />
        <input 
          ref="datePicker" 
          type="date" 
          class="hidden-date-input" 
          @change="handleDatePick"
          @input="handleDatePick"
        >
      </label>
    </div>

    <!-- Mobile View -->
    <div v-if="isMobile" class="mobile-calendar-view">
      <div class="mobile-nav">
        <button class="nav-btn-mobile" @click="prevDay">
          <font-awesome-icon icon="fa-solid fa-chevron-left" />
        </button>
        
        <label class="mobile-date-display" v-if="weekDays[mobileDayIndex]" title="Datum wählen">
          <span class="day-name">{{ weekDays[mobileDayIndex].name }}</span>
          <span class="day-date">{{ formatDayDate(weekDays[mobileDayIndex].date) }}</span>
          <input
            ref="mobileDatePicker"
            type="date"
            class="hidden-date-input"
            :value="mobileDatePickerValue"
            @change="jumpToDate"
            @input="jumpToDate"
          />
        </label>
        
        <button class="nav-btn-mobile" @click="nextDay">
            <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </button>
      </div>

      <div class="mobile-day-content" v-if="weekDays[mobileDayIndex]">
        <!-- Reuse existing methods -->
        <div class="day-stats" style="text-align: center; margin-bottom: 10px;">
          {{ getEventsForDay(weekDays[mobileDayIndex].date).length }} Aufträge • {{ getTotalPositionsForDay(weekDays[mobileDayIndex].date) }} Pos.
        </div>
        
        <div v-if="getEventsForDay(weekDays[mobileDayIndex].date).length === 0" class="empty-day-state">
            Keine Aufträge heute
        </div>
        
        <div 
          v-for="event in getEventsForDay(weekDays[mobileDayIndex].date)" 
          :key="event._id"
          class="event-card-mobile"
          :class="[getEventStatusClass(event), getBedarfClass(event)]"
          @click="selectEvent(event)"
        >
            <div class="event-header">
              <span v-if="event.auftStatus !== 2" class="event-status">{{ getStatusText(event.auftStatus) }}</span>
            </div>
            
            <div class="event-title-row">
              <div class="event-title">{{ event.eventTitel || 'Kein Titel' }}</div>
              <div v-if="event.labels && event.labels.length" class="event-labels">
                <span
                  v-for="label in event.labels"
                  :key="label._id"
                  class="event-label-chip"
                  :style="{ background: label.color + '33', borderColor: label.color, color: label.color }"
                >{{ label.name }}</span>
              </div>
            </div>

            <div class="event-shifts" v-if="getSchichtenForDay(event, weekDays[mobileDayIndex].date).length">
              <div
                v-for="s in getSchichtenForDay(event, weekDays[mobileDayIndex].date)"
                :key="s.id"
                class="shift-row"
              >
                <span class="shift-time">{{ s.uhrzeitVon || '?' }}{{ s.uhrzeitBis ? '–' + s.uhrzeitBis : '' }}</span>
                <span class="shift-name" v-if="s.bezeichnung">{{ s.bezeichnung }}</span>
                <span class="shift-pos">{{ s.besetzt }}/{{ s.bedarf }}</span>
              </div>
            </div>
        </div>
      </div>
    </div>

    <div v-else class="calendar-grid">
      <div class="calendar-header">
        <div class="kw-cell">KW</div>
        <div 
          v-for="day in weekDays" 
          :key="day.key" 
          class="day-header"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-name">{{ day.name }}</div>
          <div class="day-date">{{ formatDayDate(day.date) }}</div>
        </div>
      </div>

      <div v-if="loading" class="loading-body">
        <span>Lade Aufträge...</span>
      </div>

      <div v-else class="calendar-body">
        <div class="kw-cell kw-number">{{ currentKW }}</div>
        <div 
          v-for="day in weekDays" 
          :key="day.key" 
          class="day-column"
          :class="{ 'is-today': isToday(day.date) }"
        >
          <div class="day-stats">
            {{ getEventsForDay(day.date).length }} Aufträge • {{ getTotalPositionsForDay(day.date) }} Pos.
          </div>
          <div 
            v-for="event in getEventsForDay(day.date)" 
            :key="event._id"
            class="event-card"
            :class="[getEventStatusClass(event), getBedarfClass(event)]"
            @click="selectEvent(event)"
          >
            <div v-if="event.labels && event.labels.length" class="event-labels">
              <span
                v-for="label in event.labels"
                :key="label._id"
                class="event-label-chip"
                :style="{ background: label.color + '33', borderColor: label.color, color: label.color }"
              >{{ label.name }}</span>
            </div>
            <div class="event-title">{{ event.eventTitel || 'Kein Titel' }}</div>
            <div class="event-kunde">{{ event.kundeData?.kuerzel || event.kundeData?.kundName || '-' }}</div>
            <div class="event-einsaetze" v-if="event.einsaetzeCount">
              {{ event.einsaetzeCount }} Einsätze
            </div>
          </div>
        </div>
      </div>
    </div>
    </div><!-- End main-content -->

    <!-- Sidebar for Event Details -->
    <transition name="sidebar-slide">
      <div v-if="selectedEvent" class="detail-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title-area">
            <span v-if="selectedEvent.auftStatus !== 2" class="sidebar-status" :class="getEventStatusClass(selectedEvent)">{{ getStatusText(selectedEvent.auftStatus) }}</span>
            <h2>{{ selectedEvent.eventTitel || 'Auftrag Details' }}</h2>
          </div>
          <div class="sidebar-header-actions">
            <!-- Three-dots quick-actions menu -->
            <div class="qa-menu-wrap">
              <button class="qa-dots-btn" @click.stop="showQuickActions = !showQuickActions" title="Aktionen">
                <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
              </button>
              <transition name="qa-dropdown-fade">
                <div v-if="showQuickActions" class="qa-dropdown" @click.stop>
                  <button class="qa-dropdown-item" @click="openLabelDialog">
                    <font-awesome-icon icon="fa-solid fa-tag" />
                    Label verwalten
                  </button>
                  <button class="qa-dropdown-item" @click="openPseudoDialog">
                    <font-awesome-icon icon="fa-solid fa-user-plus" />
                    Pseudo-MA einplanen
                  </button>
                </div>
              </transition>
            </div>
            <button class="close-btn" @click="selectedEvent = null" title="Schließen (Esc)">×</button>
          </div>
        </div>

        <div class="sidebar-body">
          <!-- Compact Info Grid -->
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Auftrag</span>
              <span class="info-value">#{{ selectedEvent.auftragNr }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Kunde</span>
              <span class="info-value highlight">
                <a v-if="selectedEvent.kundeData" href="#" class="kunde-link" @click.prevent="openKundeCard(selectedEvent.kundeData)">{{ selectedEvent.kundeData.kundName || '-' }}</a>
                <template v-else>-</template>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Zeitraum</span>
              <span class="info-value">{{ formatDateRange(new Date(selectedEvent.vonDatum), new Date(selectedEvent.bisDatum)) }}</span>
            </div>
            <div class="info-item full-width">
              <span class="info-label">Adresse</span>
              <span class="info-value">
                <template v-if="selectedEvent.eventLocation">{{ selectedEvent.eventLocation }}<br></template>
                {{ selectedEvent.eventStrasse || '' }} {{ selectedEvent.eventPlz || '' }} {{ selectedEvent.eventOrt || '' }}
              </span>
            </div>
            <!-- Label badges -->
            <div v-if="selectedEvent.labels && selectedEvent.labels.length" class="info-item full-width">
              <span class="info-label">Labels</span>
              <div class="label-chips-row">
                <span
                  v-for="label in selectedEvent.labels"
                  :key="label._id"
                  class="label-chip"
                  :style="{ background: label.color + '22', borderColor: label.color, color: label.color }"
                >
                  {{ label.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Schichten Section -->
          <div class="schichten-section" v-if="Object.keys(preparedSchichten).length">
            <div class="section-header">
              <h3>Schichten</h3>
              <span class="section-count">{{ Object.keys(preparedSchichten).length }}</span>
            </div>
            
            <div class="schichten-list">
              <div 
                v-for="(schichtData, schichtId) in preparedSchichten" 
                :key="schichtId"
                class="schicht-card"
              >
                <!-- Schicht Header with Times & Bedarf -->
                <div class="schicht-header-compact">
                  <div class="schicht-time-info">
                    <span class="schicht-time" v-if="schichtData.meta.uhrzeitVon">
                      <font-awesome-icon icon="fa-solid fa-clock" />
                      {{ formatTime(schichtData.meta.uhrzeitVon) }}<template v-if="schichtData.meta.uhrzeitBis"> - {{ formatTime(schichtData.meta.uhrzeitBis) }}</template>
                    </span>
                    <span class="schicht-name" v-if="schichtData.meta.schichtBezeichnung">{{ schichtData.meta.schichtBezeichnung }}</span>
                  </div>
                  <div 
                    class="bedarf-badge" 
                    :class="schichtData.meta.bedarfMet ? 'met' : 'unmet'"
                    :title="`${schichtData.einsaetze.length} von ${schichtData.meta.bedarf || '?'} Mitarbeitern geplant`"
                  >
                    {{ schichtData.einsaetze.length }}/{{ schichtData.meta.bedarf || '?' }}
                  </div>
                </div>

                <!-- Schicht Meta Row (Treffpunkt, Ansprechpartner) -->
                <div class="schicht-meta" v-if="schichtData.meta.treffpunkt || schichtData.meta.ansprechpartnerName">
                  <span class="meta-item" v-if="schichtData.meta.treffpunkt">
                    <font-awesome-icon icon="fa-solid fa-location-dot" />
                    Treffpunkt: {{ formatTime(schichtData.meta.treffpunkt) }}
                  </span>
                  <span class="meta-item ansprechpartner" v-if="schichtData.meta.ansprechpartnerName">
                    <font-awesome-icon icon="fa-solid fa-user-tie" />
                    {{ schichtData.meta.ansprechpartnerName }}
                    <template v-if="schichtData.meta.ansprechpartnerTelefon">
                      <a :href="'tel:' + schichtData.meta.ansprechpartnerTelefon" class="contact-link">{{ schichtData.meta.ansprechpartnerTelefon }}</a>
                    </template>
                  </span>
                </div>

                <!-- Badges Row (Quali wenn gemeinsam) -->
                <div class="schicht-badges" v-if="getCommonQualifikation(schichtData.einsaetze)">
                  <span v-if="getCommonQualifikation(schichtData.einsaetze)" class="badge quali">
                    <font-awesome-icon icon="fa-solid fa-graduation-cap" />
                    {{ getCommonQualifikation(schichtData.einsaetze).designation }}
                  </span>
                </div>

                <!-- Mitarbeiter List (Compact) -->
                <div class="mitarbeiter-list">
                  <div 
                    v-for="einsatz in schichtData.einsaetze" 
                    :key="einsatz._id"
                    class="mitarbeiter-row"
                  >
                    <div class="ma-info">
                      <template v-if="einsatz.mitarbeiterData">
                        <a 
                          href="#" 
                          class="ma-name"
                          @click.prevent="openMitarbeiterCard(einsatz.mitarbeiterData)"
                        >
                          {{ einsatz.mitarbeiterData.vorname }} {{ einsatz.mitarbeiterData.nachname }}
                        </a>
                        <span v-if="isTeamleiter(einsatz.mitarbeiterData)" class="tl-tag">TL</span>
                        <button
                          v-for="doc in getDocsForMitarbeiter(einsatz.mitarbeiterData._id)"
                          :key="doc._id"
                          class="doc-icon-btn"
                          :title="doc.docType + (doc.datum ? ' — ' + formatDayDateFull(doc.datum) : '')"
                          @click.stop="openDocCard(doc)"
                        >
                          <img :src="doc.docType === 'Event-Bericht' ? eventreportImg : laufzettelImg" class="doc-icon-img" />
                        </button>
                        <span v-if="einsatz.isPseudo" class="pseudo-tag" title="Manuell eingeplant (Pseudo-Einsatz)">Pseudo</span>
                      </template>
                      <template v-else>
                        <span class="ma-placeholder">Personalnr: {{ einsatz.personalNr || '-' }}</span>
                        <span v-if="einsatz.isPseudo" class="pseudo-tag" title="Manuell eingeplant (Pseudo-Einsatz)">Pseudo</span>
                      </template>
                    </div>
                    <div class="ma-badges ma-badges--right">
                      <span v-if="einsatz.qualifikationData && !getCommonQualifikation(schichtData.einsaetze)" class="badge quali small">
                        {{ einsatz.qualifikationData.designation }}
                      </span>
                      <button
                        v-if="einsatz.isPseudo"
                        class="pseudo-remove-btn"
                        title="Pseudo-Einsatz entfernen"
                        @click.stop="removePseudoEinsatz(einsatz._id)"
                      >
                        <font-awesome-icon icon="fa-solid fa-times" />
                      </button>
                    </div>
                  </div>
                  
                  <!-- Empty State if no Mitarbeiter -->
                  <div v-if="schichtData.einsaetze.length === 0" class="no-mitarbeiter">
                    Keine Mitarbeiter geplant
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Einsätze State -->
          <div v-else class="no-einsaetze">
            <font-awesome-icon icon="fa-solid fa-calendar-xmark" />
            <span>Keine Schichten/Einsätze vorhanden</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- Sidebar Overlay for mobile only -->
    <div v-if="selectedEvent && isMobile" class="sidebar-overlay" @click="selectedEvent = null"></div>

    <!-- Kunden Card Modal -->
    <div v-if="selectedKunde" class="modal-overlay" @click.self="selectedKunde = null">
      <div class="modal-content modal-customer">
        <div class="modal-header">
          <h2>Kunden Details</h2>
          <button class="close-btn" @click="selectedKunde = null">×</button>
        </div>
        <div class="modal-body modal-customer-body">
          <CustomerCard
            v-if="fullKundeData"
            :kunde="fullKundeData"
            @close="selectedKunde = null"
          />
          <div v-else class="loading-employee">
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            <span>Lade Kunden...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mitarbeiter Card Modal -->
    <EmployeeCardModal
      :mitarbeiterId="selectedMitarbeiter?._id || (typeof selectedMitarbeiter === 'string' ? selectedMitarbeiter : null)"
      @close="selectedMitarbeiter = null"
    />

    <!-- ── Label Dialog ──────────────────────────────────────────────── -->
    <div v-if="showLabelDialog" class="modal-overlay" @click.self="showLabelDialog = false">
      <div class="modal-content modal-qa">
        <div class="modal-header">
          <h2><font-awesome-icon icon="fa-solid fa-tag" /> Label hinzufügen</h2>
          <button class="close-btn" @click="showLabelDialog = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Current Labels on this Auftrag -->
          <div class="qa-section" v-if="selectedEvent.labels && selectedEvent.labels.length">
            <div class="qa-section-label">Aktuelle Labels</div>
            <div class="label-chips-row">
              <span
                v-for="label in selectedEvent.labels"
                :key="label._id"
                class="label-chip label-chip--removable"
                :style="{ background: label.color + '22', borderColor: label.color, color: label.color }"
              >
                {{ label.name }}
                <button class="label-chip-remove" @click="removeLabel(label._id)" title="Entfernen">×</button>
              </span>
            </div>
          </div>

          <!-- Quick-add: Global labels -->
          <div class="qa-section" v-if="availableGlobalLabels.length">
            <div class="qa-section-label">Vorhandene Labels</div>
            <div class="label-chips-row">
              <span
                v-for="gl in availableGlobalLabels"
                :key="gl.name"
                class="label-chip label-chip--add"
                :style="{ background: gl.color + '22', borderColor: gl.color, color: gl.color }"
                @click="quickAddLabel(gl)"
              >
                + {{ gl.name }}
              </span>
            </div>
          </div>

          <!-- Create new label -->
          <div class="qa-section">
            <div class="qa-section-label">Neues Label</div>
            <div class="qa-form-row">
              <input
                v-model="newLabelName"
                class="qa-input"
                placeholder="Name (max. 20 Zeichen)"
                maxlength="20"
                @keyup.enter="saveLabel"
              />
              <span class="label-count">{{ newLabelName.length }}/20</span>
            </div>
            <div class="qa-form-row">
              <span class="qa-form-field-label">Farbe:</span>
              <div class="color-palette">
                <button
                  v-for="c in labelPresetColors"
                  :key="c"
                  class="color-swatch"
                  :class="{ active: newLabelColor === c }"
                  :style="{ background: c }"
                  @click="newLabelColor = c"
                  :title="c"
                />
              </div>
              <input type="color" v-model="newLabelColor" class="color-input-native" title="Benutzerdefinierte Farbe" />
            </div>
            <div class="qa-form-row">
              <button class="qa-submit-btn" :disabled="!newLabelName.trim() || labelSaving" @click="saveLabel">
                <font-awesome-icon v-if="labelSaving" icon="fa-solid fa-spinner" spin />
                <font-awesome-icon v-else icon="fa-solid fa-check" />
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Pseudo-MA Dialog ──────────────────────────────────────────── -->
    <div v-if="showPseudoDialog" class="modal-overlay" @click.self="showPseudoDialog = false">
      <div class="modal-content modal-qa">
        <div class="modal-header">
          <h2><font-awesome-icon icon="fa-solid fa-user-plus" /> Pseudo-Mitarbeiter einplanen</h2>
          <button class="close-btn" @click="showPseudoDialog = false">×</button>
        </div>
        <div class="modal-body">
          <!-- Schicht selector -->
          <div class="qa-section">
            <div class="qa-section-label">Schicht (optional)</div>
            <select v-model="pseudoSelectedSchicht" class="qa-select">
              <option :value="null">— Automatisch (erste Schicht) —</option>
              <option
                v-for="(schicht, key) in preparedSchichten"
                :key="key"
                :value="key === 'none' ? null : key"
              >
                {{ schicht.meta.schichtBezeichnung || ('Schicht ' + key) }}
                <template v-if="schicht.meta.uhrzeitVon"> · {{ schicht.meta.uhrzeitVon.substring(0,5) }}</template>
              </option>
            </select>
          </div>

          <!-- Mitarbeiter search -->
          <div class="qa-section">
            <div class="qa-section-label">Mitarbeiter suchen</div>
            <div class="qa-search-wrap">
              <input
                v-model="pseudoSearch"
                class="qa-input"
                placeholder="Name oder E-Mail..."
                @input="debouncedPseudoSearch"
              />
              <font-awesome-icon v-if="pseudoSearching" icon="fa-solid fa-spinner" spin class="qa-search-spin" />
            </div>
            <div v-if="pseudoSearchResults.length" class="qa-search-results">
              <div
                v-for="ma in pseudoSearchResults"
                :key="ma._id"
                class="qa-search-result"
                :class="{ 'selected': pseudoSelectedMas.some(m => m._id === ma._id) }"
                @click="togglePseudoMa(ma)"
              >
                <div class="qa-result-name">
                  <font-awesome-icon v-if="pseudoSelectedMas.some(m => m._id === ma._id)" icon="fa-solid fa-check" class="qa-result-check" />
                  {{ ma.vorname }} {{ ma.nachname }}
                </div>
                <div class="qa-result-sub">{{ ma.email }}</div>
              </div>
            </div>
            <div v-if="pseudoSelectedMas.length" class="qa-selected-chips">
              <div class="qa-chips-label">
                <font-awesome-icon icon="fa-solid fa-users" />
                {{ pseudoSelectedMas.length }} {{ pseudoSelectedMas.length === 1 ? 'Mitarbeiter' : 'Mitarbeiter' }} ausgewählt
              </div>
              <div class="qa-chips-list">
                <div v-for="ma in pseudoSelectedMas" :key="ma._id" class="qa-chip">
                  {{ ma.vorname }} {{ ma.nachname }}
                  <button class="qa-chip-remove" @click="togglePseudoMa(ma)">×</button>
                </div>
              </div>
            </div>
          </div>

          <div class="qa-section">
            <button class="qa-submit-btn" :disabled="!pseudoSelectedMas.length || pseudoSaving" @click="savePseudoEinsatz">
              <font-awesome-icon v-if="pseudoSaving" icon="fa-solid fa-spinner" spin />
              <font-awesome-icon v-else icon="fa-solid fa-check" />
              {{ pseudoSelectedMas.length > 1 ? `${pseudoSelectedMas.length} Mitarbeiter einplanen` : 'Einplanen' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Document Card Modal -->
    <div v-if="selectedDoc" class="modal-overlay" @click.self="selectedDoc = null">
      <div class="modal-content modal-customer">
        <div class="modal-body modal-document-body">
          <DocumentCard
            :doc="selectedDoc"
            @close="selectedDoc = null"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Add imports for icons used in mobile view
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faChevronLeft, faChevronRight, faUser, faLocationDot, faCalendar, faUserTie, faClock, faBriefcase, faGraduationCap, faCalendarXmark, faTag, faUserPlus, faTimes, faCheck, faSpinner, faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(faChevronLeft, faChevronRight, faUser, faLocationDot, faCalendar, faUserTie, faClock, faBriefcase, faGraduationCap, faCalendarXmark, faTag, faUserPlus, faTimes, faCheck, faSpinner, faEllipsisVertical);

import api from "../utils/api";
import { mapState } from 'pinia';
import { useAuth } from '../stores/auth';
import { useFlipAll } from '../stores/flipAll';
import { useUi } from '../stores/ui';
import { useTheme } from '../stores/theme';
import FilterPanel from '@/components/FilterPanel.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import FilterChip from '@/components/FilterChip.vue';
import FilterDivider from '@/components/FilterDivider.vue';
import FilterDropdown from '@/components/FilterDropdown.vue';
import EmployeeCardModal from '@/components/EmployeeCardModal.vue';
import CustomerCard from '@/components/CustomerCard.vue';
import DocumentCard from '@/components/DocumentCard.vue';
import laufzettelIcon from '@/assets/laufzettel.png';
import laufzettelDarkIcon from '@/assets/laufzettel-dark.png';
import eventreportIcon from '@/assets/eventreport.png';
import eventreportDarkIcon from '@/assets/eventreport-dark.png';


export default {
  name: "AuftraegePage",
  components: { FilterPanel, FilterGroup, FilterChip, FilterDivider, FilterDropdown, EmployeeCardModal, CustomerCard, DocumentCard },
  data() {
    // Load filter settings from sessionStorage or use defaults
    const savedFilters = sessionStorage.getItem('auftraege_filters');
    let filterDefaults = {
      geschSt: null,
      bediener: [],
      kunden: []
    };

    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        filterDefaults = { ...filterDefaults, ...parsed };
      } catch (e) {
        console.warn('Could not parse saved auftraege filters:', e);
      }
    }

    return {
      auftraege: [],
      loading: false,
      searchQuery: "",
      searchExpanded: false,
      currentWeekStart: null,
      selectedEvent: null,
      loadedMonths: new Set(), // Track which months we've loaded
      debounceTimer: null,
      
      // Filter State
      filtersExpanded: false,
      filterOptions: {
        bediener: [],
        kunden: []
      },
      filters: filterDefaults,
      isMobile: false,
      mobileDayIndex: 0,
      selectedMitarbeiter: null,
      selectedKunde: null,
      fullKundeData: null,
      preparedSchichten: {}, // Lazy loaded schichten data
      dataStatus: null, // Last import timestamp
      // ── Quick Actions ──────────────────────────────────────────────────────
      // Label dialog
      showLabelDialog: false,
      globalLabels: [], // All known labels for autocomplete
      newLabelName: '',
      newLabelColor: '#4f46e5',
      labelPresetColors: ['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#64748b'],
      labelSaving: false,
      // Pseudo-MA dialog
      showPseudoDialog: false,
      pseudoSearch: '',
      pseudoSearchResults: [],
      pseudoSearching: false,
      pseudoSearchTimer: null,
      pseudoSelectedMas: [],
      pseudoSelectedSchicht: null,
      pseudoSaving: false,
      // Three-dots dropdown
      showQuickActions: false,
      // Document icons
      auftragDocs: [],
      selectedDoc: null,
    };
  },
  computed: {
    ...mapState(useAuth, ['user']),
    ...mapState(useUi, { isUiOpen: 'isOpen' }),
    ...mapState(useTheme, ['isDark']),
    laufzettelImg() { return this.isDark ? laufzettelDarkIcon : laufzettelIcon; },
    eventreportImg() { return this.isDark ? eventreportDarkIcon : eventreportIcon; },
    currentWeekEnd() {
      if (!this.currentWeekStart) return null;
      const end = new Date(this.currentWeekStart);
      end.setDate(end.getDate() + 6);
      return end;
    },
    currentKW() {
      if (!this.currentWeekStart) return '';
      return this.getWeekNumber(this.currentWeekStart);
    },
    mobileDatePickerValue() {
      const d = this.weekDays[this.mobileDayIndex]?.date;
      if (!d) return '';
      return d.toISOString().slice(0, 10);
    },
    weekDays() {
      if (!this.currentWeekStart) return [];
      const days = [];
      const dayNames = ['MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG', 'SONNTAG'];
      for (let i = 0; i < 7; i++) {
        const date = new Date(this.currentWeekStart);
        date.setDate(date.getDate() + i);
        days.push({
          key: i,
          name: dayNames[i],
          date: date
        });
      }
      return days;
    },
    filteredAuftraege() {
      if (!this.searchQuery.trim()) return this.auftraege;
      const q = this.searchQuery.toLowerCase();
      return this.auftraege.filter(a => 
        (a.eventTitel && a.eventTitel.toLowerCase().includes(q)) ||
        (a.eventOrt && a.eventOrt.toLowerCase().includes(q)) ||
        (a.kundeData?.kundName && a.kundeData.kundName.toLowerCase().includes(q)) ||
        (a.auftragNr && String(a.auftragNr).includes(q)) ||
        (a.mitarbeiterNames && a.mitarbeiterNames.some(name => name.toLowerCase().includes(q)))
      );
    },
    availableGlobalLabels() {
      if (!this.selectedEvent) return this.globalLabels;
      const existing = new Set((this.selectedEvent.labels || []).map(l => l.name.toLowerCase()));
      return this.globalLabels.filter(gl => !existing.has(gl.name.toLowerCase()));
    },
  },
  methods: {
    async fetchDataStatus() {
      try {
        const response = await api.get('/api/import/last-uploads');
        if (response.data.success) {
          const uploads = response.data.data;
          const lastKomplettImport = uploads['einsatz-komplett'];
          if (lastKomplettImport) {
            this.dataStatus = lastKomplettImport.timestamp;
          }
        }
      } catch (err) {
        console.error("Error fetching data status:", err);
      }
    },
    formatDataStatus(dateStr) {
       if (!dateStr) return '';
       return new Date(dateStr).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    },
    // Determine shifts and metadata from event details (Lazy Load)
    calculateSchichten(event) {
      if (!event?.einsaetze && !event?.schichten) return {};
      const grouped = {};

      // 1. Seed from Schicht records (7011 import — includes empty shifts with bedarf)
      if (event.schichten) {
        event.schichten.forEach(s => {
          const key = s.idAuftragArbeitsschichten || 'none';
          if (!grouped[key]) {
            grouped[key] = {
              einsaetze: [],
              meta: {
                schichtBezeichnung: s.bezeichnung || null,
                treffpunkt: s.treffpunkt || null,
                ansprechpartnerName: s.ansprechpartnerName || null,
                ansprechpartnerTelefon: s.ansprechpartnerTelefon || null,
                ansprechpartnerEmail: s.ansprechpartnerEmail || null,
                uhrzeitVon: s.uhrzeitVon || null,
                uhrzeitBis: s.uhrzeitBis || null,
                bedarf: s.bedarf || null,
                bedarfMet: false
              }
            };
          }
        });
      }

      // 2. Add Einsätze (assigned employees) to their shifts
      if (event.einsaetze) {
        event.einsaetze.forEach(e => {
          const key = e.idAuftragArbeitsschichten || 'none';
          if (!grouped[key]) {
            grouped[key] = {
              einsaetze: [],
              meta: {
                schichtBezeichnung: e.schichtBezeichnung || null,
                treffpunkt: e.treffpunkt || null,
                ansprechpartnerName: e.ansprechpartnerName || null,
                ansprechpartnerTelefon: e.ansprechpartnerTelefon || null,
                ansprechpartnerEmail: e.ansprechpartnerEmail || null,
                uhrzeitVon: e.uhrzeitVon || null,
                uhrzeitBis: e.uhrzeitBis || null,
                bedarf: e.bedarf || null,
                bedarfMet: false
              }
            };
          }
          grouped[key].einsaetze.push(e);
        });
      }
      
      // Calculate bedarfMet for each schicht and sort employees (Teamleiter first)
      Object.values(grouped).forEach(schicht => {
        const bedarf = schicht.meta.bedarf;
        const actual = schicht.einsaetze.length;
        schicht.meta.bedarfMet = bedarf ? actual >= bedarf : true;

        // Sort: Teamleiter first, then alphabetical by name
        schicht.einsaetze.sort((a, b) => {
          const isTLa = this.isTeamleiter(a.mitarbeiterData);
          const isTLb = this.isTeamleiter(b.mitarbeiterData);
          
          if (isTLa && !isTLb) return -1;
          if (!isTLa && isTLb) return 1;
          
          // Same status, sort by name
          const nameA = (a.mitarbeiterData?.nachname || "").toLowerCase();
          const nameB = (b.mitarbeiterData?.nachname || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      });
      
      return grouped;
    },

    // Check if all einsaetze in a schicht have the same beruf
    getCommonBeruf(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstBeruf = einsaetze[0].berufData;
      if (!firstBeruf) return null;
      
      const allSame = einsaetze.every(e => 
        e.berufData?.jobKey === firstBeruf.jobKey
      );
      
      return allSame ? firstBeruf : null;
    },
    
    // Check if all einsaetze in a schicht have the same qualifikation
    getCommonQualifikation(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstQuali = einsaetze[0].qualifikationData;
      if (!firstQuali) return null;
      
      const allSame = einsaetze.every(e => 
        e.qualifikationData?.qualificationKey === firstQuali.qualificationKey
      );
      
      return allSame ? firstQuali : null;
    },
    checkMobile() {
      this.isMobile = window.innerWidth <= 768;
    },
    openMobileDatePicker() {
      this.$refs.mobileDatePicker?.showPicker?.() ?? this.$refs.mobileDatePicker?.click();
    },
    async jumpToDate(event) {
      const selected = new Date(event.target.value + 'T00:00:00');
      if (isNaN(selected)) return;
      const day = selected.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(selected);
      monday.setDate(selected.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      this.currentWeekStart = monday;
      await this.ensureMonthLoaded(monday);
      this.mobileDayIndex = day === 0 ? 6 : day - 1;
    },
    async prevDay() {
      if (this.mobileDayIndex > 0) {
        this.mobileDayIndex--;
      } else {
        await this.previousWeek();
        this.mobileDayIndex = 6;
      }
    },
    async nextDay() {
      if (this.mobileDayIndex < 6) {
        this.mobileDayIndex++;
      } else {
        await this.nextWeek();
        this.mobileDayIndex = 0;
      }
    },
    initializeWeek() {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      this.currentWeekStart = monday;
      
      // Set to today
      this.mobileDayIndex = (dayOfWeek + 6) % 7;
    },
    async loadOrderDirectly(auftragNr, focusDate) {
      try {
        const response = await api.get(`/api/auftraege/${auftragNr}/details`);
        const fullOrder = response.data;
        
        if (fullOrder) {
          this.selectedEvent = fullOrder;
          this.preparedSchichten = this.calculateSchichten(fullOrder);
          this.fetchAuftragDocs(auftragNr);
          
          let targetDate = null;
          if (focusDate) {
             targetDate = new Date(focusDate);
          } else if (fullOrder.vonDatum) {
             targetDate = new Date(fullOrder.vonDatum);
          }
          
          if (targetDate && !isNaN(targetDate.getTime())) {
            await this.jumpToDate(targetDate);
          }
        }
      } catch (err) {
        console.error("Deep link load failed:", err);
      }
    },
    async jumpToDate(date) {
      const dayOfWeek = date.getDay(); // 0 = Sun
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff);
      monday.setHours(0,0,0,0);
      
      this.currentWeekStart = monday;
      
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      
      // Load both start and end month of the week to handle crossovers
      await this.ensureMonthLoaded(monday);
      await this.ensureMonthLoaded(sunday);
    },
    async loadAuftraege(fromDate, toDate) {
      this.loading = true;
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append('from', fromDate.toISOString());
        if (toDate) params.append('to', toDate.toISOString());
        
        // Add Filters
        if (this.filters.geschSt) {
          params.append('geschSt', this.filters.geschSt);
        }
        if (this.filters.bediener && this.filters.bediener.length > 0) {
          params.append('bediener', this.filters.bediener.join(','));
        }
        if (this.filters.kunden && this.filters.kunden.length > 0) {
          params.append('kunden', this.filters.kunden.join(','));
        }
        
        const response = await api.get(`/api/auftraege?${params.toString()}`);
        
        // Merge with existing, avoiding duplicates
        const existingIds = new Set(this.auftraege.map(a => a._id));
        const newAuftraege = response.data.filter(a => !existingIds.has(a._id));
        this.auftraege = [...this.auftraege, ...newAuftraege];
        
      } catch (error) {
        console.error('Error loading Aufträge:', error);
      } finally {
        this.loading = false;
      }
    },
    async fetchFilterOptions() {
      try {
        const params = new URLSearchParams();
        if (this.filters.geschSt) {
          params.append('geschSt', this.filters.geschSt);
        }
        const res = await api.get(`/api/auftraege/filters?${params.toString()}`);
        this.filterOptions.bediener = res.data.bediener || [];
        this.filterOptions.kunden = res.data.kunden || [];
      } catch (e) {
        console.error("Error fetching filters", e);
      }
    },
    setDefaultFilters() {
      // Only set defaults if no saved filters in sessionStorage
      const savedFilters = sessionStorage.getItem('auftraege_filters');
      if (savedFilters) {
        // Filters already loaded from storage in data()
        return;
      }

      // 1=Berlin, 2=Hamburg, 3=Köln
      // Check both standort (legacy) and location (model)
      const userLoc = this.user?.location || this.user?.standort;
      
      if (userLoc) {
        const loc = userLoc.toLowerCase();
        if (loc.includes('berlin')) this.filters.geschSt = '1';
        else if (loc.includes('hamburg')) this.filters.geschSt = '2';
        else if (loc.includes('köln') || loc.includes('koeln')) this.filters.geschSt = '3';
      }
    },
    saveFiltersToStorage() {
      const filters = {
        geschSt: this.filters.geschSt,
        bediener: this.filters.bediener,
        kunden: this.filters.kunden
      };
      sessionStorage.setItem('auftraege_filters', JSON.stringify(filters));
    },
    toggleFilters() {
      this.filtersExpanded = !this.filtersExpanded;
    },
    setGeschStFilter(val) {
      if (this.filters.geschSt === val) return;
      this.filters.geschSt = val;
      // Reset dependent filters as they might not apply to new location
      this.filters.kunden = [];
      this.filters.bediener = [];
      this.saveFiltersToStorage();
      this.fetchFilterOptions(); // Update options based on selection
      this.resetAndReload();
    },
    toggleBedienerFilter(val) {
      const idx = this.filters.bediener.indexOf(val);
      if (idx === -1) {
        this.filters.bediener.push(val);
      } else {
        this.filters.bediener.splice(idx, 1);
      }
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    toggleKundeFilter(val) {
      const idx = this.filters.kunden.indexOf(val);
      if (idx === -1) {
        this.filters.kunden.push(val);
      } else {
        this.filters.kunden.splice(idx, 1);
      }
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    resetAllFilters() {
      this.filters.geschSt = null;
      this.filters.bediener = [];
      this.filters.kunden = [];
      // Clear storage on reset, then apply user defaults
      sessionStorage.removeItem('auftraege_filters');
      // Set defaults based on user location
      const userLoc = this.user?.location || this.user?.standort;
      if (userLoc) {
        const loc = userLoc.toLowerCase();
        if (loc.includes('berlin')) this.filters.geschSt = '1';
        else if (loc.includes('hamburg')) this.filters.geschSt = '2';
        else if (loc.includes('köln') || loc.includes('koeln')) this.filters.geschSt = '3';
      }
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    async resetAndReload() {
      this.auftraege = []; // Clear current list
      this.loadedMonths.clear(); // Reset cache
      
      // Reload current view
      // We need to reload based on currentWeekStart
      // Usually current week spans 2 months max, so let's reload a safe range or just use ensureMonthLoaded logic
      const start = new Date(this.currentWeekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      
      // Load current month range
      await this.ensureMonthLoaded(start);
      // If week crosses month boundary
      await this.ensureMonthLoaded(end);
    },
    async loadInitialData() {
      // Load current month and all future
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      await this.loadAuftraege(startOfMonth, null);
      this.loadedMonths.add(`${now.getFullYear()}-${now.getMonth()}`);
    },
    async ensureMonthLoaded(date) {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (this.loadedMonths.has(monthKey)) return;
      
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      
      await this.loadAuftraege(startOfMonth, endOfMonth);
      this.loadedMonths.add(monthKey);
    },
    async previousWeek() {
      const newStart = new Date(this.currentWeekStart);
      newStart.setDate(newStart.getDate() - 7);
      this.currentWeekStart = newStart;
      await this.ensureMonthLoaded(newStart);
    },
    async nextWeek() {
      const newStart = new Date(this.currentWeekStart);
      newStart.setDate(newStart.getDate() + 7);
      this.currentWeekStart = newStart;
      await this.ensureMonthLoaded(newStart);
    },
    goToToday() {
      this.initializeWeek();
    },
    openDatePicker() {
      if (this.$refs.datePicker) {
        // showPicker() is supported in modern browsers to open the dialog directly
        if (typeof this.$refs.datePicker.showPicker === 'function') {
          this.$refs.datePicker.showPicker();
        } else {
          this.$refs.datePicker.click();
        }
      }
    },
    async handleDatePick(event) {
      const val = event.target.value;
      if (!val) return;
      
      const date = new Date(val + 'T00:00:00');
      // Calculate start of that week (Monday)
      const Day = date.getDay() || 7; // Sunday is 0 -> make it 7
      date.setDate(date.getDate() - Day + 1); // Set to Monday
      
      this.currentWeekStart = date;
      await this.ensureMonthLoaded(date);
      
      // Reset picker
      event.target.value = '';
    },
    getTotalPositionsForDay(date) {
      const events = this.getEventsForDay(date);
      return events.reduce((sum, event) => {
        let count = 0;
        if (typeof event.einsaetzeCount === 'number') {
          count = event.einsaetzeCount;
        } else if (Array.isArray(event.einsaetze)) {
          count = event.einsaetze.length;
        }
        return sum + count;
      }, 0);
    },
    getEventsForDay(date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return this.filteredAuftraege.filter(a => {
        const von = new Date(a.vonDatum);
        const bis = new Date(a.bisDatum);
        // Event spans this day if: vonDatum <= dayEnd AND bisDatum >= dayStart
        return von <= dayEnd && bis >= dayStart;
      }).sort((a, b) => {
        // Sort by earliest Einsatz time (uhrzeitVon e.g. "08:00"), falling back to vonDatum
        const aTime = a.earliestEinsatzTime?.uhrzeitVon;
        const bTime = b.earliestEinsatzTime?.uhrzeitVon;
        if (aTime && bTime) return aTime.localeCompare(bTime);
        if (aTime) return -1;
        if (bTime) return 1;
        return new Date(a.vonDatum) - new Date(b.vonDatum);
      });
    },
    async selectEvent(event) {
      this.showQuickActions = false;
      this.auftragDocs = [];
      // Load full details including Einsätze
      try {
        const response = await api.get(`/api/auftraege/${event.auftragNr}/details`);
        this.selectedEvent = response.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
        this.fetchAuftragDocs(event.auftragNr);
      } catch (error) {
        console.error('Error loading event details:', error);
        this.selectedEvent = event; // fallback to basic data
        this.preparedSchichten = this.calculateSchichten(event);
      }
    },
    async fetchAuftragDocs(auftragNr) {
      try {
        console.log('[AuftraegePage] Fetching docs for auftragNr:', auftragNr);
        const res = await api.get(`/api/reports/by-auftrag/${auftragNr}`);
        this.auftragDocs = res.data?.data || [];
        console.log('[AuftraegePage] Loaded docs:', this.auftragDocs.length, this.auftragDocs);
      } catch (e) {
        console.error('[AuftraegePage] Error loading docs for auftrag:', e);
        this.auftragDocs = [];
      }
    },
    getDocsForMitarbeiter(mitarbeiterId) {
      if (!mitarbeiterId || !this.auftragDocs.length) return [];
      return this.auftragDocs.filter(doc => {
        const d = doc.details;
        // EventReport: teamleiter is the author
        if (doc.docType === 'Event-Bericht') {
          const tlId = typeof d.teamleiter === 'object' ? d.teamleiter?._id : d.teamleiter;
          return String(tlId) === String(mitarbeiterId);
        }
        // Laufzettel: mitarbeiter or teamleiter
        const maId = typeof d.mitarbeiter === 'object' ? d.mitarbeiter?._id : d.mitarbeiter;
        const tlId = typeof d.teamleiter === 'object' ? d.teamleiter?._id : d.teamleiter;
        return String(maId) === String(mitarbeiterId) || String(tlId) === String(mitarbeiterId);
      });
    },
    openDocCard(doc) {
      this.selectedDoc = doc;
    },
    formatDayDateFull(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    getBedarfClass(event) {
      const s = event.schichtStatus;
      if (!s || s === 'none') return 'bedarf-none';
      return `bedarf-${s}`;
    },
    getSchichtenForDay(event, date) {
      if (!event.schichten?.length || !date) return [];
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      return event.schichten.filter(s => {
        if (!s.datumVon) return false;
        const sd = new Date(s.datumVon);
        return sd >= d && sd < next;
      });
    },
    getEventStatusClass(event) {
      // Color coding based on status
      const status = event.auftStatus;
      if (status === 1) return 'status-draft';
      if (status === 2) return 'status-confirmed';
      if (status === 3) return 'status-completed';
      return 'status-default';
    },
    getStatusText(status) {
      const map = { 1: 'Unbestätigt', 2: 'Bestätigt', 3: 'Abgeschlossen' };
      return map[status] || 'Unbekannt';
    },
    getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },
    isToday(date) {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    },
    formatDateRange(start, end) {
      if (!start || !end) return '';
      const opts = { day: 'numeric', month: 'short', year: 'numeric' };
      return `${start.toLocaleDateString('de-DE', opts)} - ${end.toLocaleDateString('de-DE', opts)}`;
    },
    formatDayDate(date) {
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Heute';
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
    },
    formatTime(dateStr) {
      if (!dateStr) return '-';
      // Already a clean HH:MM or HH:MM:SS string
      if (typeof dateStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateStr)) {
        return dateStr.substring(0, 5);
      }
      // Full JS .toString() date string e.g. "Sun Dec 31 1899 10:00:00 GMT+0100 (...)"
      // Extract HH:MM directly from the string — no timezone conversion!
      if (typeof dateStr === 'string') {
        const m = dateStr.match(/\d{4} (\d{2}:\d{2}):\d{2}/);
        if (m) return m[1];
      }
      return '-';
    },
    formatDateTime(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleString('de-DE', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin'
      });
    },
    toggleSearchExpanded() {
      this.searchExpanded = !this.searchExpanded;
      if (this.searchExpanded) {
        this.$nextTick(() => {
          if (this.$refs.searchInput) {
            this.$refs.searchInput.focus();
          }
        });
      }
    },
    handleSearchBlur() {
      // Only collapse on mobile when blur occurs outside of focused state
      if (window.innerWidth <= 768 && !this.searchQuery) {
        this.searchExpanded = false;
      }
    },
    debouncedSearch() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        // Search is reactive via computed, no action needed
      }, 300);
    },
    async openKundeCard(kundeBasic) {
      this.selectedKunde = kundeBasic;
      this.fullKundeData = null;

      try {
        const response = await api.get(`/api/kunden/${kundeBasic._id}`);
        this.fullKundeData = response.data;
      } catch (error) {
        console.error('Error loading Kunden details:', error);
        // Fallback to basic data
        this.fullKundeData = kundeBasic;
      }
    },
    async openMitarbeiterCard(mitarbeiterBasic) {
      this.selectedMitarbeiter = mitarbeiterBasic;
    },
    
    // Check if a mitarbeiter is a Teamleiter based on qualification 50055
    isTeamleiter(mitarbeiter) {
      if (!mitarbeiter?.qualifikationen?.length) return false;
      return mitarbeiter.qualifikationen.some(q => {
        const key = parseInt(String(q.qualificationKey || q), 10);
        return key === 50055;
      });
    },

    // ── Quick Actions ────────────────────────────────────────────────────────
    async openLabelDialog() {
      this.showQuickActions = false;
      this.newLabelName = '';
      this.newLabelColor = '#4f46e5';
      try {
        const res = await api.get('/api/auftraege/labels');
        this.globalLabels = res.data || [];
      } catch { this.globalLabels = []; }
      this.showLabelDialog = true;
    },
    async quickAddLabel(gl) {
      await this.saveLabel(gl.name, gl.color);
    },
    async saveLabel(nameArg, colorArg) {
      const name = typeof nameArg === 'string' ? nameArg : this.newLabelName.trim();
      const color = typeof colorArg === 'string' ? colorArg : this.newLabelColor;
      if (!name) return;
      this.labelSaving = true;
      try {
        const res = await api.post(`/api/auftraege/${this.selectedEvent.auftragNr}/labels`, { name, color });
        this.selectedEvent.labels = res.data.labels;
        // Sync to auftraege list
        const idx = this.auftraege.findIndex(a => a.auftragNr === this.selectedEvent.auftragNr);
        if (idx !== -1) this.auftraege[idx].labels = res.data.labels;
        this.newLabelName = '';
        // Refresh global labels
        const gr = await api.get('/api/auftraege/labels');
        this.globalLabels = gr.data || [];
      } catch (err) {
        alert(err.response?.data?.message || 'Fehler beim Speichern');
      } finally {
        this.labelSaving = false;
      }
    },
    async removeLabel(labelId) {
      try {
        const res = await api.delete(`/api/auftraege/${this.selectedEvent.auftragNr}/labels/${labelId}`);
        this.selectedEvent.labels = res.data.labels;
        const idx = this.auftraege.findIndex(a => a.auftragNr === this.selectedEvent.auftragNr);
        if (idx !== -1) this.auftraege[idx].labels = res.data.labels;
      } catch (err) {
        alert(err.response?.data?.message || 'Fehler beim Entfernen');
      }
    },
    openPseudoDialog() {
      this.showQuickActions = false;
      this.pseudoSearch = '';
      this.pseudoSearchResults = [];
      this.pseudoSelectedMas = [];
      this.pseudoSelectedSchicht = null;
      this.showPseudoDialog = true;
    },
    togglePseudoMa(ma) {
      const idx = this.pseudoSelectedMas.findIndex(m => m._id === ma._id);
      if (idx === -1) {
        this.pseudoSelectedMas.push(ma);
      } else {
        this.pseudoSelectedMas.splice(idx, 1);
      }
    },
    debouncedPseudoSearch() {
      clearTimeout(this.pseudoSearchTimer);
      if (this.pseudoSearch.trim().length < 2) {
        this.pseudoSearchResults = [];
        return;
      }
      this.pseudoSearchTimer = setTimeout(async () => {
        this.pseudoSearching = true;
        try {
          const res = await api.get(`/api/personal/search?q=${encodeURIComponent(this.pseudoSearch.trim())}`);
          this.pseudoSearchResults = res.data || [];
        } catch { this.pseudoSearchResults = []; }
        finally { this.pseudoSearching = false; }
      }, 300);
    },
    async savePseudoEinsatz() {
      if (!this.pseudoSelectedMas.length) return;
      this.pseudoSaving = true;
      const errors = [];
      try {
        await Promise.all(this.pseudoSelectedMas.map(async (ma) => {
          try {
            const payload = { mitarbeiterId: ma._id };
            if (this.pseudoSelectedSchicht) payload.schichtId = this.pseudoSelectedSchicht;
            await api.post(`/api/auftraege/${this.selectedEvent.auftragNr}/pseudo-einsatz`, payload);
          } catch (err) {
            errors.push(`${ma.vorname} ${ma.nachname}: ${err.response?.data?.message || 'Fehler'}`);
          }
        }));
        // Reload full event details to refresh schichten
        const detailsRes = await api.get(`/api/auftraege/${this.selectedEvent.auftragNr}/details`);
        this.selectedEvent = detailsRes.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
        this.showPseudoDialog = false;
        if (errors.length) alert('Einige konnten nicht eingeplant werden:\n' + errors.join('\n'));
      } catch (err) {
        alert(err.response?.data?.message || 'Fehler beim Einplanen');
      } finally {
        this.pseudoSaving = false;
      }
    },
    async removePseudoEinsatz(einsatzId) {
      if (!confirm('Pseudo-Einsatz entfernen?')) return;
      try {
        await api.delete(`/api/auftraege/${this.selectedEvent.auftragNr}/pseudo-einsatz/${einsatzId}`);
        const res = await api.get(`/api/auftraege/${this.selectedEvent.auftragNr}/details`);
        this.selectedEvent = res.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
      } catch (err) {
        alert(err.response?.data?.message || 'Fehler beim Entfernen');
      }
    },

    handleEscapeKey(event) {
      if (event.key !== 'Escape') return;

      // Close modals in order of priority (topmost = last opened)
      if (this.showQuickActions) {
        this.showQuickActions = false;
      } else if (this.selectedDoc) {
        this.selectedDoc = null;
      } else if (this.showLabelDialog) {
        this.showLabelDialog = false;
      } else if (this.showPseudoDialog) {
        this.showPseudoDialog = false;
      } else if (this.selectedKunde) {
        this.selectedKunde = null;
        this.fullKundeData = null;
      } else if (this.selectedMitarbeiter) {
        this.selectedMitarbeiter = null;
        this.fullMitarbeiterData = null;
      } else if (this.selectedEvent) {
        this.selectedEvent = null;
      }
    }
  },
    handleDocumentClick() {
      this.showQuickActions = false;
    },
    async mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
    document.addEventListener('keydown', this.handleEscapeKey);
    document.addEventListener('click', this.handleDocumentClick);
    
    // Set default filters first (e.g. from user location if no storage)
    this.setDefaultFilters();
    // Then fetch options which might depend on those filters
    await this.fetchFilterOptions();
    
    this.fetchDataStatus();
    this.initializeWeek();
    await this.loadInitialData();
    
    // Check deep link & filters
    const { auftragnr, geschSt, focusDate } = this.$route.query;
    
    // Apply filter first if present
    if (geschSt) {
        this.setGeschStFilter(geschSt);
    }

    if (auftragnr) {
        await this.loadOrderDirectly(auftragnr, focusDate);
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.checkMobile);
    document.removeEventListener('keydown', this.handleEscapeKey);
    document.removeEventListener('click', this.handleDocumentClick);
  }
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.auftraege-page {
  /* Variable Mappings to match new components */
  --bg: var(--bg);
  --surface: var(--panel);
  --soft: var(--hover);
  --border: var(--border);
  --muted: var(--muted);
  --text: var(--text);
  --brand: var(--primary);
  
  display: flex;
  align-items: flex-start;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: 20px;
  /* Removed transition on margin-right as layout is now flex-driven */

  @media (max-width: 768px) {
    padding: 8px;
  }
}

/* Sidebar Styles */
.detail-sidebar {
  position: sticky;
  top: 88px;
  width: 420px;
  min-width: 420px; /* Ensure it keeps size during flex resize of siblings */
  height: calc(100vh - 88px);
  overflow-y: auto;
  background: var(--tile-bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  /* z-index removed as it is no longer an overlay */
  /* box-shadow removed for flat layout, border is sufficient */
  
  @media (max-width: 1200px) {
    /* On smaller screens, fall back to overlay or full width behavior if needed, 
       but for now we keep flow behavior until it breaks layout, then maybe overlay? 
       Actually, standard responsiveness usually stacks or overlays. 
       Let's keep it simple for now, maybe reduce width */
    width: 350px;
    min-width: 350px;
  }
  
  @media (max-width: 768px) {
    /* Mobile: Overlay behavior might be better here, or full screen. 
       Let's restore fixed overlay ONLY for mobile */
    position: fixed;
    top: 0;
    right: 0;
    height: 100%;
    width: 100%;
    min-width: 100%;
    z-index: 1000;
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  
  .sidebar-title-area {
    flex: 1;
    min-width: 0;
    
    h2 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  .sidebar-status {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
    
    &.status-draft { background: #fef3c7; color: #92400e; }
    &.status-confirmed { background: #d1fae5; color: #065f46; }
    &.status-completed { background: #dbeafe; color: #1e40af; }
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.6rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    margin-left: 12px;
    
    &:hover { color: var(--text); }
  }
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sidebar-overlay {
  display: none;
  
  @media (max-width: 1200px) {
    display: block;
    position: fixed;
    top: 88px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 99;
  }
}

/* Sidebar Animation - Push effect */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: width 0.3s cubic-bezier(0.25, 1, 0.5, 1), min-width 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease;
  overflow: hidden;
  white-space: nowrap; /* Prevent content wrapping during animation */
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  width: 0 !important;
  min-width: 0 !important;
  opacity: 0;
}

/* Ensure content inside doesn't reflow weirdly during shrink */
.sidebar-slide-enter-from *,
.sidebar-slide-leave-to * {
  opacity: 0;
}

/* Info Grid in Sidebar */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    &.full-width {
      grid-column: 1 / -1;
    }
    
    .info-label {
      font-size: 0.7rem;
      color: var(--muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .info-value {
      font-size: 0.9rem;
      color: var(--text);
      
      &.highlight {
        color: var(--primary);
        font-weight: 600;
      }
      
      .kunde-link {
        color: var(--primary);
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

/* Schichten Section */
.schichten-section {
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    
    h3 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text);
    }
    
    .section-count {
      background: var(--primary);
      color: #fff;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
  }
}

.schichten-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schicht-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.schicht-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--hover);
  border-bottom: 1px solid var(--border);
  gap: 10px;
  
  .schicht-time-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
    
    .schicht-time {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--text);
      
      svg { color: var(--primary); font-size: 0.75rem; }
    }
    
    .schicht-name {
      font-size: 0.8rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.bedarf-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  
  &.met {
    background: #d1fae5;
    color: #065f46;
  }
  
  &.unmet {
    background: #fef3c7;
    color: #92400e;
  }
}

.schicht-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 8px 12px;
  background: color-mix(in oklab, var(--hover) 50%, transparent);
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--muted);
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    
    svg { color: var(--primary); font-size: 0.7rem; }
    
    &.ansprechpartner {
      .contact-link {
        color: var(--primary);
        text-decoration: none;
        margin-left: 4px;
        
        &:hover { text-decoration: underline; }
      }
    }
  }
}

.schicht-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.badge {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  svg { font-size: 0.6rem; }
  
  &.beruf {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
  }
  
  &.quali {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
  }
  
  &.small {
    font-size: 0.65rem;
    padding: 2px 6px;
  }
}

.mitarbeiter-list {
  padding: 6px 0;
}

.mitarbeiter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);
  
  &:last-child { border-bottom: none; }
  
  .ma-info {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    
    .ma-name {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.85rem;
      
      &:hover { text-decoration: underline; }
    }
    
    .ma-placeholder {
      color: var(--muted);
      font-size: 0.8rem;
    }
    
    .tl-tag {
      font-size: 0.6rem;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2px 5px;
      border-radius: 4px;
    }

    .doc-icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 1px 2px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      transition: background 140ms ease;

      &:hover {
        background: color-mix(in srgb, var(--primary) 15%, transparent);
      }

      .doc-icon-img {
        width: 18px;
        height: 18px;
        object-fit: contain;
        image-rendering: crisp-edges;
      }
    }
  }
  
  .ma-badges {
    display: flex;
    gap: 4px;
  }
}

.no-mitarbeiter,
.no-einsaetze {
  text-align: center;
  padding: 20px;
  color: var(--muted);
  font-size: 0.85rem;
  
  svg {
    display: block;
    margin: 0 auto 8px;
    font-size: 1.5rem;
    opacity: 0.5;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;

  h1 {
    font-size: 1.8rem;
    color: var(--text);
    margin: 0;
  }
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.data-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--muted);
  background: var(--hover);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  
  svg {
    font-size: 0.7rem;
    color: var(--primary);
  }
}

@media (max-width: 768px) {
  .data-status-badge {
    display: none;
  }
}

.header-controls {
  display: flex;
  gap: 10px;
}

.search-box input {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.95rem;
  width: 280px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

// Mobile search inside filter header
.filter-search-box {
  display: flex;
  align-items: center;
  position: relative;
}

.filter-search-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
  line-height: 1;

  &:hover {
    color: var(--primary);
    background: var(--hover);
  }
}

.filter-search-box input {
  display: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.85rem;
  width: 0;
  background: var(--tile-bg);
  color: var(--text);
  transition: width 0.25s ease, opacity 0.2s ease;
  opacity: 0;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.filter-search-box.search-expanded input {
  display: block;
  width: 220px;
  opacity: 1;
}

@media (max-width: 768px) {
  .filter-search-box.search-expanded input {
    width: 150px;
  }
}

@media (max-width: 768px) {
  .desktop-search {
    display: none;
  }
}

.calendar-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.nav-btn {
  padding: 8px 16px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: var(--hover);
    border-color: var(--primary);
  }

  &.today-btn {
    background: transparent;
    color: var(--primary);
    border-color: var(--primary);

    &:hover {
      background: color-mix(in oklab, var(--primary) 10%, transparent);
    }
  }
}

.nav-btn.calendar-btn:hover {
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  color: var(--primary);
  border-color: var(--primary);
}

.current-range {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text);
  min-width: 250px;
  text-align: center;
}

.loading-body {
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 1.1rem;
}

.calendar-grid {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.calendar-header {
  display: grid;
  grid-template-columns: 50px repeat(7, 1fr);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.kw-cell {
  padding: 12px 8px;
  text-align: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--muted);
  border-right: 1px solid var(--border);
}

.kw-number {
  font-size: 1rem;
  color: var(--text);
}

.day-header {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid var(--border);

  &:last-child {
    border-right: none;
  }

  &.is-today {
    background: color-mix(in oklab, var(--primary) 15%, transparent);
  }

  .day-name {
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--muted);
    margin-bottom: 4px;
  }

  .day-date {
    font-size: 0.9rem;
    color: var(--text);
  }
}

.calendar-body {
  display: grid;
  grid-template-columns: 50px repeat(7, 1fr);
  min-height: 500px;
}

.day-column {
  border-right: 1px solid var(--border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 400px;
  overflow-y: auto;

  &:last-child {
    border-right: none;
  }

  &.is-today {
    background: color-mix(in oklab, var(--primary) 5%, transparent);
  }
}

.day-stats {
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 4px;
}

.event-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.75rem;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  &.status-confirmed {
    background: color-mix(in oklab, #22c55e 8%, var(--panel));
  }

  &.status-completed {
    opacity: 0.7;
  }

  // Bedarf-based left border
  &.bedarf-none        { border-left: 3px solid var(--muted); }
  &.bedarf-all-empty   { border-left: 3px solid #ef4444; }
  &.bedarf-some-empty  { border-left: 3px solid #f97316; }
  &.bedarf-underbooked { border-left: 3px solid #eab308; }
  &.bedarf-full        { border-left: 3px solid #22c55e; }
  &.bedarf-overbooked  { border-left: 3px solid #15803d; }
}

.event-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-kunde {
  color: var(--primary);
  font-weight: 500;
  margin-bottom: 2px;
}

.event-location {
  color: var(--muted);
  font-size: 0.7rem;
}

.event-time {
  color: var(--text);
  font-weight: 500;
  margin-top: 4px;
}

.event-einsaetze {
  margin-top: 4px;
  font-size: 0.65rem;
  color: var(--muted);
  background: var(--hover);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--text);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.8rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
      color: var(--text);
    }
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  gap: 12px;
}

.detail-row {
  display: flex;
  gap: 10px;

  .label {
    font-weight: 600;
    color: var(--muted);
    min-width: 100px;
  }

  .value {
    color: var(--text);
  }
}

.einsaetze-section {
  margin-top: 24px;
  
  h3 {
    font-size: 1.1rem;
    margin-bottom: 12px;
    color: var(--text);
  }
}

.schicht-group {
  margin-bottom: 16px;
  background: var(--panel);
  border-radius: 8px;
  overflow: hidden;
}

.schicht-header {
  background: var(--hover);
  padding: 10px 14px;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.schicht-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  
  .beruf-badge,
  .quali-badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    
    svg {
      font-size: 0.65rem;
    }
  }
  
  .beruf-badge {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
  }
  
  .quali-badge {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(52, 211, 153, 0.3);
  }
}

.einsatz-list {
  padding: 8px;
}

.einsatz-item {
  display: flex;
  gap: 12px;
  padding: 8px 10px;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: none;
  }

  .einsatz-personal {
    font-weight: 600;
    min-width: 80px;
    color: var(--primary);
    display: flex;
    flex-direction: column;
    gap: 4px;
    
    .mitarbeiter-link {
      color: var(--primary);
      text-decoration: none;
      transition: all 0.2s ease;
      
      &:hover {
        text-decoration: underline;
        color: color-mix(in srgb, var(--primary) 80%, black);
      }
    }
    
    .personalnr-badge {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--muted);
      background: var(--hover);
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }
    
    .tl-badge {
      font-size: 0.7rem;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 3px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      width: fit-content;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
      
      svg {
        font-size: 0.65rem;
      }
    }
  }

  .einsatz-bezeichnung {
    flex: 1;
    color: var(--text);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  
  .beruf-badge,
  .quali-badge {
    font-size: 0.7rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    
    svg {
      font-size: 0.65rem;
    }
  }
  
  .beruf-badge {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
  }
  
  .quali-badge {
    background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
    color: #fff;
    box-shadow: 0 2px 4px rgba(52, 211, 153, 0.3);
  }

  .einsatz-zeit {
    color: var(--muted);
    font-size: 0.8rem;
  }
}

/* Filter Section Styles */

.reset-chip {
  color: #ff4d4f !important;
  border-color: #ff4d4f !important;
  
  &:hover {
    background: rgba(255, 77, 79, 0.1) !important;
  }
}

/* Mobile */
@media (max-width: 1024px) {
  .calendar-header,
  .calendar-body {
    grid-template-columns: 40px repeat(7, minmax(100px, 1fr));
  }

  .day-header .day-name {
    font-size: 0.65rem;
  }
}

@media (max-width: 768px) {
  .page-header {
    display: none;
  }

  .calendar-navigation {
    display: none; /* Hide standard navigation in mobile view */
  }
}

/* Mobile Calendar Styles */
.mobile-calendar-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.mobile-date-display {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  position: relative;
  padding: 2px 10px;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: var(--hover);
  }

  &:active {
    background: var(--border);
  }
}

.hidden-date-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  top: 0;
  left: 50%;
}

.mobile-date-display .day-name {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mobile-date-display .day-date {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.nav-btn-mobile {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.nav-btn-mobile:active {
  background: var(--soft);
  transform: scale(0.95);
}

.mobile-day-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-day-state {
  text-align: center;
  padding: 40px;
  color: var(--muted);
  background: var(--surface);
  border-radius: 12px;
  border: 1px dashed var(--border);
}

.event-card-mobile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);

  // Bedarf-based left border
  &.bedarf-none        { border-left: 4px solid var(--muted); }
  &.bedarf-all-empty   { border-left: 4px solid #ef4444; }
  &.bedarf-some-empty  { border-left: 4px solid #f97316; }
  &.bedarf-underbooked { border-left: 4px solid #eab308; }
  &.bedarf-full        { border-left: 4px solid #22c55e; }
  &.bedarf-overbooked  { border-left: 4px solid #15803d; }
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-time-badge {
  background: var(--bg);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  border: 1px solid var(--border);
}

.event-status {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 600;
}

.event-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.event-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  line-height: 1.4;
}

.event-shifts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.shift-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
}

.shift-time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  min-width: 80px;
  flex-shrink: 0;
}

.shift-name {
  color: var(--muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shift-pos {
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.9rem;
}

.detail-row .icon {
  width: 16px;
  text-align: center;
  color: var(--primary);
}

.hidden-date-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* Employee Modal */
.modal-employee {
  max-width: 900px;
  width: 95%;
}

.modal-employee-body {
  padding: 0;
  max-height: 80vh;
}

/* Customer Modal */
.modal-customer {
  max-width: 800px;
  width: 95%;
}

.modal-customer-body {
  padding: 0;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-document-body {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-employee {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: var(--muted);
  
  svg {
    font-size: 2rem;
  }
}

/* ── Sidebar header actions (three-dots + close) ─────────────────── */
.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.qa-menu-wrap {
  position: relative;
}

.qa-dots-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    background: var(--hover);
    border-color: var(--border);
    color: var(--text);
  }
}

.qa-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  z-index: 200;
  overflow: hidden;
  padding: 4px;
}

.qa-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  background: none;
  border: none;
  border-radius: 7px;
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;

  svg { color: var(--muted); font-size: 0.85rem; }

  &:hover {
    background: var(--hover);
    color: var(--primary);
    svg { color: var(--primary); }
  }
}

.qa-dropdown-fade-enter-active,
.qa-dropdown-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.qa-dropdown-fade-enter-from,
.qa-dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Label chips ────────────────────────────────────────────────────── */
.label-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1.5px solid;
  white-space: nowrap;
}

.label-chip--removable {
  cursor: default;
}

.label-chip--add {
  cursor: pointer;
  opacity: 0.8;
  &:hover { opacity: 1; }
}

.label-chip-remove {
  background: none;
  border: none;
  padding: 0;
  margin-left: 2px;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  color: inherit;
  opacity: 0.7;
  &:hover { opacity: 1; }
}

/* Event card labels */
.event-labels {
  margin-bottom: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.event-label-chip {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 20px;
  border: 1.5px solid;
  white-space: nowrap;
  line-height: 1.4;
}

/* ── Pseudo tag & remove button ─────────────────────────────────────── */
.pseudo-tag {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.5);
  color: #8b5cf6;
  margin-left: 4px;
  vertical-align: middle;
}

.ma-badges--right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pseudo-remove-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 0.8rem;
  border-radius: 3px;
  line-height: 1;
  &:hover { color: #e74c3c; background: rgba(231, 76, 60, 0.1); }
}

/* ── Quick Actions Modal ────────────────────────────────────────────── */
.modal-qa {
  max-width: 480px;
  width: 95%;
}

.qa-section {
  padding: 0 0 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.qa-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-bottom: 8px;
}

.qa-form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.qa-form-field-label {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.qa-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;

  &:focus { border-color: var(--primary); }
}

.qa-select {
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  &:focus { border-color: var(--primary); }
}

.label-count {
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
}

.color-palette {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s;

  &:hover { transform: scale(1.15); }
  &.active { border-color: var(--text); transform: scale(1.15); }
}

.color-input-native {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.qa-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qa-search-spin {
  color: var(--muted);
  font-size: 0.9rem;
}

.qa-search-results {
  margin-top: 6px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
}

.qa-search-result {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;

  &:last-child { border-bottom: none; }
  &:hover, &.selected { background: var(--hover); }
  &.selected { color: var(--primary); }
}

.qa-result-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.qa-result-check {
  color: var(--primary);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.qa-result-sub {
  font-size: 0.72rem;
  color: var(--muted);
}

/* Multi-select chips area */
.qa-selected-chips {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qa-chips-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 5px;
}

.qa-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.qa-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: color-mix(in oklab, var(--primary) 12%, transparent);
  border: 1.5px solid color-mix(in oklab, var(--primary) 35%, transparent);
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 3px 8px 3px 10px;
  border-radius: 20px;
}

.qa-chip-remove {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0 1px;
  opacity: 0.7;
  &:hover { opacity: 1; }
}

.qa-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover { opacity: 0.88; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
