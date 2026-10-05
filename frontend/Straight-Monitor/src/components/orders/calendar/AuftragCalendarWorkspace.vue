<template>
  <div class="auftraege-page" :class="{ 'sidebar-open': selectedEvent }">
      <div class="main-content">
        <Toolbar
          v-if="viewMode === 'calendar'"
          class="calendar-navigation"
        >
          <ToolbarFilter
            v-model="filterExpanded"
            :active-count="activeFilterCount"
            @reset="resetAllFilters"
          >
            <FilterGroup label="Standort">
              <FilterChip
                v-for="location in locations"
                :key="location._id"
                class="location-filter-chip"
                :active="filters.locationV2 === String(location._id)"
                :style="{ '--location-color': location.color || '#6b7280' }"
                @click="setLocationFilter(String(location._id))"
                >{{ location.shortName || location.nameFull }}</FilterChip
              >
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Anzeige">
              <FilterChip
                :active="filters.displayLevels.kunde"
                @click="toggleDisplayLevel('kunde')"
                >Kunde</FilterChip
              >
              <FilterChip
                :active="filters.displayLevels.auftrag"
                @click="toggleDisplayLevel('auftrag')"
                >Auftrag</FilterChip
              >
              <FilterChip
                :active="filters.displayLevels.schicht"
                @click="toggleDisplayLevel('schicht')"
                >Schicht</FilterChip
              >
              <FilterChip
                :active="filters.displayLevels.einsatz"
                @click="toggleDisplayLevel('einsatz')"
                >Einsatz</FilterChip
              >
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Einsätze">
              <FilterChip
                :active="filters.bedarfStatus.includes('voll')"
                @click="toggleBedarfStatusFilter('voll')"
                >Voll</FilterChip
              >
              <FilterChip
                :active="filters.bedarfStatus.includes('offen')"
                @click="toggleBedarfStatusFilter('offen')"
                >Offen</FilterChip
              >
              <FilterChip
                :active="filters.pseudoEinsatz"
                @click="togglePseudoEinsatzFilter"
                >Pseudo</FilterChip
              >
            </FilterGroup>
            <FilterDivider />
            <FilterGroup label="Kunden">
              <PillMultiSelect
                v-model="filters.kunden"
                :options="filterOptions.kunden"
                value-key="kundenNr"
                label-key="kundName"
                meta-key="kuerzel"
                placeholder="Kunden suchen..."
                @change="onKundenFilterChange"
              />
            </FilterGroup>
          </ToolbarFilter>
          <div class="nav-inner">
            <div
              v-if="!isMobile"
              class="search-wrapper desktop-search"
              @focusin="onSearchFocusIn"
              @focusout="onSearchFocusOut"
            >
              <SearchBar
                class="nav-search"
                v-model="searchQuery"
                placeholder="Mitarbeiter, Events, Kunden..."
                aria-label="Aufträge suchen"
              />
            </div>
            <!-- Mobile day nav — lives inside the toolbar -->
            <template v-if="isMobile">
              <AuftragMobileDateNavigation
                :model-value="mobileDayDate"
                @previous-week="previousWeek"
                @previous-day="prevDay"
                @next-day="nextDay"
                @next-week="nextWeek"
                @update:model-value="setDateFromPicker"
              />
              <div
                class="search-wrapper mdn-search"
                @focusin="onSearchFocusIn"
                @focusout="onSearchFocusOut"
              >
                <SearchBar
                  class="nav-search"
                  v-model="searchQuery"
                  placeholder="Suchen..."
                  aria-label="Aufträge suchen"
                />
              </div>
            </template>
          </div>
          <template #bottom-actions>
            <RouterLink
              v-if="dataStatus && !isMobile"
              class="data-status-badge"
              to="/daten-import"
              :title="'Stand der Daten: ' + formatDataStatus(dataStatus)"
            >
              <font-awesome-icon icon="fa-solid fa-clock" />
              <span>{{ formatDataStatus(dataStatus) }}</span>
            </RouterLink>
            <CalendarControls v-if="!isMobile" v-model="calendarWeekDate" type="week" />
          </template>
        </Toolbar>

        <!-- Mobile View -->
        <div
          v-if="viewMode === 'calendar' && isMobile"
          class="mobile-calendar-view"
        >
          <!-- Day title -->
          <div class="mobile-day-title" v-if="weekDays[mobileDayIndex]">
            <div class="mobile-day-title__row">
              <span class="mobile-day-title__name">{{
                weekDays[mobileDayIndex].name
              }}</span>
              <span class="mobile-day-title__date">{{
                formatDayDateFull(weekDays[mobileDayIndex].date)
              }}</span>
              <span
                v-if="getHolidayForDate(weekDays[mobileDayIndex].date)"
                class="mobile-holiday-chip"
                :class="{
                  'mobile-holiday-chip--relevant': isHolidayRelevant(
                    getHolidayForDate(weekDays[mobileDayIndex].date),
                  ),
                }"
                >{{
                  getHolidayForDate(weekDays[mobileDayIndex].date).name
                }}</span
              >
            </div>
            <div class="mobile-day-title__stats">
              {{
                getEventsForDay(weekDays[mobileDayIndex].date).length
              }}
              Aufträge &bull;
              {{ getTotalPositionsForDay(weekDays[mobileDayIndex].date) }} Pos.
            </div>
          </div>

          <div class="mobile-day-content" v-if="weekDays[mobileDayIndex]">
            <div
              v-if="getEventsForDay(weekDays[mobileDayIndex].date).length === 0"
              class="empty-day-state"
            >
              Keine Aufträge heute
            </div>

            <div
              v-for="customerGroup in getEventGroupsForDay(
                weekDays[mobileDayIndex].date,
              )"
              :key="customerGroup.key"
              class="customer-event-group"
            >
              <div
                class="customer-event-group__header"
                role="button"
                tabindex="0"
                @click="
                  toggleCustomerGroup(
                    weekDays[mobileDayIndex].date,
                    customerGroup.key,
                  )
                "
                @keydown.enter.prevent="
                  toggleCustomerGroup(
                    weekDays[mobileDayIndex].date,
                    customerGroup.key,
                  )
                "
                @keydown.space.prevent="
                  toggleCustomerGroup(
                    weekDays[mobileDayIndex].date,
                    customerGroup.key,
                  )
                "
                v-if="filters.displayLevels.kunde"
              >
                {{ customerGroup.label }}
              </div>
              <div
                v-for="event in customerGroup.events"
                :key="event._id"
                v-if="shouldDisplayEventCards()"
                class="event-card-mobile"
                :class="[
                  getEventStatusClass(event),
                  getBedarfClass(event),
                  {
                    'event-card--compact': isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    ),
                  },
                ]"
                @click="selectEvent(event)"
                @contextmenu.prevent="openOrderContextMenu($event, event)"
              >
                <img
                  v-if="
                    !isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    ) && event.stundenlisteSignaturStatus === 'completed'
                  "
                  :src="docusealLogo"
                  class="event-signature-complete"
                  alt="Stundenliste vollständig signiert"
                  title="Stundenliste vollständig signiert"
                />
                <img
                  v-else-if="
                    !isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    ) && event.stundenlisteSignaturStatus === 'open'
                  "
                  :src="docusealPendingIcon"
                  class="event-signature-pending"
                  alt="Stundenliste zur Signatur ausstehend"
                  title="Stundenliste zur Signatur ausstehend"
                />
                <img
                  v-else-if="
                    !isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    ) && event.stundenlisteSignaturStatus === 'draft'
                  "
                  :src="docusealPendingIcon"
                  class="event-signature-draft"
                  alt="Stundenliste als Entwurf"
                  title="Stundenliste als Entwurf"
                />
                <div
                  v-if="
                    !isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    )
                  "
                  class="event-header"
                >
                  <span v-if="event.auftStatus !== 2" class="event-status">{{
                    getStatusText(event.auftStatus)
                  }}</span>
                  <span
                    v-if="event.isPseudo"
                    class="pseudo-tag pseudo-tag--event"
                    >Pseudo</span
                  >
                </div>

                <div class="event-title-row">
                  <div v-if="filters.displayLevels.auftrag" class="event-title">
                    {{ event.eventTitel || "Kein Titel" }}
                  </div>
                  <div
                    v-if="
                      !isCustomerGroupCollapsed(
                        weekDays[mobileDayIndex].date,
                        customerGroup.key,
                      ) &&
                      event.labels &&
                      event.labels.length
                    "
                    class="event-labels"
                  >
                    <span
                      v-for="label in event.labels"
                      :key="label._id"
                      class="event-label-chip"
                      :style="{
                        background: label.color + '33',
                        borderColor: label.color,
                        color: label.color,
                      }"
                      >{{ label.name }}</span
                    >
                  </div>
                </div>

                <div
                  class="event-shifts"
                  v-if="
                    filters.displayLevels.schicht &&
                    !isCustomerGroupCollapsed(
                      weekDays[mobileDayIndex].date,
                      customerGroup.key,
                    ) &&
                    getSchichtenForDay(event, weekDays[mobileDayIndex].date)
                      .length
                  "
                >
                  <div
                    v-for="s in getSchichtenForDay(
                      event,
                      weekDays[mobileDayIndex].date,
                    )"
                    :key="s.id"
                    class="shift-row"
                  >
                    <span class="shift-time"
                      >{{ s.uhrzeitVon || "?"
                      }}{{ s.uhrzeitBis ? "–" + s.uhrzeitBis : "" }}</span
                    >
                    <span class="shift-name" v-if="s.bezeichnung">{{
                      s.bezeichnung
                    }}</span>
                    <span v-if="filters.displayLevels.schicht || filters.displayLevels.einsatz" class="shift-pos" :class="getShiftBedarfClass(s)"
                      >{{ s.besetzt }}/{{ s.bedarf }}</span
                    >
                    <ul
                      v-if="
                        filters.displayLevels.einsatz && s.einsaetze?.length
                      "
                      class="shift-einsaetze"
                    >
                      <li v-for="name in s.einsaetze" :key="name">
                        {{ name }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="viewMode === 'calendar'"
          class="calendar-grid"
        >
          <div class="calendar-header">
            <label class="kw-cell" style="cursor: pointer; cursor: hand">
              KW
              <input
                type="date"
                class="hidden-date-input"
                @change="handleDatePick"
                @input="handleDatePick"
              />
            </label>
            <div
              v-for="day in weekDays"
              :key="day.key"
              class="day-header"
              role="button"
              tabindex="0"
              :class="{
                'is-today': isToday(day.date),
                'is-holiday': !!getHolidayForDate(day.date),
                'is-holiday-relevant':
                  getHolidayForDate(day.date) &&
                  isHolidayRelevant(getHolidayForDate(day.date)),
              }"
              @click="toggleCustomerGroupsForDay(day.date)"
              @keydown.enter.prevent="toggleCustomerGroupsForDay(day.date)"
              @keydown.space.prevent="toggleCustomerGroupsForDay(day.date)"
              @contextmenu.prevent="openDayContextMenu($event, day)"
            >
              <div class="day-name">{{ day.name }}</div>
              <div class="day-date">{{ formatDayDate(day.date) }}</div>
              <div
                v-if="getHolidayForDate(day.date)"
                class="holiday-label"
                :class="{
                  'holiday-label--relevant': isHolidayRelevant(
                    getHolidayForDate(day.date),
                  ),
                }"
              >
                <span class="holiday-name">{{
                  getHolidayForDate(day.date).name
                }}</span>
                <span
                  class="holiday-states-badge"
                  :class="{
                    'holiday-states-badge--relevant': isHolidayRelevant(
                      getHolidayForDate(day.date),
                    ),
                  }"
                >
                  {{
                    getHolidayForDate(day.date).isNational
                      ? "Bundesweit"
                      : getHolidayForDate(day.date)
                          .states.slice(0, 4)
                          .join(", ")
                  }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="loading" class="loading-body">
            <span>Lade Aufträge...</span>
          </div>

          <div v-else class="calendar-body">
            <div class="kw-cell kw-number">
              <div
                ref="kwScroller"
                class="kw-scroller"
                @mouseleave="delayedScrollKwToActive"
                @mouseenter="clearKwScrollTimer"
              >
                <template v-for="week in weekScrollList" :key="week.key">
                  <div v-if="week.showYear" class="kw-year-sep">
                    {{ week.year }}
                  </div>
                  <AppButton
                    variant="ghost"
                    size="sm"
                    class="kw-week-btn"
                    :class="{
                      'is-active': week.isActive,
                      'is-today-week': week.isTodayWeek,
                    }"
                    :title="`KW ${week.kw} \u00b7 ${week.year}`"
                    :aria-label="`Kalenderwoche ${week.kw} ${week.year} wählen`"
                    :aria-current="week.isActive ? 'date' : undefined"
                    @click="jumpToWeek(week.date)"
                  >
                    <span class="kw-num-value">{{ week.kw }}</span>
                  </AppButton>
                </template>
              </div>
            </div>
            <div
              v-for="day in weekDays"
              :key="day.key"
              class="day-column"
              :class="{
                'is-today': isToday(day.date),
                'is-holiday-relevant':
                  getHolidayForDate(day.date) &&
                  isHolidayRelevant(getHolidayForDate(day.date)),
              }"
            >
              <div class="day-stats">
                {{ getEventsForDay(day.date).length }} Aufträge •
                {{ getTotalPositionsForDay(day.date) }} Pos.
              </div>
              <div
                v-for="customerGroup in getEventGroupsForDay(day.date)"
                :key="customerGroup.key"
                class="customer-event-group"
              >
                <div
                  class="customer-event-group__header"
                  role="button"
                  tabindex="0"
                  @click="toggleCustomerGroup(day.date, customerGroup.key)"
                  @keydown.enter.prevent="
                    toggleCustomerGroup(day.date, customerGroup.key)
                  "
                  @keydown.space.prevent="
                    toggleCustomerGroup(day.date, customerGroup.key)
                  "
                  v-if="filters.displayLevels.kunde"
                >
                  {{ customerGroup.label }}
                </div>
                <div
                  v-for="event in customerGroup.events"
                  :key="event._id"
                  v-if="shouldDisplayEventCards()"
                  class="event-card"
                  :class="[
                    getEventStatusClass(event),
                    getBedarfClass(event),
                    {
                      'event-card--compact': isCustomerGroupCollapsed(
                        day.date,
                        customerGroup.key,
                      ),
                    },
                  ]"
                  @click="selectEvent(event)"
                  @contextmenu.prevent="openOrderContextMenu($event, event)"
                >
                  <img
                    v-if="
                      !isCustomerGroupCollapsed(day.date, customerGroup.key) &&
                      event.stundenlisteSignaturStatus === 'completed'
                    "
                    :src="docusealLogo"
                    class="event-signature-complete"
                    alt="Stundenliste vollständig signiert"
                    title="Stundenliste vollständig signiert"
                  />
                  <img
                    v-else-if="
                      !isCustomerGroupCollapsed(day.date, customerGroup.key) &&
                      event.stundenlisteSignaturStatus === 'open'
                    "
                    :src="docusealPendingIcon"
                    class="event-signature-pending"
                    alt="Stundenliste zur Signatur ausstehend"
                    title="Stundenliste zur Signatur ausstehend"
                  />
                  <img
                    v-else-if="
                      !isCustomerGroupCollapsed(day.date, customerGroup.key) &&
                      event.stundenlisteSignaturStatus === 'draft'
                    "
                    :src="docusealPendingIcon"
                    class="event-signature-draft"
                    alt="Stundenliste als Entwurf"
                    title="Stundenliste als Entwurf"
                  />
                  <div
                    class="event-header"
                    v-if="
                      !isCustomerGroupCollapsed(day.date, customerGroup.key) &&
                      (event.auftStatus !== 2 || event.isPseudo)
                    "
                  >
                    <span class="event-status">{{
                      getStatusText(event.auftStatus)
                    }}</span>
                    <span
                      v-if="event.isPseudo"
                      class="pseudo-tag pseudo-tag--event"
                      >Pseudo</span
                    >
                  </div>
                  <div class="event-title-row">
                    <div
                      v-if="filters.displayLevels.auftrag"
                      class="event-title"
                    >
                      {{ event.eventTitel || "Kein Titel" }}
                    </div>
                    <div
                      v-if="
                        !isCustomerGroupCollapsed(
                          day.date,
                          customerGroup.key,
                        ) &&
                        event.labels &&
                        event.labels.length
                      "
                      class="event-labels"
                    >
                      <span
                        v-for="label in event.labels"
                        :key="label._id"
                        class="event-label-chip"
                        :style="{
                          background: label.color + '33',
                          borderColor: label.color,
                          color: label.color,
                        }"
                        >{{ label.name }}</span
                      >
                    </div>
                  </div>
                  <div
                    class="event-shifts"
                    v-if="
                      filters.displayLevels.schicht &&
                      !isCustomerGroupCollapsed(day.date, customerGroup.key) &&
                      getSchichtenForDay(event, day.date).length
                    "
                  >
                    <div
                      v-for="s in getSchichtenForDay(event, day.date)"
                      :key="s.id"
                      class="shift-row shift-row--stacked"
                    >
                      <div class="shift-details">
                        <span class="shift-time"
                          >{{ s.uhrzeitVon || "?"
                          }}{{ s.uhrzeitBis ? "–" + s.uhrzeitBis : "" }}</span
                        >
                        <span class="shift-name">{{
                          s.bezeichnung || "Schicht"
                        }}</span>
                      </div>
                      <span
                        v-if="filters.displayLevels.schicht || filters.displayLevels.einsatz"
                        class="shift-pos"
                        :class="getShiftBedarfClass(s)"
                        >{{ s.besetzt }}/{{ s.bedarf }}</span
                      >
                      <ul
                        v-if="
                          filters.displayLevels.einsatz && s.einsaetze?.length
                        "
                        class="shift-einsaetze"
                      >
                        <li v-for="name in s.einsaetze" :key="name">
                          {{ name }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AuftragListView
          v-if="viewMode === 'list'"
          :orders="filteredAuftraege"
          :loading="loading"
          :locations="locations"
          :location-v2="filters.locationV2"
          :search-query="searchQuery"
          :selected-order-number="selectedEvent?.auftragNr"
          :filter-expanded="filterExpanded"
          :active-filter-count="listActiveFilterCount"
          :kunden="filters.kunden"
          :kunden-options="filterOptions.kunden"
          :bedarf-status="filters.bedarfStatus"
          :pseudo-einsatz="filters.pseudoEinsatz"
          :period="listPeriod"
          :reference-date="listReferenceDate"
          :status-class="getEventStatusClass"
          :status-text="getStatusText"
          @select="selectEvent"
          @update:location-v2="setLocationFilter"
          @update:search-query="searchQuery = $event"
          @update:filter-expanded="filterExpanded = $event"
          @update:kunden="setKundenFilter"
          @update:period="setListPeriod"
          @update:reference-date="setListReferenceDate"
          @toggle-bedarf-status="toggleBedarfStatusFilter"
          @toggle-pseudo-einsatz="togglePseudoEinsatzFilter"
          @reset-filters="resetListFilters"
        />
      </div>
      <!-- End main-content -->

      <ContextMenu
        v-if="contextMenu.open"
        :x="contextMenu.x"
        :y="contextMenu.y"
        :width="200"
        :options="contextMenu.day ? dayContextMenuItems : orderContextMenuItems"
        @close="closeOrderContextMenu"
        @select="handleOrderContextMenuAction"
      />

      <ContextMenu
        v-if="showQuickActions"
        :x="quickActionsPosition.x"
        :y="quickActionsPosition.y"
        :width="230"
        :options="headerActionMenuItems"
        @close="showQuickActions = false"
        @select="handleHeaderActionMenuAction"
      />

      <ContextMenu
        v-if="showNeuMenu"
        :x="neuMenuPosition.x"
        :y="neuMenuPosition.y"
        :width="220"
        :options="documentMenuItems"
        @close="showNeuMenu = false"
        @select="handleDocumentMenuAction"
      />


      <!-- Sidebar for Event Details -->
      <AuftragDetailsSidePanel
        v-model="hasSelectedEvent"
        :event="selectedEvent"
        :format-range="formatDateRange"
        :status-class="getEventStatusClass"
        :status-text="getStatusText"
        @actions="toggleQuickActionsMenu"
      >

        <!-- Compact Info Grid -->
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Auftrag</span>
            <span class="info-value">#{{ selectedEvent.auftragNr }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Kunde</span>
            <span class="info-value highlight">
              <a
                v-if="selectedEvent.kundeData"
                href="#"
                class="kunde-link"
                @click.prevent="openKundeCard(selectedEvent.kundeData)"
                >{{ selectedEvent.kundeData.kundName || "-" }}</a
              >
              <template v-else>-</template>
            </span>
          </div>
          <div class="info-item full-width">
            <span class="info-label">Adresse</span>
            <span class="info-value">
              <template v-if="selectedEvent.eventLocation"
                >{{ selectedEvent.eventLocation }}<br
              /></template>
              {{ selectedEvent.eventStrasse || "" }}
              {{ selectedEvent.eventPlz || "" }}
              {{ selectedEvent.eventOrt || "" }}
            </span>
          </div>
          <div v-if="selectedEvent.referenz" class="info-item full-width">
            <span class="info-label">Referenz</span>
            <span class="info-value">{{ selectedEvent.referenz }}</span>
          </div>
          <!-- Label badges -->
          <div
            v-if="selectedEvent.labels && selectedEvent.labels.length"
            class="info-item full-width"
          >
            <span class="info-label">Labels</span>
            <div class="label-chips-row">
              <span
                v-for="label in selectedEvent.labels"
                :key="label._id"
                class="label-chip"
                :style="{
                  background: `color-mix(in srgb, ${label.color} 13%, var(--surface))`,
                  borderColor: label.color,
                  color: 'var(--text)',
                }"
              >
                {{ label.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- Schichten Section -->
        <div class="schichten-section" v-if="preparedSchichten.length">
          <div class="section-header">
            <h3>Schichten</h3>
            <span class="section-count">{{ preparedSchichten.length }}</span>
          </div>

          <div class="schichten-list">
            <div
              v-for="schichtData in preparedSchichten"
              :key="schichtData.key"
              class="schicht-card"
              :class="{
                'schicht-card--drag-over':
                  schichtDragOverKey === schichtData.key,
              }"
              @dragenter.prevent="handleSchichtDragEnter($event, schichtData)"
              @dragover.prevent="handleSchichtDragOver($event, schichtData)"
              @dragleave="handleSchichtDragLeave($event, schichtData)"
              @drop.prevent="handleMitarbeiterDrop($event, schichtData)"
            >
              <div class="schicht-header-compact">
                <div class="schicht-summary">
                  <div class="schicht-title-line">
                    <span class="schicht-name">{{
                      schichtData.meta.schichtBezeichnung || "Schicht"
                    }}</span>
                  </div>
                  <div class="schicht-detail-line">
                    <span
                      v-if="getCommonQualifikation(schichtData.einsaetze)"
                      class="schicht-quali"
                    >
                      <font-awesome-icon icon="fa-solid fa-graduation-cap" />
                      {{
                        getCommonQualifikation(schichtData.einsaetze)
                          .designation
                      }}
                    </span>
                  </div>
                </div>
                <OrderHoursVisibilityButton
                  :included="schichtStundenlisteIncluded(schichtData)"
                  :pending="isStundenlisteTogglePending(schichtData.einsaetze)"
                  :subject="schichtData.meta.schichtBezeichnung || 'Schicht'"
                  @toggle="toggleSchichtStundenlisteInclusion(schichtData)"
                />
              </div>

              <!-- Schicht Meta Row (Treffpunkt, Ansprechpartner) -->
              <div
                class="schicht-meta"
                v-if="
                  schichtData.meta.treffpunkt ||
                  schichtData.meta.treffpunktOrt ||
                  schichtData.meta.ansprechpartnerName
                "
              >
                <span
                  class="meta-item"
                  v-if="
                    schichtData.meta.treffpunkt ||
                    schichtData.meta.treffpunktOrt
                  "
                >
                  <font-awesome-icon icon="fa-solid fa-location-dot" />
                  Treffpunkt:
                  <template v-if="schichtData.meta.treffpunkt">{{
                    formatTime(schichtData.meta.treffpunkt)
                  }}</template>
                  <template
                    v-if="
                      schichtData.meta.treffpunkt &&
                      schichtData.meta.treffpunktOrt
                    "
                  >
                    |
                  </template>
                  <template v-if="schichtData.meta.treffpunktOrt">{{
                    schichtData.meta.treffpunktOrt
                  }}</template>
                </span>
                <span
                  class="meta-item ansprechpartner"
                  v-if="schichtData.meta.ansprechpartnerName"
                >
                  <font-awesome-icon icon="fa-solid fa-user-tie" />
                  {{ schichtData.meta.ansprechpartnerName }}
                  <template v-if="schichtData.meta.ansprechpartnerTelefon">
                    <a
                      :href="'tel:' + schichtData.meta.ansprechpartnerTelefon"
                      class="contact-link"
                      >{{ schichtData.meta.ansprechpartnerTelefon }}</a
                    >
                  </template>
                </span>
              </div>

              <div class="mitarbeiter-list">
                <div class="mitarbeiter-list-head">
                  <div class="team-head-label">
                    <span>Team</span>
                    <span class="team-time" v-if="schichtData.meta.uhrzeitVon">
                      <font-awesome-icon icon="fa-solid fa-clock" />
                      {{ formatTime(schichtData.meta.uhrzeitVon)
                      }}<template v-if="schichtData.meta.uhrzeitBis">
                        -
                        {{ formatTime(schichtData.meta.uhrzeitBis) }}</template
                      >
                    </span>
                  </div>
                  <span
                    class="team-coverage"
                    :class="schichtData.meta.bedarfMet ? 'met' : 'unmet'"
                  >
                    {{ schichtData.einsaetze.length }}/{{
                      schichtData.meta.bedarf || "?"
                    }}
                    besetzt
                  </span>
                </div>
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
                        @click.prevent="
                          openMitarbeiterCard(einsatz.mitarbeiterData)
                        "
                      >
                        {{ formatEmployeeName(einsatz.mitarbeiterData) }}
                      </a>
                      <TlBadge v-if="isTeamleiter(einsatz.mitarbeiterData)" />
                      <span
                        v-else-if="einsatz.mitarbeiterData.isBewerberstatus"
                        class="bew-tag"
                        >Bew.</span
                      >
                      <AppIconButton
                        variant="ghost"
                        size="sm"
                        v-for="doc in getDocsForMitarbeiter(
                          einsatz.mitarbeiterData._id,
                        )"
                        :key="doc._id"
                        class="doc-icon-btn"
                        :label="`${doc.docType} für ${formatEmployeeName(einsatz.mitarbeiterData)} öffnen`"
                        :title="
                          doc.docType +
                          (doc.datum
                            ? ' — ' + formatDayDateFull(doc.datum)
                            : '')
                        "
                        @click.stop="openDocCard(doc)"
                      >
                        <img
                          :src="
                            doc.docType === 'Event-Bericht'
                              ? eventreportImg
                              : laufzettelImg
                          "
                          class="doc-icon-img"
                          alt=""
                        />
                      </AppIconButton>
                      <span
                        v-if="einsatz.isPseudo"
                        class="pseudo-tag"
                        title="Manuell eingeplant (Pseudo-Einsatz)"
                        >Pseudo</span
                      >
                    </template>
                    <template v-else>
                      <span class="ma-placeholder"
                        >Personalnr: {{ einsatz.personalNr || "-" }}</span
                      >
                      <span
                        v-if="einsatz.isPseudo"
                        class="pseudo-tag"
                        title="Manuell eingeplant (Pseudo-Einsatz)"
                        >Pseudo</span
                      >
                    </template>
                  </div>
                  <div class="ma-badges ma-badges--right">
                    <CustomTooltip
                      v-if="einsatz.bestaetigt"
                      text="Einsatz bestätigt"
                    >
                      <span class="einsatz-confirmed-icon" aria-label="Einsatz bestätigt">
                        <font-awesome-icon icon="fa-solid fa-check" />
                      </span>
                    </CustomTooltip>
                    <span
                      v-if="
                        einsatz.qualifikationData &&
                        !getCommonQualifikation(schichtData.einsaetze)
                      "
                      class="badge quali small"
                    >
                      {{ einsatz.qualifikationData.designation }}
                    </span>
                    <OrderHoursVisibilityButton
                      :included="einsatz.stundenlisteIncluded !== false"
                      :pending="isStundenlisteTogglePending([einsatz])"
                      :subject="einsatz.mitarbeiterData ? formatEmployeeName(einsatz.mitarbeiterData) : 'Personalnr. ' + (einsatz.personalNr || '-')"
                      @toggle="toggleEinsatzStundenlisteInclusion(einsatz)"
                    />
                    <AppIconButton
                      v-if="einsatz.isPseudo"
                      variant="ghost"
                      size="sm"
                      class="pseudo-remove-btn"
                      :label="`Pseudo-Einsatz für ${einsatz.mitarbeiterData ? formatEmployeeName(einsatz.mitarbeiterData) : 'Personalnr. ' + (einsatz.personalNr || '-')} entfernen`"
                      @click.stop="removePseudoEinsatz(einsatz._id)"
                    >
                      <font-awesome-icon icon="fa-solid fa-times" />
                    </AppIconButton>
                  </div>
                </div>

                <div
                  v-if="schichtData.einsaetze.length === 0"
                  class="no-mitarbeiter"
                >
                  <font-awesome-icon icon="fa-solid fa-user-plus" />
                  <span>Keine Mitarbeiter geplant</span>
                </div>
              </div>
              <div
                class="schicht-drop-hint"
                :class="{
                  'is-visible': schichtDragOverKey === schichtData.key,
                }"
              >
                <font-awesome-icon icon="fa-solid fa-arrow-down" />
                Mitarbeiter dieser Schicht zuordnen
              </div>
            </div>
          </div>
        </div>

        <!-- No Einsätze State -->
        <div v-else class="no-einsaetze">
          <font-awesome-icon icon="fa-solid fa-calendar-xmark" />
          <span>Keine Schichten/Einsätze vorhanden</span>
        </div>

        <OrderDocumentsPanel
          :hours-status="stundenlisteStatus"
          :hours-loading="stundenlisteStatusLoading"
          :documents="einsatzDoks"
          :documents-loading="einsatzDoksLoading"
          :expenses="reisekostenListe"
          :uploading="einsatzDokUploading"
          :can-sign="canSignaturen"
          :menu-open="showNeuMenu"
          :expense-name="reisekostenName"
          :format-size="formatFileSize"
          @toggle-menu="toggleNeuMenu"
          @open-signature="openSignaturVorgang"
          @download-hours="downloadStundenliste"
          @edit-hours="openSignatureDialog"
          @delete-hours="deleteStundenlisteDraft"
          @open-expense-pdf="openReisekostenPdf"
          @edit-expense="openReisekostenModal"
          @sign-expense="openReisekostenSignatur"
          @delete-expense="deleteReisekosten"
          @preview-document="previewEinsatzDok"
          @download-document="downloadEinsatzDok"
          @delete-document="deleteEinsatzDok"
          @upload="onEinsatzDokUpload"
        />
      </AuftragDetailsSidePanel>

      <OrderDocumentUploadDialog
        v-if="showEinsatzDokDialog"
        :model-value="showEinsatzDokDialog"
        v-model:type="einsatzDokType"
        v-model:audience="einsatzDokAudience"
        v-model:beruf-keys="einsatzDokBerufKeys"
        v-model:allowed-roles="einsatzDokAllowedRoles"
        v-model:delivery-emails="einsatzDokDeliveryEmails"
        v-model:delivery-message="einsatzDokDeliveryMessage"
        :file="pendingEinsatzDokFile"
        :uploading="einsatzDokUploading"
        :error="einsatzDokUploadError"
        @close="cancelEinsatzDokUpload"
        @submit="confirmEinsatzDokUpload"
      />


      <!-- Mitarbeiter Card Modal -->
      <EmployeeCardModal
        :mitarbeiterId="
          selectedMitarbeiter?._id ||
          (typeof selectedMitarbeiter === 'string' ? selectedMitarbeiter : null)
        "
        @close="selectedMitarbeiter = null"
      />

      <OrderLabelDialog
        v-model="showLabelDialog"
        v-model:name="newLabelName"
        v-model:color="newLabelColor"
        :labels="selectedEvent?.labels || []"
        :available-labels="availableGlobalLabels"
        :preset-colors="labelPresetColors"
        :saving="labelSaving"
        :removing-id="labelRemovingId"
        @create="saveLabel($event.name, $event.color)"
        @quick-add="quickAddLabel"
        @remove="removeLabel"
      />
      <PseudoOrderCreateDialog
        v-model="showNewAuftragDialog"
        v-model:form="newAuftrag"
        :locations="locations"
        :saving="newAuftragSaving"
        @submit="saveNewPseudoAuftrag"
      />
      <PseudoAssignmentDialog
        v-model="showPseudoDialog"
        v-model:mode="pseudoSchichtMode"
        v-model:new-shift="pseudoNewSchicht"
        v-model:shift-key="pseudoSelectedSchicht"
        :shifts="preparedSchichten"
        :search="pseudoSearch"
        :results="pseudoSearchResults"
        :selected="pseudoSelectedMas"
        :searching="pseudoSearching"
        :saving="pseudoSaving"
        :format-name="formatEmployeeName"
        @update:search="updatePseudoSearch"
        @toggle="togglePseudoMa"
        @submit="savePseudoEinsatz"
      />

    </div>

  <AuftragCalendarSearchDropdown
    :visible="showSearchDropdown"
    :style="dropdownStyle"
    :results="searchDropdownResults"
    :loading="searchLoading"
    :format-date="formatDropdownDate"
    @select="selectSearchResult"
  />
</template>

<script>
// Add imports for icons used in mobile view
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faAnglesLeft,
  faAnglesRight,
  faUser,
  faLocationDot,
  faCalendar,
  faUserTie,
  faClock,
  faBriefcase,
  faGraduationCap,
  faCalendarXmark,
  faTag,
  faUserPlus,
  faTimes,
  faCheck,
  faSpinner,
  faEllipsisVertical,
  faPlus,
  faTrash,
  faFileSignature,
  faArrowUpRightFromSquare,
  faFolderOpen,
  faUpload,
  faFileContract,
  faFile,
  faXmark,
  faTriangleExclamation,
  faRotateRight,
  faWandMagicSparkles,
  faDownload,
  faChevronDown,
  faCar,
  faPencil,
  faEye,
  faEyeSlash,
  faBuilding,
  faFileExcel,
} from "@fortawesome/free-solid-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(
  faChevronLeft,
  faChevronRight,
  faAnglesLeft,
  faAnglesRight,
  faUser,
  faLocationDot,
  faCalendar,
  faUserTie,
  faClock,
  faBriefcase,
  faGraduationCap,
  faCalendarXmark,
  faTag,
  faUserPlus,
  faTimes,
  faCheck,
  faSpinner,
  faEllipsisVertical,
  faPlus,
  faTrash,
  faFileSignature,
  faArrowUpRightFromSquare,
  faFolderOpen,
  faUpload,
  faFileContract,
  faFile,
  faXmark,
  faTriangleExclamation,
  faRotateRight,
  faWandMagicSparkles,
  faDownload,
  faChevronDown,
  faCar,
  faPencil,
  faEye,
  faEyeSlash,
  faBuilding,
  faFileExcel,
);

import api from "@/utils/api";
import { mapState } from "pinia";
import { useAuth } from "@/stores/auth";
import { useFlipAll } from "@/stores/flipAll";
import { useUi } from "@/stores/ui";
import { useTheme } from "@/stores/theme";
import { useSignaturModal } from "@/stores/signaturModal";
import { useDockedModals } from "@bleck-it/vue-modal-dock";
import FilterPanel from "@/components/FilterPanel.vue";
import ThinScrollContainer from "@/components/ThinScrollContainer.vue";
import FilterGroup from "@/components/FilterGroup.vue";
import FilterChip from "@/components/ui-elements/FilterChip.vue";
import FilterDivider from "@/components/ui-elements/FilterDivider.vue";
import EmployeeCardModal from "@/components/Modals/EmployeeCardModal.vue";
import { useAdditionalModals } from '@/composables/useAdditionalModals';
import { useDocumentPreviewModals } from '@/composables/useDocumentPreviewModals';
import OrderDocumentsPanel from "@/components/orders/OrderDocumentsPanel.vue";
import OrderHoursVisibilityButton from "@/components/orders/OrderHoursVisibilityButton.vue";
import AppButton from "@/components/ui-elements/AppButton.vue";
import AppIconButton from "@/components/ui-elements/AppIconButton.vue";
import OrderDocumentUploadDialog from "@/components/orders/dialogs/OrderDocumentUploadDialog.vue";
import { useCustomerModals } from "@/composables/useCustomerModals";
import { useDocumentModals } from "@/composables/useDocumentModals";
import { useEventModals } from "@/composables/useEventModals";
import { useReisekostenModals } from "@/composables/useReisekostenModals";
import { useTimeCaptureModals } from "@/composables/useTimeCaptureModals";
import AuftragListView from "@/components/orders/AuftragListView.vue";
import AuftragDetailsSidePanel from "@/components/orders/AuftragDetailsSidePanel.vue";
import SearchBar from "@/components/SearchBar.vue";
import Toolbar from "@/components/ui-elements/Toolbar.vue";
import ToolbarFilter from "@/components/ui-elements/ToolbarFilter.vue";
import CalendarControls from "@/components/ui-elements/CalendarControls.vue";
import AuftragMobileDateNavigation from "@/components/orders/calendar/AuftragMobileDateNavigation.vue";
import OrderLabelDialog from "@/components/orders/dialogs/OrderLabelDialog.vue";
import PseudoOrderCreateDialog from "@/components/orders/dialogs/PseudoOrderCreateDialog.vue";
import PseudoAssignmentDialog from "@/components/orders/dialogs/PseudoAssignmentDialog.vue";
import TlBadge from "@/components/ui-elements/TlBadge.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import PillMultiSelect from "@/components/ui-elements/PillMultiSelect.vue";
import CustomTooltip from "@/components/CustomTooltip.vue";
import AuftragCalendarSearchDropdown from "@/components/orders/calendar/AuftragCalendarSearchDropdown.vue";
import { loadHolidaysForYear } from "@/utils/holidays.js";
import { buildEventSchichten } from "@/utils/eventSchichten";
import { getPeriodRange } from "@/utils/orderListPeriods";
import { useMitarbeiterNameFormatter } from '@/utils/mitarbeiterName';
import laufzettelIcon from "@/assets/laufzettel.png";
import laufzettelDarkIcon from "@/assets/laufzettel-dark.png";
import eventreportIcon from "@/assets/eventreport.png";
import eventreportDarkIcon from "@/assets/eventreport-dark.png";
import docusealLogo from "@/assets/docuseal-logo.webp";
import docusealPendingIcon from "@/assets/docuseal-pending.webp";

export default {
  name: "AuftragCalendarWorkspace",
  emits: ["mitarbeiter-drop"],
  props: {
    viewMode: {
      type: String,
      default: "calendar",
      validator: (value) => ["calendar", "list"].includes(value),
    },
  },
  components: {
    AuftragListView,
    AuftragDetailsSidePanel,
    OrderDocumentsPanel,
    OrderHoursVisibilityButton,
    AppButton,
    AppIconButton,
    OrderDocumentUploadDialog,
    FilterPanel,
    ThinScrollContainer,
    FilterGroup,
    FilterChip,
    FilterDivider,
    EmployeeCardModal,
    SearchBar,
    Toolbar,
    ToolbarFilter,
    CalendarControls,
    AuftragMobileDateNavigation,
    OrderLabelDialog,
    PseudoOrderCreateDialog,
    PseudoAssignmentDialog,
    TlBadge,
    ContextMenu,
    PillMultiSelect,
    CustomTooltip,
    AuftragCalendarSearchDropdown,
  },
  setup() {
    const { openExport } = useAdditionalModals();
    const { openDocumentPreview } = useDocumentPreviewModals();
    const { openCustomer } = useCustomerModals();
    const { openDocument } = useDocumentModals();
    const { openEvent } = useEventModals();
    const { openReisekosten } = useReisekostenModals();
    const { openTimeCapture } = useTimeCaptureModals();
    const minimizeDock = useDockedModals();
    const { formatName: formatEmployeeName } = useMitarbeiterNameFormatter();

    const restoreMinimizedStundenliste = (auftragNr) => {
      const modal = useSignaturModal();
      const dockItem = minimizeDock.get("signature-new");
      const isSameStundenliste =
        modal.open &&
        modal.context.typKey === "stundenliste" &&
        String(modal.context.auftragNr) === String(auftragNr);

      return isSameStundenliste && dockItem?.status === "minimized"
        ? minimizeDock.restore("signature-new")
        : false;
    };

    return {
      openExport,
      openDocumentPreview,
      openCustomer,
      openDocumentModal: openDocument,
      openEvent,
      openReisekosten,
      openTimeCapture,
      restoreMinimizedStundenliste,
      docusealLogo,
      docusealPendingIcon,
      formatEmployeeName,
    };
  },
  data() {
    // Load filter settings from sessionStorage or use defaults
    const savedFilters = sessionStorage.getItem("auftraege_filters");
    let filterDefaults = {
      locationV2: null,
      bediener: [],
      kunden: [],
      bedarfStatus: [],
      pseudoEinsatz: false,
      displayLevels: {
        kunde: true,
        auftrag: true,
        schicht: true,
        einsatz: false,
      },
    };

    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        filterDefaults = {
          ...filterDefaults,
          ...parsed,
          displayLevels: {
            ...filterDefaults.displayLevels,
            ...parsed.displayLevels,
          },
        };
      } catch (e) {
        console.warn("Could not parse saved auftraege filters:", e);
      }
    }

    return {
      isDev: import.meta.env.DEV,
      auftraege: [],
      loading: false,
      searchQuery: "",
      searchFocused: false,
      searchWrapperRect: null,
      searchExpanded: false,
      searchDropdownResults: [],
      searchLoading: false,
      listPeriod: "month",
      listReferenceDate: new Date(),
      currentWeekStart: null,
      selectedEvent: null,
      contextMenu: {
        open: false,
        x: 0,
        y: 0,
        event: null,
        day: null,
      },
      quickActionsPosition: { x: 0, y: 0 },
      neuMenuPosition: { x: 0, y: 0 },
      loadedMonths: new Set(), // Track which months we've loaded
      debounceTimer: null,

      // Filter State
      filtersExpanded: false,
      filterExpanded: false,
      filterOptions: {
        bediener: [],
        kunden: [],
      },
      filters: filterDefaults,
      collapsedCustomerGroups: {},
      locations: [],
      isMobile: false,
      mobileDayIndex: 0,
      selectedMitarbeiter: null,
      preparedSchichten: [], // Lazy loaded schichten data
      schichtDragOverKey: null,
      dataStatus: null, // Last import timestamp
      // ── Quick Actions ──────────────────────────────────────────────────────
      // Label dialog
      showLabelDialog: false,
      globalLabels: [], // All known labels for autocomplete
      newLabelName: "",
      newLabelColor: "#4f46e5",
      labelPresetColors: [
        "#4f46e5",
        "#0ea5e9",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#8b5cf6",
        "#ec4899",
        "#64748b",
      ],
      labelSaving: false,
      labelRemovingId: "",
      // New pseudo Auftrag dialog
      showNewAuftragDialog: false,
      newAuftrag: {
        eventTitel: "",
        vonDatum: "",
        bisDatum: "",
        locationV2: "",
        eventLocation: "",
        eventOrt: "",
      },
      newAuftragSaving: false,
      // Pseudo-MA dialog
      showPseudoDialog: false,
      pseudoSchichtMode: "existing", // 'existing' | 'new'
      pseudoNewSchicht: { bezeichnung: "", uhrzeitVon: "", uhrzeitBis: "" },
      pseudoSearch: "",
      pseudoSearchResults: [],
      pseudoSearching: false,
      pseudoSearchTimer: null,
      pseudoSelectedMas: [],
      pseudoSelectedSchicht: null,
      pseudoSaving: false,
      // Three-dots dropdown
      showQuickActions: false,
      isGeneratingHoursList: false,
      isGeneratingTelefonliste: false,
      // ── Stundenliste status (Einsatzdokumente sidebar) ───────────────────────────
      stundenlisteStatus: null, // { vorgang, isOutdated, outdatedReasons }
      stundenlisteStatusLoading: false,
      stundenlisteTogglePending: {},
      // ── Einsatzdokumente (R2 uploads) ────────────────────────────────────
      einsatzDoks: [],
      einsatzDoksLoading: false,
      einsatzDokUploading: false,
      einsatzDokUploadError: "",
      showEinsatzDokDialog: false,
      pendingEinsatzDokFile: null,
      einsatzDokType: "einsatznachweis",
      einsatzDokAudience: "job",
      einsatzDokBerufKeys: [],
      einsatzDokAllowedRoles: "",
      einsatzDokDeliveryEmails: "",
      einsatzDokDeliveryMessage: "",
      showEinsatzDokPreview: false,
      previewEinsatzDokument: null,
      // ── Reisekostenabrechnungen (Einsatzdokumente) ───────────────────────
      reisekostenListe: [],
      reisekostenListeLoading: false,
      showNeuMenu: false,
      showMitarbeiterExportModal: false,
      isLoadingMitarbeiterExport: false,
      mitarbeiterExportData: null,
      // Document icons
      auftragDocs: [],
      // ── Feiertage ────────────────────────────────────────────────────────────
      holidayMap: {}, // 'YYYY-MM-DD' → { name, states, isNational, hinweis }
      loadedHolidayYears: new Set(),
    };
  },
  computed: {
    hasSelectedEvent: {
      get() {
        return Boolean(this.selectedEvent);
      },
      set(open) {
        if (!open) this.selectedEvent = null;
      },
    },
    ...mapState(useAuth, ["user"]),
    ...mapState(useUi, { isUiOpen: "isOpen" }),
    ...mapState(useTheme, ["isDark"]),
    isAdmin() {
      const u = this.user || {};
      return (
        String(u.role || "").toUpperCase() === "ADMIN" ||
        (Array.isArray(u.roles) && u.roles.includes("ADMIN"))
      );
    },
    isVertrieb() {
      const u = this.user || {};
      return Array.isArray(u.roles) && u.roles.includes("VERTRIEB");
    },
    canSignaturen() {
      return this.isAdmin || this.isVertrieb;
    },
    sidebarStundenliste() {
      return this.stundenlisteStatus?.vorgang || null;
    },
    hasStundenliste() {
      return !!this.sidebarStundenliste;
    },
    selectedEventEinsaetze() {
      return this.selectedEvent?.einsaetze || [];
    },
    stundenlisteIsOutdated() {
      return this.stundenlisteStatus?.isOutdated || false;
    },
    stundenlisteOutdatedReasons() {
      return this.stundenlisteStatus?.outdatedReasons || [];
    },
    laufzettelImg() {
      return this.isDark ? laufzettelDarkIcon : laufzettelIcon;
    },
    eventreportImg() {
      return this.isDark ? eventreportDarkIcon : eventreportIcon;
    },
    currentWeekEnd() {
      if (!this.currentWeekStart) return null;
      const end = new Date(this.currentWeekStart);
      end.setDate(end.getDate() + 6);
      return end;
    },
    calendarWeekDate: {
      get() {
        return this.currentWeekStart;
      },
      set(date) {
        this.setDateFromPicker(date);
      },
    },
    currentKW() {
      if (!this.currentWeekStart) return "";
      return this.getWeekNumber(this.currentWeekStart);
    },
    weekScrollList() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dow = today.getDay() || 7;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - dow + 1);

      const currentStart = this.currentWeekStart
        ? new Date(this.currentWeekStart)
        : null;
      if (currentStart) currentStart.setHours(0, 0, 0, 0);

      const list = [];
      let prevYear = null;
      for (let i = -26; i <= 26; i++) {
        const d = new Date(thisMonday);
        d.setDate(thisMonday.getDate() + i * 7);
        const kw = this.getWeekNumber(d);
        const year = d.getFullYear();
        const isActive =
          !!currentStart && d.toDateString() === currentStart.toDateString();
        const isTodayWeek =
          today >= d && today < new Date(d.getTime() + 7 * 86400000);
        const showYear = year !== prevYear;
        prevYear = year;
        list.push({
          key: `${year}-${kw}`,
          kw,
          year,
          date: d,
          isActive,
          isTodayWeek,
          showYear,
        });
      }
      return list;
    },
    mobileDatePickerValue() {
      const d = this.weekDays[this.mobileDayIndex]?.date;
      if (!d) return "";
      return d.toISOString().slice(0, 10);
    },
    mobileDayDate() {
      return this.weekDays[this.mobileDayIndex]?.date || null;
    },
    showSearchDropdown() {
      return this.searchFocused && this.searchQuery.trim().length > 0;
    },
    dropdownStyle() {
      const r = this.searchWrapperRect;
      if (!r) return {};
      if (this.isMobile) {
        return {
          position: "fixed",
          top: r.bottom + 6 + "px",
          left: "12px",
          right: "12px",
          zIndex: 3000,
        };
      }
      // Desktop: wide, centered on search bar, clamped to viewport
      const vw = window.innerWidth;
      const dropW = Math.min(520, vw - 24);
      const idealLeft = r.left + r.width / 2 - dropW / 2;
      const left = Math.max(12, Math.min(idealLeft, vw - dropW - 12));
      return {
        position: "fixed",
        top: r.bottom + 6 + "px",
        left: left + "px",
        width: dropW + "px",
        zIndex: 3000,
      };
    },
    weekDays() {
      if (!this.currentWeekStart) return [];
      const days = [];
      const dayNames = [
        "MONTAG",
        "DIENSTAG",
        "MITTWOCH",
        "DONNERSTAG",
        "FREITAG",
        "SAMSTAG",
        "SONNTAG",
      ];
      for (let i = 0; i < 7; i++) {
        const date = new Date(this.currentWeekStart);
        date.setDate(date.getDate() + i);
        days.push({
          key: i,
          name: dayNames[i],
          date: date,
        });
      }
      return days;
    },
    filteredAuftraege() {
      if (!this.searchQuery.trim()) return this.auftraege;
      const words = this.searchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      return this.auftraege.filter((a) => {
        const haystack = [
          a.eventTitel,
          a.eventOrt,
          a.kundeData?.kundName,
          a.kundeData?.kuerzel,
          String(a.auftragNr || ""),
          ...(a.mitarbeiterNames || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    },
    availableGlobalLabels() {
      if (!this.selectedEvent) return this.globalLabels;
      const existing = new Set(
        (this.selectedEvent.labels || []).map((l) => l.name.toLowerCase()),
      );
      return this.globalLabels.filter(
        (gl) => !existing.has(gl.name.toLowerCase()),
      );
    },
    orderContextMenuItems() {
      const items = [
        {
          label: "Auftrag öffnen",
          icon: "fa-solid fa-arrow-up-right-from-square",
          action: "open",
          variant: "primary",
        },
        {
          label: "Pseudo-MA einplanen",
          icon: "fa-solid fa-user-plus",
          action: "plan-pseudo",
          variant: "primary",
        },
      ];
      if (this.contextMenu.event?.kundeData) {
        items.splice(1, 0, {
          label: "Kunde öffnen",
          icon: "fa-solid fa-building",
          action: "open-customer",
          variant: "primary",
        });
      }
      if (this.isAdmin) {
        items.push({
          label: "Stundenerfassung öffnen",
          icon: "fa-solid fa-clock",
          action: "open-time-entry",
        });
      }
      return items;
    },
    dayContextMenuItems() {
      return [
        {
          label: "Alle minimieren",
          icon: "fa-solid fa-angles-left",
          action: "collapse-all",
          variant: "primary",
        },
      ];
    },
    headerActionMenuItems() {
      const items = [
        {
          label: "Im Event-Editor öffnen",
          action: "open-editor",
          icon: "fa-solid fa-pencil",
        },
        {
          label: "Pseudo-MA einplanen",
          action: "plan-pseudo",
          icon: "fa-solid fa-user-plus",
        },
      ];
      if (this.selectedEvent?.isPseudo) {
        items.push({
          label: "Pseudo-Auftrag löschen",
          action: "delete-pseudo",
          icon: "fa-solid fa-trash",
          variant: "danger",
        });
      }
      return items;
    },
    documentMenuItems() {
      return [
        {
          label: this.isLoadingMitarbeiterExport
            ? "Mitarbeiterliste wird geladen..."
            : "Mitarbeiterliste (Excel)",
          action: "mitarbeiter-export",
          icon: this.isLoadingMitarbeiterExport
            ? "fa-solid fa-spinner"
            : "fa-solid fa-file-excel",
          disabled: this.isLoadingMitarbeiterExport,
        },
        {
          label: this.isGeneratingTelefonliste
            ? "Wird erstellt..."
            : "Telefonliste",
          action: "telefonliste",
          icon: this.isGeneratingTelefonliste
            ? "fa-solid fa-spinner"
            : "fa-solid fa-file",
          disabled: this.isGeneratingTelefonliste,
        },
        {
          label: "Stundenliste",
          action: "stundenliste",
          icon: "fa-solid fa-file-contract",
          disabled: this.hasStundenliste || this.isGeneratingHoursList,
        },
        {
          label: "Reisekostenabrechnung",
          action: "reisekosten",
          icon: "fa-solid fa-car",
        },
      ];
    },
    activeFilterCount() {
      let count = 0;
      if (this.filters.locationV2) count++;
      if (this.filters.bediener.length > 0) count++;
      if (this.filters.kunden.length > 0) count++;
      if (this.filters.bedarfStatus.length > 0) count++;
      if (this.filters.pseudoEinsatz) count++;
      return count;
    },
    listActiveFilterCount() {
      let count = 0;
      if (this.filters.locationV2) count++;
      if (this.filters.kunden.length > 0) count++;
      if (this.filters.bedarfStatus.length > 0) count++;
      if (this.filters.pseudoEinsatz) count++;
      return count;
    },
    mitarbeiterExportFilename() {
      const auftragNr = this.selectedEvent?.auftragNr || "Export";
      const eventTitle = String(this.selectedEvent?.eventTitel || "")
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      return ["Mitarbeiterliste", auftragNr, eventTitle].filter(Boolean).join("-") + ".xlsx";
    },
    // Maps the active Location v2 filter to its Bundesland code.
    activeStateLand() {
      const map = { 1: "BE", 2: "HH", 3: "NW" };
      const location = this.locations.find(
        (entry) => String(entry._id) === String(this.filters.locationV2),
      );
      return map[location?.externalId] || null;
    },
  },
  watch: {
    viewMode(value) {
      if (value === "list") this.ensureListPeriodLoaded(this.listPeriod, this.listReferenceDate);
    },
    currentWeekStart() {
      this.$nextTick(() => this.scrollKwToActive("smooth"));
      // Remember the viewed week so a page refresh returns to it.
      try {
        if (this.currentWeekStart)
          sessionStorage.setItem(
            "auftraege_week",
            this.currentWeekStart.toISOString(),
          );
      } catch (e) {
        /* storage unavailable */
      }
    },
    searchQuery() {
      this.debouncedSearch();
    },
    "$route.query.openPseudo"(value) {
      if (!value) return;
      this.handlePseudoRouteQuery();
    },
    async "$route.query.auftragnr"(auftragNr) {
      if (!auftragNr) return;
      await this.loadOrderDirectly(auftragNr, this.$route.query.focusDate);
    },
    selectedEvent(event) {
      // Remember the open sidebar so a page refresh reopens it.
      try {
        if (event && event.auftragNr)
          sessionStorage.setItem("auftraege_selected", String(event.auftragNr));
        else sessionStorage.removeItem("auftraege_selected");
      } catch (e) {
        /* storage unavailable */
      }
      if (event && event.auftragNr) {
        this.loadStundenlisteStatus(event.auftragNr);
        this.loadEinsatzDoks(event.auftragNr);
        this.loadReisekosten(event.auftragNr);
      } else {
        this.stundenlisteStatus = null;
        this.einsatzDoks = [];
        this.reisekostenListe = [];
      }
    },
  },
  methods: {
    // ── Feiertage ──────────────────────────────────────────────────────────
    async ensureHolidayYearLoaded(year) {
      if (this.loadedHolidayYears.has(year)) return;
      // Mark first to prevent concurrent duplicate loads
      this.loadedHolidayYears.add(year);
      const lookup = await loadHolidaysForYear(year);
      Object.assign(this.holidayMap, Object.fromEntries(lookup));
    },
    getHolidayForDate(date) {
      const d = date instanceof Date ? date : new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return this.holidayMap[key] || null;
    },
    isHolidayRelevant(holiday) {
      if (!holiday) return false;
      if (!this.activeStateLand) return holiday.isNational;
      return holiday.states.includes(this.activeStateLand);
    },
    // ──────────────────────────────────────────────────────────────────────────
    async fetchDataStatus() {
      try {
        const response = await api.get("/api/import/last-uploads");
        if (response.data.success) {
          const uploads = response.data.data;
          const lastKomplettImport = uploads["einsatz-komplett"];
          if (lastKomplettImport) {
            this.dataStatus = lastKomplettImport.timestamp;
          }
        }
      } catch (err) {
        console.error("Error fetching data status:", err);
      }
    },
    async fetchLocations() {
      try {
        const { data } = await api.get("/api/locations");
        this.locations = data || [];

        const hasLegacyGeschSt = Object.hasOwn(this.filters, "geschSt");
        const legacyGeschSt = String(this.filters.geschSt || "").trim();
        let filtersChanged = hasLegacyGeschSt;
        if (!this.filters.locationV2 && legacyGeschSt) {
          this.filters.locationV2 =
            this.getLocationIdForExternalId(legacyGeschSt);
        }
        delete this.filters.geschSt;

        if (
          this.filters.locationV2 &&
          !this.locations.some(
            (location) =>
              String(location._id) === String(this.filters.locationV2),
          )
        ) {
          this.filters.locationV2 = null;
          filtersChanged = true;
        }
        if (filtersChanged) this.saveFiltersToStorage();
      } catch (error) {
        console.error("Error fetching locations:", error);
        this.locations = [];
      }
    },
    getLocationIdForExternalId(externalId) {
      const location = this.locations.find(
        (entry) =>
          String(entry.externalId || "").trim() ===
          String(externalId || "").trim(),
      );
      return location ? String(location._id) : null;
    },
    getUserLocationId() {
      const locationId = this.user?.locationV2?._id || this.user?.locationV2;
      if (
        locationId &&
        this.locations.some(
          (location) => String(location._id) === String(locationId),
        )
      ) {
        return String(locationId);
      }

      const legacyLocation = String(
        this.user?.location || this.user?.standort || "",
      )
        .trim()
        .toLocaleLowerCase("de");
      const location = this.locations.find((entry) =>
        [entry.nameFull, entry.shortName]
          .filter(Boolean)
          .some(
            (name) =>
              String(name).trim().toLocaleLowerCase("de") === legacyLocation,
          ),
      );
      return location ? String(location._id) : null;
    },
    formatDataStatus(dateStr) {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    // Determine shifts and metadata from event details (Lazy Load)
    calculateSchichten(event) {
      return buildEventSchichten(event);
    },

    schichtStundenlisteIncluded(schichtData) {
      return schichtData.einsaetze.every(
        (einsatz) => einsatz.stundenlisteIncluded !== false,
      );
    },
    isStundenlisteTogglePending(einsaetze) {
      return einsaetze.some(
        (einsatz) => this.stundenlisteTogglePending[einsatz._id],
      );
    },
    async toggleSchichtStundenlisteInclusion(schichtData) {
      const included = !this.schichtStundenlisteIncluded(schichtData);
      await Promise.all(
        schichtData.einsaetze.map((einsatz) =>
          this.updateStundenlisteInclusion(einsatz, included),
        ),
      );
    },
    async toggleEinsatzStundenlisteInclusion(einsatz) {
      await this.updateStundenlisteInclusion(
        einsatz,
        einsatz.stundenlisteIncluded === false,
      );
    },
    async updateStundenlisteInclusion(einsatz, included) {
      if (
        !this.selectedEvent?.auftragNr ||
        this.stundenlisteTogglePending[einsatz._id]
      )
        return;
      this.stundenlisteTogglePending[einsatz._id] = true;
      try {
        await api.patch(
          `/api/auftraege/${this.selectedEvent.auftragNr}/einsaetze/${einsatz._id}`,
          { stundenlisteIncluded: included },
        );
        einsatz.stundenlisteIncluded = included;
        await this.loadStundenlisteStatus(this.selectedEvent.auftragNr);
      } catch (error) {
        console.error(
          "Stundenlisten-Einbindung konnte nicht aktualisiert werden:",
          error,
        );
        alert(
          error.response?.data?.message ||
            "Stundenlisten-Einbindung konnte nicht aktualisiert werden",
        );
      } finally {
        delete this.stundenlisteTogglePending[einsatz._id];
      }
    },

    hasMitarbeiterDragPayload(event) {
      const types = Array.from(event.dataTransfer?.types || []);
      return (
        types.includes("application/x-straight-monitor-mitarbeiter") ||
        types.includes("application/json")
      );
    },
    handleSchichtDragEnter(event, schichtData) {
      if (this.hasMitarbeiterDragPayload(event))
        this.schichtDragOverKey = schichtData.key;
    },
    handleSchichtDragOver(event, schichtData) {
      if (!this.hasMitarbeiterDragPayload(event)) return;
      event.dataTransfer.dropEffect = "move";
      this.schichtDragOverKey = schichtData.key;
    },
    handleSchichtDragLeave(event, schichtData) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      if (this.schichtDragOverKey === schichtData.key)
        this.schichtDragOverKey = null;
    },
    handleMitarbeiterDrop(event, schichtData) {
      this.schichtDragOverKey = null;
      const rawPayload =
        event.dataTransfer?.getData(
          "application/x-straight-monitor-mitarbeiter",
        ) || event.dataTransfer?.getData("application/json");
      if (!rawPayload) return;

      try {
        const mitarbeiter = JSON.parse(rawPayload);
        if (!mitarbeiter?._id && !mitarbeiter?.mitarbeiterId) return;
        this.$emit("mitarbeiter-drop", {
          mitarbeiter,
          auftragNr: this.selectedEvent?.auftragNr || null,
          schichtId: schichtData.meta.schichtId,
          idAuftragArbeitsschichten:
            schichtData.meta.idAuftragArbeitsschichten || schichtData.key,
          datumVon: schichtData.meta.datumVon,
        });
      } catch (error) {
        console.warn("Ungültiger Mitarbeiter-Drag-Payload:", error);
      }
    },

    // Check if all einsaetze in a schicht have the same beruf
    getCommonBeruf(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstBeruf = einsaetze[0].berufData;
      if (!firstBeruf) return null;

      const allSame = einsaetze.every(
        (e) => e.berufData?.jobKey === firstBeruf.jobKey,
      );

      return allSame ? firstBeruf : null;
    },

    // Check if all einsaetze in a schicht have the same qualifikation
    getCommonQualifikation(einsaetze) {
      if (!einsaetze || einsaetze.length === 0) return null;
      const firstQuali = einsaetze[0].qualifikationData;
      if (!firstQuali) return null;

      const allSame = einsaetze.every(
        (e) =>
          e.qualifikationData?.qualificationKey === firstQuali.qualificationKey,
      );

      return allSame ? firstQuali : null;
    },
    checkMobile() {
      this.isMobile = window.innerWidth <= 768;
    },
    openMobileDatePicker() {
      this.$refs.mobileDatePicker?.showPicker?.() ??
        this.$refs.mobileDatePicker?.click();
    },
    async jumpToDate(event) {
      const selected = new Date(event.target.value + "T00:00:00");
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
    async setDateFromPicker(date) {
      if (!date) return;
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(date);
      monday.setDate(date.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      this.currentWeekStart = monday;
      await this.ensureMonthLoaded(monday);
      this.mobileDayIndex = day === 0 ? 6 : day - 1;
    },
    async selectSearchResult(auftrag) {
      this.searchQuery = "";
      this.searchFocused = false;
      if (auftrag.vonDatum) {
        await this.setDateFromPicker(new Date(auftrag.vonDatum));
      }
      await this.$nextTick();
      this.selectEvent(auftrag);
    },
    openOrderContextMenu(event, auftrag) {
      if (!auftrag) return;
      const menuW = 200;
      const menuH = 120;
      const x =
        event.clientX + menuW > window.innerWidth
          ? event.clientX - menuW
          : event.clientX;
      const y =
        event.clientY + menuH > window.innerHeight
          ? event.clientY - menuH
          : event.clientY;

      this.contextMenu = {
        open: true,
        x: Math.max(12, x),
        y: Math.max(12, y),
        event: auftrag,
        day: null,
      };
    },
    openDayContextMenu(event, day) {
      if (!day) return;
      const menuW = 200;
      const menuH = 80;
      const x =
        event.clientX + menuW > window.innerWidth
          ? event.clientX - menuW
          : event.clientX;
      const y =
        event.clientY + menuH > window.innerHeight
          ? event.clientY - menuH
          : event.clientY;

      this.contextMenu = {
        open: true,
        x: Math.max(12, x),
        y: Math.max(12, y),
        event: null,
        day,
      };
    },
    closeOrderContextMenu() {
      this.contextMenu.open = false;
      this.contextMenu.event = null;
      this.contextMenu.day = null;
    },
    async handleOrderContextMenuAction(action) {
      const auftrag = this.contextMenu.event;
      const day = this.contextMenu.day;
      if (action === "collapse-all" && day) {
        this.collapseCustomerGroupsForDay(day.date);
        this.closeOrderContextMenu();
        return;
      }
      if (!auftrag) return;
      this.closeOrderContextMenu();

      if (action === "open") {
        await this.selectEvent(auftrag);
      } else if (action === "open-customer" && auftrag.kundeData) {
        await this.openKundeCard(auftrag.kundeData);
      } else if (action === "plan-pseudo") {
        await this.selectEvent(auftrag);
        this.openPseudoDialog();
      } else if (action === "open-time-entry") {
        this.openTimeCapture({ auftragNr: String(auftrag.auftragNr) });
      }
    },
    toggleQuickActionsMenu(event) {
      if (this.showQuickActions) {
        this.showQuickActions = false;
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      this.quickActionsPosition = { x: rect.right - 230, y: rect.bottom + 6 };
      this.showQuickActions = true;
    },
    async handleHeaderActionMenuAction(action) {
      this.showQuickActions = false;
      if (action === "open-editor") await this.openEventEditor();
      if (action === "manage-labels") await this.openLabelDialog();
      if (action === "plan-pseudo") this.openPseudoDialog();
      if (action === "create-hours-list") await this.createStundenliste();
      if (action === "open-signature") await this.openSignatureDialog();
      if (action === "delete-pseudo") await this.deletePseudoAuftrag();
    },
    onSearchFocusIn(e) {
      const rect = e.currentTarget.getBoundingClientRect();
      this.searchWrapperRect = {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
      this.searchFocused = true;
    },
    onSearchFocusOut(e) {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        this.searchFocused = false;
      }
    },
    formatDropdownDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const weekday = d
        .toLocaleDateString("de-DE", { weekday: "short" })
        .replace(/\.$/, "");
      const date = d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return `${weekday}. ${date}`;
    },
    stundenlistePdfFilename(signed = false) {
      const event = this.selectedEvent || {};
      const safeTitle = String(
        event.eventTitel || `Auftrag ${event.auftragNr || ""}`,
      )
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/-{2,}/g, "-")
        .replace(/^[.\s-]+|[.\s-]+$/g, "");
      const date = event.vonDatum ? new Date(event.vonDatum) : null;
      const dateText =
        date && !Number.isNaN(date.getTime())
          ? `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${date.getUTCFullYear()}`
          : "";
      const parts = ["Stundenliste", safeTitle || "Auftrag", dateText].filter(
        Boolean,
      );
      if (signed) parts.push("unterschrieben");
      return `${parts.join(" - ")}.pdf`;
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
      monday.setHours(0, 0, 0, 0);

      this.currentWeekStart = monday;

      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);

      // Load both start and end month of the week to handle crossovers
      await this.ensureMonthLoaded(monday);
      await this.ensureMonthLoaded(sunday);
    },
    async loadAuftraege(fromDate, toDate) {
      this.loading = true;
      // Proactively load holiday data for the requested year(s)
      if (fromDate) {
        await this.ensureHolidayYearLoaded(fromDate.getFullYear());
        if (toDate && toDate.getFullYear() !== fromDate.getFullYear()) {
          await this.ensureHolidayYearLoaded(toDate.getFullYear());
        }
      }
      try {
        const params = new URLSearchParams();
        if (fromDate) params.append("from", fromDate.toISOString());
        if (toDate) params.append("to", toDate.toISOString());

        // Add Filters
        if (this.filters.locationV2) {
          params.append("locationV2", this.filters.locationV2);
        }
        if (this.filters.bediener && this.filters.bediener.length > 0) {
          params.append("bediener", this.filters.bediener.join(","));
        }
        if (this.filters.kunden && this.filters.kunden.length > 0) {
          params.append("kunden", this.filters.kunden.join(","));
        }
        if (this.filters.bedarfStatus.length > 0) {
          params.append("bedarfStatus", this.filters.bedarfStatus.join(","));
        }
        if (this.filters.pseudoEinsatz) {
          params.append("pseudoEinsatz", "true");
        }

        const response = await api.get(`/api/auftraege?${params.toString()}`);

        // Merge with existing, avoiding duplicates
        const existingIds = new Set(this.auftraege.map((a) => a._id));
        const newAuftraege = response.data.filter(
          (a) => !existingIds.has(a._id),
        );
        this.auftraege = [...this.auftraege, ...newAuftraege];
      } catch (error) {
        console.error("Error loading Aufträge:", error);
      } finally {
        this.loading = false;
      }
    },
    async fetchFilterOptions() {
      try {
        const params = new URLSearchParams();
        if (this.filters.locationV2) {
          params.append("locationV2", this.filters.locationV2);
        }
        const res = await api.get(
          `/api/auftraege/filters?${params.toString()}`,
        );
        this.filterOptions.bediener = res.data.bediener || [];
        this.filterOptions.kunden = res.data.kunden || [];
      } catch (e) {
        console.error("Error fetching filters", e);
      }
    },
    setDefaultFilters() {
      // Only set defaults if no saved filters in sessionStorage
      const savedFilters = sessionStorage.getItem("auftraege_filters");
      if (savedFilters) {
        // Filters already loaded from storage in data()
        return;
      }

      this.filters.locationV2 = this.getUserLocationId();
    },
    saveFiltersToStorage() {
      const filters = {
        locationV2: this.filters.locationV2,
        bediener: this.filters.bediener,
        kunden: this.filters.kunden,
        bedarfStatus: this.filters.bedarfStatus,
        pseudoEinsatz: this.filters.pseudoEinsatz,
        displayLevels: this.filters.displayLevels,
      };
      sessionStorage.setItem("auftraege_filters", JSON.stringify(filters));
    },
    toggleFilters() {
      this.filtersExpanded = !this.filtersExpanded;
    },
    setLocationFilter(locationId) {
      const next = this.filters.locationV2 === locationId ? null : locationId;
      this.filters.locationV2 = next;
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
    onKundenFilterChange() {
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    setKundenFilter(kunden) {
      this.filters.kunden = kunden;
      this.onKundenFilterChange();
    },
    togglePseudoEinsatzFilter() {
      this.filters.pseudoEinsatz = !this.filters.pseudoEinsatz;
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    toggleBedarfStatusFilter(status) {
      const idx = this.filters.bedarfStatus.indexOf(status);
      if (idx === -1) {
        this.filters.bedarfStatus.push(status);
      } else {
        this.filters.bedarfStatus.splice(idx, 1);
      }
      this.saveFiltersToStorage();
      this.resetAndReload();
    },
    toggleDisplayLevel(level) {
      this.filters.displayLevels[level] = !this.filters.displayLevels[level];
      this.saveFiltersToStorage();
    },
    shouldDisplayEventCards() {
      return (
        this.filters.displayLevels.auftrag || this.filters.displayLevels.schicht
      );
    },
    resetAllFilters() {
      this.filters.locationV2 = null;
      this.filters.bediener = [];
      this.filters.kunden = [];
      this.filters.bedarfStatus = [];
      this.filters.pseudoEinsatz = false;
      this.filters.displayLevels = {
        kunde: true,
        auftrag: true,
        schicht: true,
        einsatz: false,
      };
      // Clear storage on reset, then apply user defaults
      sessionStorage.removeItem("auftraege_filters");
      this.filters.locationV2 = this.getUserLocationId();
      this.saveFiltersToStorage();
      this.fetchFilterOptions();
      this.resetAndReload();
    },
    resetListFilters() {
      this.filters.locationV2 = this.getUserLocationId();
      this.filters.kunden = [];
      this.filters.bedarfStatus = [];
      this.filters.pseudoEinsatz = false;
      this.saveFiltersToStorage();
      this.fetchFilterOptions();
      this.resetAndReload();
    },
    async resetAndReload() {
      this.auftraege = []; // Clear current list
      this.loadedMonths.clear(); // Reset cache

      if (this.viewMode === "list") {
        await this.ensureListPeriodLoaded(this.listPeriod, this.listReferenceDate);
        return;
      }

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
    async setListPeriod(period) {
      if (this.listPeriod === period) return;
      this.listPeriod = period;
      await this.ensureListPeriodLoaded(period, this.listReferenceDate);
    },
    async setListReferenceDate(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
      this.listReferenceDate = new Date(date);
      await this.ensureListPeriodLoaded(this.listPeriod, this.listReferenceDate);
    },
    async ensureListPeriodLoaded(period, referenceDate = this.listReferenceDate) {
      const { start, end } = getPeriodRange(period, referenceDate);
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      let firstMissing = null;
      let lastMissing = null;

      while (cursor <= end) {
        const month = new Date(cursor);
        const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
        if (!this.loadedMonths.has(monthKey)) {
          firstMissing ||= month;
          lastMissing = month;
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }

      if (!firstMissing) return;

      const loadEnd = new Date(
        lastMissing.getFullYear(),
        lastMissing.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      await this.loadAuftraege(firstMissing, loadEnd);

      const loadedMonth = new Date(firstMissing);
      while (loadedMonth <= loadEnd) {
        this.loadedMonths.add(`${loadedMonth.getFullYear()}-${loadedMonth.getMonth()}`);
        loadedMonth.setMonth(loadedMonth.getMonth() + 1);
      }
    },
    async loadInitialData() {
      // Load current month and all future
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      await this.loadAuftraege(startOfMonth, null);
      // Mark the next 24 months as loaded — the initial fetch has no upper bound
      // and already contains all future data, so don't re-fetch them on navigation.
      for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        this.loadedMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
      }
    },
    async ensureMonthLoaded(date) {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (this.loadedMonths.has(monthKey)) return;

      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      await this.loadAuftraege(startOfMonth, endOfMonth);
      this.loadedMonths.add(monthKey);
    },
    jumpToWeek(date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      this.currentWeekStart = d;
      this.ensureMonthLoaded(d);
      // Prefetch the next 2 months ahead of the jump target
      for (let i = 1; i <= 2; i++) {
        const ahead = new Date(d.getFullYear(), d.getMonth() + i, 1);
        this.ensureMonthLoaded(ahead); // intentionally not awaited
      }
    },
    scrollKwToActive(behavior = "instant") {
      const container = this.$refs.kwScroller;
      if (!container) return;
      const active = container.querySelector(".kw-week-btn.is-active");
      if (!active) return;
      // Dock the active KW directly under the container header
      const target = active.offsetTop - 6; // Accounts for scroller padding
      if (behavior === "instant") {
        container.scrollTop = Math.max(0, target);
      } else {
        container.scrollTo({ top: Math.max(0, target), behavior });
      }
    },

    delayedScrollKwToActive() {
      if (this.kwScrollTimer) clearTimeout(this.kwScrollTimer);
      this.kwScrollTimer = setTimeout(() => {
        this.scrollKwToActive("smooth");
      }, 500);
    },

    clearKwScrollTimer() {
      if (this.kwScrollTimer) clearTimeout(this.kwScrollTimer);
    },

    scrollKwToToday(behavior = "smooth") {
      const container = this.$refs.kwScroller;
      if (!container) return;
      const todayWeek = container.querySelector(".kw-week-btn.is-today-week");
      if (!todayWeek) return;
      const target = todayWeek.offsetTop - 6; // Accounts for scroller padding
      if (behavior === "instant") {
        container.scrollTop = Math.max(0, target);
      } else {
        container.scrollTo({ top: Math.max(0, target), behavior });
      }
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
      // Silently prefetch the next 2 months so forward navigation never triggers a visible reload
      for (let i = 1; i <= 2; i++) {
        const ahead = new Date(
          newStart.getFullYear(),
          newStart.getMonth() + i,
          1,
        );
        this.ensureMonthLoaded(ahead); // intentionally not awaited
      }
    },
    goToToday() {
      this.initializeWeek();
    },
    openDatePicker() {
      if (this.$refs.datePicker) {
        // showPicker() is supported in modern browsers to open the dialog directly
        if (typeof this.$refs.datePicker.showPicker === "function") {
          this.$refs.datePicker.showPicker();
        } else {
          this.$refs.datePicker.click();
        }
      }
    },
    async handleDatePick(event) {
      const val = event.target.value;
      if (!val) return;

      const date = new Date(val + "T00:00:00");
      // Calculate start of that week (Monday)
      const Day = date.getDay() || 7; // Sunday is 0 -> make it 7
      date.setDate(date.getDate() - Day + 1); // Set to Monday

      this.currentWeekStart = date;
      await this.ensureMonthLoaded(date);

      // Reset picker
      event.target.value = "";
    },
    getTotalPositionsForDay(date) {
      const events = this.getEventsForDay(date);
      return events.reduce((sum, event) => {
        let count = 0;
        if (typeof event.einsaetzeCount === "number") {
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

      return this.filteredAuftraege
        .filter((a) => {
          const von = new Date(a.vonDatum);
          const bis = new Date(a.bisDatum);
          // Event spans this day if: vonDatum <= dayEnd AND bisDatum >= dayStart
          return von <= dayEnd && bis >= dayStart;
        })
        .sort((a, b) => {
          // Sort by earliest Einsatz time (uhrzeitVon e.g. "08:00"), falling back to vonDatum
          const aTime = a.earliestEinsatzTime?.uhrzeitVon;
          const bTime = b.earliestEinsatzTime?.uhrzeitVon;
          if (aTime && bTime) return aTime.localeCompare(bTime);
          if (aTime) return -1;
          if (bTime) return 1;
          return new Date(a.vonDatum) - new Date(b.vonDatum);
        });
    },
    getEventGroupsForDay(date) {
      const groups = new Map();

      this.getEventsForDay(date).forEach((event) => {
        const key = event.kundenNr ?? "without-customer";
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            label:
              event.kundeData?.kuerzel ||
              event.kundeData?.kundName ||
              "Ohne Kunde",
            events: [],
          });
        }
        groups.get(key).events.push(event);
      });

      return [...groups.values()].sort((a, b) =>
        a.label.localeCompare(b.label, "de"),
      );
    },
    getCustomerGroupStateKey(date, customerKey) {
      return `${new Date(date).toISOString().slice(0, 10)}:${customerKey}`;
    },
    isCustomerGroupCollapsed(date, customerKey) {
      return Boolean(
        this.collapsedCustomerGroups[
          this.getCustomerGroupStateKey(date, customerKey)
        ],
      );
    },
    toggleCustomerGroup(date, customerKey) {
      const key = this.getCustomerGroupStateKey(date, customerKey);
      this.collapsedCustomerGroups[key] = !this.collapsedCustomerGroups[key];
    },
    collapseCustomerGroupsForDay(date) {
      this.getEventGroupsForDay(date).forEach(({ key }) => {
        this.collapsedCustomerGroups[this.getCustomerGroupStateKey(date, key)] =
          true;
      });
    },
    toggleCustomerGroupsForDay(date) {
      const groups = this.getEventGroupsForDay(date);
      const allCollapsed =
        groups.length > 0 &&
        groups.every(({ key }) => this.isCustomerGroupCollapsed(date, key));

      groups.forEach(({ key }) => {
        this.collapsedCustomerGroups[this.getCustomerGroupStateKey(date, key)] =
          !allCollapsed;
      });
    },
    async selectEvent(event) {
      this.showQuickActions = false;
      this.auftragDocs = [];
      // Load full details including Einsätze
      try {
        const response = await api.get(
          `/api/auftraege/${event.auftragNr}/details`,
        );
        this.selectedEvent = response.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
        this.fetchAuftragDocs(event.auftragNr);
      } catch (error) {
        console.error("Error loading event details:", error);
        this.selectedEvent = event; // fallback to basic data
        this.preparedSchichten = this.calculateSchichten(event);
      }
    },
    openEventEditor() {
      if (!this.selectedEvent) return;
      this.showQuickActions = false;
      this.openEvent(this.selectedEvent, {
        onUpdated: (updatedEvent) => {
          const eventIndex = this.auftraege.findIndex(
            (item) => String(item.auftragNr) === String(updatedEvent.auftragNr),
          );
          if (eventIndex !== -1) {
            this.auftraege.splice(eventIndex, 1, {
              ...this.auftraege[eventIndex],
              ...updatedEvent,
            });
          }
          if (
            String(this.selectedEvent?.auftragNr) ===
            String(updatedEvent.auftragNr)
          ) {
            this.selectedEvent = updatedEvent;
            this.preparedSchichten = this.calculateSchichten(updatedEvent);
          }
        },
      });
    },
    async fetchAuftragDocs(auftragNr) {
      try {
        console.log("[AuftraegePage] Fetching docs for auftragNr:", auftragNr);
        const res = await api.get(`/api/reports/by-auftrag/${auftragNr}`);
        this.auftragDocs = res.data?.data || [];
        console.log(
          "[AuftraegePage] Loaded docs:",
          this.auftragDocs.length,
          this.auftragDocs,
        );
      } catch (e) {
        console.error("[AuftraegePage] Error loading docs for auftrag:", e);
        this.auftragDocs = [];
      }
    },
    getDocsForMitarbeiter(mitarbeiterId) {
      if (!mitarbeiterId || !this.auftragDocs.length) return [];
      return this.auftragDocs.filter((doc) => {
        const d = doc.details;
        // EventReport: teamleiter is the author
        if (doc.docType === "Event-Bericht") {
          const tlId =
            typeof d.teamleiter === "object" ? d.teamleiter?._id : d.teamleiter;
          return String(tlId) === String(mitarbeiterId);
        }
        // Laufzettel: mitarbeiter or teamleiter
        const maId =
          typeof d.mitarbeiter === "object"
            ? d.mitarbeiter?._id
            : d.mitarbeiter;
        const tlId =
          typeof d.teamleiter === "object" ? d.teamleiter?._id : d.teamleiter;
        return (
          String(maId) === String(mitarbeiterId) ||
          String(tlId) === String(mitarbeiterId)
        );
      });
    },
    openDocCard(doc) {
      this.openDocumentModal(doc, {
        eventTitle: this.selectedEvent?.eventTitel,
      });
    },
    formatDayDateFull(dateStr) {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },
    getBedarfClass(event) {
      const s = event.schichtStatus;
      if (!s || s === "none") return "bedarf-none";
      return `bedarf-${s}`;
    },
    getShiftBedarfClass(shift) {
      const required = Number(shift?.bedarf || 0);
      const assigned = Number(shift?.besetzt || 0);
      if (!required) return "bedarf-none";
      if (!assigned) return "bedarf-all-empty";
      if (assigned < required) return assigned === 1 ? "bedarf-some-empty" : "bedarf-underbooked";
      if (assigned === required) return "bedarf-full";
      return "bedarf-overbooked";
    },
    getSchichtenForDay(event, date) {
      if (!event.schichten?.length || !date) return [];
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      return event.schichten.filter((s) => {
        if (!s.datumVon) return false;
        const sd = new Date(s.datumVon);
        return sd >= d && sd < next;
      });
    },
    getEventStatusClass(event) {
      // Color coding based on status
      const status = event.auftStatus;
      if (status === 1) return "status-draft";
      if (status === 2) return "status-confirmed";
      if (status === 3) return "status-completed";
      return "status-default";
    },
    getStatusText(status) {
      const map = { 1: "Unbestätigt", 2: "Bestätigt", 3: "Abgeschlossen" };
      return map[status] || "Unbekannt";
    },
    getWeekNumber(date) {
      const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
      );
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    },
    isToday(date) {
      const today = new Date();
      return date.toDateString() === today.toDateString();
    },
    formatDateRange(start, end) {
      if (!start || !end) return "";
      const opts = { day: "numeric", month: "short", year: "numeric" };
      const startDate = start.toLocaleDateString("de-DE", opts);
      const endDate = end.toLocaleDateString("de-DE", opts);
      return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
    },
    formatDayDate(date) {
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return "Heute";
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Europe/Berlin",
      });
    },
    formatTime(dateStr) {
      if (!dateStr) return "-";
      // Already a clean HH:MM or HH:MM:SS string
      if (
        typeof dateStr === "string" &&
        /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateStr)
      ) {
        return dateStr.substring(0, 5);
      }
      // Full JS .toString() date string e.g. "Sun Dec 31 1899 10:00:00 GMT+0100 (...)"
      // Extract HH:MM directly from the string — no timezone conversion!
      if (typeof dateStr === "string") {
        const m = dateStr.match(/\d{4} (\d{2}:\d{2}):\d{2}/);
        if (m) return m[1];
      }
      return "-";
    },
    formatDateTime(dateStr) {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Berlin",
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
        this.runOrderSearch();
      }, 300);
    },
    async runOrderSearch() {
      const q = this.searchQuery.trim();
      if (!q) {
        this.searchDropdownResults = [];
        this.searchLoading = false;
        return;
      }
      this.searchLoading = true;
      try {
        const params = { q };
        if (this.filters.locationV2)
          params.locationV2 = this.filters.locationV2;
        const res = await api.get("/api/auftraege/search", { params });
        // Ignore stale responses (query changed while request was in flight)
        if (this.searchQuery.trim() !== q) return;
        const now = Date.now();
        const MS_PER_DAY = 86400000;
        this.searchDropdownResults = (res.data || [])
          .map((a) => {
            let score = 0;
            if (a.vonDatum) {
              const daysDiff =
                (new Date(a.vonDatum).getTime() - now) / MS_PER_DAY;
              const effectiveDist =
                daysDiff >= 0 ? daysDiff / 4 : Math.abs(daysDiff);
              score = 1 / (effectiveDist + 1);
            }
            return { ...a, _score: score };
          })
          .sort((a, b) => b._score - a._score)
          .slice(0, 8);
      } catch (e) {
        console.error("Auftrag-Suche fehlgeschlagen:", e);
        if (this.searchQuery.trim() === q) this.searchDropdownResults = [];
      } finally {
        if (this.searchQuery.trim() === q) this.searchLoading = false;
      }
    },
    async openKundeCard(kundeBasic) {
      try {
        const response = await api.get(`/api/kunden/${kundeBasic._id}`);
        this.openCustomer(response.data);
      } catch (error) {
        console.error("Error loading Kunden details:", error);
        // Fallback to basic data
        this.openCustomer(kundeBasic);
      }
    },
    async openMitarbeiterCard(mitarbeiterBasic) {
      this.selectedMitarbeiter = mitarbeiterBasic;
    },

    // Check if a mitarbeiter is a Teamleiter based on qualification 50055
    isTeamleiter(mitarbeiter) {
      if (!mitarbeiter?.qualifikationen?.length) return false;
      return mitarbeiter.qualifikationen.some((q) => {
        const key = parseInt(String(q.qualificationKey || q), 10);
        return key === 50055;
      });
    },

    // ── Quick Actions ────────────────────────────────────────────────────────
    async openLabelDialog() {
      this.showQuickActions = false;
      this.newLabelName = "";
      this.newLabelColor = "#4f46e5";
      try {
        const res = await api.get("/api/auftraege/labels");
        this.globalLabels = res.data || [];
      } catch {
        this.globalLabels = [];
      }
      this.showLabelDialog = true;
    },
    async quickAddLabel(gl) {
      await this.saveLabel(gl.name, gl.color);
    },
    async saveLabel(nameArg, colorArg) {
      if (this.labelSaving || this.labelRemovingId || !this.selectedEvent) return;
      const selectedEvent = this.selectedEvent;
      const name =
        typeof nameArg === "string" ? nameArg : this.newLabelName.trim();
      const color =
        typeof colorArg === "string" ? colorArg : this.newLabelColor;
      if (!name) return;
      this.labelSaving = true;
      try {
        const res = await api.post(
          `/api/auftraege/${selectedEvent.auftragNr}/labels`,
          { name, color },
        );
        selectedEvent.labels = res.data.labels;
        // Sync to auftraege list
        const idx = this.auftraege.findIndex(
          (a) => a.auftragNr === selectedEvent.auftragNr,
        );
        if (idx !== -1) this.auftraege[idx].labels = res.data.labels;
        this.newLabelName = "";
        // Refresh global labels
        const gr = await api.get("/api/auftraege/labels");
        this.globalLabels = gr.data || [];
      } catch (err) {
        alert(err.response?.data?.message || "Fehler beim Speichern");
      } finally {
        this.labelSaving = false;
      }
    },
    async removeLabel(labelId) {
      if (this.labelSaving || this.labelRemovingId || !this.selectedEvent) return;
      const selectedEvent = this.selectedEvent;
      this.labelRemovingId = labelId;
      try {
        const res = await api.delete(
          `/api/auftraege/${selectedEvent.auftragNr}/labels/${labelId}`,
        );
        selectedEvent.labels = res.data.labels;
        const idx = this.auftraege.findIndex(
          (a) => a.auftragNr === selectedEvent.auftragNr,
        );
        if (idx !== -1) this.auftraege[idx].labels = res.data.labels;
      } catch (err) {
        alert(err.response?.data?.message || "Fehler beim Entfernen");
      } finally {
        this.labelRemovingId = "";
      }
    },
    openNewAuftragDialog() {
      const today = new Date().toISOString().slice(0, 10);
      this.newAuftrag = {
        eventTitel: "",
        vonDatum: today,
        bisDatum: today,
        locationV2: this.filters.locationV2 || "",
        eventLocation: "",
        eventOrt: "",
      };
      this.newAuftragSaving = false;
      this.showNewAuftragDialog = true;
    },
    handlePseudoRouteQuery() {
      if (!this.$route.query.openPseudo) return;

      this.openNewAuftragDialog();

      const nextQuery = { ...this.$route.query };
      delete nextQuery.openPseudo;

      this.$router.replace({ query: nextQuery });
    },
    async saveNewPseudoAuftrag() {
      if (
        this.newAuftragSaving ||
        !this.newAuftrag.eventTitel.trim() ||
        !this.newAuftrag.vonDatum ||
        !this.newAuftrag.bisDatum
      )
        return;
      this.newAuftragSaving = true;
      try {
        const payload = {
          eventTitel: this.newAuftrag.eventTitel.trim(),
          vonDatum: this.newAuftrag.vonDatum,
          bisDatum: this.newAuftrag.bisDatum,
        };
        if (this.newAuftrag.locationV2)
          payload.locationV2 = this.newAuftrag.locationV2;
        if (this.newAuftrag.eventLocation.trim())
          payload.eventLocation = this.newAuftrag.eventLocation.trim();
        if (this.newAuftrag.eventOrt.trim())
          payload.eventOrt = this.newAuftrag.eventOrt.trim();
        const res = await api.post("/api/auftraege", payload);
        const newAuftragData = res.data;
        // Add to local list so it appears in the calendar
        this.auftraege.push({
          ...newAuftragData,
          einsaetzeCount: 0,
          schichten: [],
          schichtStatus: "none",
          mitarbeiterNames: [],
        });
        this.showNewAuftragDialog = false;
        // Open the new event in the sidebar
        await this.selectEvent(newAuftragData);
      } catch (err) {
        alert(
          err.response?.data?.message || "Fehler beim Anlegen des Auftrags",
        );
      } finally {
        this.newAuftragSaving = false;
      }
    },
    async deletePseudoAuftrag() {
      if (!this.selectedEvent?.isPseudo) return;
      if (
        !confirm(
          `Pseudo-Auftrag "${this.selectedEvent.eventTitel}" und alle zugehörigen Pseudo-Einsätze löschen?`,
        )
      )
        return;
      try {
        await api.delete(`/api/auftraege/${this.selectedEvent.auftragNr}`);
        this.auftraege = this.auftraege.filter(
          (a) => a.auftragNr !== this.selectedEvent.auftragNr,
        );
        this.selectedEvent = null;
        this.showQuickActions = false;
      } catch (err) {
        alert(err.response?.data?.message || "Fehler beim Löschen");
      }
    },
    async ensureStundenlisteDraft({ allowReplacement = false } = {}) {
      if (!this.selectedEvent?.auftragNr || this.isGeneratingHoursList)
        return null;
      if (this.sidebarStundenliste?.status === "draft")
        return this.sidebarStundenliste;
      if (this.sidebarStundenliste && !allowReplacement) return null;

      const auftragNr = this.selectedEvent.auftragNr;
      try {
        const { data } = await api.get(
          `/api/signaturen/stundenliste/${auftragNr}/validation`,
        );
        const missingPersonalNrEinsaetze =
          data?.missingPersonalNrEinsaetze || [];
        if (missingPersonalNrEinsaetze.length) {
          const count = missingPersonalNrEinsaetze.length;
          const noun = count === 1 ? "Einsatz enthält" : "Einsätze enthalten";
          if (!confirm(
            `${count} ${noun} keine Personalnummer. Die Namen dieser Mitarbeiter können in der Stundenliste nicht ausgegeben werden. Trotzdem erstellen?`,
          )) return null;
        }
      } catch (err) {
        console.error("Stundenlisten-Prüfung fehlgeschlagen", err);
        alert(
          err.response?.data?.message ||
            "Stundenliste konnte nicht auf fehlende Personalnummern geprüft werden",
        );
        return null;
      }

      const eventTitle = String(this.selectedEvent.eventTitel || "").trim();
      const eventDate = this.selectedEvent.vonDatum
        ? new Date(this.selectedEvent.vonDatum).toLocaleDateString("de-DE", { timeZone: "UTC" })
        : "";
      this.isGeneratingHoursList = true;
      try {
        const { data } = await api.post(
          `/api/signaturen/stundenliste/${auftragNr}/draft`,
          {
            name: ["Stundenliste", eventTitle || auftragNr, eventDate].filter(Boolean).join(" "),
            locationId:
              typeof this.selectedEvent.locationV2 === "object"
                ? this.selectedEvent.locationV2?._id
                : this.selectedEvent.locationV2,
          },
        );
        await this.loadStundenlisteStatus(auftragNr);
        return data;
      } catch (err) {
        console.error("Stundenlisten-Entwurf erstellen fehlgeschlagen", err);
        alert(
          err.response?.data?.message ||
            "Stundenlisten-Entwurf konnte nicht erstellt werden",
        );
        return null;
      } finally {
        this.isGeneratingHoursList = false;
      }
    },
    async downloadTelefonliste() {
      if (!this.selectedEvent?.auftragNr || this.isGeneratingTelefonliste)
        return;
      this.showNeuMenu = false;
      this.isGeneratingTelefonliste = true;
      try {
        const auftragNr = this.selectedEvent.auftragNr;
        const { data } = await api.get(
          `/api/auftraege/${auftragNr}/telefonliste`,
          { responseType: "blob" },
        );
        const url = URL.createObjectURL(
          new Blob([data], { type: "application/pdf" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Telefonliste-${auftragNr}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Fehler beim Erstellen der Telefonliste",
        );
      } finally {
        this.isGeneratingTelefonliste = false;
      }
    },
    async openMitarbeiterExport() {
      if (!this.selectedEvent?.auftragNr || this.isLoadingMitarbeiterExport) return;
      this.isLoadingMitarbeiterExport = true;
      try {
        const { data } = await api.get(
          `/api/auftraege/${this.selectedEvent.auftragNr}/mitarbeiter-export`,
        );
        this.mitarbeiterExportData = data;
        this.openExport({
          mitarbeiterList: data?.mitarbeiter || [],
          shifts: data?.schichten || [],
          filename: this.mitarbeiterExportFilename,
          extraInformation: this.mitarbeiterExportExtraInformation(),
        });
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Mitarbeiterliste konnte nicht geladen werden",
        );
      } finally {
        this.isLoadingMitarbeiterExport = false;
      }
    },
    mitarbeiterExportExtraInformation() {
      const event = this.selectedEvent || {};
      return {
        Auftrag: event.eventTitel || `Auftrag #${event.auftragNr || ''}`,
        Kunde: event.kundeData?.kundName || '',
        Datum: event.vonDatum && event.bisDatum
          ? this.formatDateRange(new Date(event.vonDatum), new Date(event.bisDatum))
          : '',
        Einsatzort: [event.eventLocation, event.eventStrasse, event.eventPlz, event.eventOrt]
          .filter(Boolean)
          .join(', '),
      };
    },
    closeMitarbeiterExport() {
      this.showMitarbeiterExportModal = false;
      this.mitarbeiterExportData = null;
    },
    // ── Stundenliste-Signatur (DocuSeal) ─────────────────────────────────────
    async loadStundenlisteStatus(auftragNr) {
      this.stundenlisteStatusLoading = true;
      try {
        const { data } = await api.get(
          `/api/auftraege/${auftragNr}/stundenliste-status`,
        );
        this.stundenlisteStatus = data;
      } catch (e) {
        console.error("Stundenliste-Status laden fehlgeschlagen", e);
        this.stundenlisteStatus = null;
      } finally {
        this.stundenlisteStatusLoading = false;
      }
    },
    async downloadFile(url, filename) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      } catch (e) {
        console.error("Download fehlgeschlagen", e);
      }
    },
    downloadStundenliste(signed = false) {
      const url = signed
        ? this.stundenlisteStatus?.signedPdfUrl
        : this.stundenlisteStatus?.unsignedPdfUrl;
      if (url) return this.downloadFile(url, this.stundenlistePdfFilename(signed));
    },
    async loadEinsatzDoks(auftragNr) {
      this.einsatzDoksLoading = true;
      try {
        const { data } = await api.get(
          `/api/auftraege/${auftragNr}/einsatzdokumente`,
        );
        this.einsatzDoks = data.data || [];
      } catch (e) {
        console.error("Einsatzdokumente laden fehlgeschlagen", e);
        this.einsatzDoks = [];
      } finally {
        this.einsatzDoksLoading = false;
      }
    },
    async onEinsatzDokUpload(event) {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (this.einsatzDokUploading || !file || !this.selectedEvent?.auftragNr) return;
      this.pendingEinsatzDokFile = file;
      this.einsatzDokType = "einsatznachweis";
      this.einsatzDokAudience = "job";
      this.einsatzDokBerufKeys = [];
      this.einsatzDokAllowedRoles = "";
      this.einsatzDokDeliveryEmails = "";
      this.einsatzDokDeliveryMessage = "";
      this.einsatzDokUploadError = "";
      this.showEinsatzDokDialog = true;
    },
    cancelEinsatzDokUpload() {
      if (this.einsatzDokUploading) return;
      this.showEinsatzDokDialog = false;
      this.pendingEinsatzDokFile = null;
      this.einsatzDokUploadError = "";
    },
    async confirmEinsatzDokUpload() {
      const file = this.pendingEinsatzDokFile;
      if (this.einsatzDokUploading || !file || !this.selectedEvent?.auftragNr) return;
      this.einsatzDokUploading = true;
      this.einsatzDokUploadError = "";
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("type", this.einsatzDokType);
        form.append("audience", this.einsatzDokAudience);
        form.append("berufKeys", this.einsatzDokBerufKeys.join(","));
        form.append("allowedRoles", this.einsatzDokAllowedRoles);
        form.append("deliveryEmails", this.einsatzDokDeliveryEmails);
        form.append("deliveryMessage", this.einsatzDokDeliveryMessage);
        const { data } = await api.post(
          `/api/auftraege/${this.selectedEvent.auftragNr}/einsatzdokumente`,
          form,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        this.einsatzDoks.push(data.data);
        this.showEinsatzDokDialog = false;
        this.pendingEinsatzDokFile = null;
      } catch (e) {
        this.einsatzDokUploadError = e.response?.data?.message || "Dokument konnte nicht hochgeladen werden. Bitte erneut versuchen.";
        console.error("Upload fehlgeschlagen", e);
      } finally {
        this.einsatzDokUploading = false;
      }
    },
    previewEinsatzDok(dok) {
      const auftragNr = this.selectedEvent?.auftragNr;
      this.openDocumentPreview({
        id: `order-${auftragNr}-${dok._id}`,
        filename: dok.filename,
        mimeType: dok.mimeType,
        resolveUrl: async () => {
          const { data } = await api.get(`/api/auftraege/${auftragNr}/einsatzdokumente/${dok._id}/download`);
          return data.data.url;
        },
      }, { minimizable: false });
    },
    async resolveEinsatzDokPreviewUrl() {
      const dok = this.previewEinsatzDokument;
      if (!dok || !this.selectedEvent?.auftragNr)
        throw new Error("Kein Dokument ausgewählt");
      const { data } = await api.get(
        `/api/auftraege/${this.selectedEvent.auftragNr}/einsatzdokumente/${dok._id}/download`,
      );
      return data.data.url;
    },
    async downloadEinsatzDok(dok) {
      try {
        this.previewEinsatzDokument = dok;
        const url = await this.resolveEinsatzDokPreviewUrl();
        await this.downloadFile(url, dok.filename);
      } catch (e) {
        console.error("Dokument-Download fehlgeschlagen", e);
      }
    },
    async deleteStundenlisteDraft() {
      const vorgang = this.sidebarStundenliste;
      if (!vorgang?._id || !confirm("Signaturentwurf wirklich löschen?"))
        return;
      try {
        await api.delete(`/api/signaturen/${vorgang._id}`);
        await this.loadStundenlisteStatus(this.selectedEvent.auftragNr);
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Fehler beim Löschen des Signaturentwurfs",
        );
      }
    },
    async deleteEinsatzDok(dok) {
      if (!this.selectedEvent?.auftragNr) return;
      try {
        await api.delete(
          `/api/auftraege/${this.selectedEvent.auftragNr}/einsatzdokumente/${dok._id}`,
        );
        this.einsatzDoks = this.einsatzDoks.filter((d) => d._id !== dok._id);
      } catch (e) {
        console.error("Löschen fehlgeschlagen", e);
      }
    },
    // ── Reisekostenabrechnungen ───────────────────────────────────────────────
    async loadReisekosten(auftragNr) {
      this.reisekostenListeLoading = true;
      try {
        const { data } = await api.get("/api/reisekosten", {
          params: { auftragNr },
        });
        this.reisekostenListe = data.data || [];
      } catch (e) {
        console.error("Reisekostenabrechnungen laden fehlgeschlagen", e);
        this.reisekostenListe = [];
      } finally {
        this.reisekostenListeLoading = false;
      }
    },
    async createStundenliste() {
      this.showNeuMenu = false;
      await this.ensureStundenlisteDraft();
    },
    openReisekostenModal(id = null) {
      this.showNeuMenu = false;
      if (!this.selectedEvent?.auftragNr) return;
      this.openReisekosten({
        auftragNr: this.selectedEvent.auftragNr,
        docId: id,
        einsaetze: this.selectedEventEinsaetze,
        onSaved: (payload) => this.onReisekostenSaved(payload),
      });
    },
    async onReisekostenSaved({ doc, sign }) {
      if (this.selectedEvent?.auftragNr)
        await this.loadReisekosten(this.selectedEvent.auftragNr);
      if (sign && doc?._id) this.openReisekostenSignatur(doc);
    },
    reisekostenName(doc) {
      const k = doc.kopf || {};
      const name = [k.vorname, k.name].filter(Boolean).join(" ");
      return (
        name ||
        (doc.mitarbeiter
          ? this.formatEmployeeName(doc.mitarbeiter)
          : "Reisekostenabrechnung")
      );
    },
    async openReisekostenPdf(doc) {
      try {
        const { data } = await api.get(`/api/reisekosten/${doc._id}/pdf`);
        if (data.url) window.open(data.url, "_blank");
      } catch (e) {
        alert(e.response?.data?.message || "PDF konnte nicht geöffnet werden");
      }
    },
    async deleteReisekosten(doc) {
      if (!confirm("Reisekostenabrechnung wirklich löschen?")) return;
      try {
        await api.delete(`/api/reisekosten/${doc._id}`);
        this.reisekostenListe = this.reisekostenListe.filter(
          (d) => d._id !== doc._id,
        );
      } catch (e) {
        alert(e.response?.data?.message || "Löschen fehlgeschlagen");
      }
    },
    openSignaturVorgang(vorgangId) {
      if (!vorgangId) return;
      this.$router.push({
        name: "SignaturenPage",
        query: { vorgangId: String(vorgangId) },
      });
    },
    openReisekostenSignatur(doc) {
      const mitarbeiter = doc.mitarbeiter || {};
      const auftragBezeichnung = String(
        this.selectedEvent?.eventTitel || "",
      ).trim();
      const dokumentName = [
        "Reisekostenabrechnung",
        auftragBezeichnung,
        this.reisekostenName(doc),
      ]
        .filter(Boolean)
        .join(" | ");
      const modal = useSignaturModal();
      modal.openModal(
        {
          auftragNr: doc.auftragNr,
          typKey: "reisekostenabrechnung",
          name: dokumentName,
          locationId:
            typeof this.selectedEvent?.locationV2 === "object"
              ? this.selectedEvent.locationV2?._id
              : this.selectedEvent?.locationV2,
          mitarbeiterId: mitarbeiter._id || null,
          customEndpoint: `/api/signaturen/reisekostenabrechnung/${doc._id}`,
          submitters: [
            {
              role: "Mitarbeiter",
              name: this.reisekostenName(doc),
              email: mitarbeiter.email || "",
              embedded: false,
            },
          ],
        },
        () => {
          if (this.selectedEvent?.auftragNr)
            this.loadReisekosten(this.selectedEvent.auftragNr);
        },
      );
    },
    formatFileSize(bytes) {
      if (!bytes) return "0 B";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    async openSignatureDialog({ allowReplacement = false } = {}) {
      this.showQuickActions = false;
      if (!this.selectedEvent) return;
      const auftragNr = this.selectedEvent.auftragNr;

      // Restore only the minimized Stundenliste modal belonging to this Auftrag.
      // Other signature flows and all other modal types retain their normal behavior.
      if (this.restoreMinimizedStundenliste(auftragNr)) return;

      const draft = await this.ensureStundenlisteDraft({
        allowReplacement: allowReplacement || this.stundenlisteIsOutdated,
      });
      if (!draft) return;

      const modal = useSignaturModal();
      modal.openModal(
        {
          draftId: draft._id,
          draftData: draft,
          auftragNr,
          typKey: "stundenliste",
          customEndpoint: `/api/signaturen/stundenliste/${auftragNr}`,
        },
        // The shared signature modal owns the embedded signing handoff.
        // Refresh only if this Auftrag is still selected when submission completes.
        () => {
          if (this.selectedEvent?.auftragNr === auftragNr)
            this.loadStundenlisteStatus(auftragNr);
        },
      );
    },
    openPseudoDialog() {
      this.showQuickActions = false;
      this.pseudoSearch = "";
      this.pseudoSearchResults = [];
      this.pseudoSelectedMas = [];
      this.pseudoSelectedSchicht = null;
      this.pseudoSchichtMode = "existing";
      this.pseudoNewSchicht = {
        bezeichnung: "",
        uhrzeitVon: "",
        uhrzeitBis: "",
      };
      this.showPseudoDialog = true;
    },
    togglePseudoMa(ma) {
      if (this.pseudoSaving) return;
      const idx = this.pseudoSelectedMas.findIndex((m) => m._id === ma._id);
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
          const res = await api.get(
            `/api/personal/search?q=${encodeURIComponent(this.pseudoSearch.trim())}`,
          );
          this.pseudoSearchResults = res.data || [];
        } catch {
          this.pseudoSearchResults = [];
        } finally {
          this.pseudoSearching = false;
        }
      }, 300);
    },
    updatePseudoSearch(value) {
      this.pseudoSearch = value;
      this.debouncedPseudoSearch();
    },
    async savePseudoEinsatz() {
      if (this.pseudoSaving || !this.selectedEvent || !this.pseudoSelectedMas.length) return;
      if (
        this.pseudoSchichtMode === "new" &&
        !this.pseudoNewSchicht.bezeichnung.trim()
      )
        return;
      this.pseudoSaving = true;
      const errors = [];
      try {
        await Promise.all(
          this.pseudoSelectedMas.map(async (ma) => {
            try {
              const payload = { mitarbeiterId: ma._id };
              if (this.pseudoSchichtMode === "new") {
                payload.isNewPseudoSchicht = true;
                payload.newSchichtBezeichnung =
                  this.pseudoNewSchicht.bezeichnung.trim();
                if (this.pseudoNewSchicht.uhrzeitVon)
                  payload.newUhrzeitVon = this.pseudoNewSchicht.uhrzeitVon;
                if (this.pseudoNewSchicht.uhrzeitBis)
                  payload.newUhrzeitBis = this.pseudoNewSchicht.uhrzeitBis;
              } else {
                // null = auto (first shift), 'none' = explicitly the no-id group, anything else = real schichtId
                if (this.pseudoSelectedSchicht !== null)
                  payload.schichtId = this.pseudoSelectedSchicht;
              }
              await api.post(
                `/api/auftraege/${this.selectedEvent.auftragNr}/pseudo-einsatz`,
                payload,
              );
            } catch (err) {
              errors.push(
                `${this.formatEmployeeName(ma)}: ${err.response?.data?.message || "Fehler"}`,
              );
            }
          }),
        );
        // Reload full event details to refresh schichten
        const detailsRes = await api.get(
          `/api/auftraege/${this.selectedEvent.auftragNr}/details`,
        );
        this.selectedEvent = detailsRes.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
        this.showPseudoDialog = false;
        if (errors.length)
          alert(
            "Einige konnten nicht eingeplant werden:\n" + errors.join("\n"),
          );
      } catch (err) {
        alert(err.response?.data?.message || "Fehler beim Einplanen");
      } finally {
        this.pseudoSaving = false;
      }
    },
    async removePseudoEinsatz(einsatzId) {
      if (!confirm("Pseudo-Einsatz entfernen?")) return;
      try {
        await api.delete(
          `/api/auftraege/${this.selectedEvent.auftragNr}/pseudo-einsatz/${einsatzId}`,
        );
        const res = await api.get(
          `/api/auftraege/${this.selectedEvent.auftragNr}/details`,
        );
        this.selectedEvent = res.data;
        this.preparedSchichten = this.calculateSchichten(this.selectedEvent);
      } catch (err) {
        alert(err.response?.data?.message || "Fehler beim Entfernen");
      }
    },

    toggleNeuMenu(event) {
      if (this.showNeuMenu) {
        this.showNeuMenu = false;
        return;
      }
      const rect = event?.currentTarget?.getBoundingClientRect();
      if (!rect) return;
      this.neuMenuPosition = { x: rect.right - 220, y: rect.bottom + 4 };
      this.showNeuMenu = true;
    },
    async handleDocumentMenuAction(action) {
      this.showNeuMenu = false;
      if (action === "mitarbeiter-export") await this.openMitarbeiterExport();
      if (action === "telefonliste") await this.downloadTelefonliste();
      if (action === "stundenliste") await this.createStundenliste();
      if (action === "reisekosten") this.openReisekostenModal();
    },

    handleEscapeKey(event) {
      if (event.key !== "Escape") return;
      // Shared frames own Escape, including their loading and topmost guards.
      // Never close the workspace detail behind an open dialog.
      if (
        this.showLabelDialog || this.showNewAuftragDialog || this.showPseudoDialog || this.showEinsatzDokDialog ||
        Array.from(document.querySelectorAll('.mf-overlay')).some(overlay => overlay.getClientRects().length)
      ) return;

      // Close modals in order of priority (topmost = last opened)
      if (this.showNeuMenu) {
        this.showNeuMenu = false;
      } else if (this.showMitarbeiterExportModal) {
        this.closeMitarbeiterExport();
      } else if (this.showQuickActions) {
        this.showQuickActions = false;
      } else if (this.selectedMitarbeiter) {
        this.selectedMitarbeiter = null;
        this.fullMitarbeiterData = null;
      } else if (this.selectedEvent) {
        this.selectedEvent = null;
      }
    },
  },
  handleDocumentClick() {
    this.showQuickActions = false;
    this.showNeuMenu = false;
  },
  async mounted() {
    this.checkMobile();
    window.addEventListener("resize", this.checkMobile);
    document.addEventListener("keydown", this.handleEscapeKey);
    document.addEventListener("click", this.handleDocumentClick);

    await this.fetchLocations();

    // Set default filters first (e.g. from user location if no storage)
    this.setDefaultFilters();
    // Then fetch options which might depend on those filters
    await this.fetchFilterOptions();

    this.fetchDataStatus();
    this.initializeWeek();
    await this.loadInitialData();
    // Wait for layout paint before measuring the KW scroller height
    await this.$nextTick();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => this.scrollKwToActive()),
    );

    // Check deep link & filters
    const { auftragnr, locationV2, geschSt, focusDate } = this.$route.query;

    // Apply filter first if present
    const queryLocationId =
      locationV2 || this.getLocationIdForExternalId(geschSt);
    if (queryLocationId) {
      this.setLocationFilter(String(queryLocationId));
      if (!locationV2 && geschSt) {
        const nextQuery = { ...this.$route.query, locationV2: queryLocationId };
        delete nextQuery.geschSt;
        this.$router.replace({ query: nextQuery });
      }
    }

    if (auftragnr) {
      await this.loadOrderDirectly(auftragnr, focusDate);
    } else {
      // Restore previous view state on refresh: same week + reopen sidebar.
      let savedAuftrag = null,
        savedWeek = null;
      try {
        savedAuftrag = sessionStorage.getItem("auftraege_selected");
        savedWeek = sessionStorage.getItem("auftraege_week");
      } catch (e) {
        /* storage unavailable */
      }
      if (savedAuftrag) {
        await this.loadOrderDirectly(savedAuftrag, savedWeek || undefined);
      } else if (savedWeek) {
        const d = new Date(savedWeek);
        if (!isNaN(d.getTime())) {
          this.currentWeekStart = d;
          await this.ensureMonthLoaded(d);
        }
      }
    }

    this.handlePseudoRouteQuery();
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.checkMobile);
    document.removeEventListener("keydown", this.handleEscapeKey);
    document.removeEventListener("click", this.handleDocumentClick);
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.auftraege-page {
  /* Variable Mappings to match new components */
  --surface: var(--panel);
  --soft: var(--hover);
  --brand: var(--primary);

  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.auftraege-page :deep(.location-filter-chip) {
  border-color: color-mix(in srgb, var(--location-color) 45%, var(--border));
  color: var(--location-color);
}

.auftraege-page :deep(.location-filter-chip.active) {
  background: color-mix(in srgb, var(--location-color) 12%, transparent);
  border-color: var(--location-color);
  box-shadow: inset 0 0 0 1px var(--location-color);
  color: var(--location-color);
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: 0;
  /* Removed transition on margin-right as layout is now flex-driven */

  @media (max-width: 768px) {
    padding: 0;
  }
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
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background 0.15s;
}

.schicht-card--drag-over {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, var(--panel));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent);
}


.schicht-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 12px;
  background: color-mix(in srgb, var(--surface) 70%, var(--panel));
  border-bottom: 1px solid var(--border);
  gap: 10px;

  .schicht-summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;

    .schicht-title-line {
      min-width: 0;
    }

    .schicht-detail-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .schicht-name {
      display: block;
      font-size: 0.86rem;
      font-weight: 650;
      color: var(--text);
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
  }
}

.schicht-quali {
  display: inline-flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, #10b981 35%, var(--border));
  border-radius: 4px;
  background: color-mix(in srgb, #10b981 10%, transparent);
  color: #0f8a62;
  font-size: 0.62rem;
  font-weight: 650;
  line-height: 1.25;

  svg {
    flex: 0 0 auto;
    font-size: 0.56rem;
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

    svg {
      color: var(--primary);
      font-size: 0.7rem;
    }

    &.ansprechpartner {
      .contact-link {
        color: var(--primary);
        text-decoration: none;
        margin-left: 4px;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.badge {
  font-size: 0.7rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  svg {
    font-size: 0.6rem;
  }

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
  padding: 0 0 4px;
}

.mitarbeiter-list-head {
  display: flex;
  justify-content: space-between;
  padding: 7px 12px 5px;
  color: var(--muted);
  font-size: 0.65rem;
  font-weight: 650;
  text-transform: uppercase;
}

.team-head-label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.team-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 0.64rem;
  font-weight: 650;
  white-space: nowrap;

  svg {
    color: var(--primary);
    font-size: 0.58rem;
  }
}

.team-coverage {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 700;

  &.met {
    background: #d1fae5;
    color: #065f46;
  }

  &.unmet {
    background: #fef3c7;
    color: #92400e;
  }
}

.mitarbeiter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 50%, transparent);

  &:last-child {
    border-bottom: none;
  }

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

      &:hover {
        text-decoration: underline;
      }
    }

    .ma-placeholder {
      color: var(--muted);
      font-size: 0.8rem;
    }

    .bew-tag {
      font-size: 0.6rem;
      font-weight: 700;
      color: #fff;
      background: #eab308;
      padding: 2px 5px;
      border-radius: 4px;
    }

    .doc-icon-btn.app-button--sm {
      --app-button-icon-size: 26px;
      min-height: 26px;
      padding: 0;

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

.no-mitarbeiter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px 12px;

  svg {
    display: inline;
    margin: 0;
    font-size: 0.8rem;
  }
}

.schicht-drop-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  max-height: 0;
  overflow: hidden;
  border-top: 0 solid transparent;
  background: color-mix(in srgb, var(--primary) 9%, transparent);
  color: var(--primary);
  font-size: 0.72rem;
  font-weight: 650;
  opacity: 0;
  transition:
    max-height 0.15s,
    padding 0.15s,
    opacity 0.15s;
}

.schicht-drop-hint.is-visible {
  max-height: 40px;
  padding: 9px 12px;
  border-top-width: 1px;
  border-top-color: color-mix(in srgb, var(--primary) 24%, transparent);
  opacity: 1;
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
  position: absolute;
  top: 100%;
  left: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: var(--muted);
  background: var(--hover);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  white-space: nowrap;
  flex-shrink: 0;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    border-color: var(--primary);
    color: var(--text);
    outline: none;
  }

  svg {
    font-size: 0.65rem;
    color: var(--primary);
    flex-shrink: 0;
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

.nav-search {
  flex-shrink: 1;
  min-width: 120px;
  padding: 4px 10px;
  border-radius: 8px;

  :deep(input) {
    width: clamp(80px, 18cqi, 220px);
    font-size: 0.82rem;
    min-width: 0;
  }
}

// Mobile search inside filter header
.filter-search-box {
  display: flex;
  align-items: center;
  position: relative;

  @media (min-width: 769px) {
    display: none;
  }
}

.filter-search-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  padding: 4px 6px;
  border-radius: 6px;
  transition:
    color 0.2s,
    background 0.2s;
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
  transition:
    width 0.25s ease,
    opacity 0.2s ease;
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
  width: 100%;
  max-width: 100%;
  margin-bottom: 29px;
  box-sizing: border-box;
  flex-wrap: nowrap;
  overflow: visible; // allow ToolbarFilter dropdowns to escape
}

.nav-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding: 0;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 4px 10px;
  font-size: 0.82rem;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 4px;

  &:hover {
    background: var(--hover);
    border-color: var(--primary);
    color: var(--primary);
  }

  &.nav-btn--icon {
    width: 28px;
    padding: 4px;
    font-size: 0.78rem;
  }

  &.today-btn {
    background: color-mix(in oklab, var(--primary) 7%, var(--tile-bg));
    color: var(--primary);
    border-color: color-mix(in oklab, var(--primary) 34%, var(--border));
    font-weight: 700;

    &:hover {
      background: color-mix(in oklab, var(--primary) 12%, var(--tile-bg));
    }
  }
}

.nav-btn.calendar-btn {
  width: 28px;
  height: 28px;
  padding: 0;
}

.nav-btn.calendar-btn:hover {
  background: color-mix(in oklab, var(--primary) 8%, transparent);
  color: var(--primary);
  border-color: var(--primary);
}

.current-range {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
  flex: 0 1 auto;
  width: max-content;
  max-width: 100%;
  padding: 4px 10px;
  white-space: nowrap;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-align: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
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
  border: 1px solid color-mix(in oklab, var(--border) 82%, var(--primary));
  border-radius: 16px;
  overflow: hidden;
  background-clip: padding-box;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);
}

.calendar-header {
  display: grid;
  grid-template-columns: 58px repeat(7, minmax(0, 1fr));
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
  overflow: hidden;
  padding: 0;
  position: relative;
  background: linear-gradient(
    to bottom,
    color-mix(in oklab, var(--primary) 5%, var(--panel)),
    color-mix(in oklab, var(--primary) 2%, var(--tile-bg))
  );
}

.kw-scroller {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 4px;
  gap: 2px;
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--primary) transparent;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--primary);
    border-radius: 999px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.kw-year-sep {
  width: 100%;
  text-align: center;
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.05em;
  padding: 6px 0 2px;
  opacity: 0.65;
  flex-shrink: 0;
}

.kw-week-btn.app-button--sm {
  width: 50px;
  min-height: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  /* Leave: starts slow, then accelerates */
  transition:
    transform 0.45s cubic-bezier(0.6, 0, 1, 1),
    font-weight 0.45s cubic-bezier(0.6, 0, 1, 1),
    color 0.45s cubic-bezier(0.6, 0, 1, 1);
  padding: 4px 2px;

  &:hover {
    /* Enter: fast */
    transition:
      transform 0.12s ease-out,
      font-weight 0.12s ease-out,
      color 0.12s ease-out;
    transform: scale(1.1);

    .kw-num-value {
      font-weight: 800;
    }
  }

  &.is-today-week:not(.is-active) {
    border-color: color-mix(in oklab, var(--primary) 35%, transparent);
  }

  &.is-active {
    .kw-num-label,
    .kw-num-value {
      color: var(--action-accent-text);
    }
  }
}

.kw-num-label {
  color: var(--muted);
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}

.kw-num-value {
  color: var(--text);
  font-size: 0.92rem;
  font-weight: 800;
  line-height: 1;
}

.day-header {
  padding: 10px 4px;
  text-align: center;
  border-right: 1px solid var(--border);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  &:last-child {
    border-right: none;
  }

  &.is-today {
    background: color-mix(in oklab, var(--primary) 7%, transparent);
    box-shadow: inset 0 3px 0 var(--primary);

    .day-name { color: var(--primary); }
  }

  .day-name {
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--muted);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .day-date {
    font-size: 0.9rem;
    color: var(--text);
  }
}

.calendar-body {
  display: grid;
  grid-template-columns: 58px repeat(7, minmax(0, 1fr));
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

.customer-event-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-event-group__header {
  padding: 2px 1px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  &:hover,
  &:focus-visible {
    color: var(--primary);
    outline: none;
  }
}

.event-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.75rem;
  position: relative;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.status-confirmed {
    background: color-mix(in oklab, #22c55e 8%, var(--panel));
  }

  &.status-completed {
    opacity: 0.7;
  }

  // Bedarf-based left border
  &.bedarf-none {
    border-left: 3px solid var(--muted);
  }
  &.bedarf-all-empty {
    border-left: 3px solid #ef4444;
  }
  &.bedarf-some-empty {
    border-left: 3px solid #f97316;
  }
  &.bedarf-underbooked {
    border-left: 3px solid #eab308;
  }
  &.bedarf-full {
    border-left: 3px solid #22c55e;
  }
  &.bedarf-overbooked {
    border-left: 3px solid #15803d;
  }
}

.event-card--compact {
  padding-block: 2px;

  .event-title {
    margin-bottom: 0;
  }
}

.event-signature-complete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 17px;
  height: 17px;
  object-fit: contain;
  filter: hue-rotate(135deg) saturate(0.9);
  z-index: 1;
}

.event-signature-pending,
.event-signature-draft {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 17px;
  height: 17px;
  object-fit: contain;
  z-index: 1;
}

.event-signature-draft {
  filter: grayscale(1);
  opacity: 0.65;
}

.event-card:has(
    .event-signature-complete,
    .event-signature-pending,
    .event-signature-draft
  )
  .event-title-row,
.event-card-mobile:has(
    .event-signature-complete,
    .event-signature-pending,
    .event-signature-draft
  )
  .event-header,
.event-card-mobile:has(
    .event-signature-complete,
    .event-signature-pending,
    .event-signature-draft
  )
  .event-title-row {
  padding-right: 21px;
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

.einsatz-confirmed-icon {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #d1fae5;
  color: #047857;
  font-size: .72rem;
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
    overflow-x: auto;
  }
}

/* Mobile Calendar Styles */
.mobile-calendar-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mobile-nav {
  display: none; // replaced by .mobile-day-nav
}

// ── New combined mobile day nav ───────────────────────────────────────────────
.mobile-day-nav {
  display: none; // replaced by inline toolbar items
}

// Remove old mdn-center now that day display moved below toolbar
.mdn-center {
  display: none;
}
.mdn-dayname {
  display: none;
}
.mdn-date {
  display: none;
}

// ── Mobile day title (below toolbar) ─────────────────────────────────────────
.mobile-day-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0 8px;
}

.mobile-day-title__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.mobile-day-title__name {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.mobile-day-title__date {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}

.mobile-day-title__stats {
  font-size: 0.78rem;
  color: var(--muted);
  font-weight: 400;
}

// ── Search dropdown ───────────────────────────────────────────────────────────
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 1 220px;
  min-width: 120px;

  :deep(.search-bar-root) {
    width: 100%;
  }
}

.desktop-search {
  flex: 1 1 320px;
  max-width: 520px;

  :deep(input) {
    width: auto;
    flex: 1 1 auto;
  }
}

.mdn-search {
  max-width: 140px;
  flex: 0 1 140px;
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;

  // Bedarf-based left border
  &.bedarf-none {
    border-left: 4px solid var(--muted);
  }
  &.bedarf-all-empty {
    border-left: 4px solid #ef4444;
  }
  &.bedarf-some-empty {
    border-left: 4px solid #f97316;
  }
  &.bedarf-underbooked {
    border-left: 4px solid #eab308;
  }
  &.bedarf-full {
    border-left: 4px solid #22c55e;
  }
  &.bedarf-overbooked {
    border-left: 4px solid #15803d;
  }
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

.shift-row--stacked {
  flex-wrap: wrap;
  padding: 3px 0;
}

.shift-row--stacked + .shift-row--stacked {
  border-top: 1px solid var(--border);
}

.shift-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.shift-details .shift-time,
.shift-details .shift-name {
  min-width: 0;
}

.shift-time {
  color: var(--text);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  min-width: 80px;
  flex-shrink: 0;
}

.shift-name {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 400;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shift-pos {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 1px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--tile-bg);
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;

  &.bedarf-none { background: color-mix(in srgb, var(--muted) 10%, var(--tile-bg)); }
  &.bedarf-all-empty { border-color: #ef4444; background: color-mix(in srgb, #ef4444 13%, var(--tile-bg)); }
  &.bedarf-some-empty { border-color: #f97316; background: color-mix(in srgb, #f97316 13%, var(--tile-bg)); }
  &.bedarf-underbooked { border-color: #eab308; background: color-mix(in srgb, #eab308 13%, var(--tile-bg)); }
  &.bedarf-full { border-color: #22c55e; background: color-mix(in srgb, #22c55e 13%, var(--tile-bg)); }
  &.bedarf-overbooked { border-color: #15803d; background: color-mix(in srgb, #15803d 13%, var(--tile-bg)); }
}

.shift-einsaetze {
  width: 100%;
  color: var(--muted);
  font-size: 0.64rem;
  line-height: 1.3;
  list-style: none;
  padding: 0;

  li {
    position: relative;
    padding-left: 9px;

    &::before {
      content: "•";
      position: absolute;
      left: 1px;
      color: var(--primary);
    }
  }
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

  &.pseudo-tag--event {
    margin-left: 0;
    font-size: 0.6rem;
  }
}

.ma-badges--right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pseudo-remove-btn {
  --action-ghost-text: var(--status-danger-text);
  --action-accent-text: var(--status-danger-text);
  --action-ghost-hover: color-mix(in srgb, var(--status-danger-text) 12%, transparent);
}



// ── Feiertage Highlighting ─────────────────────────────────────────────────

// Desktop day-header: amber tint when holiday is relevant for active Bundesland
.day-header {
  &.is-holiday-relevant {
    background: color-mix(in oklab, #f59e0b 14%, var(--panel));
  }
}

// Holiday name + states label inside day-header
.holiday-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 3px 4px 2px;
  width: 100%;
  overflow: hidden;

  .holiday-name {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    text-align: center;
  }

  &.holiday-label--relevant .holiday-name {
    color: #d97706;
  }
}

// Bundesland / "Bundesweit" pill
.holiday-states-badge {
  display: inline-block;
  font-size: 0.55rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in oklab, var(--muted) 14%, transparent);
  color: var(--muted);
  white-space: nowrap;
  line-height: 1.5;

  &.holiday-states-badge--relevant {
    background: color-mix(in oklab, #f59e0b 22%, transparent);
    color: #b45309;
  }
}

// Desktop day-column: subtle amber tint when relevant
.day-column {
  &.is-holiday-relevant {
    background: color-mix(in oklab, #f59e0b 6%, transparent);
  }
}

// Mobile: holiday chip inside .mobile-date-display
.mobile-holiday-chip {
  display: inline-block;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in oklab, var(--muted) 12%, transparent);
  color: var(--muted);
  white-space: nowrap;
  line-height: 1.4;
  margin-top: 1px;

  &.mobile-holiday-chip--relevant {
    background: color-mix(in oklab, #f59e0b 20%, transparent);
    color: #b45309;
  }
}
</style>
