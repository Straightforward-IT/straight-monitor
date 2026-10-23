<template>
  <Transition name="sp">
    <aside
      v-if="modelValue"
      ref="panelEl"
      class="admin-staffing-panel"
      :class="{
        'admin-staffing-panel--embedded': embedded,
        'admin-staffing-panel--resizing': isResizingPanelWidth,
        'admin-staffing-panel--unassign-ready': Boolean(draggingAssignedEinsatz),
      }"
      :style="panelWidthStyle"
      role="complementary"
      aria-label="Personal & Bewerbungen"
      @dragenter.prevent="onUnassignDragEnter"
      @dragover.prevent="onUnassignDragOver"
      @dragleave="onUnassignDragLeave"
      @drop.prevent="onUnassignDrop"
    >
      <div
        v-if="draggingAssignedEinsatz"
        class="staffing-unassign-overlay"
        :class="{ 'is-over': unassignDragOver }"
        aria-label="Aus Schicht entfernen"
      >
        <span class="staffing-unassign-overlay__icon">
          <font-awesome-icon icon="fa-solid fa-xmark" />
        </span>
      </div>
      <div
        class="admin-staffing-panel__width-resizer"
        :class="{ 'is-resizing': isResizingPanelWidth }"
        role="separator"
        aria-orientation="vertical"
        title="Ziehen zum Ändern der Breite · Doppelklick zum Zurücksetzen"
        @mousedown.prevent="startPanelWidthResize"
        @dblclick="resetPanelWidth"
      />
      <header
        class="staffing-tabs-header"
      >
        <span
          class="pseudo-tag pseudo-tag--border"
          title="Einplanungen über dieses Panel erstellen Pseudo-Einsätze"
        >
          Pseudo
        </span>
        <div class="staffing-tabs-left">
          <AppIconButton
            variant="ghost"
            size="sm"
            label="Liste aktualisieren"
            title="Aktualisieren"
            :disabled="bewerbungenLoading || mitarbeiterLoading"
            @click="refreshActiveList"
          >
            <font-awesome-icon
              icon="fa-solid fa-rotate-right"
              :spin="bewerbungenLoading || mitarbeiterLoading"
            />
          </AppIconButton>
          <div class="staffing-tabs" role="tablist" aria-label="Personal-Ansicht">
            <button
              type="button"
              role="tab"
              class="staffing-tab staffing-tab--all"
              :class="{ active: activeTab === 'all' }"
              :aria-selected="activeTab === 'all'"
              title="Alle Mitarbeiter"
              @click="activeTab = 'all'"
            >
              <font-awesome-icon icon="fa-solid fa-users" />
              <span class="staffing-tab__label">Alle</span>
              <span class="staffing-tab__count">{{ filteredAllMitarbeiter.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="staffing-tab staffing-tab--bewerbungen"
              :class="{ active: activeTab === 'bewerbungen' }"
              :aria-selected="activeTab === 'bewerbungen'"
              aria-label="Bewerbungen"
              title="Bewerbungen"
              @click="activeTab = 'bewerbungen'"
            >
              <font-awesome-icon icon="fa-solid fa-inbox" />
              <span class="staffing-tab__label">Bewerbungen</span>
              <span
                v-if="bewerbungen.length"
                class="staffing-tab__count"
                :class="{ 'staffing-tab__count--highlight': openBewerbungenCount > 0 }"
              >
                {{ openBewerbungenCount || bewerbungen.length }}
              </span>
            </button>
          </div>
        </div>
        <AppIconButton
          variant="ghost"
          size="sm"
          class="staffing-minimize-btn"
          label="Personal & Bewerbungen ausblenden"
          title="Ausblenden"
          @click="emit('minimize')"
        >
          <font-awesome-icon icon="fa-solid fa-angles-right" />
        </AppIconButton>
      </header>
      <!-- ─── PART 1 (TOP): MITARBEITER & BEWERBUNGEN TABS ─── -->
      <section
        ref="listSectionRef"
        class="staffing-part staffing-part--list"
        :style="sectionStyle('list')"
      >
        <!-- Controls for "Alle" tab -->
        <div v-if="activeTab === 'all'" class="staffing-controls staffing-controls--with-bottom">
          <MitarbeiterSearch
            v-model="searchSelectedEmployeeId"
            v-model:search-value="searchQuery"
            class="staffing-employee-search"
            :filter-values="employeeSearchFilters"
            :selected-item="searchSelectedEmployee"
            :location-v2="orderLocationId"
            placeholder="Mitarbeiter oder Filter suchen…"
            @select="onEmployeeSearchSelect"
            @filters-change="onEmployeeSearchFiltersChange"
          />
          <div class="staffing-controls-bottom">
            <button
              type="button"
              class="docked-control-btn"
              :class="{ active: onlyAvailableOnOrderDay && Boolean(event?.vonDatum) }"
              :aria-pressed="onlyAvailableOnOrderDay && Boolean(event?.vonDatum)"
              :disabled="!event?.vonDatum"
              :title="event?.vonDatum ? 'Nur Mitarbeiter anzeigen, die am Auftragstag als verfügbar eingetragen sind' : 'Auftrag auswählen, um nach Verfügbarkeit am Auftragstag zu filtern'"
              @click="toggleOnlyAvailableOnOrderDay"
            >
              <font-awesome-icon
                :icon="availableDayLoading ? 'fa-solid fa-spinner' : 'fa-solid fa-check'"
                :spin="availableDayLoading"
              />
              <span>Verfügbar</span>
            </button>
            <SortMenu
              v-model="mitarbeitersSortBy"
              v-model:ascending="mitarbeitersIsAscending"
              :options="mitarbeiterSortOptions"
            />
          </div>
        </div>

        <!-- Controls for "Bewerbungen" tab -->
        <div v-else class="staffing-controls">
          <div class="staffing-filter-chips">
            <FilterChip
              v-for="opt in bewerbungStateOptions"
              :key="opt.value"
              :active="bewerbungStatusFilter === opt.value"
              @click="bewerbungStatusFilter = opt.value"
            >
              {{ opt.label }}
              <span v-if="opt.count > 0" class="chip-count">{{ opt.count }}</span>
            </FilterChip>
          </div>
        </div>

        <!-- List Body: Alle Mitarbeiter -->
        <div v-if="activeTab === 'all'" class="staffing-list" role="listbox" aria-label="Mitarbeiterliste">
          <div v-if="mitarbeiterLoading && !allMitarbeiter.length" class="staffing-empty">
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            <span>Mitarbeiter werden geladen…</span>
          </div>
          <div v-else-if="!filteredAllMitarbeiter.length" class="staffing-empty">
            <span>Keine passenden Mitarbeiter gefunden.</span>
          </div>
          <div
            v-for="ma in displayedAllMitarbeiter"
            v-else
            :key="ma._id"
            class="staffing-row"
            :class="[
              rowDispoStatusClass(ma._id),
              {
                'staffing-row--selected': selectedMaId === String(ma._id),
                'staffing-row--assigned': isAlreadyAssigned(ma),
              },
            ]"
            role="option"
            tabindex="0"
            :aria-selected="selectedMaId === String(ma._id)"
            :draggable="!isAlreadyAssigned(ma)"
            @dragstart="onMitarbeiterDragStart($event, ma)"
            @click="selectMitarbeiter(ma)"
            @contextmenu.prevent="openEmployeeRowMenu($event, ma)"
            @keydown.enter.prevent="selectMitarbeiter(ma)"
            @keydown.space.prevent="selectMitarbeiter(ma)"
          >
            <span
              class="staffing-row__grip"
              :class="{ 'staffing-row__grip--disabled': isAlreadyAssigned(ma) }"
              :title="isAlreadyAssigned(ma) ? 'Bereits in diesem Auftrag eingeplant' : 'In eine Schicht ziehen'"
            >
              <font-awesome-icon icon="fa-solid fa-grip-vertical" />
            </span>
            <CustomTooltip
              class="staffing-row__main-tooltip"
              position="left"
              :disabled="!hasRowDispoTooltip(ma._id, ma)"
              :delay-in="80"
            >
              <div class="staffing-row__main">
                <div class="staffing-row__title">
                  <span class="staffing-row__name">{{ formatName(ma) }}</span>
                  <TlBadge v-if="isTeamleiter(ma)" />
                  <span v-if="ma.isBewerberstatus" class="staffing-pill staffing-pill--bewerber">
                    Bew.
                  </span>
                  <span
                    v-if="getCustomerWishForOrder(ma)"
                    class="staffing-pill"
                    :class="`staffing-pill--kw-${getCustomerWishForOrder(ma).typ}`"
                  >
                    <font-awesome-icon
                      :icon="getCustomerWishForOrder(ma).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                    />
                  </span>
                  <span v-if="isAlreadyAssigned(ma)" class="staffing-pill staffing-pill--assigned">
                    Geplant
                  </span>
                </div>
                <div class="staffing-row__meta">
                  <span v-if="ma.personalnr">#{{ ma.personalnr }}</span>
                  <span v-if="employmentShortLabel(ma)" class="staffing-row__tag">
                    {{ employmentShortLabel(ma) }}
                  </span>
                  <span v-if="primarySkillLabel(ma)" class="staffing-row__skill">
                    {{ primarySkillLabel(ma) }}
                  </span>
                </div>
              </div>
              <template #content>
                <div class="row-dispo-tooltip">
                  <div
                    v-if="getCustomerWishForOrder(ma)"
                    class="row-dispo-tooltip__kw"
                    :class="`row-dispo-tooltip__kw--${getCustomerWishForOrder(ma).typ}`"
                  >
                    <div class="row-dispo-tooltip__kw-head">
                      <font-awesome-icon
                        :icon="getCustomerWishForOrder(ma).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                      />
                      <strong>
                        {{ getCustomerWishForOrder(ma).typ === 'negativ' ? 'Negativer Kundenwunsch' : 'Positiver Kundenwunsch' }}
                      </strong>
                    </div>
                    <p>{{ getCustomerWishForOrder(ma).message }}</p>
                    <p v-if="getCustomerWishForOrder(ma).kommentar" class="row-dispo-tooltip__kw-comment">
                      „{{ getCustomerWishForOrder(ma).kommentar }}“
                    </p>
                  </div>
                  <div v-if="rowDispoInfo(ma._id)?.plannedJobs?.length" class="row-dispo-tooltip__jobs">
                    <div class="row-dispo-tooltip__jobs-head">
                      <font-awesome-icon icon="fa-solid fa-clipboard-list" />
                      <strong>Eingeplant in:</strong>
                    </div>
                    <div
                      v-for="(job, jIdx) in rowDispoInfo(ma._id).plannedJobs"
                      :key="`job-${jIdx}`"
                      class="row-dispo-tooltip__job-item"
                    >
                      <span class="row-dispo-tooltip__job-title">{{ job.title }}</span>
                      <small v-if="job.subtitle">{{ job.subtitle }}</small>
                    </div>
                  </div>
                  <div v-if="rowDispoInfo(ma._id)?.partialTimeLabel" class="row-dispo-tooltip__time">
                    <font-awesome-icon icon="fa-solid fa-circle-half-stroke" />
                    <strong>Eingeschränkt verfügbar:</strong>
                    <span>{{ rowDispoInfo(ma._id).partialTimeLabel }}</span>
                  </div>
                  <div
                    v-else-if="rowDispoInfo(ma._id)?.statusLabel && !rowDispoInfo(ma._id)?.plannedJobs?.length"
                    class="row-dispo-tooltip__status"
                  >
                    <strong>{{ rowDispoInfo(ma._id).statusLabel }}</strong>
                  </div>
                  <div
                    v-if="rowDispoInfo(ma._id)?.dispoNotiz || ma.dispoNotiz"
                    class="row-dispo-tooltip__disponotiz"
                  >
                    <div class="row-dispo-tooltip__disponotiz-head">
                      <font-awesome-icon icon="fa-regular fa-note-sticky" />
                      <strong>Dispo-Notiz:</strong>
                    </div>
                    <p>{{ rowDispoInfo(ma._id)?.dispoNotiz || ma.dispoNotiz }}</p>
                  </div>
                  <p
                    v-for="(note, nIdx) in rowDispoInfo(ma._id)?.notes || []"
                    :key="`note-${nIdx}`"
                    class="row-dispo-tooltip__note"
                  >
                    {{ note }}
                  </p>
                  <div
                    v-for="(comment, cIdx) in rowDispoInfo(ma._id)?.comments || []"
                    :key="comment._id || `c-${cIdx}`"
                    class="row-dispo-tooltip__comment"
                  >
                    <div class="row-dispo-tooltip__comment-head">
                      <strong>{{ comment.author || 'Kommentar' }}</strong>
                      <span v-if="comment.timestamp || comment.createdAt">
                        {{ formatCommentTime(comment.timestamp || comment.createdAt) }}
                      </span>
                    </div>
                    <p>{{ comment.text }}</p>
                  </div>
                </div>
              </template>
            </CustomTooltip>
            <div class="staffing-row__actions">
              <AppIconButton
                variant="ghost"
                size="sm"
                class="bew-action-btn"
                :label="`Aktionen für ${formatName(ma)}`"
                @click.stop="openEmployeeRowMenu($event, ma)"
              >
                <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
              </AppIconButton>
            </div>
          </div>
        </div>

        <!-- List Body: Bewerbungen -->
        <div v-else class="staffing-list" role="listbox" aria-label="Bewerbungen">
          <div v-if="bewerbungenLoading && !bewerbungen.length" class="staffing-empty">
            <font-awesome-icon icon="fa-solid fa-spinner" spin />
            <span>Bewerbungen werden geladen…</span>
          </div>
          <div v-else-if="!filteredBewerbungen.length" class="staffing-empty">
            <span>Keine Bewerbungen für diesen Filter vorhanden.</span>
          </div>
          <div
            v-for="bew in filteredBewerbungen"
            v-else
            :key="bew._id || bew.jobId"
            class="staffing-row staffing-row--bewerbung"
            :class="[
              rowDispoStatusClass(bew.mitarbeiter?._id),
              {
                'staffing-row--selected': selectedMaId === String(bew.mitarbeiter?._id),
                'staffing-row--assigned': isAlreadyAssigned(bew.mitarbeiter) || ['scheduled', 'confirmed'].includes(bew.status),
              },
            ]"
            role="option"
            tabindex="0"
            :aria-selected="selectedMaId === String(bew.mitarbeiter?._id)"
            :draggable="!isAlreadyAssigned(bew.mitarbeiter) && !['scheduled', 'confirmed'].includes(bew.status)"
            @dragstart="onMitarbeiterDragStart($event, bew.mitarbeiter, bew)"
            @click="onBewerbungRowClick(bew)"
            @contextmenu.prevent="openBewerbungMenu($event, bew)"
            @keydown.enter.prevent="onBewerbungRowClick(bew)"
            @keydown.space.prevent="onBewerbungRowClick(bew)"
          >
            <span
              class="staffing-row__grip"
              :class="{ 'staffing-row__grip--disabled': isAlreadyAssigned(bew.mitarbeiter) || ['scheduled', 'confirmed'].includes(bew.status) }"
              :title="isAlreadyAssigned(bew.mitarbeiter) || ['scheduled', 'confirmed'].includes(bew.status) ? 'Bereits eingeplant' : 'In eine Schicht ziehen'"
            >
              <font-awesome-icon icon="fa-solid fa-grip-vertical" />
            </span>
            <CustomTooltip
              class="staffing-row__main-tooltip"
              position="left"
              :disabled="!hasRowDispoTooltip(bew.mitarbeiter?._id, bew.mitarbeiter)"
              :delay-in="80"
            >
              <div class="staffing-row__main">
                <div class="staffing-row__title">
                  <span class="staffing-row__name">{{ formatName(bew.mitarbeiter) }}</span>
                  <TlBadge v-if="isTeamleiter(bew.mitarbeiter)" />
                  <span v-if="bew.mitarbeiter?.isBewerberstatus" class="staffing-pill staffing-pill--bewerber">
                    Bew.
                  </span>
                  <span
                    v-if="getCustomerWishForOrder(bew.mitarbeiter)"
                    class="staffing-pill"
                    :class="`staffing-pill--kw-${getCustomerWishForOrder(bew.mitarbeiter).typ}`"
                  >
                    <font-awesome-icon
                      :icon="getCustomerWishForOrder(bew.mitarbeiter).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                    />
                    
                  </span>
                  <span v-if="bew.isReserve" class="staffing-pill staffing-pill--reserve">
                    Reserve
                  </span>
                  <span class="bew-status-pill" :class="`bew-status-pill--${bew.status}`">
                    {{ bewerbungStatusLabel(bew.status) }}
                  </span>
                </div>
                <div class="staffing-row__meta">
                  <span class="staffing-row__role">
                    {{ bew.schicht?.bezeichnung || bew.schichtBezeichnung || bew.jobTitle || 'Schicht' }}
                  </span>
                  <span v-if="bew.schicht?.uhrzeitVon" class="staffing-row__time">
                    · {{ formatShortTime(bew.schicht.uhrzeitVon) }}<template v-if="bew.schicht?.uhrzeitBis">–{{ formatShortTime(bew.schicht.uhrzeitBis) }}</template>
                  </span>
                  <span v-if="bew.auftragNr && Number(bew.auftragNr) !== Number(event?.auftragNr)" class="staffing-row__order-ref">
                    · {{ bew.auftragData?.eventTitel ? `${bew.auftragData.eventTitel} (#${bew.auftragNr})` : `#${bew.auftragNr}` }}
                  </span>
                </div>
              </div>
              <template #content>
                <div class="row-dispo-tooltip">
                  <div
                    v-if="getCustomerWishForOrder(bew.mitarbeiter)"
                    class="row-dispo-tooltip__kw"
                    :class="`row-dispo-tooltip__kw--${getCustomerWishForOrder(bew.mitarbeiter).typ}`"
                  >
                    <div class="row-dispo-tooltip__kw-head">
                      <font-awesome-icon
                        :icon="getCustomerWishForOrder(bew.mitarbeiter).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                      />
                      <strong>
                        {{ getCustomerWishForOrder(bew.mitarbeiter).typ === 'negativ' ? 'Negativer Kundenwunsch' : 'Positiver Kundenwunsch' }}
                      </strong>
                    </div>
                    <p>{{ getCustomerWishForOrder(bew.mitarbeiter).message }}</p>
                    <p v-if="getCustomerWishForOrder(bew.mitarbeiter).kommentar" class="row-dispo-tooltip__kw-comment">
                      „{{ getCustomerWishForOrder(bew.mitarbeiter).kommentar }}“
                    </p>
                  </div>
                  <div v-if="rowDispoInfo(bew.mitarbeiter?._id)?.plannedJobs?.length" class="row-dispo-tooltip__jobs">
                    <div class="row-dispo-tooltip__jobs-head">
                      <font-awesome-icon icon="fa-solid fa-clipboard-list" />
                      <strong>Eingeplant in:</strong>
                    </div>
                    <div
                      v-for="(job, jIdx) in rowDispoInfo(bew.mitarbeiter?._id).plannedJobs"
                      :key="`b-job-${jIdx}`"
                      class="row-dispo-tooltip__job-item"
                    >
                      <span class="row-dispo-tooltip__job-title">{{ job.title }}</span>
                      <small v-if="job.subtitle">{{ job.subtitle }}</small>
                    </div>
                  </div>
                  <div v-if="rowDispoInfo(bew.mitarbeiter?._id)?.partialTimeLabel" class="row-dispo-tooltip__time">
                    <font-awesome-icon icon="fa-solid fa-circle-half-stroke" />
                    <strong>Eingeschränkt verfügbar:</strong>
                    <span>{{ rowDispoInfo(bew.mitarbeiter?._id).partialTimeLabel }}</span>
                  </div>
                  <div
                    v-else-if="rowDispoInfo(bew.mitarbeiter?._id)?.statusLabel && !rowDispoInfo(bew.mitarbeiter?._id)?.plannedJobs?.length"
                    class="row-dispo-tooltip__status"
                  >
                    <strong>{{ rowDispoInfo(bew.mitarbeiter?._id).statusLabel }}</strong>
                  </div>
                  <div
                    v-if="rowDispoInfo(bew.mitarbeiter?._id)?.dispoNotiz || bew.mitarbeiter?.dispoNotiz"
                    class="row-dispo-tooltip__disponotiz"
                  >
                    <div class="row-dispo-tooltip__disponotiz-head">
                      <font-awesome-icon icon="fa-regular fa-note-sticky" />
                      <strong>Dispo-Notiz:</strong>
                    </div>
                    <p>{{ rowDispoInfo(bew.mitarbeiter?._id)?.dispoNotiz || bew.mitarbeiter?.dispoNotiz }}</p>
                  </div>
                  <p
                    v-for="(note, nIdx) in rowDispoInfo(bew.mitarbeiter?._id)?.notes || []"
                    :key="`b-note-${nIdx}`"
                    class="row-dispo-tooltip__note"
                  >
                    {{ note }}
                  </p>
                  <div
                    v-for="(comment, cIdx) in rowDispoInfo(bew.mitarbeiter?._id)?.comments || []"
                    :key="comment._id || `b-c-${cIdx}`"
                    class="row-dispo-tooltip__comment"
                  >
                    <div class="row-dispo-tooltip__comment-head">
                      <strong>{{ comment.author || 'Kommentar' }}</strong>
                      <span v-if="comment.timestamp || comment.createdAt">
                        {{ formatCommentTime(comment.timestamp || comment.createdAt) }}
                      </span>
                    </div>
                    <p>{{ comment.text }}</p>
                  </div>
                </div>
              </template>
            </CustomTooltip>
            <div class="staffing-row__actions">
              <AppIconButton
                variant="ghost"
                size="sm"
                class="bew-action-btn"
                :label="`Bewerbung von ${formatName(bew.mitarbeiter)} verwalten`"
                :disabled="decidingBewerbungId === String(bew._id)"
                @click.stop="openBewerbungMenu($event, bew)"
              >
                <font-awesome-icon
                  :icon="decidingBewerbungId === String(bew._id) ? 'fa-solid fa-spinner' : 'fa-solid fa-ellipsis-vertical'"
                  :spin="decidingBewerbungId === String(bew._id)"
                />
              </AppIconButton>
            </div>
          </div>
        </div>
        <div
          class="staffing-part__resizer"
          :class="{ 'is-resizing': resizingSection === 'list' }"
          role="separator"
          aria-orientation="horizontal"
          title="Ziehen zum Ändern der Höhe · Doppelklick zum Zurücksetzen"
          @mousedown.prevent="startSectionResize($event, 'list')"
          @dblclick="resetSectionHeight('list')"
        />
      </section>

      <!-- Empty selection hint when no Mitarbeiter is clicked yet -->
      <div v-if="!activeMitarbeiter" class="staffing-unselected-hint">
        <font-awesome-icon icon="fa-regular fa-hand-pointer" />
        <span>Mitarbeiter anklicken für mehr Details</span>
      </div>

      <template v-else>
        <!-- ─── PART 2: COMPACT PROFILE & STAMMDATEN (ZVOOVE-STYLE) ─── -->
        <section
          ref="profileSectionRef"
          class="staffing-part staffing-part--profile"
          :class="{ 'staffing-part--custom-height': Boolean(sectionHeights.profile) }"
          :style="sectionStyle('profile')"
          aria-label="Mitarbeiter-Kurzprofil"
        >
          <header class="zvoove-profile-banner">
            <div class="zvoove-profile-banner__title">
              <strong class="zvoove-profile-banner__name">
                {{ uppercaseLastFirst(activeMitarbeiter) }}
              </strong>
              <span class="zvoove-profile-banner__type">
                {{ employmentLongLabel(activeMitarbeiter) }}
              </span>
              <CustomTooltip
                v-if="getCustomerWishForOrder(activeMitarbeiter)"
                position="left"
                :delay-in="60"
              >
                <span
                  class="staffing-pill"
                  :class="`staffing-pill--kw-${getCustomerWishForOrder(activeMitarbeiter).typ}`"
                >
                  <font-awesome-icon
                    :icon="getCustomerWishForOrder(activeMitarbeiter).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                  />
                </span>
                <template #content>
                  <div class="row-dispo-tooltip">
                    <div
                      class="row-dispo-tooltip__kw"
                      :class="`row-dispo-tooltip__kw--${getCustomerWishForOrder(activeMitarbeiter).typ}`"
                    >
                      <div class="row-dispo-tooltip__kw-head">
                        <font-awesome-icon
                          :icon="getCustomerWishForOrder(activeMitarbeiter).typ === 'negativ' ? 'fa-solid fa-thumbs-down' : 'fa-solid fa-thumbs-up'"
                        />
                        <strong>
                          {{ getCustomerWishForOrder(activeMitarbeiter).typ === 'negativ' ? 'Negativer Kundenwunsch' : 'Positiver Kundenwunsch' }}
                        </strong>
                      </div>
                      <p>{{ getCustomerWishForOrder(activeMitarbeiter).message }}</p>
                      <p v-if="getCustomerWishForOrder(activeMitarbeiter).kommentar" class="row-dispo-tooltip__kw-comment">
                        „{{ getCustomerWishForOrder(activeMitarbeiter).kommentar }}“
                      </p>
                    </div>
                  </div>
                </template>
              </CustomTooltip>
            </div>
            <div class="zvoove-profile-banner__actions">
              <CustomTooltip text="Mitarbeiterkarte öffnen" position="left">
                <a
                  href="#"
                  class="zvoove-banner-btn"
                  :aria-label="`Mitarbeiterkarte für ${formatName(activeMitarbeiter)} öffnen`"
                  @click.prevent="emit('open-employee-card', activeMitarbeiter)"
                >
                  <font-awesome-icon icon="fa-solid fa-up-right-from-square" />
                </a>
              </CustomTooltip>
              <button
                type="button"
                class="zvoove-banner-btn"
                title="Details neu laden"
                aria-label="Mitarbeiterdetails neu laden"
                @click="reloadSelectedMitarbeiter"
              >
                <font-awesome-icon icon="fa-solid fa-rotate" :spin="detailLoading" />
              </button>
            </div>
          </header>

          <div class="zvoove-profile-body">
            <!-- Left: Profile Picture -->
            <div
              class="zvoove-profile-photo-wrap"
              :draggable="!isAlreadyAssigned(activeMitarbeiter)"
              :title="isAlreadyAssigned(activeMitarbeiter) ? 'Mitarbeiterkarte öffnen' : 'In eine Schicht ziehen oder klicken für Karte'"
              @dragstart="onMitarbeiterDragStart($event, activeMitarbeiter)"
              @click="emit('open-employee-card', activeMitarbeiter)"
            >
              <img
                v-if="selectedPhotoUrl"
                :src="selectedPhotoUrl"
                :alt="formatName(activeMitarbeiter)"
                class="zvoove-profile-photo"
              />
              <div v-else class="zvoove-profile-avatar">
                {{ initials(activeMitarbeiter) }}
              </div>
            </div>

            <!-- Middle: Mini 70-Days / Contingent Bar (like screenshot) -->
            <div v-if="shortTermSummary" class="zvoove-days-meter" :title="shortTermSummary.tooltip">
              <span class="zvoove-days-meter__top">{{ shortTermSummary.limit }}Tag(e)</span>
              <div class="zvoove-days-meter__bar">
                <div
                  class="zvoove-days-meter__fill"
                  :style="{ height: `${shortTermSummary.percent}%` }"
                />
              </div>
              <span class="zvoove-days-meter__bottom">{{ shortTermSummary.used }}|{{ shortTermSummary.planned }}Tag(e)</span>
            </div>

            <!-- Right: Contact & Info Rows -->
            <div class="zvoove-profile-info">
              <div class="zvoove-info-row">
                <span class="zvoove-info-icon-group">
                  <span class="zvoove-icon-box zvoove-icon-box--muted" title="Personalnummer">
                    <font-awesome-icon icon="fa-solid fa-hashtag" />
                  </span>
                </span>
                <span class="zvoove-info-value">
                  {{ activeMitarbeiter.personalnr || '—' }}
                </span>
              </div>

              <div class="zvoove-info-row">
                <span class="zvoove-info-icon-group">
                  <a
                    v-if="activeMitarbeiter.telefon"
                    :href="`tel:${activeMitarbeiter.telefon}`"
                    class="zvoove-icon-box"
                    title="Anrufen"
                  >
                    <font-awesome-icon icon="fa-solid fa-phone" />
                  </a>
                  <span v-else class="zvoove-icon-box zvoove-icon-box--muted">
                    <font-awesome-icon icon="fa-solid fa-phone" />
                  </span>
                </span>
                <span class="zvoove-info-value">
                  <a v-if="activeMitarbeiter.telefon" :href="`tel:${activeMitarbeiter.telefon}`">
                    {{ activeMitarbeiter.telefon }}
                  </a>
                  <template v-else>—</template>
                </span>
              </div>

              <div class="zvoove-info-row">
                <span class="zvoove-info-icon-group">
                  <a
                    v-if="activeMitarbeiter.email"
                    :href="`mailto:${activeMitarbeiter.email}`"
                    class="zvoove-icon-box"
                    title="E-Mail senden"
                  >
                    <font-awesome-icon icon="fa-regular fa-envelope" />
                  </a>
                  <span v-else class="zvoove-icon-box zvoove-icon-box--muted">
                    <font-awesome-icon icon="fa-regular fa-envelope" />
                  </span>
                </span>
                <span class="zvoove-info-value zvoove-info-value--truncate" :title="activeMitarbeiter.email || ''">
                  <button
                    v-if="activeMitarbeiter.email"
                    type="button"
                    class="zvoove-copy-inline"
                    @click="copyValue(activeMitarbeiter.email, 'email')"
                  >
                    {{ activeMitarbeiter.email }}
                  </button>
                  <template v-else>—</template>
                </span>
              </div>

              <div class="zvoove-info-row">
                <span class="zvoove-info-icon-group">
                  <span
                    class="zvoove-icon-box"
                    :class="{ 'zvoove-icon-box--muted': !fuehrerscheinClasses(activeMitarbeiter).length && !activeMitarbeiter.fuehrerschein?.hatAuto }"
                    title="Führerschein &amp; Auto"
                  >
                    <font-awesome-icon icon="fa-solid fa-car" />
                  </span>
                </span>
                <span class="zvoove-info-value zvoove-info-value--truncate" :title="fuehrerscheinSummary(activeMitarbeiter)">
                  {{ fuehrerscheinSummary(activeMitarbeiter) }}
                </span>
              </div>

              <div class="zvoove-info-row">
                <CustomTooltip position="left" :delay-in="80">
                  <button type="button" class="zvoove-skills-btn">
                    <font-awesome-icon icon="fa-solid fa-graduation-cap" />
                    <span>Berufe &amp; Quali</span>
                    <span
                      v-if="berufeItems(activeMitarbeiter).length + qualiItems(activeMitarbeiter).length"
                      class="zvoove-skills-btn__count"
                    >
                      {{ berufeItems(activeMitarbeiter).length + qualiItems(activeMitarbeiter).length }}
                    </span>
                  </button>
                  <template #content>
                    <div class="skills-tooltip">
                      <div class="skills-tooltip__section">
                        <div class="skills-tooltip__heading">
                          <font-awesome-icon icon="fa-solid fa-briefcase" />
                          <span>Berufe ({{ berufeItems(activeMitarbeiter).length }})</span>
                        </div>
                        <div v-if="berufeItems(activeMitarbeiter).length" class="skills-tooltip__chips">
                          <span
                            v-for="beruf in berufeItems(activeMitarbeiter)"
                            :key="beruf._id || beruf.jobKey || beruf.designation"
                            class="skills-tooltip__chip skills-tooltip__chip--beruf"
                          >
                            {{ beruf.designation }}
                          </span>
                        </div>
                        <span v-else class="skills-tooltip__empty">Keine Berufe hinterlegt</span>
                      </div>

                      <div class="skills-tooltip__section">
                        <div class="skills-tooltip__heading">
                          <font-awesome-icon icon="fa-solid fa-graduation-cap" />
                          <span>Qualifikationen ({{ qualiItems(activeMitarbeiter).length }})</span>
                        </div>
                        <div v-if="qualiItems(activeMitarbeiter).length" class="skills-tooltip__chips">
                          <span
                            v-for="quali in qualiItems(activeMitarbeiter)"
                            :key="quali._id || quali.qualificationKey || quali.designation"
                            class="skills-tooltip__chip skills-tooltip__chip--quali"
                          >
                            {{ quali.designation }}
                          </span>
                        </div>
                        <span v-else class="skills-tooltip__empty">Keine Qualifikationen hinterlegt</span>
                      </div>
                    </div>
                  </template>
                </CustomTooltip>
              </div>
            </div>
          </div>
          <div
            class="staffing-part__resizer"
            :class="{ 'is-resizing': resizingSection === 'profile' }"
            role="separator"
            aria-orientation="horizontal"
            title="Ziehen zum Ändern der Höhe · Doppelklick zum Zurücksetzen"
            @mousedown.prevent="startSectionResize($event, 'profile')"
            @dblclick="resetSectionHeight('profile')"
          />
        </section>

        <!-- ─── PART 3: HOVER DATA CARD (INLINE CONTINGENT) ─── -->
        <section
          ref="contingentSectionRef"
          class="staffing-part staffing-part--contingent"
          :class="{ 'staffing-part--custom-height': Boolean(sectionHeights.contingent) }"
          :style="sectionStyle('contingent')"
          aria-label="Arbeitszeit & Kontingent"
        >
          <div class="staffing-part__scroll-content">
            <HoverDataCard
              :data="selectedHoverData"
              :loading="selectedHoverLoading"
              inline
              popout
              @popout="openContingentModal"
            />
          </div>
          <div
            class="staffing-part__resizer"
            :class="{ 'is-resizing': resizingSection === 'contingent' }"
            role="separator"
            aria-orientation="horizontal"
            title="Ziehen zum Ändern der Höhe · Doppelklick zum Zurücksetzen"
            @mousedown.prevent="startSectionResize($event, 'contingent')"
            @dblclick="resetSectionHeight('contingent')"
          />
        </section>

        <!-- ─── PART 4: DISPO AVAILABILITY (DispoEintrag.js) ─── -->
        <section
          ref="dispoSectionRef"
          class="staffing-part staffing-part--dispo"
          :class="{ 'staffing-part--custom-height': Boolean(sectionHeights.dispo) }"
          :style="sectionStyle('dispo')"
          aria-label="Dispo-Verfügbarkeit"
        >
          <div class="staffing-part__scroll-content">
            <header class="dispo-part-header">
              <div class="dispo-part-header__title">
                <font-awesome-icon icon="fa-solid fa-calendar-check" />
                <span>Dispo-Verfügbarkeit</span>
              </div>
              <div class="dispo-part-header__controls" role="group" aria-label="Dispo-Woche wechseln">
                <button
                  type="button"
                  class="dispo-week-btn"
                  title="Vorherige Woche"
                  aria-label="Vorherige Woche"
                  :disabled="dispoLoading"
                  @click="shiftDispoWeek(-1)"
                >
                  <font-awesome-icon icon="fa-solid fa-chevron-left" />
                </button>
                <button
                  type="button"
                  class="dispo-part-header__range"
                  :class="{ 'is-offset': dispoWeekOffset !== 0 }"
                  :title="dispoWeekOffset !== 0 ? 'Zurück zur Ausgangswoche' : 'Aktuelle Woche'"
                  :disabled="dispoLoading || dispoWeekOffset === 0"
                  @click="resetDispoWeek"
                >
                  {{ dispoRangeLabel }}
                </button>
                <button
                  type="button"
                  class="dispo-week-btn"
                  title="Nächste Woche"
                  aria-label="Nächste Woche"
                  :disabled="dispoLoading"
                  @click="shiftDispoWeek(1)"
                >
                  <font-awesome-icon icon="fa-solid fa-chevron-right" />
                </button>
              </div>
            </header>

            <div v-if="dispoLoading" class="dispo-part-loading">
              <font-awesome-icon icon="fa-solid fa-spinner" spin />
              <span>Verfügbarkeit wird geladen…</span>
            </div>
            <div v-else class="dispo-days-grid">
              <CustomTooltip
                v-for="day in dispoDays"
                :key="day.iso"
                position="left"
                :disabled="!day.comments?.length && !day.detail"
                :delay-in="80"
              >
                <div
                  class="dispo-day-row"
                  :class="[
                    `dispo-day-row--${day.statusKey}`,
                    { 'dispo-day-row--order-day': day.isOrderDay },
                  ]"
                >
                  <div class="dispo-day-row__date">
                    <strong>{{ day.weekday }}</strong>
                    <span>{{ day.dateShort }}</span>
                  </div>
                  <div class="dispo-day-row__status">
                    <span class="dispo-status-badge" :class="`dispo-status-badge--${day.statusKey}`">
                      <font-awesome-icon v-if="day.icon" :icon="day.icon" />
                      <span>{{ day.label }}</span>
                    </span>
                    <span v-if="day.detail" class="dispo-day-row__detail" :title="day.detail">
                      {{ day.detail }}
                    </span>
                    <span v-if="day.comments?.length" class="dispo-day-row__comment-badge">
                      <font-awesome-icon icon="fa-regular fa-comment-dots" />
                      {{ day.comments[0].text }}
                    </span>
                  </div>
                </div>
                <template #content>
                  <div class="row-dispo-tooltip">
                    <div v-if="day.detail" class="row-dispo-tooltip__status">
                      <strong>{{ day.label }}:</strong> {{ day.detail }}
                    </div>
                    <div
                      v-for="(comment, cIdx) in day.comments || []"
                      :key="comment._id || `d-c-${cIdx}`"
                      class="row-dispo-tooltip__comment"
                    >
                      <div class="row-dispo-tooltip__comment-head">
                        <strong>{{ comment.author || 'Kommentar' }}</strong>
                        <span v-if="comment.timestamp || comment.createdAt">
                          {{ formatCommentTime(comment.timestamp || comment.createdAt) }}
                        </span>
                      </div>
                      <p>{{ comment.text }}</p>
                    </div>
                  </div>
                </template>
              </CustomTooltip>
              <p v-if="selectedDispoNotiz" class="dispo-part-notiz">
                <font-awesome-icon icon="fa-regular fa-note-sticky" />
                <span>{{ selectedDispoNotiz }}</span>
              </p>
            </div>
          </div>
          <div
            class="staffing-part__resizer"
            :class="{ 'is-resizing': resizingSection === 'dispo' }"
            role="separator"
            aria-orientation="horizontal"
            title="Ziehen zum Ändern der Höhe · Doppelklick zum Zurücksetzen"
            @mousedown.prevent="startSectionResize($event, 'dispo')"
            @dblclick="resetSectionHeight('dispo')"
          />
        </section>
      </template>

      <!-- ContextMenu for Employee Row Actions ("Alle" tab) -->
      <ContextMenu
        v-if="employeeRowMenu.open && employeeRowMenu.ma"
        :x="employeeRowMenu.x"
        :y="employeeRowMenu.y"
        :width="220"
        :title="formatName(employeeRowMenu.ma)"
        :options="employeeRowMenuOptions"
        @close="closeEmployeeRowMenu"
        @select="handleEmployeeRowMenuAction"
      />

      <!-- ContextMenu for Bewerbung Actions (Accept / Deny) -->
      <ContextMenu
        v-if="bewerbungMenu.open && bewerbungMenu.item"
        :x="bewerbungMenu.x"
        :y="bewerbungMenu.y"
        :width="220"
        :title="formatName(bewerbungMenu.item.mitarbeiter)"
        :options="bewerbungMenuOptions"
        @close="closeBewerbungMenu"
        @select="handleBewerbungMenuAction"
      />

      <SchichtDropWarningDialog
        :model-value="Boolean(pendingBewerbungDecision)"
        :step="pendingBewerbungDecision?.step || null"
        :busy="Boolean(decidingBewerbungId)"
        @cancel="pendingBewerbungDecision = null"
        @decide="onBewerbungNotifyDecide"
      />
    </aside>
  </Transition>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faAddressCard,
  faAnglesLeft,
  faAnglesRight,
  faArrowDownWideShort,
  faArrowUpWideShort,
  faBell,
  faBriefcase,
  faBriefcaseMedical,
  faCalendarCheck,
  faCar,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCircleHalfStroke,
  faClipboardList,
  faEllipsisVertical,
  faGraduationCap,
  faGripVertical,
  faHashtag,
  faInbox,
  faMagnifyingGlass,
  faPhone,
  faRotate,
  faRotateRight,
  faSpinner,
  faTableColumns,
  faThumbsDown,
  faThumbsUp,
  faTrash,
  faUmbrellaBeach,
  faUpRightFromSquare,
  faUserClock,
  faUserPlus,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  faCommentDots,
  faEnvelope,
  faHandPointer,
  faNoteSticky,
} from '@fortawesome/free-regular-svg-icons';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import { useFlipAll } from '@/stores/flipAll';
import { useMitarbeiterNameFormatter } from '@/utils/mitarbeiterName';
import { attachMitarbeiterDragPreview } from '@/utils/mitarbeiterDragPreview';
import { useEmployeeContingents } from '@/composables/useEmployeeContingents';
import { useEmployeeContingentModals } from '@/composables/useEmployeeContingentModals';
import { personGroupForMonth, currentPayrollMonth } from '@/utils/employeePayrollMasterData';
import { buildEventSchichten } from '@/utils/eventSchichten';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import TlBadge from '@/components/ui-elements/TlBadge.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import HoverDataCard from '@/components/ui-elements/HoverDataCard.vue';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import SortMenu from '@/components/ui-elements/SortMenu.vue';
import SchichtDropWarningDialog from '@/components/orders/dialogs/SchichtDropWarningDialog.vue';

library.add(
  faAddressCard,
  faAnglesLeft,
  faAnglesRight,
  faArrowDownWideShort,
  faArrowUpWideShort,
  faBell,
  faBriefcase,
  faBriefcaseMedical,
  faCalendarCheck,
  faCar,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faCircleHalfStroke,
  faClipboardList,
  faCommentDots,
  faEllipsisVertical,
  faEnvelope,
  faGraduationCap,
  faGripVertical,
  faHandPointer,
  faHashtag,
  faInbox,
  faMagnifyingGlass,
  faNoteSticky,
  faPhone,
  faRotate,
  faRotateRight,
  faSpinner,
  faTableColumns,
  faThumbsDown,
  faThumbsUp,
  faTrash,
  faUmbrellaBeach,
  faUpRightFromSquare,
  faUserClock,
  faUserPlus,
  faUsers,
  faXmark,
);

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  event: { type: Object, default: null },
  shifts: { type: Array, default: () => [] },
  externalSelectedMitarbeiter: { type: Object, default: null },
  defaultLocationId: { type: [String, Number], default: null },
  draggingAssignedEinsatz: { type: Object, default: null },
});

const emit = defineEmits([
  'open-employee-card',
  'open-order',
  'bewerbung-updated',
  'select-mitarbeiter',
  'unassign-einsatz',
  'minimize',
]);

const router = useRouter();
const auth = useAuth();
const dataCache = useDataCache();
const flip = useFlipAll();
const { formatName } = useMitarbeiterNameFormatter();
const employeeContingents = useEmployeeContingents();
const { openEmployeeContingent } = useEmployeeContingentModals();

const STAFFING_SEARCH_FILTERS_KEY = 'auftraege.staffingEmployeeSearchFilters';

function loadSavedEmployeeSearchFilters() {
  try {
    const raw = localStorage.getItem(STAFFING_SEARCH_FILTERS_KEY);
    if (raw === null) return { hasSaved: false, filters: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (item) => item && typeof item === 'object' && item.category && item.value != null
      );
      return { hasSaved: true, filters: valid };
    }
  } catch {
    // ignore storage errors
  }
  return { hasSaved: false, filters: [] };
}

function saveEmployeeSearchFilters(filters) {
  try {
    localStorage.setItem(STAFFING_SEARCH_FILTERS_KEY, JSON.stringify(filters || []));
  } catch {
    // ignore storage errors
  }
}

const initialSearchFiltersState = loadSavedEmployeeSearchFilters();
const hasSavedEmployeeSearchFilters = ref(initialSearchFiltersState.hasSaved);

const activeTab = ref('all');
const searchQuery = ref('');
const searchSelectedEmployeeId = ref(null);
const searchSelectedEmployee = ref(null);
const employeeSearchFilters = ref(initialSearchFiltersState.filters);
const mitarbeitersSortBy = ref('nachname');
const mitarbeitersIsAscending = ref(true);
const onlyAvailableOnOrderDay = ref(false);
const availableEmployeeIdsOnOrderDay = ref(new Set());
const orderDayDispoMap = ref({});
const availableDayLoading = ref(false);
let availableDayRequestSeq = 0;
const mitarbeiterSortOptions = [
  { value: 'vorname', label: 'Vorname' },
  { value: 'nachname', label: 'Nachname' },
  { value: 'standort', label: 'Standort' },
  { value: 'abteilung', label: 'Bereich' },
  { value: 'einsatzCount', label: 'Jobs (Einsätze)' },
  { value: 'createdAt', label: 'Zuletzt erstellt' },
  { value: 'eintrittsdatum', label: 'Eintrittsdatum' },
  { value: 'austrittsdatum', label: 'Austrittsdatum' },
];
const bewerbungStatusFilter = ref('all');

const backendMitarbeiter = ref([]);
const mitarbeiterLoading = ref(false);
let mitarbeiterSearchTimer = null;
let mitarbeiterRequestSeq = 0;
const bewerbungen = ref([]);
const bewerbungenLoading = ref(false);
const decidingBewerbungId = ref('');
const pendingBewerbungDecision = ref(null);

const selectedMaBasic = ref(null);
const selectedMaFull = ref(null);
const detailLoading = ref(false);
const selectedPhotoUrl = ref('');
const copiedField = ref('');
let copiedTimer = null;
let detailRequestSeq = 0;

const dispoEntries = ref([]);
const dispoComments = ref([]);
const dispoLoading = ref(false);
const dispoWeekOffset = ref(0);
const selectedDispoNotiz = ref('');
const unassignDragOver = ref(false);

watch(
  () => props.draggingAssignedEinsatz,
  (val) => {
    if (!val) unassignDragOver.value = false;
  }
);

function hasAssignedEinsatzDrag(event) {
  if (props.draggingAssignedEinsatz) return true;
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes('application/x-straight-monitor-schicht-einsatz');
}

function onUnassignDragEnter(event) {
  if (!hasAssignedEinsatzDrag(event)) return;
  unassignDragOver.value = true;
}

function onUnassignDragOver(event) {
  if (!hasAssignedEinsatzDrag(event)) return;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  unassignDragOver.value = true;
}

function onUnassignDragLeave(event) {
  if (event.currentTarget?.contains(event.relatedTarget)) return;
  unassignDragOver.value = false;
}

function onUnassignDrop(event) {
  unassignDragOver.value = false;
  let payload = props.draggingAssignedEinsatz;
  if (!payload && event.dataTransfer) {
    const raw =
      event.dataTransfer.getData('application/x-straight-monitor-schicht-einsatz') ||
      event.dataTransfer.getData('application/x-straight-monitor-mitarbeiter') ||
      event.dataTransfer.getData('application/json');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.sourceEinsatzId) payload = parsed;
      } catch {
        // ignore parse errors
      }
    }
  }
  if (!payload?.sourceEinsatzId && !payload?.einsatzId) return;
  emit('unassign-einsatz', payload);
}

// ─── Resizable Panel Width ───
const PANEL_WIDTH_KEY = 'auftraege.staffingPanelWidth';
const PANEL_WIDTH_LIMITS = { min: 280, max: 680, default: null };
const panelEl = ref(null);
const isResizingPanelWidth = ref(false);
let widthResizeStartX = 0;
let widthResizeStartW = 0;

function loadSavedPanelWidth() {
  try {
    const val = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (Number.isFinite(val) && val >= PANEL_WIDTH_LIMITS.min && val <= PANEL_WIDTH_LIMITS.max) {
      return val;
    }
  } catch {
    // ignore storage errors
  }
  return PANEL_WIDTH_LIMITS.default;
}

const panelWidth = ref(loadSavedPanelWidth());

const panelWidthStyle = computed(() => {
  if (!panelWidth.value) return undefined;
  return {
    '--admin-sp-width': `${panelWidth.value}px`,
  };
});

function startPanelWidthResize(event) {
  if (!panelEl.value) return;
  isResizingPanelWidth.value = true;
  widthResizeStartX = event.clientX;
  widthResizeStartW = panelEl.value.getBoundingClientRect().width;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onPanelWidthResizeMove);
  window.addEventListener('mouseup', stopPanelWidthResize);
}

function onPanelWidthResizeMove(event) {
  if (!isResizingPanelWidth.value) return;
  const delta = widthResizeStartX - event.clientX;
  const nextW = Math.round(widthResizeStartW + delta);
  panelWidth.value = Math.max(PANEL_WIDTH_LIMITS.min, Math.min(PANEL_WIDTH_LIMITS.max, nextW));
}

function stopPanelWidthResize() {
  if (!isResizingPanelWidth.value) return;
  isResizingPanelWidth.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onPanelWidthResizeMove);
  window.removeEventListener('mouseup', stopPanelWidthResize);
  if (panelWidth.value) {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth.value));
    } catch {
      // ignore storage errors
    }
  }
}

function resetPanelWidth() {
  panelWidth.value = null;
  try {
    localStorage.removeItem(PANEL_WIDTH_KEY);
  } catch {
    // ignore storage errors
  }
}

// ─── Resizable Section Heights ───
const SECTION_HEIGHTS_KEY = 'auftraege.staffingSectionHeights';
const SECTION_LIMITS = {
  list: { min: 130, max: 700, default: 260 },
  profile: { min: 95, max: 450, default: null },
  contingent: { min: 110, max: 900, default: null },
  dispo: { min: 100, max: 600, default: null },
};

const listSectionRef = ref(null);
const profileSectionRef = ref(null);
const contingentSectionRef = ref(null);
const dispoSectionRef = ref(null);

function loadSavedSectionHeights() {
  const defaults = {
    list: SECTION_LIMITS.list.default,
    profile: SECTION_LIMITS.profile.default,
    contingent: SECTION_LIMITS.contingent.default,
    dispo: SECTION_LIMITS.dispo.default,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(SECTION_HEIGHTS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      for (const key of Object.keys(defaults)) {
        if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
          const { min, max } = SECTION_LIMITS[key];
          defaults[key] = Math.max(min, Math.min(max, raw[key]));
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return defaults;
}

const sectionHeights = reactive(loadSavedSectionHeights());
const resizingSection = ref(null);
let resizeStartY = 0;
let resizeStartH = 0;

function saveSectionHeights() {
  try {
    localStorage.setItem(SECTION_HEIGHTS_KEY, JSON.stringify({ ...sectionHeights }));
  } catch {
    // ignore storage errors
  }
}

function getSectionElement(key) {
  if (key === 'list') return listSectionRef.value;
  if (key === 'profile') return profileSectionRef.value;
  if (key === 'contingent') return contingentSectionRef.value;
  if (key === 'dispo') return dispoSectionRef.value;
  return null;
}

function sectionStyle(key) {
  const h = sectionHeights[key];
  if (!h) return undefined;
  return {
    height: `${h}px`,
    flex: `0 0 ${h}px`,
    maxHeight: `${h}px`,
  };
}

function startSectionResize(event, key) {
  const el = getSectionElement(key);
  if (!el) return;
  resizingSection.value = key;
  resizeStartY = event.clientY;
  resizeStartH = el.getBoundingClientRect().height;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onSectionResizeMove);
  window.addEventListener('mouseup', stopSectionResize);
}

function onSectionResizeMove(event) {
  const key = resizingSection.value;
  if (!key) return;
  const limits = SECTION_LIMITS[key];
  if (!limits) return;
  const nextHeight = Math.round(resizeStartH + (event.clientY - resizeStartY));
  sectionHeights[key] = Math.max(limits.min, Math.min(limits.max, nextHeight));
}

function stopSectionResize() {
  if (!resizingSection.value) return;
  resizingSection.value = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onSectionResizeMove);
  window.removeEventListener('mouseup', stopSectionResize);
  saveSectionHeights();
}

function resetSectionHeight(key) {
  if (!SECTION_LIMITS[key]) return;
  sectionHeights[key] = SECTION_LIMITS[key].default;
  saveSectionHeights();
}

onBeforeUnmount(() => {
  stopPanelWidthResize();
  stopSectionResize();
});

const bewerbungMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  item: null,
  shifts: [],
});

const employeeRowMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  ma: null,
});

const orderLocationId = computed(() => {
  const loc = props.event?.locationV2 || props.defaultLocationId || auth.user?.locationV2;
  return loc ? String(typeof loc === 'object' ? loc._id : loc) : null;
});

function syncDefaultLocationFilter(locationId = orderLocationId.value) {
  if (!locationId || hasSavedEmployeeSearchFilters.value) return;
  const filtersWithoutLocation = employeeSearchFilters.value.filter(
    (filter) => filter.category !== 'standorte'
  );
  employeeSearchFilters.value = [
    { category: 'standorte', value: String(locationId) },
    ...filtersWithoutLocation,
  ];
}

const assignedPersonalNrs = computed(() => {
  const set = new Set();
  for (const einsatz of props.event?.einsaetze || []) {
    if (einsatz.personalNr != null) set.add(String(einsatz.personalNr));
  }
  return set;
});

const assignedMitarbeiterIds = computed(() => {
  const set = new Set();
  for (const einsatz of props.event?.einsaetze || []) {
    if (einsatz.mitarbeiterData?._id) set.add(String(einsatz.mitarbeiterData._id));
  }
  return set;
});

function isMatchingOrderLocation(ma) {
  if (!orderLocationId.value || !ma) return false;
  const maLocId = String(typeof ma.locationV2 === 'object' ? ma.locationV2?._id : ma.locationV2 || '');
  return Boolean(maLocId && maLocId === orderLocationId.value);
}

const allMitarbeiter = computed(() => {
  const source = backendMitarbeiter.value.length
    ? backendMitarbeiter.value
    : (dataCache.mitarbeiter || []).filter((ma) => ma && ma.isActive === true);
  return source
    .filter((ma) => ma && ma.isActive === true)
    .map((ma) => dataCache.populateMitarbeiterSkills(ma));
});

const filteredAllMitarbeiter = computed(() => {
  let list = allMitarbeiter.value;

  if (searchSelectedEmployeeId.value) {
    list = list.filter((ma) => String(ma._id) === String(searchSelectedEmployeeId.value));
  }

  if (onlyAvailableOnOrderDay.value && props.event?.vonDatum) {
    list = list.filter((ma) => availableEmployeeIdsOnOrderDay.value.has(String(ma._id)));
  }

  if (employeeSearchFilters.value.length > 0) {
    const values = (category) => employeeSearchFilters.value
      .filter((filter) => filter.category === category)
      .map((filter) => String(filter.value));
    const standorte = values('standorte');
    const bewerber = values('bewerber')[0];
    const berufe = values('berufe');
    const arbeitsverhaeltnisse = values('arbeitsverhaeltnisse');
    const persgruppen = values('persgruppen');
    const qualifikationen = values('qualifikationen');
    const payrollMonth = currentPayrollMonth();

    if (standorte.length) {
      list = list.filter((ma) => standorte.includes(String(ma.locationV2?._id || ma.locationV2 || '')));
    }
    if (bewerber === 'true' || bewerber === 'false') {
      list = list.filter((ma) => String(Boolean(ma.isBewerberstatus)) === bewerber);
    }
    if (berufe.length) {
      list = list.filter((ma) => (ma.berufe || []).some((item) => berufe.includes(String(item._id || item))));
    }
    if (arbeitsverhaeltnisse.length) {
      list = list.filter((ma) => arbeitsverhaeltnisse.includes(String(ma.arbeitsverhaeltnis?.typ)));
    }
    if (persgruppen.length) {
      list = list.filter((ma) => persgruppen.includes(String(personGroupForMonth(ma, payrollMonth) ?? ma.persgruppe ?? '')));
    }
    if (qualifikationen.length) {
      list = list.filter((ma) => (ma.qualifikationen || []).some((item) => qualifikationen.includes(String(item._id || item))));
    }
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    const textFiltered = list.filter((ma) => {
      const berufeText = (ma.berufe || []).map((b) => b?.designation || '').join(' ');
      const qualiText = (ma.qualifikationen || []).map((k) => k?.designation || '').join(' ');
      const haystack = [
        ma.vorname,
        ma.nachname,
        ma.personalnr,
        ma.email,
        berufeText,
        qualiText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    // If typing a filter keyword in MitarbeiterSearch before selecting the pill, keep list visible if no name matches
    if (textFiltered.length > 0 || !employeeSearchFilters.value.length) {
      list = textFiltered;
    }
  }

  const key = mitarbeitersSortBy.value;
  const asc = mitarbeitersIsAscending.value;

  return [...list].sort((a, b) => {
    if (key !== 'standort') {
      const aLocMatch = isMatchingOrderLocation(a) ? 1 : 0;
      const bLocMatch = isMatchingOrderLocation(b) ? 1 : 0;
      if (aLocMatch !== bLocMatch) return bLocMatch - aLocMatch;
    }

    let av;
    let bv;
    if (key === 'createdAt' || key === 'eintrittsdatum' || key === 'austrittsdatum') {
      const rawA = key === 'createdAt' ? (a?.createdAt || a?.dateCreated) : a?.[key];
      const rawB = key === 'createdAt' ? (b?.createdAt || b?.dateCreated) : b?.[key];
      av = rawA ? new Date(rawA).getTime() : 0;
      bv = rawB ? new Date(rawB).getTime() : 0;
    } else if (key === 'einsatzCount') {
      av = a?.einsatzCount ?? -1;
      bv = b?.einsatzCount ?? -1;
    } else if (key === 'standort') {
      av = locationShortName(a).toLowerCase();
      bv = locationShortName(b).toLowerCase();
    } else if (key === 'abteilung') {
      av = primarySkillLabel(a).toLowerCase();
      bv = primarySkillLabel(b).toLowerCase();
    } else {
      av = String(a?.[key] ?? '').toLowerCase();
      bv = String(b?.[key] ?? '').toLowerCase();
    }

    if (av < bv) return asc ? -1 : 1;
    if (av > bv) return asc ? 1 : -1;
    const aName = `${a.nachname || ''} ${a.vorname || ''}`.toLowerCase();
    const bName = `${b.nachname || ''} ${b.vorname || ''}`.toLowerCase();
    return aName.localeCompare(bName, 'de');
  });
});

const displayedAllMitarbeiter = computed(() => filteredAllMitarbeiter.value.slice(0, 120));

const openBewerbungenCount = computed(() =>
  bewerbungen.value.filter((b) => b.status === 'submitted').length
);

const bewerbungStateOptions = computed(() => {
  const list = bewerbungen.value;
  return [
    { value: 'all', label: 'Alle', count: list.length },
    { value: 'submitted', label: 'Offen', count: list.filter((b) => b.status === 'submitted').length },
    { value: 'scheduled', label: 'Eingeplant', count: list.filter((b) => b.status === 'scheduled').length },
    { value: 'confirmed', label: 'Bestätigt', count: list.filter((b) => b.status === 'confirmed').length },
    { value: 'rejected', label: 'Abgesagt', count: list.filter((b) => b.status === 'rejected').length },
  ];
});

const filteredBewerbungen = computed(() => {
  if (bewerbungStatusFilter.value === 'all') return bewerbungen.value;
  return bewerbungen.value.filter((b) => b.status === bewerbungStatusFilter.value);
});

const selectedMaId = computed(() =>
  String(selectedMaFull.value?._id || selectedMaBasic.value?._id || '')
);

const activeMitarbeiter = computed(() => selectedMaFull.value || selectedMaBasic.value || null);

const contingentPeriod = computed(() => {
  const baseDate = props.event?.vonDatum ? new Date(props.event.vonDatum) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth() + 1,
  };
});

const selectedHoverData = computed(() => {
  if (!activeMitarbeiter.value?._id) return null;
  return employeeContingents.dataFor(activeMitarbeiter.value, contingentPeriod.value);
});

const selectedHoverLoading = computed(() => {
  if (!activeMitarbeiter.value?._id) return false;
  return employeeContingents.isLoading(activeMitarbeiter.value, contingentPeriod.value);
});

const shortTermSummary = computed(() => {
  const data = selectedHoverData.value;
  if (!data) return null;
  const shortTermPanel = data.type === 'short-term-days'
    ? data
    : (data.panels || []).find((p) => p.type === 'short-term-days');
  if (!shortTermPanel) return null;
  const limit = Number(shortTermPanel.dayLimit || 70);
  const worked = Number(shortTermPanel.workedDays || 0) + Number(shortTermPanel.previousEmployerDays || 0);
  const planned = Number(shortTermPanel.plannedDays || 0);
  const total = worked + planned;
  const percent = Math.min(100, Math.max(4, Math.round((total / (limit || 70)) * 100)));
  return {
    limit,
    used: worked,
    planned,
    percent,
    tooltip: `Kurzfristige Beschäftigung: ${worked} gearbeitet, ${planned} geplant von ${limit} Tagen`,
  };
});

const dispoWindow = computed(() => {
  const rawStart = props.event?.vonDatum ? new Date(props.event.vonDatum) : new Date();
  const base = Number.isNaN(rawStart.getTime()) ? new Date() : new Date(rawStart);
  base.setHours(0, 0, 0, 0);
  const dayOfWeek = base.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(base);
  start.setDate(base.getDate() + diffToMonday + dispoWeekOffset.value * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
});

function shiftDispoWeek(delta) {
  dispoWeekOffset.value += delta;
  if (activeMitarbeiter.value?._id) {
    const reqId = ++detailRequestSeq;
    void loadDispoForMitarbeiter(String(activeMitarbeiter.value._id), reqId);
  }
}

function resetDispoWeek() {
  if (dispoWeekOffset.value === 0) return;
  dispoWeekOffset.value = 0;
  if (activeMitarbeiter.value?._id) {
    const reqId = ++detailRequestSeq;
    void loadDispoForMitarbeiter(String(activeMitarbeiter.value._id), reqId);
  }
}

const dispoRangeLabel = computed(() => {
  const { start, end } = dispoWindow.value;
  const fmt = (d) => d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
});

const dispoDays = computed(() => {
  const { start } = dispoWindow.value;
  const orderStart = props.event?.vonDatum ? toIsoDate(props.event.vonDatum) : null;
  const orderEnd = props.event?.bisDatum ? toIsoDate(props.event.bisDatum) : orderStart;
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = toIsoDate(d);
    const isOrderDay = Boolean(orderStart && orderEnd && iso >= orderStart && iso <= orderEnd);
    const dayEntries = dispoEntries.value.filter((entry) => {
      const eStart = toIsoDate(entry.datumVon);
      const eEnd = toIsoDate(entry.datumBis || entry.datumVon);
      return eStart && eEnd && iso >= eStart && iso <= eEnd;
    });
    const dayComments = dispoComments.value.filter(
      (c) => String(c?.context?.datum || '') === iso && c?.text
    );

    const resolved = resolveDayDispoStatus(dayEntries);
    days.push({
      iso,
      weekday: d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' }).replace('.', ''),
      dateShort: d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' }),
      isOrderDay,
      comments: dayComments,
      ...resolved,
    });
  }
  return days;
});

function openMitarbeiterInDispo(ma) {
  if (!ma?._id) return;
  const query = { maId: String(ma._id), showHidden: '1' };
  const locationV2 = ma?.locationV2?._id || ma?.locationV2;
  if (locationV2) query.locationV2 = String(locationV2);
  router.push({ path: '/dispo', query });
}

const employeeRowMenuOptions = computed(() => {
  const ma = employeeRowMenu.ma;
  if (!ma) return [];
  return [
    {
      label: 'Mitarbeiterkarte öffnen',
      action: 'open-card',
      icon: 'fa-solid fa-address-card',
      variant: 'primary',
    },
    ...(ma?.isActive !== false
      ? [{ label: 'In Dispo öffnen', action: 'open-dispo', icon: ['fas', 'table-columns'] }]
      : []),
  ];
});

function openEmployeeRowMenu(event, ma) {
  closeBewerbungMenu();
  const isContextMenu = event?.type === 'contextmenu';
  const rect = !isContextMenu ? event?.currentTarget?.getBoundingClientRect() : null;
  employeeRowMenu.ma = ma;
  employeeRowMenu.x = rect ? rect.right - 220 : event.clientX;
  employeeRowMenu.y = rect ? rect.bottom + 4 : event.clientY;
  employeeRowMenu.open = true;
}

function closeEmployeeRowMenu() {
  employeeRowMenu.open = false;
  employeeRowMenu.ma = null;
}

function handleEmployeeRowMenuAction(action) {
  const ma = employeeRowMenu.ma;
  closeEmployeeRowMenu();
  if (!ma || !action) return;
  if (action === 'open-card') {
    emit('open-employee-card', ma);
  } else if (action === 'open-dispo') {
    openMitarbeiterInDispo(ma);
  }
}

function isAppliedShiftForBewerbung(bew, shift) {
  if (!bew || !shift) return false;
  const bewSchichtId = String(bew.schicht?._id || bew.schicht || bew.jobId || '').trim();
  const shiftId = String(shift.meta?.schichtId || shift.meta?._id || '').trim();
  if (bewSchichtId && shiftId && bewSchichtId === shiftId) return true;
  const bewLegacyId = bew.idAuftragArbeitsschichten ?? bew.schicht?.idAuftragArbeitsschichten;
  const shiftLegacyId = shift.meta?.idAuftragArbeitsschichten;
  if (bewLegacyId != null && shiftLegacyId != null && Number(bewLegacyId) === Number(shiftLegacyId)) {
    return true;
  }
  return false;
}

const bewerbungMenuOptions = computed(() => {
  const bew = bewerbungMenu.item;
  if (!bew) return [];

  const availableShifts =
    Number(props.event?.auftragNr) === Number(bew.auftragNr) && (props.shifts || []).length
      ? props.shifts
      : bewerbungMenu.shifts || [];

  const buildShiftChildren = (actionPrefix, icon) =>
    availableShifts.length > 0
      ? availableShifts.map((s) => {
          const regularCount = Array.isArray(s.einsaetze)
            ? s.einsaetze.filter((e) => !e.isReserve).length
            : Number(s.meta?.regularCount ?? s.meta?.besetzt ?? 0);
          const reserveCount = Array.isArray(s.einsaetze)
            ? s.einsaetze.filter((e) => Boolean(e.isReserve)).length
            : Number(s.meta?.reserveCount ?? 0);
          const bedarf = s.meta?.bedarf;
          const coverageBadge =
            reserveCount > 0
              ? `${regularCount} (+${reserveCount}) /${bedarf ?? '?'}`
              : `${regularCount}/${bedarf ?? '?'}`;
          const isMet = bedarf != null && Number(bedarf) > 0 && regularCount >= Number(bedarf);
          const isApplied = isAppliedShiftForBewerbung(bew, s);
          return {
            label: `${s.meta?.schichtBezeichnung || 'Schicht'}${s.meta?.uhrzeitVon ? ` (${formatShortTime(s.meta.uhrzeitVon)})` : ''}`,
            action: `${actionPrefix}:${s.meta?.schichtId || s.meta?.idAuftragArbeitsschichten || s.key}`,
            icon,
            highlighted: isApplied,
            badge: coverageBadge,
            badgeVariant: isMet ? 'met' : 'open',
          };
        })
      : null;

  const acceptChildren = buildShiftChildren('accept', 'fa-solid fa-user-plus');
  const reserveChildren = buildShiftChildren('reserve', 'fa-solid fa-user-clock');

  return [
    {
      label: 'Annehmen & Einplanen',
      action: 'accept',
      icon: 'fa-solid fa-check',
      variant: 'primary',
      disabled: bew.status === 'confirmed' && !bew.isReserve,
      ...(acceptChildren ? { children: acceptChildren } : {}),
    },
    {
      label: 'Als Reserve einplanen',
      action: 'reserve',
      icon: 'fa-solid fa-user-clock',
      disabled: bew.status === 'confirmed' && Boolean(bew.isReserve),
      ...(reserveChildren ? { children: reserveChildren } : {}),
    },
    {
      label: 'Bewerbung ablehnen',
      action: 'deny',
      icon: 'fa-solid fa-xmark',
      variant: 'danger',
      disabled: bew.status === 'rejected',
    },
    {
      label: 'Löschen',
      action: 'delete',
      icon: 'fa-solid fa-xmark',
      variant: 'danger',
    },
    { type: 'divider' },
    {
      label: 'Job öffnen',
      action: 'open-job',
      icon: 'fa-solid fa-briefcase',
      disabled: !bew.auftragNr && !props.event?.auftragNr,
    },
    {
      label: 'Mitarbeiterkarte öffnen',
      action: 'open-card',
      icon: 'fa-solid fa-address-card',
    },
    ...(bew.mitarbeiter?.isActive !== false
      ? [{ label: 'In Dispo öffnen', action: 'open-dispo', icon: ['fas', 'table-columns'] }]
      : []),
  ];
});

function toIsoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
}

function resolveDayDispoStatus(entries) {
  if (!entries.length) {
    return {
      statusKey: 'empty',
      label: 'Keine Angabe',
      icon: null,
      detail: '',
    };
  }

  const planned = entries.find((e) => e.typ === 'planned' || e.verfuegbarkeit === 'eingeplant');
  if (planned) {
    const time = [formatShortTime(planned.uhrzeitVon || planned.zeitVon), formatShortTime(planned.uhrzeitBis || planned.zeitBis)]
      .filter(Boolean)
      .join('–');
    const title = planned.kuerzel || planned.kundeKuerzel || planned.bezeichnung || planned.schichtBezeichnung || (planned.auftragNr ? `#${planned.auftragNr}` : '');
    return {
      statusKey: 'planned',
      label: 'Eingeplant',
      icon: 'fa-solid fa-clipboard-list',
      detail: [title, time].filter(Boolean).join(' · '),
    };
  }

  const absence = entries.find((e) => e.typ === 'abwesenheit');
  if (absence) {
    const map = {
      urlaub: { label: 'Urlaub', icon: 'fa-solid fa-umbrella-beach', statusKey: 'urlaub' },
      krank: { label: 'Krank', icon: 'fa-solid fa-briefcase-medical', statusKey: 'krank' },
      feiertag: { label: 'Feiertag', icon: 'fa-solid fa-calendar-check', statusKey: 'neutral' },
      ueberstunden: { label: 'Überstunden', icon: 'fa-solid fa-calendar-check', statusKey: 'neutral' },
    };
    const info = map[absence.abwesenheitsKategorie] || { label: 'Abwesend', icon: 'fa-solid fa-xmark', statusKey: 'blocked' };
    return {
      ...info,
      detail: absence.text || '',
    };
  }

  const verf = entries.find((e) => e.typ === 'verfuegbarkeit');
  if (verf) {
    const time = [formatShortTime(verf.zeitVon), formatShortTime(verf.zeitBis)].filter(Boolean).join('–');
    const map = {
      available: { label: 'Verfügbar', icon: 'fa-solid fa-check', statusKey: 'available' },
      partially: { label: 'Eingeschränkt', icon: 'fa-solid fa-circle-half-stroke', statusKey: 'partially' },
      blocked: { label: 'Blocked', icon: 'fa-solid fa-xmark', statusKey: 'blocked' },
      angefragt_tel: { label: 'Angefragt (Tel)', icon: 'fa-solid fa-phone', statusKey: 'angefragt' },
      angefragt_flip: { label: 'Angefragt (Flip)', icon: 'fa-solid fa-inbox', statusKey: 'angefragt' },
    };
    const info = map[verf.verfuegbarkeit] || { label: verf.verfuegbarkeit || 'Verfügbarkeit', icon: null, statusKey: 'neutral' };
    return {
      ...info,
      detail: [time, verf.text].filter(Boolean).join(' · '),
    };
  }

  const note = entries.find((e) => e.text);
  return {
    statusKey: 'neutral',
    label: 'Hinweis',
    icon: null,
    detail: note?.text || '',
  };
}

function isAlreadyAssigned(ma) {
  if (!ma) return false;
  if (ma._id && assignedMitarbeiterIds.value.has(String(ma._id))) return true;
  if (ma.personalnr && assignedPersonalNrs.value.has(String(ma.personalnr))) return true;
  return false;
}

function isTeamleiter(ma) {
  if (!ma?.qualifikationen?.length) return false;
  return ma.qualifikationen.some((q) => parseInt(String(q?.qualificationKey || q), 10) === 50055);
}

function employmentShortLabel(ma) {
  const pg = personGroupForMonth(ma, currentPayrollMonth()) ?? ma?.persgruppe;
  const pgMap = { 101: 'Fest', 106: 'Werkstud.', 109: 'Minijob', 110: 'Kurzfr.' };
  if (pg && pgMap[pg]) return pgMap[pg];
  const typ = ma?.arbeitsverhaeltnis?.typ;
  const typMap = { 0: 'Vollzeit', 1: 'Teilzeit', 2: 'Minijob', 3: 'Kurzfr.' };
  return typ != null ? typMap[typ] || '' : '';
}

function employmentLongLabel(ma) {
  const pg = personGroupForMonth(ma, currentPayrollMonth()) ?? ma?.persgruppe;
  const pgMap = {
    101: 'FESTANGESTELLT',
    106: 'WERKSTUDENT',
    109: 'GERINGFÜGIG BESCHÄFTIGT',
    110: 'KURZFRISTIG BESCHÄFTIGT',
  };
  if (pg && pgMap[pg]) return pgMap[pg];
  const typ = ma?.arbeitsverhaeltnis?.typ;
  const typMap = {
    0: 'VOLLZEIT',
    1: 'TEILZEIT',
    2: 'GERINGFÜGIG BESCHÄFTIGT',
    3: 'KURZFRISTIG BESCHÄFTIGT',
  };
  return typ != null ? typMap[typ] || 'MITARBEITER' : 'MITARBEITER';
}

function uppercaseLastFirst(ma) {
  if (!ma) return '';
  const nach = String(ma.nachname || '').trim().toUpperCase();
  const vor = String(ma.vorname || '').trim().toUpperCase();
  return [nach, vor].filter(Boolean).join(', ');
}

function initials(ma) {
  const vor = String(ma?.vorname || '').trim()[0] || '';
  const nach = String(ma?.nachname || '').trim()[0] || '';
  return `${vor}${nach}`.toUpperCase() || 'MA';
}

function locationShortName(ma) {
  const loc = ma?.locationV2;
  if (!loc) return '';
  if (typeof loc === 'object') return loc.shortName || loc.nameFull || '';
  return '';
}

function onEmployeeSearchSelect(employee) {
  searchSelectedEmployeeId.value = employee?._id || null;
  searchSelectedEmployee.value = employee || null;
  if (employee?._id) {
    void selectMitarbeiter(employee);
  }
}

function onEmployeeSearchFiltersChange(activeFilters) {
  employeeSearchFilters.value = activeFilters;
  hasSavedEmployeeSearchFilters.value = true;
  saveEmployeeSearchFilters(activeFilters);
  void fetchStaffingMitarbeiter();
  if (!props.event?.auftragNr) {
    void loadBewerbungen();
  }
}

function toggleOnlyAvailableOnOrderDay() {
  onlyAvailableOnOrderDay.value = !onlyAvailableOnOrderDay.value;
  if (onlyAvailableOnOrderDay.value && !Object.keys(orderDayDispoMap.value).length) {
    void loadAvailableEmployeesForOrderDay();
  }
}

function formatPartialTimeRange(zeitVon, zeitBis) {
  const from = formatShortTime(zeitVon);
  const to = formatShortTime(zeitBis);
  if (from && to) return `${from} – ${to} Uhr`;
  if (from) return `ab ${from} Uhr`;
  if (to) return `bis ${to} Uhr`;
  return 'Zeitraum nicht angegeben';
}

function formatCommentTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rowDispoInfo(maId) {
  if (!maId || !props.event?.auftragNr) return null;
  return orderDayDispoMap.value[String(maId)] || null;
}

function rowDispoStatusClass(maId) {
  if (!props.event?.auftragNr) return '';
  const status = rowDispoInfo(maId)?.status;
  return status ? `staffing-row--dispo-${status}` : '';
}

function getCustomerWishForOrder(ma) {
  if (!props.event || !ma) return null;
  const orderKundenNr = Number(props.event.kundenNr || props.event.kundeData?.kundenNr);
  const orderKundeId = String(props.event.kundeData?._id || props.event.kunde || '').trim();
  const maId = ma._id ? String(ma._id) : null;
  const wishes = [
    ...(Array.isArray(ma.kundenwuensche) ? ma.kundenwuensche : []),
    ...(maId && selectedMaFull.value && String(selectedMaFull.value._id) === maId && Array.isArray(selectedMaFull.value.kundenwuensche)
      ? selectedMaFull.value.kundenwuensche
      : []),
    ...(maId && Array.isArray(rowDispoInfo(maId)?.kundenwuensche)
      ? rowDispoInfo(maId).kundenwuensche
      : []),
  ];
  if (!wishes.length) return null;

  const match = wishes.find((w) => {
    if (!w) return false;
    const wKundenNr = Number(w.kunde?.kundenNr ?? w.kundenNr);
    if (
      Number.isFinite(orderKundenNr) &&
      orderKundenNr > 0 &&
      Number.isFinite(wKundenNr) &&
      wKundenNr === orderKundenNr
    ) {
      return true;
    }
    const wKundeId = String(w.kunde?._id || w.kunde || '').trim();
    if (orderKundeId && wKundeId && wKundeId === orderKundeId) {
      return true;
    }
    return false;
  });
  if (!match) return null;

  const kundeName =
    match.kunde?.kuerzel ||
    match.kunde?.kundName ||
    props.event.kundeData?.kuerzel ||
    props.event.kundeData?.kundName ||
    (Number.isFinite(orderKundenNr) && orderKundenNr > 0 ? `Kunde #${orderKundenNr}` : 'Der Kunde');

  return {
    typ: match.typ === 'negativ' ? 'negativ' : 'positiv',
    kommentar: String(match.kommentar || '').trim(),
    kundeName,
    message:
      match.typ === 'negativ'
        ? `${kundeName} möchte diesen Mitarbeiter nicht wieder im Einsatz sehen.`
        : `${kundeName} möchte diesen Mitarbeiter gerne wieder im Einsatz sehen.`,
  };
}

function hasRowDispoTooltip(maId, maObj = null) {
  const info = rowDispoInfo(maId);
  const dispoNotiz = info?.dispoNotiz || maObj?.dispoNotiz || '';
  const hasCustomerWish = Boolean(getCustomerWishForOrder(maObj));
  if (!info && !dispoNotiz && !hasCustomerWish) return false;
  return Boolean(
    hasCustomerWish ||
    dispoNotiz ||
    (info?.plannedJobs && info.plannedJobs.length) ||
    info?.partialTimeLabel ||
    (info?.notes && info.notes.length) ||
    (info?.comments && info.comments.length)
  );
}

async function loadAvailableEmployeesForOrderDay() {
  const reqId = ++availableDayRequestSeq;
  if (!props.event?.auftragNr || !props.event?.vonDatum) {
    availableEmployeeIdsOnOrderDay.value = new Set();
    orderDayDispoMap.value = {};
    onlyAvailableOnOrderDay.value = false;
    availableDayLoading.value = false;
    return;
  }
  availableDayLoading.value = true;
  try {
    const rawStart = new Date(props.event.vonDatum);
    const rawEnd = props.event.bisDatum ? new Date(props.event.bisDatum) : new Date(rawStart);
    const start = Number.isNaN(rawStart.getTime()) ? new Date() : new Date(rawStart);
    const end = Number.isNaN(rawEnd.getTime()) ? new Date(start) : new Date(rawEnd);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const vonIso = start.toISOString();
    const bisIso = end.toISOString();
    const vonDateKey = toIsoDate(start);
    const bisDateKey = toIsoDate(end);

    const [dispoRes, commentsRes] = await Promise.all([
      api.get('/api/dispo', { params: { von: vonIso, bis: bisIso } }),
      api.get('/api/comments', { params: { scope: 'dispo_day', von: vonDateKey, bis: bisDateKey } }).catch(() => ({ data: [] })),
    ]);
    if (reqId !== availableDayRequestSeq) return;

    const entries = Array.isArray(dispoRes.data?.eintraege) ? dispoRes.data.eintraege : [];
    const dispoMaList = Array.isArray(dispoRes.data?.mitarbeiter) ? dispoRes.data.mitarbeiter : [];
    const zvooveComments = Array.isArray(dispoRes.data?.zvooveKommentare) ? dispoRes.data.zvooveKommentare : [];
    const dbComments = Array.isArray(commentsRes.data) ? commentsRes.data : [];

    const byMa = {};
    const ensureMa = (id) => {
      const key = String(id);
      if (!byMa[key]) {
        byMa[key] = { entries: [], comments: [], notes: [], dispoNotiz: '', kundenwuensche: [] };
      }
      return byMa[key];
    };

    for (const ma of dispoMaList) {
      if (ma?._id) {
        if (ma.dispoNotiz && String(ma.dispoNotiz).trim()) {
          ensureMa(ma._id).dispoNotiz = String(ma.dispoNotiz).trim();
        }
        if (Array.isArray(ma.kundenwuensche) && ma.kundenwuensche.length) {
          ensureMa(ma._id).kundenwuensche = ma.kundenwuensche;
        }
      }
    }

    for (const entry of entries) {
      const rawMa = entry.mitarbeiter;
      const maId = typeof rawMa === 'object' ? rawMa?._id : rawMa;
      if (!maId) continue;
      const bucket = ensureMa(maId);
      bucket.entries.push(entry);
      if (entry.text && String(entry.text).trim()) {
        bucket.notes.push(String(entry.text).trim());
      }
    }

    for (const c of [...dbComments, ...zvooveComments]) {
      if (c?.scope && c.scope !== 'dispo_day') continue;
      const rawMa = c?.context?.mitarbeiter;
      const maId = typeof rawMa === 'object' ? rawMa?._id : rawMa;
      if (!maId || !c?.text) continue;
      ensureMa(maId).comments.push(c);
    }

    const availableIds = new Set();
    const nextMap = {};

    for (const [maId, bucket] of Object.entries(byMa)) {
      const maEntries = bucket.entries;
      let status = '';
      let statusLabel = '';
      let partialTimeLabel = '';
      const plannedJobs = [];

      const plannedEntries = maEntries.filter((e) => e.typ === 'planned' || e.verfuegbarkeit === 'eingeplant');
      if (plannedEntries.length) {
        status = 'planned';
        statusLabel = 'Bereits eingeplant';
        for (const pe of plannedEntries) {
          const time = [formatShortTime(pe.uhrzeitVon || pe.zeitVon), formatShortTime(pe.uhrzeitBis || pe.zeitBis)]
            .filter(Boolean)
            .join('–');
          if (pe.typ === 'planned') {
            const titleParts = [
              pe.kuerzel,
              pe.eventTitel || pe.bezeichnung || (pe.auftragNr ? `Auftrag #${pe.auftragNr}` : 'Einsatz'),
            ].filter(Boolean);
            const subtitleParts = [
              pe.schichtBezeichnung && pe.schichtBezeichnung !== pe.eventTitel ? pe.schichtBezeichnung : null,
              time ? `${time} Uhr` : null,
              pe.auftragNr ? `#${pe.auftragNr}` : null,
            ].filter(Boolean);
            plannedJobs.push({
              einsatzId: pe._id || null,
              auftragNr: pe.auftragNr || null,
              schichtBezeichnung: pe.schichtBezeichnung || null,
              isPseudo: Boolean(pe.isPseudo),
              title: titleParts.join(' · '),
              subtitle: subtitleParts.join(' · '),
            });
          } else {
            plannedJobs.push({
              dispoEntryId: pe._id || null,
              isDispoPlaceholder: true,
              title: pe.kundeKuerzel ? `Manuell eingeplant (${pe.kundeKuerzel})` : 'Manuell eingeplant',
              subtitle: [time ? `${time} Uhr` : null, pe.text || null].filter(Boolean).join(' · '),
            });
          }
        }
      } else if (maEntries.some((e) => e.verfuegbarkeit === 'blocked' || e.typ === 'abwesenheit')) {
        status = 'blocked';
        const abw = maEntries.find((e) => e.typ === 'abwesenheit');
        statusLabel = abw?.abwesenheitsKategorie === 'urlaub'
          ? 'Urlaub'
          : abw?.abwesenheitsKategorie === 'krank'
            ? 'Krank'
            : 'Nicht verfügbar (Blocked)';
      } else if (maEntries.some((e) => e.verfuegbarkeit === 'partially')) {
        status = 'partially';
        statusLabel = 'Eingeschränkt verfügbar';
        const pe = maEntries.find((e) => e.verfuegbarkeit === 'partially');
        partialTimeLabel = formatPartialTimeRange(pe?.zeitVon, pe?.zeitBis);
      } else if (maEntries.some((e) => e.verfuegbarkeit === 'angefragt_tel' || e.verfuegbarkeit === 'angefragt_flip')) {
        status = 'angefragt';
        statusLabel = 'Angefragt';
      } else if (maEntries.some((e) => e.verfuegbarkeit === 'available')) {
        status = 'available';
        statusLabel = 'Verfügbar';
        availableIds.add(maId);
      }

      nextMap[maId] = {
        status,
        statusLabel,
        partialTimeLabel,
        plannedJobs,
        dispoNotiz: bucket.dispoNotiz || '',
        kundenwuensche: bucket.kundenwuensche || [],
        notes: [...new Set(bucket.notes)],
        comments: bucket.comments,
      };
    }

    availableEmployeeIdsOnOrderDay.value = availableIds;
    orderDayDispoMap.value = nextMap;
  } catch (err) {
    console.warn('Verfügbare Mitarbeiter am Auftragstag konnten nicht geladen werden:', err);
  } finally {
    if (reqId === availableDayRequestSeq) {
      availableDayLoading.value = false;
    }
  }
}

async function fetchStaffingMitarbeiter() {
  const reqId = ++mitarbeiterRequestSeq;
  mitarbeiterLoading.value = true;
  try {
    const values = (category) => employeeSearchFilters.value
      .filter((filter) => filter.category === category)
      .map((filter) => filter.value);
    const singleValue = (category) => employeeSearchFilters.value
      .find((filter) => filter.category === category)?.value ?? '';

    const { data } = await api.get('/api/personal/search', {
      params: {
        q: '',
        allowEmpty: 'true',
        limit: 250,
        locationV2: orderLocationId.value || undefined,
        berufe: values('berufe').join(','),
        qualifikationen: values('qualifikationen').join(','),
        persgruppen: values('persgruppen').join(','),
        arbeitsverhaeltnisse: values('arbeitsverhaeltnisse').join(','),
        standorte: values('standorte').join(','),
        bewerber: singleValue('bewerber'),
      },
    });
    if (reqId !== mitarbeiterRequestSeq) return;
    if (Array.isArray(data)) {
      backendMitarbeiter.value = data;
    }
  } catch (err) {
    console.warn('Aktive Mitarbeiter konnten nicht vom Backend geladen werden:', err);
  } finally {
    if (reqId === mitarbeiterRequestSeq) {
      mitarbeiterLoading.value = false;
    }
  }
}

async function ensureMitarbeiterCacheLoaded() {
  mitarbeiterLoading.value = true;
  try {
    await Promise.all([
      ...(typeof indexedDB !== 'undefined'
        ? [dataCache.loadBerufe(), dataCache.loadQualifikationen()]
        : []),
      fetchStaffingMitarbeiter(),
    ]);
  } catch (err) {
    console.warn('Mitarbeiter-Daten konnten nicht geladen werden:', err);
  } finally {
    mitarbeiterLoading.value = false;
  }
}

function primarySkillLabel(ma) {
  const beruf = ma?.berufe?.[0]?.designation;
  if (beruf && beruf !== 'Unbekannt') return beruf;
  const quali = ma?.qualifikationen?.[0]?.designation;
  if (quali && quali !== 'Unbekannt') return quali;
  return '';
}

function berufeItems(ma) {
  return (ma?.berufe || []).filter((b) => b?.designation && b.designation !== 'Unbekannt');
}

function qualiItems(ma) {
  return (ma?.qualifikationen || []).filter((q) => q?.designation && q.designation !== 'Unbekannt');
}

function fuehrerscheinClasses(ma) {
  if (!ma) return [];
  const plural = ma.fuehrerscheine;
  const singular = ma.fuehrerschein;
  const licenses = Array.isArray(plural) && plural.length === 0 && singular
    ? singular
    : plural ?? singular;
  if (!licenses) return [];
  return (Array.isArray(licenses) ? licenses : [licenses])
    .map((license) => (typeof license === 'string' ? license : license?.klasse))
    .map((k) => String(k || '').trim())
    .filter(Boolean);
}

function fuehrerscheinSummary(ma) {
  const classes = fuehrerscheinClasses(ma);
  const fsLabel = classes.length ? `FS: ${classes.join(', ')}` : 'Kein FS';
  const hatAuto = ma?.fuehrerschein?.hatAuto;
  const autoLabel = `Auto: ${hatAuto === true ? 'Ja' : hatAuto === false ? 'Nein' : '—'}`;
  return `${fsLabel} · ${autoLabel}`;
}

function bewerbungStatusLabel(status) {
  return (
    {
      submitted: 'Offen',
      scheduled: 'Eingeplant',
      confirmed: 'Bestätigt',
      rejected: 'Abgesagt',
    }[status] || status
  );
}

function formatShortTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

function onMitarbeiterDragStart(event, ma, bewerbung = null) {
  if (
    !ma?._id ||
    !event.dataTransfer ||
    isAlreadyAssigned(ma) ||
    ['scheduled', 'confirmed'].includes(bewerbung?.status)
  ) {
    event.preventDefault();
    return;
  }
  const payload = JSON.stringify({
    _id: ma._id,
    mitarbeiterId: ma._id,
    vorname: ma.vorname,
    nachname: ma.nachname,
    personalnr: ma.personalnr,
    qualifikationen: ma.qualifikationen || [],
    dispoInfo: rowDispoInfo(ma._id) || null,
    bewerbungId: bewerbung?._id || null,
  });
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/x-straight-monitor-mitarbeiter', payload);
  event.dataTransfer.setData('application/json', payload);
  attachMitarbeiterDragPreview(event, formatName(ma));
}

const LEGACY_DEMO_APPS_PURGED_KEY = 'auftraege.legacyDemoBewerbungenPurged_v1';

function clearLocalDevPortalApplications() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('public_dev_portal:')) continue;
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      if (stored && typeof stored === 'object') {
        stored.applications = {};
        stored.applicationSteps = {};
        localStorage.setItem(key, JSON.stringify(stored));
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }
}

async function purgeLegacyDemoApplicationsOnce() {
  try {
    if (localStorage.getItem(LEGACY_DEMO_APPS_PURGED_KEY) === '1') return;
    clearLocalDevPortalApplications();
    await api.delete('/api/auftraege/bewerbungen', { params: { scope: 'all' } }).catch(() => {});
    localStorage.setItem(LEGACY_DEMO_APPS_PURGED_KEY, '1');
  } catch {
    // Ignore errors
  }
}

async function loadBewerbungen() {
  await purgeLegacyDemoApplicationsOnce();
  const auftragNr = props.event?.auftragNr;
  bewerbungenLoading.value = true;
  try {
    if (auftragNr) {
      const { data } = await api.get(`/api/auftraege/${auftragNr}/bewerbungen`);
      const serverItems = Array.isArray(data?.bewerbungen) ? data.bewerbungen : [];
      bewerbungen.value = serverItems.filter(
        (item) => Number(item.auftragNr) === Number(auftragNr)
      );
    } else {
      const standorte = employeeSearchFilters.value
        .filter((f) => f.category === 'standorte')
        .map((f) => String(f.value))
        .filter(Boolean);
      const locParam = standorte.length ? standorte.join(',') : (orderLocationId.value || '');
      const { data } = await api.get('/api/auftraege/bewerbungen', {
        params: locParam ? { locationV2: locParam } : {},
      });
      bewerbungen.value = Array.isArray(data?.bewerbungen) ? data.bewerbungen : [];
    }
  } catch (err) {
    console.warn('Bewerbungen konnten nicht geladen werden:', err);
  } finally {
    bewerbungenLoading.value = false;
  }
}

async function refreshActiveList() {
  if (activeTab.value === 'all') {
    await Promise.all([
      fetchStaffingMitarbeiter(),
      loadAvailableEmployeesForOrderDay(),
    ]);
  } else {
    await Promise.all([
      loadBewerbungen(),
      loadAvailableEmployeesForOrderDay(),
    ]);
  }
}

function onBewerbungRowClick(bew) {
  if (!bew) return;
  if (bew.mitarbeiter) {
    void selectMitarbeiter(bew.mitarbeiter);
  }
  const auftragNr = bew.auftragNr;
  if (auftragNr && Number(auftragNr) !== Number(props.event?.auftragNr)) {
    emit('open-order', {
      auftragNr,
      focusDate: bew.auftragData?.vonDatum || null,
      bewerbung: bew,
    });
  }
}

async function selectMitarbeiter(ma) {
  if (!ma?._id) return;
  const maId = String(ma._id);
  selectedMaBasic.value = dataCache.populateMitarbeiterSkills(ma);
  selectedMaFull.value = null;
  selectedPhotoUrl.value = '';
  emit('select-mitarbeiter', ma);

  const reqId = ++detailRequestSeq;
  detailLoading.value = true;

  // 1. Load contingent data (Part 3)
  void employeeContingents.load(maId, contingentPeriod.value);

  // 2. Load Dispo availability (Part 4)
  void loadDispoForMitarbeiter(maId, reqId);

  // 3. Load full Mitarbeiter details + Profile picture (Part 2)
  try {
    const { data } = await api.get(`/api/personal/mitarbeiter/${maId}`);
    if (reqId !== detailRequestSeq) return;
    if (data?.data) {
      selectedMaFull.value = data.data;
    }
  } catch (err) {
    console.warn('Mitarbeiter-Details konnten nicht geladen werden:', err);
  } finally {
    if (reqId === detailRequestSeq) {
      detailLoading.value = false;
    }
  }

  await loadProfilePhoto(activeMitarbeiter.value, reqId);
}

async function reloadSelectedMitarbeiter() {
  if (!activeMitarbeiter.value?._id) return;
  const ma = activeMitarbeiter.value;
  void employeeContingents.load(String(ma._id), contingentPeriod.value, { force: true });
  await selectMitarbeiter(ma);
}

async function loadProfilePhoto(ma, reqId) {
  if (!ma?._id) return;
  try {
    if (flip.enablePhotos && ma.flip_id) {
      const flipUrl = await flip.ensurePhoto(ma.flip_id);
      if (flipUrl && reqId === detailRequestSeq) {
        selectedPhotoUrl.value = flipUrl;
        return;
      }
    }
    if (ma.profilbild) {
      const res = await api.get(`/api/personal/mitarbeiter/${ma._id}/profilbild`);
      if (res.data?.url && reqId === detailRequestSeq) {
        selectedPhotoUrl.value = res.data.url;
      }
    }
  } catch {
    // Ignore photo errors and keep initials avatar fallback
  }
}

async function loadDispoForMitarbeiter(maId, reqId) {
  dispoLoading.value = true;
  dispoEntries.value = [];
  dispoComments.value = [];
  selectedDispoNotiz.value = '';
  try {
    const { start, end } = dispoWindow.value;
    const vonDateKey = toIsoDate(start);
    const bisDateKey = toIsoDate(end);
    const [dispoRes, commentsRes] = await Promise.all([
      api.get('/api/dispo', {
        params: {
          von: start.toISOString(),
          bis: end.toISOString(),
          mitarbeiterId: maId,
          includeInactive: 'true',
        },
      }),
      api.get('/api/comments', {
        params: {
          scope: 'dispo_day',
          von: vonDateKey,
          bis: bisDateKey,
          mitarbeiterId: maId,
        },
      }).catch(() => ({ data: [] })),
    ]);
    if (reqId !== detailRequestSeq) return;
    const data = dispoRes.data;
    dispoEntries.value = Array.isArray(data?.eintraege) ? data.eintraege : [];
    const zvooveComments = Array.isArray(data?.zvooveKommentare) ? data.zvooveKommentare : [];
    const dbComments = Array.isArray(commentsRes.data) ? commentsRes.data : [];
    dispoComments.value = [...dbComments, ...zvooveComments];
    const maDoc = (data?.mitarbeiter || [])[0];
    selectedDispoNotiz.value = maDoc?.dispoNotiz || '';
  } catch (err) {
    console.warn('Dispo-Verfügbarkeit konnte nicht geladen werden:', err);
  } finally {
    if (reqId === detailRequestSeq) {
      dispoLoading.value = false;
    }
  }
}

function openContingentModal() {
  if (!activeMitarbeiter.value) return;
  openEmployeeContingent(activeMitarbeiter.value, contingentPeriod.value, selectedHoverData.value);
}

function openBewerbungMenu(event, bew) {
  closeEmployeeRowMenu();
  const isContextMenu = event?.type === 'contextmenu';
  const rect = !isContextMenu ? event?.currentTarget?.getBoundingClientRect() : null;
  bewerbungMenu.item = bew;
  bewerbungMenu.x = rect ? rect.right - 220 : event.clientX;
  bewerbungMenu.y = rect ? rect.bottom + 4 : event.clientY;
  bewerbungMenu.shifts =
    Number(props.event?.auftragNr) === Number(bew?.auftragNr) && (props.shifts || []).length
      ? props.shifts
      : [];
  bewerbungMenu.open = true;

  if (!bewerbungMenu.shifts.length && bew?.auftragNr) {
    const targetNr = bew.auftragNr;
    api
      .get(`/api/auftraege/${targetNr}/details`)
      .then(({ data }) => {
        if (bewerbungMenu.open && bewerbungMenu.item === bew && data) {
          bewerbungMenu.shifts = buildEventSchichten(data);
        }
      })
      .catch(() => {});
  }
}

function closeBewerbungMenu() {
  bewerbungMenu.open = false;
  bewerbungMenu.item = null;
  bewerbungMenu.shifts = [];
}

async function handleBewerbungMenuAction(action) {
  const bew = bewerbungMenu.item;
  closeBewerbungMenu();
  if (!bew || !action) return;

  if (action === 'open-job') {
    const auftragNr = bew.auftragNr || props.event?.auftragNr;
    if (auftragNr) {
      emit('open-order', {
        auftragNr,
        focusDate: bew.auftragData?.vonDatum || null,
        bewerbung: bew,
      });
    }
    return;
  }
  if (action === 'open-card') {
    emit('open-employee-card', bew.mitarbeiter);
    return;
  }
  if (action === 'open-dispo') {
    openMitarbeiterInDispo(bew.mitarbeiter);
    return;
  }
  if (action === 'delete') {
    await deleteSingleBewerbung(bew);
    return;
  }

  let parsedAction = action;
  let targetSchichtId = null;
  if (action.startsWith('accept:')) {
    parsedAction = 'accept';
    targetSchichtId = action.slice('accept:'.length);
  } else if (action.startsWith('reserve:')) {
    parsedAction = 'reserve';
    targetSchichtId = action.slice('reserve:'.length);
  }

  if (!['accept', 'reserve', 'deny'].includes(parsedAction)) return;

  if (parsedAction === 'accept' || parsedAction === 'reserve') {
    const shiftLabel =
      bew.schicht?.bezeichnung || bew.schichtBezeichnung || bew.jobTitle || 'Schicht';
    pendingBewerbungDecision.value = {
      bew,
      parsedAction,
      targetSchichtId,
      step: {
        type: 'notify-employee',
        employeeName: formatName(bew.mitarbeiter),
        shiftName: shiftLabel,
        isReserve: parsedAction === 'reserve',
      },
    };
    return;
  }

  await executeBewerbungDecision(bew, parsedAction, targetSchichtId, false);
}

async function onBewerbungNotifyDecide(action) {
  const pending = pendingBewerbungDecision.value;
  if (!pending) return;
  const notifyEmployee = action === 'confirm-notify';
  pendingBewerbungDecision.value = null;
  await executeBewerbungDecision(
    pending.bew,
    pending.parsedAction,
    pending.targetSchichtId,
    notifyEmployee
  );
}

async function executeBewerbungDecision(bew, parsedAction, targetSchichtId, notifyEmployee = false) {
  decidingBewerbungId.value = String(bew._id);
  const isReserve = parsedAction === 'reserve';
  try {
    if (bew.isLocalDemo) {
      const nextStatus = parsedAction === 'deny' ? 'rejected' : 'scheduled';
      updateLocalDemoApplication(bew.localEmail, bew.jobId, nextStatus, isReserve);
      if ((parsedAction === 'accept' || parsedAction === 'reserve') && props.event?.auftragNr && bew.mitarbeiter?._id) {
        await api.post(`/api/auftraege/${props.event.auftragNr}/pseudo-einsatz`, {
          mitarbeiterId: bew.mitarbeiter._id,
          isReserve,
          notifyEmployee,
          ...(targetSchichtId ? { schichtId: targetSchichtId } : {}),
        });
      }
      bew.status = nextStatus;
      bew.isReserve = isReserve;
      emit('bewerbung-updated', { bewerbung: bew, action: parsedAction });
      return;
    }

    const auftragNr = props.event?.auftragNr || bew.auftragNr;
    const endpoint = auftragNr
      ? `/api/auftraege/${auftragNr}/bewerbungen/${bew._id}`
      : `/api/auftraege/bewerbungen/${bew._id}`;

    const { data } = await api.patch(endpoint, {
      action: parsedAction,
      isReserve,
      notifyEmployee,
      auftragNr: auftragNr || undefined,
      ...(targetSchichtId ? { schichtId: targetSchichtId } : {}),
    });

    if (data?.bewerbung) {
      const idx = bewerbungen.value.findIndex((item) => String(item._id) === String(bew._id));
      if (idx !== -1) bewerbungen.value[idx] = data.bewerbung;
      if (bew.mitarbeiter?.email) {
        updateLocalDemoApplication(
          bew.mitarbeiter.email,
          bew.jobId,
          data.bewerbung.status,
          Boolean(data.bewerbung.isReserve)
        );
      }
    }

    emit('bewerbung-updated', { bewerbung: data?.bewerbung || bew, action: parsedAction });
  } catch (err) {
    alert(err.response?.data?.message || 'Bewerbung konnte nicht aktualisiert werden.');
  } finally {
    decidingBewerbungId.value = '';
  }
}

async function deleteSingleBewerbung(bew) {
  if (!bew || decidingBewerbungId.value) return;
  decidingBewerbungId.value = String(bew._id);
  try {
    if (bew.isLocalDemo) {
      updateLocalDemoApplication(bew.localEmail, bew.jobId, null);
      bewerbungen.value = bewerbungen.value.filter((item) => String(item._id) !== String(bew._id));
      emit('bewerbung-updated', { bewerbung: bew, action: 'delete' });
      return;
    }

    const auftragNr = props.event?.auftragNr || bew.auftragNr;
    const endpoint = auftragNr
      ? `/api/auftraege/${auftragNr}/bewerbungen/${bew._id}`
      : `/api/auftraege/bewerbungen/${bew._id}`;

    await api.delete(endpoint);
    bewerbungen.value = bewerbungen.value.filter((item) => String(item._id) !== String(bew._id));
    if (bew.mitarbeiter?.email) {
      updateLocalDemoApplication(bew.mitarbeiter.email, bew.jobId, null);
    }
    emit('bewerbung-updated', { bewerbung: bew, action: 'delete' });
  } catch (err) {
    alert(err.response?.data?.message || 'Bewerbung konnte nicht gelöscht werden.');
  } finally {
    decidingBewerbungId.value = '';
  }
}

function updateLocalDemoApplication(email, jobId, status, isReserve = false) {
  if (!email || !jobId) return;
  try {
    const key = `public_dev_portal:${String(email).trim().toLowerCase()}`;
    const stored = JSON.parse(localStorage.getItem(key) || 'null') || {};
    stored.applications = stored.applications || {};
    stored.applicationSteps = stored.applicationSteps || {};
    stored.applicationReserves = stored.applicationReserves || {};
    if (status) {
      stored.applications[jobId] = status;
      if (isReserve) stored.applicationReserves[jobId] = true;
      else delete stored.applicationReserves[jobId];
      if (status === 'scheduled') stored.applicationSteps[jobId] = 0;
    } else {
      delete stored.applications[jobId];
      delete stored.applicationSteps[jobId];
      delete stored.applicationReserves[jobId];
    }
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Ignore storage errors
  }
}

async function copyValue(value, field) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copiedField.value = field;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedField.value = '';
    }, 1500);
  } catch {
    // Ignore clipboard failure
  }
}

watch(
  orderLocationId,
  (locId, oldLocId) => {
    if (locId) {
      syncDefaultLocationFilter(locId);
    }
    if (props.modelValue && locId !== oldLocId && !props.event?.auftragNr) {
      void fetchStaffingMitarbeiter();
      void loadBewerbungen();
    }
  },
  { immediate: true }
);

watch(
  () => props.event?.auftragNr,
  async (newNr, oldNr) => {
    dispoWeekOffset.value = 0;
    if (orderLocationId.value) {
      syncDefaultLocationFilter(orderLocationId.value);
    }
    if (props.modelValue && (newNr || oldNr !== undefined)) {
      await Promise.all([
        fetchStaffingMitarbeiter(),
        loadBewerbungen(),
        loadAvailableEmployeesForOrderDay(),
      ]);
      if (activeMitarbeiter.value?._id) {
        const reqId = ++detailRequestSeq;
        void employeeContingents.load(String(activeMitarbeiter.value._id), contingentPeriod.value);
        void loadDispoForMitarbeiter(String(activeMitarbeiter.value._id), reqId);
      }
    }
  },
  { immediate: true }
);

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      if (!employeeSearchFilters.value.some((f) => f.category === 'standorte') && orderLocationId.value) {
        syncDefaultLocationFilter(orderLocationId.value);
      }
      await Promise.all([
        ensureMitarbeiterCacheLoaded(),
        loadBewerbungen(),
        loadAvailableEmployeesForOrderDay(),
      ]);
    }
  },
  { immediate: true }
);

watch(
  () => props.externalSelectedMitarbeiter,
  (ma) => {
    if (ma?._id && String(ma._id) !== selectedMaId.value) {
      void selectMitarbeiter(ma);
    }
  }
);

onMounted(async () => {
  if (props.modelValue) {
    await ensureMitarbeiterCacheLoaded();
    await loadBewerbungen();
  }
});

defineExpose({
  loadBewerbungen,
  loadAvailableEmployeesForOrderDay,
  rowDispoInfo,
  selectMitarbeiter,
});
</script>

<style scoped lang="scss">
.admin-staffing-panel {
  position: sticky;
  top: 0;
  display: flex;
  flex: 0 0 var(--admin-sp-width, 390px);
  flex-direction: column;
  width: var(--admin-sp-width, 390px);
  height: calc(100vh - 48px);
  min-height: 0;
  margin-left: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: var(--tile-bg);
  border: 1px solid color-mix(in oklab, var(--border) 88%, var(--text));
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.55);

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  &--embedded {
    position: relative;
    top: auto;
    flex: 0 0 var(--admin-sp-width, 380px);
    width: var(--admin-sp-width, 380px);
    height: 100%;
    margin-left: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  &--unassign-ready {
    overflow: hidden;
  }
}

.staffing-unassign-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: color-mix(in srgb, #ef4444 12%, color-mix(in srgb, var(--panel) 84%, transparent));
  border-radius: inherit;
  pointer-events: none;
  transition: background 0.16s ease;

  &.is-over {
    background: color-mix(in srgb, #ef4444 22%, color-mix(in srgb, var(--panel) 80%, transparent));

    .staffing-unassign-overlay__icon {
      background: #ef4444;
      border-color: #ef4444;
      color: #fff;
      transform: scale(1.08);
      box-shadow: 0 10px 24px rgba(239, 68, 68, 0.28);
    }
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, #ef4444 45%, transparent);
    background: #fff;
    color: #ef4444;
    font-size: 1.75rem;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
    transition:
      background 0.16s ease,
      border-color 0.16s ease,
      color 0.16s ease,
      transform 0.16s ease,
      box-shadow 0.16s ease;
  }
}

.admin-staffing-panel__width-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 6px;
  z-index: 25;
  cursor: ew-resize;
  background: transparent;
  transition: background 0.15s ease;

  &:hover,
  &.is-resizing {
    background: color-mix(in srgb, var(--primary) 35%, transparent);
  }
}

.staffing-part {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  box-sizing: border-box;

  &:last-child {
    border-bottom: 0;
  }

  &--custom-height {
    overflow: hidden;
  }
}

.staffing-part__scroll-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.staffing-part--profile.staffing-part--custom-height .zvoove-profile-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.staffing-part__resizer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  z-index: 6;
  height: 7px;
  cursor: ns-resize;
  background: transparent;
  transition: background 0.15s ease;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 32px;
    height: 3px;
    border-radius: 999px;
    background: transparent;
    transform: translate(-50%, -50%);
    transition: background 0.15s ease;
  }

  &:hover,
  &.is-resizing {
    background: color-mix(in srgb, var(--primary) 22%, transparent);

    &::after {
      background: var(--primary);
    }
  }
}

.staffing-part--list {
  flex: 0 0 260px;
  min-height: 130px;
  overflow: hidden;
}

.staffing-tabs-header {
  container-type: inline-size;
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 12px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.pseudo-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 0 0 5px 5px;
  border: 1px solid rgba(139, 92, 246, 0.5);
  border-top: 0;
  background: color-mix(in srgb, #8b5cf6 16%, var(--panel));
  color: #8b5cf6;
  font-size: 0.58rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  pointer-events: auto;

  &--border {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 3;
  }
}

.staffing-tabs-left {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.staffing-minimize-btn {
  flex: 0 0 auto;
}

.staffing-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.staffing-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 1;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--text);
    background: var(--hover);
  }

  &.active {
    border-color: var(--primary);
    color: var(--primary);
    background: transparent;
  }
}

.staffing-tab__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

@container (max-width: 345px) {
  .staffing-tab--bewerbungen .staffing-tab__label {
    display: none;
  }
}

.staffing-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--hover);
  color: var(--text);
  font-size: 0.68rem;
  font-weight: 700;

  &--highlight {
    background: var(--primary);
    color: #fff;
  }
}

.staffing-controls {
  position: relative;
  z-index: 4;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--panel) 55%, var(--tile-bg));
  border-bottom: 1px solid var(--border);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);

  &--with-bottom {
    padding-bottom: 10px;
    margin-bottom: 24px;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.06),
      0 1px 2px rgba(0, 0, 0, 0.04);
  }
}

.staffing-controls-bottom {
  position: absolute;
  top: 100%;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  white-space: nowrap;

  .docked-control-btn,
  :deep(.sort-menu__trigger) {
    display: inline-flex;
    align-items: center;
    height: 24px;
    box-sizing: border-box;
    gap: 5px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-top-color: var(--tile-bg);
    border-radius: 0 0 6px 6px;
    background: var(--tile-bg);
    color: var(--text);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .docked-control-btn:hover,
  :deep(.sort-menu__trigger:hover) {
    border-color: var(--primary);
    color: var(--primary);
  }

  .docked-control-btn.active {
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
  }
}

.staffing-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.staffing-search-input-wrap {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.staffing-search-icon {
  position: absolute;
  left: 9px;
  color: var(--muted);
  font-size: 0.75rem;
  pointer-events: none;
}

.staffing-search-input {
  width: 100%;
  height: 30px;
  padding: 4px 26px 4px 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 0.78rem;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.staffing-search-clear {
  position: absolute;
  right: 6px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.75rem;
}

.staffing-filter-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;

  .chip-count {
    margin-left: 4px;
    font-size: 0.68rem;
    opacity: 0.85;
  }
}

.staffing-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  divide-y: 1px solid var(--border);
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.staffing-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 12px;
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
}

.staffing-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s ease;

  &:hover {
    background: var(--hover);
  }

  &--dispo-available {
    background: rgba(16, 185, 129, 0.13);

    &:hover {
      background: rgba(16, 185, 129, 0.21);
    }
  }

  &--dispo-partially {
    background: rgba(245, 158, 11, 0.15);

    &:hover {
      background: rgba(245, 158, 11, 0.23);
    }
  }

  &--dispo-blocked {
    background: rgba(239, 68, 68, 0.13);

    &:hover {
      background: rgba(239, 68, 68, 0.21);
    }
  }

  &--dispo-planned {
    background: rgba(99, 102, 241, 0.13);

    &:hover {
      background: rgba(99, 102, 241, 0.21);
    }
  }

  &--dispo-angefragt {
    background: rgba(14, 165, 233, 0.13);

    &:hover {
      background: rgba(14, 165, 233, 0.21);
    }
  }

  &--selected {
    box-shadow: inset 3px 0 0 var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, var(--tile-bg));
  }

  &--assigned {
    opacity: 0.85;
  }
}

.staffing-row__main-tooltip {
  flex: 1;
  min-width: 0;
}

.row-dispo-tooltip {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 170px;
  max-width: 280px;
  white-space: normal;
  text-align: left;

  &__kw {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 7px;
    border-radius: 5px;

    p {
      margin: 0;
      font-size: 0.72rem;
      color: #1f2937;
      line-height: 1.35;
    }

    &--positiv {
      background: rgba(16, 185, 129, 0.14);
      border-left: 2.5px solid #10b981;

      .row-dispo-tooltip__kw-head {
        color: #047857;
      }
    }

    &--negativ {
      background: rgba(239, 68, 68, 0.14);
      border-left: 2.5px solid #ef4444;

      .row-dispo-tooltip__kw-head {
        color: #b91c1c;
      }
    }
  }

  &__kw-head {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
  }

  &__kw-comment {
    font-style: italic;
    color: #4b5563 !important;
  }

  &__time {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #b45309;
    font-size: 0.74rem;

    svg {
      color: #f59e0b;
    }
  }

  &__jobs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__jobs-head {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #4f46e5;
    font-size: 0.72rem;

    svg {
      font-size: 0.7rem;
    }
  }

  &__job-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 3px 6px;
    border-radius: 4px;
    background: rgba(99, 102, 241, 0.1);
    border-left: 2.5px solid #6366f1;

    small {
      color: #4b5563;
      font-size: 0.68rem;
    }
  }

  &__job-title {
    color: #111827;
    font-size: 0.73rem;
    font-weight: 600;
  }

  &__status {
    font-size: 0.72rem;
    color: #111827;
  }

  &__note {
    margin: 0;
    font-size: 0.73rem;
    color: #374151;
    line-height: 1.35;
  }

  &__disponotiz {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 7px;
    border-radius: 5px;
    background: rgba(245, 158, 11, 0.14);
    border-left: 2.5px solid #f59e0b;

    p {
      margin: 0;
      font-size: 0.73rem;
      color: #1f2937;
      line-height: 1.35;
      white-space: pre-wrap;
    }
  }

  &__disponotiz-head {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    color: #b45309;

    svg {
      color: #f59e0b;
    }
  }

  &__comment {
    padding-top: 4px;
    border-top: 1px solid #e5e7eb;

    &:first-child {
      padding-top: 0;
      border-top: 0;
    }

    p {
      margin: 2px 0 0;
      font-size: 0.73rem;
      color: #1f2937;
      line-height: 1.35;
    }
  }

  &__comment-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.68rem;
    color: #6b7280;

    strong {
      color: #111827;
    }
  }
}

.staffing-row__grip {
  color: var(--muted);
  font-size: 0.72rem;
  cursor: grab;
  opacity: 0.55;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.2 !important;
  }
}

.staffing-row:hover .staffing-row__grip:not(.staffing-row__grip--disabled) {
  opacity: 1;
}

.staffing-row__main {
  flex: 1;
  min-width: 0;
}

.staffing-row__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.staffing-row__name {
  overflow: hidden;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staffing-row__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.71rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staffing-row__tag {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  font-size: 0.66rem;
  font-weight: 600;

  &--location-match {
    border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
    background: color-mix(in srgb, var(--primary) 10%, var(--tile-bg));
    color: var(--primary);
  }
}

.staffing-row__skill {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staffing-pill {
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;

  &--assigned {
    background: color-mix(in srgb, #10b981 15%, transparent);
    color: #10b981;
  }

  &--kw-positiv {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(16, 185, 129, 0.16);
    border: 1px solid rgba(16, 185, 129, 0.45);
    color: #059669;
  }

  &--kw-negativ {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(239, 68, 68, 0.16);
    border: 1px solid rgba(239, 68, 68, 0.45);
    color: #dc2626;
  }

  &--bewerber {
    background: color-mix(in srgb, #eab308 18%, transparent);
    border: 1px solid color-mix(in srgb, #eab308 45%, transparent);
    color: #b45309;
  }

  &--reserve {
    background: color-mix(in srgb, #6b7280 20%, transparent);
    border: 1px solid color-mix(in srgb, #6b7280 48%, transparent);
    color: #4b5563;
  }
}

.bew-status-pill {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  flex-shrink: 0;

  &--submitted {
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    color: #d97706;
  }
  &--scheduled {
    background: color-mix(in srgb, #3b82f6 16%, transparent);
    color: #2563eb;
  }
  &--confirmed {
    background: color-mix(in srgb, #10b981 16%, transparent);
    color: #059669;
  }
  &--rejected {
    background: color-mix(in srgb, #ef4444 16%, transparent);
    color: #dc2626;
  }
}

.staffing-row__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.staffing-card-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--primary);
  font-size: 0.75rem;
  text-decoration: none;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }
}

.staffing-unselected-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  color: var(--muted);
  font-size: 0.78rem;
  background: color-mix(in srgb, var(--panel) 50%, var(--tile-bg));
}

/* ─── PART 2: ZVOOVE-STYLE COMPACT PROFILE CARD ─── */
.staffing-part--profile {
  background: var(--tile-bg);
}

.zvoove-profile-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--text) 10%, var(--panel));
  border-bottom: 1px solid var(--border);
}

.zvoove-profile-banner__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.zvoove-profile-banner__name {
  overflow: hidden;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zvoove-profile-banner__type {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  flex-shrink: 0;
}

.zvoove-profile-banner__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.zvoove-banner-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 0.72rem;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    color: var(--primary);
    background: var(--hover);
  }
}

.zvoove-profile-body {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
}

.zvoove-profile-photo-wrap {
  flex: 0 0 84px;
  width: 84px;
  height: 104px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--panel);
  cursor: pointer;
}

.zvoove-profile-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.zvoove-profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: color-mix(in srgb, var(--primary) 16%, var(--panel));
  color: var(--primary);
  font-size: 1.35rem;
  font-weight: 800;
}

.zvoove-days-meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 44px;
  height: 104px;
  font-size: 0.62rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.zvoove-days-meter__bar {
  position: relative;
  width: 10px;
  flex: 1;
  margin: 3px 0;
  border-radius: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}

.zvoove-days-meter__fill {
  width: 100%;
  background: #22c55e;
  border-radius: 2px;
  transition: height 0.25s ease;
}

.zvoove-profile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 5px;
}

.zvoove-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.76rem;
}

.zvoove-info-icon-group {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.zvoove-icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--panel);
  color: var(--primary);
  font-size: 0.68rem;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    border-color: var(--primary);
  }

  &--muted {
    color: var(--muted);
    cursor: default;
  }
}

.zvoove-info-label {
  flex: 0 0 54px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.zvoove-info-value {
  flex: 1;
  min-width: 0;
  color: var(--text);
  font-weight: 500;

  a {
    color: var(--text);
    text-decoration: none;

    &:hover {
      color: var(--primary);
      text-decoration: underline;
    }
  }

  &--truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.zvoove-copy-inline {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--primary);
  }
}

.zvoove-skills-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;

  svg {
    color: var(--primary);
    font-size: 0.7rem;
  }

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, var(--panel));
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 15px;
    padding: 0 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    color: var(--primary);
    font-size: 0.65rem;
    font-weight: 700;
  }
}

.skills-tooltip {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 220px;
  max-width: 310px;
  padding: 2px 0;
  white-space: normal;
  text-align: left;

  &__section {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  &__heading {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #111827;
    text-transform: uppercase;
    letter-spacing: 0.03em;

    svg {
      color: var(--primary, #5abfeb);
      font-size: 0.7rem;
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.3;

    &--beruf {
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #b45309;
    }

    &--quali {
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #047857;
    }
  }

  &__empty {
    font-size: 0.72rem;
    color: #6b7280;
    font-style: italic;
  }
}

/* ─── PART 3: HOVER DATA CARD (INLINE) ─── */
.staffing-part--contingent {
  padding: 8px 10px;
  background: color-mix(in srgb, var(--panel) 35%, var(--tile-bg));

  :deep(.hover-data-card--inline) {
    width: 100%;
    max-width: 100%;
    box-shadow: none;
  }
}

/* ─── PART 4: DISPO AVAILABILITY ─── */
.staffing-part--dispo {
  padding: 10px 12px 14px;
}

.dispo-part-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.dispo-part-header__title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;

  svg {
    color: var(--primary);
  }
}

.dispo-part-header__controls {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  padding: 1px 2px;
}

.dispo-week-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 0.65rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: var(--hover);
    color: var(--text);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.dispo-part-header__range {
  padding: 0 5px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: default;

  &.is-offset {
    color: var(--primary);
    font-weight: 600;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
    }
  }
}

.dispo-part-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--muted);
  font-size: 0.78rem;
}

.dispo-days-grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dispo-day-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: var(--panel);
  font-size: 0.74rem;

  &--order-day {
    border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
    background: color-mix(in srgb, var(--primary) 7%, var(--panel));
  }
}

.dispo-day-row__date {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 68px;
  font-variant-numeric: tabular-nums;

  strong {
    color: var(--text);
    font-size: 0.72rem;
    width: 20px;
  }

  span {
    color: var(--muted);
    font-size: 0.7rem;
  }
}

.dispo-day-row__status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.dispo-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;

  &--available {
    background: color-mix(in srgb, #10b981 16%, transparent);
    color: #059669;
  }
  &--partially {
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    color: #d97706;
  }
  &--blocked,
  &--krank {
    background: color-mix(in srgb, #ef4444 16%, transparent);
    color: #dc2626;
  }
  &--planned {
    background: color-mix(in srgb, #6366f1 16%, transparent);
    color: #4f46e5;
  }
  &--urlaub,
  &--angefragt {
    background: color-mix(in srgb, #0ea5e9 16%, transparent);
    color: #0284c7;
  }
  &--empty,
  &--neutral {
    color: var(--muted);
  }
}

.dispo-day-row__detail {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dispo-day-row__comment-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
  overflow: hidden;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 12%, var(--tile-bg));
  color: var(--text);
  font-size: 0.66rem;
  text-overflow: ellipsis;
  white-space: nowrap;

  svg {
    color: var(--primary);
    flex-shrink: 0;
  }
}

.dispo-part-notiz {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 6px 0 0;
  padding: 6px 8px;
  border-radius: 5px;
  background: color-mix(in srgb, #f59e0b 10%, var(--panel));
  color: var(--text);
  font-size: 0.72rem;
}

@media (max-width: 1400px) {
  .admin-staffing-panel {
    --admin-sp-width: 340px;
  }
}

.sp-enter-active,
.sp-leave-active {
  transition:
    flex-basis 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    width 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    margin-left 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.2s ease;
}

.sp-enter-from,
.sp-leave-to {
  flex-basis: 0;
  width: 0;
  margin-left: 0;
  opacity: 0;
}

@media (max-width: 768px) {
  .admin-staffing-panel {
    display: none;
  }
}
</style>
