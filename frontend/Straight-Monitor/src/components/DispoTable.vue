<template>
  <Transition name="dispo-fs">
  <div class="dispo-page" :class="{ 'fullscreen-mode': isFullscreen }">
    <!-- Page header — hidden in fullscreen -->
    <div v-if="!isFullscreen" class="page-header" :class="{ 'page-header--knechti': isKnechti }">
      <h1 v-if="isKnechti" class="knechti-title">KNECHTI-LISTE</h1>
      <div v-if="!isKnechti" class="header-title-group"></div>
      <div v-if="!isKnechti" class="header-controls"></div>
    </div>

    <!-- Fullscreen toolbar — compact filter bar —-->
    <div v-if="isFullscreen" class="fs-toolbar">
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
          <div v-for="opt in [7, 14, 30, 90, 365]" :key="opt" class="dropdown-item" :class="{ selected: filters.tage === opt }" @click="setTage(opt)">{{ opt }} Tage</div>
        </FilterDropdown>

        <!-- Planung -->
        <FilterDropdown :has-value="!!filters.planungFilter">
          <template #label><font-awesome-icon icon="fa-solid fa-clipboard-list" style="margin-right:4px" />{{ planungLabel }}</template>
          <div class="dropdown-item" :class="{ selected: !filters.planungFilter }" @click="setPlanung(null)">Alle</div>
          <div class="dropdown-item" :class="{ selected: filters.planungFilter === 'eingeplant' }" @click="setPlanung('eingeplant')">Eingeplante</div>
          <div class="dropdown-item" :class="{ selected: filters.planungFilter === 'ungeplant' }" @click="setPlanung('ungeplant')">Ungeplante</div>
        </FilterDropdown>

        <!-- Kunden Filter (fs-toolbar) -->
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

        <!-- KW Chips -->
        <div class="kw-chips">
          <span class="kw-label">KW</span>
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
        </div>

        <!-- Search -->
        <CustomTooltip text="Suchen [S]" position="bottom">
          <div class="fs-search-box">
            <font-awesome-icon icon="fa-solid fa-magnifying-glass" class="fs-search-icon" />
            <input ref="searchInputFs" v-model="searchQuery" type="text" placeholder="Suchen…" />
          </div>
        </CustomTooltip>

        <!-- Reset -->
        <button class="fs-reset-btn" @click="resetFilters" title="Zurücksetzen">
          <font-awesome-icon icon="fa-solid fa-rotate-left" />
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

    <FilterPanel v-if="!isFullscreen" v-model:expanded="filterExpanded">
      <template #header-actions>
        <span class="shortcut-hint" @click.stop="showHelp = true">
          Tipp: <kbd>H</kbd> für Hilfe &amp; Shortcuts
        </span>
      </template>
      <!-- Standort Filter -->
      <FilterGroup label="Standort">
        <FilterChip :active="filters.standort === '1'" @click="setStandort('1')">Berlin</FilterChip>
        <FilterChip :active="filters.standort === '2'" @click="setStandort('2')">Hamburg</FilterChip>
        <FilterChip :active="filters.standort === '3'" @click="setStandort('3')">Köln</FilterChip>
        <FilterChip :active="!filters.standort" @click="setStandort(null)">Alle</FilterChip>
      </FilterGroup>

      <FilterDivider />

      <!-- Zeitraum Filter -->
      <FilterGroup label="Zeitraum">
        <FilterDropdown :has-value="filters.tage !== 30">
          <template #label>{{ filters.tage }} Tage</template>
          <div
            v-for="opt in [7, 14, 30, 90, 365]"
            :key="opt"
            class="dropdown-item clickable"
            :class="{ selected: filters.tage === opt }"
            @click="setTage(opt)"
          >
            {{ opt }} Tage
          </div>
        </FilterDropdown>
      </FilterGroup>

      <FilterDivider />

      <!-- Planung Filter -->
      <FilterGroup label="Planung">
        <FilterChip :active="!filters.planungFilter" @click="setPlanung(null)">Alle</FilterChip>
        <FilterChip :active="filters.planungFilter === 'eingeplant'" @click="setPlanung('eingeplant')">Eingeplante</FilterChip>
        <FilterChip :active="filters.planungFilter === 'ungeplant'" @click="setPlanung('ungeplant')">Ungeplante</FilterChip>
      </FilterGroup>

      <FilterDivider />

      <!-- Kunden Filter -->
      <FilterGroup label="🤝 Kunde">
        <div class="kunde-filter-search">
          <KundeSearch
            ref="kundeFilterRef"
            :standort="filters.standort"
            placeholder="Kunde suchen…"
            @select="(k) => { filterKunde = k; filters.kundeFilter = k?._id || null; }"
          />
          <button v-if="filters.kundeFilter" class="kunde-filter-clear" @click="clearKundeFilter" title="Filter entfernen">
            <font-awesome-icon icon="fa-solid fa-xmark" />
          </button>
        </div>
      </FilterGroup>

      <FilterDivider />

      <!-- Ausgeblendete -->
      <button
        v-if="hiddenIds.size > 0"
        class="show-hidden-btn"
        :class="{ active: showHidden }"
        @click="showHidden = !showHidden"
        :title="showHidden ? 'Ausgeblendete verstecken' : 'Ausgeblendete anzeigen'"
      >
        <font-awesome-icon :icon="showHidden ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'" />
        {{ showHidden ? 'Ausgeblendete ausblenden' : `${hiddenIds.size} Ausgeblendet` }}
      </button>

      <FilterDivider v-if="hiddenIds.size > 0" />

      <!-- Reset Button -->
      <FilterChip class="reset-chip" @click="resetFilters" title="Alle Filter zurücksetzen">
        <font-awesome-icon icon="fa-solid fa-rotate-left" />
        Zurücksetzen
      </FilterChip>

      <!-- Search Box -->
      <CustomTooltip text="Suchen [S]" position="bottom" style="display:block">
        <div class="search-box">
          <input
            ref="searchInputNormal"
            v-model="searchQuery"
            type="text"
            placeholder="Mitarbeiter suchen…"
          />
        </div>
      </CustomTooltip>
    </FilterPanel>

    <!-- Selection Bar (normal mode only) -->
    <div v-if="!isFullscreen" class="selection-bar">
      <!-- Left: cell selection chip -->
      <div class="sel-bar-left">
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
        <CustomTooltip text="Vollbild (F)" position="top">
          <button class="zoom-btn" @click="toggleFullscreen">
            <font-awesome-icon icon="fa-solid fa-expand-alt" />
          </button>
        </CustomTooltip>
        <CustomTooltip text="Hilfe [H]" position="top">
          <button class="help-btn" @click="showHelp = true">
            <font-awesome-icon icon="fa-solid fa-circle-question" />
          </button>
        </CustomTooltip>
      </div>
    </div>

    <!-- Table area (+ inline feed panel when fullscreen) -->
    <div class="fs-body" :class="{ 'fs-body--split': isFullscreen && ui.panelType === 'kommentare' && !ui.hidden && !fsFeedCollapsed }">

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
                  class="col-notiz"
                  :style="{ width: colWidths.notiz + 'px', minWidth: colWidths.notiz + 'px', maxWidth: colWidths.notiz + 'px' }"
                >
                  <span class="th-content">Notiz</span>
                  <div class="col-resize-handle" @mousedown.prevent.stop="startResize($event, 'notiz')"></div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`l-${ma._id}`"
                :data-left-row="ma._id"
                @mouseenter="hoveredMaId = ma._id"
                @mouseleave="hoveredMaId = null"
                :class="{ 'row-hovered': hoveredMaId === ma._id, 'row-highlighted': highlightedMaId === String(ma._id) }"
                @contextmenu.prevent.stop="openNameMenu($event, ma)"
                style="cursor: default"
              >
                <!-- Nachname -->
                <td class="col-nachname" :style="{ width: colWidths.nachname + 'px', minWidth: colWidths.nachname + 'px', maxWidth: colWidths.nachname + 'px' }">
                  <div class="ma-name-cell">
                    <div v-if="isTeamleiter(ma)" class="tl-corner-wrapper"><TlBadge /></div>
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
              </tr>
              <tr v-if="filteredMitarbeiter.length === 0">
                <td colspan="5" class="empty-row text-center">
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
                  :class="{
                    'is-today': day.isToday,
                    'is-weekend': day.isWeekend,
                  }"
                >
                  <div class="day-header">
                    <span class="day-name">{{ day.weekday }}</span>
                    <span class="day-date">{{ day.label }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="ma in filteredMitarbeiter" 
                :key="`r-${ma._id}`"
                :style="rowHeights[String(ma._id)] ? { height: rowHeights[String(ma._id)] + 'px' } : null"
                @mouseenter="hoveredMaId = ma._id"
                @mouseleave="hoveredMaId = null"
                :class="{ 'row-hovered': hoveredMaId === ma._id, 'row-highlighted': highlightedMaId === String(ma._id) }"
              >
                <!-- Day cells -->
                <td
                  v-for="day in visibleDays"
                  :key="day.iso"
                  class="col-day"
                  :data-ma-id="String(ma._id)"
                  :data-iso="day.iso"
                  :class="[
                    cellClass(ma._id, day.iso),
                    {
                      'is-today': day.isToday,
                      'is-weekend': day.isWeekend,
                      'is-active': ctxMenu.open && ctxMenu.ma?._id === ma._id && ctxMenu.day === day.iso,
                      'cell-selected': isCellSelected(ma._id, day.iso),
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
                    <font-awesome-icon icon="fa-solid fa-question" class="cell-icon cell-icon--corner cell-icon--angefragt-q" />
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
                  <span v-if="getCellComments(ma._id, day.iso).length" class="comment-bubble">
                    <font-awesome-icon icon="fa-solid fa-comment" class="comment-bubble-icon" />
                    <span v-if="getCellUnreadCount(ma._id, day.iso) > 0" class="comment-badge">{{ getCellUnreadCount(ma._id, day.iso) }}</span>
                  </span>
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

    <!-- Help Modal -->
    <teleport to="body">
      <div v-if="showHelp" class="modal-overlay" @click="showHelp = false">
        <div class="help-modal" @click.stop>
          <div class="help-modal-header">
            <h3> Dispo-Tabelle — Hilfe</h3>
            <button class="close-btn" @click="showHelp = false"><font-awesome-icon icon="fa-solid fa-times" /></button>
          </div>
          <div class="help-modal-body">
            <div class="help-section">
              <h4>Tastatur-Shortcuts</h4>
              <table class="help-shortcuts">
                <tbody>
                  <tr><td><kbd>F</kbd></td><td>Vollbild ein/aus</td></tr>
                  <tr><td><kbd>C</kbd></td><td>Kommentar-Feed ein/aus</td></tr>
                  <tr><td><kbd>H</kbd></td><td>Hilfe ein/aus</td></tr>
                  <tr><td><kbd>S</kbd></td><td>Suche fokussieren</td></tr>
                  <tr><td><kbd>1</kbd> – <kbd>9</kbd></td><td>Kalenderwoche wählen (1 = aktuelle KW)</td></tr>
                  <tr><td><kbd>+</kbd></td><td>Zoom vergrößern</td></tr>
                  <tr><td><kbd>–</kbd></td><td>Zoom verkleinern</td></tr>
                  <tr><td><kbd>Esc</kbd></td><td>Auswahl aufheben</td></tr>
                </tbody>
              </table>
            </div>
            <div class="help-section">
              <h4>Zellen-Status setzen</h4>
              <p><strong>Rechtsklick</strong> auf eine Zelle öffnet das Kontextmenü — dort kannst du Verfügbarkeit, Abwesenheit setzen oder löschen.</p>
            </div>
            <div class="help-section">
              <h4>Mehrfachauswahl</h4>
              <p>Halte <kbd>⌘ Cmd</kbd> (Mac) gedrückt und klicke oder ziehe über mehrere Zellen. Danach <strong>Rechtsklick</strong> auf die Auswahl, um den Status für alle gleichzeitig zu setzen.</p>
            </div>
            <div class="help-section">
              <h4>Kommentare</h4>
              <p>Über das Kontextmenü (Rechtsklick) → <em>Kommentare</em> kannst du Notizen zu einer Zelle hinterlassen. Ungelesene Kommentare werden mit einem roten Badge angezeigt.</p>
            </div>
            <div class="help-section">
              <h4>Favoriten &amp; Mitarbeiter-Karte</h4>
              <p>Klicke auf den <font-awesome-icon icon="fa-regular fa-star" /> Stern neben einem Namen für Favoriten (werden oben gelistet). <strong>Rechtsklick</strong> auf den Namen öffnet ein Menü mit <em>Karte Öffnen</em>.</p>
            </div>
            <div class="help-section">
              <h4>Legende</h4>
              <div class="help-legend">
                <div class="help-legend-item"><span class="legend-dot legend-available"></span> Verfügbar</div>
                <div class="help-legend-item"><span class="legend-dot legend-partially"></span> Eingeschränkt</div>
                <div class="help-legend-item"><span class="legend-dot legend-blocked"></span> Blocked / Abwesend</div>
                <div class="help-legend-item"><span class="legend-dot legend-planned"></span> Eingeplant (Einsatz)</div>
              </div>
            </div>
          </div>
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
          <a
            v-if="nameMenu.ma?.telefon"
            class="ctx-item ctx-item--phone"
            :href="`tel:${nameMenu.ma.telefon}`"
            @click="closeNameMenu"
          >
            <font-awesome-icon icon="fa-solid fa-phone" class="ctx-item-icon" /> {{ nameMenu.ma.telefon }}
          </a>
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
            <KundeSearch ref="kwSearchRef" :standort="filters.standort" @select="addKundenwunsch" />
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

    <!-- Cell Context Menu -->
    <teleport to="body">
      <div v-if="ctxMenu.open" class="ctx-overlay" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
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
import { useDispoKommentare } from '@/stores/dispoKommentare';
import { useUi } from '@/stores/ui';
import FilterPanel from '@/components/FilterPanel.vue';
import FilterGroup from '@/components/FilterGroup.vue';
import flipIconUrl from '@/assets/flip.png';
import FilterChip from '@/components/FilterChip.vue';
import FilterDivider from '@/components/FilterDivider.vue';
import FilterDropdown from '@/components/FilterDropdown.vue';
import TlBadge from '@/components/ui-elements/TlBadge.vue';

import EmployeeCardModal from '@/components/EmployeeCardModal.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import KommentarFeed from '@/components/KommentarFeed.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';

const auth = useAuth();
const dataCache = useDataCache();
const flip = useFlipAll();
const dispoKommentare = useDispoKommentare();
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
const filterExpanded = ref(true);
const isMobile = ref(window.innerWidth <= 768);
const starredIds = ref(new Set());
const hiddenIds = ref(new Set());
const showHidden = ref(false);
const hoveredMaId = ref(null);
const highlightedMaId = ref(null);
const cellTooltipState = ref({ visible: false, text: '', comments: [], x: 0, y: 0, flipped: false });
const bereichFilter = ref(null); // null | 'S' | 'L'
const tableZoom = ref(100); // percent: 60–150
const isFullscreen = ref(false);
const bereichMenuOpen = ref(false);
const bereichMenuPos = ref({ x: 0, y: 0 });
const showHelp = ref(false);
const notizMap = reactive({});
const expandedNotiz = ref(null); // maId of currently expanded notiz cell
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
        rowHeights[maId] = entry.target.offsetHeight;
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
  if (partiallyTime.open) { blockedTime.open = false; blockedTime.zeitVon = ''; blockedTime.zeitBis = ''; }
}

// ─── Blocked Time Picker ───
const blockedTime = reactive({ open: false, zeitVon: '', zeitBis: '' });

function toggleBlockedTime() {
  blockedTime.open = !blockedTime.open;
  if (!blockedTime.open) {
    blockedTime.zeitVon = '';
    blockedTime.zeitBis = '';
  }
  if (blockedTime.open) { partiallyTime.open = false; partiallyTime.zeitVon = ''; partiallyTime.zeitBis = ''; }
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
const colWidths = reactive({ nachname: 130, vorname: 110, kunden: 75, notiz: 160 });
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

const statusOptions = [
  { value: 'available', label: 'Verfügbar', icon: 'fa-solid fa-check' },
  { value: 'partially', label: 'Eingeschränkt', icon: 'fa-solid fa-circle-half-stroke' },
  { value: 'blocked', label: 'Blocked', icon: 'fa-solid fa-xmark' },
  { value: 'angefragt_tel', label: 'Angefragt (Tel)', icon: 'fa-solid fa-phone', anfragart: 'tel' },
  { value: 'angefragt_flip', label: 'Angefragt (Flip)', icon: null, anfragart: 'flip' },
];

const absenceOptions = [
  { value: 'urlaub', label: 'Urlaub', icon: 'fa-solid fa-umbrella-beach' },
  { value: 'krank', label: 'Krank', icon: 'fa-solid fa-briefcase-medical' },
];

const CELL_ICONS = {
  planned: 'fa-solid fa-clipboard-list',
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
const isKnechti = computed(() => ['ed@straightforward.email', 'it@straightforward.email'].includes(auth.user?.email));
const showFsPanel = computed(() => isFullscreen.value && ui.panelType === 'kommentare' && !ui.hidden);
const fsFeedCollapsed = ref(false);

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

function openNameMenu(event, ma) {
  const menuW = 180;
  const menuH = 80;
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
}

// ─── Employee Card Modal ───
const cardModal = reactive({ open: false, mitarbeiterId: null });

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
  const id = nameMenu.ma._id;
  closeNameMenu();
  cardModal.mitarbeiterId = String(id);
  cardModal.open = true;
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
  if (e.key === 'f' || e.key === 'F') {
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
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    const input = isFullscreen.value ? searchInputFs.value : searchInputNormal.value;
    if (input) { input.focus(); input.select(); }
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
    if (q.showHidden) showHidden.value = true;
    if (q.datum) {
      const today = new Date();
      const target = new Date(q.datum);
      const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
      if (diffDays > filters.tage) {
        const options = [7, 14, 30, 90, 365];
        filters.tage = options.find((o) => o > diffDays) ?? 365;
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

function toggleKw(chip) {
  if (selectedKw.value?.kw === chip.kw && selectedKw.value?.year === chip.year) {
    selectedKw.value = null;
  } else {
    selectedKw.value = { kw: chip.kw, year: chip.year };
  }
}

// ─── Effective day range: extend beyond filters.tage when a far-out KW is selected ───
const effectiveTage = computed(() => {
  if (!selectedKw.value) return filters.tage;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Walk backwards from day 60 to find the last day belonging to the selected KW
  for (let i = 60; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const { kw, year } = getISOWeek(d);
    if (kw === selectedKw.value.kw && year === selectedKw.value.year) {
      return Math.max(filters.tage, i + 1);
    }
  }
  return filters.tage;
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
  for (let i = 0; i < kwDays; i++) {
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
  if (!showHidden.value) {
    list = list.filter((m) => !hiddenIds.value.has(String(m._id)));
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
        .filter((e) => e.typ === 'planned' && (e.datumBis || e.datumVon) >= todayIso)
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
  return list.sort((a, b) => {
    const aStarred = starredIds.value.has(a._id) ? 0 : 1;
    const bStarred = starredIds.value.has(b._id) ? 0 : 1;
    if (aStarred !== bStarred) return aStarred - bStarred;
    const field = sortField.value;
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
      if (e.typ === 'planned') return `Einsatz: ${e.bezeichnung || 'Auftrag ' + e.auftragNr}${e.uhrzeitVon ? ' (' + e.uhrzeitVon + '–' + e.uhrzeitBis + ')' : ''}`;
      if (e.typ === 'verfuegbarkeit') return null;
      if (e.typ === 'abwesenheit') return null;
      if (e.typ === 'notiz' || e.typ === 'hinweis') return e.text;
      return '';
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
  return dispoKommentare.getForCell(maId, iso);
}

function getCellUnreadCount(maId, iso) {
  if (!maId || !iso) return 0;
  const userId = auth.user?._id;
  if (!userId) return 0;
  const userIdStr = String(userId);
  return getCellComments(maId, iso).filter(
    (k) => String(k.authorId) !== userIdStr && !k.readBy?.map(String).includes(userIdStr)
  ).length;
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
    const l = { available: 'Verfügbar', partially: 'Eingeschränkt', blocked: 'Blocked', angefragt_tel: 'Angefragt (Tel)', angefragt_flip: 'Angefragt (Flip)' };
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
    sortDir.value = 'asc';
  }
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
    // Populate notizMap from loaded mitarbeiter
    for (const ma of data.mitarbeiter || []) {
      if (ma.dispoNotiz && !(ma._id in notizMap)) notizMap[ma._id] = ma.dispoNotiz;
    }
    eintraege.value = data.eintraege || [];
  } catch (err) {
    console.error('Dispo laden fehlgeschlagen:', err);
  } finally {
    loading.value = false;
  }
  // also refresh comments for visible range
  fetchKommentare();
}

async function fetchKommentare() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + effectiveTage.value);
  const von = today.toISOString().slice(0, 10);
  const bis = endDate.toISOString().slice(0, 10);
  await dispoKommentare.fetch(von, bis);
}

// ─── Filters ───
function setStandort(val) {
  filters.standort = val;
  savePrefs();
  fetchDispo();
}

function setTage(val) {
  filters.tage = val;
  savePrefs();
  fetchDispo();
}

function setPlanung(val) {
  filters.planungFilter = val;
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
  clearKundeFilter();
  bereichFilter.value = null;
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
  const cells = tableWrapper.value?.querySelectorAll(`td[data-ma-id="${maId}"]`);
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
    .filter((c) => String(c.authorId) !== userIdStr && !c.readBy?.map(String).includes(userIdStr))
    .map((c) => c._id);
  if (!unread.length) return;
  await dispoKommentare.markRead(unread);
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
    await dispoKommentare.markRead(unread);
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
    await dispoKommentare.postComment(chatModal.ma._id, chatModal.day, text);
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
    await dispoKommentare.deleteComment(id);
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
  await loadPrefs();

  // ── Apply deep-link query params from widget navigation ──
  const q = route.query;
  if (q.standort) filters.standort = q.standort;
  if (q.resetPlanung) filters.planungFilter = null;
  if (q.showHidden) showHidden.value = true;
  if (q.datum) {
    const today = new Date();
    const target = new Date(q.datum);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays > filters.tage) {
      const options = [7, 14, 30, 90, 365];
      filters.tage = options.find((o) => o > diffDays) ?? 365;
    }
    // Activate the KW filter for the target date
    selectedKw.value = getISOWeek(target);
  }

  await fetchDispo();
  _rebuildRowObserver();
  scrollToToday();
  if (q.maId) scrollToMa(q.maId);
});
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
  justify-content: space-between;
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

.fs-toolbar-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: visible; /* must be visible so dropdown menus are not clipped */
  min-width: 0;
}

.fs-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
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

.help-modal {
  background: var(--modal-bg);
  border-radius: 12px;
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.help-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);

  h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.help-modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.help-section {
  h4 {
    margin: 0 0 6px;
    font-size: 0.95rem;
    color: var(--text);
  }

  p {
    margin: 0 0 4px;
    font-size: 0.88rem;
    color: var(--muted);
    line-height: 1.5;
  }

  kbd {
    display: inline-block;
    padding: 1px 6px;
    font-size: 0.8rem;
    font-family: inherit;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
  }

  .help-shortcuts {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.88rem;

    td {
      padding: 4px 8px 4px 0;
      color: var(--muted);
      vertical-align: middle;

      &:first-child {
        width: 1%;
        white-space: nowrap;
        padding-right: 16px;
      }
    }
  }
}

.help-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 6px;
}

.help-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-available { background: #10b98140; border: 1px solid #10b981; }
.legend-partially { background: #f59e0b40; border: 1px solid #f59e0b; }
.legend-blocked   { background: #ef444440; border: 1px solid #ef4444; }
.legend-planned   { background: #6366f140; border: 1px solid #6366f1; }

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

  /* Kombinierter Hover-Rahmen um Nachname + Vorname */
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
    td.col-kunden {
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
    td.col-notiz {
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

  .col-nachname,
  .col-vorname,
  .col-notiz {
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
      justify-content: space-between;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sort-icon {
      margin-left: 4px;
      font-size: 10px;

      &.muted {
        opacity: 0.3;
      }
    }
  }

  .col-day {
    min-width: 48px;
    max-width: 48px;
    text-align: center;
    cursor: pointer;
    position: relative;
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

    &:hover,
    &.is-active {
      box-shadow: inset 0 0 0 2px var(--primary);
      transform: scale(1.05);
      z-index: 2;
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
  height: 28px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.sel-bar-left {
  display: flex;
  align-items: center;
}

.sel-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
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
  top: 2px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  pointer-events: none;

  .comment-bubble-icon {
    font-size: 10px;
    color: var(--primary);
    opacity: 0.85;
    filter: drop-shadow(0 0 3px rgba(238,175,103,0.4));
  }

  .comment-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 13px;
    height: 13px;
    background: #ef4444;
    color: white;
    border-radius: 99px;
    font-size: 8px;
    font-weight: 700;
    padding: 0 3px;
    line-height: 1;
  }
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
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
    opacity: 0.6;
    &:hover { color: #ef4444; opacity: 1; }
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
  &.ctx-item--clear      { color: var(--muted); }
  &.ctx-item--open      { color: var(--primary); }
  &.ctx-item--hide      { color: var(--muted); }
  &.active              { color: var(--primary); font-weight: 600; }
  &.ctx-item-remove     { color: var(--muted); border-top: 1px solid var(--border); margin-top: 2px; padding-top: 6px; }
  &.ctx-item--phone     { color: #10b981; text-decoration: none; }
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
</style>
