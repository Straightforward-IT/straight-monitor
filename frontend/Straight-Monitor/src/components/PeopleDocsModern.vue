<template>
  <div class="people-page">
    <main class="main">
      <!-- ============== EMPLOYEE VIEW ============== -->
      <section class="panel">
        <!-- Controls -->
        <div class="controls">
          <!-- Minimierbare Filter-Sektion -->
          <FilterPanel v-model:expanded="filtersExpanded">
            
            <!-- Enhanced Filter Chips (nur sichtbar wenn expanded) -->
            <div class="filter-chips">
            <!-- Compact Filters (Dropdowns) -->
            
            <!-- Status Dropdown -->
            <div class="chip-group compact-group">
                <FilterDropdown ref="statusDropdown" :has-value="filters.status !== 'Alle'">
                  <template #label><font-awesome-icon icon="fa-solid fa-filter" style="margin-right: 0.5rem" /> {{ filters.status === 'Alle' ? 'Status' : filters.status }}</template>
                  <div class="dropdown-item clickable" :class="{ selected: filters.status === 'Alle' }"
                       @click="setFilter('status', 'Alle'); $refs.statusDropdown.close()">
                    Alle
                  </div>
                  <div v-for="status in ['Aktiv', 'Inaktiv']" :key="status" 
                       class="dropdown-item clickable" :class="{ selected: filters.status === status }"
                       @click="setFilter('status', status); $refs.statusDropdown.close()">
                    <font-awesome-icon 
                      :icon="status === 'Aktiv' ? 'fa-solid fa-circle-check' : 
                             'fa-regular fa-circle-xmark'"
                      style="margin-right: 8px; width: 16px;" 
                      :class="status === 'Aktiv' ? 'text-success' : 'text-danger'"
                    />
                    {{ status }}
                  </div>
                </FilterDropdown>
            </div>

            <!-- Location Dropdown -->
            <div class="chip-group compact-group">
                 <FilterDropdown ref="locationDropdown" :has-value="filters.location !== 'Alle'">
                    <template #label><font-awesome-icon icon="fa-solid fa-location-dot" style="margin-right: 0.5rem" /> {{ filters.location === 'Alle' ? 'Standort' : filters.location }}</template>
                    <div class="dropdown-item clickable" :class="{ selected: filters.location === 'Alle' }"
                        @click="setFilter('location', 'Alle'); $refs.locationDropdown.close()">
                        Alle Standorte
                    </div>
                    <div v-for="loc in locations" :key="loc" 
                         class="dropdown-item clickable"
                         :class="{ selected: filters.location === loc }"
                         @click="setFilter('location', loc); $refs.locationDropdown.close()">
                      {{ loc }}
                    </div>
                 </FilterDropdown>
            </div>

            <!-- Department Dropdown -->
            <div class="chip-group compact-group">
                 <FilterDropdown ref="deptDropdown" :has-value="filters.department !== 'Alle'">
                    <template #label><font-awesome-icon icon="fa-solid fa-layer-group" style="margin-right: 0.5rem" /> {{ filters.department === 'Alle' ? 'Bereich' : filters.department }}</template>
                    <div class="dropdown-item clickable" :class="{ selected: filters.department === 'Alle' }"
                        @click="setFilter('department', 'Alle'); $refs.deptDropdown.close()">
                        Alle Bereiche
                    </div>
                    <div v-for="dept in departments" :key="dept" 
                         class="dropdown-item clickable"
                         :class="{ selected: filters.department === dept }"
                         @click="setFilter('department', dept); $refs.deptDropdown.close()">
                      {{ dept }}
                    </div>
                 </FilterDropdown>
            </div>

            <span class="divider" />

            <div class="chip-group compact-group">
                 <FilterDropdown ref="asanaDropdown" :has-value="filters.asanaStatus !== 'Alle'">
                    <template #label><font-awesome-icon icon="fa-solid fa-clipboard-list" style="margin-right: 0.5rem" /> {{ filters.asanaStatus === 'Alle' ? 'Asana' : filters.asanaStatus.replace('_', ' ') }}</template>
                     <div v-for="stat in ['Alle', 'Verknüpft', 'Nicht_verknüpft']" 
                          :key="stat" class="dropdown-item clickable" :class="{ selected: filters.asanaStatus === stat }"
                          @click="setFilter('asanaStatus', stat); $refs.asanaDropdown.close()">
                       {{ stat.replace('_', ' ') }}
                     </div>
                 </FilterDropdown>
            </div>

            <span class="divider" />
            
            <!-- Metadata Group -->
            <div class="chip-group compact-group">
                 <FilterDropdown ref="pnrDropdown" :has-value="filters.personalnrStatus !== 'Alle'">
                    <template #label><font-awesome-icon icon="fa-solid fa-id-badge" style="margin-right: 0.5rem" /> {{ filters.personalnrStatus === 'Alle' ? 'P-Nr.' : filters.personalnrStatus }}</template>
                     <div v-for="stat in ['Alle', 'Vorhanden', 'Fehlt']" 
                          :key="stat" class="dropdown-item clickable" :class="{ selected: filters.personalnrStatus === stat }"
                          @click="setFilter('personalnrStatus', stat); $refs.pnrDropdown.close()">
                       {{ stat }}
                     </div>
                 </FilterDropdown>
            </div>

            <div class="chip-group compact-group">
                 <FilterDropdown ref="tlDropdown" :has-value="filters.teamleiter !== 'Alle'">
                    <template #label><font-awesome-icon icon="fa-solid fa-user-tie" style="margin-right: 0.5rem" /> {{ filters.teamleiter === 'Alle' ? 'Rolle' : filters.teamleiter }}</template>
                     <div v-for="stat in ['Alle', 'Nur Teamleiter', 'Keine Teamleiter']" 
                          :key="stat" class="dropdown-item clickable" :class="{ selected: filters.teamleiter === stat }"
                          @click="setFilter('teamleiter', stat); $refs.tlDropdown.close()">
                       {{ stat }}
                     </div>
                 </FilterDropdown>
            </div>

            <span class="divider" />

            <!-- Skills (Multi Select) -->
            <div class="chip-group compact-group">
                  <FilterDropdown :has-value="filters.berufe.length > 0">
                    <template #label>
                       <font-awesome-icon icon="fa-solid fa-briefcase" style="margin-right: 0.5rem" />
                       <span v-if="filters.berufe.length === 0"> Berufe</span>
                       <span v-else> {{ filters.berufe.length }} gewählt</span>
                    </template>
                    
                    <div v-if="availableBerufe.length === 0" class="no-options">Keine Berufe gefunden</div>
                    <label v-for="beruf in availableBerufe" :key="beruf._id" class="dropdown-item">
                      <input 
                        type="checkbox" 
                        :checked="filters.berufe.includes(beruf._id)"
                        @change="toggleBerufFilter(beruf._id)"
                      >
                      <span class="label-text">{{ beruf.designation }}</span>
                      <span class="badge-small">{{ beruf.jobKey }}</span>
                    </label>
                  </FilterDropdown>
            </div>
            
            <div class="chip-group compact-group">
                  <FilterDropdown :has-value="filters.qualifikationen.length > 0">
                    <template #label>
                       <font-awesome-icon icon="fa-solid fa-graduation-cap" style="margin-right: 0.5rem" />
                       <span v-if="filters.qualifikationen.length === 0"> Qualifikationen</span>
                       <span v-else> {{ filters.qualifikationen.length }} gewählt</span>
                    </template>
                    
                    <div v-if="availableQualifikationen.length === 0" class="no-options">Keine Qualifikationen gefunden</div>
                    <label v-for="quali in availableQualifikationen" :key="quali._id" class="dropdown-item">
                      <input 
                        type="checkbox" 
                        :checked="filters.qualifikationen.includes(quali._id)"
                        @change="toggleQualifikationFilter(quali._id)"
                      >
                      <span class="label-text">{{ quali.designation }}</span>
                      <span class="badge-small">{{ quali.qualificationKey }}</span>
                    </label>
                  </FilterDropdown>
            </div>
            
            <span class="divider" />
            </div>
          </FilterPanel>

          <div class="search-sort">
            <div class="search">
              <font-awesome-icon
                icon="fa-solid fa-magnifying-glass"
                class="search-ic"
              />
              <input
                v-model="mitarbeitersSearchQuery"
                type="text"
                placeholder="Mitarbeiter suchen (Name, E-Mail)…"
                aria-label="Mitarbeiter suchen"
              />
            </div>

            <div class="sort">
              <button class="btn-ghost" @click="toggleMitarbeiterSort">
                <font-awesome-icon icon="fa-solid fa-arrow-up-wide-short" />
                Sortieren
              </button>
              <div
                v-if="showMitarbeiterSort"
                class="menu"
                @click.outside="showMitarbeiterSort = false"
              >
                <button @click="setMitarbeiterSort('vorname')">Vorname</button>
                <button @click="setMitarbeiterSort('nachname')">
                  Nachname
                </button>
                <button @click="setMitarbeiterSort('standort')">
                  Standort
                </button>
                <button @click="setMitarbeiterSort('abteilung')">
                  Bereich
                </button>
                <button class="sep" disabled />
                <button
                  @click="mitarbeitersIsAscending = !mitarbeitersIsAscending"
                >
                  Richtung:
                  {{ mitarbeitersIsAscending ? "Aufsteigend" : "Absteigend" }}
                </button>
              </div>
            </div>
          </div>
        </div> <!-- Ende controls -->

        <!-- View Controls (moved here, below search bar) -->
        <div class="view-controls-section">
          <div class="view-controls-left">
            <!-- View Mode Toggle (versteckt auf Mobile) -->
            <div class="view-toggle mobile-hidden">
              <button 
                class="view-btn"
                :class="{ active: mitarbeiterViewMode === 'grid' }"
                @click="mitarbeiterViewMode = 'grid'"
              >
                <font-awesome-icon icon="fa-solid fa-grip" />
                Kacheln
              </button>
              <button 
                class="view-btn"
                :class="{ active: mitarbeiterViewMode === 'list' }"
                @click="mitarbeiterViewMode = 'list'"
              >
                <font-awesome-icon icon="fa-solid fa-list" />
                Liste
              </button>
            </div>

            <!-- Selection Info -->
            <div v-if="selectedMitarbeiterIds.size > 0" class="selection-info">
              <span class="selection-count">{{ selectedMitarbeiterIds.size }} ausgewählt</span>
              <button class="btn-clear" @click="clearSelection">
                <font-awesome-icon icon="fa-solid fa-times" />
                Auswahl löschen
              </button>
            </div>
          </div>

          <!-- Pagination Info (compact version) -->
          <div v-if="!loading.mitarbeiter && filteredMitarbeitersSorted.length > 0" class="pagination-compact">
            <div class="pagination-info-compact">
              <span class="pagination-text">{{ paginationInfo.start }}-{{ paginationInfo.end }} von {{ paginationInfo.total }}</span>
              
              <select 
                v-model="itemsPerPage" 
                @change="setItemsPerPage(Number($event.target.value))"
                class="pagination-select-compact"
              >
                <option v-for="size in pageOptions" :key="size" :value="size">
                  {{ size }}
                </option>
              </select>
            </div>
            
            <div class="pagination-controls-compact" v-if="totalPages > 1">
              <custom-tooltip text="Vorherige Seite" position="top" :delay-in="150">
                <button 
                  class="pagination-btn-compact" 
                  :disabled="currentPage === 1" 
                  @click="prevPage"
                >
                  <font-awesome-icon icon="fa-solid fa-chevron-left" />
                </button>
              </custom-tooltip>
              
              <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
              
              <custom-tooltip text="Nächste Seite" position="top" :delay-in="150">
                <button 
                  class="pagination-btn-compact" 
                  :disabled="currentPage === totalPages" 
                  @click="nextPage"
                >
                  <font-awesome-icon icon="fa-solid fa-chevron-right" />
                </button>
              </custom-tooltip>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading.mitarbeiter" class="loading-container">
           <font-awesome-icon icon="fa-solid fa-spinner" spin class="loading-spinner" />
           <span class="loading-text">Lade Mitarbeiter...</span>
        </div>

        <!-- Grid View (Standard auf Mobile) -->
        <div v-else-if="mitarbeiterViewMode === 'grid'" class="grid">
          <EmployeeCard
            v-for="ma in paginatedMitarbeiters"
            :key="ma._id"
            :ma="ma"
            :class="{ 'highlight-card': isEmployeeExpanded(ma), 'selected': selectedMitarbeiterIds.has(ma._id) }"
            :initiallyExpanded="isEmployeeExpanded(ma)"
            :showCheckbox="true"
            :isSelected="selectedMitarbeiterIds.has(ma._id)"
            @open="openProfile"
            @edit="editMitarbeiter"
            @toggle-selection="toggleSelection(ma._id)"
            @quick-actions="showQuickActions(ma, $event)"
            @filter-beruf="activateBerufFilter"
            @filter-qualifikation="activateQualifikationFilter"
          />
        </div>

        <!-- List View (versteckt auf Mobile) -->
        <div v-else class="list mobile-hidden">
          <div class="list-header">
            <div class="list-col list-col--checkbox">
              <input 
                type="checkbox" 
                :checked="isAllSelected"
                :indeterminate="isSomeSelected"
                @change="toggleSelectAll"
                class="select-all-checkbox"
              />
            </div>
            <div class="list-col list-col--expand"></div>
            <div class="list-col list-col--avatar"></div>
            <div class="list-col list-col--name list-header-sortable" @click="setSortBy('name')">
              Name
              <font-awesome-icon 
                v-if="listSortBy === 'name'"
                :icon="listIsAscending ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="sort-indicator"
              />
            </div>
            <div class="list-col list-col--personalnr list-header-sortable" @click="setSortBy('personalnr')">
              Personalnr
              <font-awesome-icon 
                v-if="listSortBy === 'personalnr'"
                :icon="listIsAscending ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="sort-indicator"
              />
            </div>
            <div class="list-col list-col--status list-header-sortable" @click="setSortBy('status')">
              Status
              <font-awesome-icon 
                v-if="listSortBy === 'status'"
                :icon="listIsAscending ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="sort-indicator"
              />
            </div>
            <div class="list-col list-col--location list-header-sortable" @click="setSortBy('location')">
              Standort
              <font-awesome-icon 
                v-if="listSortBy === 'location'"
                :icon="listIsAscending ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="sort-indicator"
              />
            </div>
            <div class="list-col list-col--department list-header-sortable" @click="setSortBy('department')">
              Bereich
              <font-awesome-icon 
                v-if="listSortBy === 'department'"
                :icon="listIsAscending ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'"
                class="sort-indicator"
              />
            </div>
            <div class="list-col list-col--createdby">Erstellt von</div>
            <div class="list-col list-col--trinity">Verknüpfungen</div>
            <div class="list-col list-col--actions">Aktionen</div>
          </div>
          
          <template v-for="ma in paginatedMitarbeiters" :key="ma._id">
            <div 
              class="list-row"
              :class="{ 'selected': selectedMitarbeiterIds.has(ma._id), 'highlight-card': isEmployeeExpanded(ma), 'expanded': listExpandedIds.has(ma._id) }"
              @click="toggleListExpansion(ma._id)"
            >
              <div class="list-col list-col--checkbox" @click.stop>
                <input 
                  type="checkbox" 
                  :checked="selectedMitarbeiterIds.has(ma._id)"
                  @change="toggleSelection(ma._id)"
                  class="selection-checkbox"
                />
              </div>
              
              <div class="list-col list-col--expand">
                <button class="expand-btn" :class="{ expanded: listExpandedIds.has(ma._id) }">
                  <font-awesome-icon icon="fa-solid fa-chevron-right" />
                </button>
              </div>
              
              <div class="list-col list-col--avatar">
                <div class="avatar" v-if="!getPhotoUrl(ma)" :style="{ '--hue': avatarHue(ma) }">
                  {{ initials(ma) }}
                </div>
                <img v-else class="avatar-img" :src="getPhotoUrl(ma)" alt="" />
              </div>
              
              <div class="list-col list-col--name">
                <div class="name">{{ ma.vorname }} {{ ma.nachname }}</div>
              </div>
              
              <div class="list-col list-col--personalnr">
                <span 
                  class="personalnr-badge" 
                  :class="{ 'missing': !ma.personalnr }"
                  :title="ma.personalnr ? `Personalnr: ${ma.personalnr}` : 'Personalnr fehlt'"
                >
                  <font-awesome-icon icon="fa-solid fa-id-badge" />
                  {{ ma.personalnr || "Fehlt" }}
                </span>
              </div>
              
              <!-- Mobile-optimierte Info-Gruppierung -->
              <div class="mobile-info-row">
                <div class="mobile-info-item">
                  <font-awesome-icon :icon="ma.isActive ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'" />
                  <span class="value">{{ ma.isActive ? 'Aktiv' : 'Inaktiv' }}</span>
                </div>
                <div class="mobile-info-item" v-if="getDisplayLocation(ma)">
                  <font-awesome-icon icon="fa-solid fa-location-dot" />
                  <span class="value">{{ getDisplayLocation(ma) }}</span>
                </div>
                <div class="mobile-info-item" v-if="getDisplayDepartment(ma)">
                  <font-awesome-icon icon="fa-solid fa-layer-group" />
                  <span class="value">{{ getDisplayDepartment(ma) }}</span>
                </div>
              </div>
              
              <!-- Mobile Trinity Status -->
              <div class="mobile-trinity-row">
                <div class="mobile-trinity-item" :class="getFlipStatus(ma)" title="Flip Status">
                  <img src="/src/assets/flip.png" alt="Flip" class="mobile-trinity-logo" v-if="ma.flip" />
                  <font-awesome-icon icon="fa-solid fa-mobile-screen" v-else />
                  <span>Flip</span>
                </div>
                <div class="mobile-trinity-item" :class="getAsanaStatus(ma)" title="Asana Status">
                  <img src="/src/assets/asana.png" alt="Asana" class="mobile-trinity-logo" v-if="getAsanaStatus(ma) === 'linked'" />
                  <font-awesome-icon icon="fa-solid fa-clipboard-list" v-else />
                  <span>Asana</span>
                </div>
                <div class="mobile-trinity-item" :class="getStraightStatus(ma)" title="Straight Status">
                  <img src="/src/assets/SF_002.png" alt="Straight" class="mobile-trinity-logo" />
                  <span>Straight</span>
                </div>
              </div>
              
              <!-- Desktop-Spalten (versteckt auf Mobile) -->
              <div class="list-col list-col--status desktop-only">
                <span class="status-badge" :class="ma.isActive ? 'active' : 'inactive'">
                  <font-awesome-icon :icon="ma.isActive ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'" />
                  {{ ma.isActive ? 'Aktiv' : 'Inaktiv' }}
                </span>
              </div>
              
              <div class="list-col list-col--location desktop-only">
                {{ getDisplayLocation(ma) || '—' }}
              </div>
              
              <div class="list-col list-col--department desktop-only">
                {{ getDisplayDepartment(ma) || '—' }}
              </div>
              
              <div class="list-col list-col--createdby desktop-only">
                {{ ma.erstellt_von || '—' }}
              </div>

              <div class="list-col list-col--trinity desktop-only">
                <div class="trinity-status">
                  <div class="trinity-badge" :class="getFlipStatus(ma)" title="Flip Status">
                    <img src="/src/assets/flip.png" alt="Flip" class="trinity-logo" v-if="ma.flip" />
                    <font-awesome-icon icon="fa-solid fa-mobile-screen" v-else />
                  </div>
                  <div class="trinity-badge" :class="getAsanaStatus(ma)" title="Asana Status">
                    <img src="/src/assets/asana.png" alt="Asana" class="trinity-logo" v-if="getAsanaStatus(ma) === 'linked'" />
                    <font-awesome-icon icon="fa-solid fa-clipboard-list" v-else />
                  </div>
                  <div class="trinity-badge" :class="getStraightStatus(ma)" title="Straight Status">
                    <img src="/src/assets/SF_002.png" alt="Straight" class="trinity-logo" />
                  </div>
                </div>
              </div>
              
              <div class="list-col list-col--actions" @click.stop>
                <div class="quick-actions-wrapper">
                  <button 
                    class="quick-actions-btn" 
                    :class="{ active: activeQuickActionId === ma._id }"
                    @click="showQuickActions(ma, $event)"
                  >
                    <font-awesome-icon icon="fa-solid fa-ellipsis-vertical" />
                  </button>
                  
                  <!-- Quick Actions Dropdown Menu -->
                  <div 
                    v-if="activeQuickActionId === ma._id" 
                    class="quick-actions-menu"
                    @click.stop
                  >
                    <!-- Kontakt Actions -->
                    <div v-if="getPhoneNumber(ma) || ma.email" class="action-group">
                      <div class="action-group-label">Kontakt</div>
                      
                      <!-- Sipgate Button -->
                      <button 
                        v-if="getPhoneNumber(ma)"
                        class="quick-action-item"
                        @click="executeQuickAction(ma, 'sipgate')"
                        title="Anruf über Sipgate"
                      >
                        <font-awesome-icon icon="fa-solid fa-phone" />
                        {{ getPhoneNumber(ma) }}
                      </button>
                      
                      <!-- Outlook Button -->
                      <button 
                        v-if="ma.email"
                        class="quick-action-item"
                        @click="executeQuickAction(ma, 'outlook')"
                        title="E-Mail über Outlook"
                      >
                        <font-awesome-icon icon="fa-solid fa-envelope" />
                        {{ ma.email }}
                      </button>
                    </div>
                    
                    <!-- Weitere Actions -->
                    <div class="action-group">
                      <div class="action-group-label">Aktionen</div>
                      <button 
                        class="quick-action-item"
                        @click="executeQuickAction(ma, 'profile')"
                      >
                        <font-awesome-icon icon="fa-solid fa-user" />
                        Profil
                      </button>
                      <button 
                        class="quick-action-item"
                        @click="executeQuickAction(ma, 'edit')"
                      >
                        <font-awesome-icon icon="fa-solid fa-edit" />
                        Bearbeiten
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Expanded Content -->
            <div v-if="listExpandedIds.has(ma._id)" class="list-expansion">
              <div class="expansion-content">
                <div class="expansion-section">
                  <h4>Kontakt</h4>
                  <p><strong>E-Mail:</strong> {{ ma.email || '—' }}</p>
                  <p><strong>Telefon:</strong> {{ getPhoneNumber(ma) || '—' }}</p>
                </div>
                
                <div class="expansion-section" v-if="ma.flip">
                  <h4>Flip Profile</h4>
                  <p><strong>Status:</strong> {{ ma.flip.status }}</p>
                  <p><strong>Gruppen:</strong> {{ ma.flip.groups?.map(g => g.name).join(', ') || '—' }}</p>
                </div>
                
                <div class="expansion-section">
                  <h4>System-IDs</h4>
                  <p><strong>Straight ID:</strong> {{ ma._id }}</p>
                  <p><strong>Erstellt von:</strong> {{ ma.erstellt_von || '—' }}</p>
                  <p class="personalnr-row">
                    <strong>Personalnr:</strong> 
                    <span v-if="editingPersonalnrId !== ma._id">{{ ma.personalnr || '—' }}</span>
                    <input 
                      v-else
                      v-model="editingPersonalnrValue"
                      type="text"
                      class="personalnr-input"
                      placeholder="Personalnr eingeben"
                      @keyup.enter="savePersonalnr(ma)"
                      @keyup.escape="cancelEditPersonalnr"
                    />
                    <button 
                      v-if="editingPersonalnrId !== ma._id"
                      class="edit-btn-inline"
                      @click.stop="startEditPersonalnr(ma)"
                      title="Personalnr bearbeiten"
                    >
                      <font-awesome-icon icon="fa-solid fa-edit" />
                    </button>
                    <template v-else>
                      <button 
                        class="save-btn-inline"
                        @click.stop="savePersonalnr(ma)"
                        title="Speichern"
                      >
                        <font-awesome-icon icon="fa-solid fa-check" />
                      </button>
                      <button 
                        class="cancel-btn-inline"
                        @click.stop="cancelEditPersonalnr"
                        title="Abbrechen"
                      >
                        <font-awesome-icon icon="fa-solid fa-times" />
                      </button>
                    </template>
                  </p>
                  <p><strong>Flip ID:</strong> {{ ma.flip_id || '—' }}</p>
                  <p><strong>Asana ID:</strong> {{ ma.asana_id || '—' }}</p>
                </div>
              </div>
            </div>
          </template>
        </div>



        <div
          v-if="!loading.mitarbeiter && mitarbeiters.length > 0 && filteredMitarbeitersSorted.length === 0"
          class="empty"
        >
          <p>Keine Mitarbeiter gefunden. Filter anpassen?</p>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import api from "@/utils/api";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import CustomTooltip from './CustomTooltip.vue';
import EmployeeCard from "@/components/EmployeeCard.vue";
import FilterPanel from "@/components/FilterPanel.vue";
import FilterDropdown from "@/components/FilterDropdown.vue";
import { useFlipAll } from "@/stores/flipAll";
import { useDataCache } from "@/stores/dataCache";

import {  
  faMagnifyingGlass,
  faArrowUpWideShort,
  faCircleCheck,
  faCircle as faCircleSolid,
  faEarthEurope,
  faLocationDot,
  faLayerGroup,
  faUtensils,
  faBoxesStacked,
  faIdBadge,
  faMobileScreen,
  faClipboardList,
  faBriefcase,
  faEllipsisVertical,
  faFaceMehBlank,
  faGrip,
  faList,
  faTimes,
  faEllipsisH,
  faFilter,
  faUserTie,
  faLaptopCode,
  faChevronRight,
  faRotateLeft,
  faChevronUp,
  faChevronDown,
  faChevronLeft,
  faPhone,
  faEnvelope,
  faEdit,
  faUser,
  faSpinner,
  faCheck,
  faGraduationCap,
  faStar
} from "@fortawesome/free-solid-svg-icons";
import { faCircle as faCircleRegular } from "@fortawesome/free-regular-svg-icons";
import { library } from "@fortawesome/fontawesome-svg-core";

library.add(
  faMagnifyingGlass,
  faArrowUpWideShort,
  faCircleCheck,
  faCircleSolid,
  faCircleRegular,
  faEarthEurope,
  faLocationDot,
  faLayerGroup,
  faUtensils,
  faBoxesStacked,
  faIdBadge,
  faMobileScreen,
  faClipboardList,
  faBriefcase,
  faEllipsisVertical,
  faFaceMehBlank,
  faGrip,
  faList,
  faTimes,
  faEllipsisH,
  faFilter,
  faUserTie,
  faLaptopCode,
  faChevronRight,
  faRotateLeft,
  faChevronUp,
  faChevronDown,
  faChevronLeft,
  faPhone,
  faEnvelope,
  faEdit,
  faUser,
  faSpinner,
  faCheck,
  faGraduationCap,
  faStar
);

export default {
  name: "Personal",
  components: { FontAwesomeIcon, EmployeeCard, CustomTooltip, FilterPanel, FilterDropdown },

  // Pinia-Store sauber einbinden (Options API + setup)
  setup() {
    const flip = useFlipAll();
    const dataCache = useDataCache();
    
    return { flip, dataCache };
  },

  watch: {
    // Reset to first page when search query changes
    mitarbeitersSearchQuery() {
      this.currentPage = 1;
    },
  },

  data() {
    return {
      // auth/user
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userID: "",
      userName: "",
      userLocation: "",
      filtersLoadedFromCookie: false, // Track if filters were loaded from cookie
      // expanded employee
      expandedEmployeeId: null,
      
      // filter UI state
      filtersExpanded: true, // Filter standardmäßig ausgeklappt

      // view options
      mitarbeiterViewMode: "grid", // "grid" or "list"
      locations: ["Hamburg", "Berlin", "Köln"],
      departments: ["Service", "Logistik", "Office"],

      // selection state
      selectedMitarbeiterIds: new Set(),
      selectAllMode: false,
      
      // list expansion state
      listExpandedIds: new Set(),

      // Personalnr editing state
      editingPersonalnrId: null,
      editingPersonalnrValue: "",
      
      // list sorting
      listSortBy: "name",
      listIsAscending: true,
      
      // pagination
      currentPage: 1,
      itemsPerPage: 25,
      pageOptions: [25, 50, 100],

      // state
      loading: { mitarbeiter: true },
      error: { mitarbeiter: null },

      // data sets
      mitarbeiters: [],

      // enhanced filters matching the "trinity" (Straight + Asana + Flip)
      filters: {
        status: "Aktiv", // Aktiv, Inaktiv, Alle
        location: "Alle", // Hamburg, Berlin, Köln, Alle (wird später auf userLocation gesetzt)
        department: "Alle", // Service, Logistik, Management, IT, Alle
        flipStatus: "Alle", // Aktiv, Gesperrt, Gelöscht, Nicht_verknüpft, Alle
        asanaStatus: "Alle", // Verknüpft, Nicht_verknüpft, Alle
        personalnrStatus: "Alle", // Vorhanden, Fehlt, Alle
        profile: "Alle", // Vollständig, Unvollständig, Alle
        teamleiter: "Alle", // Alle, Nur Teamleiter, Keine Teamleiter
        berufe: [], // Array of selected Beruf IDs
        qualifikationen: [] // Array of selected Qualifikation IDs
      },
      mitarbeitersSearchQuery: "",
      mitarbeitersSortBy: "nachname",
      mitarbeitersIsAscending: true,

      // ui
      showMitarbeiterSort: false,
      activeQuickActionId: null, // Tracking für offene Quick-Action-Menüs
    };
  },

  computed: {
    // Verfügbare Berufe aus dem Cache
    availableBerufe() {
      return this.dataCache.berufe || [];
    },
    
    // Verfügbare Qualifikationen aus dem Cache
    availableQualifikationen() {
      return this.dataCache.qualifikationen || [];
    },
    
    // Mitarbeiter mit Flip-Daten und Skills anreichern
    mitarbeitersEnriched() {
      const ready = this.flip?.loaded;
      const arr = this.mitarbeiters || [];
      if (!ready) return arr;

      return arr.map((ma) => {
          let flipUser;
          // Strategy 1: Match by ID
          if (ma.flip_id) {
              flipUser = this.flip.getById(ma.flip_id);
          }
          // Strategy 2: Match by Email (Fallback)
          if (!flipUser && ma.email) {
              flipUser = this.flip.getByEmail(ma.email);
          }
          
          // Populate berufe and qualifikationen from cache
          const enriched = this.dataCache.populateMitarbeiterSkills(ma);

        return { ...enriched, flip: flipUser || null };
      });
    },

    filteredMitarbeiters() {
      let result = this.mitarbeitersEnriched || [];

      // Basic Status Filter
      if (this.filters.status === "Aktiv") {
        result = result.filter((ma) => ma.isActive);
      } else if (this.filters.status === "Inaktiv") {
        result = result.filter((ma) => !ma.isActive);
      }

      // Location Filter
      if (this.filters.location !== "Alle") {
        result = result.filter((ma) => this.getDisplayLocation(ma) === this.filters.location);
      }

      // Department Filter
      if (this.filters.department !== "Alle") {
        result = result.filter((ma) => {
          const dept = this.getDisplayDepartment(ma);
          if (this.filters.department === "Office") {
            return dept && dept.toLowerCase().includes('office');
          }
          return dept === this.filters.department;
        });
      }

      // Flip Status Filter
      if (this.filters.flipStatus !== "Alle") {
        result = result.filter((ma) => {
          const flipStatus = this.getFlipStatus(ma);
          // Map UI values to internal status values
          const statusMap = {
            'Aktiv': 'active',
            'Gesperrt': 'locked',
            'Gelöscht': 'deleted',
            'Nicht verknüpft': 'not-linked'
          };
          return flipStatus === statusMap[this.filters.flipStatus];
        });
      }

      // Asana Status Filter  
      if (this.filters.asanaStatus !== "Alle") {
        result = result.filter((ma) => {
          const hasAsana = ma.asana_id && ma.asana_id.trim() !== '';
          return this.filters.asanaStatus === "Verknüpft" ? hasAsana : !hasAsana;
        });
      }

      // Personalnr Status Filter  
      if (this.filters.personalnrStatus !== "Alle") {
        result = result.filter((ma) => {
          const hasPersonalnr = ma.personalnr && ma.personalnr.trim() !== '';
          return this.filters.personalnrStatus === "Vorhanden" ? hasPersonalnr : !hasPersonalnr;
        });
      }
      
      // Teamleiter Filter
      if (this.filters.teamleiter !== "Alle") {
        result = result.filter((ma) => {
          let isTeamleiter = false;
          if (ma.qualifikationen?.length) {
             isTeamleiter = ma.qualifikationen.some(q => parseInt(String(q.qualificationKey), 10) === 5);
          }
          return this.filters.teamleiter === "Nur Teamleiter" ? isTeamleiter : !isTeamleiter;
        });
      }
      
      // Berufe Filter (Mehrfachauswahl)
      if (this.filters.berufe.length > 0) {
        result = result.filter((ma) => {
          if (!ma.berufe?.length) return false;
          // MA muss mindestens einen der ausgewählten Berufe haben
          return ma.berufe.some(b => this.filters.berufe.includes(b._id));
        });
      }
      
      // Qualifikationen Filter (Mehrfachauswahl)
      if (this.filters.qualifikationen.length > 0) {
        result = result.filter((ma) => {
          if (!ma.qualifikationen?.length) return false;
          // MA muss mindestens eine der ausgewählten Qualifikationen haben
          return ma.qualifikationen.some(q => this.filters.qualifikationen.includes(q._id));
        });
      }

      // Profile Completeness Filter
      if (this.filters.profile !== "Alle") {
        result = result.filter((ma) => {
          const isComplete = this.isProfileComplete(ma);
          return this.filters.profile === "Vollständig" ? isComplete : !isComplete;
        });
      }

      // Enhanced Search (Trinity + basic fields)
      const q = this.mitarbeitersSearchQuery.toLowerCase().trim();
      if (q) {
        result = result.filter((ma) => {
          const parts = [
            ma.vorname || "",
            ma.nachname || "",
            ma.email || "",
            ma.personalnr || "",
            this.getDisplayLocation(ma) || "",
            this.getDisplayDepartment(ma) || "",
            ma.asana_id || "",
            ma.flip_id || ""
          ];

          // Include Flip data in search
          if (ma.flip?.attributes) {
            try {
              parts.push(JSON.stringify(ma.flip.attributes));
            } catch {}
          }
          if (ma.flip?.groups?.length) {
            parts.push(
              ma.flip.groups.map((g) => `${g.name || ""}`).join(" ")
            );
          }

          return parts.join(" ").toLowerCase().includes(q);
        });
      }

      return result;
    },

    // Pagination computed properties
    paginatedMitarbeiters() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredMitarbeitersSorted.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredMitarbeitersSorted.length / this.itemsPerPage);
    },

    paginationInfo() {
      const start = (this.currentPage - 1) * this.itemsPerPage + 1;
      const end = Math.min(this.currentPage * this.itemsPerPage, this.filteredMitarbeitersSorted.length);
      return {
        start,
        end,
        total: this.filteredMitarbeitersSorted.length
      };
    },

    isAllSelected() {
      return this.paginatedMitarbeiters.length > 0 && 
             this.paginatedMitarbeiters.every(ma => this.selectedMitarbeiterIds.has(ma._id));
    },

    isSomeSelected() {
      return this.selectedMitarbeiterIds.size > 0 && !this.isAllSelected;
    },

    filteredMitarbeitersSorted() {
      const arr = [...this.filteredMitarbeiters];
      
      // Wenn ein Mitarbeiter expandiert werden soll, diesen finden
      const expandedEmployee = this.expandedEmployeeId ? 
        arr.find(ma => this.isEmployeeExpanded(ma)) : null;
      
      // Sortierung basierend auf aktuellem View Mode
      if (this.mitarbeiterViewMode === 'list') {
        // List view sorting
        arr.sort((a, b) => {
          let av, bv;
          
          switch (this.listSortBy) {
            case 'name':
              av = `${a.vorname || ''} ${a.nachname || ''}`.toLowerCase();
              bv = `${b.vorname || ''} ${b.nachname || ''}`.toLowerCase();
              break;
            case 'personalnr':
              // Sortiere fehlende Personalnr nach hinten
              av = a.personalnr || 'zzz';
              bv = b.personalnr || 'zzz';
              break;
            case 'status':
              av = a.isActive ? 'aktiv' : 'inaktiv';
              bv = b.isActive ? 'aktiv' : 'inaktiv';
              break;
            case 'location':
              av = (this.getDisplayLocation(a) || '').toLowerCase();
              bv = (this.getDisplayLocation(b) || '').toLowerCase();
              break;
            case 'department':
              av = (this.getDisplayDepartment(a) || '').toLowerCase();
              bv = (this.getDisplayDepartment(b) || '').toLowerCase();
              break;
            default:
              av = (a?.[this.listSortBy] ?? "").toString().toLowerCase();
              bv = (b?.[this.listSortBy] ?? "").toString().toLowerCase();
          }
          
          if (av < bv) return this.listIsAscending ? -1 : 1;
          if (av > bv) return this.listIsAscending ? 1 : -1;
          return 0;
        });
      } else {
        // Grid view sorting (existing logic)
        const key = this.mitarbeitersSortBy;
        arr.sort((a, b) => {
          const av = (a?.[key] ?? "").toString().toLowerCase();
          const bv = (b?.[key] ?? "").toString().toLowerCase();
          if (av < bv) return this.mitarbeitersIsAscending ? -1 : 1;
          if (av > bv) return this.mitarbeitersIsAscending ? 1 : -1;
          return 0;
        });
      }

      // Wenn expandierter Mitarbeiter gefunden wurde, an den Anfang verschieben
      if (expandedEmployee) {
        const index = arr.findIndex(ma => this.isEmployeeExpanded(ma));
        if (index !== -1) {
          arr.splice(index, 1);
          arr.unshift(expandedEmployee);
        }
      }

      return arr;
    },
  },

  methods: {
    /* -------------------- UX helpers -------------------- */
    toggleFilters() {
      this.filtersExpanded = !this.filtersExpanded;
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
    formatDate(val) {
      if (!val) return "—";
      const d = new Date(val);
      if (isNaN(d)) return "—";
      return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },

    toggleMitarbeiterSort() {
      this.showMitarbeiterSort = !this.showMitarbeiterSort;
    },
    setMitarbeiterSort(key) {
      this.mitarbeitersSortBy = key;
      this.showMitarbeiterSort = false;
    },


    // Cookie Management
    saveFiltersToCookie() {
      try {
        const filterData = JSON.stringify(this.filters);
        const cookieString = `peopleDocsFilters=${encodeURIComponent(filterData)}; path=/; max-age=2592000`;
        document.cookie = cookieString;
      } catch (error) {
        console.error('❌ Failed to save filters to cookie:', error);
      }
    },

    loadFiltersFromCookie() {
      try {
        const cookies = document.cookie.split(';');
        const filterCookie = cookies.find(c => c.trim().startsWith('peopleDocsFilters='));
        
        if (filterCookie) {
          const cookieValue = filterCookie.split('=')[1];
          const filterData = JSON.parse(decodeURIComponent(cookieValue));
          
          // Merge saved filters with defaults (in case new filters were added)
          Object.keys(filterData).forEach(key => {
            if (this.filters.hasOwnProperty(key)) {
              this.filters[key] = filterData[key];
            }
          });
          
          this.filtersLoadedFromCookie = true;
        } else {
          this.filtersLoadedFromCookie = false;
        }
      } catch (error) {
        console.error('❌ Failed to load filters from cookie:', error);
      }
    },

    // Selection Methods
    toggleSelection(mitarbeiterId) {
      if (this.selectedMitarbeiterIds.has(mitarbeiterId)) {
        this.selectedMitarbeiterIds.delete(mitarbeiterId);
      } else {
        this.selectedMitarbeiterIds.add(mitarbeiterId);
      }
      // Trigger reactivity
      this.selectedMitarbeiterIds = new Set(this.selectedMitarbeiterIds);
    },

    toggleSelectAll() {
      if (this.isAllSelected) {
        this.clearSelection();
      } else {
        this.filteredMitarbeitersSorted.forEach(ma => {
          this.selectedMitarbeiterIds.add(ma._id);
        });
        this.selectedMitarbeiterIds = new Set(this.selectedMitarbeiterIds);
      }
    },

    clearSelection() {
      this.selectedMitarbeiterIds.clear();
      this.selectedMitarbeiterIds = new Set();
    },

    // Trinity Status Methods
    getFlipStatus(ma) {
      if (!ma.flip) return 'not-linked';
      switch (ma.flip.status?.toLowerCase()) {
        case 'active': return 'active';
        case 'locked': return 'locked'; 
        case 'pending_deletion': return 'deleted';
        default: return 'unknown';
      }
    },

    getAsanaStatus(ma) {
      return (ma.asana_id && ma.asana_id.trim() !== '') ? 'linked' : 'not-linked';
    },

    getStraightStatus(ma) {
      return this.isProfileComplete(ma) ? 'complete' : 'incomplete';
    },

    isProfileComplete(ma) {
      return !!(ma.vorname && ma.nachname && ma.email && 
               (ma.standort || this.getDisplayLocation(ma)) &&
               (ma.abteilung || this.getDisplayDepartment(ma)));
    },

    // Display Helper Methods
    getDisplayLocation(ma) {
      // 1. Flip Location
      const flipLoc = ma.flip?.profile?.location || 
             ma.flip?.attributes?.find(attr => attr.name?.toLowerCase().includes('standort') || 
                                               attr.name?.toLowerCase().includes('location'))?.value;
      
      if (flipLoc) return flipLoc;

      // 2. Database Location
      if (ma.standort) return ma.standort;

      // 3. Personalnr Logic (Fallback)
      // 1... = Berlin, 2... = Hamburg, 3... = Köln
      if (ma.personalnr) {
        const s = String(ma.personalnr).trim();
        if (s.startsWith('1')) return 'Berlin';
        if (s.startsWith('2')) return 'Hamburg';
        if (s.startsWith('3')) return 'Köln';
      }

      return null;
    },

    getDisplayDepartment(ma) {
      return ma.flip?.profile?.department || 
             ma.flip?.attributes?.find(attr => attr.name?.toLowerCase().includes('bereich') || 
                                               attr.name?.toLowerCase().includes('abteilung') ||
                                               attr.name?.toLowerCase().includes('department'))?.value ||
             ma.abteilung || null;
    },

    // Telefonnummer aus Flip-Profil extrahieren
    getPhoneNumber(ma) {
      if (!ma.flip?.attributes) return null;
      
      // Verschiedene mögliche Attributnamen für Telefonnummer
      const phoneAttribute = ma.flip.attributes.find(attr => {
        const name = attr.name?.toLowerCase() || '';
        return name.includes('telefon') || 
               name.includes('phone') || 
               name.includes('handy') || 
               name.includes('mobile') ||
               name.includes('tel');
      });
      
      return phoneAttribute?.value || null;
    },

    // Outlook-Link generieren (macOS)
    generateOutlookLink(email, { subject = "", body = "", from = "" } = {}) {
      if (!email) return null;
      
      // Parameter für Outlook-URL
      const params = {
        to: email,
        ...(subject ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(from ? { from } : {}) // Absender-Profil angeben
      };
      
      const qp = new URLSearchParams(params).toString();

      // Verschiedene Outlook URL-Formate probieren
      const schemas = [
        // Neueste Outlook-Varianten mit verschiedenen Aktionen
        `ms-outlook:compose?${qp}`,
        `ms-outlook:ofe?${qp}`, // Office Form Editor (alternativer Aufruf)
        `ms-outlook:mail?${qp}`, // Mail-Aktion
        
        // Mit Doppelslash (manche Versionen)
        `ms-outlook://compose?${qp}`,
        `ms-outlook://ofe?${qp}`,
        `ms-outlook://mail?${qp}`,
        
        // Ältere Outlook-Varianten
        `microsoft-outlook:compose?${qp}`,
        `outlook:compose?${qp}`,
        
        // Sehr alte Mac-spezifische
        `macoutlook:compose?${qp}`,
        
        // Letzter Fallback: Standard mailto
        `mailto:${encodeURIComponent(email)}${subject || body || from ? `?${new URLSearchParams(params).toString()}` : ""}`
      ];

      return schemas;
    },

    // Sipgate-Link generieren
    generateSipgateLink(phoneNumber) {
      if (!phoneNumber) return null;
      
      // Telefonnummer normalisieren (nur Zahlen + evtl. + für internationale Vorwahl)
      let cleanNumber = phoneNumber.toString().replace(/[^\d+]/g, '');
      
      if (!cleanNumber) return null;
      
      // Deutsche Nummern ohne Ländercode mit +49 ergänzen
      if (cleanNumber.startsWith('0') && !cleanNumber.startsWith('+')) {
        cleanNumber = '+49' + cleanNumber.substring(1);
      }
      
      // Sipgate Desktop App URL-Schema
      return `sipgate://phone/call?number=${cleanNumber}`;
    },

    getPhotoUrl(ma) {
      return this.flip.photoUrl(ma.flip) || null;
    },

    // Quick Actions
    showQuickActions(ma, event) {
      // Schließe andere offene Menüs
      this.activeQuickActionId = null;
      
      // Toggle aktuelles Menü
      this.$nextTick(() => {
        this.activeQuickActionId = this.activeQuickActionId === ma._id ? null : ma._id;
      });
      
      // Verhindere Event-Bubbling
      event.stopPropagation();
    },

    // Quick Action ausführen
    executeQuickAction(ma, action) {
      switch (action) {
        case 'sipgate':
          if (this.getPhoneNumber(ma)) {
            const sipgateUrl = this.generateSipgateLink(this.getPhoneNumber(ma));
            window.open(sipgateUrl, '_self');
          }
          break;
        case 'outlook':
          if (ma.email) {
            // Direkt mailto verwenden - funktioniert universell und öffnet Standard-E-Mail-App (meist Outlook auf euren Macs)
            const mailtoUrl = `mailto:${ma.email}`;
            
            try {
              window.open(mailtoUrl, '_self');
            } catch (error) {
              console.error('❌ mailto failed:', error);
            }
          }
          break;
        case 'edit':
          this.editMitarbeiter(ma);
          break;
        case 'profile':
          this.openProfile(ma);
          break;
      }
      
      // Menü schließen
      this.activeQuickActionId = null;
    },

    // Click outside handler
    handleClickOutside() {
      this.activeQuickActionId = null;
    },



    // List expansion
    toggleListExpansion(mitarbeiterId) {
      if (this.listExpandedIds.has(mitarbeiterId)) {
        this.listExpandedIds.delete(mitarbeiterId);
      } else {
        this.listExpandedIds.add(mitarbeiterId);
      }
      this.listExpandedIds = new Set(this.listExpandedIds);
    },

    // Personalnr editing
    startEditPersonalnr(ma) {
      this.editingPersonalnrId = ma._id;
      this.editingPersonalnrValue = ma.personalnr || '';
    },

    cancelEditPersonalnr() {
      this.editingPersonalnrId = null;
      this.editingPersonalnrValue = '';
    },

    async savePersonalnr(ma) {
      const newPersonalnr = this.editingPersonalnrValue.trim();
      
      // Validation
      if (!newPersonalnr) {
        alert('Bitte geben Sie eine Personalnummer ein.');
        return;
      }
      
      if (newPersonalnr === ma.personalnr) {
        // No change
        this.cancelEditPersonalnr();
        return;
      }
      
      try {
        const response = await api.patch(`/api/personal/mitarbeiter/${ma._id}/personalnr`, {
          personalnr: newPersonalnr
        });
        
        if (response.data.success) {
          // Update local data
          ma.personalnr = newPersonalnr;
          alert(`✓ Personalnummer erfolgreich aktualisiert auf: ${newPersonalnr}`);
          this.cancelEditPersonalnr();
        }
      } catch (error) {
        console.error('Error updating personalnr:', error);
        if (error.response?.data?.conflict) {
          alert(`⚠️ Konflikt: Diese Personalnummer ist bereits vergeben!\n\nVerwendet von: ${error.response.data.conflict.name}`);
        } else if (error.response?.data?.message) {
          alert(`Fehler: ${error.response.data.message}`);
        } else {
          alert('Fehler beim Aktualisieren der Personalnummer.');
        }
      }
    },

    // Selection management
    clearSelection() {
      this.selectedMitarbeiterIds.clear();
      this.selectedMitarbeiterIds = new Set();
    },

    // List sorting
    setSortBy(field) {
      if (this.listSortBy === field) {
        // Toggle sort direction if same field
        this.listIsAscending = !this.listIsAscending;
      } else {
        // Set new field and default to ascending
        this.listSortBy = field;
        this.listIsAscending = true;
      }
      // Reset to first page when sorting changes
      this.currentPage = 1;
    },

    // Pagination methods
    setPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },

    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },

    setItemsPerPage(count) {
      this.itemsPerPage = count;
      this.currentPage = 1; // Reset to first page
    },

    // Override filter methods to reset pagination
    setFilter(type, value) {
      this.filters[type] = value;
      this.currentPage = 1; // Reset to first page when filtering
      
      // Save filters to cookie immediately
      this.saveFiltersToCookie();
    },
    
    // Toggle Beruf filter (für Mehrfachauswahl)
    toggleBerufFilter(berufId) {
      const idx = this.filters.berufe.indexOf(berufId);
      if (idx >= 0) {
        this.filters.berufe.splice(idx, 1);
      } else {
        this.filters.berufe.push(berufId);
      }
      this.currentPage = 1;
      this.saveFiltersToCookie();
    },
    
    // Toggle Qualifikation filter (für Mehrfachauswahl)
    toggleQualifikationFilter(qualiId) {
      const idx = this.filters.qualifikationen.indexOf(qualiId);
      if (idx >= 0) {
        this.filters.qualifikationen.splice(idx, 1);
      } else {
        this.filters.qualifikationen.push(qualiId);
      }
      this.currentPage = 1;
      this.saveFiltersToCookie();
    },
    
    // Aktiviere Filter von extern (z.B. von EmployeeCard)
    activateBerufFilter(berufId) {
      if (!this.filters.berufe.includes(berufId)) {
        this.filters.berufe.push(berufId);
        this.currentPage = 1;
        this.saveFiltersToCookie();
      }
    },
    
    activateQualifikationFilter(qualiId) {
      if (!this.filters.qualifikationen.includes(qualiId)) {
        this.filters.qualifikationen.push(qualiId);
        this.currentPage = 1;
        this.saveFiltersToCookie();
      }
    },

    resetAllFilters() {
      this.filters = {
        status: "Alle",
        location: (this.userLocation && this.locations.includes(this.userLocation)) ? this.userLocation : "Alle",
        department: "Alle",
        flipStatus: "Alle",
        asanaStatus: "Alle",
        personalnrStatus: "Alle",
        profile: "Alle",
        teamleiter: "Alle",
        berufe: [],
        qualifikationen: []
      };
      this.mitarbeitersSearchQuery = "";
      this.currentPage = 1;
    },

    /* -------------------- Actions -------------------- */
    // Personalnr editing methods
    startEditPersonalnr(ma) {
      this.editingPersonalnrId = ma._id;
      this.editingPersonalnrValue = ma.personalnr || "";
    },

    cancelEditPersonalnr() {
      this.editingPersonalnrId = null;
      this.editingPersonalnrValue = "";
    },

    async savePersonalnr(ma) {
      const newPersonalnr = this.editingPersonalnrValue.trim();
      
      try {
        await api.patch(`/api/personal/mitarbeiter/${ma._id}/personalnr`, {
          personalnr: newPersonalnr
        });
        
        // Update local data
        const mitarbeiter = this.mitarbeiters.find(m => m._id === ma._id);
        if (mitarbeiter) {
          mitarbeiter.personalnr = newPersonalnr;
        }
        
        this.cancelEditPersonalnr();
      } catch (error) {
        console.error("Fehler beim Speichern der Personalnr:", error);
        
        // Show conflict details if available
        if (error.response?.status === 409 && error.response?.data?.conflict) {
          const conflict = error.response.data.conflict;
          alert(`⚠️ KONFLIKT: Diese Personalnummer wird bereits verwendet!\n\n` +
                `Von: ${conflict.name}\n` +
                `E-Mail: ${conflict.email}\n\n` +
                `Bitte wählen Sie eine andere Personalnummer.`);
        } else {
          alert("Fehler beim Speichern der Personalnummer: " + (error.response?.data?.message || error.message));
        }
      }
    },

    isEmployeeExpanded(ma) {
      if (!this.expandedEmployeeId) return false;
      
      // Normalize both IDs by removing dashes for comparison
      const normalizeId = (id) => String(id || '').replace(/-/g, '');
      const targetId = normalizeId(this.expandedEmployeeId);
      
      return (
        normalizeId(ma._id) === targetId ||
        normalizeId(ma.flip_id) === targetId ||
        normalizeId(ma.asana_id) === targetId
      );
    },

    openProfile(ma) {
      // TODO: Implement profile opening functionality
    },
    editMitarbeiter(ma) {
      // TODO: Implement mitarbeiter editing functionality
    },

    /* -------------------- API wiring -------------------- */
    setAxiosAuthToken() {
      if (this.token) {
        api.defaults.headers.common["x-auth-token"] = this.token;
      }
    },
    async fetchUserData() {
      if (!this.token) {
        this.$router.push("/");
        return;
      }
      try {
        const { data } = await api.get("/api/users/me");
        this.userEmail = data.email;
        this.userID = data._id;
        this.userName = data.name;
        this.userLocation = data.location;
        
        // Setze userLocation als Standard für Location-Filter, falls verfügbar und kein Cookie geladen wurde
        if (this.userLocation && this.locations.includes(this.userLocation) && !this.filtersLoadedFromCookie) {
          this.filters.location = this.userLocation;
        }
      } catch (e) {
        console.error("Fehler beim Abrufen der Benutzerdaten:", e);
        this.$router.push("/");
      }
    },
    async fetchMitarbeiters() {
      try {
        // Use cache store for optimized loading
        this.mitarbeiters = await this.dataCache.loadMitarbeiter();
      } catch (e) {
        this.error.mitarbeiter =
          e?.message || "Fehler beim Laden von Mitarbeitern.";
        console.error(this.error.mitarbeiter);
      } finally {
        this.loading.mitarbeiter = false;
      }
    },

    checkMobileAndSetGrid() {
      // Prüfe ob Mobile (768px Breakpoint) und setze automatisch Grid-View
      if (window.innerWidth <= 768 && this.mitarbeiterViewMode === 'list') {
        this.mitarbeiterViewMode = 'grid';
      }
    },

    scrollToExpandedEmployee() {
      if (this.expandedEmployeeId) {
        // Warte kurz, bis das DOM aktualisiert wurde
        this.$nextTick(() => {
          const card = document.querySelector('.highlight-card');
          if (card) {
            card.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            });
          }
        });
      }
    },
  },

  watch: {
    initiallyExpanded(newValue) {
      this.expanded = newValue;
    },
    'loading.mitarbeiter'(newValue) {
      // Wenn das Laden abgeschlossen ist und wir einen expandierten Mitarbeiter haben
      if (!newValue && this.expandedEmployeeId) {
        this.scrollToExpandedEmployee();
      }
    }
  },

  async mounted() {
    // Load saved filters from cookie before anything else
    this.loadFiltersFromCookie();
    
    // Check URL parameters for employee to expand
    const { mitarbeiter_id, asana_id, flip_id } = this.$route.query;
    this.expandedEmployeeId = mitarbeiter_id || asana_id || flip_id;
    
    // 1) Token setzen, damit der Flip-Store dieselbe Axios-Instanz mit Auth nutzt
    this.setAxiosAuthToken();

    // 2) API-Daten parallel laden (inkl. Berufe & Qualifikationen für Skills)
    await Promise.allSettled([
      this.fetchUserData(),
      this.fetchMitarbeiters(),
      this.dataCache.loadBerufe(),
      this.dataCache.loadQualifikationen(),
    ]);

    // 3) Alle Flip-User vorladen (für spätere Filter & Verknüpfung)
    try {
      await this.flip.fetchAll();
    } catch (e) {
      // Fehler ist bereits im Store protokolliert (this.flip.error)
      console.error("Flip-Users konnten nicht geladen werden:", e);
    }

    // Click outside handler für Quick Actions
    document.addEventListener('click', this.handleClickOutside);
    
    // Mobile Detection - erzwinge Grid-View auf Mobile
    this.checkMobileAndSetGrid();
    window.addEventListener('resize', this.checkMobileAndSetGrid);
  },

  beforeUnmount() {
    // Click outside handler cleanup
    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('resize', this.checkMobileAndSetGrid);
  },
};
</script>

<style scoped lang="scss">
/* Tokens an globale Variablen anbinden */
.people-page {
  --bg: var(--bg);
  --surface: var(--panel);
  --soft: var(--hover);
  --border: var(--border);
  --muted: var(--muted);
  --text: var(--text);
  --brand: var(--primary);
  --brand-ink: var(--primary);
  --ok: #21a26a;
  --warn: #f6a019;
  --bad: #e25555;
  --shadow: var(
    --shadow,
    0 1px 2px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.06)
  );
}

.main {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
.panel {
  padding: 20px;
}

/* Controls */
.controls {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

/* View Controls */
.view-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: var(--soft);
  border-radius: 8px;
  padding: 4px;
}

/* Mobile Hidden Utility Class */
@media (max-width: 768px) {
  .mobile-hidden {
    display: none !important;
  }
}

.view-btn {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: 140ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-btn:hover {
  background: var(--border);
  color: var(--text);
}

.view-btn.active {
  background: var(--brand);
  color: white;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  background: var(--brand);
  color: white;
  padding: 6px 10px;
  border-radius: 999px;
}

/* Filter Chips */
.filter-chips {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  background: var(--soft);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.chip-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  transition: all 200ms ease;
  position: relative;
}

.chip-group:hover {
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
  border-color: color-mix(in srgb, var(--brand) 30%, var(--border));
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.chip-label {
  color: var(--brand);
  font-weight: 700;
  margin-right: 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  
  svg {
    font-size: 12px;
  }
}

/* Dropdown Label Text & Badge */
.label-text {
  flex: 1;
}

.badge-small {
  background: var(--soft);
  color: var(--muted);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.no-options {
  padding: 12px;
  text-align: center;
  color: var(--muted);
  font-style: italic;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  cursor: pointer;
  transition: all 200ms ease;
  font-size: 13px;
  font-weight: 500;
}
.chip:hover {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}
.chip.active {
  background: transparent;
  border-color: var(--brand);
  color: var(--brand);
  box-shadow: inset 0 0 0 1px var(--brand);
  font-weight: 600;
}
.chip.active:hover {
  background: color-mix(in srgb, var(--brand) 5%, var(--surface));
}

.chip.reset-chip {
  background: linear-gradient(135deg, #f87171, #ef4444);
  border-color: #dc2626;
  color: white;
  font-weight: 600;
}
.chip.reset-chip:hover {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
}

.reset-button-container {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 8px;
}

.divider {
  width: 2px;
  height: 32px;
  background: linear-gradient(to bottom, 
    transparent 0%, 
    var(--border) 20%, 
    color-mix(in srgb, var(--brand) 40%, var(--border)) 50%,
    var(--border) 80%, 
    transparent 100%);
  border-radius: 1px;
  margin: 0 4px;
}

.search-sort {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 16px;
  align-items: center;
  isolation: isolate; /* Verhindert z-index Konflikte */
}
@container (max-width: 520px) {
  /* falls du container-queries nutzt */
  .search-sort {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .search-sort {
    grid-template-columns: 1fr;
  }
  
  .filter-chips {
    gap: 8px;
    padding: 12px;
  }
  
  .chip-group {
    padding: 6px 8px;
    min-width: 0;
  }
  
  .divider {
    display: none;
  }
  
  .chip-label {
    font-size: 10px;
  }
  
  .chip {
    padding: 4px 8px;
    font-size: 12px;
  }
}

.search {
  position: relative;
  z-index: 1;
  input {
    width: 100%;
    padding: 12px 38px 12px 40px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--text);
    outline: none;
    transition: 140ms ease;
  }
  input:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 15%, transparent);
  }
  .search-ic {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
  }
  .clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    border: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
  }
  .clear:hover {
    background: var(--soft);
    color: var(--text);
  }
}

.sort {
  position: relative;
  justify-self: end;
  z-index: 1;
}
.btn-ghost {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 12px;
  padding: 10px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: 140ms ease;
}
.btn-ghost:hover {
  box-shadow: var(--shadow);
}

.menu {
  position: absolute;
  right: 0;
  margin-top: 6px;
  min-width: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 6px;
  z-index: 10;
  display: grid;
}
.menu button {
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 10px;
  border-radius: 10px;
  color: var(--text);
}
.menu button:hover {
  background: var(--soft);
}
.menu .sep {
  border-top: 1px dashed var(--border);
  margin: 4px 8px;
  height: 0;
}

/* Grid View */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
  gap: 18px;
}

.employee-grid-item {
  position: relative;
}

.employee-grid-item.selected {
  transform: scale(0.98);
  opacity: 0.8;
}

.selection-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.selection-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--brand);
  cursor: pointer;
}

.quick-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.quick-actions-btn {
  border: 0;
  background: rgba(255, 255, 255, 0.9);
  color: var(--text);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: 140ms ease;
  backdrop-filter: blur(4px);
  box-shadow: var(--shadow);
}

.quick-actions-btn:hover {
  background: white;
  transform: scale(1.05);
}

/* List View */
.list {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.list-header {
  display: grid;
  grid-template-columns: 50px 60px 2fr 120px 120px 120px 120px 180px 80px;
  gap: 12px;
  align-items: center;
  background: var(--soft);
  padding: 12px 16px;
  font-weight: 700;
  font-size: 13px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.list-row {
  display: grid;
  grid-template-columns: 50px 60px 2fr 120px 120px 120px 120px 180px 80px;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  transition: 140ms ease;
  cursor: pointer;
}

/* Mobile-Hidden Klasse */
@media (max-width: 768px) {
  .mobile-hidden {
    display: none !important;
  }
  
  /* Erzwinge Grid-View auf Mobile durch Verstecken der Listenansicht */
  .list {
    display: none !important;
  }
  
  .list-header {
    display: none; /* Header verstecken auf Mobile */
  }
  
  .list-row {
    display: block;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  
  .list-col {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  
  /* Mobile Card Layout */
  .list-row {
    background: var(--surface);
    margin-bottom: 2px;
    min-height: 120px; /* Minimum height für bessere Touch-Erfahrung */
    border-radius: 8px;
    position: relative;
  }
  
  .list-row:hover {
    background: var(--soft);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .list-row.selected {
    background: color-mix(in srgb, var(--brand) 8%, var(--surface)) !important;
    border: 2px solid color-mix(in srgb, var(--brand) 25%, var(--border));
    box-shadow: 0 2px 12px color-mix(in srgb, var(--brand) 20%, transparent);
  }
  
  .list-col--checkbox {
    position: absolute;
    top: 16px;
    right: 16px;
    width: auto;
    padding: 8px; /* Größeres Touch-Target */
  }
  
  .list-col--expand {
    position: absolute;
    top: 16px;
    left: 16px;
    width: auto;
    padding: 8px; /* Größeres Touch-Target */
  }
  
  /* Größere Checkboxen für Mobile */
  .selection-checkbox {
    width: 20px !important;
    height: 20px !important;
    accent-color: var(--brand);
    cursor: pointer;
  }
  
  /* Größere Expand-Buttons für Mobile */
  .expand-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: var(--soft);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    cursor: pointer;
  }
  
  .expand-btn:hover {
    background: var(--border);
    color: var(--text);
  }
  
  .expand-btn.expanded {
    transform: rotate(90deg);
    background: var(--brand);
    color: white;
  }
  
  /* Actions Button für Mobile */
  .list-col--actions {
    position: absolute;
    bottom: 12px;
    right: 16px;
    width: auto;
  }
  
  .quick-actions-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: var(--soft);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .quick-actions-btn:hover,
  .quick-actions-btn.active {
    background: var(--brand);
    color: white;
  }
  
  .list-col--avatar {
    display: none; /* Avatar verstecken auf Mobile für mehr Platz */
  }
  
  .list-col--name {
    margin-top: 8px;
    margin-left: 48px; /* Platz für Expand-Button */
    margin-right: 48px; /* Platz für Checkbox */
    margin-bottom: 8px;
  }
  
  .list-col--name .name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    margin-bottom: 4px;
  }
  
  .list-col--status,
  .list-col--location,
  .list-col--department {
    display: inline-block;
    width: auto;
    margin-right: 12px;
    margin-bottom: 8px;
  }
  
  .list-col--trinity {
    margin: 8px 0;
  }
  
  .list-col--actions {
    margin-top: 8px;
    text-align: center;
  }
  
  /* Desktop-Only Elemente verstecken */
  .desktop-only {
    display: none !important;
  }
  
  /* Mobile Info Layout */
  .mobile-info-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0;
    margin-left: 48px;
    margin-right: 48px;
  }
  
  .mobile-info-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--soft);
    border-radius: 16px;
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }
  
  .mobile-info-item .value {
    color: var(--text);
    font-weight: 600;
  }
  
  .mobile-info-item svg {
    width: 12px;
    height: 12px;
  }
  
  /* Mobile Trinity Status Layout */
  .mobile-trinity-row {
    display: flex;
    gap: 12px;
    margin: 12px 0;
    margin-left: 48px;
    margin-right: 48px;
    justify-content: space-around;
  }
  
  .mobile-trinity-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--soft);
    border-radius: 12px;
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
    min-width: 0;
  }
  
  .mobile-trinity-item.active {
    background: #e8fbf3;
    color: #1f8e5d;
  }
  
  .mobile-trinity-item.linked {
    background: #eff6ff;
    color: #1e40af;
  }
  
  .mobile-trinity-item.inactive,
  .mobile-trinity-item.unlinked {
    background: #fee7e7;
    color: #d42f2f;
  }
  
  .mobile-trinity-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }
  
  .mobile-trinity-item svg {
    width: 16px;
    height: 16px;
  }
}

.list-row:hover {
  background: var(--soft);
}

.list-row.selected {
  background: color-mix(in srgb, var(--brand) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--brand) 25%, var(--border));
}

.list-row.highlight-card {
  background: color-mix(in srgb, var(--brand) 12%, var(--surface));
  animation: highlight-pulse 1s ease-out;
}

/* Mobile-Info verstecken auf Desktop */
.mobile-info-row,
.mobile-trinity-row {
  display: none;
}

.list-col {
  display: flex;
  align-items: center;
  min-width: 0;
}

.list-col--checkbox {
  justify-content: center;
}

.list-col--avatar {
  justify-content: center;
}

.list-col--name .name {
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-col--name .email {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-col--actions {
  justify-content: center;
}

.select-all-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--brand);
  cursor: pointer;
}

/* Avatar in List */
.list .avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  background: hsl(0, 0%, calc(40% + (var(--hue, 0) / 360 * 35%)));
  color: white;
}

.list .avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
}

/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #e8fbf3;
  color: #1f8e5d;
}

.status-badge.inactive {
  background: #fee7e7;
  color: #d42f2f;
}

/* Personalnr Badge */
.personalnr-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #e8fbf3;
  color: #1f8e5d;
}

.personalnr-badge.missing {
  background: #fff3cd;
  color: #856404;
}

.personalnr-badge.missing::after {
  content: "⚠️";
  margin-left: 4px;
}

/* Trinity Status */
.trinity-status {
  display: flex;
  gap: 6px;
}

.trinity-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 10px;
}

.trinity-badge.active {
  background: #e8fbf3;
  color: #1f8e5d;
}

.trinity-badge.linked {
  background: #e9f8ff;
  color: #1976d2;
}

.trinity-badge.complete {
  background: #e8fbf3;
  color: #1f8e5d;
}

.trinity-badge.locked {
  background: #fff4e6;
  color: #c65d21;
}

.trinity-badge.deleted {
  background: #fee7e7;
  color: #d42f2f;
}

.trinity-badge.not-linked,
.trinity-badge.incomplete,
.trinity-badge.unknown {
  background: #f5f5f5;
  color: #9ca3af;
}

/* Skeleton Updates */
.grid--skeleton .skel {
  height: 200px;
  background: var(--soft);
  border-radius: 12px;
  animation: pulse 2s ease-in-out infinite;
}

.list--skeleton {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.list--skeleton .skel {
  height: 60px;
  background: var(--soft);
  border-bottom: 1px solid var(--border);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}



.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Highlight animation for expanded card */
.highlight-card {
  position: relative;
  animation: highlight-pulse 2s ease-out;
  z-index: 1;
}

@keyframes highlight-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 50%, transparent);
    transform: translateY(0);
  }
  50% {
    box-shadow: 0 0 0 10px color-mix(in srgb, var(--brand) 0%, transparent);
    transform: translateY(-4px);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--brand) 0%, transparent);
    transform: translateY(0);
  }
}

/* Scroll expanded card into view smoothly */
html {
  scroll-behavior: smooth;
}

/* Grid and List View Styles */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 0.5rem;
}

/* List View */
.list {
  padding: 0.5rem;
}

.list-header {
  display: grid;
  grid-template-columns: 40px 40px 60px 1fr 120px 100px 100px 120px 120px 80px;
  gap: 1rem;
  padding: 0.375rem 1rem;
  border-bottom: 2px solid var(--border);
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.list-header-sortable {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    color: var(--text);
    background: var(--soft);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    margin: -0.25rem -0.5rem;
  }
}

.sort-indicator {
  font-size: 0.75rem;
  color: var(--brand);
  opacity: 0.8;
}

.list-row {
  display: grid;
  grid-template-columns: 40px 40px 60px 1fr 120px 100px 100px 120px 120px 80px;
  gap: 1rem;
  padding: 0.25rem 1rem;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  margin: 0.125rem 0;
  min-height: 44px;
  
  &:hover {
    background: var(--soft);
  }
  
  &.selected {
    background: color-mix(in srgb, var(--brand) 10%, var(--surface));
    border-color: var(--brand);
  }
  
  &.highlight-card {
    background: color-mix(in srgb, var(--brand) 10%, var(--surface));
    box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 15%, transparent);
  }
  
  &.expanded {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
}

.list-col {
  display: flex;
  align-items: center;
  
  &--checkbox {
    justify-content: center;
  }
  
  &--expand {
    justify-content: center;
  }
  
  &--avatar {
    justify-content: center;
  }
  
  &--name {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    min-width: 0;
  }
  
  &--status {
    justify-content: center;
  }
  
  &--location {
    justify-content: center;
    font-weight: 500;
  }
  
  &--department {
    justify-content: center;
    font-weight: 500;
  }
  
  &--createdby {
    justify-content: center;
    font-size: 0.8rem;
    color: var(--muted);
  }

  &--trinity {
    justify-content: center;
  }
  
  &--actions {
    justify-content: center;
  }
}

.expand-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--muted);
  
  &:hover {
    background: var(--soft);
    color: var(--text);
  }
  
  &.expanded {
    transform: rotate(90deg);
    color: var(--brand);
  }
}

.name {
  font-weight: 600;
  color: var(--text);
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email {
  color: var(--muted);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: hsl(0, 0%, calc(40% + (var(--hue, 0) / 360 * 35%)));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.75rem;
}

.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  
  &.active {
    background: rgba(34, 197, 94, 0.1);
    color: #059669;
  }
  
  &.inactive {
    background: rgba(107, 114, 128, 0.1);
    color: #6b7280;
  }
}

.trinity-status {
  display: flex;
  gap: 0.5rem;
}

.trinity-badge {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  transition: all 0.2s ease;
  
  &.linked {
    background: rgba(34, 197, 94, 0.2);
    color: #059669;
  }
  
  &.unlinked {
    background: rgba(239, 68, 68, 0.2);
    color: #dc2626;
  }
  
  &.partial {
    background: rgba(245, 158, 11, 0.2);
    color: #d97706;
  }
  
  &.complete {
    background: rgba(34, 197, 94, 0.2);
    color: #059669;
  }
  
  &.incomplete {
    background: rgba(239, 68, 68, 0.2);
    color: #dc2626;
  }

  &.active {
    background: rgba(34, 197, 94, 0.2);
    color: #059669;
  }

  &.inactive {
    background: rgba(239, 68, 68, 0.2);
    color: #dc2626;
  }
}

.trinity-logo {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

.list-expansion {
  grid-column: 1 / -1;
  background: var(--soft);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 4px 4px;
  padding: 1rem;
  margin: 0 0.125rem;
}

.expansion-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.expansion-section {
  h4 {
    margin: 0 0 0.5rem 0;
    color: var(--brand);
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  p {
    margin: 0.25rem 0;
    font-size: 0.8rem;
    color: var(--text);
    
    strong {
      color: var(--muted);
    }
  }
}

/* Personalnr row editing styles */
.personalnr-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.personalnr-input {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.8rem;
  background: var(--surface);
  color: var(--text);
  width: 120px;
  
  &:focus {
    outline: none;
    border-color: var(--brand);
  }
}

.edit-btn-inline,
.save-btn-inline,
.cancel-btn-inline {
  padding: 0.25rem 0.4rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.edit-btn-inline {
  background: transparent;
  color: var(--muted);
  
  &:hover {
    background: var(--hover);
    color: var(--brand);
  }
}

.save-btn-inline {
  background: color-mix(in srgb, var(--success, #22c55e) 15%, transparent);
  color: var(--success, #22c55e);
  
  &:hover {
    background: color-mix(in srgb, var(--success, #22c55e) 25%, transparent);
  }
}

.cancel-btn-inline {
  background: color-mix(in srgb, var(--danger, #ef4444) 15%, transparent);
  color: var(--danger, #ef4444);
  
  &:hover {
    background: color-mix(in srgb, var(--danger, #ef4444) 25%, transparent);
  }
}

.phone-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--brand);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-weight: 500;
  
  &:hover {
    background: color-mix(in srgb, var(--brand) 10%, var(--surface));
    color: var(--brand);
    text-decoration: none;
    transform: translateY(-1px);
  }
  
  .fa-phone {
    font-size: 0.75rem;
  }
}

/* View Controls Section (below search bar) */
.view-controls-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}

.view-controls-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* View Controls */
.view-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
}

.view-toggle {
  display: flex;
  background: var(--soft);
  border-radius: 4px;
  padding: 0.25rem;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  color: var(--muted);
  
  &:hover {
    color: var(--text);
  }
  
  &.active {
    background: var(--surface);
    color: var(--brand);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
}

/* Chip Styles */
.chip-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip-label {
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
}

.chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  white-space: nowrap;
  
  &:hover {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 5%, var(--surface));
  }
  
  &.active {
    background: transparent;
    border-color: var(--brand);
    color: var(--brand);
    box-shadow: inset 0 0 0 1px var(--brand);
  }
  
  &.reset-chip {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #6b7280;
    
    &:hover {
      background: #e5e7eb;
      border-color: #9ca3af;
      color: #374151;
    }
  }
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 0.5rem;
}

/* Selection Info */
.selection-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.selection-count {
  font-size: 0.875rem;
  color: var(--muted);
  font-weight: 500;
}

.btn-clear {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--soft);
    border-color: var(--brand);
  }
}

.selection-checkbox,
.select-all-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:checked {
    background: var(--brand);
    border-color: var(--brand);
  }
  
  &:hover {
    border-color: var(--brand);
    background: color-mix(in srgb, var(--brand) 10%, var(--surface));
  }
}

// Quick Actions
.quick-actions-wrapper {
  position: relative;
}

.quick-actions-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  
  &:hover {
    background: var(--surface);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  &.active {
    background: var(--brand);
    color: white;
  }
}

.quick-actions-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 180px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 8px 0;
  
  .action-group {
    &:not(:last-child) {
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
      padding-bottom: 8px;
    }
  }
  
  .action-group-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    padding: 4px 12px 8px;
  }
  
  .quick-action-item {
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
    color: var(--text);
    transition: all 0.15s ease;
    
    &:hover {
      background: var(--soft);
      color: var(--brand);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      
      &:hover {
        background: transparent;
        color: var(--text);
      }
    }
    
    .fa-phone { color: #22c55e; }
    .fa-mobile-screen { color: #00b8d4; }
    .fa-envelope { color: #f59e0b; }
    .fa-laptop-code { color: #3b82f6; }
    .fa-user { color: var(--brand); }
    .fa-edit { color: #8b5cf6; }
  }
}

/* Compact Pagination Styles */
.pagination-compact {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.pagination-info-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-text {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
}

.pagination-select-compact {
  padding: 0.125rem 0.25rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  min-width: 50px;
  
  &:hover {
    border-color: var(--brand);
  }
  
  &:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand) 20%, transparent);
  }
}

.pagination-controls-compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pagination-btn-compact {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  
  &:hover:not(:disabled) {
    background: var(--soft);
    border-color: var(--brand);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.page-indicator {
  font-size: 0.8rem;
  color: var(--muted);
  padding: 0 0.25rem;
  white-space: nowrap;
}

/* Loading Styles */
.loading-container {
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  padding: 60px; 
  color: var(--muted);
}

.loading-spinner {
  font-size: 40px; 
  margin-bottom: 16px; 
  color: var(--primary);
}

.loading-text {
  font-size: 1.1rem; 
  font-weight: 500;
}

/* Mobile Responsive Optimierungen */
@media (max-width: 768px) {
/* ==================== MINIMIERBARE FILTER SEKTION ==================== */
  .people-docs-modern {
    padding: 12px 8px;
  }
  
  .view-controls-section {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .view-controls-left {
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .pagination-compact {
    justify-content: center;
  }
  
  /* Search & Filter mobile */
  .search-sort {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .search-container {
    width: 100%;
  }
  
  /* Cards kompakter */
  .grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 0.25rem;
  }
  
  /* List View mobile - horizontal scroll */
  .list-header, .list-row {
    grid-template-columns: 60px 150px 120px 120px 100px 60px;
    min-width: 610px;
  }
  
  .list {
    overflow-x: auto;
    padding: 0.25rem;
  }
  
  /* Buttons kleiner */
  .view-toggle-btn {
    padding: 6px 8px;
    font-size: 12px;
  }
  
  .chip {
    padding: 4px 8px;
    font-size: 12px;
  }


@media (max-width: 480px) {
  .people-docs-modern {
    padding: 8px 4px;
  }
  
  .view-controls-left {
    gap: 6px;
  }
  
  .view-toggle-btn {
    padding: 4px 6px;
    min-width: 32px;
  }
  
  .chip {
    padding: 3px 6px;
    font-size: 11px;
  }
  
  .pagination-btn-compact {
    width: 32px;
    height: 32px;
  }
  
  .filter-chips {
    gap: 6px;
  }
  
  .chip-group {
    margin-bottom: 8px;
  }
  
  .chip {
    padding: 4px 8px;
    font-size: 11px;
  }
}

}
/* Skeletons, Empty etc. bleiben wie gehabt */

/* Compact Filter Styles */
.clickable {
    cursor: pointer;
}

.dropdown-item.selected {
    background-color: color-mix(in srgb, var(--brand) 10%, transparent);
    color: var(--brand);
    font-weight: 500;
}

.dropdown-item.selected:hover {
    background-color: color-mix(in srgb, var(--brand) 20%, transparent);
}
</style>
