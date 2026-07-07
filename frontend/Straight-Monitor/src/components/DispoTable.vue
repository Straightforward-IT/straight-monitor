<template>
  <Transition name="dispo-fs">
  <div class="dispo-page" :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- Page header (knechti only) -->
    <div v-if="!isFullscreen && isKnechti && !isMobile" class="page-header page-header--knechti">
      <h1 class="knechti-title">KNECHTI-LISTE</h1>
    </div>

    <!-- Fullscreen toolbar — compact filter bar —-->
    <div v-if="isFullscreen && !isMobile" class="fs-toolbar">
      <!-- Left: filter toggle + filters overlay anchor -->
      <div class="fs-toolbar-left">
        <!-- Filter toggle button -->
        <button
          class="fs-filter-toggle"
          :class="{ 'fs-filter-toggle--active': fsFilterExpanded }"
          type="button"
          :title="fsFilterExpanded ? 'Filter schließen' : 'Filter'"
          @click="fsFilterExpanded = !fsFilterExpanded"
        >
          <span v-if="activeFilterCount > 0" class="fs-filter-count">{{ activeFilterCount }}</span>
          <font-awesome-icon :icon="fsFilterExpanded ? 'fa-solid fa-xmark' : 'fa-solid fa-filter'" />
        </button>

        <!-- Filters panel (drop-down overlay, only filter controls) -->
        <transition name="fs-filter-expand">
          <div v-if="fsFilterExpanded" class="fs-filters-panel">
            <div class="fs-toolbar-filters">
              <!-- Standort -->
              <FilterDropdown :has-value="!!filters.standort">
                <template #label><font-awesome-icon icon="fa-solid fa-location-dot" style="margin-right:4px" />{{ standortLabel }}</template>
                <div class="dropdown-item" :class="{ selected: !filters.standort }" @click="setStandort(null)">Alle Standorte</div>
                <div class="dropdown-item" :class="{ selected: filters.standort === '1' }" @click="setStandort('1')">Berlin</div>
                <div class="dropdown-item" :class="{ selected: filters.standort === '2' }" @click="setStandort('2')">Hamburg</div>
                <div class="dropdown-item" :class="{ selected: filters.standort === '3' }" @click="setStandort('3')">Köln</div>
              </FilterDropdown>

              <!-- Zeitraum -->
              <FilterDropdown :has-value="filters.tage !== 30">
                <template #label><font-awesome-icon icon="fa-solid fa-calendar" style="margin-right:4px" />{{ filters.tage }} Tage</template>
                <div v-for="opt in [7, 14, 30]" :key="opt" class="dropdown-item" :class="{ selected: filters.tage === opt }" @click="setTage(opt)">{{ opt }} Tage</div>
              </FilterDropdown>

              <!-- Planung -->
              <FilterDropdown :has-value="!!filters.planungFilter">
                <template #label><font-awesome-icon icon="fa-solid fa-clipboard-list" style="margin-right:4px" />{{ planungLabel }}</template>
                <div class="dropdown-item" :class="{ selected: !filters.planungFilter }" @click="setPlanung(null)">Alle</div>
                <div class="dropdown-item" :class="{ selected: filters.planungFilter === 'eingeplant' }" @click="setPlanung('eingeplant')">Eingeplante</div>
                <div class="dropdown-item" :class="{ selected: filters.planungFilter === 'ungeplant' }" @click="setPlanung('ungeplant')">Ungeplante</div>
              </FilterDropdown>

              <!-- Kunden Filter -->
              <div class="fs-kunde-filter" :class="{ 'fs-kunde-filter--active': !!filters.kundeFilter }">
                <span class="fs-kunde-filter-label">🤝</span>
                <KundeSearch
                  ref="kundeFilterFsRef"
                  :standort="filters.standort"
                  placeholder="Kunde…"
                  @select="(k) => { filterKunde = k; filters.kundeFilter = k?._id || null; }"
                />
                <button v-if="filters.kundeFilter" class="fs-kunde-filter-clear" @click="clearKundeFilter">
                  <font-awesome-icon icon="fa-solid fa-xmark" />
                </button>
              </div>

              <!-- Qualifikation Filter -->
              <div class="fs-qual-filter" :class="{ 'fs-qual-filter--active': qualFilter.length > 0 }">
                <div class="qual-pills-input qual-pills-input--fs" @click="qualInputFsRef?.focus()">
                  <span
                    v-for="(q, idx) in qualFilter"
                    :key="q._id"
                    class="qual-pill qual-pill--sm"
                    :class="{ 'is-focused': qualFocusedPillIdx === idx }"
                  >
                    <span class="qual-pill-text">{{ q.designation }}</span>
                    <button class="qual-pill-remove" @click.stop="removeQual(q)">✕</button>
                  </span>
                  <input
                    ref="qualInputFsRef"
                    v-model="qualSearchQuery"
                    type="text"
                    :placeholder="qualFilter.length ? '' : 'Qual…'"
                    @focus="openQualDropdown(qualInputFsRef)"
                    @input="openQualDropdown(qualInputFsRef)"
                    @blur="onQualBlur"
                    @keydown="onQualKeydown"
                  />
                </div>
              </div>

              <!-- Reset -->
              <button class="fs-reset-btn" @click="resetFilters" title="Zurücksetzen">
                <font-awesome-icon icon="fa-solid fa-rotate-left" />
              </button>
            </div>
          </div>
        </transition>
      </div>

      <!-- Center: always-visible controls -->
      <div class="fs-toolbar-center">
        <!-- KW Chips -->
        <div class="kw-chips">
          <span class="kw-label">KW</span>
          <button v-if="kwChipOffset > 0" class="kw-nav-btn" @click="kwChipOffset--" title="Vorherige Wochen">
            <font-awesome-icon icon="fa-solid fa-chevron-left" />
          </button>
          <CustomTooltip
            v-for="chip in kwChips"
            :key="`${chip.year}-${chip.kw}`"
            :text="chip.shortcut ? `Shortcut [${chip.shortcut}]` : `KW ${chip.kw} ${chip.year}`"
            position="bottom"
          >
            <button
              class="kw-chip"
              :class="{ 'kw-chip--active': selectedKw?.kw === chip.kw && selectedKw?.year === chip.year, 'kw-chip--current': chip.isCurrent }"
              @click="toggleKw(chip)"
            >{{ chip.kw }}</button>
          </CustomTooltip>
          <button class="kw-nav-btn" @click="kwChipOffset++" title="Nächste Wochen">
            <font-awesome-icon icon="fa-solid fa-chevron-right" />
          </button>
        </div>

        <!-- Search -->
        <CustomTooltip text="Suchen [S]" position="bottom">
          <div class="fs-search-box">
            <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="fs-search-icon" />
            <input ref="searchInputFs" v-model="searchQuery" type="text" placeholder="Suchen…" />
          </div>
        </CustomTooltip>

        <!-- Hidden employees -->
        <button
          v-if="hiddenCount > 0"
          class="show-hidden-btn show-hidden-btn--topline"
          :class="{ active: showHidden }"
          @click="toggleHiddenView"
          :title="showHidden ? 'Zur normalen Ansicht zurück' : 'Ausgeblendete Mitarbeiter anzeigen'"
        >
          <font-awesome-icon :icon="showHidden ? 'fa-solid fa-arrow-left' : 'fa-solid fa-eye-slash'" />
          {{ showHidden ? 'Zurück' : `${hiddenCount} ausgeblendet` }}
        </button>
      </div>

      <div class="fs-toolbar-right">
        <!-- Selection chip -->
        <span v-if="selectedCells.size > 0" class="selection-chip">
          <font-awesome-icon icon="fa-solid fa-table-cells" />
          <strong>{{ selectedCells.size }}</strong> ausgewählt
          <template v-if="selectionMaCount > 1"> · {{ selectionMaCount }} MA</template>
          <button class="sel-chip-clear" @click="clearSelection" title="Auswahl aufheben">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </span>

        <!-- Zoom -->
        <div class="zoom-controls">
          <CustomTooltip text="Verkleinern (-)" position="bottom">
            <button class="zoom-btn" @click="tableZoom = Math.max(60, tableZoom - 10)" :disabled="tableZoom <= 60">
              <font-awesome-icon icon="fa-solid fa-minus" />
            </button>
          </CustomTooltip>
          <span class="zoom-label" @dblclick="tableZoom = 100" title="Doppelklick := 100%">{{ tableZoom }}%</span>
          <CustomTooltip text="Vergrößern (+)" position="bottom">
            <button class="zoom-btn" @click="tableZoom = Math.min(150, tableZoom + 10)" :disabled="tableZoom >= 150">
              <font-awesome-icon icon="fa-solid fa-plus" />
            </button>
          </CustomTooltip>
        </div>

        <!-- Exit fullscreen -->
        <CustomTooltip text="Vollbild beenden (Esc)" position="bottom">
          <button class="help-btn fs-exit-btn" @click="toggleFullscreen">
            <font-awesome-icon icon="fa-solid fa-compress-alt" />
          </button>
        </CustomTooltip>
      </div>
    </div>

    <!-- Selection Bar (normal mode only) -->
    <Toolbar v-if="!isFullscreen && !isMobile" class="selection-bar">
      <ToolbarFilter v-model="filterExpanded" :active-count="activeFilterCount" @reset="resetFilters">
          <!-- Standort -->
          <FilterGroup label="Standort">
            <FilterChip :active="filters.standort === '1'" @click="setStandort('1')">Berlin</FilterChip>
            <FilterChip :active="filters.standort === '2'" @click="setStandort('2')">Hamburg</FilterChip>
            <FilterChip :active="filters.standort === '3'" @click="setStandort('3')">Köln</FilterChip>
          </FilterGroup>
          <FilterDivider />
          <!-- Planung -->
          <FilterGroup label="Planung">
            <FilterChip :active="filters.planungFilter === 'eingeplant'" @click="setPlanung('eingeplant')">Eingeplante</FilterChip>
            <FilterChip :active="filters.planungFilter === 'ungeplant'" @click="setPlanung('ungeplant')">Ungeplante</FilterChip>
          </FilterGroup>
          <FilterDivider />
          <!-- Qualifikation (compact inline) -->
          <div class="tf-qual-filter" :class="{ 'tf-qual-filter--active': qualFilter.length > 0 }">
            <div class="qual-pills-input qual-pills-input--fs" @click="qualInputRef?.focus()">
              <span
                v-for="(q, idx) in qualFilter"
                :key="q._id"
                class="qual-pill qual-pill--sm"
                :class="{ 'is-focused': qualFocusedPillIdx === idx }"
              >
                <span class="qual-pill-text">{{ q.designation }}</span>
                <button class="qual-pill-remove" @click.stop="removeQual(q)">✕</button>
              </span>
              <input
                ref="qualInputRef"
                v-model="qualSearchQuery"
                type="text"
                :placeholder="qualFilter.length ? '' : 'Qualifikation...'"
                @focus="openQualDropdown(qualInputRef)"
                @input="openQualDropdown(qualInputRef)"
                @blur="onQualBlur"
                @keydown="onQualKeydown"
              />
            </div>
          </div>
          <FilterDivider />
          <!-- Kunden Filter (compact inline) -->
          <div class="fs-kunde-filter" :class="{ 'fs-kunde-filter--active': !!filters.kundeFilter }">
            <KundeSearch
              ref="kundeFilterRef"
              :standort="filters.standort"
              placeholder="Kunde…"
              @select="(k) => { filterKunde = k; filters.kundeFilter = k?._id || null; }"
            />
            <button v-if="filters.kundeFilter" class="fs-kunde-filter-clear" @click="clearKundeFilter">
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </div>
      </ToolbarFilter>
      <!-- Left: SearchBar + cell selection chip -->
      <div class="sel-bar-left">
        <SearchBar
          class="dispo-search-bar"
          v-model="searchQuery"
          placeholder="Mitarbeiter suchen…"
          aria-label="Mitarbeiter suchen"
        />
        <FilterDropdown :has-value="filters.tage !== 30" class="zeitraum-dropdown">
          <template #label><font-awesome-icon icon="fa-solid fa-calendar" style="margin-right:4px" />{{ filters.tage }} Tage</template>
          <div v-for="opt in [7, 14, 30]" :key="opt" class="dropdown-item" :class="{ selected: filters.tage === opt }" @click="setTage(opt)">{{ opt }} Tage</div>
        </FilterDropdown>
        <button
          v-if="hiddenCount > 0"
          class="show-hidden-btn show-hidden-btn--topline"
          :class="{ active: showHidden }"
          @click="toggleHiddenView"
          :title="showHidden ? 'Zur normalen Ansicht zurück' : 'Ausgeblendete Mitarbeiter anzeigen'"
        >
          <font-awesome-icon :icon="showHidden ? 'fa-solid fa-arrow-left' : 'fa-solid fa-eye-slash'" />
          {{ showHidden ? 'Zurück' : `${hiddenCount} ausgeblendet` }}
        </button>
        <transition name="sel-chip">
          <span v-if="selectedCells.size > 0" class="selection-chip">
            <font-awesome-icon icon="fa-solid fa-table-cells" />
            <strong>{{ selectedCells.size }}</strong> ausgewählt
            <template v-if="selectionMaCount > 1"> · {{ selectionMaCount }} MA</template>
            <button class="sel-chip-clear" @click="clearSelection" title="Auswahl aufheben">
              <font-awesome-icon icon="fa-solid fa-xmark" />
            </button>
          </span>
        </transition>
      </div>

      <!-- Center: KW chips -->
      <div class="kw-chips">
        <span class="kw-label">KW</span>
        <button v-if="kwChipOffset > 0" class="kw-nav-btn" @click="kwChipOffset--" title="Vorherige Wochen">
          <font-awesome-icon icon="fa-solid fa-chevron-left" />
        </button>
        <CustomTooltip
          v-for="chip in kwChips"
          :key="`${chip.year}-${chip.kw}`"
          :text="chip.shortcut ? `Shortcut [${chip.shortcut}]` : `KW ${chip.kw} ${chip.year}`"
          position="top"
        >
          <button
            class="kw-chip"
            :class="{ 'kw-chip--active': selectedKw?.kw === chip.kw && selectedKw?.year === chip.year, 'kw-chip--current': chip.isCurrent }"
            @click="toggleKw(chip)"
          >{{ chip.kw }}</button>
        </CustomTooltip>
        <button class="kw-nav-btn" @click="kwChipOffset++" title="Nächste Wochen">
          <font-awesome-icon icon="fa-solid fa-chevron-right" />
        </button>
      </div>

      <!-- Right: zoom + fullscreen + help -->
      <div class="sel-bar-right">
        <div class="zoom-controls">
          <CustomTooltip text="Verkleinern (-)" position="top">
            <button class="zoom-btn" @click="tableZoom = Math.max(60, tableZoom - 10)" :disabled="tableZoom <= 60">
              <font-awesome-icon icon="fa-solid fa-minus" />
            </button>
          </CustomTooltip>
          <span class="zoom-label" @dblclick="tableZoom = 100" title="Doppelklick zum Zurücksetzen">{{ tableZoom }}%</span>
          <CustomTooltip text="Vergrößern (+)" position="top">
            <button class="zoom-btn" @click="tableZoom = Math.min(150, tableZoom + 10)" :disabled="tableZoom >= 150">
              <font-awesome-icon icon="fa-solid fa-plus" />
            </button>
          </CustomTooltip>
        </div>
        <CustomTooltip text="Vollbild (V)" position="top">
          <button class="zoom-btn" @click="toggleFullscreen">
            <font-awesome-icon icon="fa-solid fa-expand" />
          </button>
        </CustomTooltip>
        <CustomTooltip text="Hilfe [H]" position="top">
          <button class="help-btn" @click="showHelp = true">
            <font-awesome-icon icon="fa-solid fa-circle-question" />
          </button>
        </CustomTooltip>
      </div>
    </Toolbar>

    <!-- Table area (+ inline feed panel when fullscreen) -->
    <div v-if="!isMobile" class="fs-body" :class="{ 'fs-body--split': isFullscreen && ui.panelType === 'kommentare' && !ui.hidden && !fsFeedCollapsed }">

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <font-awesome-icon icon="fa-solid fa-spinner" spin /> Lade Dispo-Daten…
    </div>

    <!-- Table -->
    <div v-else class="dispo-table-wrapper" :class="{ 'fullscreen-wrapper': isFullscreen }" ref="tableWrapper">
      <div class="dispo-split-layout" :style="{ zoom: tableZoom / 100 }">
        
        <!-- Linker Bereich: Fester Name -->
        <div class="dispo-left-pane">
          <table class="dispo-table">
            <thead>
              <tr>
                <th 
                  class="col-nachname sortable-th" 
                  :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }"
                  @click="toggleSort('nachname')"
                >
                  <span class="th-content">
                    Nachname
                    <font-awesome-icon
                      v-if="sortField === 'nachname'"
                      :icon="sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'"
                      class="sort-icon"
                    />
                    <font-awesome-icon v-else icon="fa-solid fa-sort" class="sort-icon muted" />
                  </span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'nachname')"></div>
                </th>
                <th 
                  class="col-vorname sortable-th" 
                  :style="{ width: colWidths.vorname + 'px', minWidth: colWidths.vorname + 'px', maxWidth: colWidths.vorname + 'px' }"
                  @click="toggleSort('vorname')"
                >
                  <span class="th-content">
                    Vorname
                    <font-awesome-icon
                      v-if="sortField === 'vorname'"
                      :icon="sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'"
                      class="sort-icon"
                    />
                    <font-awesome-icon v-else icon="fa-solid fa-sort" class="sort-icon muted" />
                  </span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'vorname')"></div>
                </th>
                <th
                  class="col-notiz"
                  :style="{ width: colWidths.notiz + 'px', minWidth: colWidths.notiz + 'px', maxWidth: colWidths.notiz + 'px' }"
                >
                  <span class="th-content">Notiz</span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'notiz')"></div>
                </th>
                <th
                  class="col-bereich"
                  :class="{ 'bereich-filter-active': bereichFilter !== null }"
                  @click.stop="onBereichHeaderClick"
                >
                  <span class="th-content">
                    Bereich
                    <font-awesome-icon v-if="!bereichFilter" icon="fa-solid fa-filter" class="bereich-filter-icon" />
                    <span v-if="bereichFilter" class="bereich-filter-label">{{ bereichFilter }}</span>
                    <span v-if="bereichFilter" class="bereich-filter-clear" @click.stop="bereichFilter = null">✕</span>
                  </span>
                </th>
                <th
                  class="col-kunden"
                  :style="{ width: colWidths.kunden + 'px', minWidth: colWidths.kunden + 'px', maxWidth: colWidths.kunden + 'px' }"
                >
                  <span class="th-content">Kunden</span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'kunden')"></div>
                </th>
                <th
                  class="col-aktivitaet sortable-th"
                    @click="toggleSort('aktivitaet')"
                  :style="{ width: colWidths.aktivitaet + 'px', minWidth: colWidths.aktivitaet + 'px', maxWidth: colWidths.aktivitaet + 'px' }"
                >
                    <span class="th-content">
                      Chronik
                      <font-awesome-icon
                        v-if="sortField === 'aktivitaet'"
                      :icon="sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'"
                        class="sort-icon"
                      />
                    <font-awesome-icon v-else icon="fa-solid fa-sort" class="sort-icon muted" />
                    </span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'aktivitaet')"></div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`l-${ma._id}`"
                :data-left-row="String(ma._id)"
                @mouseenter="onRowMouseEnter(String(ma._id))"
                @mouseleave="onRowMouseLeave()"
                :class="{ 'row-highlighted': highlightedMaId === String(ma._id) }"
                @contextmenu.prevent.stop="openNameMenu($event, ma)"
                style="cursor: default"
              >
                <!-- Nachname -->
                <td class="col-nachname" :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }">
                  <div class="ma-name-cell">
                    <div v-if="isTeamleiter(ma)" class="tl-corner-wrapper"><TlBadge /></div>
                    <div v-else-if="ma.isBewerberstatus" class="bew-corner-wrapper">Bew.</div>
                    <div v-if="getExitLabel(ma)" class="exit-corner-wrapper">{{ getExitLabel(ma) }}</div>
                    <button
                      class="star-btn"
                      :class="{ active: starredIds.has(ma._id) }"
                      @click="toggleStar(ma._id)"
                      :title="starredIds.has(ma._id) ? 'Favorit entfernen' : 'Als Favorit markieren'"
                    >
                      <font-awesome-icon :icon="starredIds.has(ma._id) ? 'fa-solid fa-star' : 'fa-regular fa-star'" />
                    </button>
                    <span class="ma-name">{{ ma.nachname }}</span>
                  </div>
                </td>
                <!-- Vorname -->
                <td class="col-vorname" :style="{ width: colWidths.vorname + 'px', minWidth: colWidths.vorname + 'px', maxWidth: colWidths.vorname + 'px' }">
                  <span class="ma-name">{{ ma.vorname }}</span>
                </td>
                <!-- Notiz -->
                <td
                  class="col-notiz"
                  :class="{ 'notiz-expanded': expandedNotiz === ma._id }"
                  :style="expandedNotiz !== ma._id ? { width: colWidths.notiz + 'px', minWidth: colWidths.notiz + 'px', maxWidth: colWidths.notiz + 'px' } : {}"
                >
                  <div class="notiz-cell">
                    <div
                      class="notiz-editable"
                      :data-notiz-ma="ma._id"
                      contenteditable="true"
                      spellcheck="false"
                      v-set-text="getNotizValue(ma._id)"
                      @focus="toggleNotizExpand(ma._id)"
                      @input="onNotizInput(ma._id, $event)"
                      @keydown.enter.prevent="$event.target.blur()"
                      @blur="expandedNotiz === ma._id ? toggleNotizExpand(ma._id) : null"
                    ></div>
                    <button
                      v-if="notizMap[ma._id] && expandedNotiz === ma._id"
                      class="notiz-clear-btn"
                      @mousedown.prevent="clearNotiz(ma._id)"
                      title="Notiz löschen"
                    >
                      <font-awesome-icon icon="fa-solid fa-eraser" />
                    </button>
                    <button
                      v-if="notizMap[ma._id] && expandedNotiz !== ma._id"
                      class="notiz-expand-pill"
                      @mousedown.prevent="toggleNotizExpand(ma._id)"
                      title="Volltext anzeigen"
                    >…</button>
                  </div>
                </td>
                <!-- Bereich -->
                <td class="col-bereich">
                  <span v-if="getMaBereich(ma)" class="bereich-badge">{{ getMaBereich(ma) }}</span>
                </td>
                <!-- Kunden -->
                <td class="col-kunden" :style="{ width: colWidths.kunden + 'px', minWidth: colWidths.kunden + 'px', maxWidth: colWidths.kunden + 'px' }">
                  <div class="kunden-pills">
                    <CustomTooltip
                      v-for="w in (ma.kundenwuensche || [])"
                      :key="w._id"
                      :text="`${w.kunde?.kundName || ''} ${w.typ === 'positiv' ? '🤝' : '🚫'}${w.kommentar ? ' – ' + w.kommentar : ''}`"
                      position="top"
                    >
                      <span
                        class="kw-pill"
                        :class="w.typ === 'positiv' ? 'kw-pill--pos' : 'kw-pill--neg'"
                      >
                        {{ w.kunde?.kuerzel || w.kunde?.kundenNr || '?' }}
                        <button class="kw-pill-remove" @click.stop="removeKundenwunsch(ma._id, w._id)" title="Entfernen">✕</button>
                      </span>
                    </CustomTooltip>
                    <CustomTooltip text="Kundenwunsch hinzufügen" position="top">
                      <button class="kw-add-btn" @click.stop="openKwModal(ma._id)">+</button>
                    </CustomTooltip>
                  </div>
                </td>
                <!-- Aktivität -->
                <td
                  class="col-aktivitaet"
                  :class="{ 'aktivitaet-expanded': expandedAktivitaet === ma._id }"
                  :style="expandedAktivitaet !== ma._id ? { width: colWidths.aktivitaet + 'px', minWidth: colWidths.aktivitaet + 'px', maxWidth: colWidths.aktivitaet + 'px' } : {}"
                >
                  <div class="aktivitaet-cell">
                    <!-- Zugeklappt: letzte 3 Einträge -->
                    <template v-if="expandedAktivitaet !== ma._id">
                      <div
                        class="aktivitaet-preview-list"
                        @click="toggleAktivitaetsLogExpand(ma._id)"
                        title="Klicken zum Bearbeiten"
                      >
                        <template v-for="group in getAktivitaetsLogPreviewGrouped(ma._id)" :key="group.dayKey">
                          <div class="aktivitaet-day-header">{{ group.dayLabel }}</div>
                          <div
                            v-for="entry in group.entries"
                            :key="entry._id || entry.text"
                            class="aktivitaet-preview-entry"
                          >
                            <span class="aktivitaet-log-time">{{ new Date(entry.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}</span>
                            <span class="aktivitaet-preview-text">{{ entry.text }}</span>
                          </div>
                        </template>
                        <span v-if="!getAktivitaetsLog(ma._id).length" class="aktivitaet-empty">—</span>
                      </div>
                    </template>
                    <!-- Aufgeklappt: Verlauf + Eingabefeld -->
                    <template v-else>
                      <div class="aktivitaet-log-list" @click.stop>
                        <template v-for="group in getAktivitaetsLogGrouped(ma._id)" :key="group.dayKey">
                          <div class="aktivitaet-day-header">{{ group.dayLabel }}</div>
                          <div
                            v-for="entry in group.entries"
                            :key="entry._id || [ma._id, entry.createdAt, entry.text].join('-')"
                            class="aktivitaet-log-item"
                          >
                            <div class="aktivitaet-log-main">
                              <span class="aktivitaet-log-time">{{ new Date(entry.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}</span>
                              <span class="aktivitaet-log-text">{{ entry.text }}</span>
                            </div>
                            <button
                              class="aktivitaet-delete-btn"
                              @mousedown.prevent="deleteAktivitaetsLog(ma._id, entry._id)"
                              title="Eintrag löschen"
                            >
                              <font-awesome-icon icon="fa-solid fa-trash" />
                            </button>
                          </div>
                        </template>
                        <div v-if="!getAktivitaetsLog(ma._id).length" class="aktivitaet-empty">Noch kein Verlauf.</div>
                      </div>
                      <div class="aktivitaet-input-row" @click.stop>
                        <input
                          v-model="aktivitaetsDraftMap[ma._id]"
                          type="text"
                          class="aktivitaet-input"
                          placeholder="Schreiben…"
                          @keydown.enter.prevent="addAktivitaetsLog(ma._id)"
                          @keydown.esc.prevent="toggleAktivitaetsLogExpand(ma._id)"
                        />
                        <button
                          class="aktivitaet-send-btn"
                          :disabled="!((aktivitaetsDraftMap[ma._id] || '').trim())"
                          @mousedown.prevent="addAktivitaetsLog(ma._id)"
                          title="Absenden"
                        >
                          <font-awesome-icon icon="fa-solid fa-paper-plane" />
                        </button>
                      </div>
                    </template>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredMitarbeiter.length === 0">
                <td colspan="6" class="empty-row text-center">
                  --
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Rechter Bereich: Daten (Scrollbar) -->
        <div class="dispo-right-pane">
          <table class="dispo-table">
            <thead>
              <tr>
                <th
                  v-for="day in visibleDays"
                  :key="day.iso"
                  class="col-day"
                  :style="{ width: dayColWidth + 'px', minWidth: dayColWidth + 'px', maxWidth: dayColWidth + 'px' }"
                  :class="{
                    'is-today': day.isToday,
                    'is-weekend': day.isWeekend,
                    'col-day--focused': focusedDay === day.iso,
                    'col-day--dimmed': focusedDay !== null && focusedDay !== day.iso,
                  }"
                  @click="toggleFocusedDay(day.iso)"
                >
                  <div class="day-header">
                    <span class="day-name">{{ day.weekday }}</span>
                    <span class="day-date">{{ day.label }}</span>
                  </div>
                  <div class="col-resize-handle col-resize-handle--day" @mousedown.prevent.stop="startResizeDay($event)" @click.stop></div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`r-${ma._id}`"
                :data-right-row="String(ma._id)"
                :style="rowHeights[String(ma._id)] ? { height: rowHeights[String(ma._id)] + 'px' } : null"
                @mouseenter="onRowMouseEnter(String(ma._id))"
                @mouseleave="onRowMouseLeave()"
                :class="{ 'row-highlighted': highlightedMaId === String(ma._id) }"
              >
                <!-- Day cells -->
                <td
                  v-for="day in visibleDays"
                  :key="day.iso"
                  class="col-day"
                  :style="{ width: dayColWidth + 'px', minWidth: dayColWidth + 'px', maxWidth: dayColWidth + 'px' }"
                  :data-ma-id="String(ma._id)"
                  :data-iso="day.iso"
                  :class="[
                    cellClass(ma._id, day.iso),
                    {
                      'is-today': day.isToday,
                      'is-weekend': day.isWeekend,
                      'is-active': ctxMenu.open && ctxMenu.ma?._id === ma._id && ctxMenu.day === day.iso,
                      'cell-selected': isCellSelected(ma._id, day.iso),
                      'col-day--dimmed': focusedDay !== null && focusedDay !== day.iso,
                    },
                  ]"
                  @contextmenu.prevent="onCellRightClick($event, ma, day)"
                  @click="isMobile ? onCellClick(ma, day) : null"
                  @mousedown="onCellMouseDown(ma, day, $event)"
                  @mouseenter="onCellMouseEnter(ma, day)"
                  @mouseleave="onCellMouseLeave()"
                  @mousemove.passive="onCellMouseMove(ma, day, $event)"
                >
                <div class="cell-fill">
                  <template v-if="cellAnfragart(ma._id, day.iso)">
                    <div class="cell-inner">
                      <font-awesome-icon v-if="cellAnfragart(ma._id, day.iso) === 'tel'" icon="fa-solid fa-phone" class="cell-icon" />
                      <img v-else :src="flipIconUrl" class="cell-icon-img" />
                    </div>
                  </template>
                  <template v-else-if="cellTime(ma._id, day.iso)">
                    <font-awesome-icon :icon="cellIcon(ma._id, day.iso)" class="cell-icon cell-icon--corner" />
                    <div class="cell-inner">
                      <span class="cell-time-text" :class="{ 'cell-time-text--sm': cellTime(ma._id, day.iso).length > 7 }">{{ cellTime(ma._id, day.iso) }}</span>
                    </div>
                  </template>
                  <div v-else class="cell-inner">
                    <span v-if="cellKuerzel(ma._id, day.iso)" class="cell-label">{{ cellKuerzel(ma._id, day.iso) }}</span>
                    <font-awesome-icon v-else-if="cellIcon(ma._id, day.iso)" :icon="cellIcon(ma._id, day.iso)" class="cell-icon" />
                  </div>
                  <CommentBubbleBadge :count="getCellUnreadCount(ma._id, day.iso)" class="comment-bubble" />
                </div>
                </td>
          </tr>
          <tr v-if="filteredMitarbeiter.length === 0">
            <td :colspan="days.length" class="empty-row">
              Keine Mitarbeiter gefunden.
            </td>
          </tr>
        </tbody>
          </table>
        </div>
      </div>
    </div>

      <!-- Feed toggle handle + collapsible feed (fullscreen only) -->
      <div v-if="isFullscreen && ui.panelType === 'kommentare' && !ui.hidden" class="fs-feed-wrapper">
        <!-- Left-edge toggle handle — always visible -->
        <button
          class="fs-feed-toggle"
          :title="fsFeedCollapsed ? 'Feed ausklappen [C]' : 'Feed einklappen [C]'"
          @click="fsFeedCollapsed = !fsFeedCollapsed"
        >
          <font-awesome-icon :icon="fsFeedCollapsed ? 'fa-solid fa-chevron-left' : 'fa-solid fa-chevron-right'" />
        </button>
        <!-- Feed content (collapses horizontally) -->
        <div class="fs-inline-feed" :class="{ 'fs-inline-feed--collapsed': fsFeedCollapsed }">
          <div class="fs-inline-feed-content">
            <KommentarFeed />
          </div>
        </div>
      </div>

    </div><!-- /.fs-body -->

    <!-- ─── Mobile UI (≤768px) ─────────────────────────────────────────── -->
    <template v-if="isMobile">
      <!-- Sticky top bar: search · KW chips · filter button -->
      <div class="m-top-bar">
        <div class="m-top-bar__row">
          <SearchBar
            class="m-search"
            v-model="searchQuery"
            placeholder="Mitarbeiter suchen…"
            aria-label="Mitarbeiter suchen"
          />
          <button
            v-if="hiddenCount > 0"
            class="m-hidden-btn"
            :class="{ active: showHidden }"
            @click="toggleHiddenView"
            :aria-label="showHidden ? 'Zur normalen Ansicht zurück' : 'Ausgeblendete Mitarbeiter anzeigen'"
          >
            <font-awesome-icon :icon="showHidden ? 'fa-solid fa-arrow-left' : 'fa-solid fa-eye-slash'" />
            <span>{{ showHidden ? 'Zurück' : `${hiddenCount} ausgeblendet` }}</span>
          </button>
          <button
            class="m-filter-btn"
            :class="{ active: !!filters.standort || filters.tage !== 30 || !!filters.planungFilter || !!filters.kundeFilter || qualFilter.length > 0 }"
            @click="mobileFilterOpen = true"
            aria-label="Filter"
          >
            <font-awesome-icon icon="fa-solid fa-sliders" />
          </button>
        </div>

        <div class="m-kw-row">
          <div class="m-kw-scroll">
            <button
              v-for="chip in kwChips"
              :key="`${chip.year}-${chip.kw}`"
              class="m-kw-chip"
              :class="{ active: selectedKw?.kw === chip.kw && selectedKw?.year === chip.year, current: chip.isCurrent }"
              @click="toggleKw(chip)"
            >
              KW {{ chip.kw }}
            </button>
          </div>
          <button class="m-today-btn" @click="scrollToToday(); scrollMobileToToday()" title="Heute">
            <font-awesome-icon icon="fa-solid fa-bullseye" />
          </button>
        </div>
      </div>

      <!-- Mitarbeiter card list -->
      <div class="m-card-list">
        <div v-if="loading" class="m-loading">
          <font-awesome-icon icon="fa-solid fa-spinner" spin />
        </div>
        <div v-else-if="!filteredMitarbeiter.length" class="m-empty">
          Keine Mitarbeiter gefunden.
        </div>
        <div
          v-else
          v-for="ma in filteredMitarbeiter"
          :key="`m-${ma._id}`"
          class="m-card"
          :class="{ 'is-expanded': expandedCardId === String(ma._id) }"
        >
          <!-- Header row -->
          <div
            class="m-card__header"
            role="button"
            tabindex="0"
            :aria-expanded="expandedCardId === String(ma._id)"
            @click="toggleCardExpand(String(ma._id))"
            @keydown.enter.prevent="toggleCardExpand(String(ma._id))"
            @keydown.space.prevent="toggleCardExpand(String(ma._id))"
          >
            <button
              class="m-star"
              :class="{ active: starredIds.has(String(ma._id)) }"
              @click.stop="toggleStar(ma._id)"
              aria-label="Favorit"
            >
              <font-awesome-icon :icon="starredIds.has(String(ma._id)) ? 'fa-solid fa-star' : 'fa-regular fa-star'" />
            </button>
            <div
              class="m-name"
              @touchstart.passive="onNameTouchStart($event, ma)"
              @touchend="onNameTouchEnd"
              @touchcancel="onNameTouchEnd"
            >
              <button class="m-name__nach" @click.stop="openCardModal(ma._id)">{{ ma.nachname }}</button>
              <span class="m-name__vor">{{ ma.vorname }}</span>
              <TlBadge v-if="ma.isTL" />
              <span v-else-if="ma.isBewerberstatus" class="bew-badge-inline">Bew.</span>
            </div>
            <span v-if="getMaBereich(ma)" class="m-bereich-pill">{{ getMaBereich(ma) }}</span>
            <button
              class="m-more"
              @click.stop="openMobileMaMenu($event, ma)"
              aria-label="Aktionen"
            >
              <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
            </button>
            <button
              class="m-expand"
              :class="{ active: expandedCardId === String(ma._id) }"
              @click.stop="toggleCardExpand(String(ma._id))"
              aria-label="Details"
            >
              <font-awesome-icon icon="fa-solid fa-chevron-down" />
            </button>
          </div>

          <div
            v-if="getNotizValue(ma._id)"
            class="m-card__note-preview"
            :title="getNotizValue(ma._id)"
            @click="toggleCardExpand(String(ma._id))"
          >
            <font-awesome-icon icon="fa-solid fa-sticky-note" />
            <span>{{ getNotizValue(ma._id) }}</span>
          </div>

          <!-- Horizontal day strip -->
          <div
            class="m-day-strip"
            :ref="setDayStripRef(ma._id)"
          >
            <button
              v-for="day in visibleDays"
              :key="day.iso"
              class="m-day-cell"
              :class="[
                cellClass(ma._id, day.iso),
                {
                  'is-today': day.isToday,
                  'is-weekend': day.isWeekend,
                },
              ]"
              @click="onMobileCellTap(ma, day)"
              @touchstart.passive="onCellTouchStart(ma, day, $event)"
              @touchmove.passive="onCellTouchMove($event)"
              @touchend="onCellTouchEnd(ma, day, $event)"
              @touchcancel="onNameTouchEnd"
            >
              <span class="m-day-cell__weekday">{{ day.weekday }}</span>
              <span class="m-day-cell__date">{{ day.label }}</span>
              <div class="m-day-cell__body">
                <font-awesome-icon
                  v-if="cellAnfragart(ma._id, day.iso) === 'tel'"
                  icon="fa-solid fa-phone"
                  class="m-day-cell__icon"
                />
                <img
                  v-else-if="cellAnfragart(ma._id, day.iso)"
                  :src="flipIconUrl"
                  class="m-day-cell__icon-img"
                />
                <template v-else-if="cellTime(ma._id, day.iso)">
                  <font-awesome-icon
                    v-if="cellIcon(ma._id, day.iso)"
                    :icon="cellIcon(ma._id, day.iso)"
                    class="m-day-cell__icon m-day-cell__icon--corner"
                  />
                  <span class="m-day-cell__time">{{ cellTime(ma._id, day.iso) }}</span>
                </template>
                <span v-else-if="cellKuerzel(ma._id, day.iso)" class="m-day-cell__label">{{ cellKuerzel(ma._id, day.iso) }}</span>
                <font-awesome-icon
                  v-else-if="cellIcon(ma._id, day.iso)"
                  :icon="cellIcon(ma._id, day.iso)"
                  class="m-day-cell__icon"
                />
              </div>
              <CommentBubbleBadge :count="getCellUnreadCount(ma._id, day.iso)" class="m-day-cell__badge" />
            </button>
          </div>

          <!-- Expanded details: Notiz, Kunden, Chronik -->
          <div v-if="expandedCardId === String(ma._id)" class="m-card__details">
            <div class="m-detail-section">
              <label class="m-detail-label">Notiz</label>
              <div
                class="m-notiz"
                :data-mobile-notiz-ma="ma._id"
                contenteditable="plaintext-only"
                @input="onNotizInput(ma._id, $event)"
                @blur="onNotizInput(ma._id, $event)"
              >{{ getNotizValue(ma._id) }}</div>
              <button
                v-if="getNotizValue(ma._id)"
                class="m-notiz-clear"
                @click="clearNotiz(ma._id)"
              >
                <font-awesome-icon icon="fa-solid fa-eraser" /> Notiz löschen
              </button>
            </div>

            <div class="m-detail-section">
              <div class="m-detail-heading">
                <label class="m-detail-label">Kunden</label>
                <button class="m-kunde-add" @click="openKwModal(ma._id)">
                  <font-awesome-icon icon="fa-solid fa-plus" /> Kundenwunsch
                </button>
              </div>
              <div class="m-kunden-pills">
                <span
                  v-for="w in (ma.kundenwuensche || [])"
                  :key="w._id"
                  class="m-kunde-pill"
                  :class="w.typ === 'positiv' ? 'pos' : 'neg'"
                >
                  {{ w.kunde?.kuerzel || w.kunde?.kundName || '?' }}
                  <button class="m-kunde-remove" @click="removeKundenwunsch(ma._id, w._id)" aria-label="Kundenwunsch entfernen">
                    <font-awesome-icon icon="fa-solid fa-times" />
                  </button>
                </span>
                <span v-if="!(ma.kundenwuensche || []).length" class="m-kunden-empty">Keine Kundenwünsche</span>
              </div>
            </div>

            <div class="m-detail-section">
              <label class="m-detail-label">Chronik</label>
              <div class="m-chronik">
                <div
                  v-for="grp in getAktivitaetsLogGrouped(ma._id)"
                  :key="grp.dayKey"
                  class="m-chronik-day"
                >
                  <div class="m-chronik-date">{{ grp.dayLabel }}</div>
                  <div
                    v-for="entry in grp.entries"
                    :key="entry._id"
                    class="m-chronik-entry"
                  >
                    <span class="m-chronik-text">{{ entry.text }}</span>
                    <button class="m-chronik-del" @click="deleteAktivitaetsLog(ma._id, entry._id)">
                      <font-awesome-icon icon="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
                <div class="m-chronik-add">
                  <input
                    type="text"
                    :value="aktivitaetsDraftMap[String(ma._id)] || ''"
                    @input="aktivitaetsDraftMap[String(ma._id)] = $event.target.value"
                    @keydown.enter="addAktivitaetsLog(ma._id)"
                    placeholder="Eintrag hinzufügen…"
                  />
                  <button @click="addAktivitaetsLog(ma._id)" :disabled="!(aktivitaetsDraftMap[String(ma._id)] || '').trim()">
                    <font-awesome-icon icon="fa-solid fa-plus" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile Filter Bottom Sheet -->
      <teleport to="body">
        <transition name="m-sheet">
          <div v-if="mobileFilterOpen" class="m-sheet-backdrop" @click="mobileFilterOpen = false">
            <div class="m-sheet m-sheet--filter" @click.stop>
              <div class="m-sheet__handle"></div>
              <div class="m-sheet__header">
                <h3>Filter</h3>
                <button class="m-sheet__close" @click="mobileFilterOpen = false">
                  <font-awesome-icon icon="fa-solid fa-xmark" />
                </button>
              </div>
              <div class="m-sheet__body">
                <FilterGroup label="Standort">
                  <FilterChip :active="filters.standort === '1'" @click="setStandort('1')">Berlin</FilterChip>
                  <FilterChip :active="filters.standort === '2'" @click="setStandort('2')">Hamburg</FilterChip>
                  <FilterChip :active="filters.standort === '3'" @click="setStandort('3')">Köln</FilterChip>
                </FilterGroup>
                <FilterDivider />
                <FilterGroup label="Zeitraum">
                  <FilterChip v-for="opt in [7, 14, 30]" :key="opt" :active="filters.tage === opt" @click="setTage(opt)">
                    {{ opt }} Tage
                  </FilterChip>
                </FilterGroup>
                <FilterDivider />
                <FilterGroup label="Planung">
                  <FilterChip :active="filters.planungFilter === 'eingeplant'" @click="setPlanung('eingeplant')">Eingeplante</FilterChip>
                  <FilterChip :active="filters.planungFilter === 'ungeplant'" @click="setPlanung('ungeplant')">Ungeplante</FilterChip>
                </FilterGroup>
                <FilterDivider />
                <FilterGroup label="🤝 Kunde">
                  <div class="kunde-filter-search">
                    <KundeSearch
                      :standort="filters.standort"
                      placeholder="Kunde suchen…"
                      @select="(k) => { filterKunde = k; filters.kundeFilter = k?._id || null; }"
                    />
                    <button v-if="filters.kundeFilter" class="kunde-filter-clear" @click="clearKundeFilter">
                      <font-awesome-icon icon="fa-solid fa-xmark" />
                    </button>
                  </div>
                </FilterGroup>
                <FilterDivider />
                <FilterChip class="reset-chip" @click="resetFilters">
                  <font-awesome-icon icon="fa-solid fa-rotate-left" /> Zurücksetzen
                </FilterChip>
              </div>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- Mobile Action Sheet (status setter) -->
      <teleport to="body">
        <transition name="m-sheet">
          <div v-if="ctxMenu.open && isMobile" class="m-sheet-backdrop" @click="closeCtxMenu">
            <div class="m-sheet m-sheet--action" @click.stop>
              <div class="m-sheet__handle"></div>
              <div class="m-sheet__header">
                <div>
                  <h3>{{ ctxMenu.ma?.vorname }} {{ ctxMenu.ma?.nachname }}</h3>
                  <span class="m-sheet__sub">{{ formatIsoDate(ctxMenu.day) }}</span>
                </div>
                <button class="m-sheet__close" @click="closeCtxMenu">
                  <font-awesome-icon icon="fa-solid fa-xmark" />
                </button>
              </div>

              <div class="m-sheet__body">
                <!-- Existing entries -->
                <template v-if="ctxMenu.entries.length">
                  <div class="m-sheet-group-label">Vorhandene Einträge</div>
                  <div v-for="entry in ctxMenu.entries" :key="entry._id" class="m-action-entry">
                    <span>
                      <font-awesome-icon v-if="entryIcon(entry) && entry._source !== 'einsatz' && entry.typ !== 'planned'" :icon="entryIcon(entry)" />
                      {{ entryLabel(entry) }}
                    </span>
                    <button v-if="entry._source !== 'einsatz'" class="m-action-del" @click="deleteEntry(entry._id); closeCtxMenu()">
                      <font-awesome-icon icon="fa-solid fa-trash" />
                    </button>
                  </div>
                  <button
                    v-for="entry in ctxMenu.entries.filter(e => e._source === 'einsatz' || e.typ === 'planned')"
                    :key="'open-' + entry._id"
                    class="m-action-btn m-action-btn--open-einsatz"
                    @click="openEinsatz(entry)"
                  >
                    <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" /> Einsatz öffnen
                  </button>
                </template>

                <div class="m-sheet-group-label">Status setzen</div>
                <template v-for="opt in statusOptions" :key="opt.value">
                  <template v-if="opt.value === 'partially'">
                    <button :class="['m-action-btn', `m-action-btn--${opt.value}`, { active: partiallyTime.open }]" @click="togglePartiallyTime">
                      <font-awesome-icon :icon="opt.icon" /> {{ opt.label }}
                      <font-awesome-icon icon="fa-solid fa-clock" class="m-clock-ico" />
                    </button>
                    <div v-if="partiallyTime.open" class="m-time-picker">
                      <label>Von <input type="time" v-model="partiallyTime.zeitVon" /></label>
                      <label>Bis <input type="time" v-model="partiallyTime.zeitBis" /></label>
                      <div class="m-time-actions">
                        <button class="m-action-btn m-action-btn--primary" @click="setStatus('partially', partiallyTime.zeitVon || null, partiallyTime.zeitBis || null)">
                          <font-awesome-icon icon="fa-solid fa-check" /> Speichern
                        </button>
                        <button class="m-action-btn m-action-btn--ghost" @click="setStatus('partially')">Ohne Zeit</button>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="opt.value === 'blocked'">
                    <button :class="['m-action-btn', `m-action-btn--${opt.value}`, { active: blockedTime.open }]" @click="toggleBlockedTime">
                      <font-awesome-icon :icon="opt.icon" /> {{ opt.label }}
                      <font-awesome-icon icon="fa-solid fa-clock" class="m-clock-ico" />
                    </button>
                    <div v-if="blockedTime.open" class="m-time-picker">
                      <label>Von <input type="time" v-model="blockedTime.zeitVon" /></label>
                      <label>Bis <input type="time" v-model="blockedTime.zeitBis" /></label>
                      <div class="m-time-actions">
                        <button class="m-action-btn m-action-btn--primary" @click="setStatus('blocked', blockedTime.zeitVon || null, blockedTime.zeitBis || null)">
                          <font-awesome-icon icon="fa-solid fa-check" /> Speichern
                        </button>
                        <button class="m-action-btn m-action-btn--ghost" @click="setStatus('blocked')">Ohne Zeit</button>
                      </div>
                    </div>
                  </template>
                  <button
                    v-else-if="opt.anfragart"
                    class="m-action-btn m-action-btn--angefragt"
                    @click="setStatus(opt.value)"
                  >
                    <font-awesome-icon v-if="opt.anfragart === 'tel'" :icon="opt.icon" />
                    <img v-else :src="flipIconUrl" class="m-flip-ico" />
                    {{ opt.label }}
                  </button>
                  <button
                    v-else
                    :class="['m-action-btn', `m-action-btn--${opt.value}`]"
                    @click="setStatus(opt.value)"
                  >
                    <font-awesome-icon :icon="opt.icon" /> {{ opt.label }}
                  </button>
                </template>

                <div class="m-sheet-group-label">Einsatz</div>
                <button :class="['m-action-btn', 'm-action-btn--eingeplant', { active: eingeplantPicker.open }]" @click="toggleEingeplantPicker">
                  <font-awesome-icon icon="fa-solid fa-clipboard-list" /> Eingeplant
                </button>
                <div v-if="eingeplantPicker.open" class="m-eingeplant-picker">
                  <KundeSearch
                    :standort="filters.standort"
                    placeholder="Kunde wählen…"
                    @select="onEingeplantKundeSelect"
                  />
                  <button class="m-action-btn m-action-btn--ghost" @click="onEingeplantKundeSelect(null)">Ohne Kunde</button>
                </div>

                <div class="m-sheet-group-label">Abwesenheit</div>
                <button
                  v-for="opt in absenceOptions"
                  :key="opt.value"
                  class="m-action-btn"
                  @click="setAbsence(opt.value)"
                >
                  <font-awesome-icon :icon="opt.icon" /> {{ opt.label }}
                </button>

                <div class="m-sheet-group-label">Kommunikation</div>
                <button class="m-action-btn" @click="openChatModal(ctxMenu.ma, { iso: ctxMenu.day }); closeCtxMenu()">
                  <font-awesome-icon icon="fa-solid fa-comments" /> Kommentare
                  <span v-if="getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) > 0" class="m-unread-badge">
                    {{ getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) }}
                  </span>
                </button>

                <button class="m-action-btn m-action-btn--danger" @click="clearStatus">
                  <font-awesome-icon icon="fa-solid fa-eraser" /> Löschen
                </button>
              </div>
            </div>
          </div>
        </transition>
      </teleport>
    </template>

    <!-- Help Modal -->
    <HelpModal v-model="showHelp">
      <template #title>Dispo-Tabelle — Hilfe</template>

      <template #toc>
        <nav class="help-toc">
          <span class="help-toc-label">Inhalt</span>
          <button data-section="help-s-shortcuts"    @click="scrollToHelpSection('help-s-shortcuts')">Shortcuts</button>
          <button data-section="help-s-filter"       @click="scrollToHelpSection('help-s-filter')">Filter &amp; Ansicht</button>
          <button data-section="help-s-favoriten"    @click="scrollToHelpSection('help-s-favoriten')">Favoriten</button>
          <button data-section="help-s-notizen"      @click="scrollToHelpSection('help-s-notizen')">Notiz</button>
          <button data-section="help-s-kundenwunsch" @click="scrollToHelpSection('help-s-kundenwunsch')">Kundenwünsche</button>
          <button data-section="help-s-chronik"      @click="scrollToHelpSection('help-s-chronik')">Chronik</button>
          <button data-section="help-s-status"       @click="scrollToHelpSection('help-s-status')">Zellen-Status</button>
          <button data-section="help-s-comments"     @click="scrollToHelpSection('help-s-comments')">Kommentare</button>
          <button data-section="help-s-multiselect"  @click="scrollToHelpSection('help-s-multiselect')">Mehrfachauswahl</button>
          <button data-section="help-s-legende"      @click="scrollToHelpSection('help-s-legende')">Legende</button>
        </nav>
      </template>

      <div id="help-s-shortcuts" class="help-section">
        <h4>Tastatur-Shortcuts</h4>
        <table class="help-shortcuts">
          <tbody>
            <tr><td><kbd>V</kbd></td><td>Vollbild ein/aus</td></tr>
            <tr><td><kbd>C</kbd></td><td>Kommentar-Feed ein/aus</td></tr>
            <tr><td><kbd>H</kbd></td><td>Hilfe ein/aus</td></tr>
            <tr><td><kbd>S</kbd></td><td>Suche fokussieren</td></tr>
            <tr><td><kbd>1</kbd> – <kbd>9</kbd></td><td>Kalenderwoche wählen (1 = aktuelle KW)</td></tr>
            <tr><td><kbd>+</kbd></td><td>Zoom vergrößern</td></tr>
            <tr><td><kbd>–</kbd></td><td>Zoom verkleinern</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Auswahl aufheben / Modal schließen</td></tr>
          </tbody>
        </table>
      </div>

      <div id="help-s-filter" class="help-section">
        <h4>Filter &amp; Ansicht</h4>
        <p>Der <em>Bereich</em>-Filter (Klick auf den Bereich-Spalten-Header) filtert nach Service (S) oder Logistik (L). Spaltenbreiten lassen sich per Drag auf den Trennlinien in der Kopfzeile individuell anpassen.</p>
      </div>

      <div id="help-s-favoriten" class="help-section">
        <h4>Favoriten, Mitarbeiter-Karte &amp; Ausblenden</h4>
        <p>Klicke auf den <font-awesome-icon icon="fa-regular fa-star" /> Stern neben einem Namen für Favoriten (werden oben gelistet). <strong>Rechtsklick</strong> auf den Namen öffnet ein Menü mit <em>Karte Öffnen</em>, Direktanruf und <em>Ausblenden</em>. Ausgeblendete Mitarbeiter erreichst du über den Button in der oberen Zeile; dort kannst du sie per Kontextmenü wieder einblenden.</p>
      </div>

      <div id="help-s-notizen" class="help-section">
        <h4>Notiz</h4>
        <p>Die <em>Notiz</em>-Spalte ist direkt editierbar — Klicken und tippen, Änderungen werden automatisch gespeichert.</p>
      </div>

      <div id="help-s-kundenwunsch" class="help-section">
        <h4>Kundenwünsche</h4>
        <p>In der <em>Kunden</em>-Spalte zeigt <strong>+</strong> einen Dialog zum Hinterlegen von positiven oder negativen Kundenwünschen. Bestehende Wünsche erscheinen als farbige Pills.</p>
      </div>

      <div id="help-s-chronik" class="help-section">
        <h4>Chronik</h4>
        <p>Die <em>Aktivität</em>-Spalte zeigt den mitarbeiterbezogenen Chronik-Log — klicken zum Ausklappen, Einträge hinzufügen oder löschen.</p>
      </div>

      <div id="help-s-status" class="help-section">
        <h4>Zellen-Status</h4>
        <p><strong>Rechtsklick</strong> auf eine Zelle öffnet das Kontextmenü. Verfügbar, Eingeschränkt und Blocked können optional mit einer <em>Zeitspanne</em> (Von/Bis) versehen werden. Für Eingeplant lässt sich direkt ein Kunde zuordnen.</p>
      </div>

      <div id="help-s-comments" class="help-section">
        <h4>Kommentare</h4>
        <p>Über das Kontextmenü (Rechtsklick) → <em>Kommentare</em> kannst du Notizen zu einer einzelnen Zelle (Tag) hinterlassen. Ungelesene Kommentare erscheinen als roter Badge im Kommentar-Feed.</p>
      </div>

      <div id="help-s-multiselect" class="help-section">
        <h4>Mehrfachauswahl</h4>
        <p>Halte <kbd>⌘ Cmd</kbd> (Mac) / <kbd>Strg</kbd> (Windows) gedrückt und klicke oder ziehe über mehrere Zellen. Danach <strong>Rechtsklick</strong> auf die Auswahl, um den Status für alle gleichzeitig zu setzen.</p>
      </div>

      <div id="help-s-legende" class="help-section">
        <h4>Legende</h4>
        <div class="help-legend">
          <div class="help-legend-item"><span class="legend-dot legend-available"></span> Verfügbar</div>
          <div class="help-legend-item"><span class="legend-dot legend-partially"></span> Eingeschränkt</div>
          <div class="help-legend-item"><span class="legend-dot legend-blocked"></span> Blocked / Urlaub / Krank</div>
          <div class="help-legend-item"><span class="legend-dot legend-planned"></span> Eingeplant (Einsatz)</div>
          <div class="help-legend-item"><span class="legend-dot legend-angefragt"></span> Angefragt (Flip / Tel.)</div>
        </div>
      </div>
    </HelpModal>

    <!-- Qualifikation Dropdown (teleported to escape overflow/stacking-context clipping) -->
    <teleport to="body">
      <div
        v-if="qualDropdownOpen && qualSuggestions.length"
        class="qual-dropdown"
        :style="qualDropdownStyle"
      >
        <div
          v-for="q in qualSuggestions"
          :key="q._id"
          class="qual-dropdown-item"
          @mousedown.prevent="addQual(q)"
        >
          <span class="qual-key">{{ q.qualificationKey }}</span>
          {{ q.designation }}
        </div>
      </div>
    </teleport>

    <!-- Bereich Filter Menu -->
    <teleport to="body">
      <div v-if="bereichMenuOpen" class="ctx-overlay" @click="bereichMenuOpen = false" @contextmenu.prevent="bereichMenuOpen = false">
        <div class="ctx-menu bereich-filter-menu" :style="{ top: bereichMenuPos.y + 'px', left: bereichMenuPos.x + 'px' }" @click.stop>
          <div class="ctx-item" :class="{ active: bereichFilter === 'S' }" @click="setBereich('S'); bereichMenuOpen = false">Service (S)</div>
          <div class="ctx-item" :class="{ active: bereichFilter === 'L' }" @click="setBereich('L'); bereichMenuOpen = false">Logistik (L)</div>
          <div v-if="bereichFilter" class="ctx-item ctx-item-remove" @click="setBereich(null); bereichMenuOpen = false">Filter entfernen</div>
        </div>
      </div>
    </teleport>

    <!-- Cell Tooltip -->
    <teleport to="body">
      <div
        v-if="cellTooltipState.visible"
        class="dispo-cell-tooltip"
        :class="{ 'dispo-cell-tooltip--comments': cellTooltipState.comments.length }"
        :style="{
          top: cellTooltipState.flipped ? (cellTooltipState.y - 8) + 'px' : (cellTooltipState.y + 20) + 'px',
          left: cellTooltipState.x + 'px',
          transform: cellTooltipState.flipped ? 'translateY(-100%)' : 'none'
        }"
      >
        <template v-if="cellTooltipState.comments.length">
          <div v-for="c in cellTooltipState.comments" :key="c._id" class="tooltip-comment">
            <div class="tooltip-comment-header">
              <span class="tooltip-comment-author">{{ c.author }}</span>
              <span class="tooltip-comment-time">{{ formatDateTime(c.timestamp) }}</span>
            </div>
            <p class="tooltip-comment-text">{{ c.text }}</p>
          </div>
        </template>
        <template v-else>{{ cellTooltipState.text }}</template>
      </div>
    </teleport>

    <!-- Name Context Menu -->
    <teleport to="body">
      <div v-if="nameMenu.open" class="ctx-overlay" @click="closeNameMenu" @contextmenu.prevent="closeNameMenu">
        <div
          class="ctx-menu name-ctx-menu"
          :style="{ top: nameMenu.y + 'px', left: nameMenu.x + 'px' }"
          @click.stop
        >
          <div class="ctx-header">{{ nameMenu.ma?.vorname }} {{ nameMenu.ma?.nachname }}</div>
          <div class="ctx-divider"></div>
          <button class="ctx-item" @click="openKarte">
            <font-awesome-icon icon="fa-solid fa-address-card" class="ctx-item-icon" /> Karte Öffnen
          </button>
          <button class="ctx-item" @click="openKwFromNameMenu">
            <font-awesome-icon icon="fa-solid fa-handshake" class="ctx-item-icon" /> Kundenwunsch hinzufügen
          </button>
          <button class="ctx-item" @click="focusNotizFromNameMenu">
            <font-awesome-icon icon="fa-solid fa-sticky-note" class="ctx-item-icon" /> Notiz bearbeiten
          </button>
          <button
            v-if="nameMenu.ma?.telefon"
            class="ctx-item ctx-item--phone ctx-item--phone-copy"
            type="button"
            @click="copyPhoneFromNameMenu"
          >
            <font-awesome-icon icon="fa-solid fa-phone" class="ctx-item-icon" />
            <span class="ctx-phone-text">{{ nameMenu.ma.telefon }}</span>
            <span
              class="ctx-phone-copy"
              :class="{ 'is-copied': copiedPhone }"
              :title="copiedPhone ? 'Kopiert' : 'Nummer kopieren'"
              :aria-label="copiedPhone ? 'Kopiert' : 'Nummer kopieren'"
            >
              <font-awesome-icon :icon="copiedPhone ? 'fa-solid fa-check' : 'fa-solid fa-copy'" class="ctx-copy-icon" />
            </span>
          </button>
          <div class="ctx-divider"></div>
          <button v-if="!hiddenIds.has(String(nameMenu.ma?._id))" class="ctx-item ctx-item--hide" @click="hideMA(nameMenu.ma._id)">
            <font-awesome-icon icon="fa-solid fa-eye-slash" class="ctx-item-icon" /> Ausblenden
          </button>
          <button v-else class="ctx-item" @click="unhideMA(nameMenu.ma._id)">
            <font-awesome-icon icon="fa-solid fa-eye" class="ctx-item-icon" /> Einblenden
          </button>
        </div>
      </div>
    </teleport>

    <!-- Employee Card Modal -->
    <EmployeeCardModal
      :mitarbeiterId="cardModal.open ? cardModal.mitarbeiterId : null"
      @close="closeCardModal"
    />

    <!-- Kundenwunsch Modal -->
    <teleport to="body">
      <div v-if="kwModal.open" class="modal-overlay" @click="closeKwModal">
        <div class="kw-modal" @click.stop>
          <div class="kw-modal-header">
            <span class="kw-modal-title">Kundenwunsch hinzufügen</span>
            <button class="close-btn" @click="closeKwModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <div class="kw-modal-body">
            <div class="kw-modal-typ">
              <button
                class="kw-typ-btn"
                :class="{ active: kwModal.typ === 'positiv' }"
                @click="kwModal.typ = 'positiv'"
              >
                🤝
              </button>
              <button
                class="kw-typ-btn kw-typ-btn--neg"
                :class="{ active: kwModal.typ === 'negativ' }"
                @click="kwModal.typ = 'negativ'"
              >
                🚫
              </button>
            </div>
            <KundeSearch ref="kwSearchRef" :standort="filters.standort" :mitarbeiter-id="kwModal.maId" @select="addKundenwunsch" />
          </div>
        </div>
      </div>
    </teleport>

    <!-- Comment Thread Modal -->
    <teleport to="body">
      <div v-if="chatModal.open" class="modal-overlay" @click="closeChatModal">
        <div class="chat-modal" @click.stop>
          <div class="chat-modal-header">
            <div class="chat-modal-title">
              <font-awesome-icon icon="fa-solid fa-comments" />
              <span>{{ chatModal.ma?.vorname }} {{ chatModal.ma?.nachname }} · {{ formatIsoDate(chatModal.day) }}</span>
            </div>
            <button class="close-btn" @click="closeChatModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <div class="chat-thread" ref="chatThreadRef">
            <p v-if="!chatModal.comments.length" class="chat-empty">Noch keine Kommentare.</p>
            <div
              v-for="c in chatModal.comments"
              :key="c._id"
              class="chat-message"
              :class="{ 'chat-message--own': isOwnComment(c) }"
            >
              <div class="chat-message-meta">
                <span class="chat-message-author">{{ c.author }}</span>
                <span class="chat-message-time">{{ formatDateTime(c.timestamp) }}</span>
                <button v-if="isOwnComment(c)" class="chat-delete-btn" @click="deleteKommentar(c._id)" title="Löschen">
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </div>
              <p class="chat-message-text">{{ c.text }}</p>
            </div>
          </div>
          <div class="chat-input-row">
            <textarea
              v-model="chatModal.newText"
              class="chat-textarea"
              placeholder="Kommentar schreiben… (Ctrl+Enter senden)"
              rows="2"
              @keydown.ctrl.enter.prevent="postComment"
              @keydown.meta.enter.prevent="postComment"
            ></textarea>
            <button class="chat-send-btn" @click="postComment" :disabled="!chatModal.newText.trim() || chatModal.loading">
              <font-awesome-icon icon="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Cell Context Menu (desktop only — mobile uses bottom-sheet) -->
    <teleport to="body">
      <div v-if="ctxMenu.open && !isMobile" class="ctx-overlay" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
        <div
          class="ctx-menu"
          :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
          @click.stop
        >
          <div class="ctx-header">
            <template v-if="ctxMenu.isMulti">
              <span v-if="selectionMaCount > 1">{{ selectionMaCount }} Mitarbeiter</span>
              <span v-else>{{ ctxMenu.ma?.vorname }} {{ ctxMenu.ma?.nachname }}</span>
              <span class="ctx-multi-label">
                {{ selectedCells.size }} Felder
                <template v-if="selectionDateRange && selectionDateRange.from !== selectionDateRange.to">
                  &nbsp;·&nbsp;{{ formatIsoDate(selectionDateRange.from) }} – {{ formatIsoDate(selectionDateRange.to) }}
                </template>
                <template v-else-if="selectionDateRange">
                  &nbsp;·&nbsp;{{ formatIsoDate(selectionDateRange.from) }}
                </template>
              </span>
            </template>
            <template v-else>
              {{ ctxMenu.ma?.vorname }} {{ ctxMenu.ma?.nachname }}
            </template>
          </div>

          <!-- Existing entries -->
          <template v-if="ctxMenu.entries.length">
            <div v-for="entry in ctxMenu.entries" :key="entry._id" class="ctx-entry">
              <span>
                <font-awesome-icon v-if="entryIcon(entry)" :icon="entryIcon(entry)" class="ctx-entry-icon" />
                {{ entryLabel(entry) }}
                <span v-if="entry.createdAt" class="ctx-entry-ts">· {{ formatEntryTs(entry.createdAt) }}</span>
              </span>
              <button v-if="entry._source !== 'einsatz'" class="ctx-delete-btn" @click="deleteEntry(entry._id); closeCtxMenu()">
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </div>
            <template v-if="ctxMenu.entries.some(e => e._source === 'einsatz' || e.typ === 'planned')">
              <div class="ctx-divider"></div>
              <button
                v-for="entry in ctxMenu.entries.filter(e => e._source === 'einsatz' || e.typ === 'planned')"
                :key="'open-' + entry._id"
                class="ctx-item ctx-item--open"
                @click="openEinsatz(entry)"
              >
                <font-awesome-icon icon="fa-solid fa-arrow-up-right-from-square" class="ctx-item-icon" />
                Einsatz öffnen
              </button>
            </template>
            <div class="ctx-divider"></div>
          </template>

          <!-- Status options -->
          <template v-for="opt in statusOptions" :key="opt.value">
            <!-- Eingeschränkt: expandable time picker -->
            <template v-if="opt.value === 'partially'">
              <button
                :class="['ctx-item', 'ctx-item--partially', { active: partiallyTime.open }]"
                @click="togglePartiallyTime"
              >
                <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
                <font-awesome-icon icon="fa-solid fa-clock" class="ctx-item-clock" />
              </button>
              <div v-if="partiallyTime.open" class="ctx-time-picker">
                <div class="ctx-time-row">
                  <label>Von</label>
                  <input type="time" v-model="partiallyTime.zeitVon" />
                  <label>Bis</label>
                  <input type="time" v-model="partiallyTime.zeitBis" />
                </div>
                <div class="ctx-time-actions">
                  <button class="ctx-time-confirm" @click="setStatus('partially', partiallyTime.zeitVon || null, partiallyTime.zeitBis || null)">
                    <font-awesome-icon icon="fa-solid fa-check" /> Speichern
                  </button>
                  <button class="ctx-time-skip" @click="setStatus('partially')">Ohne Zeit</button>
                </div>
              </div>
            </template>
            <!-- Blocked: expandable time picker -->
            <template v-else-if="opt.value === 'blocked'">
              <button
                :class="['ctx-item', 'ctx-item--blocked', { active: blockedTime.open }]"
                @click="toggleBlockedTime"
              >
                <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
                <font-awesome-icon icon="fa-solid fa-clock" class="ctx-item-clock" />
              </button>
              <div v-if="blockedTime.open" class="ctx-time-picker">
                <div class="ctx-time-row">
                  <label>Von</label>
                  <input type="time" v-model="blockedTime.zeitVon" />
                  <label>Bis</label>
                  <input type="time" v-model="blockedTime.zeitBis" />
                </div>
                <div class="ctx-time-actions">
                  <button class="ctx-time-confirm" @click="setStatus('blocked', blockedTime.zeitVon || null, blockedTime.zeitBis || null)">
                    <font-awesome-icon icon="fa-solid fa-check" /> Speichern
                  </button>
                  <button class="ctx-time-skip" @click="setStatus('blocked')">Ohne Zeit</button>
                </div>
              </div>
            </template>
            <!-- Angefragt: composite icon (? badge + phone/flip) -->
            <button
              v-else-if="opt.anfragart"
              class="ctx-item ctx-item--angefragt"
              @click="setStatus(opt.value)"
            >
              <span class="ctx-icon-composite">
                <font-awesome-icon v-if="opt.anfragart === 'tel'" :icon="opt.icon" class="ctx-icon-main" />
                <img v-else :src="flipIconUrl" class="ctx-icon-flip" />
              </span>
              {{ opt.label }}
            </button>
            <!-- All other status options -->
            <button
              v-else
              :class="['ctx-item', `ctx-item--${opt.value}`]"
              @click="setStatus(opt.value)"
            >
              <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
            </button>
          </template>

          <div class="ctx-divider"></div>

          <!-- Eingeplant (manuell) -->
          <button
            :class="['ctx-item', 'ctx-item--eingeplant', { active: eingeplantPicker.open }]"
            @click="toggleEingeplantPicker"
          >
            <font-awesome-icon icon="fa-solid fa-clipboard-list" class="ctx-item-icon" /> Eingeplant
          </button>
          <div v-if="eingeplantPicker.open" class="ctx-eingeplant-picker" @click.stop>
            <KundeSearch
              ref="ctxKundeSearchRef"
              :standort="filters.standort"
              placeholder="Kunde wählen…"
              @select="onEingeplantKundeSelect"
            />
            <button class="ctx-time-skip" @click="onEingeplantKundeSelect(null)">Ohne Kunde</button>
          </div>

          <div class="ctx-divider"></div>

          <!-- Absence options -->
          <button
            v-for="opt in absenceOptions"
            :key="opt.value"
            class="ctx-item"
            @click="setAbsence(opt.value)"
          >
            <font-awesome-icon :icon="opt.icon" class="ctx-item-icon" /> {{ opt.label }}
          </button>

          <template v-if="!ctxMenu.isMulti">
            <div class="ctx-divider"></div>
            <button class="ctx-item" @click="openChatModal(ctxMenu.ma, { iso: ctxMenu.day })">
              <font-awesome-icon icon="fa-solid fa-comments" class="ctx-item-icon" />
              Kommentare
              <span v-if="getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) > 0" class="ctx-unread-badge">
                {{ getCellUnreadCount(ctxMenu.ma?._id, ctxMenu.day) }}
              </span>
            </button>
          </template>

          <div class="ctx-divider"></div>

          <button class="ctx-item ctx-item--clear" @click="clearStatus">
            <font-awesome-icon icon="fa-solid fa-eraser" class="ctx-item-icon" /> Löschen
          </button>
        </div>
      </div>
    </teleport>
  </div>
  </Transition>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onUnmounted, reactive, nextTick, watch } from 'vue';

// Custom directive: sets innerText only once on mount to avoid cursor-reset on contenteditable
const vSetText = {
  mounted(el, binding) {
    el.innerText = binding.value || '';
  },
};
import { useRouter, useRoute } from 'vue-router';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import { useFlipAll } from '@/stores/flipAll';
import { useComments } from '@/stores/comments';
import { useUi } from '@/stores/ui';
import FilterPanel from '@/components/FilterPanel.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import flipIconUrl from '@/assets/flip.png';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import FilterDivider from '@/components/ui-elements/FilterDivider.vue';
import FilterDropdown from '@/components/FilterDropdown.vue';
import TlBadge from '@/components/ui-elements/TlBadge.vue';

import EmployeeCardModal from '@/components/EmployeeCardModal.vue';
import HelpModal from '@/components/HelpModal.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import CommentBubbleBadge from '@/components/CommentBubbleBadge.vue';
import KommentarFeed from '@/components/KommentarFeed.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarFilter from '@/components/ui-elements/ToolbarFilter.vue';

const auth = useAuth();
const dataCache = useDataCache();
const flip = useFlipAll();
const comments = useComments();
const ui = useUi();
const router = useRouter();
const route = useRoute();

// ─── State ───
const loading = ref(true);
const mitarbeiter = shallowRef([]);
const eintraege = shallowRef([]);
const searchQuery = ref('');
const searchInputNormal = ref(null);
const searchInputFs = ref(null);
const tableWrapper = ref(null);
const chatThreadRef = ref(null);
const filterExpanded = ref(false);
const isMobile = ref(window.innerWidth <= 768);
const starredIds = ref(new Set());
const hiddenIds = ref(new Set());
const showHidden = ref(false);
const highlightedMaId = ref(null);
const cellTooltipState = ref({ visible: false, text: '', comments: [], x: 0, y: 0, flipped: false });
const bereichFilter = ref(null); // null | 'S' | 'L'
const focusedDay = ref(null); // iso string of focused day column, or null

function toggleFocusedDay(iso) {
  focusedDay.value = focusedDay.value === iso ? null : iso;
}
const tableZoom = ref(100); // percent: 60–150
const isFullscreen = ref(false);
const fsFilterExpanded = ref(false); // fullscreen filter toggle
const bereichMenuOpen = ref(false);
const bereichMenuPos = ref({ x: 0, y: 0 });
const showHelp = ref(false);
const notizMap = reactive({});
const aktivitaetsDraftMap = reactive({});
const expandedNotiz = ref(null); // maId of currently expanded notiz cell
const expandedAktivitaet = ref(null); // maId of currently expanded activity cell
const expandedNotizHeight = ref(null); // px height of expanded left-pane row
let _notizTimers = {};
let _notizRowObserver = null;

// ─── Row height sync: left pane → right pane ───
const rowHeights = reactive({});
let _leftRowObserver = null;

function _rebuildRowObserver() {
  if (_leftRowObserver) { _leftRowObserver.disconnect(); _leftRowObserver = null; }
  nextTick(() => {
    const rows = document.querySelectorAll('tr[data-left-row]');
    if (!rows.length) return;
    _leftRowObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const maId = entry.target.dataset.leftRow;
        // Use sub-pixel precision (contentRect / getBoundingClientRect) instead of
        // offsetHeight. offsetHeight rounds to the nearest integer; on rows with
        // fractional pixel heights this loses ~0.5px per row and accumulates into
        // a visible vertical offset between the left and right pane after many rows.
        const r = entry.borderBoxSize?.[0];
        const h = r ? r.blockSize : entry.target.getBoundingClientRect().height;
        rowHeights[maId] = h;
      }
    });
    rows.forEach(row => _leftRowObserver.observe(row));
  });
}

// ─── Partially Time Picker ───
const partiallyTime = reactive({ open: false, zeitVon: '', zeitBis: '' });

function togglePartiallyTime() {
  partiallyTime.open = !partiallyTime.open;
  if (!partiallyTime.open) {
    partiallyTime.zeitVon = '';
    partiallyTime.zeitBis = '';
  }
  if (partiallyTime.open) { blockedTime.open = false; blockedTime.zeitVon = ''; blockedTime.zeitBis = ''; eingeplantPicker.open = false; }
}

// ─── Blocked Time Picker ───
const blockedTime = reactive({ open: false, zeitVon: '', zeitBis: '' });

function toggleBlockedTime() {
  blockedTime.open = !blockedTime.open;
  if (!blockedTime.open) {
    blockedTime.zeitVon = '';
    blockedTime.zeitBis = '';
  }
  if (blockedTime.open) { partiallyTime.open = false; partiallyTime.zeitVon = ''; partiallyTime.zeitBis = ''; eingeplantPicker.open = false; }
}

// ─── Eingeplant (manuell) Picker ───
const eingeplantPicker = reactive({ open: false });
const ctxKundeSearchRef = ref(null);

function toggleEingeplantPicker() {
  eingeplantPicker.open = !eingeplantPicker.open;
  if (eingeplantPicker.open) {
    partiallyTime.open = false; partiallyTime.zeitVon = ''; partiallyTime.zeitBis = '';
    blockedTime.open = false; blockedTime.zeitVon = ''; blockedTime.zeitBis = '';
  }
}

async function onEingeplantKundeSelect(kunde) {
  const isMulti = ctxMenu.isMulti;
  const singleMaId = ctxMenu.ma?._id;
  const singleDay = ctxMenu.day;
  const grouped = isMulti ? getGroupedSelection() : null;
  const toDeleteIds = [];
  const splitFragments = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    const entriesToDelete = ctxMenu.entries.filter((e) => e._source !== 'einsatz');
    for (const e of entriesToDelete) {
      toDeleteIds.push(e._id);
      const von = String(e.datumVon).slice(0, 10);
      const bis = String(e.datumBis || e.datumVon).slice(0, 10);
      const maId = typeof e.mitarbeiter === 'object' ? String(e.mitarbeiter._id || e.mitarbeiter) : String(e.mitarbeiter);
      if (von < singleDay) splitFragments.push({ from: von, to: isoAddDays(singleDay, -1), entry: e, maId });
      if (bis > singleDay) splitFragments.push({ from: isoAddDays(singleDay, 1), to: bis, entry: e, maId });
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    if (toDeleteIds.length) {
      await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
      localRemoveEntries(toDeleteIds);
    }
    const created = [];
    if (isMulti) {
      for (const { maId, ranges } of grouped) {
        for (const { from, to } of ranges) {
          const { data } = await api.post('/api/dispo', {
            mitarbeiter: maId, datumVon: from, datumBis: to,
            typ: 'verfuegbarkeit', verfuegbarkeit: 'eingeplant',
            ...(kunde ? { kundeRef: kunde._id, kundeKuerzel: kunde.kuerzel || kunde.kundName?.substring(0, 6) } : {}),
          });
          created.push(data);
        }
      }
    } else {
      for (const { from, to, entry, maId } of splitFragments) {
        const { data } = await api.post('/api/dispo', {
          mitarbeiter: maId, datumVon: from, datumBis: to, typ: entry.typ,
          ...(entry.verfuegbarkeit ? { verfuegbarkeit: entry.verfuegbarkeit } : {}),
          ...(entry.abwesenheitsKategorie ? { abwesenheitsKategorie: entry.abwesenheitsKategorie } : {}),
          ...(entry.zeitVon ? { zeitVon: entry.zeitVon } : {}),
          ...(entry.zeitBis ? { zeitBis: entry.zeitBis } : {}),
        });
        created.push(data);
      }
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: singleMaId, datumVon: singleDay, datumBis: singleDay,
        typ: 'verfuegbarkeit', verfuegbarkeit: 'eingeplant',
        ...(kunde ? { kundeRef: kunde._id, kundeKuerzel: kunde.kuerzel || kunde.kundName?.substring(0, 6) } : {}),
      });
      created.push(data);
    }
    localAddEntries(created);
  } catch (err) {
    console.error('Eingeplant setzen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

function _observeExpandedRow(maId) {
  if (_notizRowObserver) { _notizRowObserver.disconnect(); _notizRowObserver = null; }
  if (!maId) return;
  nextTick(() => {
    const leftRow = document.querySelector(`tr[data-left-row="${maId}"]`);
    if (!leftRow) return;
    _notizRowObserver = new ResizeObserver(() => {
      expandedNotizHeight.value = leftRow.offsetHeight;
    });
    _notizRowObserver.observe(leftRow);
  });
}

// ─── Column widths (resizable) ───
const colWidths = reactive({ nachname: 130, vorname: 110, notiz: 160, aktivitaet: 220, kunden: 75 });
let resizeCol = null;
let resizeStartX = 0;
let resizeStartW = 0;
let resizeMoved = false;

function startResize(e, col) {
  resizeCol = col;
  resizeStartX = e.clientX;
  resizeStartW = colWidths[col];
  resizeMoved = false;
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}
function onResizeMove(e) {
  if (!resizeCol) return;
  resizeMoved = true;
  const diff = e.clientX - resizeStartX;
  colWidths[resizeCol] = Math.max(60, resizeStartW + diff);
}
function onResizeEnd() {
  if (resizeMoved) {
    // Swallow the click event that fires right after mouseup so sort isn't triggered
    document.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
  }
  resizeCol = null;
  resizeMoved = false;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

// ─── Day column width (resizable, all day cols simultaneously) ───
const dayColWidth = ref(48);
let dayResizeStartX = 0;
let dayResizeStartW = 0;
let dayResizeMoved = false;

function startResizeDay(e) {
  dayResizeStartX = e.clientX;
  dayResizeStartW = dayColWidth.value;
  dayResizeMoved = false;
  document.addEventListener('mousemove', onResizeDayMove);
  document.addEventListener('mouseup', onResizeDayEnd);
}
function onResizeDayMove(e) {
  dayResizeMoved = true;
  const diff = e.clientX - dayResizeStartX;
  dayColWidth.value = Math.max(36, dayResizeStartW + diff);
}
function onResizeDayEnd() {
  if (dayResizeMoved) {
    savePrefs();
    document.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
  }
  dayResizeMoved = false;
  document.removeEventListener('mousemove', onResizeDayMove);
  document.removeEventListener('mouseup', onResizeDayEnd);
}

function onResize() { isMobile.value = window.innerWidth <= 768; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const filters = reactive({
  standort: null,
  tage: 30,
  planungFilter: null,
  kundeFilter: null, // ObjectId string
});
const filterKunde = ref(null); // full kunde object for display
const kundeFilterRef = ref(null);
const kundeFilterFsRef = ref(null);

function clearKundeFilter() {
  filterKunde.value = null;
  filters.kundeFilter = null;
  kundeFilterRef.value?.clearSingle?.();
  kundeFilterFsRef.value?.clearSingle?.();
}

// ─── Qualifikation Filter ───
const qualFilter = ref([]);          // [{_id, qualificationKey, designation}]
const allQualifikationen = ref([]);  // full list from API
const qualSearchQuery = ref('');
const qualDropdownOpen = ref(false);
const qualDropdownStyle = ref({});
const qualInputRef = ref(null);
const qualInputFsRef = ref(null);
const qualFocusedPillIdx = ref(-1); // -1 = kein Pill fokussiert, Cursor im Input

function openQualDropdown(inputEl) {
  const el = inputEl?.$el ?? inputEl;
  if (el) {
    const rect = el.getBoundingClientRect();
    qualDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      minWidth: `${Math.max(rect.width, 320)}px`,
      zIndex: 9999,
    };
  }
  qualDropdownOpen.value = true;
}
const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.standort) count++;
  if (filters.planungFilter) count++;
  if (filters.kundeFilter) count++;
  if (qualFilter.value.length > 0) count++;
  return count;
});

async function fetchQualifikationen() {
  try {
    const { data } = await api.get('/api/import/qualifikationen');
    allQualifikationen.value = (data.data || []).sort((a, b) =>
      a.qualificationKey - b.qualificationKey
    );
  } catch (err) {
    console.error('Qualifikationen laden fehlgeschlagen:', err);
  }
}

const qualSuggestions = computed(() => {
  const selectedIds = new Set(qualFilter.value.map(q => String(q._id)));
  const q = qualSearchQuery.value.toLowerCase().trim();
  return allQualifikationen.value.filter(
    qual =>
      !selectedIds.has(String(qual._id)) &&
      (!q ||
        qual.designation.toLowerCase().includes(q) ||
        String(qual.qualificationKey).includes(q))
  );
});

function addQual(q) {
  qualFilter.value = [...qualFilter.value, q];
  qualSearchQuery.value = '';
  qualDropdownOpen.value = false;
  savePrefs();
}

function removeQual(q) {
  qualFilter.value = qualFilter.value.filter(x => String(x._id) !== String(q._id));
  savePrefs();
}

function clearQualFilter() {
  qualFilter.value = [];
  savePrefs();
}

function onQualBlur() {
  setTimeout(() => {
    qualDropdownOpen.value = false;
    qualFocusedPillIdx.value = -1;
  }, 150);
}

function onQualKeydown(e) {
  const pills = qualFilter.value;
  const focused = qualFocusedPillIdx.value;

  // Pill ist fokussiert
  if (focused >= 0) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      qualFocusedPillIdx.value = Math.max(0, focused - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (focused < pills.length - 1) {
        qualFocusedPillIdx.value = focused + 1;
      } else {
        // Zurück zum Input
        qualFocusedPillIdx.value = -1;
      }
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      removeQual(pills[focused]);
      // Fokus auf vorherige Pill oder -1
      qualFocusedPillIdx.value = Math.min(focused, pills.length - 2);
    } else if (e.key === 'Escape') {
      qualFocusedPillIdx.value = -1;
    } else if (e.key.length === 1) {
      // Normales Tippen → zurück zum Input
      qualFocusedPillIdx.value = -1;
    }
    return;
  }

  // Kein Pill fokussiert, Cursor im Input
  const atStart = e.target.selectionStart === 0 && e.target.selectionEnd === 0;
  if (e.key === 'ArrowLeft' && atStart && pills.length > 0) {
    e.preventDefault();
    qualFocusedPillIdx.value = pills.length - 1;
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && qualSearchQuery.value === '' && pills.length > 0) {
    removeQual(pills[pills.length - 1]);
  }
}

const statusOptions = [
  { value: 'available', label: 'Verfügbar', icon: 'fa-solid fa-check' },
  { value: 'partially', label: 'Eingeschränkt', icon: 'fa-solid fa-circle-half-stroke' },
  { value: 'blocked', label: 'Blocked', icon: 'fa-solid fa-xmark' },
  { value: 'angefragt_flip', label: 'Angefragt (Flip)', icon: null, anfragart: 'flip' },
];

const absenceOptions = [
  { value: 'urlaub', label: 'Urlaub', icon: 'fa-solid fa-umbrella-beach' },
  { value: 'krank', label: 'Krank', icon: 'fa-solid fa-briefcase-medical' },
];

const CELL_ICONS = {
  planned: 'fa-solid fa-clipboard-list',
  eingeplant: 'fa-solid fa-clipboard-list',
  available: 'fa-solid fa-check',
  partially: 'fa-solid fa-circle-half-stroke',
  blocked: 'fa-solid fa-xmark',
  urlaub: 'fa-solid fa-umbrella-beach',
  krank: 'fa-solid fa-briefcase-medical',
  angefragt_tel: 'fa-solid fa-phone',
};

// ─── Sort ───
const sortField = ref('nachname');
const sortDir = ref('asc');

// ─── Chat Modal (Comment Thread) ───
const chatModal = reactive({
  open: false,
  ma: null,
  day: null,
  comments: [],
  newText: '',
  loading: false,
});

const isAdmin = computed(() => auth.user?.roles?.includes('ADMIN'));
const isKnechti = computed(() => ['ed@straightforward.email', 'it@straightforward.email'].includes(auth.user?.email?.toLowerCase()));
const showFsPanel = computed(() => isFullscreen.value && ui.panelType === 'kommentare' && !ui.hidden);
const fsFeedCollapsed = ref(false);
const hiddenCount = computed(() =>
  mitarbeiter.value.filter((m) => hiddenIds.value.has(String(m._id))).length
);

function toggleHiddenView() {
  showHidden.value = !showHidden.value;
  expandedCardId.value = null;
  clearSelection();
}

watch(hiddenCount, (count) => {
  if (count === 0 && showHidden.value) showHidden.value = false;
});

const standortLabel = computed(() => {
  if (filters.standort === '1') return 'Berlin';
  if (filters.standort === '2') return 'Hamburg';
  if (filters.standort === '3') return 'Köln';
  return 'Standort';
});

const planungLabel = computed(() => {
  if (filters.planungFilter === 'eingeplant') return 'Eingeplante';
  if (filters.planungFilter === 'ungeplant') return 'Ungeplante';
  return 'Planung';
});

// ─── Name Context Menu ───
const nameMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  ma: null,
});
const copiedPhone = ref(false);
let _copiedPhoneTimer = null;

function openNameMenu(event, ma) {
  const menuW = 240;
  const menuH = 260;
  const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
  const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;
  nameMenu.x = x;
  nameMenu.y = y;
  nameMenu.ma = ma;
  nameMenu.open = true;
}

function closeNameMenu() {
  nameMenu.open = false;
  nameMenu.ma = null;
  copiedPhone.value = false;
  if (_copiedPhoneTimer) {
    clearTimeout(_copiedPhoneTimer);
    _copiedPhoneTimer = null;
  }
}

async function copyPhoneFromNameMenu() {
  const telefon = (nameMenu.ma?.telefon || '').trim();
  if (!telefon) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(telefon);
    } else {
      const ta = document.createElement('textarea');
      ta.value = telefon;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    copiedPhone.value = true;
    if (_copiedPhoneTimer) clearTimeout(_copiedPhoneTimer);
    _copiedPhoneTimer = setTimeout(() => {
      copiedPhone.value = false;
      _copiedPhoneTimer = null;
      closeNameMenu();
    }, 900);
  } catch (err) {
    console.error('Telefonnummer konnte nicht kopiert werden:', err);
  }
}

// ─── Employee Card Modal ───
const cardModal = reactive({ open: false, mitarbeiterId: null });

function openCardModal(maId) {
  cardModal.mitarbeiterId = String(maId);
  cardModal.open = true;
}

// ─── Kundenwunsch Modal ───
const kwModal = reactive({ open: false, maId: null, typ: 'positiv' });
const kwSearchRef = ref(null);

function openKwModal(maId) {
  kwModal.maId = maId;
  kwModal.typ = 'positiv';
  kwModal.open = true;
  nextTick(() => kwSearchRef.value?.focus());
}

function closeKwModal() {
  kwModal.open = false;
  kwModal.maId = null;
}

async function addKundenwunsch(kunde) {
  if (!kunde || !kwModal.maId) return;
  try {
    const { data } = await api.post(`/api/personal/${kwModal.maId}/kundenwuensche`, {
      kunde: kunde._id,
      typ: kwModal.typ,
    });
    // Update local mitarbeiter data
    const list = mitarbeiter.value;
    const ma = list.find(m => m._id === kwModal.maId);
    if (ma) {
      ma.kundenwuensche = data;
      mitarbeiter.value = [...list];
    }
    closeKwModal();
  } catch (err) {
    console.error('Kundenwunsch hinzufügen fehlgeschlagen:', err);
  }
}

async function removeKundenwunsch(maId, wunschId) {
  try {
    const { data } = await api.delete(`/api/personal/${maId}/kundenwuensche/${wunschId}`);
    const list = mitarbeiter.value;
    const ma = list.find(m => m._id === maId);
    if (ma) {
      ma.kundenwuensche = data;
      mitarbeiter.value = [...list];
    }
  } catch (err) {
    console.error('Kundenwunsch entfernen fehlgeschlagen:', err);
  }
}

function openKarte() {
  const id = nameMenu.ma?._id;
  closeNameMenu();
  if (id) openCardModal(id);
}

function openKwFromNameMenu() {
  const id = nameMenu.ma?._id;
  closeNameMenu();
  if (id) openKwModal(id);
}

function focusNotizFromNameMenu() {
  const id = nameMenu.ma?._id;
  closeNameMenu();
  if (!id) return;
  expandedCardId.value = String(id);
  nextTick(() => {
    document.querySelector(`[data-mobile-notiz-ma="${id}"]`)?.focus();
  });
}

function closeCardModal() {
  cardModal.open = false;
  cardModal.mitarbeiterId = null;
}

// ─── Cell Context Menu ───
const ctxMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  ma: null,
  day: null,
  entries: [],
  isMulti: false,
});

// ─── Multi-cell Selection (cumulative Set of "maId_iso" keys) ───
const selectedCells = ref(new Set());
let dragMode = null; // 'add' | 'remove'
let dragCovered = null; // cells already toggled in current drag

function isCellSelected(maId, iso) {
  return selectedCells.value.has(`${maId}_${iso}`);
}

function clearSelection() {
  selectedCells.value = new Set();
  dragMode = null;
  dragCovered = null;
}

// Adds n days to an ISO date string (YYYY-MM-DD) — pure UTC to avoid timezone drift
function isoAddDays(iso, n) {
  const [y, m, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day + n));
  return d.toISOString().slice(0, 10);
}

// Returns array of { maId, ranges: [{ from, to }] } grouped by MA
function getGroupedSelection() {
  if (selectedCells.value.size === 0) return [];
  const byMa = new Map();
  for (const key of selectedCells.value) {
    const idx = key.indexOf('_');
    const maId = key.slice(0, idx);
    const iso = key.slice(idx + 1);
    if (!byMa.has(maId)) byMa.set(maId, []);
    byMa.get(maId).push(iso);
  }
  const result = [];
  for (const [maId, isos] of byMa) {
    isos.sort();
    const ranges = [];
    let rangeStart = isos[0];
    let rangeEnd = isos[0];
    for (let i = 1; i < isos.length; i++) {
      const prev = new Date(rangeEnd + 'T00:00:00');
      const curr = new Date(isos[i] + 'T00:00:00');
      if ((curr - prev) / 86400000 === 1) {
        rangeEnd = isos[i];
      } else {
        ranges.push({ from: rangeStart, to: rangeEnd });
        rangeStart = isos[i];
        rangeEnd = isos[i];
      }
    }
    ranges.push({ from: rangeStart, to: rangeEnd });
    result.push({ maId, ranges });
  }
  return result;
}

function onDocMouseUp() {
  dragMode = null;
  dragCovered = null;
}

function onKeyDown(e) {
  if (e.key === 'Escape') { clearSelection(); return; }
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (e.key === 'v' || e.key === 'V') {
    toggleFullscreen();
  } else if (e.key === 'c' || e.key === 'C') {
    if (isFullscreen.value) {
      // In fullscreen: C collapses/expands the inline feed panel
      if (showFsPanel.value) {
        fsFeedCollapsed.value = !fsFeedCollapsed.value;
      } else {
        ui.open('kommentare');
        fsFeedCollapsed.value = false;
      }
    } else {
      ui.toggle('kommentare');
    }
  } else if (e.key === 'h' || e.key === 'H') {
    showHelp.value = !showHelp.value;
  } else if ((e.key === 's' || e.key === 'S') && isFullscreen.value) {
    e.preventDefault();
    if (searchInputFs.value) { searchInputFs.value.focus(); searchInputFs.value.select(); }
  } else if (e.key === '-') {
    tableZoom.value = Math.max(60, tableZoom.value - 10);
  } else if (e.key === '+') {
    tableZoom.value = Math.min(150, tableZoom.value + 10);
  } else if (e.key >= '1' && e.key <= '9') {
    const chip = kwChips.value.find(c => c.shortcut === e.key);
    if (chip) toggleKw(chip);
  }
}

onMounted(() => {
  document.addEventListener('mouseup', onDocMouseUp);
  document.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  document.removeEventListener('mouseup', onDocMouseUp);
  document.removeEventListener('keydown', onKeyDown);
  if (_leftRowObserver) { _leftRowObserver.disconnect(); _leftRowObserver = null; }
  if (_copiedPhoneTimer) {
    clearTimeout(_copiedPhoneTimer);
    _copiedPhoneTimer = null;
  }
});

// ─── Watch route query for in-page deep-link navigation (e.g. from KommentarFeed) ───
watch(
  () => route.query,
  async (q) => {
    if (!q.datum && !q.maId) return;
    let needsFetch = false;
    if (q.standort && q.standort !== filters.standort) {
      filters.standort = q.standort;
      needsFetch = true;
    }
    if (q.resetPlanung) filters.planungFilter = null;
    if (q.showHidden) showHidden.value = hiddenIds.value.size > 0 && (!q.maId || hiddenIds.value.has(String(q.maId)));
    if (q.datum) {
      const today = new Date();
      const target = new Date(q.datum);
      const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
      if (diffDays > filters.tage) {
        const options = [7, 14, 30];
        filters.tage = options.find((o) => o > diffDays) ?? 30;
        needsFetch = true;
      }
      selectedKw.value = getISOWeek(target);
    }
    if (needsFetch) await fetchDispo();
    if (q.maId) scrollToMa(q.maId);
  }
);

// ─── KW helpers ───
function getISOWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return {
    kw: Math.ceil(((date - yearStart) / 86400000 + 1) / 7),
    year: date.getFullYear(),
  };
}

const selectedKw = ref(null); // { kw, year } | null
const kwChipOffset = ref(0); // weeks to shift the KW chip window forward

function toggleKw(chip) {
  if (selectedKw.value?.kw === chip.kw && selectedKw.value?.year === chip.year) {
    selectedKw.value = null;
  } else {
    selectedKw.value = { kw: chip.kw, year: chip.year };
  }
}

// ─── Effective day range: extend beyond filters.tage when a far-out KW is selected or offset is used ───
const effectiveTage = computed(() => {
  // Ensure we always cover the visible KW window incl. offset
  const windowEnd = kwChipOffset.value > 0
    ? kwChipOffset.value * 7 + Math.max(filters.tage, 30) + 7
    : filters.tage;
  const base = Math.max(filters.tage, windowEnd);
  if (!selectedKw.value) return base;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const searchLimit = Math.max(windowEnd + 14, 60);
  for (let i = searchLimit; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const { kw, year } = getISOWeek(d);
    if (kw === selectedKw.value.kw && year === selectedKw.value.year) {
      return Math.max(base, i + 1);
    }
  }
  return base;
});

let _prevEffective = null;
watch(effectiveTage, (val, old) => {
  // Refetch when selected KW requires more data than we have
  if (val > (old ?? filters.tage)) fetchDispo();
});

// ─── Computed ───
const days = computed(() => {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toIso(today);

  for (let i = 0; i < effectiveTage.value; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    result.push({
      date: new Date(d),
      iso: toIso(d),
      weekday: d.toLocaleDateString('de-DE', { weekday: 'short' }),
      label: `${d.getDate()}.${d.getMonth() + 1}.`,
      isToday: toIso(d) === todayIso,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return result;
});

const kwChips = computed(() => {
  const seen = new Set();
  const chips = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { kw: currentKw, year: currentYear } = getISOWeek(today);
  const kwDays = Math.max(filters.tage, 30);
  const startDay = kwChipOffset.value * 7;
  for (let i = startDay; i < startDay + kwDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const { kw, year } = getISOWeek(d);
    const key = `${year}-${kw}`;
    if (!seen.has(key)) {
      seen.add(key);
      chips.push({ kw, year, isCurrent: kw === currentKw && year === currentYear });
    }
  }
  // Assign shortcut numbers: current week = 1, subsequent weeks = 2, 3, …
  const currentIdx = chips.findIndex(c => c.isCurrent);
  const base = currentIdx >= 0 ? currentIdx : 0;
  chips.forEach((c, i) => {
    const n = i - base + 1;
    c.shortcut = n >= 1 && n <= 9 ? String(n) : null;
  });
  return chips;
});

const visibleDays = computed(() => {
  if (!selectedKw.value) return days.value;
  return days.value.filter(d => {
    const { kw, year } = getISOWeek(d.date);
    return kw === selectedKw.value.kw && year === selectedKw.value.year;
  });
});

const filteredMitarbeiter = computed(() => {
  let list = mitarbeiter.value;
  list = list.filter((m) => showHidden.value
    ? hiddenIds.value.has(String(m._id))
    : !hiddenIds.value.has(String(m._id))
  );
  // Auto-filter: hide employees whose Austritt is before the first visible column date.
  // Skip when showHidden is active — ausgeblendete MAs should always be fully visible.
  const firstColIso = visibleDays.value[0]?.iso ?? days.value[0]?.iso;
  if (firstColIso && !showHidden.value) {
    list = list.filter((m) => {
      if (!m.austrittsdatum) return true;
      return toIso(new Date(m.austrittsdatum)) >= firstColIso;
    });
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (m) =>
        m.vorname.toLowerCase().includes(q) ||
        m.nachname.toLowerCase().includes(q)
    );
  }
  if (bereichFilter.value) {
    const f = bereichFilter.value;
    list = list.filter((m) => {
      const b = getMaBereich(m);
      return b === f || b === 'S+L';
    });
  }
  if (filters.planungFilter) {
    const todayIso = toIso((() => { const d = new Date(); d.setHours(0,0,0,0); return d; })());
    const eingeplantSet = new Set(
      eintraege.value
        .filter((e) => (e.typ === 'planned' || e.verfuegbarkeit === 'eingeplant') && (e.datumBis || e.datumVon) >= todayIso)
        .map((e) => String(typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter))
    );
    if (filters.planungFilter === 'eingeplant') {
      list = list.filter((m) => eingeplantSet.has(String(m._id)));
    } else if (filters.planungFilter === 'ungeplant') {
      list = list.filter((m) => !eingeplantSet.has(String(m._id)));
    }
  }
  if (filters.kundeFilter) {
    list = list.filter((m) =>
      (m.kundenwuensche || []).some(
        (w) => w.typ === 'positiv' && (w.kunde?._id || w.kunde) === filters.kundeFilter
      )
    );
  }
  if (qualFilter.value.length > 0) {
    const selectedQualIds = new Set(qualFilter.value.map(q => String(q._id)));
    list = list.filter((m) =>
      (m.qualifikationen || []).some(q => selectedQualIds.has(String(q._id || q)))
    );
  }
  return list.sort((a, b) => {
    const aStarred = starredIds.value.has(a._id) ? 0 : 1;
    const bStarred = starredIds.value.has(b._id) ? 0 : 1;
    if (aStarred !== bStarred) return aStarred - bStarred;
    const field = sortField.value;
    if (field === 'aktivitaet') {
      const aLatestTs = getLatestAktivitaetsLog(a._id)?.createdAt ? new Date(getLatestAktivitaetsLog(a._id).createdAt).getTime() : 0;
      const bLatestTs = getLatestAktivitaetsLog(b._id)?.createdAt ? new Date(getLatestAktivitaetsLog(b._id).createdAt).getTime() : 0;
      if (aLatestTs !== bLatestTs) {
        return sortDir.value === 'asc' ? aLatestTs - bLatestTs : bLatestTs - aLatestTs;
      }
      return (a.nachname || '').localeCompare(b.nachname || '') || (a.vorname || '').localeCompare(b.vorname || '');
    }
    const dir = sortDir.value === 'asc' ? 1 : -1;
    return dir * (a[field] || '').localeCompare(b[field] || '');
  });
});

watch(filteredMitarbeiter, () => {
  _rebuildRowObserver();
}, { flush: 'post' });

// ─── Index for fast lookup: mitarbeiterId+iso → entries ───
const eintragMap = computed(() => {
  const map = {};
  for (const e of eintraege.value) {
    const von = new Date(e.datumVon);
    const bis = new Date(e.datumBis || e.datumVon);
    von.setHours(0, 0, 0, 0);
    bis.setHours(0, 0, 0, 0);
    const maId = typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter;
    for (let d = new Date(von); d <= bis; d.setDate(d.getDate() + 1)) {
      const key = `${maId}_${toIso(d)}`;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
  }
  return map;
});

const selectionMaCount = computed(() => {
  const maIds = new Set();
  for (const key of selectedCells.value) maIds.add(key.slice(0, key.indexOf('_')));
  return maIds.size;
});

const selectionDateRange = computed(() => {
  if (selectedCells.value.size === 0) return null;
  const isos = [...selectedCells.value].map((k) => k.slice(k.indexOf('_') + 1)).sort();
  return { from: isos[0], to: isos[isos.length - 1] };
});

// ─── Helpers ───
function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isTeamleiter(ma) {
  return ma.qualifikationen?.some(
    (q) => parseInt(String(q.qualificationKey).trim(), 10) === 50055
  );
}

function getMaBereich(ma) {
  const keys = (ma.berufe || []).map(b => b.jobKey ?? b);
  const hasS = keys.includes(10001);
  const hasL = keys.includes(10002);
  if (hasS && hasL) return 'S+L';
  if (hasS) return 'S';
  if (hasL) return 'L';
  return null;
}

function getEntriesForCell(maId, iso) {
  return eintragMap.value[`${maId}_${iso}`] || [];
}

// Returns EXIT label string (e.g. "EXIT: 31.07.") if austrittsdatum is in the current calendar month
function getExitLabel(ma) {
  if (!ma.austrittsdatum) return null;
  const exit = new Date(ma.austrittsdatum);
  const now = new Date();
  if (exit.getFullYear() === now.getFullYear() && exit.getMonth() === now.getMonth()) {
    const day = String(exit.getDate()).padStart(2, '0');
    const month = String(exit.getMonth() + 1).padStart(2, '0');
    return `EXIT: ${day}.${month}.`;
  }
  return null;
}

// Cached iso list for fast index lookup
const dayIsos = computed(() => visibleDays.value.map((d) => d.iso));
const dayIsoIndex = computed(() => {
  const map = {};
  dayIsos.value.forEach((iso, i) => { map[iso] = i; });
  return map;
});

// Pre-compute cellClass results into a map for O(1) template lookups
const cellDataMap = computed(() => {
  const map = {};
  const isos = dayIsos.value;
  const maList = filteredMitarbeiter.value;
  for (const ma of maList) {
    for (const iso of isos) {
      const entries = getEntriesForCell(ma._id, iso);
      if (!entries.length) continue;
      const key = `${ma._id}_${iso}`;
      let cls = '';
      let icon = null;
      let kuerzel = null;
      if (entries.some((e) => e.typ === 'planned')) {
        cls = 'cell-planned';
        icon = CELL_ICONS.planned;
        const planned = entries.find((e) => e.typ === 'planned');
        kuerzel = planned.kuerzel || (planned.bezeichnung ? planned.bezeichnung.substring(0, 6) : null);
      } else if (entries.some((e) => e.verfuegbarkeit === 'eingeplant')) {
        cls = 'cell-planned cell-eingeplant-manuell';
        icon = CELL_ICONS.eingeplant;
        const ep = entries.find((e) => e.verfuegbarkeit === 'eingeplant');
        kuerzel = ep.kundeKuerzel || null;
      } else if (entries.some((e) => e.verfuegbarkeit === 'blocked')) {
        cls = 'cell-blocked';
        icon = CELL_ICONS.blocked;
        const be = entries.find((e) => e.verfuegbarkeit === 'blocked');
        const bt = (be?.zeitVon || be?.zeitBis) ? formatTimeShort(be.zeitVon, be.zeitBis) : null;
        if (cls) map[key] = { cls, icon, kuerzel, time: bt };
      } else if (entries.some((e) => e.typ === 'abwesenheit')) {
        cls = 'cell-blocked';
        const a = entries.find((e) => e.typ === 'abwesenheit');
        icon = CELL_ICONS[a.abwesenheitsKategorie] || CELL_ICONS.sonstiges;
      } else if (entries.some((e) => e.verfuegbarkeit === 'partially')) {
        cls = 'cell-partially';
        icon = CELL_ICONS.partially;
        const pe = entries.find((e) => e.verfuegbarkeit === 'partially');
        const pt = (pe?.zeitVon || pe?.zeitBis) ? formatTimeShort(pe.zeitVon, pe.zeitBis) : null;
        if (cls) map[key] = { cls, icon, kuerzel, time: pt };
      } else if (entries.some((e) => e.verfuegbarkeit === 'angefragt_tel')) {
        cls = 'cell-angefragt';
        icon = CELL_ICONS.angefragt_tel;
        map[key] = { cls, icon, kuerzel, anfragart: 'tel' };
      } else if (entries.some((e) => e.verfuegbarkeit === 'angefragt_flip')) {
        cls = 'cell-angefragt';
        icon = null;
        map[key] = { cls, icon, kuerzel, anfragart: 'flip' };
      } else if (entries.some((e) => e.verfuegbarkeit === 'available')) {
        cls = 'cell-available';
        icon = CELL_ICONS.available;
      }
      if (cls && !map[key]) map[key] = { cls, icon, kuerzel };
    }
  }
  return map;
});

// Fast O(1) lookups using pre-computed cellDataMap
function cellClass(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.cls || '';
}

function cellKuerzel(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.kuerzel || null;
}

function cellIcon(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.icon || null;
}

function cellTime(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.time || null;
}

function cellAnfragart(maId, iso) {
  return cellDataMap.value[`${maId}_${iso}`]?.anfragart || null;
}

function formatEntryTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' um ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeShort(zeitVon, zeitBis) {
  function fmt(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':');
    return m === '00' ? h : `${h}:${m}`;
  }
  const a = fmt(zeitVon);
  const b = fmt(zeitBis);
  if (a && b) return `${a}–${b}`;
  if (a) return `ab ${a}`;
  if (b) return `bis ${b}`;
  return null;
}

function getCellTooltip(maId, iso) {
  const entries = getEntriesForCell(maId, iso);
  if (!entries.length) return null;
  return entries
    .map((e) => {
      let line = '';
      if (e.typ === 'planned') {
        line = `Einsatz: ${e.bezeichnung || 'Auftrag ' + e.auftragNr}${e.uhrzeitVon ? ' (' + e.uhrzeitVon + '–' + e.uhrzeitBis + ')' : ''}`;
      } else if (e.typ === 'verfuegbarkeit') {
        line = entryLabel(e);
      } else if (e.typ === 'abwesenheit') {
        line = entryLabel(e);
      } else if (e.typ === 'notiz' || e.typ === 'hinweis') {
        line = e.text;
      }
      if (line && e.createdAt) {
        line += ` · ${formatEntryTs(e.createdAt)}`;
      }
      return line;
    })
    .filter(Boolean)
    .join('\n');
}

function getNotizen(maId) {
  return eintraege.value.filter(
    (e) => {
      const id = typeof e.mitarbeiter === 'object' ? e.mitarbeiter._id || e.mitarbeiter : e.mitarbeiter;
      return id === maId && (e.typ === 'notiz' || e.typ === 'hinweis');
    }
  );
}

function getNotizPreview(maId) {
  const notes = getNotizen(maId);
  return notes.map((n) => n.text).join(' | ').substring(0, 100);
}

function getCellNote(maId, iso) {
  return getEntriesForCell(maId, iso).find((e) => e.typ === 'notiz') || null;
}

// ─── Comment index: mitarbeiterId_iso → comments (O(1) lookup) ───
function getCellComments(maId, iso) {
  return comments.getCellComments(maId, iso);
}

function getCellUnreadCount(maId, iso) {
  if (!maId || !iso) return 0;
  return comments.cellUnreadCount(maId, iso);
}

function isOwnComment(comment) {
  const userId = auth.user?._id;
  return !!userId && String(comment.authorId) === String(userId);
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) +
    ' ' +
    dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  );
}

function getRunNote(maId, iso) {
  const cls = cellClass(maId, iso);
  if (!cls) return getCellNote(maId, iso);
  const isos = dayIsos.value;
  const idx = dayIsoIndex.value[iso];
  if (idx === undefined) return getCellNote(maId, iso);
  let start = idx;
  while (start > 0 && cellClass(maId, isos[start - 1]) === cls) start--;
  let end = idx;
  while (end < isos.length - 1 && cellClass(maId, isos[end + 1]) === cls) end++;
  for (let i = start; i <= end; i++) {
    const note = getCellNote(maId, isos[i]);
    if (note) return note;
  }
  return null;
}

function entryIcon(entry) {
  if (entry.typ === 'planned' || entry._source === 'einsatz') return CELL_ICONS.planned;
  if (entry.typ === 'verfuegbarkeit') return CELL_ICONS[entry.verfuegbarkeit];
  if (entry.typ === 'abwesenheit') return CELL_ICONS[entry.abwesenheitsKategorie] || CELL_ICONS.sonstiges;
  return null;
}

function entryLabel(entry) {
  if (entry.typ === 'planned' || entry._source === 'einsatz') return `Einsatz: ${entry.bezeichnung || entry.auftragNr}`;
  if (entry.typ === 'verfuegbarkeit') {
    if (entry.verfuegbarkeit === 'eingeplant') return `Eingeplant ${entry.kundeKuerzel ? ': ' + entry.kundeKuerzel : ''}`;
    if (entry.verfuegbarkeit === 'angefragt_tel') return 'Angefragt (Tel)';
    if (entry.verfuegbarkeit === 'angefragt_flip') return 'Angefragt (Flip)';
    const l = { available: 'Verfügbar', partially: 'Eingeschränkt', blocked: 'Blocked' };
    let label = l[entry.verfuegbarkeit];
    if (entry.verfuegbarkeit === 'partially' && (entry.zeitVon || entry.zeitBis)) {
      const von = entry.zeitVon || '';
      const bis = entry.zeitBis || '';
      if (von && bis) label += ` (${von}–${bis} Uhr)`;
      else if (von) label += ` (ab ${von} Uhr)`;
      else if (bis) label += ` (bis ${bis} Uhr)`;
    }
    return label;
  }
  if (entry.typ === 'abwesenheit') {
    const l = { urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', ueberstunden: 'Überstunden', sonstiges: 'Sonstiges' };
    return l[entry.abwesenheitsKategorie] || 'Abwesend';
  }
  return entry.text || entry.typ;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('de-DE');
}

function formatIsoDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDir.value = field === 'aktivitaet' ? 'desc' : 'asc';
  }
}

function scrollToHelpSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Prefs (Starred + Filters) ───
let _savedPrefs = null;

async function loadPrefs() {
  try {
    const { data } = await api.get('/api/users/me');
    _savedPrefs = data.dispoPrefs || {};
    starredIds.value = new Set(_savedPrefs.starredMitarbeiter || []);
    hiddenIds.value = new Set(_savedPrefs.hiddenMitarbeiter || []);
    // Restore saved filters
    if (_savedPrefs.standort !== undefined) filters.standort = _savedPrefs.standort;
    if (_savedPrefs.tage !== undefined) filters.tage = _savedPrefs.tage;
    if (_savedPrefs.planungFilter !== undefined) filters.planungFilter = _savedPrefs.planungFilter;
    if (_savedPrefs.bereichFilter !== undefined) bereichFilter.value = _savedPrefs.bereichFilter;
    if (_savedPrefs.tableZoom !== undefined) tableZoom.value = _savedPrefs.tableZoom;
    if (_savedPrefs.dayColWidth !== undefined) dayColWidth.value = _savedPrefs.dayColWidth;
    // qualFilter is restored after fetchQualifikationen() — see onMounted
  } catch (err) {
    console.error('Prefs laden fehlgeschlagen:', err);
  }
}

async function savePrefs() {
  try {
    const prefs = {
      ...(_savedPrefs || {}),
      starredMitarbeiter: [...starredIds.value],
      hiddenMitarbeiter: [...hiddenIds.value],
      standort: filters.standort,
      tage: filters.tage,
      planungFilter: filters.planungFilter,
      bereichFilter: bereichFilter.value,
      tableZoom: tableZoom.value,
      dayColWidth: dayColWidth.value,
      qualFilterIds: qualFilter.value.map(q => String(q._id)),
    };
    _savedPrefs = prefs;
    await api.put('/api/users/me/dispo-prefs', { prefs });
  } catch (err) {
    console.error('Prefs speichern fehlgeschlagen:', err);
  }
}

function toggleStar(maId) {
  const next = new Set(starredIds.value);
  if (next.has(maId)) next.delete(maId);
  else next.add(maId);
  starredIds.value = next;
  savePrefs();
}

function hideMA(maId) {
  const next = new Set(hiddenIds.value);
  next.add(String(maId));
  hiddenIds.value = next;
  closeNameMenu();
  savePrefs();
}

function unhideMA(maId) {
  const next = new Set(hiddenIds.value);
  next.delete(String(maId));
  hiddenIds.value = next;
  if (next.size === 0) showHidden.value = false;
  closeNameMenu();
  savePrefs();
}

// ─── API ───
async function fetchDispo() {
  loading.value = true;
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + effectiveTage.value);

    const params = new URLSearchParams({
      von: today.toISOString(),
      bis: endDate.toISOString(),
    });
    if (filters.standort) params.append('standort', filters.standort);

    const { data } = await api.get(`/api/dispo?${params.toString()}`);
    mitarbeiter.value = data.mitarbeiter || [];
    // Populate persisted left-pane metadata from loaded mitarbeiter
    for (const ma of data.mitarbeiter || []) {
      notizMap[ma._id] = ma.dispoNotiz || '';
      if (!(ma._id in aktivitaetsDraftMap)) aktivitaetsDraftMap[ma._id] = '';
    }
    eintraege.value = data.eintraege || [];
    // Clear DOM caches — cell/row elements may have been replaced by Vue re-render
    _clearDispoCache();
    // Inject virtual Zvoove comments (from EINSATZZEIT_TAEGLICH.INFO field) into the store.
    // These are display-only and survive subsequent comment re-fetches via zvooveItems.
    comments.zvooveItems = data.zvooveKommentare || [];
  } catch (err) {
    console.error('Dispo laden fehlgeschlagen:', err);
  } finally {
    loading.value = false;
  }
  // also refresh comments (dispo_day + chronik) for visible range
  fetchKommentare();
}

async function fetchKommentare() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + effectiveTage.value);
  const von = today.toISOString().slice(0, 10);
  const bis = endDate.toISOString().slice(0, 10);
  // fetch dispo day comments (date-bounded: today → bis)
  await comments.fetch({ scope: 'dispo_day', von, bis });
  // fetch chronik for all loaded MAs in a single batched request (no date bound —
  // chronik entries are user-typed activity notes with past createdAt timestamps)
  const maIds = mitarbeiter.value.map(ma => String(ma._id));
  await comments.fetchChronikBatch(maIds);
}

// ─── Filters ───
function setStandort(val) {
  filters.standort = filters.standort === val ? null : val;
  savePrefs();
  fetchDispo();
}

function setTage(val) {
  filters.tage = val;
  savePrefs();
  fetchDispo();
}

function setPlanung(val) {
  filters.planungFilter = filters.planungFilter === val ? null : val;
  savePrefs();
}

function setBereich(val) {
  bereichFilter.value = val;
  savePrefs();
}

function setDefaultStandort() {
  const loc = auth.user?.location || auth.user?.standort || '';
  const l = loc.toLowerCase();
  if (l.includes('berlin')) filters.standort = '1';
  else if (l.includes('hamburg')) filters.standort = '2';
  else if (l.includes('köln') || l.includes('koeln')) filters.standort = '3';
}

function resetFilters() {
  filters.standort = null;
  filters.tage = 30;
  filters.planungFilter = null;
  showHidden.value = false;
  clearKundeFilter();
  bereichFilter.value = null;
  qualFilter.value = [];
  searchQuery.value = '';
  setDefaultStandort();
  savePrefs();
  fetchDispo();
}

// ─── Notiz helpers ───
function getNotizValue(maId) {
  return notizMap[maId] || '';
}

function onNotizInput(maId, event) {
  const text = event.target.innerText.trim();
  notizMap[maId] = text;
  if (!text && event.target.innerText !== '') {
    // DOM still has residual "\n" — clear it so :empty::before placeholder shows
    event.target.innerText = '';
  }
  debounceSaveNotiz(maId, text);
}

function clearNotiz(maId) {
  notizMap[maId] = '';
  const el = document.querySelector(`[data-notiz-ma="${maId}"]`);
  if (el) el.innerText = '';
  debounceSaveNotiz(maId, '');
}

function debounceSaveNotiz(maId, text) {
  if (_notizTimers[maId]) clearTimeout(_notizTimers[maId]);
  _notizTimers[maId] = setTimeout(() => saveNotiz(maId, text), 600);
}

async function saveNotiz(maId, text) {
  try {
    await api.patch(`/api/dispo/notiz/${maId}`, { text });
  } catch (err) {
    console.error('Notiz speichern fehlgeschlagen:', err);
  }
}

function toggleNotizExpand(maId) {
  if (expandedNotiz.value === maId) {
    expandedNotiz.value = null;
    expandedNotizHeight.value = null;
  } else {
    expandedNotiz.value = maId;
    expandedNotizHeight.value = null;
    nextTick(() => {
      const leftRow = document.querySelector(`tr[data-left-row="${maId}"]`);
      if (leftRow) expandedNotizHeight.value = leftRow.offsetHeight;
    });
  }
}

function isNotizOverflowing(maId) {
  const el = document.querySelector(`[data-notiz-ma="${maId}"]`);
  if (!el) return false;
  return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
}

// ─── Aktivitätslog (Chronik) helpers — backed by unified comments store ───
function getAktivitaetsLog(maId) {
  return comments.chronikForMa(maId);
}

function getAktivitaetsLogDesc(maId) {
  const logs = getAktivitaetsLog(maId);
  return logs.length > 1 ? [...logs].reverse() : logs;
}

function getAktivitaetsLogGrouped(maId) {
  const logs = getAktivitaetsLog(maId);
  const groups = [];
  let currentDate = null;
  for (const entry of logs) {
    const d = new Date(entry.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
    if (dayKey !== currentDate) {
      groups.push({ dayKey, dayLabel, entries: [] });
      currentDate = dayKey;
    }
    groups[groups.length - 1].entries.push(entry);
  }
  return groups;
}

function getAktivitaetsLogPreviewGrouped(maId) {
  const logs = getAktivitaetsLog(maId);
  if (!logs.length) return [];
  const entry = logs[logs.length - 1];
  const d = new Date(entry.createdAt);
  const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const dayLabel = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
  return [{ dayKey, dayLabel, entries: [entry] }];
}

function getLatestAktivitaetsLog(maId) {
  const logs = getAktivitaetsLog(maId);
  return logs.length ? logs[logs.length - 1] : null;
}

function toggleAktivitaetsLogExpand(maId) {
  if (expandedAktivitaet.value !== maId) {
    // mark all chronik entries for this MA as read on expand
    comments.markReadForMa(maId);
  }
  expandedAktivitaet.value = expandedAktivitaet.value === maId ? null : maId;
}

async function addAktivitaetsLog(maId) {
  const text = (aktivitaetsDraftMap[maId] || '').trim();
  if (!text) return;

  try {
    await comments.post({
      scope: 'chronik',
      text,
      context: { mitarbeiter: maId },
    });
    aktivitaetsDraftMap[maId] = '';
    expandedAktivitaet.value = maId;
  } catch (err) {
    console.error('Chronik speichern fehlgeschlagen:', err);
  }
}

async function deleteAktivitaetsLog(maId, logId) {
  if (!logId) return;
  try {
    await comments.delete(logId);
  } catch (err) {
    console.error('Chronik löschen fehlgeschlagen:', err);
  }
}

// ─── Optimistic local update helpers ───
function localAddEntries(newEntries) {
  const existing = new Set(eintraege.value.map((e) => String(e._id)));
  const toAdd = newEntries.filter((e) => !existing.has(String(e._id)));
  if (toAdd.length) eintraege.value = [...eintraege.value, ...toAdd];
}

function localRemoveEntries(ids) {
  const remove = new Set(ids.map(String));
  eintraege.value = eintraege.value.filter((e) => !remove.has(String(e._id)));
}

// ─── Cell Actions ───
function onCellClick(ma, day) {
  // Mobile: open context menu at center of screen
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  ctxMenu.x = window.innerWidth / 2 - 100;
  ctxMenu.y = window.innerHeight / 2 - 150;
  ctxMenu.ma = ma;
  ctxMenu.day = day.iso;
  ctxMenu.entries = entries;
  ctxMenu.open = true;
}

function onCellRightClick(event, ma, day) {
  // Flip tooltip above cursor so it doesn't overlap the context menu below
  if (cellTooltipState.value.visible) {
    cellTooltipState.value = { ...cellTooltipState.value, flipped: true };
  }
  // If clicked cell is in selection → open multi-selection context menu
  if (selectedCells.value.size > 0 && selectedCells.value.has(`${ma._id}_${day.iso}`)) {
    const menuW = 220;
    const menuH = 350;
    const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
    const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;
    ctxMenu.x = x;
    ctxMenu.y = y;
    ctxMenu.ma = ma;
    ctxMenu.day = null;
    ctxMenu.entries = [];
    ctxMenu.isMulti = true;
    ctxMenu.open = true;
    return;
  }

  // Right-click outside selection → clear selection and open single-cell menu
  clearSelection();
  const entries = getEntriesForCell(ma._id, day.iso);

  const menuW = 220;
  const menuH = 320;
  const x = event.clientX + menuW > window.innerWidth ? event.clientX - menuW : event.clientX;
  const y = event.clientY + menuH > window.innerHeight ? event.clientY - menuH : event.clientY;

  ctxMenu.x = x;
  ctxMenu.y = y;
  ctxMenu.ma = ma;
  ctxMenu.day = day.iso;
  ctxMenu.entries = entries;
  ctxMenu.isMulti = false;
  ctxMenu.open = true;
}

function closeCtxMenu() {
  ctxMenu.open = false;
  ctxMenu.ma = null;
  ctxMenu.day = null;
  ctxMenu.entries = [];
  ctxMenu.isMulti = false;
  partiallyTime.open = false;
  partiallyTime.zeitVon = '';
  partiallyTime.zeitBis = '';
  blockedTime.open = false;
  blockedTime.zeitVon = '';
  blockedTime.zeitBis = '';
  eingeplantPicker.open = false;
}

function openEinsatz(entry) {
  closeCtxMenu();
  const focusDate = entry.datumVon
    ? new Date(entry.datumVon).toISOString().slice(0, 10)
    : ctxMenu.day || undefined;
  router.push({
    name: 'Auftraege',
    query: {
      auftragnr: String(entry.auftragNr),
      ...(focusDate ? { focusDate } : {}),
    },
  });
}

function onCellMouseDown(ma, day, event) {
  if (event.button !== 0) return;
  // Multi-select only with Ctrl/Cmd held – like OS file selection
  if (!event.ctrlKey && !event.metaKey) {
    clearSelection();
    return;
  }
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  const key = `${ma._id}_${day.iso}`;
  dragMode = selectedCells.value.has(key) ? 'remove' : 'add';
  dragCovered = new Set([key]);
  const next = new Set(selectedCells.value);
  if (dragMode === 'add') next.add(key);
  else next.delete(key);
  selectedCells.value = next;
}

// ─── Imperative Row Hover (avoids Vue reactivity overhead on every mouseenter) ───
let _hoveredRowEls = [];

function onRowMouseEnter(maId) {
  if (_hoveredRowEls.length) {
    for (const el of _hoveredRowEls) el.classList.remove('row-hovered');
    _hoveredRowEls = [];
  }
  const wrapper = tableWrapper.value;
  if (!wrapper) return;
  const left = wrapper.querySelector(`[data-left-row="${maId}"]`);
  const right = wrapper.querySelector(`[data-right-row="${maId}"]`);
  if (left)  { left.classList.add('row-hovered');  _hoveredRowEls.push(left); }
  if (right) { right.classList.add('row-hovered'); _hoveredRowEls.push(right); }
}

function onRowMouseLeave() {
  for (const el of _hoveredRowEls) el.classList.remove('row-hovered');
  _hoveredRowEls = [];
}

// ─── Cell DOM cache — avoids querySelectorAll on every cell mouseenter ───
// Keyed by maId (string) → Array<HTMLElement>. Cleared on data refresh.
let _cellCache = new Map();

function _getCachedCells(maId) {
  const key = String(maId);
  if (_cellCache.has(key)) return _cellCache.get(key);
  const cells = Array.from(tableWrapper.value?.querySelectorAll(`td[data-ma-id="${key}"]`) ?? []);
  _cellCache.set(key, cells);
  return cells;
}

function _clearDispoCache() {
  _cellCache = new Map();
  _hoveredRowEls = [];
}

// ─── Imperative Run Highlight ───
// Tracks highlighted elements so clearRunHighlight is O(k) not O(6000)
let _highlightedEls = [];

function applyRunHighlight(maId, iso) {
  // Clear previous highlights without scanning all 6000 cells
  for (const el of _highlightedEls) {
    el.classList.remove('run-start', 'run-middle', 'run-end', 'run-only');
  }
  _highlightedEls = [];

  const data = cellDataMap.value[`${maId}_${iso}`];
  if (!data?.cls) return;
  const cls = data.cls;
  const isos = dayIsos.value;
  const idx = dayIsoIndex.value[iso];
  if (idx === undefined) return;
  let start = idx;
  while (start > 0 && cellDataMap.value[`${maId}_${isos[start - 1]}`]?.cls === cls) start--;
  let end = idx;
  while (end < isos.length - 1 && cellDataMap.value[`${maId}_${isos[end + 1]}`]?.cls === cls) end++;

  // One querySelectorAll for the whole MA row; index matches visibleDays order
  const cells = _getCachedCells(maId);
  if (!cells?.length) return;
  for (let i = start; i <= end; i++) {
    const el = cells[i];
    if (!el) continue;
    let runCls;
    if (start === end) runCls = 'run-only';
    else if (i === start) runCls = 'run-start';
    else if (i === end) runCls = 'run-end';
    else runCls = 'run-middle';
    el.classList.add(runCls);
    _highlightedEls.push(el);
  }
}

function clearRunHighlight() {
  for (const el of _highlightedEls) {
    el.classList.remove('run-start', 'run-middle', 'run-end', 'run-only');
  }
  _highlightedEls = [];
}

function onCellMouseEnter(ma, day) {
  applyRunHighlight(ma._id, day.iso);
  if (_markReadTimer) { clearTimeout(_markReadTimer); _markReadTimer = null; }
  if (getCellUnreadCount(ma._id, day.iso) > 0) {
    _markReadTimer = setTimeout(() => { markCellCommentsRead(ma._id, day.iso); }, 1000);
  }
  if (!dragMode) return;
  const key = `${ma._id}_${day.iso}`;
  if (dragCovered && dragCovered.has(key)) return;
  const entries = getEntriesForCell(ma._id, day.iso);
  if (entries.length && entries.every((e) => e._source === 'einsatz')) return;
  if (dragCovered) dragCovered.add(key);
  const next = new Set(selectedCells.value);
  if (dragMode === 'add') next.add(key);
  else next.delete(key);
  selectedCells.value = next;
}

let _tooltipRafId = null;
function onCellMouseMove(ma, day, event) {
  if (ctxMenu.open) return;
  const x = event.clientX;
  const y = event.clientY;
  if (_tooltipRafId) return; // skip until next frame
  _tooltipRafId = requestAnimationFrame(() => {
    _tooltipRafId = null;
    if (ctxMenu.open) return;
    const cellComments = getCellComments(ma._id, day.iso);
    const text = cellComments.length ? null : getCellTooltip(ma._id, day.iso);
    cellTooltipState.value = {
      visible: !!(cellComments.length || text),
      text: text || '',
      comments: cellComments,
      x,
      y,
      flipped: false,
    };
  });
}

let _markReadTimer = null;

async function markCellCommentsRead(maId, iso) {
  const userId = auth.user?._id;
  if (!userId) return;
  const userIdStr = String(userId);
  const unread = getCellComments(maId, iso)
    .filter((c) => !c._isZvoove && String(c.authorId) !== userIdStr && !c.readBy?.map(String).includes(userIdStr))
    .map((c) => c._id);
  if (!unread.length) return;
  await comments.markRead(unread);
}

function onCellMouseLeave() {
  clearRunHighlight();
  cellTooltipState.value = { ...cellTooltipState.value, visible: false, flipped: false };
  if (_markReadTimer) { clearTimeout(_markReadTimer); _markReadTimer = null; }
}

function onBereichHeaderClick(event) {
  bereichMenuPos.value = { x: event.clientX, y: event.clientY + 8 };
  bereichMenuOpen.value = true;
}

async function setStatus(status, zeitVon = null, zeitBis = null) {
  const isMulti = ctxMenu.isMulti;
  const singleMaId = ctxMenu.ma?._id;
  const singleDay = ctxMenu.day;
  const grouped = isMulti ? getGroupedSelection() : null;
  // Collect existing non-einsatz entries to replace before creating new one
  const toDeleteIds = [];
  const splitFragments = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    const entriesToDelete = ctxMenu.entries.filter((e) => e._source !== 'einsatz');
    for (const e of entriesToDelete) {
      toDeleteIds.push(e._id);
      const von = String(e.datumVon).slice(0, 10);
      const bis = String(e.datumBis || e.datumVon).slice(0, 10);
      const maId = typeof e.mitarbeiter === 'object' ? String(e.mitarbeiter._id || e.mitarbeiter) : String(e.mitarbeiter);
      if (von < singleDay) splitFragments.push({ from: von, to: isoAddDays(singleDay, -1), entry: e, maId });
      if (bis > singleDay) splitFragments.push({ from: isoAddDays(singleDay, 1), to: bis, entry: e, maId });
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    if (toDeleteIds.length) {
      await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
      localRemoveEntries(toDeleteIds);
    }
    const created = [];
    if (isMulti) {
      for (const { maId, ranges } of grouped) {
        for (const { from, to } of ranges) {
          const { data } = await api.post('/api/dispo', {
            mitarbeiter: maId, datumVon: from, datumBis: to,
            typ: 'verfuegbarkeit', verfuegbarkeit: status,
            ...(zeitVon ? { zeitVon } : {}),
            ...(zeitBis ? { zeitBis } : {}),
          });
          created.push(data);
        }
      }
    } else {
      for (const { from, to, entry, maId } of splitFragments) {
        const { data } = await api.post('/api/dispo', {
          mitarbeiter: maId, datumVon: from, datumBis: to, typ: entry.typ,
          ...(entry.verfuegbarkeit ? { verfuegbarkeit: entry.verfuegbarkeit } : {}),
          ...(entry.abwesenheitsKategorie ? { abwesenheitsKategorie: entry.abwesenheitsKategorie } : {}),
          ...(entry.zeitVon ? { zeitVon: entry.zeitVon } : {}),
          ...(entry.zeitBis ? { zeitBis: entry.zeitBis } : {}),
        });
        created.push(data);
      }
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: singleMaId, datumVon: singleDay, datumBis: singleDay,
        typ: 'verfuegbarkeit', verfuegbarkeit: status,
        ...(zeitVon ? { zeitVon } : {}),
        ...(zeitBis ? { zeitBis } : {}),
      });
      created.push(data);
    }
    localAddEntries(created);
  } catch (err) {
    console.error('Status setzen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function setAbsence(kategorie) {
  const isMulti = ctxMenu.isMulti;
  const singleMaId = ctxMenu.ma?._id;
  const singleDay = ctxMenu.day;
  const grouped = isMulti ? getGroupedSelection() : null;
  // Collect existing non-einsatz entries to replace before creating new one
  const toDeleteIds = [];
  const splitFragments = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    const entriesToDelete = ctxMenu.entries.filter((e) => e._source !== 'einsatz');
    for (const e of entriesToDelete) {
      toDeleteIds.push(e._id);
      const von = String(e.datumVon).slice(0, 10);
      const bis = String(e.datumBis || e.datumVon).slice(0, 10);
      const maId = typeof e.mitarbeiter === 'object' ? String(e.mitarbeiter._id || e.mitarbeiter) : String(e.mitarbeiter);
      if (von < singleDay) splitFragments.push({ from: von, to: isoAddDays(singleDay, -1), entry: e, maId });
      if (bis > singleDay) splitFragments.push({ from: isoAddDays(singleDay, 1), to: bis, entry: e, maId });
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    if (toDeleteIds.length) {
      await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
      localRemoveEntries(toDeleteIds);
    }
    const created = [];
    if (isMulti) {
      for (const { maId, ranges } of grouped) {
        for (const { from, to } of ranges) {
          const { data } = await api.post('/api/dispo', {
            mitarbeiter: maId, datumVon: from, datumBis: to,
            typ: 'abwesenheit', abwesenheitsKategorie: kategorie,
          });
          created.push(data);
        }
      }
    } else {
      for (const { from, to, entry, maId } of splitFragments) {
        const { data } = await api.post('/api/dispo', {
          mitarbeiter: maId, datumVon: from, datumBis: to, typ: entry.typ,
          ...(entry.verfuegbarkeit ? { verfuegbarkeit: entry.verfuegbarkeit } : {}),
          ...(entry.abwesenheitsKategorie ? { abwesenheitsKategorie: entry.abwesenheitsKategorie } : {}),
          ...(entry.zeitVon ? { zeitVon: entry.zeitVon } : {}),
          ...(entry.zeitBis ? { zeitBis: entry.zeitBis } : {}),
        });
        created.push(data);
      }
      const { data } = await api.post('/api/dispo', {
        mitarbeiter: singleMaId, datumVon: singleDay, datumBis: singleDay,
        typ: 'abwesenheit', abwesenheitsKategorie: kategorie,
      });
      created.push(data);
    }
    localAddEntries(created);
  } catch (err) {
    console.error('Abwesenheit setzen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function clearStatus() {
  const isMulti = ctxMenu.isMulti;
  const singleDay = ctxMenu.day;
  // Collect IDs to delete before closing
  const toDeleteIds = [];
  const splitFragments = [];
  if (isMulti) {
    const seen = new Set();
    for (const key of selectedCells.value) {
      const idx = key.indexOf('_');
      const maId = key.slice(0, idx);
      const iso = key.slice(idx + 1);
      for (const e of getEntriesForCell(maId, iso)) {
        if (e._source !== 'einsatz' && !seen.has(String(e._id))) {
          seen.add(String(e._id));
          toDeleteIds.push(e._id);
        }
      }
    }
  } else {
    const entriesToDelete = ctxMenu.entries.filter((e) => e._source !== 'einsatz');
    for (const e of entriesToDelete) {
      toDeleteIds.push(e._id);
      const von = String(e.datumVon).slice(0, 10);
      const bis = String(e.datumBis || e.datumVon).slice(0, 10);
      const maId = typeof e.mitarbeiter === 'object' ? String(e.mitarbeiter._id || e.mitarbeiter) : String(e.mitarbeiter);
      if (von < singleDay) splitFragments.push({ from: von, to: isoAddDays(singleDay, -1), entry: e, maId });
      if (bis > singleDay) splitFragments.push({ from: isoAddDays(singleDay, 1), to: bis, entry: e, maId });
    }
  }
  clearSelection();
  closeCtxMenu();
  try {
    await Promise.all(toDeleteIds.map((id) => api.delete(`/api/dispo/${id}`)));
    localRemoveEntries(toDeleteIds);
    if (splitFragments.length) {
      const created = [];
      for (const { from, to, entry, maId } of splitFragments) {
        const { data } = await api.post('/api/dispo', {
          mitarbeiter: maId, datumVon: from, datumBis: to, typ: entry.typ,
          ...(entry.verfuegbarkeit ? { verfuegbarkeit: entry.verfuegbarkeit } : {}),
          ...(entry.abwesenheitsKategorie ? { abwesenheitsKategorie: entry.abwesenheitsKategorie } : {}),
          ...(entry.zeitVon ? { zeitVon: entry.zeitVon } : {}),
          ...(entry.zeitBis ? { zeitBis: entry.zeitBis } : {}),
        });
        created.push(data);
      }
      localAddEntries(created);
    }
  } catch (err) {
    console.error('Löschen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

async function deleteEntry(id) {
  ctxMenu.entries = ctxMenu.entries.filter((e) => e._id !== id);
  try {
    await api.delete(`/api/dispo/${id}`);
    localRemoveEntries([id]);
  } catch (err) {
    console.error('Eintrag löschen fehlgeschlagen:', err);
    await fetchDispo();
  }
}

// ─── Chat Modal Actions ───
async function openChatModal(ma, day) {
  closeCtxMenu();
  chatModal.ma = ma;
  chatModal.day = day.iso;
  chatModal.comments = getCellComments(ma._id, day.iso);
  chatModal.newText = '';
  chatModal.open = true;
  // mark all current comments in this cell as read
  const unread = chatModal.comments
    .filter((c) => !c.readBy?.map(String).includes(String(auth.user?._id)))
    .map((c) => c._id);
  if (unread.length) {
    await comments.markRead(unread);
    chatModal.comments = getCellComments(ma._id, day.iso);
  }
  // scroll thread to bottom
  nextTick(() => {
    if (chatThreadRef.value) chatThreadRef.value.scrollTop = chatThreadRef.value.scrollHeight;
  });
}

function closeChatModal() {
  chatModal.open = false;
  chatModal.ma = null;
  chatModal.day = null;
  chatModal.comments = [];
  chatModal.newText = '';
}

async function postComment() {
  const text = chatModal.newText.trim();
  if (!text || chatModal.loading) return;
  chatModal.loading = true;
  try {
    await comments.post({
      scope: 'dispo_day',
      text,
      context: { mitarbeiter: chatModal.ma._id, datum: chatModal.day },
    });
    chatModal.newText = '';
    chatModal.comments = getCellComments(chatModal.ma._id, chatModal.day);
    nextTick(() => {
      if (chatThreadRef.value) chatThreadRef.value.scrollTop = chatThreadRef.value.scrollHeight;
    });
  } catch (err) {
    console.error('Kommentar senden fehlgeschlagen:', err);
  } finally {
    chatModal.loading = false;
  }
}

async function deleteKommentar(id) {
  try {
    await comments.delete(id);
    chatModal.comments = getCellComments(chatModal.ma._id, chatModal.day);
  } catch (err) {
    console.error('Kommentar löschen fehlgeschlagen:', err);
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  fsFeedCollapsed.value = false;
  if (isFullscreen.value) {
    ui.open('kommentare');
  } else if (ui.panelType === 'kommentare') {
    ui.close();
  }
}

// ─── Scroll to today ───
function scrollToToday() {
  nextTick(() => {
    const wrapper = tableWrapper.value;
    if (!wrapper) return;
    const todayEl = wrapper.querySelector('.is-today');
    if (todayEl) {
      // Offset for sticky columns (~280px)
      const offset = todayEl.offsetLeft - 280;
      wrapper.scrollLeft = Math.max(0, offset);
    }
  });
}

function scrollToMa(maId) {
  if (!maId) return;
  const id = String(maId);
  nextTick(() => {
    const wrapper = tableWrapper.value;
    if (!wrapper) return;
    const row = wrapper.querySelector(`tr[data-left-row="${id}"]`);
    if (!row) return;
    // Use getBoundingClientRect for accurate position relative to the scroll container
    const wrapperRect = wrapper.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const headerEl = wrapper.querySelector('thead');
    const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
    // How far the row's top is from the wrapper's top, accounting for current scroll
    const rowOffsetInWrapper = rowRect.top - wrapperRect.top + wrapper.scrollTop;
    // Scroll so the row sits just below the sticky header
    const target = rowOffsetInWrapper - headerHeight;
    wrapper.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    highlightedMaId.value = id;
    setTimeout(() => { if (highlightedMaId.value === id) highlightedMaId.value = null; }, 2500);
  });
}

// ─── Lifecycle ───
onMounted(async () => {
  setDefaultStandort();
  await Promise.all([loadPrefs(), fetchQualifikationen()]);
  // Restore qual filter now that qualifications are loaded
  if (_savedPrefs?.qualFilterIds?.length) {
    qualFilter.value = allQualifikationen.value.filter(
      q => _savedPrefs.qualFilterIds.includes(String(q._id))
    );
  }

  // ── Apply deep-link query params from widget navigation ──
  const q = route.query;
  if (q.standort) filters.standort = q.standort;
  if (q.resetPlanung) filters.planungFilter = null;
  if (q.showHidden) showHidden.value = hiddenIds.value.size > 0 && (!q.maId || hiddenIds.value.has(String(q.maId)));
  if (q.datum) {
    const today = new Date();
    const target = new Date(q.datum);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays > filters.tage) {
const options = [7, 14, 30];
        filters.tage = options.find((o) => o > diffDays) ?? 30;
    }
    // Activate the KW filter for the target date
    selectedKw.value = getISOWeek(target);
  }

  await fetchDispo();
  _rebuildRowObserver();
  scrollToToday();
  if (q.maId) scrollToMa(q.maId);
});

// ─── Mobile UI (≤768px) ───────────────────────────────────────────────
const mobileFilterOpen = ref(false);
const expandedCardId = ref(null);
const mobileDayScrollLeft = ref(0);
const dayStripRefs = new Map(); // maId → HTMLElement
let _stripScrollSyncing = false;
let _stripScrollRaf = null;

function setDayStripRef(maId) {
  return (el) => {
    if (el) dayStripRefs.set(String(maId), el);
    else dayStripRefs.delete(String(maId));
  };
}

function onDayStripScroll(event) {
  if (_stripScrollSyncing) return;
  const sl = event.target.scrollLeft;
  if (_stripScrollRaf) return;
  _stripScrollRaf = requestAnimationFrame(() => {
    _stripScrollRaf = null;
    mobileDayScrollLeft.value = sl;
    _stripScrollSyncing = true;
    for (const el of dayStripRefs.values()) {
      if (el !== event.target && Math.abs(el.scrollLeft - sl) > 1) {
        el.scrollLeft = sl;
      }
    }
    _stripScrollSyncing = false;
  });
}

function scrollMobileToToday() {
  nextTick(() => {
    // Double rAF: first rAF waits for paint commit, second ensures layout is fully settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // When no KW is selected, today is always the first cell (days[] starts from today).
        // Skip DOM measurement entirely — just reset to 0.
        if (!selectedKw.value) {
          mobileDayScrollLeft.value = 0;
          for (const el of dayStripRefs.values()) el.scrollLeft = 0;
          return;
        }
        // KW selected: find today in the current subset
        const firstStrip = dayStripRefs.values().next().value;
        if (!firstStrip) return;
        const todayEl = firstStrip.querySelector('.m-day-cell.is-today');
        const target = todayEl ? Math.max(0, todayEl.offsetLeft - 20) : 0;
        mobileDayScrollLeft.value = target;
        for (const el of dayStripRefs.values()) el.scrollLeft = target;
      });
    });
  });
}

watch(isMobile, (val) => {
  if (val) {
    nextTick(scrollMobileToToday);
  } else {
    mobileFilterOpen.value = false;
    expandedCardId.value = null;
  }
});

watch(visibleDays, () => {
  // Call directly — scrollMobileToToday has its own nextTick + double-rAF
  if (isMobile.value) scrollMobileToToday();
});

function toggleCardExpand(maId) {
  expandedCardId.value = expandedCardId.value === maId ? null : maId;
}

function openMobileMaMenu(event, ma) {
  const rect = event.currentTarget.getBoundingClientRect();
  openNameMenu({ clientX: rect.right, clientY: rect.bottom + 6 }, ma);
}

// Tap a mobile day-cell → populate ctxMenu so existing setStatus / setAbsence /
// clearStatus / etc. work unchanged, then render the mobile action sheet.
function onMobileCellTap(ma, day) {
  const entries = getEntriesForCell(ma._id, day.iso);
  clearSelection();
  ctxMenu.x = 0;
  ctxMenu.y = 0;
  ctxMenu.ma = ma;
  ctxMenu.day = day.iso;
  ctxMenu.entries = entries;
  ctxMenu.isMulti = false;
  ctxMenu.open = true;
}

function onMobileCellLongPress(ma, day) {
  // Long-press opens the comments thread directly
  openChatModal(ma, { iso: day.iso });
}

// Touch long-press detection
let _lpTimer = null;
let _lpStartXY = null;
let _lpFired = false;
let _lpCancelled = false;

function onCellTouchStart(ma, day, event) {
  _lpFired = false;
  const t = event.touches?.[0];
  _lpStartXY = t ? { x: t.clientX, y: t.clientY } : null;
  if (_lpTimer) clearTimeout(_lpTimer);
  _lpTimer = setTimeout(() => {
    _lpFired = true;
    onMobileCellLongPress(ma, day);
  }, 450);
}

function onCellTouchMove(event) {
  if (!_lpStartXY) return;
  const t = event.touches?.[0];
  if (!t) return;
  const dx = Math.abs(t.clientX - _lpStartXY.x);
  const dy = Math.abs(t.clientY - _lpStartXY.y);
  if (dx > 8 || dy > 8) {
    if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
    _lpCancelled = true;
  }
}

function onCellTouchEnd(ma, day, event) {
  if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
  if (_lpFired) { _lpFired = false; return; }
  if (_lpCancelled) { _lpCancelled = false; return; }
  event?.preventDefault(); // prevent synthetic click from double-firing @click
  onMobileCellTap(ma, day);
}

// Long-press on MA name → open name menu (Karte / Telefon / Ausblenden)
let _nameLpTimer = null;
function onNameTouchStart(event, ma) {
  if (_nameLpTimer) clearTimeout(_nameLpTimer);
  const x = event.touches?.[0]?.clientX || 80;
  const y = event.touches?.[0]?.clientY || 80;
  _nameLpTimer = setTimeout(() => {
    openNameMenu({ clientX: x, clientY: y }, ma);
  }, 450);
}
function onNameTouchEnd() {
  if (_nameLpTimer) { clearTimeout(_nameLpTimer); _nameLpTimer = null; }
}

// selectedKw changes are already handled via watch(visibleDays) above
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.dispo-page {
  padding: 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &.fullscreen-mode {
    position: fixed;
    inset: 12px;
    z-index: 1000;
    padding: 0;
    gap: 0;
    background: var(--bg);
    overflow: hidden;
    border-radius: 14px;
    box-shadow:
      0 0 0 1.5px rgba(var(--primary-rgb, 253 126 20) / 0.30),
      0 0 60px rgba(var(--primary-rgb, 253 126 20) / 0.07),
      0 32px 100px rgba(0, 0, 0, 0.55);
  }
}

// ─── Fullscreen Toolbar ───
.fs-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  border-radius: 14px 14px 0 0;
  flex-shrink: 0;
  flex-wrap: nowrap;
  min-height: 46px;
  position: relative;
  z-index: 50;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

// Feed collapse toggle tab — sits centered on the bottom border of the toolbar
// over the feed column (right-aligned)
.fs-feed-toggle {
  position: absolute;
  bottom: -12px;
  right: calc(310px / 2 - 14px);
  width: 28px;
  height: 12px;
  background: var(--panel);
  border: none;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--muted);
  font-size: 9px;
  z-index: 51;
  transition: color 0.15s, background 0.15s;
  box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.12), -1px 0 0 var(--border), 1px 0 0 var(--border), 0 1px 0 var(--border);

  &:hover {
    color: var(--primary);
    background: var(--hover);
  }
}

.fs-toolbar-left {
  flex-shrink: 0;
}

.fs-toolbar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  flex-wrap: nowrap;
  min-width: 0;
}

.fs-toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  overflow: visible; /* must be visible so dropdown menus are not clipped */
}

.fs-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: auto;
}

.fs-search-box {
  position: relative;
  display: flex;
  align-items: center;

  .fs-search-icon {
    position: absolute;
    left: 8px;
    color: var(--muted);
    font-size: 11px;
    pointer-events: none;
  }

  input {
    padding: 5px 10px 5px 26px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 13px;
    width: 160px;
    transition: border-color 0.2s;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
}

.fs-reset-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 0.85rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
}

.fs-exit-btn {
  color: var(--primary);
  border-color: var(--primary);
}

// ─── Fullscreen Filter Toggle Button ───
.fs-filter-toggle {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s, border-color 0.15s;

  &:hover {
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
    border-color: var(--primary);
  }

  &--active {
    color: var(--primary);
    border-color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }
}

.fs-filter-count {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  background: var(--primary);
  color: var(--bg);
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

// ─── Fullscreen Filters Panel (Expanded Overlay) ───
.fs-filters-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  border-radius: 0 0 12px 12px;
  padding: 12px;
  z-index: 60;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  margin-top: -1px;
}

.fs-toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  overflow: visible; /* must be visible so dropdown menus are not clipped */
}

// ─── Transition for fs-filter-expand ───
.fs-filter-expand-enter-active,
.fs-filter-expand-leave-active {
  transition: all 0.2s ease;
}

.fs-filter-expand-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.fs-filter-expand-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.knechti-title {
  width: 100%;
  text-align: center;
  font-size: 4rem;
  font-weight: 900;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  margin: 0.5rem 0 1rem;
  background: linear-gradient(
    90deg,
    var(--primary) 0%,
    #ffe066 25%,
    var(--primary) 50%,
    #ffe066 75%,
    var(--primary) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: knechti-shimmer 3s linear infinite, knechti-entrance 1s cubic-bezier(0.22, 1, 0.36, 1) both;
  text-shadow: none;
  filter: drop-shadow(0 0 20px color-mix(in srgb, var(--primary) 50%, transparent))
          drop-shadow(0 0 60px color-mix(in srgb, var(--primary) 25%, transparent));
  position: relative;

  &::before {
    content: 'KNECHTI-LISTE';
    position: absolute;
    inset: 0;
    text-align: center;
    -webkit-text-fill-color: transparent;
    background: inherit;
    background-size: inherit;
    -webkit-background-clip: text;
    background-clip: text;
    filter: blur(12px) brightness(1.5);
    opacity: 0.5;
    animation: knechti-pulse 2s ease-in-out infinite alternate;
    z-index: -1;
  }
}

@keyframes knechti-shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}

@keyframes knechti-entrance {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(-30px);
    filter: blur(10px);
  }
  60% {
    transform: scale(1.08) translateY(0);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

@keyframes knechti-pulse {
  0% { opacity: 0.3; filter: blur(12px) brightness(1.2); }
  100% { opacity: 0.7; filter: blur(18px) brightness(2); }
}

.page-header--knechti {
  justify-content: center;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  margin-left: -1.5rem;
  margin-right: -1.5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
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

.header-controls {
  display: flex;
  gap: 10px;
}

.help-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 0.75rem;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
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

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--muted);
  font-size: 14px;
}

// ─── Table ───
.dispo-table-wrapper {
  overflow: auto; /* Handles both X and Y scrolling */
  max-height: calc(100vh - 200px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  position: relative;

  &.fullscreen-wrapper {
    max-height: none;
    flex: 1 1 0;
    border-radius: 0 0 14px 14px;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }
}

// ─── Fullscreen body (table + optional inline feed) ───
.fs-body {
  // Non-fullscreen: transparent block wrapper
}

.fullscreen-mode .fs-body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

// When feed panel is visible: table gets left-only bottom radius
.fs-body--split .dispo-table-wrapper.fullscreen-wrapper {
  border-radius: 0 0 0 14px;
}

// Feed wrapper: handle strip + collapsible feed content
.fs-feed-wrapper {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
  align-items: stretch;
}

// Thin vertical toggle handle — always visible at the left edge of the feed
.fs-feed-toggle {
  width: 20px;
  align-self: stretch;
  flex-shrink: 0;
  background: var(--surface);
  border: none;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  cursor: pointer;
  color: var(--muted);
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 10;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--primary);
    background: var(--hover);
  }
}

.fs-inline-feed {
  width: 310px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0 0 14px 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease;

  &.fs-inline-feed--collapsed {
    width: 0;
  }
}

.fs-inline-feed-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 310px; // fixed width so content doesn't squish during animation

  > * {
    flex: 1;
    min-height: 0;
  }
}

/* Neuer Split-Layout Container */
.dispo-split-layout {
  display: flex;
  min-width: min-content;
}

/* Linker Bereich verhält sich sticky innerhalb des wrappers beim scrollen nach rechts */
.dispo-left-pane {
  position: sticky;
  left: 0;
  z-index: 8;
  background: var(--surface);
  flex-shrink: 0;
  /* Fügt eine dezente Trennlinie als Schatten hinzu, wenn rechts gescrollt wird */
  box-shadow: 4px 0 10px rgba(0,0,0,0.06);

  /* Sticky-Top für den Header innerhalb der sticky-left Spalte erzwingen */
  .dispo-table thead th {
    position: sticky;
    top: 0;
    z-index: 9;
    background: var(--panel);
  }

  /* Kombinierter Hover-Rahmen um die linke Tabelle */
  .dispo-table tr.row-hovered {
    td.col-nachname {
      border-left-color: var(--primary);
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-left-width: 1.5px;
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-vorname {
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-notiz {
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-bereich {
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-kunden {
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
    td.col-aktivitaet {
      border-right-color: var(--primary);
      border-top-color: var(--primary);
      border-bottom-color: var(--primary);
      border-right-width: 1.5px;
      border-top-width: 1.5px;
      border-bottom-width: 1.5px;
    }
  }
}

/* Rechter Bereich nimmt den Rest ein */
.dispo-right-pane {
  flex-grow: 1;
  z-index: 6;

  .dispo-table thead th {
    position: sticky;
    top: 0;
    z-index: 7;
    background: var(--panel);
  }
}

.dispo-table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;

  th, td {
    padding: 0;
    border: 1px solid var(--border);
    font-size: 12px;
    white-space: nowrap;
    
    /* Um Zeilenhöhen beider Tabellen synchron zu halten: */
    height: 44px;
    box-sizing: border-box;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--panel);
    z-index: 2;
    font-weight: 600;
    color: var(--text);
    padding: 6px 4px;
    height: 52px; /* Fixe Header-Höhe */
  }

  /* Sticky Spalten-Logik wird im Split-Layout nicht mehr benötigt! */
  .col-nachname {
    width: 130px;
    min-width: 130px;
    max-width: 130px;
    padding: 6px 10px;
    text-align: left;
    overflow: hidden;
  }

  .col-vorname {
    width: 110px;
    min-width: 110px;
    max-width: 110px;
    padding: 6px 10px;
    text-align: left;
    overflow: hidden;

    .ma-name {
      font-weight: 500;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
  }

  .col-kunden {
    width: 75px;
    min-width: 60px;
    max-width: 160px;
    padding: 6px 8px;
    text-align: left;
    overflow: hidden;
  }

  thead th.col-notiz {
    padding-left: 10px;
  }

  thead th.col-aktivitaet {
    padding-left: 10px;
  }

  .col-notiz {
    width: 160px;
    min-width: 100px;
    max-width: 160px;
    padding: 0;
    text-align: left;
    overflow: visible;
    position: relative;

    &.notiz-expanded {
      width: auto !important;
      min-width: 200px !important;
      max-width: 400px !important;
      z-index: 5;
      overflow: visible;

      .notiz-editable {
        white-space: pre-wrap;
        word-break: break-word;
        overflow: visible;
        max-height: none;
        min-height: 44px;
      }

      .notiz-expand-pill {
        display: none;
      }
    }
  }

  .col-aktivitaet {
    width: 220px;
    min-width: 160px;
    max-width: 220px;
    padding: 0;
    text-align: left;
    overflow: hidden;
    position: relative;

    &.aktivitaet-expanded {
      width: auto !important;
      min-width: 280px !important;
      max-width: 460px !important;
      z-index: 5;
      overflow: visible;
    }
  }

  .col-bereich {
    width: 80px;
    min-width: 80px;
    max-width: 80px;
    padding: 6px 10px;
    text-align: center;
    overflow: hidden;
    cursor: pointer;

    .th-content {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 3px;
      white-space: nowrap;
      line-height: 1.2;
    }

    &.bereich-filter-active {
      color: var(--primary);
      box-shadow: inset 0 -2px 0 var(--primary);
    }

    .bereich-filter-icon {
      font-size: 9px;
      opacity: 0.45;
      margin-left: 2px;
      vertical-align: middle;
    }

    &:hover .bereich-filter-icon {
      opacity: 0.8;
    }

    .bereich-filter-label {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      background: rgba(238, 175, 103, 0.15);
      border-radius: 3px;
      padding: 0 3px;
      margin-left: 3px;
    }

    .bereich-filter-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      margin-left: 2px;
      cursor: pointer;
      opacity: 0.8;
      &:hover { opacity: 1; }
    }
  }

  .bereich-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    color: var(--primary);
    background: transparent;
    border: 1px solid var(--primary);
    border-radius: 4px;
    padding: 1px 4px;
    line-height: 1.4;
  }

  .notiz-cell {
    position: relative;
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 100%;
    min-height: 32px;
  }

  .notiz-editable {
    flex: 1;
    min-width: 0;
    padding: 6px 28px 6px 8px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text);
    outline: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 44px;
    cursor: text;
    border-radius: 4px;
    transition: background 0.15s;

    &:focus {
      background: var(--tile-bg);
      box-shadow: inset 0 0 0 1px var(--border);
    }

    &:empty::before {
      content: 'Notiz…';
      color: var(--muted);
      opacity: 0.5;
      pointer-events: none;
    }
  }

  .notiz-clear-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 10px;
    padding: 2px 4px;
    cursor: pointer;
    border-radius: 3px;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;
    z-index: 2;

    &:hover {
      color: var(--primary);
    }
  }

  td.col-notiz:hover .notiz-clear-btn,
  td.col-notiz:focus-within .notiz-clear-btn {
    opacity: 1;
  }

  .notiz-expand-pill {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    padding: 0 5px;
    line-height: 16px;
    cursor: pointer;
    z-index: 2;
    transition: color 0.15s, border-color 0.15s;

    &:hover {
      color: var(--primary);
      border-color: var(--primary);
    }
  }

  .aktivitaet-cell {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 5px 8px;
    gap: 3px;
  }

  // Collapsed Chronik: feste Standardhöhe wie Notiz, nur per Klick expanded
  .col-aktivitaet:not(.aktivitaet-expanded) .aktivitaet-cell {
    max-height: 44px;
    overflow: hidden;
  }

  .aktivitaet-preview-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    cursor: pointer;
  }

  .aktivitaet-preview-entry {
    display: flex;
    align-items: baseline;
    gap: 5px;
    overflow: hidden;
    line-height: 1.3;
  }

  .aktivitaet-preview-text {
    font-size: 11px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .aktivitaet-input-row {
    display: flex;
    align-items: center;
    gap: 0;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    overflow: hidden;
    transition: border-color 0.15s;

    &:focus-within {
      border-color: var(--primary);
    }
  }

  .aktivitaet-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 11px;
    padding: 4px 8px;
    outline: none;
    height: 24px;
  }

  .aktivitaet-send-btn {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
    transition: color 0.15s;

    &:hover:not(:disabled) {
      color: var(--primary);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  .aktivitaet-log-time {
    font-size: 10px;
    font-weight: 600;
    color: var(--primary);
    line-height: 1.2;
  }

  .aktivitaet-log-text {
    font-size: 11px;
    line-height: 1.3;
    color: var(--text);
    white-space: normal;
    word-break: break-word;
  }

  .aktivitaet-empty {
    font-size: 11px;
    color: var(--muted);
    padding: 2px 0;
  }

  .aktivitaet-day-header {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding: 4px 0 2px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;

    &:first-child {
      padding-top: 0;
    }
  }

  .aktivitaet-log-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    max-height: 180px;
    overflow: auto;
    padding-right: 2px;
  }

  .aktivitaet-log-item {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    padding: 3px 0;

    &:last-child {
      border-bottom: none;
    }
  }

  .aktivitaet-log-main {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .aktivitaet-delete-btn {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font-size: 9px;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s;

    &:hover {
      color: #d44;
    }
  }

  .aktivitaet-log-item:hover .aktivitaet-delete-btn {
    opacity: 1;
  }

  .col-nachname,
  .col-vorname,
  .col-notiz,
  .col-aktivitaet {
    position: relative; /* Wichtig für col-resize-handle */
    cursor: pointer;
  }

  .col-resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 5;
    background: transparent;

    &:hover,
    &:active {
      background: var(--primary);
      opacity: 0.5;
    }
  }

  tr.row-hovered td {
    background: var(--soft);
    transition: background 0.08s ease-out;
  }

  @keyframes rowHighlightPulse {
    0%   { background: rgba(var(--primary-rgb, 238 175 103) / 0.25); }
    60%  { background: rgba(var(--primary-rgb, 238 175 103) / 0.15); }
    100% { background: transparent; }
  }

  tr.row-highlighted td {
    animation: rowHighlightPulse 2.4s ease-out forwards;
  }

  .sortable-th {
    cursor: pointer;
    user-select: none;
    transition: color 0.15s;

    &:hover {
      color: var(--primary);
    }

    .th-content {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sort-icon {
      font-size: 10px;
      flex: 0 0 auto;

      &.muted {
        opacity: 0.3;
      }
    }
  }

  .col-day {
    min-width: 36px;
    text-align: center;
    cursor: pointer;
    position: relative;
    transition: background 0.15s, box-shadow 0.08s ease-out, transform 0.1s;

    &:hover,
    &.is-active {
      box-shadow: inset 0 0 0 2px var(--primary);
      transform: scale(1.05);
      z-index: 2;
    }

    // Header cells: keep border highlight but remove size change
    thead & {
      cursor: default;

      &:hover,
      &.is-active {
        transform: none;
      }
    }

    &.cell-available:hover,
    &.cell-available.is-active {
      box-shadow: inset 0 0 0 2px #10b981;
    }

    &.cell-partially:hover,
    &.cell-partially.is-active {
      box-shadow: inset 0 0 0 2px #f59e0b;
    }

    &.cell-blocked:hover,
    &.cell-blocked.is-active {
      box-shadow: inset 0 0 0 2px #ef4444;
    }

    &.cell-planned:hover,
    &.cell-planned.is-active {
      box-shadow: inset 0 0 0 2px #6366f1;
    }

    &.cell-angefragt:hover,
    &.cell-angefragt.is-active {
      box-shadow: inset 0 0 0 2px #a855f7;
    }

    // ─── Run highlight (shared border for same-status ranges) ───
    --run-color: var(--primary);
    &.cell-available  { --run-color: #10b981; }
    &.cell-partially  { --run-color: #f59e0b; }
    &.cell-blocked    { --run-color: #ef4444; }
    &.cell-planned    { --run-color: #6366f1; }
    &.cell-angefragt  { --run-color: #a855f7; }

    &.run-only {
      box-shadow: inset 0 0 0 2px var(--run-color) !important;
      transform: scale(1.03);
      z-index: 2;
    }
    &.run-start {
      box-shadow: inset 2px 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }
    &.run-middle {
      box-shadow: inset 0 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }
    &.run-end {
      box-shadow: inset -2px 2px 0 0 var(--run-color), inset 0 -2px 0 0 var(--run-color) !important;
      transform: none;
      z-index: 2;
    }

    &.is-today {
      .day-header {
        color: var(--primary);
        font-weight: 700;
      }
    }

    &.col-day--focused {
      background: rgba(238, 175, 103, 0.18) !important;
      box-shadow: inset 0 0 0 2px var(--primary) !important;
      transform: none !important;
      .day-header {
        color: var(--primary);
        font-weight: 700;
      }
    }

    &.col-day--dimmed {
      display: none;
    }

    &.is-weekend:not(.cell-planned):not(.cell-blocked):not(.cell-partially):not(.cell-available):not(.cell-angefragt) {
      background: var(--hover);
    }
  }
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.3;

  .day-name {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .day-date {
    font-size: 11px;
    color: var(--muted);
  }
}

.ma-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  overflow: hidden;

.tl-inline-badge {
  flex-shrink: 0;
  font-size: 9px;
  padding: 1px 4px;
}

.tl-corner-badge {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 8px;
  padding: 1px 4px;
  border-radius: 0 0 6px 0;
  z-index: 1;
}

.tl-corner-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  line-height: 0;

  :deep(.tl-badge) {
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 0 0 6px 0;
  }
}

.bew-corner-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 0 0 6px 0;
  background: #eab308;
  color: #fff;
  line-height: 1.4;
}

.bew-badge-inline {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: #eab308;
  color: #fff;
  line-height: 1.4;
  flex-shrink: 0;
}

.exit-corner-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 0 0 0 6px;
  background: #dc3545;
  color: #fff;
  line-height: 1.4;
  white-space: nowrap;
}

  .star-btn {
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

  .ma-name {
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.note-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.15s;

  &.has-notes {
    color: var(--primary);
  }

  &:hover {
    color: var(--text);
  }
}

.cell-fill {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 100%;

  .cell-icon {
    font-size: 12px;
  }
}

.cell-icon--corner {
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 10px;
  opacity: 0.7;
  pointer-events: none;
}

.cell-time-text {
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  color: #f59e0b;
  letter-spacing: -0.3px;

  &--sm {
    font-size: 8px;
    letter-spacing: -0.5px;
  }
}

// ─── Cell Status Colors ───
.cell-angefragt {
  background: #a855f720;
  .cell-icon { color: #a855f7; }
}

.cell-icon--angefragt-q {
  color: #a855f7 !important;
  opacity: 0.85;
}

.cell-icon-img {
  width: 13px;
  height: 13px;
  object-fit: contain;
  opacity: 0.85;
}

.cell-available {
  background: #10b98120;
  .cell-icon { color: #10b981; }
}

.cell-partially {
  background: #f59e0b20;
  .cell-icon { color: #f59e0b; }
}

.cell-blocked {
  background: #ef444420;
  .cell-icon { color: #ef4444; }
}

.cell-planned {
  background: #6366f120;
  .cell-icon { color: #6366f1; }
  .cell-label {
    font-size: 10px;
    font-weight: 700;
    color: #6366f1;
    letter-spacing: 0.03em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 44px;
    line-height: 1;
  }
}

.cell-eingeplant-manuell {
  background: #6366f115;
  border: 1.5px dashed #6366f180;

  .cell-icon { opacity: 0.7; }
  .cell-label { opacity: 0.8; }
}

// ─── Multi-cell Selection ───
.cell-selected {
  background: rgba(253, 126, 20, 0.18) !important;
  box-shadow: inset 0 0 0 2px var(--primary) !important;

  .cell-icon {
    opacity: 0.8;
  }
}

// ─── Selection Bar ───
// ─── Fullscreen enter/leave animation ───
.dispo-fs-enter-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.dispo-fs-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.dispo-fs-enter-from {
  opacity: 0;
  transform: scale(0.97);
}
.dispo-fs-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 7px 14px;
  margin-bottom: 12px;
  flex-wrap: nowrap;
}

.sel-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}



:deep(.qual-pills-input) {
  border-color: transparent;
  background: var(--hover);

  &:focus-within {
    border-color: var(--primary);
  }
}

:deep(.kunde-search__input-wrap),
:deep(.kunde-search .selected-chip) {
  border-color: transparent;
  background: var(--hover);

  &:focus-within {
    border-color: var(--primary);
  }
}

.dispo-search-bar {
  padding: 5px 10px;
  border-radius: 8px;
  flex-shrink: 0;
  width: 200px;

  :deep(.search-bar-root) {
    border-color: transparent;
  }

  :deep(input) {
    font-size: 0.85rem;
  }
}

.zeitraum-dropdown {
  :deep(.dropdown-trigger) {
    min-width: unset;
    padding: 4px 10px;
    font-size: 0.82rem;
    border-radius: 8px;
  }
}

.filter-help-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 0.9rem;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;

  &:hover {
    color: var(--text);
  }
}

.sel-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-left: auto;
}

.shortcut-hint {
  font-size: 0.78rem;
  color: var(--muted);
  opacity: 0.6;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: opacity 0.15s;

  kbd {
    display: inline-block;
    padding: 0px 5px;
    font-size: 0.75rem;
    font-family: inherit;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text);
  }

  &:hover {
    opacity: 1;
  }
}

.show-hidden-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  font-size: 0.78rem;
  font-family: inherit;
  background: none;
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  &.active {
    background: rgba(238, 175, 103, 0.12);
    border-color: var(--primary);
    color: var(--primary);
  }
}

.show-hidden-btn--topline {
  height: 32px;
  padding-inline: 10px;
  background: var(--surface);
  border-color: transparent;
}

// ─── KW Chips ───
.kw-chips {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kw-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.5px;
  margin-right: 2px;
  user-select: none;
}

.kw-nav-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--muted);
  font-size: 10px;
  padding: 2px 5px;
  cursor: pointer;
  height: 22px;
  display: flex;
  align-items: center;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--text);
    border-color: var(--text);
  }
}

.kw-chip {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 7px;
  cursor: pointer;
  height: 22px;
  display: flex;
  align-items: center;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  user-select: none;
  white-space: nowrap;

  &:hover {
    color: var(--text);
    border-color: var(--text);
  }

  &.kw-chip--current {
    color: var(--primary);
    border-color: var(--primary);
    font-weight: 600;
  }

  &.kw-chip--active {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
    font-weight: 600;
  }
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 0.75rem;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    color: var(--text);
    border-color: var(--text);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

.zoom-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  min-width: 34px;
  text-align: center;
  cursor: default;
  user-select: none;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 10px;
  background: rgba(253, 126, 20, 0.10);
  border: 1px solid var(--primary);
  border-radius: 20px;
  color: var(--primary);
  font-size: 12px;
  font-weight: 500;

  strong { font-weight: 700; }

  .sel-chip-clear {
    background: none;
    border: none;
    color: var(--primary);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    line-height: 1;
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity 0.15s;

    &:hover { opacity: 1; }
  }
}

.sel-chip-enter-active,
.sel-chip-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.sel-chip-enter-from,
.sel-chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.dispo-cell-tooltip {
  position: fixed;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  white-space: pre-line;
  pointer-events: none;
  z-index: 9999;
  max-width: 280px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.comment-bubble {
  position: absolute;
  top: 1px;
  right: 1px;
  font-size: 18px;
  z-index: 3;
}

.dispo-cell-tooltip--comments {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  min-width: 220px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}

.tooltip-comment {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &:not(:last-child) {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .tooltip-comment-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .tooltip-comment-author {
    font-size: 10px;
    font-weight: 700;
    color: var(--primary);
  }

  .tooltip-comment-time {
    font-size: 10px;
    color: var(--muted);
  }

  .tooltip-comment-text {
    font-size: 12px;
    color: var(--text);
    margin: 0;
    white-space: pre-wrap;
  }
}

// ─── Kunden Pills ───
.kunden-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
}

.kw-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: default;
  line-height: 1.4;
  position: relative;

  .kw-pill-remove {
    display: none;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: -5px;
    right: -5px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid currentColor;
    background: var(--surface);
    color: inherit;
    font-size: 7px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    z-index: 1;

    &:hover { background: #ef4444; border-color: #ef4444; color: #fff; }
  }

  &:hover .kw-pill-remove { display: inline-flex; }

  &--pos {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }
  &--neg {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
}

.kw-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
  line-height: 1;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(238, 175, 103, 0.08);
  }
}

// ─── Kunden Filter (FilterPanel) ───
.kunde-filter-search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.kunde-filter-clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: #ef4444;
    border-color: #ef4444;
  }
}

// ─── Kunden Filter (fs-toolbar) ───
.fs-kunde-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  transition: border-color 0.15s;
  min-width: 120px;
  max-width: 200px;

  &--active {
    border-color: var(--primary);
    background: rgba(238, 175, 103, 0.08);
  }

  // Strip KundeSearch's own border/background — the outer wrapper IS the border
  :deep(.kunde-search__input-wrap) {
    border-color: transparent;
    background: transparent;
    padding: 0;
    height: auto;
    gap: 4px;

    &:focus-within {
      border-color: transparent;
    }
  }

  :deep(.kunde-search__icon) {
    color: var(--muted);
    font-size: 11px;
  }

  :deep(.kunde-search__input) {
    font-size: 0.82rem;
    padding: 0;
    min-width: 60px;
  }

  :deep(.kunde-search .selected-chip) {
    border-color: transparent;
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    height: 20px;
    font-size: 0.78rem;
    padding: 0 6px;
  }
}

.fs-kunde-filter-label {
  font-size: 13px;
  flex-shrink: 0;
  user-select: none;
}

.fs-kunde-filter-clear {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;

  &:hover { color: #ef4444; }
}

// ─── Kundenwunsch Modal ───
.kw-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 380px;
  max-width: 92vw;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.kw-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.kw-modal-title {
  font-size: 14px;
  font-weight: 600;
}

.kw-modal-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kw-modal-typ {
  display: flex;
  gap: 8px;
}

.kw-typ-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;

  &.active {
    border-color: #10b981;
    color: #10b981;
    background: rgba(16, 185, 129, 0.08);
  }

  &--neg.active {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }
}

// ─── Chat Modal ───
.chat-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 460px;
  max-width: 92vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

.chat-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .chat-modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);

    svg { color: var(--primary); }
  }
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
  max-height: 360px;
}

.chat-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  margin: 0;
  padding: 16px 0;
}

.chat-message {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 88%;
  align-self: flex-start;

  &--own {
    align-self: flex-end;

    .chat-message-meta {
      flex-direction: row-reverse;
    }

    .chat-message-text {
      background: rgba(238,175,103,0.18);
      border-color: var(--primary);
    }
  }

  &:hover .chat-delete-btn {
    opacity: 1;
    pointer-events: auto;
  }

  .chat-message-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--muted);
  }

  .chat-message-author {
    font-weight: 700;
    color: var(--primary);
  }

  .chat-message-time {
    color: var(--muted);
  }

  .chat-delete-btn {
    position: absolute;
    bottom: -6px;
    right: -6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
    padding: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease, color 0.15s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    z-index: 2;
    &:hover { color: #ef4444; }
  }

  .chat-message-text {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 10px;
    font-size: 13px;
    color: var(--text);
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.4;
  }
}

.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;

  .chat-textarea {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text);
    background: var(--bg);
    resize: none;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    line-height: 1.4;

    &:focus { border-color: var(--primary); }
  }

  .chat-send-btn {
    flex-shrink: 0;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: opacity 0.15s;

    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:hover:not(:disabled) { opacity: 0.85; }
  }
}

.ctx-unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  background: #ef4444;
  color: white;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 700;
  padding: 0 4px;
  margin-left: auto;
}

// ─── Cell Context Menu ───
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.ctx-menu {
  position: fixed;
  background: var(--modal-bg, #fff);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  min-width: 200px;
  z-index: 1001;
  padding: 4px 0;
  overflow: hidden;
}

.ctx-header {
  padding: 6px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  pointer-events: none;
}

.ctx-multi-label {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: var(--primary);
  text-transform: none;
  letter-spacing: 0;
  margin-top: 1px;
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 14px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;

  &:hover {
    background: var(--hover);
  }

  &.ctx-item--available  { color: #10b981; }
  &.ctx-item--partially  { color: #f59e0b; }
  &.ctx-item--blocked    { color: #ef4444; }
  &.ctx-item--angefragt  { color: #a855f7; }
  &.ctx-item--eingeplant { color: #6366f1; }
  &.ctx-item--clear      { color: var(--muted); }
  &.ctx-item--open      { color: var(--primary); }
  &.ctx-item--hide      { color: var(--muted); }
  &.active              { color: var(--primary); font-weight: 600; }
  &.ctx-item-remove     { color: var(--muted); border-top: 1px solid var(--border); margin-top: 2px; padding-top: 6px; }
  &.ctx-item--phone     { color: #10b981; text-decoration: none; }
}

.ctx-item--phone-copy {
  .ctx-phone-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctx-phone-copy {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0;
    transition: all 0.12s ease;

    &.is-copied {
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.55);
      background: rgba(16, 185, 129, 0.08);
    }
  }

  &:hover .ctx-phone-copy:not(.is-copied) {
    color: var(--primary);
    border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  .ctx-copy-icon {
    font-size: 12px;
  }
}

.ctx-item-icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.ctx-icon-composite {
  position: relative;
  width: 18px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .ctx-icon-badge {
    position: absolute;
    top: -3px;
    left: -3px;
    font-size: 7px;
    color: #a855f7;
    line-height: 1;
  }

  .ctx-icon-main {
    font-size: 11px;
    color: #a855f7;
  }

  .ctx-icon-flip {
    width: 11px;
    height: 11px;
    object-fit: contain;
    filter: sepia(1) saturate(8) hue-rotate(230deg) brightness(0.85);
  }
}

.ctx-entry-ts {
  font-size: 10px;
  color: var(--muted);
  margin-left: 4px;
  font-style: italic;
  opacity: 0.8;
}

.ctx-item-clock {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.55;
}

// ─── Partially Time Picker ───
.ctx-time-picker {
  padding: 6px 14px 10px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.ctx-time-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;

  label {
    font-size: 11px;
    color: var(--muted);
    min-width: 22px;
  }

  input[type="time"] {
    flex: 1;
    background: var(--input-bg, var(--surface));
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 12px;
    color: var(--text);
    min-width: 0;

    &:focus {
      outline: none;
      border-color: #f59e0b;
    }
  }
}

.ctx-time-actions {
  display: flex;
  gap: 6px;
}

.ctx-time-confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: #f59e0b20;
  border: 1px solid #f59e0b80;
  color: #f59e0b;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: #f59e0b35; }
}

.ctx-time-skip {
  background: none;
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: var(--hover); }
}

// ─── Eingeplant (manuell) Picker ───
.ctx-eingeplant-picker {
  padding: 6px 14px 10px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ctx-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 14px;
  font-size: 12px;
  color: var(--text);
}

.ctx-entry-icon {
  margin-right: 6px;
  opacity: 0.7;
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

.empty-row {
  text-align: center;
  padding: 2rem !important;
  color: var(--muted);
  font-size: 14px;
}

.dropdown-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: background 0.1s;

  &:hover { background: var(--hover); }
  &.selected { color: var(--primary); font-weight: 600; }
}

// ─── Shared Modal ───
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;

  &:hover { color: var(--text); }
}

// ─── Employee Card Modal ───
.card-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card-modal-container {
  position: relative;
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 14px;
}

.card-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);

  &:hover { color: var(--text); }
}

// ─── Qualifikation Filter ───
.qual-filter-box {
  position: relative;
  width: 100%;
}

.qual-pills-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  cursor: text;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;

  &:focus-within {
    border-color: var(--primary);
  }

  &--fs {
    min-height: 28px;
    padding: 2px 6px;
    border-radius: 6px;
    width: auto;
    min-width: 160px;
    max-width: 400px;
    flex-wrap: nowrap;
    overflow: hidden;
  }
}

.qual-search-input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  min-width: 80px;
  padding: 0;

  &::placeholder {
    color: var(--muted);
    opacity: 0.6;
  }
}

.qual-pills-input input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  min-width: 60px;
  padding: 0;

  &::placeholder {
    color: var(--muted);
    opacity: 0.6;
  }
}

.qual-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  background: rgba(var(--primary-rgb, 253 126 20) / 0.12);
  border: 1px solid rgba(var(--primary-rgb, 253 126 20) / 0.35);
  border-radius: 20px;
  font-size: 11px;
  color: var(--primary);
  font-weight: 500;
  white-space: nowrap;
  max-width: 160px;
  overflow: visible;

  &--sm {
    font-size: 10px;
    padding: 1px 5px 1px 7px;
    max-width: 140px;
  }
}

.qual-pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qual-pill.is-focused {
  background: rgba(var(--primary-rgb, 253 126 20) / 0.22);
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 253 126 20) / 0.3);
}

.qual-pill-remove {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 10px;
  padding: 0;
  cursor: pointer;
  line-height: 1;
  opacity: 0.6;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 1;
  }
}

.qual-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 320px;
  width: max-content;
  max-width: min(500px, calc(100vw - 40px));
  background: var(--modal-bg, var(--panel));
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;

  &--fs {
    min-width: 380px;
  }
}

.qual-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--hover);
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
}

.qual-key {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}

.qual-clear-all-btn {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);
  }
}

// ─── Qualifikation Filter (fs-toolbar) ───
.fs-qual-filter {
  position: relative;
  display: flex;
  align-items: center;

  &--active .qual-pills-input--fs {
    border-color: var(--primary);
  }
}

/* ─── Mobile UI (≤768px) ──────────────────────────────────────────────── */

.m-top-bar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--panel);
  border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
  padding: 8px 10px 6px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;

    .m-search { flex: 1; min-width: 0; }
  }
}

.m-filter-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--border, rgba(0,0,0,0.12));
  background: transparent;
  color: var(--text, #222);
  font-size: 1.05rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(255, 122, 0, 0.08);
  }
}

.m-hidden-btn {
  flex: 0 0 auto;
  height: 40px;
  max-width: 138px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border, rgba(0,0,0,0.12));
  background: transparent;
  color: var(--text-muted, #666);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover,
  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(255, 122, 0, 0.08);
  }
}

.m-kw-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.m-kw-scroll {
  flex: 1;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;

  &::-webkit-scrollbar { display: none; }
}

.m-kw-chip {
  flex: 0 0 auto;
  scroll-snap-align: start;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border, rgba(0,0,0,0.15));
  background: transparent;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-muted, #666);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &.current {
    border-color: var(--primary);
    color: var(--primary);
  }
  &.active {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }
}

.m-today-btn {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(0,0,0,0.12));
  background: transparent;
  color: var(--text, #222);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.m-card-list {
  padding: 8px 10px 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.m-loading, .m-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted, #888);
  font-size: 0.9rem;
}

.m-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, rgba(0,0,0,0.08));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 6px;
    cursor: pointer;
    touch-action: manipulation;

    &:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--primary) 55%, transparent);
      outline-offset: -2px;
    }
  }

  &__note-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px 8px 50px;
    color: var(--text-muted, #666);
    font-size: 0.78rem;
    line-height: 1.25;
    cursor: pointer;

    svg {
      flex: 0 0 auto;
      color: var(--primary);
      opacity: 0.85;
    }

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__details {
    border-top: 1px solid var(--border, rgba(0,0,0,0.06));
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--bg-subtle, rgba(0,0,0,0.015));
  }
}

.m-star {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: var(--text-muted, #aaa);
  font-size: 1rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.active { color: #f5b400; }
}

.m-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  overflow: hidden;

  &__nach {
    appearance: none;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    font: inherit;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    text-align: left;

    &:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent);
      outline-offset: 2px;
      border-radius: 4px;
    }
  }
  &__vor {
    font-size: 0.85rem;
    color: var(--text-muted, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.m-bereich-pill {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(0,0,0,0.06);
  color: var(--text-muted, #555);
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.m-more,
.m-expand {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: var(--text-muted, #888);
  cursor: pointer;
  transition: transform 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover,
  &:focus-visible {
    color: var(--primary);
    background: rgba(255, 122, 0, 0.08);
    border-radius: 8px;
    outline: none;
  }
}

.m-expand {
  &.active { transform: rotate(180deg); color: var(--primary); }
}

.m-day-strip {
  display: flex;
  gap: 8px;
  // extra top-padding so the comment bubble (which sits outside the cell)
  // isn't clipped by the implicit overflow-y:auto caused by overflow-x:auto
  padding: 14px 14px 14px 20px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scroll-padding-left: 20px; // keep left spacing when snap aligns first cell
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.m-day-cell {
  flex: 0 0 auto;
  width: 58px;
  min-height: 70px;
  scroll-snap-align: start;
  border: 1px solid var(--border, rgba(0,0,0,0.08));
  border-radius: 10px;
  background: var(--surface, #fff);
  padding: 4px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  position: relative;
  font-family: inherit;
  color: inherit;
  transition: transform 0.08s, border-color 0.15s;

  &:active { transform: scale(0.96); }

  &.is-today {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary) inset;
  }
  &.is-weekend { background: rgba(0,0,0,0.025); }

  &__weekday {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #888);
    letter-spacing: 0.5px;
  }
  &__date {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text, #222);
  }
  &__body {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    font-size: 0.85rem;
    font-weight: 600;
  }
  &__icon { font-size: 0.95rem; }
  &__icon--corner {
    position: absolute;
    top: 0;
    left: 2px;
    font-size: 0.6rem;
    opacity: 0.7;
  }
  &__icon-img { width: 18px; height: 18px; }
  &__time {
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.1;
    text-align: center;
  }
  &__label {
    font-size: 0.78rem;
    font-weight: 700;
  }

  &__badge {
    position: absolute;
    top: -6px;
    right: -6px;
    font-size: 22px;
    z-index: 3;
  }

  /* Status colors — reuse desktop classes when applied */
  &.cell-available { background: rgba(76, 175, 80, 0.18); }
  &.cell-partially { background: rgba(255, 193, 7, 0.22); }
  &.cell-blocked { background: rgba(244, 67, 54, 0.18); }
  &.cell-planned, &.cell-eingeplant-manuell { background: rgba(63, 81, 181, 0.18); }
  &.cell-angefragt { background: rgba(156, 39, 176, 0.18); }
}

/* Card details: Notiz / Kunden / Chronik */
.m-detail-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.m-detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.m-detail-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted, #888);
  letter-spacing: 0.5px;
}
.m-notiz {
  min-height: 32px;
  padding: 6px 8px;
  border: 1px solid var(--border, rgba(0,0,0,0.1));
  border-radius: 6px;
  background: var(--surface, #fff);
  font-size: 0.85rem;
  white-space: pre-wrap;
  outline: none;

  &:focus { border-color: var(--primary); }
  &:empty::before {
    content: "Notiz hinzufügen…";
    color: var(--text-muted, #aaa);
  }
}
.m-notiz-clear {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--text-muted, #888);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 2px 0;
}
.m-kunden-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.m-kunde-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(76, 175, 80, 0.15);
  color: #2e7d32;
  font-size: 0.75rem;
  font-weight: 500;

  &.neg { background: rgba(244, 67, 54, 0.15); color: #c62828; }
}
.m-kunde-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--primary) 45%, transparent);
  border-radius: 6px;
  background: transparent;
  color: var(--primary);
  padding: 3px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}
.m-kunde-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: currentColor;
  opacity: 0.65;
  padding: 0;
  cursor: pointer;

  &:hover { opacity: 1; background: rgba(0, 0, 0, 0.08); }
}
.m-kunden-empty {
  color: var(--text-muted, #888);
  font-size: 0.78rem;
  font-style: italic;
}
.m-chronik {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.m-chronik-day {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.m-chronik-date {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted, #888);
}
.m-chronik-entry {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 6px;
  background: var(--surface, #fff);
  border-radius: 6px;
  font-size: 0.82rem;
}
.m-chronik-text { flex: 1; word-break: break-word; }
.m-chronik-del {
  background: transparent;
  border: none;
  color: var(--text-muted, #aaa);
  cursor: pointer;
  padding: 2px 4px;

  &:hover { color: #e53935; }
}
.m-chronik-add {
  display: flex;
  gap: 6px;
  margin-top: 4px;

  input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid var(--border, rgba(0,0,0,0.1));
    border-radius: 6px;
    font-size: 0.85rem;
    background: var(--surface, #fff);
    color: var(--text, #222);

    &:focus { outline: none; border-color: var(--primary); }
  }
  button {
    width: 32px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: #fff;
    cursor: pointer;

    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }
}

/* Bottom sheets (filter + action) */
.m-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: stretch;
}

.m-sheet {
  width: 100%;
  max-height: 88vh;
  background: var(--surface, #fff);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15);

  &__handle {
    width: 36px;
    height: 4px;
    background: rgba(0,0,0,0.15);
    border-radius: 2px;
    margin: 8px auto 4px;
  }
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 16px 10px;
    border-bottom: 1px solid var(--border, rgba(0,0,0,0.06));

    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text, #222);
    }
  }
  &__sub {
    display: block;
    font-size: 0.78rem;
    color: var(--text-muted, #888);
    margin-top: 2px;
  }
  &__close {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-muted, #888);
    font-size: 1rem;
    cursor: pointer;
    border-radius: 8px;

    &:active { background: rgba(0,0,0,0.05); }
  }
  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

/* Filter sheet: compact overrides for vertical layout */
.m-sheet--filter .m-sheet__body {
  gap: 4px;
  padding: 8px 12px 16px;

  /* Turn the vertical divider bar into a slim horizontal rule */
  :deep(.filter-divider) {
    display: block;
    width: 100%;
    height: 1px;
    background: var(--border);
    margin: 2px 0;
  }
}

.m-sheet-group-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted, #888);
  letter-spacing: 0.5px;
  margin: 10px 0 2px;

  &:first-child { margin-top: 0; }
}

.m-action-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(0,0,0,0.04);
  border-radius: 8px;
  font-size: 0.85rem;
  gap: 8px;

  .m-action-del {
    background: transparent;
    border: none;
    color: #e53935;
    cursor: pointer;
    padding: 4px 6px;
  }
}

.m-action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border, rgba(0,0,0,0.1));
  background: var(--surface, #fff);
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--text, #222);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all 0.12s;

  &:active { transform: scale(0.98); }

  &--primary {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
    justify-content: center;
  }
  &--ghost {
    background: transparent;
    color: var(--text-muted, #666);
    justify-content: center;
  }
  &--open-einsatz {
    background: transparent;
    border-color: var(--primary);
    color: var(--primary);
    justify-content: center;
  }
  &--danger {
    border-color: rgba(229, 57, 53, 0.4);
    color: #e53935;
    margin-top: 10px;
  }
  &--available { border-color: rgba(76, 175, 80, 0.5); color: #2e7d32; }
  &--partially { border-color: rgba(255, 152, 0, 0.5); color: #ef6c00; }
  &--blocked   { border-color: rgba(244, 67, 54, 0.5); color: #c62828; }
  &--angefragt { border-color: rgba(156, 39, 176, 0.5); color: #6a1b9a; }
  &--eingeplant { border-color: rgba(63, 81, 181, 0.5); color: #303f9f; }
  &.active { background: rgba(255, 122, 0, 0.08); border-color: var(--primary); }
}
.m-clock-ico {
  margin-left: auto;
  font-size: 0.85rem;
  opacity: 0.7;
}
.m-flip-ico { width: 18px; height: 18px; }

.m-time-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0,0,0,0.03);
  border-radius: 8px;

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85rem;

    input {
      padding: 6px 8px;
      border: 1px solid var(--border, rgba(0,0,0,0.15));
      border-radius: 6px;
      font-size: 0.9rem;
      background: var(--surface, #fff);
      color: var(--text, #222);
    }
  }
}
.m-time-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;

  .m-action-btn { padding: 10px; }
}

.m-eingeplant-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(0,0,0,0.03);
  border-radius: 8px;
}

.m-unread-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: #e53935;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Sheet slide-up animation */
.m-sheet-enter-active, .m-sheet-leave-active {
  transition: opacity 0.2s ease;

  .m-sheet { transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
}
.m-sheet-enter-from, .m-sheet-leave-to {
  opacity: 0;

  .m-sheet { transform: translateY(100%); }
}
</style>
