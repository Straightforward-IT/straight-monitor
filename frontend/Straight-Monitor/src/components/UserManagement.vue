<template>
  <section class="um">
    <h1 class="um__title">Monitor<span>verwaltung</span></h1>

    <nav class="management-tabs" aria-label="Monitorverwaltung">
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'locations' }" @click="activeTab = 'locations'">
        <font-awesome-icon icon="fa-solid fa-location-dot" />
        Standorte
      </button>
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'users' }" @click="activeTab = 'users'">
        <font-awesome-icon icon="fa-solid fa-users" />
        Benutzer
      </button>
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'applicants' }" @click="activeTab = 'applicants'">
        <font-awesome-icon icon="fa-solid fa-envelope" />
        Bewerbermanagement
      </button>
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'emailTemplates' }" @click="activeTab = 'emailTemplates'">
        <font-awesome-icon icon="fa-solid fa-envelope-open-text" />
        E-Mail-Vorlagen
      </button>
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'qualifikationen' }" @click="activeTab = 'qualifikationen'">
        <font-awesome-icon icon="fa-solid fa-graduation-cap" />
        Qualif. &amp; Berufe
      </button>
      <button type="button" :class="{ 'management-tabs__tab--active': activeTab === 'lohn' }" @click="activeTab = 'lohn'">
        <font-awesome-icon icon="fa-solid fa-money-bill-wave" />
        Lohn
      </button>
    </nav>

    <template v-if="activeTab === 'locations'">
    <section class="locations">
      <div class="locations__header">
        <ToolbarButton @click="openLocationCreate">
          <font-awesome-icon icon="fa-solid fa-plus" />
          Standort anlegen
        </ToolbarButton>
      </div>
      <p v-if="locationError" class="um__error">{{ locationError }}</p>
      <p v-else-if="locationsLoading" class="locations__state">Standorte werden geladen…</p>
      <div v-else class="locations__list">
        <div v-for="location in locations" :key="location._id" class="location-row" :class="{ 'location-row--inactive': !location.isActive }">
          <span class="location-row__short" :style="{ color: location.color || '#6b7280' }">{{ location.shortName }}</span>
          <span class="location-row__details"><b>{{ location.nameFull }}</b><small>{{ formatLocationAddress(location.address) || 'Keine Adresse hinterlegt' }}</small><small v-if="location.locationManager">Leitung: {{ location.locationManager.name || location.locationManager.email }}</small></span>
          <span class="location-row__status">{{ location.isActive ? 'Aktiv' : 'Inaktiv' }}</span>
          <button type="button" class="btn-icon" title="Standort bearbeiten" @click="openLocationEdit(location)">
            <font-awesome-icon icon="fa-solid fa-pen" />
          </button>
          <button type="button" class="btn-icon" :title="location.isActive ? 'Standort deaktivieren' : 'Standort aktivieren'" @click="toggleLocation(location)">
            <font-awesome-icon :icon="location.isActive ? 'fa-solid fa-ban' : 'fa-solid fa-check'" />
          </button>
        </div>
      </div>
    </section>

    <div v-if="locationModal.open" class="modal-backdrop" @click.self="closeLocationModal">
      <form class="modal-content modal-content--location" @submit.prevent="saveLocation">
        <header class="modal-header">
          <h3>{{ locationModal.isNew ? 'Standort anlegen' : 'Standort bearbeiten' }}</h3>
          <button type="button" class="close-btn" @click="closeLocationModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <nav class="location-modal-tabs" aria-label="Standortfelder">
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'general' }" @click="locationModal.activeTab = 'general'">Stammdaten</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'contact' }" @click="locationModal.activeTab = 'contact'">Kontakt & Rechtliches</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'hours' }" @click="locationModal.activeTab = 'hours'">Öffnungszeiten</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'logistics' }" @click="locationModal.activeTab = 'logistics'">Sonstiges</button>
        </nav>
        <div class="modal-body">
          <template v-if="locationModal.activeTab === 'general'">
          <div class="form-grid">
            <div class="form-group"><label>Name <span class="required">*</span></label><input v-model="locationForm.nameFull" type="text" required /></div>
            <div class="form-group"><label>Kürzel <span class="required">*</span></label><input v-model="locationForm.shortName" type="text" maxlength="8" required /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Standortfarbe</label><input v-model="locationForm.color" class="location-color-input" type="color" /></div>
          </div>
          <div class="form-grid location-form-grid--address">
            <div class="form-group"><label>Straße</label><input v-model="locationForm.address.street" type="text" /></div>
            <div class="form-group"><label>Hausnummer</label><input v-model="locationForm.address.houseNumber" type="text" /></div>
            <div class="form-group"><label>PLZ</label><input v-model="locationForm.address.postalCode" type="text" inputmode="numeric" /></div>
            <div class="form-group"><label>Ort</label><input v-model="locationForm.address.city" type="text" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Land</label><input v-model="locationForm.address.country" type="text" /></div>
            <div class="form-group"><label>Standortleitung</label><select v-model="locationForm.locationManager"><option value="">Nicht zugeordnet</option><option v-for="user in users" :key="user._id" :value="user._id">{{ user.name || user.email }}</option></select></div>
          </div>
          </template>
          <template v-else-if="locationModal.activeTab === 'contact'">
          <div class="form-grid">
            <div class="form-group"><label>Haupt-E-Mail</label><input v-model="locationForm.contact.mainEmail" type="email" /></div>
            <div class="form-group"><label>Telefon</label><input v-model="locationForm.contact.phone" type="tel" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Zeitzone</label><input v-model="locationForm.timeZone" type="text" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Rechtsträger</label><input v-model="locationForm.legal.legalName" type="text" /></div>
            <div class="form-group"><label>USt-ID</label><input v-model="locationForm.legal.vatId" type="text" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Handelsregister</label><input v-model="locationForm.legal.registrationNumber" type="text" /></div>
          </div>
          </template>
          <section v-else-if="locationModal.activeTab === 'hours'" class="opening-hours">
            <div class="opening-hours__header"><label>Öffnungszeiten</label><small>Mehrere Zeitfenster pro Tag möglich</small></div>
            <div v-for="day in WEEKDAYS" :key="day.key" class="opening-hours__day">
              <span class="opening-hours__day-name">{{ day.label }}</span>
              <div class="opening-hours__slots">
                <div v-for="(slot, index) in locationForm.openingHours[day.key]" :key="index" class="opening-hours__slot">
                  <input v-model="slot.start" type="time" :aria-label="`${day.label} von`" />
                  <span>bis</span>
                  <input v-model="slot.end" type="time" :aria-label="`${day.label} bis`" />
                  <button type="button" class="btn-icon" title="Zeitfenster entfernen" @click="removeOpeningHour(day.key, index)"><font-awesome-icon icon="fa-solid fa-trash" /></button>
                </div>
                <button type="button" class="opening-hours__add" @click="addOpeningHour(day.key)"><font-awesome-icon icon="fa-solid fa-plus" /> Zeitfenster</button>
              </div>
            </div>
          </section>
          <template v-else>
          <div class="form-group"><label>Externe ID</label><input v-model="locationForm.externalId" type="text" /></div>
          <div class="form-group"><label>Anlieferhinweise</label><textarea v-model="locationForm.deliveryNotes" rows="3" /></div>
          </template>
          <p v-if="locationModal.error" class="modal-error">{{ locationModal.error }}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="closeLocationModal">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="locationSaving || !canCreateLocation"><font-awesome-icon :icon="locationSaving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="locationSaving" /> {{ locationModal.isNew ? 'Anlegen' : 'Speichern' }}</button>
        </footer>
      </form>
    </div>
    </template>

    <section v-else-if="activeTab === 'users'" class="users">
      <Toolbar>
      <SearchBar class="toolbar-search" v-model="searchQuery" placeholder="Benutzer suchen…" aria-label="Benutzer suchen" />
      <ToolbarLabel>{{ filteredUsers.length }} Benutzer</ToolbarLabel>
      <ToolbarGroup push-right>
        <ToolbarButton variant="secondary" @click="openCreate">
          <font-awesome-icon icon="fa-solid fa-plus" />
          Neuer Benutzer
        </ToolbarButton>
      </ToolbarGroup>
      </Toolbar>

      <!-- Fehlermeldung -->
      <div v-if="error" class="um__error">{{ error }}</div>

      <!-- Tabelle -->
      <div class="um__table-wrap">
        <table class="um__table" v-if="!loading">
        <thead>
          <tr>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Standort</th>
            <th>Mitarbeiter</th>
            <th>Asana</th>
            <th>Rolle</th>
            <th>Bestätigt</th>
            <th>Registriert</th>
            <th class="th-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
        <tr v-for="u in filteredUsers" :key="u._id" :class="{ 'row--self': u._id === currentUserId }">
            <td>{{ u.name || '—' }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.location || '—' }}</td>
            <td>
              <span v-if="u.mitarbeiter" class="ma-link-tag">
                <font-awesome-icon icon="fa-solid fa-user-tie" />
                {{ u.mitarbeiter.vorname }} {{ u.mitarbeiter.nachname }}
                <span v-if="u.mitarbeiter.personalnr" class="ma-link-nr">#{{ u.mitarbeiter.personalnr }}</span>
              </span>
              <span v-else class="ma-unlinked">—</span>
            </td>
            <td>
              <span v-if="u.asana_id" class="asana-link-tag">
                <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
                {{ asanaUserMap[u.asana_id]?.name || u.asana_id }}
              </span>
              <span v-else class="ma-unlinked">—</span>
            </td>
            <td>
              <div class="badge-list">
                <span
                  v-for="r in (u.roles?.length ? u.roles : [u.role || 'USER'])"
                  :key="r"
                  class="badge"
                  :class="r === 'ADMIN' ? 'badge--admin' : r === 'VERTRIEB' ? 'badge--vertrieb' : r === 'PAYROLL' ? 'badge--payroll' : 'badge--user'"
                >
                  {{ r }}
                </span>
              </div>
            </td>
            <td>
              <span class="status" :class="u.isConfirmed ? 'status--ok' : 'status--no'">
                {{ u.isConfirmed ? 'Ja' : 'Nein' }}
              </span>
            </td>
            <td>{{ formatDate(u.date) }}</td>
            <td class="td-actions">
              <button class="btn-icon" title="Bearbeiten" @click="openEdit(u)">
                <font-awesome-icon icon="fa-solid fa-pen" />
              </button>
              <button
                class="btn-icon btn-icon--link"
                :title="u.mitarbeiter ? 'Mitarbeiter-Verknüpfung bearbeiten' : 'Mit Mitarbeiter verknüpfen'"
                @click="openLink(u)"
              >
                <font-awesome-icon :icon="u.mitarbeiter ? 'fa-solid fa-link' : 'fa-solid fa-link'" />
              </button>
              <button
                class="btn-icon btn-icon--asana"
                :title="u.asana_id ? 'Asana-Verknüpfung bearbeiten' : 'Mit Asana-User verknüpfen'"
                @click="openAsanaLink(u)"
              >
                <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
              </button>
              <button
                class="btn-icon btn-icon--danger"
                title="Löschen"
                :disabled="u._id === currentUserId"
                @click="openDelete(u)"
              >
                <font-awesome-icon icon="fa-solid fa-trash" />
              </button>
            </td>
          </tr>
        </tbody>
        </table>
        <div v-else class="um__loading">
          <font-awesome-icon icon="fa-solid fa-spinner" spin />
          Wird geladen…
        </div>
      </div>
    </section>

    <BewerberManagementTab v-else-if="activeTab === 'applicants'" :locations="activeLocations" />

    <EmployeeEmailTemplateTab v-else-if="activeTab === 'emailTemplates'" :locations="activeLocations" />

    <section v-else-if="activeTab === 'lohn'" class="lohn">
      <Toolbar>
        <SearchBar class="toolbar-search" v-model="lohnartSearch" placeholder="Lohnart suchen..." aria-label="Lohnart suchen" />
        <ToolbarLabel>{{ filteredLohnarten.length }} Lohnarten</ToolbarLabel>
      </Toolbar>
      <p v-if="lohnartError" class="um__error">{{ lohnartError }}</p>
      <p v-else-if="lohnartenLoading" class="lohn__state">Lohnarten werden geladen...</p>
      <div v-else class="um__table-wrap">
        <table class="um__table">
          <thead>
            <tr>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('lohnartNummer')">Nr.<font-awesome-icon v-if="lohnartSortField === 'lohnartNummer'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('lohnartKurzzeichen')">Kürzel<font-awesome-icon v-if="lohnartSortField === 'lohnartKurzzeichen'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('lohnartBezeichnung')">Bezeichnung<font-awesome-icon v-if="lohnartSortField === 'lohnartBezeichnung'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('rechnungstext')">Rechnungstext<font-awesome-icon v-if="lohnartSortField === 'rechnungstext'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('kostenart')">Kostenart<font-awesome-icon v-if="lohnartSortField === 'kostenart'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('berechnungsartCode')">Berechnungsart<font-awesome-icon v-if="lohnartSortField === 'berechnungsartCode'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th class="lohn__th--zuschlag"><button type="button" class="lohn__sort-button" @click="sortLohnarten('zuschlagsProzent')">Zuschlag<font-awesome-icon v-if="lohnartSortField === 'zuschlagsProzent'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
              <th><button type="button" class="lohn__sort-button" @click="sortLohnarten('equalPayRelevanz')">Equal Pay<font-awesome-icon v-if="lohnartSortField === 'equalPayRelevanz'" :icon="lohnartSortDirection === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down'" /></button></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lohnart in filteredLohnarten" :key="lohnart._id">
              <td><span class="quali-key">{{ lohnart.lohnartNummer }}</span></td>
              <td><span v-if="lohnart.lohnartKurzzeichen" class="beruf-tag">{{ lohnart.lohnartKurzzeichen }}</span><span v-else class="ma-unlinked">-</span></td>
              <td>{{ lohnart.lohnartBezeichnung || '-' }}</td>
              <td>{{ lohnart.rechnungstext || '-' }}</td>
              <td>{{ lohnart.kostenart || '-' }}</td>
              <td>{{ lohnart.berechnungsartCode || '-' }}</td>
              <td class="lohn__zuschlag">{{ lohnart.zuschlagsProzent || '-' }}</td>
              <td>{{ lohnart.equalPayRelevanz || '-' }}</td>
            </tr>
            <tr v-if="!filteredLohnarten.length">
              <td colspan="8" style="text-align:center; opacity:0.45; padding: 24px;">Keine Lohnarten vorhanden.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="activeTab === 'qualifikationen'" class="qualifikationen">
      <nav class="subtabs" aria-label="Qualifikationen und Berufe">
        <button type="button" :class="{ active: qualiSubTab === 'qualifikation' }" @click="qualiSubTab = 'qualifikation'">
          <font-awesome-icon icon="fa-solid fa-graduation-cap" /> Qualifikationen
        </button>
        <button type="button" :class="{ active: qualiSubTab === 'berufe' }" @click="qualiSubTab = 'berufe'">
          <font-awesome-icon icon="fa-solid fa-briefcase" /> Berufe
        </button>
      </nav>

      <template v-if="qualiSubTab === 'qualifikation'">
      <Toolbar>
        <SearchBar class="toolbar-search" v-model="qualiSearch" placeholder="Qualifikation suchen…" aria-label="Qualifikation suchen" />
        <ToolbarLabel>{{ filteredQualifikationen.length }} Qualifikationen</ToolbarLabel>
        <ToolbarGroup push-right>
          <ToolbarButton @click="openQualiCreate">
            <font-awesome-icon icon="fa-solid fa-plus" />
            Qualifikation anlegen
          </ToolbarButton>
        </ToolbarGroup>
      </Toolbar>
      <p v-if="qualiError" class="um__error">{{ qualiError }}</p>
      <p v-else-if="qualiLoading" class="qualifikationen__state">Qualifikationen werden geladen…</p>
      <template v-else>
        <nav class="quali-beruf-tabs" aria-label="Berufsgruppe">
          <button
            type="button"
            :class="{ 'quali-beruf-tabs__tab--active': selectedBerufFilter === null }"
            @click="selectedBerufFilter = null"
          >
            Alle
            <span class="tab-count">{{ qualifikationen.length }}</span>
          </button>
          <button
            v-for="b in qualiBerufTabs"
            :key="b.id"
            type="button"
            :class="{ 'quali-beruf-tabs__tab--active': selectedBerufFilter === b.id }"
            @click="selectedBerufFilter = b.id"
          >
            {{ b.label }}
            <span class="tab-count">{{ b.count }}</span>
          </button>
        </nav>
        <div class="um__table-wrap">
          <table class="um__table">
            <thead>
              <tr>
                <th>Schlüssel</th>
                <th>Bezeichnung</th>
                <th v-if="selectedBerufFilter === null">Beruf</th>
                <th>Mitarbeiter</th>
                <th class="th-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in filteredQualifikationen" :key="q._id">
                <td><span class="quali-key">#{{ q.qualificationKey }}</span></td>
                <td>{{ q.designation }}</td>
                <td v-if="selectedBerufFilter === null">
                  <span v-if="q.beruf" class="beruf-tag">#{{ q.beruf.jobKey }} {{ q.beruf.designation }}</span>
                  <span v-else class="ma-unlinked">—</span>
                </td>
                <td>
                  <span v-if="q.mitarbeiterCount" class="quali-ma-count">{{ q.mitarbeiterCount }}</span>
                  <span v-else class="ma-unlinked">0</span>
                </td>
                <td class="td-actions">
                  <button type="button" class="btn-icon" title="Bearbeiten" @click="openQualiEdit(q)">
                    <font-awesome-icon icon="fa-solid fa-pen" />
                  </button>
                  <button type="button" class="btn-icon btn-icon--danger" title="Löschen" @click="openQualiDelete(q)">
                    <font-awesome-icon icon="fa-solid fa-trash" />
                  </button>
                </td>
              </tr>
              <tr v-if="!filteredQualifikationen.length">
                <td :colspan="selectedBerufFilter === null ? 5 : 4" style="text-align:center; opacity:0.45; padding: 24px;">Keine Qualifikationen vorhanden.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      </template>

      <template v-else>
      <Toolbar>
        <SearchBar class="toolbar-search" v-model="berufSearch" placeholder="Beruf suchen…" aria-label="Beruf suchen" />
        <ToolbarLabel>{{ filteredBerufe.length }} Berufe</ToolbarLabel>
        <ToolbarGroup push-right>
          <ToolbarButton @click="openBerufCreate">
            <font-awesome-icon icon="fa-solid fa-plus" />
            Beruf anlegen
          </ToolbarButton>
        </ToolbarGroup>
      </Toolbar>
      <p v-if="qualiError" class="um__error">{{ qualiError }}</p>
      <p v-else-if="qualiLoading" class="qualifikationen__state">Berufe werden geladen…</p>
      <div v-else class="um__table-wrap">
        <table class="um__table">
          <thead>
            <tr>
              <th>Schlüssel</th>
              <th>Bezeichnung</th>
              <th>Tätigkeitsschlüssel</th>
              <th>Qualifikationen</th>
              <th class="th-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in filteredBerufe" :key="b._id">
              <td><span class="quali-key">#{{ b.jobKey }}</span></td>
              <td>{{ b.designation }}</td>
              <td>
                <span v-if="b.taetigkeitsschluessel" class="beruf-tag">{{ b.taetigkeitsschluessel }}</span>
                <span v-else class="ma-unlinked">—</span>
              </td>
              <td>
                <span v-if="b.qualifikationCount" class="quali-ma-count">{{ b.qualifikationCount }}</span>
                <span v-else class="ma-unlinked">0</span>
              </td>
              <td class="td-actions">
                <button type="button" class="btn-icon" title="Bearbeiten" @click="openBerufEdit(b)">
                  <font-awesome-icon icon="fa-solid fa-pen" />
                </button>
                <button type="button" class="btn-icon btn-icon--danger" title="Löschen" @click="openBerufDelete(b)">
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </button>
              </td>
            </tr>
            <tr v-if="!filteredBerufe.length">
              <td colspan="5" style="text-align:center; opacity:0.45; padding: 24px;">Keine Berufe vorhanden.</td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </section>

    <!-- Beruf Create/Edit Modal -->
    <div v-if="berufModal.open" class="modal-backdrop" @click.self="closeBerufModal">
      <form class="modal-content modal-content--sm" @submit.prevent="saveBeruf">
        <header class="modal-header">
          <h3>{{ berufModal.isNew ? 'Beruf anlegen' : 'Beruf bearbeiten' }}</h3>
          <button type="button" class="close-btn" @click="closeBerufModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <div class="modal-body">
          <div class="form-group">
            <label>Schlüssel <span class="required">*</span></label>
            <input v-model.number="berufModal.form.jobKey" type="number" required :disabled="!berufModal.isNew" />
          </div>
          <div class="form-group">
            <label>Bezeichnung <span class="required">*</span></label>
            <input v-model="berufModal.form.designation" type="text" required />
          </div>
          <div class="form-group">
            <label>Tätigkeitsschlüssel</label>
            <input v-model="berufModal.form.taetigkeitsschluessel" type="text" />
          </div>
          <p v-if="berufModal.error" class="modal-error">{{ berufModal.error }}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="closeBerufModal">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="berufModal.saving">
            <font-awesome-icon :icon="berufModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="berufModal.saving" />
            {{ berufModal.isNew ? 'Anlegen' : 'Speichern' }}
          </button>
        </footer>
      </form>
    </div>

    <!-- Beruf Delete Modal -->
    <div v-if="berufDeleteModal.open" class="modal-backdrop" @click.self="closeBerufDelete">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Beruf löschen</h3>
          <button type="button" class="close-btn" @click="closeBerufDelete"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <div class="modal-body">
          <p class="warning-text">Möchtest du den Beruf <strong>#{{ berufDeleteModal.item?.jobKey }} – {{ berufDeleteModal.item?.designation }}</strong> wirklich löschen?</p>
          <p v-if="berufDeleteModal.item?.qualifikationCount" class="modal-error">Achtung: {{ berufDeleteModal.item.qualifikationCount }} Qualifikation(en) verlieren dadurch ihre Beruf-Zuordnung.</p>
          <p v-if="berufDeleteModal.error" class="modal-error">{{ berufDeleteModal.error }}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="closeBerufDelete">Abbrechen</button>
          <button type="button" class="btn btn-danger" @click="confirmBerufDelete" :disabled="berufDeleteModal.deleting">
            <font-awesome-icon :icon="berufDeleteModal.deleting ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'" :spin="berufDeleteModal.deleting" />
            Löschen
          </button>
        </footer>
      </div>
    </div>

    <!-- Qualifikation Create/Edit Modal -->
    <div v-if="qualiModal.open" class="modal-backdrop" @click.self="closeQualiModal">
      <form class="modal-content modal-content--sm" @submit.prevent="saveQualifikation">
        <header class="modal-header">
          <h3>{{ qualiModal.isNew ? 'Qualifikation anlegen' : 'Qualifikation bearbeiten' }}</h3>
          <button type="button" class="close-btn" @click="closeQualiModal"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <div class="modal-body">
          <div class="form-group">
            <label>Schlüssel <span class="required">*</span></label>
            <input v-model.number="qualiModal.form.qualificationKey" type="number" required :disabled="!qualiModal.isNew" />
          </div>
          <div class="form-group">
            <label>Bezeichnung <span class="required">*</span></label>
            <input v-model="qualiModal.form.designation" type="text" required />
          </div>
          <div class="form-group">
            <label>Beruf</label>
            <select v-model="qualiModal.form.beruf">
              <option :value="null">— Kein Beruf —</option>
              <option v-for="b in berufe" :key="b._id" :value="b._id">#{{ b.jobKey }} {{ b.designation }}</option>
            </select>
          </div>
          <p v-if="qualiModal.error" class="modal-error">{{ qualiModal.error }}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="closeQualiModal">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="qualiModal.saving">
            <font-awesome-icon :icon="qualiModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'" :spin="qualiModal.saving" />
            {{ qualiModal.isNew ? 'Anlegen' : 'Speichern' }}
          </button>
        </footer>
      </form>
    </div>

    <!-- Qualifikation Delete Modal -->
    <div v-if="qualiDeleteModal.open" class="modal-backdrop" @click.self="closeQualiDelete">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Qualifikation löschen</h3>
          <button type="button" class="close-btn" @click="closeQualiDelete"><font-awesome-icon icon="fa-solid fa-times" /></button>
        </header>
        <div class="modal-body">
          <p class="warning-text">Möchtest du die Qualifikation <strong>#{{ qualiDeleteModal.item?.qualificationKey }} – {{ qualiDeleteModal.item?.designation }}</strong> wirklich löschen?</p>
          <p v-if="qualiDeleteModal.error" class="modal-error">{{ qualiDeleteModal.error }}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost" @click="closeQualiDelete">Abbrechen</button>
          <button type="button" class="btn btn-danger" @click="confirmQualiDelete" :disabled="qualiDeleteModal.deleting">
            <font-awesome-icon :icon="qualiDeleteModal.deleting ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'" :spin="qualiDeleteModal.deleting" />
            Löschen
          </button>
        </footer>
      </div>
    </div>

    <!-- Edit / Create Modal -->
    <div v-if="editModal.open" class="modal-backdrop" @click.self="closeEdit">
      <div class="modal-content">
        <header class="modal-header">
          <h3>{{ editModal.isNew ? 'Neuen Benutzer anlegen' : 'Benutzer bearbeiten' }}</h3>
          <button class="close-btn" @click="closeEdit">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Name</label>
              <input v-model="editModal.form.name" type="text" placeholder="Max Mustermann" />
            </div>
            <div class="form-group">
              <label>Standort (Legacy)</label>
              <input v-model="editModal.form.location" type="text" placeholder="Hamburg" />
            </div>
            <div class="form-group">
              <label>Standort v2</label>
              <select v-model="editModal.form.locationV2">
                <option value="">Nicht zugeordnet</option>
                <option v-for="location in activeLocations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>E-Mail <span class="required">*</span></label>
            <input v-model="editModal.form.email" type="email" placeholder="name@straightforward.email" />
          </div>

          <div class="form-group">
            <label>
              Passwort
              <span v-if="!editModal.isNew" class="hint">(leer lassen = nicht ändern)</span>
              <span v-else class="required">*</span>
            </label>
            <input v-model="editModal.form.password" type="password" placeholder="Neues Passwort" autocomplete="new-password" />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Rollen</label>
              <div class="roles-checkboxes">
                <label v-for="r in AVAILABLE_ROLES" :key="r.value" class="role-checkbox-label">
                  <input type="checkbox" :value="r.value" v-model="editModal.form.roles" />
                  <span>{{ r.label }}</span>
                </label>
              </div>
            </div>
            <div class="form-group form-group--checkbox">
              <label class="checkbox-label">
                <input type="checkbox" v-model="editModal.form.isConfirmed" />
                <span>E-Mail bestätigt</span>
              </label>
            </div>
          </div>

          <div v-if="editModal.error" class="modal-error">{{ editModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeEdit">Abbrechen</button>
          <button class="btn btn-primary" @click="saveUser" :disabled="editModal.saving">
            <font-awesome-icon
              :icon="editModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'"
              :class="{ 'fa-spin': editModal.saving }"
            />
            {{ editModal.isNew ? 'Anlegen' : 'Speichern' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- MB Verknüpfen Modal -->
    <div v-if="linkModal.open" class="modal-backdrop" @click.self="closeLink">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Mit Mitarbeiter verknüpfen</h3>
          <button class="close-btn" @click="closeLink">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <!-- Current link -->
          <div v-if="linkModal.mitarbeiterObj" class="current-link">
            <span class="current-link__label">Aktuell verknüpft:</span>
            <span class="current-link__name">
              <font-awesome-icon icon="fa-solid fa-user-tie" />
              {{ linkModal.mitarbeiterObj.vorname }} {{ linkModal.mitarbeiterObj.nachname }}
              <span v-if="linkModal.mitarbeiterObj.personalnr" class="ma-link-nr">#{{ linkModal.mitarbeiterObj.personalnr }}</span>
            </span>
            <button class="btn-unlink" @click="clearLink" title="Verknüpfung entfernen">
              <font-awesome-icon icon="fa-solid fa-unlink" />
              Entfernen
            </button>
          </div>
          <p v-else class="hint-text">Kein Mitarbeiter verknüpft.</p>

          <div class="form-group">
            <label>{{ linkModal.mitarbeiterObj ? 'Neuen Mitarbeiter auswählen' : 'Mitarbeiter suchen' }}</label>
            <MitarbeiterSearch
              :key="linkModal.searchKey"
              :modelValue="null"
              @select="onLinkSelect"
              :dropup="false"
            />
          </div>

          <div v-if="linkModal.error" class="modal-error">{{ linkModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeLink">Abbrechen</button>
          <button class="btn btn-primary" @click="saveLink" :disabled="linkModal.saving">
            <font-awesome-icon
              :icon="linkModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'"
              :class="{ 'fa-spin': linkModal.saving }"
            />
            Speichern
          </button>
        </footer>
      </div>
    </div>

    <!-- Asana Link Modal -->
    <div v-if="asanaModal.open" class="modal-backdrop" @click.self="closeAsanaLink">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Mit Asana-User verknüpfen</h3>
          <button class="close-btn" @click="closeAsanaLink">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <!-- Current Asana link -->
          <div v-if="asanaModal.currentAsanaUser" class="current-link">
            <span class="current-link__label">Aktuell verknüpft:</span>
            <span class="current-link__name">
              <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
              {{ asanaModal.currentAsanaUser.name }}
              <span v-if="asanaModal.currentAsanaUser.email" class="ma-link-nr">{{ asanaModal.currentAsanaUser.email }}</span>
            </span>
            <button class="btn-unlink" @click="clearAsanaLink" title="Verknüpfung entfernen">
              <font-awesome-icon icon="fa-solid fa-unlink" />
              Entfernen
            </button>
          </div>
          <p v-else class="hint-text">Kein Asana-User verknüpft.</p>

          <div class="form-group">
            <label>{{ asanaModal.currentAsanaUser ? 'Anderen Asana-User auswählen' : 'Asana-User suchen' }}</label>
            <input
              v-model="asanaModal.search"
              type="text"
              placeholder="Name oder E-Mail…"
              @input="searchAsanaUsers"
            />
            <div v-if="asanaModal.searching" class="asana-search-hint">
              <font-awesome-icon icon="fa-solid fa-spinner" spin /> Suche…
            </div>
            <div v-if="asanaModal.results.length" class="asana-results">
              <button
                v-for="au in asanaModal.results"
                :key="au.gid"
                class="asana-result-item"
                :class="{ 'asana-result-item--selected': asanaModal.selectedGid === au.gid }"
                @click="selectAsanaUser(au)"
              >
                <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
                <span class="asana-result-name">{{ au.name }}</span>
                <span v-if="au.email" class="asana-result-email">{{ au.email }}</span>
              </button>
            </div>
            <p v-else-if="asanaModal.searched && !asanaModal.searching" class="hint-text">Keine Ergebnisse.</p>
          </div>

          <div v-if="asanaModal.error" class="modal-error">{{ asanaModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeAsanaLink">Abbrechen</button>
          <button class="btn btn-primary" @click="saveAsanaLink" :disabled="asanaModal.saving || !asanaModal.selectedGid && !asanaModal.clearPending">
            <font-awesome-icon
              :icon="asanaModal.saving ? 'fa-solid fa-spinner' : 'fa-solid fa-floppy-disk'"
              :class="{ 'fa-spin': asanaModal.saving }"
            />
            Speichern
          </button>
        </footer>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteModal.open" class="modal-backdrop" @click.self="closeDelete">
      <div class="modal-content modal-content--sm">
        <header class="modal-header">
          <h3>Benutzer löschen</h3>
          <button class="close-btn" @click="closeDelete">
            <font-awesome-icon icon="fa-solid fa-times" />
          </button>
        </header>

        <div class="modal-body">
          <p class="warning-text">
            Möchtest du den Benutzer <strong>{{ deleteModal.user?.name || deleteModal.user?.email }}</strong> wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div v-if="deleteModal.error" class="modal-error">{{ deleteModal.error }}</div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-ghost" @click="closeDelete">Abbrechen</button>
          <button class="btn btn-danger" @click="confirmDelete" :disabled="deleteModal.deleting">
            <font-awesome-icon
              :icon="deleteModal.deleting ? 'fa-solid fa-spinner' : 'fa-solid fa-trash'"
              :class="{ 'fa-spin': deleteModal.deleting }"
            />
            Löschen
          </button>
        </footer>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from '@/utils/api';
import { useAuth } from '@/stores/auth';
import MitarbeiterSearch from '@/components/ui-elements/MitarbeiterSearch.vue';
import SearchBar from '@/components/SearchBar.vue';
import Toolbar from '@/components/ui-elements/Toolbar.vue';
import ToolbarLabel from '@/components/ui-elements/ToolbarLabel.vue';
import ToolbarGroup from '@/components/ui-elements/ToolbarGroup.vue';
import ToolbarButton from '@/components/ui-elements/ToolbarButton.vue';
import BewerberManagementTab from '@/components/BewerberManagementTab.vue';
import EmployeeEmailTemplateTab from '@/components/EmployeeEmailTemplateTab.vue';

// Map of asana_gid -> { name, email } for display in the table
const asanaUserMap = ref({});

const AVAILABLE_ROLES = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'VERTRIEB', label: 'VERTRIEB' },
  { value: 'PAYROLL', label: 'PAYROLL' },
];

const auth = useAuth();
const currentUserId = computed(() => auth.user?._id || auth.user?.id);

const users = ref([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const activeTab = ref('locations');
const locations = ref([]);
const locationsLoading = ref(false);
const locationSaving = ref(false);
const locationError = ref('');
const WEEKDAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
];
const locationForm = reactive({
  nameFull: '',
  shortName: '',
  color: '#6b7280',
  address: { street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland' },
  locationManager: '',
  contact: { mainEmail: '', phone: '' },
  openingHours: emptyOpeningHours(),
  timeZone: 'Europe/Berlin',
  legal: { legalName: '', vatId: '', registrationNumber: '' },
  externalId: '',
  deliveryNotes: '',
  settings: {},
});
const locationModal = reactive({ open: false, isNew: true, locationId: null, activeTab: 'general', error: '' });
const canCreateLocation = computed(() => locationForm.nameFull.trim() && locationForm.shortName.trim());
const activeLocations = computed(() => locations.value.filter((location) => location.isActive));

const filteredUsers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.location || '').toLowerCase().includes(q)
  );
});

// ─── Edit / Create Modal ────────────────────────────────────────────────────
const editModal = reactive({
  open: false,
  isNew: false,
  saving: false,
  error: '',
  userId: null,
  form: {
    name: '',
    email: '',
    password: '',
    location: '',
    locationV2: '',
    roles: ['USER'],
    isConfirmed: true,
  },
});

// ─── Delete Modal ───────────────────────────────────────────────────────────
const deleteModal = reactive({
  open: false,
  deleting: false,
  error: '',
  user: null,
});

// ─── Link Modal ─────────────────────────────────────────────────────────────
const linkModal = reactive({
  open: false,
  saving: false,
  error: '',
  userId: null,
  searchKey: 0,
  mitarbeiterId: null,
  mitarbeiterObj: null,
});

// ─── Qualifikationen ────────────────────────────────────────────────────────
const qualifikationen = ref([]);
const berufe = ref([]);
const qualiLoading = ref(false);
const qualiError = ref('');
const qualiSearch = ref('');
const qualiSubTab = ref('qualifikation');
const berufSearch = ref('');
const selectedBerufFilter = ref(null); // null = all, 'none' = no beruf, beruf._id = specific beruf
const qualiModal = reactive({ open: false, isNew: true, id: null, saving: false, error: '', form: { qualificationKey: '', designation: '', beruf: null } });
const qualiDeleteModal = reactive({ open: false, deleting: false, error: '', item: null });

// ─── Lohnarten ──────────────────────────────────────────────────────────────
const lohnarten = ref([]);
const lohnartenLoading = ref(false);
const lohnartError = ref('');
const lohnartSearch = ref('');
const lohnartSortField = ref('lohnartNummer');
const lohnartSortDirection = ref('asc');

const filteredLohnarten = computed(() => {
  const query = lohnartSearch.value.trim().toLowerCase();
  const filtered = !query ? lohnarten.value : lohnarten.value.filter((lohnart) => [
    lohnart.lohnartNummer,
    lohnart.lohnartKurzzeichen,
    lohnart.lohnartBezeichnung,
    lohnart.rechnungstext,
    lohnart.kostenart,
  ].some((value) => String(value || '').toLowerCase().includes(query)));

  return [...filtered].sort((left, right) => {
    const leftValue = String(left[lohnartSortField.value] || '');
    const rightValue = String(right[lohnartSortField.value] || '');
    if (!leftValue) return 1;
    if (!rightValue) return -1;
    const comparison = leftValue.localeCompare(rightValue, 'de', { numeric: true, sensitivity: 'base' });
    return lohnartSortDirection.value === 'asc' ? comparison : -comparison;
  });
});

function sortLohnarten(field) {
  if (lohnartSortField.value === field) {
    lohnartSortDirection.value = lohnartSortDirection.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  lohnartSortField.value = field;
  lohnartSortDirection.value = 'asc';
}

async function fetchLohnarten() {
  lohnartenLoading.value = true;
  lohnartError.value = '';
  try {
    const { data } = await api.get('/api/import/lohnarten');
    lohnarten.value = data.data || [];
  } catch (e) {
    lohnartError.value = e?.response?.data?.message || 'Fehler beim Laden der Lohnarten.';
  } finally {
    lohnartenLoading.value = false;
  }
}

const qualiBerufTabs = computed(() => {
  const map = new Map();
  for (const q of qualifikationen.value) {
    const key = q.beruf?._id ?? 'none';
    const label = q.beruf ? `#${q.beruf.jobKey} ${q.beruf.designation}` : 'Ohne Beruf';
    if (!map.has(key)) map.set(key, { id: key, label, jobKey: q.beruf?.jobKey ?? Infinity, count: 0 });
    map.get(key).count++;
  }
  return [...map.values()].sort((a, b) => a.jobKey - b.jobKey);
});

const filteredQualifikationen = computed(() => {
  let list = qualifikationen.value;
  if (selectedBerufFilter.value !== null) {
    if (selectedBerufFilter.value === 'none') list = list.filter(q => !q.beruf);
    else list = list.filter(q => q.beruf?._id === selectedBerufFilter.value);
  }
  const q = qualiSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(r =>
    String(r.qualificationKey).includes(q) ||
    r.designation.toLowerCase().includes(q) ||
    r.beruf?.designation.toLowerCase().includes(q)
  );
});

async function fetchQualifikationen() {
  qualiLoading.value = true;
  qualiError.value = '';
  try {
    const [qualiRes, berufRes] = await Promise.all([
      api.get('/api/import/qualifikationen'),
      api.get('/api/import/berufe'),
    ]);
    qualifikationen.value = qualiRes.data.data || [];
    berufe.value = (berufRes.data.data || []).sort((a, b) => a.jobKey - b.jobKey);
  } catch (e) {
    qualiError.value = e?.response?.data?.message || 'Fehler beim Laden der Qualifikationen.';
  } finally {
    qualiLoading.value = false;
  }
}

function openQualiCreate() {
  Object.assign(qualiModal, { open: true, isNew: true, id: null, saving: false, error: '', form: { qualificationKey: '', designation: '', beruf: null } });
}

function openQualiEdit(q) {
  Object.assign(qualiModal, { open: true, isNew: false, id: q._id, saving: false, error: '', form: { qualificationKey: q.qualificationKey, designation: q.designation, beruf: q.beruf?._id || null } });
}

function closeQualiModal() { qualiModal.open = false; }

async function saveQualifikation() {
  qualiModal.error = '';
  qualiModal.saving = true;
  try {
    const payload = { ...qualiModal.form, beruf: qualiModal.form.beruf || null };
    if (qualiModal.isNew) {
      const { data } = await api.post('/api/import/qualifikationen', payload);
      qualifikationen.value = [...qualifikationen.value, data.data].sort((a, b) => a.qualificationKey - b.qualificationKey);
    } else {
      const { data } = await api.put(`/api/import/qualifikationen/${qualiModal.id}`, payload);
      const idx = qualifikationen.value.findIndex(q => q._id === qualiModal.id);
      if (idx !== -1) qualifikationen.value[idx] = data.data;
    }
    closeQualiModal();
  } catch (e) {
    qualiModal.error = e?.response?.data?.message || 'Fehler beim Speichern.';
  } finally {
    qualiModal.saving = false;
  }
}

function openQualiDelete(q) {
  Object.assign(qualiDeleteModal, { open: true, deleting: false, error: '', item: q });
}

function closeQualiDelete() { qualiDeleteModal.open = false; }

async function confirmQualiDelete() {
  qualiDeleteModal.error = '';
  qualiDeleteModal.deleting = true;
  try {
    await api.delete(`/api/import/qualifikationen/${qualiDeleteModal.item._id}`);
    qualifikationen.value = qualifikationen.value.filter(q => q._id !== qualiDeleteModal.item._id);
    closeQualiDelete();
  } catch (e) {
    qualiDeleteModal.error = e?.response?.data?.message || 'Fehler beim Löschen.';
  } finally {
    qualiDeleteModal.deleting = false;
  }
}

// ─── Berufe ─────────────────────────────────────────────────────────────────
const berufModal = reactive({ open: false, isNew: true, id: null, saving: false, error: '', form: { jobKey: '', designation: '', taetigkeitsschluessel: '' } });
const berufDeleteModal = reactive({ open: false, deleting: false, error: '', item: null });

const filteredBerufe = computed(() => {
  const q = berufSearch.value.trim().toLowerCase();
  if (!q) return berufe.value;
  return berufe.value.filter(b =>
    String(b.jobKey).includes(q) ||
    b.designation.toLowerCase().includes(q) ||
    (b.taetigkeitsschluessel || '').toLowerCase().includes(q)
  );
});

function openBerufCreate() {
  Object.assign(berufModal, { open: true, isNew: true, id: null, saving: false, error: '', form: { jobKey: '', designation: '', taetigkeitsschluessel: '' } });
}

function openBerufEdit(b) {
  Object.assign(berufModal, { open: true, isNew: false, id: b._id, saving: false, error: '', form: { jobKey: b.jobKey, designation: b.designation, taetigkeitsschluessel: b.taetigkeitsschluessel || '' } });
}

function closeBerufModal() { berufModal.open = false; }

async function saveBeruf() {
  berufModal.error = '';
  berufModal.saving = true;
  try {
    if (berufModal.isNew) {
      const { data } = await api.post('/api/import/berufe', berufModal.form);
      berufe.value = [...berufe.value, { ...data.data, qualifikationCount: 0 }].sort((a, b) => a.jobKey - b.jobKey);
    } else {
      const { data } = await api.put(`/api/import/berufe/${berufModal.id}`, berufModal.form);
      const idx = berufe.value.findIndex(b => b._id === berufModal.id);
      if (idx !== -1) berufe.value[idx] = { ...data.data, qualifikationCount: berufe.value[idx].qualifikationCount };
    }
    closeBerufModal();
  } catch (e) {
    berufModal.error = e?.response?.data?.message || 'Fehler beim Speichern.';
  } finally {
    berufModal.saving = false;
  }
}

function openBerufDelete(b) {
  Object.assign(berufDeleteModal, { open: true, deleting: false, error: '', item: b });
}

function closeBerufDelete() { berufDeleteModal.open = false; }

async function confirmBerufDelete() {
  berufDeleteModal.error = '';
  berufDeleteModal.deleting = true;
  try {
    await api.delete(`/api/import/berufe/${berufDeleteModal.item._id}`);
    berufe.value = berufe.value.filter(b => b._id !== berufDeleteModal.item._id);
    // Refresh qualifications since their beruf reference may have been cleared
    await fetchQualifikationen();
    closeBerufDelete();
  } catch (e) {
    berufDeleteModal.error = e?.response?.data?.message || 'Fehler beim Löschen.';
  } finally {
    berufDeleteModal.deleting = false;
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchUsers();
  await loadAsanaUserMap();
  await fetchLocations();
  await fetchQualifikationen();
  await fetchLohnarten();
});

async function fetchUsers() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get('/api/users/admin/all');
    users.value = res.data;
  } catch (e) {
    error.value = e?.response?.data?.msg || 'Fehler beim Laden der Benutzer.';
  } finally {
    loading.value = false;
  }
}

async function loadAsanaUserMap() {
  try {
    const gids = [...new Set(users.value.map(u => u.asana_id).filter(Boolean))];
    await Promise.all(gids.map(async (gid) => {
      try {
        const res = await api.get(`/api/asana/users/${gid}`);
        asanaUserMap.value[gid] = res.data?.data || { name: gid };
      } catch { /* ignore individual lookup failures */ }
    }));
  } catch { /* ignore */ }
}

async function fetchLocations() {
  locationsLoading.value = true;
  locationError.value = '';
  try {
    const { data } = await api.get('/api/locations', { params: { all: true } });
    locations.value = data;
  } catch (e) {
    locationError.value = e?.response?.data?.message || 'Fehler beim Laden der Standorte.';
  } finally {
    locationsLoading.value = false;
  }
}

function resetLocationForm() {
  locationForm.nameFull = '';
  locationForm.shortName = '';
  locationForm.color = '#6b7280';
  Object.assign(locationForm.address, { street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland' });
  locationForm.locationManager = '';
  Object.assign(locationForm.contact, { mainEmail: '', phone: '' });
  Object.assign(locationForm.openingHours, emptyOpeningHours());
  locationForm.timeZone = 'Europe/Berlin';
  Object.assign(locationForm.legal, { legalName: '', vatId: '', registrationNumber: '' });
  locationForm.externalId = '';
  locationForm.deliveryNotes = '';
  locationForm.settings = {};
}

function openLocationCreate() {
  resetLocationForm();
  Object.assign(locationModal, { open: true, isNew: true, locationId: null, activeTab: 'general', error: '' });
}

function openLocationEdit(location) {
  locationForm.nameFull = location.nameFull || '';
  locationForm.shortName = location.shortName || '';
  locationForm.color = location.color || '#6b7280';
  Object.assign(locationForm.address, { street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland', ...location.address });
  locationForm.locationManager = location.locationManager?._id || location.locationManager || '';
  Object.assign(locationForm.contact, { mainEmail: '', phone: '', ...location.contact });
  Object.assign(locationForm.openingHours, normalizeOpeningHours(location.openingHours));
  locationForm.timeZone = location.timeZone || 'Europe/Berlin';
  Object.assign(locationForm.legal, { legalName: '', vatId: '', registrationNumber: '', ...location.legal });
  locationForm.externalId = location.externalId || '';
  locationForm.deliveryNotes = location.deliveryNotes || '';
  locationForm.settings = location.settings || {};
  Object.assign(locationModal, { open: true, isNew: false, locationId: location._id, activeTab: 'general', error: '' });
}

function closeLocationModal() {
  locationModal.open = false;
}

async function saveLocation() {
  if (!canCreateLocation.value) return;
  const openingHourSlots = Object.values(locationForm.openingHours).flat();
  if (openingHourSlots.some((slot) => Boolean(slot.start) !== Boolean(slot.end))) {
    locationModal.error = 'Bitte für jedes Zeitfenster sowohl Start- als auch Endzeit angeben.';
    return;
  }

  const payload = {
    ...locationForm,
    openingHours: Object.fromEntries(WEEKDAYS.map(({ key }) => [
      key,
      locationForm.openingHours[key].filter((slot) => slot.start && slot.end),
    ])),
  };
  locationSaving.value = true;
  locationError.value = '';
  locationModal.error = '';
  try {
    if (locationModal.isNew) {
      const { data } = await api.post('/api/locations', payload);
      locations.value = [...locations.value, data].sort((left, right) => left.nameFull.localeCompare(right.nameFull, 'de'));
    } else {
      const { data } = await api.patch(`/api/locations/${locationModal.locationId}`, payload);
      const index = locations.value.findIndex((entry) => entry._id === data._id);
      if (index >= 0) locations.value[index] = data;
      locations.value.sort((left, right) => left.nameFull.localeCompare(right.nameFull, 'de'));
    }
    closeLocationModal();
  } catch (e) {
    locationModal.error = e?.response?.data?.message || 'Standort konnte nicht gespeichert werden.';
  } finally {
    locationSaving.value = false;
  }
}

async function toggleLocation(location) {
  locationError.value = '';
  try {
    const { data } = await api.patch(`/api/locations/${location._id}`, { isActive: !location.isActive });
    const index = locations.value.findIndex((entry) => entry._id === data._id);
    if (index >= 0) locations.value[index] = data;
  } catch (e) {
    locationError.value = e?.response?.data?.message || 'Standort konnte nicht aktualisiert werden.';
  }
}

function formatLocationAddress(address) {
  if (!address || typeof address !== 'object') return '';
  const street = [address.street, address.houseNumber].filter(Boolean).join(' ');
  const city = [address.postalCode, address.city].filter(Boolean).join(' ');
  return [street, city, address.country].filter(Boolean).join(', ');
}

function emptyOpeningHours() {
  return Object.fromEntries(WEEKDAYS.map(({ key }) => [key, []]));
}

function normalizeOpeningHours(openingHours = {}) {
  return Object.fromEntries(WEEKDAYS.map(({ key }) => {
    const slots = openingHours[key];
    if (typeof slots === 'string') {
      const match = slots.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      return [key, match ? [{ start: match[1], end: match[2] }] : []];
    }
    return [key, Array.isArray(slots)
      ? slots.map((slot) => ({ start: slot.start || '', end: slot.end || '' }))
      : []];
  }));
}

function addOpeningHour(day) {
  locationForm.openingHours[day].push({ start: '', end: '' });
}

function removeOpeningHour(day, index) {
  locationForm.openingHours[day].splice(index, 1);
}

// ─── Edit / Create ──────────────────────────────────────────────────────────
function openCreate() {
  Object.assign(editModal, {
    open: true,
    isNew: true,
    saving: false,
    error: '',
    userId: null,
    form: { name: '', email: '', password: '', location: '', locationV2: '', roles: ['USER'], isConfirmed: true },
  });
}

function openEdit(u) {
  Object.assign(editModal, {
    open: true,
    isNew: false,
    saving: false,
    error: '',
    userId: u._id,
    form: {
      name: u.name || '',
      email: u.email || '',
      password: '',
      location: u.location || '',
      locationV2: u.locationV2?._id || u.locationV2 || '',
      roles: u.roles?.length ? [...u.roles] : [u.role || 'USER'],
      isConfirmed: !!u.isConfirmed,
    },
  });
}

function closeEdit() {
  editModal.open = false;
}

async function saveUser() {
  editModal.error = '';
  if (!editModal.form.email) { editModal.error = 'E-Mail ist erforderlich.'; return; }
  if (editModal.isNew && !editModal.form.password) { editModal.error = 'Passwort ist erforderlich.'; return; }

  editModal.saving = true;
  try {
    const payload = { ...editModal.form };
    if (!payload.password) delete payload.password;
    if (!payload.roles?.length) payload.roles = ['USER'];

    if (editModal.isNew) {
      const res = await api.post('/api/users/admin/create', payload);
      users.value.unshift(res.data);
    } else {
      const res = await api.put(`/api/users/admin/${editModal.userId}`, payload);
      const idx = users.value.findIndex(u => u._id === editModal.userId);
      if (idx !== -1) users.value[idx] = res.data;
    }
    closeEdit();
  } catch (e) {
    editModal.error = e?.response?.data?.msg || 'Fehler beim Speichern.';
  } finally {
    editModal.saving = false;
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────
function openDelete(u) {
  Object.assign(deleteModal, { open: true, deleting: false, error: '', user: u });
}

function closeDelete() {
  deleteModal.open = false;
}

async function confirmDelete() {
  deleteModal.error = '';
  deleteModal.deleting = true;
  try {
    await api.delete(`/api/users/admin/${deleteModal.user._id}`);
    users.value = users.value.filter(u => u._id !== deleteModal.user._id);
    closeDelete();
  } catch (e) {
    deleteModal.error = e?.response?.data?.msg || 'Fehler beim Löschen.';
  } finally {
    deleteModal.deleting = false;
  }
}

// ─── Link (MB Verknüpfen) ────────────────────────────────────────────────────
function openLink(u) {
  Object.assign(linkModal, {
    open: true,
    saving: false,
    error: '',
    userId: u._id,
    searchKey: linkModal.searchKey + 1,
    mitarbeiterId: u.mitarbeiter?._id || null,
    mitarbeiterObj: u.mitarbeiter || null,
  });
}

function closeLink() {
  linkModal.open = false;
}

function onLinkSelect(ma) {
  if (!ma) return;
  linkModal.mitarbeiterId = ma._id;
  linkModal.mitarbeiterObj = ma;
}

function clearLink() {
  linkModal.mitarbeiterId = null;
  linkModal.mitarbeiterObj = null;
  linkModal.searchKey++;
}

async function saveLink() {
  linkModal.error = '';
  linkModal.saving = true;
  try {
    const res = await api.put(`/api/users/admin/${linkModal.userId}/mitarbeiter`, {
      mitarbeiterId: linkModal.mitarbeiterId || null,
    });
    const idx = users.value.findIndex(u => u._id === linkModal.userId);
    if (idx !== -1) users.value[idx] = res.data;
    closeLink();
  } catch (e) {
    linkModal.error = e?.response?.data?.msg || 'Fehler beim Speichern.';
  } finally {
    linkModal.saving = false;
  }
}

// ─── Asana Link Modal ────────────────────────────────────────────────────────
const asanaModal = reactive({
  open: false,
  saving: false,
  searching: false,
  searched: false,
  error: '',
  userId: null,
  search: '',
  results: [],
  selectedGid: null,
  selectedUser: null,
  currentAsanaUser: null,
  clearPending: false,
});

let searchDebounce = null;

function openAsanaLink(u) {
  const currentUser = u.asana_id ? (asanaUserMap.value[u.asana_id] || null) : null;
  Object.assign(asanaModal, {
    open: true,
    saving: false,
    searching: false,
    searched: false,
    error: '',
    userId: u._id,
    search: '',
    results: [],
    selectedGid: null,
    selectedUser: null,
    currentAsanaUser: currentUser ? { ...currentUser, gid: u.asana_id } : null,
    clearPending: false,
  });
}

function closeAsanaLink() {
  asanaModal.open = false;
  clearTimeout(searchDebounce);
}

function searchAsanaUsers() {
  clearTimeout(searchDebounce);
  asanaModal.results = [];
  asanaModal.searched = false;
  if (!asanaModal.search.trim()) return;
  searchDebounce = setTimeout(async () => {
    asanaModal.searching = true;
    try {
      const res = await api.get('/api/asana/users', { params: { } });
      const query = asanaModal.search.toLowerCase();
      asanaModal.results = (res.data?.data || []).filter(u =>
        u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query)
      ).slice(0, 20);
      asanaModal.searched = true;
    } catch {
      asanaModal.results = [];
    } finally {
      asanaModal.searching = false;
    }
  }, 300);
}

function selectAsanaUser(au) {
  asanaModal.selectedGid = au.gid;
  asanaModal.selectedUser = au;
  asanaModal.clearPending = false;
}

function clearAsanaLink() {
  asanaModal.currentAsanaUser = null;
  asanaModal.selectedGid = null;
  asanaModal.selectedUser = null;
  asanaModal.clearPending = true;
}

async function saveAsanaLink() {
  asanaModal.error = '';
  asanaModal.saving = true;
  try {
    const asana_id = asanaModal.selectedGid || null;
    const res = await api.put(`/api/users/admin/${asanaModal.userId}/asana`, { asana_id });
    const idx = users.value.findIndex(u => u._id === asanaModal.userId);
    if (idx !== -1) users.value[idx] = res.data;
    if (asana_id && asanaModal.selectedUser) {
      asanaUserMap.value[asana_id] = asanaModal.selectedUser;
    }
    closeAsanaLink();
  } catch (e) {
    asanaModal.error = e?.response?.data?.msg || 'Fehler beim Speichern.';
  } finally {
    asanaModal.saving = false;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.um {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
  color: var(--text);
}

.um__title {
  font-size: 1.7rem;
  font-weight: 700;
  margin: 0 0 16px;
  span { color: var(--primary); }
}

.management-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);

  button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 14px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;

    &:hover { color: var(--text); }
  }

  .management-tabs__tab--active {
    border-bottom-color: var(--primary);
    color: var(--primary);
    font-weight: 700;
  }
}

.um__error {
  background: rgba(220, 53, 69, 0.12);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: #dc3545;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.um__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 32px;
  opacity: 0.6;
}

.um__table-wrap {
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: auto;
}

.locations {
  padding-top: 22px;
}

.users {
  padding-top: 22px;
}

.locations__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;

  p { margin: 0 0 3px; color: var(--primary); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  h2 { margin: 0; font-size: 1.05rem; }
}

.qualifikationen {
  padding-top: 22px;
}
.lohn {
  padding-top: 22px;
}
.lohn__state { color: var(--muted); font-size: 0.85rem; }
.lohn__sort-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: inherit;
  text-align: left;

  &:hover { color: var(--primary); }
  svg { font-size: 0.7rem; color: var(--primary); }
}
.lohn__th--zuschlag { background: rgba(var(--primary-rgb, 255, 120, 0), 0.12); color: var(--primary) !important; }
.lohn__zuschlag { background: rgba(var(--primary-rgb, 255, 120, 0), 0.08); color: var(--primary); font-weight: 700; }
.qualifikationen__state { color: var(--muted); font-size: 0.85rem; }

.subtabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 18px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 14px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;

    &:hover { color: var(--text); }

    &.active {
      border-bottom-color: var(--primary);
      color: var(--primary);
      font-weight: 700;
    }
  }
}

.quali-beruf-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 0 12px;

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 100px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    transition: border-color 0.12s, color 0.12s, background 0.12s;

    &:hover { border-color: var(--primary); color: var(--text); }
  }

  .quali-beruf-tabs__tab--active {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(var(--primary-rgb, 255, 120, 0), 0.08);
    font-weight: 600;
  }
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 100px;
  font-size: 0.7rem;
  font-weight: 700;
  background: var(--border);
  color: var(--text);

  .quali-beruf-tabs__tab--active & {
    background: rgba(var(--primary-rgb, 255, 120, 0), 0.2);
    color: var(--primary);
  }
}
.quali-key {
  font-family: monospace;
  font-size: 0.82rem;
  opacity: 0.75;
}

.beruf-tag {
  font-size: 0.8rem;
  color: var(--primary);
  font-family: monospace;
}

.quali-ma-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(var(--primary-rgb, 255, 120, 0), 0.12);
  color: var(--primary);
}

.locations__state { color: var(--muted); font-size: 0.85rem; }
.locations__list { display: grid; gap: 6px; }
.location-row {
  display: grid;
  grid-template-columns: 52px 1fr auto 32px 32px;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--tile-bg);
  font-size: 0.85rem;

  &--inactive { opacity: 0.55; }
}
.location-row__short { color: var(--primary); font-weight: 700; }
.location-color-input { width: 48px; min-height: 36px; padding: 3px !important; cursor: pointer; }
.location-row__details { display: grid; gap: 2px; }
.location-row__details small { color: var(--muted); font-size: 0.72rem; }
.location-row__status { color: var(--muted); font-size: 0.75rem; }

.um__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  thead {
    background: var(--tile-bg);
    th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: var(--text-muted, var(--text));
      opacity: 0.75;
      white-space: nowrap;
      border-bottom: 1px solid var(--border);
    }
  }

  tbody {
    tr {
      transition: background 0.15s;
      border-bottom: 1px solid var(--border);

      &:last-child { border-bottom: none; }
      &:hover { background: var(--hover); }
      &.row--self { background: rgba(var(--primary-rgb, 255, 120, 0), 0.06); }
    }

    td {
      padding: 10px 14px;
      vertical-align: middle;
    }
  }
}

.th-actions,
.td-actions {
  text-align: right;
  white-space: nowrap;
}

.td-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

// Badges
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;

  &--admin {
    background: rgba(var(--primary-rgb, 255, 120, 0), 0.15);
    color: var(--primary);
    border: 1px solid var(--primary);
  }

  &--vertrieb {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  &--payroll {
    background: rgba(35, 122, 91, 0.12);
    color: #237a5b;
    border: 1px solid #237a5b;
  }

  &--user {
    background: var(--tile-bg);
    color: var(--text);
    border: 1px solid var(--border);
  }
}

.status {
  font-size: 0.8rem;
  font-weight: 500;

  &--ok { color: #28a745; }
  &--no { color: #dc3545; }
}

// Action Icon Buttons
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover { background: var(--hover); border-color: var(--primary); color: var(--primary); }

  &--danger {
    &:hover { border-color: #dc3545; color: #dc3545; background: rgba(220, 53, 69, 0.08); }
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    &:hover { background: var(--tile-bg); border-color: var(--border); color: var(--text); }
  }
}

// Buttons
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &-primary {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
    &:hover:not(:disabled) { filter: brightness(1.1); }
  }

  &-ghost {
    background: transparent;
    color: var(--text);
    border-color: var(--border);
    &:hover:not(:disabled) { background: var(--hover); }
  }

  &-danger {
    background: #dc3545;
    color: #fff;
    border-color: #dc3545;
    &:hover:not(:disabled) { background: color.adjust(#dc3545, $lightness: -8%); }
  }
}

// Modal
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: var(--surface, var(--tile-bg));
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: auto;

  &--sm { max-width: 400px; }
  &--location { max-width: 700px; overflow: hidden; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);

  h3 { margin: 0; font-size: 1rem; font-weight: 600; }
}

.location-modal-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 20px 0;
  border-bottom: 1px solid var(--border);

  button {
    padding: 8px 10px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;

    &:hover { color: var(--text); }
  }

  .location-modal-tabs__tab--active { border-bottom-color: var(--primary); color: var(--primary); font-weight: 700; }
}

.close-btn {
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
  &:hover { opacity: 1; background: var(--hover); }
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-footer {
  padding: 12px 20px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
}

.modal-error {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #dc3545;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}

// Form
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 480px) { grid-template-columns: 1fr; }
}

.location-form-grid--address { grid-template-columns: 2fr 1fr 1fr 2fr; }

.opening-hours {
  display: grid;
  gap: 10px;
  padding-top: 2px;
}

.opening-hours__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;

  label { font-size: 0.8rem; font-weight: 500; opacity: 0.75; }
  small { color: var(--muted); font-size: 0.75rem; }
}

.opening-hours__day {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
  align-items: start;
}

.opening-hours__day-name { padding-top: 8px; font-size: 0.82rem; font-weight: 500; }
.opening-hours__slots { display: grid; gap: 6px; }
.opening-hours__slot { display: flex; align-items: center; gap: 7px; }
.opening-hours__slot input {
  width: 112px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
}
.opening-hours__slot span { color: var(--muted); font-size: 0.8rem; }
.opening-hours__add {
  justify-self: start;
  padding: 5px 0;
  border: 0;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 0.8rem;
    font-weight: 500;
    opacity: 0.75;
  }

  input, select {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg);
    color: var(--text);
    font-size: 0.875rem;
    transition: border-color 0.15s;
    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }

  &--checkbox {
    justify-content: flex-end;
  }
}

.badge-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

// Role checkboxes in modal
.roles-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.role-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--primary); }
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
}

.required { color: #dc3545; margin-left: 2px; }
.hint { color: var(--text); opacity: 0.5; font-size: 0.75rem; margin-left: 4px; font-weight: 400; }

@media (max-width: 700px) {
  .locations__header { align-items: stretch; flex-direction: column; }
  .location-form-grid--address { grid-template-columns: 1fr 1fr; }
  .opening-hours__day { grid-template-columns: 1fr; gap: 3px; }
  .opening-hours__day-name { padding-top: 0; }
  .location-modal-tabs { overflow-x: auto; padding-inline: 12px; }
  .location-modal-tabs button { white-space: nowrap; }
}

.warning-text {
  margin: 0;
  line-height: 1.6;
  font-size: 0.9rem;
}

// Mitarbeiter link display in table
.ma-link-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--text);
  svg { opacity: 0.5; font-size: 0.75rem; }
}

.ma-link-nr {
  font-size: 0.72rem;
  opacity: 0.55;
  margin-left: 2px;
}

.ma-unlinked {
  opacity: 0.35;
}

// link modal styles
.btn-icon--link {
  &:hover { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.08); }
}

.btn-icon--asana {
  padding: 0 6px;
  &:hover { border-color: #f06a6a; background: rgba(240, 106, 106, 0.08); }

  .asana-icon { width: 14px; height: 14px; object-fit: contain; }
}

// Asana display in table
.asana-link-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--text);

  .asana-icon { width: 13px; height: 13px; object-fit: contain; opacity: 0.7; }
}

// Asana search results in modal
.asana-search-hint {
  font-size: 0.8rem;
  opacity: 0.6;
  padding: 6px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.asana-results {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.asana-result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
  color: var(--text);

  &:last-child { border-bottom: none; }
  &:hover { background: var(--hover); }

  &--selected {
    background: rgba(var(--primary-rgb, 255, 120, 0), 0.1);
    border-left: 3px solid var(--primary);
  }

  .asana-icon { width: 15px; height: 15px; flex-shrink: 0; }
}

.asana-result-name {
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
}

.asana-result-email {
  font-size: 0.75rem;
  opacity: 0.55;
  white-space: nowrap;
}

.current-link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.875rem;

  &__label { opacity: 0.6; white-space: nowrap; }
  &__name {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 500;
    flex: 1;
  }
}

.btn-unlink {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(220, 53, 69, 0.08);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #dc3545;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
  margin-left: auto;
  &:hover { background: rgba(220, 53, 69, 0.15); }
}

.hint-text {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.55;
}
</style>
