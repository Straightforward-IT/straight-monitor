<template>
  <PageLayout
    v-model="activeTab"
    title="Monitorverwaltung"
    :tabs="managementTabs"
    aria-label="Monitorverwaltung"
    width="full"
    content-variant="surface"
  >
  <section class="um">

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
          <AppIconButton variant="ghost" size="sm" label="Standort bearbeiten" @click="openLocationEdit(location)">
            <font-awesome-icon icon="fa-solid fa-pen" />
          </AppIconButton>
        </div>
      </div>
    </section>

    <ModalFrame
      v-if="locationModal.open"
      v-model="locationModal.open"
      :title="locationModal.isNew ? 'Standort anlegen' : 'Standort bearbeiten'"
      size="lg"
      style="--mf-max-width: 700px; --mf-body-padding: 0"
      @close="closeLocationModal"
    >
      <form id="location-form" class="location-modal-form" @submit.prevent="saveLocation">
        <nav class="location-modal-tabs" aria-label="Standortfelder">
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'general' }" @click="locationModal.activeTab = 'general'">Stammdaten</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'contact' }" @click="locationModal.activeTab = 'contact'">Kontakt & Rechtliches</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'hours' }" @click="locationModal.activeTab = 'hours'">Öffnungszeiten</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'signature' }" @click="locationModal.activeTab = 'signature'">Signatur</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'space' }" @click="locationModal.activeTab = 'space'">Space</button>
          <button type="button" :class="{ 'location-modal-tabs__tab--active': locationModal.activeTab === 'logistics' }" @click="locationModal.activeTab = 'logistics'">Sonstiges</button>
        </nav>
        <div class="modal-body">
          <template v-if="locationModal.activeTab === 'general'">
          <div class="form-grid">
            <div class="form-group"><label for="location-name">Name <span class="required">*</span></label><AppTextInput id="location-name" v-model="locationForm.nameFull" type="text" required :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-short">Kürzel <span class="required">*</span></label><AppTextInput id="location-short" v-model="locationForm.shortName" type="text" maxlength="8" required :disabled="locationSaving" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Standortfarbe</label><input v-model="locationForm.color" class="location-color-input" type="color" /></div>
          </div>
          <div class="form-grid location-form-grid--address">
            <div class="form-group"><label for="location-street">Straße</label><AppTextInput id="location-street" v-model="locationForm.address.street" type="text" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-house-number">Hausnummer</label><AppTextInput id="location-house-number" v-model="locationForm.address.houseNumber" type="text" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-postal-code">PLZ</label><AppTextInput id="location-postal-code" v-model="locationForm.address.postalCode" type="text" inputmode="numeric" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-city">Ort</label><AppTextInput id="location-city" v-model="locationForm.address.city" type="text" :disabled="locationSaving" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label for="location-country">Land</label><AppTextInput id="location-country" v-model="locationForm.address.country" type="text" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-manager">Standortleitung</label><AppSelect id="location-manager" v-model="locationForm.locationManager" :disabled="locationSaving"><option value="">Nicht zugeordnet</option><option v-for="user in users" :key="user._id" :value="user._id">{{ user.name || user.email }}</option></AppSelect></div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label for="location-office-customer">Office-Kunde</label>
              <AppSelect id="location-office-customer" v-model="locationForm.officeKunde" :disabled="locationSaving">
                <option value="">Nicht zugeordnet</option>
                <option v-for="kunde in officeCustomers" :key="kunde._id" :value="kunde._id">
                  {{ kunde.kundenNr }} · {{ kunde.kuerzel }} · {{ kunde.kundName || 'Ohne Namen' }}
                </option>
              </AppSelect>
              <small class="hint-text">Kunde mit Kürzel &gt;S für die Office-Besetzung dieses Standorts.</small>
            </div>
          </div>
          </template>
          <template v-else-if="locationModal.activeTab === 'contact'">
          <div class="form-grid">
            <div class="form-group"><label for="location-email">Haupt-E-Mail</label><AppTextInput id="location-email" v-model="locationForm.contact.mainEmail" type="email" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-phone">Telefon</label><AppTextInput id="location-phone" v-model="locationForm.contact.phone" type="tel" :disabled="locationSaving" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label for="location-timezone">Zeitzone</label><AppTextInput id="location-timezone" v-model="locationForm.timeZone" type="text" :disabled="locationSaving" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label for="location-legal-name">Rechtsträger</label><AppTextInput id="location-legal-name" v-model="locationForm.legal.legalName" type="text" :disabled="locationSaving" /></div>
            <div class="form-group"><label for="location-vat-id">USt-ID</label><AppTextInput id="location-vat-id" v-model="locationForm.legal.vatId" type="text" :disabled="locationSaving" /></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label for="location-registration">Handelsregister</label><AppTextInput id="location-registration" v-model="locationForm.legal.registrationNumber" type="text" :disabled="locationSaving" /></div>
          </div>
          </template>
          <section v-else-if="locationModal.activeTab === 'hours'" class="opening-hours">
            <div class="opening-hours__header"><label>Öffnungszeiten</label><small>Mehrere Zeitfenster pro Tag möglich</small></div>
            <div v-for="day in WEEKDAYS" :key="day.key" class="opening-hours__day">
              <span class="opening-hours__day-name">{{ day.label }}</span>
              <div class="opening-hours__slots">
                <div v-for="(slot, index) in locationForm.openingHours[day.key]" :key="index" class="opening-hours__slot">
                  <AppTextInput v-model="slot.start" type="time" :aria-label="`${day.label} von`" :disabled="locationSaving" />
                  <span>bis</span>
                  <AppTextInput v-model="slot.end" type="time" :aria-label="`${day.label} bis`" :disabled="locationSaving" />
                  <AppIconButton variant="ghost" size="sm" :label="`Zeitfenster für ${day.label} entfernen`" :disabled="locationSaving" @click="removeOpeningHour(day.key, index)"><font-awesome-icon icon="fa-solid fa-trash" /></AppIconButton>
                </div>
                <AppButton variant="outlined" size="sm" :disabled="locationSaving" @click="addOpeningHour(day.key)"><font-awesome-icon icon="fa-solid fa-plus" /> Zeitfenster</AppButton>
              </div>
            </div>
          </section>
          <section v-else-if="locationModal.activeTab === 'signature'" class="signature-defaults">
            <p class="hint-text">Diese Angaben werden beim Erstellen einer Signatur für den jeweiligen Dokumenttyp vorausgefüllt.</p>
            <div v-for="signatureType in signatureTypes" :key="signatureType._id" class="signature-defaults__row">
              <strong>{{ signatureType.label }}</strong>
              <div class="form-grid">
                <div class="form-group"><label :for="`signature-name-${signatureType._id}`">Name</label><AppTextInput :id="`signature-name-${signatureType._id}`" v-model="signatureDefaultFor(signatureType._id).name" type="text" :disabled="locationSaving" /></div>
                <div class="form-group"><label :for="`signature-email-${signatureType._id}`">E-Mail</label><AppTextInput :id="`signature-email-${signatureType._id}`" v-model="signatureDefaultFor(signatureType._id).email" type="email" :disabled="locationSaving" /></div>
              </div>
              <AppToggleChip v-model="signatureDefaultFor(signatureType._id).embedded" label="Im Monitor unterzeichnen" :disabled="locationSaving" />
            </div>
          </section>
          <template v-else-if="locationModal.activeTab === 'space'">
          <div class="form-group"><label for="location-space-team">OneDrive-Team</label><AppTextInput id="location-space-team" v-model="locationForm.spaceFolder.teamKey" type="text" placeholder="z. B. hamburg" :disabled="locationSaving" /></div>
          <div class="form-group"><label for="location-space-folder">Space-Ordner-ID</label><AppTextInput id="location-space-folder" v-model="locationForm.spaceFolder.folderId" type="text" placeholder="OneDrive-Ordner-ID" :disabled="locationSaving" /></div>
          <p class="hint-text">Dieser Ordner ist der Einstiegspunkt für den Standort-Space im Dashboard.</p>
          </template>
          <template v-else>
          <div class="form-group"><label for="location-external-id">Externe ID</label><AppTextInput id="location-external-id" v-model="locationForm.externalId" type="text" :disabled="locationSaving" /></div>
          <div class="form-group"><label>Anlieferhinweise</label><textarea v-model="locationForm.deliveryNotes" rows="3" /></div>
          </template>
          <p v-if="locationModal.error" class="modal-error">{{ locationModal.error }}</p>
        </div>
      </form>
      <template #footer>
        <AppButton variant="secondary" :disabled="locationSaving" @click="closeLocationModal">Abbrechen</AppButton>
        <AppButton type="submit" form="location-form" :loading="locationSaving" :disabled="!canCreateLocation">{{ locationModal.isNew ? 'Anlegen' : 'Speichern' }}</AppButton>
      </template>
    </ModalFrame>
    </template>

    <section v-else-if="activeTab === 'users'" class="users">
      <Toolbar>
      <SearchBar class="toolbar-search" v-model="searchQuery" placeholder="Benutzer suchen…" aria-label="Benutzer suchen" />
      <ToolbarLabel>{{ filteredUsers.length }} Benutzer</ToolbarLabel>
      <template #actions>
      <ToolbarGroup push-right>
        <ToolbarButton variant="secondary" @click="openCreate">
          <font-awesome-icon icon="fa-solid fa-plus" />
          Neuer Benutzer
        </ToolbarButton>
      </ToolbarGroup>
      </template>
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
              <div class="td-actions__controls">
                <AppIconButton size="sm" variant="ghost" label="Benutzer bearbeiten" @click="openEdit(u)">
                  <font-awesome-icon icon="fa-solid fa-pen" />
                </AppIconButton>
                <AppIconButton
                  size="sm" variant="ghost"
                  :label="u.mitarbeiter ? 'Mitarbeiter-Verknüpfung bearbeiten' : 'Mit Mitarbeiter verknüpfen'"
                  @click="openLink(u)"
                >
                  <font-awesome-icon icon="fa-solid fa-link" />
                </AppIconButton>
                <AppIconButton
                  size="sm" variant="ghost"
                  :label="u.asana_id ? 'Asana-Verknüpfung bearbeiten' : 'Mit Asana-User verknüpfen'"
                  @click="openAsanaLink(u)"
                >
                  <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
                </AppIconButton>
                <AppIconButton
                  size="sm" variant="ghost"
                  label="Benutzer löschen"
                  :disabled="u._id === currentUserId"
                  @click="openDelete(u)"
                >
                  <font-awesome-icon icon="fa-solid fa-trash" />
                </AppIconButton>
              </div>
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
              <th>Kundenkonditionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lohnart in filteredLohnarten" :key="lohnart._id" :class="{ 'lohn__row--normalstunden': lohnart.lohnartNummer === '100' }">
              <td><span class="quali-key">{{ lohnart.lohnartNummer }}</span></td>
              <td><span v-if="lohnart.lohnartKurzzeichen" class="beruf-tag">{{ lohnart.lohnartKurzzeichen }}</span><span v-else class="ma-unlinked">-</span></td>
              <td>{{ lohnart.lohnartBezeichnung || '-' }}</td>
              <td>{{ lohnart.rechnungstext || '-' }}</td>
              <td>{{ lohnart.kostenart || '-' }}</td>
              <td>{{ lohnart.berechnungsartCode || '-' }}</td>
              <td class="lohn__zuschlag">{{ lohnart.zuschlagsProzent || '-' }}</td>
              <td>{{ lohnart.equalPayRelevanz || '-' }}</td>
              <td class="lohn__kunden">
                <div v-if="lohnart.lohnartNummer !== '100' && lohnart.kunden?.length" class="lohn__kunden-list">
                  <button v-for="kunde in lohnart.kunden" :key="kunde._id" type="button" class="lohn__kunde-link" @click="openKundenPreise(kunde)">
                    {{ kunde.kuerzel || kunde.kundName || kunde.kundenNr }}
                  </button>
                </div>
                <span v-else-if="lohnart.lohnartNummer !== '100'" class="ma-unlinked">-</span>
              </td>
            </tr>
            <tr v-if="!filteredLohnarten.length">
              <td colspan="9" style="text-align:center; opacity:0.45; padding: 24px;">Keine Lohnarten vorhanden.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else-if="activeTab === 'tarif'" class="tarif">
      <p class="hint-text">Tarifbereiche werden hier künftig als Tabs ergänzt.</p>
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
        <template #actions>
        <ToolbarGroup push-right>
          <ToolbarButton @click="openQualiCreate">
            <font-awesome-icon icon="fa-solid fa-plus" />
            Qualifikation anlegen
          </ToolbarButton>
        </ToolbarGroup>
        </template>
      </Toolbar>
      <p v-if="qualiError" class="um__error">{{ qualiError }}</p>
      <p v-else-if="qualiLoading" class="qualifikationen__state">Qualifikationen werden geladen…</p>
      <template v-else>
        <div class="um__table-wrap">
          <table class="um__table">
            <thead>
              <tr>
                <th>Schlüssel</th>
                <th>Bezeichnung</th>
                <th>Mitarbeiter</th>
                <th class="th-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="q in filteredQualifikationen" :key="q._id">
                <td><span class="quali-key">#{{ q.qualificationKey }}</span></td>
                <td>{{ q.designation }}</td>
                <td>
                  <span v-if="q.mitarbeiterCount" class="quali-ma-count">{{ q.mitarbeiterCount }}</span>
                  <span v-else class="ma-unlinked">0</span>
                </td>
                <td class="td-actions">
                  <AppIconButton variant="ghost" size="sm" label="Qualifikation bearbeiten" @click="openQualiEdit(q)">
                    <font-awesome-icon icon="fa-solid fa-pen" />
                  </AppIconButton>
                </td>
              </tr>
              <tr v-if="!filteredQualifikationen.length">
                <td colspan="4" style="text-align:center; opacity:0.45; padding: 24px;">Keine Qualifikationen vorhanden.</td>
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
        <template #actions>
        <ToolbarGroup push-right>
          <ToolbarButton @click="openBerufCreate">
            <font-awesome-icon icon="fa-solid fa-plus" />
            Beruf anlegen
          </ToolbarButton>
        </ToolbarGroup>
        </template>
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
              <th>Mitarbeiter</th>
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
                <span v-if="b.mitarbeiterCount" class="quali-ma-count">{{ b.mitarbeiterCount }}</span>
                <span v-else class="ma-unlinked">0</span>
              </td>
              <td class="td-actions">
                <AppIconButton variant="ghost" size="sm" label="Beruf bearbeiten" @click="openBerufEdit(b)">
                  <font-awesome-icon icon="fa-solid fa-pen" />
                </AppIconButton>
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
    <ModalFrame :model-value="berufModal.open" :title="berufModal.isNew ? 'Beruf anlegen' : 'Beruf bearbeiten'" size="sm" :close-on-escape="!berufModal.saving" :close-on-backdrop="!berufModal.saving" :show-close="!berufModal.saving" @close="closeBerufModal">
      <form id="beruf-form" @submit.prevent="saveBeruf">
        <div class="modal-body">
          <div class="form-group">
            <label for="beruf-key">Schlüssel <span class="required">*</span></label>
            <AppTextInput id="beruf-key" v-model.number="berufModal.form.jobKey" type="number" required disabled />
          </div>
          <div class="form-group">
            <label for="beruf-designation">Bezeichnung <span class="required">*</span></label>
            <AppTextInput id="beruf-designation" v-model="berufModal.form.designation" type="text" required :disabled="berufModal.saving" />
          </div>
          <div class="form-group">
            <label for="beruf-taetigkeit">Tätigkeitsschlüssel</label>
            <AppTextInput id="beruf-taetigkeit" v-model="berufModal.form.taetigkeitsschluessel" type="text" :disabled="berufModal.saving" />
          </div>
          <p v-if="berufModal.error" class="modal-error">{{ berufModal.error }}</p>
        </div>
      </form>
      <template #footer>
          <AppButton variant="secondary" :disabled="berufModal.saving" @click="closeBerufModal">Abbrechen</AppButton>
          <AppButton type="submit" form="beruf-form" :loading="berufModal.saving">
            {{ berufModal.isNew ? 'Anlegen' : 'Speichern' }}
          </AppButton>
      </template>
    </ModalFrame>

    <!-- Qualifikation Create/Edit Modal -->
    <ModalFrame :model-value="qualiModal.open" :title="qualiModal.isNew ? 'Qualifikation anlegen' : 'Qualifikation bearbeiten'" size="sm" :close-on-escape="!qualiModal.saving" :close-on-backdrop="!qualiModal.saving" :show-close="!qualiModal.saving" @close="closeQualiModal">
      <form id="quali-form" @submit.prevent="saveQualifikation">
        <div class="modal-body">
          <div class="form-group">
            <label for="quali-key">Schlüssel <span class="required">*</span></label>
            <AppTextInput id="quali-key" v-model.number="qualiModal.form.qualificationKey" type="number" required disabled />
          </div>
          <div class="form-group">
            <label for="quali-designation">Bezeichnung <span class="required">*</span></label>
            <AppTextInput id="quali-designation" v-model="qualiModal.form.designation" type="text" required :disabled="qualiModal.saving" />
          </div>
          <p v-if="qualiModal.error" class="modal-error">{{ qualiModal.error }}</p>
        </div>
      </form>
      <template #footer>
          <AppButton variant="secondary" :disabled="qualiModal.saving" @click="closeQualiModal">Abbrechen</AppButton>
          <AppButton type="submit" form="quali-form" :loading="qualiModal.saving">
            {{ qualiModal.isNew ? 'Anlegen' : 'Speichern' }}
          </AppButton>
      </template>
    </ModalFrame>

    <!-- Edit / Create Modal -->
    <ModalFrame :model-value="editModal.open" :title="editModal.isNew ? 'Neuen Benutzer anlegen' : 'Benutzer bearbeiten'" size="md" :close-on-escape="!editModal.saving" :close-on-backdrop="!editModal.saving" :show-close="!editModal.saving" @close="closeEdit">
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label for="user-name">Name</label>
              <AppTextInput id="user-name" v-model="editModal.form.name" type="text" placeholder="Max Mustermann" :disabled="editModal.saving" />
            </div>
            <div class="form-group">
              <label for="user-location-legacy">Standort (Legacy)</label>
              <AppTextInput id="user-location-legacy" v-model="editModal.form.location" type="text" placeholder="Hamburg" :disabled="editModal.saving" />
            </div>
            <div class="form-group">
              <label for="user-location">Standort v2</label>
              <AppSelect id="user-location" v-model="editModal.form.locationV2" :disabled="editModal.saving">
                <option value="">Nicht zugeordnet</option>
                <option v-for="location in activeLocations" :key="location._id" :value="location._id">{{ location.nameFull }}</option>
              </AppSelect>
            </div>
            <div class="form-group">
              <label>Space-Zugriff</label>
              <div class="roles-checkboxes">
                <label v-for="location in activeLocations" :key="location._id" class="role-checkbox-label">
                  <input type="checkbox" :value="location._id" v-model="editModal.form.locationAccess" />
                  <span>{{ location.nameFull }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="user-email">E-Mail <span class="required">*</span></label>
            <AppTextInput id="user-email" v-model="editModal.form.email" type="email" placeholder="name@straightforward.email" :disabled="editModal.saving" />
          </div>

          <div class="form-group">
            <label for="user-password">
              Passwort
              <span v-if="!editModal.isNew" class="hint">(leer lassen = nicht ändern)</span>
              <span v-else class="required">*</span>
            </label>
            <AppTextInput id="user-password" v-model="editModal.form.password" type="password" placeholder="Neues Passwort" autocomplete="new-password" :disabled="editModal.saving" />
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

        <template #footer>
          <AppButton variant="secondary" :disabled="editModal.saving" @click="closeEdit">Abbrechen</AppButton>
          <AppButton :loading="editModal.saving" @click="saveUser">
            {{ editModal.isNew ? 'Anlegen' : 'Speichern' }}
          </AppButton>
        </template>
    </ModalFrame>

    <!-- MB Verknüpfen Modal -->
    <ModalFrame :model-value="linkModal.open" title="Mit Mitarbeiter verknüpfen" size="sm" :close-on-escape="!linkModal.saving" :close-on-backdrop="!linkModal.saving" :show-close="!linkModal.saving" @close="closeLink">
        <div class="modal-body">
          <!-- Current link -->
          <div v-if="linkModal.mitarbeiterObj" class="current-link">
            <span class="current-link__label">Aktuell verknüpft:</span>
            <span class="current-link__name">
              <font-awesome-icon icon="fa-solid fa-user-tie" />
              {{ linkModal.mitarbeiterObj.vorname }} {{ linkModal.mitarbeiterObj.nachname }}
              <span v-if="linkModal.mitarbeiterObj.personalnr" class="ma-link-nr">#{{ linkModal.mitarbeiterObj.personalnr }}</span>
            </span>
            <AppButton variant="danger" size="sm" :disabled="linkModal.saving" @click="clearLink" title="Verknüpfung entfernen">
              <font-awesome-icon icon="fa-solid fa-unlink" />
              Entfernen
            </AppButton>
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

        <template #footer>
          <AppButton variant="secondary" :disabled="linkModal.saving" @click="closeLink">Abbrechen</AppButton>
          <AppButton :loading="linkModal.saving" @click="saveLink">
            Speichern
          </AppButton>
        </template>
    </ModalFrame>

    <!-- Asana Link Modal -->
    <ModalFrame :model-value="asanaModal.open" title="Mit Asana-User verknüpfen" size="sm" :close-on-escape="!asanaModal.saving" :close-on-backdrop="!asanaModal.saving" :show-close="!asanaModal.saving" @close="closeAsanaLink">
        <div class="modal-body">
          <!-- Current Asana link -->
          <div v-if="asanaModal.currentAsanaUser" class="current-link">
            <span class="current-link__label">Aktuell verknüpft:</span>
            <span class="current-link__name">
              <img src="@/assets/asana.png" class="asana-icon" alt="Asana" />
              {{ asanaModal.currentAsanaUser.name }}
              <span v-if="asanaModal.currentAsanaUser.email" class="ma-link-nr">{{ asanaModal.currentAsanaUser.email }}</span>
            </span>
            <AppButton variant="danger" size="sm" :disabled="asanaModal.saving" @click="clearAsanaLink" title="Verknüpfung entfernen">
              <font-awesome-icon icon="fa-solid fa-unlink" />
              Entfernen
            </AppButton>
          </div>
          <p v-else class="hint-text">Kein Asana-User verknüpft.</p>

          <div class="form-group">
            <label for="asana-user-search">{{ asanaModal.currentAsanaUser ? 'Anderen Asana-User auswählen' : 'Asana-User suchen' }}</label>
            <AppTextInput
              id="asana-user-search"
              v-model="asanaModal.search"
              type="text"
              placeholder="Name oder E-Mail…"
              :disabled="asanaModal.saving"
              @update:model-value="searchAsanaUsers"
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

        <template #footer>
          <AppButton variant="secondary" :disabled="asanaModal.saving" @click="closeAsanaLink">Abbrechen</AppButton>
          <AppButton :loading="asanaModal.saving" :disabled="!asanaModal.selectedGid && !asanaModal.clearPending" @click="saveAsanaLink">
            Speichern
          </AppButton>
        </template>
    </ModalFrame>

    <!-- Delete Confirm Modal -->
    <ModalFrame :model-value="deleteModal.open" title="Benutzer löschen" size="sm" :close-on-escape="!deleteModal.deleting" :close-on-backdrop="!deleteModal.deleting" :show-close="!deleteModal.deleting" @close="closeDelete">
        <div class="modal-body">
          <p class="warning-text">
            Möchtest du den Benutzer <strong>{{ deleteModal.user?.name || deleteModal.user?.email }}</strong> wirklich löschen?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div v-if="deleteModal.error" class="modal-error">{{ deleteModal.error }}</div>
        </div>

        <template #footer>
          <AppButton variant="secondary" :disabled="deleteModal.deleting" @click="closeDelete">Abbrechen</AppButton>
          <AppButton variant="danger" :loading="deleteModal.deleting" @click="confirmDelete">
            Löschen
          </AppButton>
        </template>
    </ModalFrame>
  </section>
  </PageLayout>
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
import PageLayout from '@/components/layout/PageLayout.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppToggleChip from '@/components/ui-elements/AppToggleChip.vue';
import BewerberManagementTab from '@/components/BewerberManagementTab.vue';
import EmployeeEmailTemplateTab from '@/components/EmployeeEmailTemplateTab.vue';
import { useCustomerModals } from '@/composables/useCustomerModals';

// Map of asana_gid -> { name, email } for display in the table
const asanaUserMap = ref({});

const AVAILABLE_ROLES = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'VERTRIEB', label: 'VERTRIEB' },
  { value: 'PAYROLL', label: 'PAYROLL' },
];

const managementTabs = [
  { id: 'locations', label: 'Standorte', icon: ['fas', 'location-dot'] },
  { id: 'users', label: 'Benutzer', icon: ['fas', 'users'] },
  { id: 'applicants', label: 'Bewerbermanagement', icon: ['fas', 'envelope'] },
  { id: 'emailTemplates', label: 'E-Mail-Vorlagen', icon: ['fas', 'envelope-open-text'] },
  { id: 'qualifikationen', label: 'Qualif. & Berufe', icon: ['fas', 'graduation-cap'] },
  { id: 'lohn', label: 'Lohn', icon: ['fas', 'money-bill-wave'] },
  { id: 'tarif', label: 'Tarif', icon: ['fas', 'file-lines'] },
];

const auth = useAuth();
const { openCustomer } = useCustomerModals();
const currentUserId = computed(() => auth.user?._id || auth.user?.id);

const users = ref([]);
const loading = ref(true);
const error = ref('');
const searchQuery = ref('');
const activeTab = ref('locations');
const locations = ref([]);
const kunden = ref([]);
const signatureTypes = ref([]);
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
  officeKunde: '',
  contact: { mainEmail: '', phone: '' },
  openingHours: emptyOpeningHours(),
  timeZone: 'Europe/Berlin',
  legal: { legalName: '', vatId: '', registrationNumber: '' },
  signatureDefaults: [],
  externalId: '',
  spaceFolder: { teamKey: '', folderId: '' },
  deliveryNotes: '',
  settings: {},
});
const locationModal = reactive({ open: false, isNew: true, locationId: null, activeTab: 'general', error: '' });
const canCreateLocation = computed(() => locationForm.nameFull.trim() && locationForm.shortName.trim());
const activeLocations = computed(() => locations.value.filter((location) => location.isActive));
const officeCustomers = computed(() => kunden.value.filter((kunde) => kunde.kuerzel === '>S'));

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
    locationAccess: [],
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
const qualiModal = reactive({ open: false, isNew: true, id: null, saving: false, error: '', form: { qualificationKey: '', designation: '' } });

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

async function fetchKunden() {
  try {
    const { data } = await api.get('/api/kunden');
    kunden.value = Array.isArray(data) ? data : [];
  } catch (e) {
    locationError.value = e?.response?.data?.message || 'Fehler beim Laden der Kunden.';
  }
}

function openKundenPreise(kunde) {
  openCustomer(kunde, { initialTab: 'preise' });
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

const filteredQualifikationen = computed(() => {
  const q = qualiSearch.value.trim().toLowerCase();
  if (!q) return qualifikationen.value;
  return qualifikationen.value.filter(r =>
    String(r.qualificationKey).includes(q) ||
    r.designation.toLowerCase().includes(q)
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
  Object.assign(qualiModal, { open: true, isNew: true, id: null, saving: false, error: '', form: { qualificationKey: nextAvailableKey(qualifikationen.value, 'qualificationKey', 1), designation: '' } });
}

function openQualiEdit(q) {
  Object.assign(qualiModal, { open: true, isNew: false, id: q._id, saving: false, error: '', form: { qualificationKey: q.qualificationKey, designation: q.designation } });
}

function closeQualiModal() { qualiModal.open = false; }

async function saveQualifikation() {
  qualiModal.error = '';
  qualiModal.saving = true;
  try {
    const payload = { ...qualiModal.form };
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

// ─── Berufe ─────────────────────────────────────────────────────────────────
const berufModal = reactive({ open: false, isNew: true, id: null, saving: false, error: '', form: { jobKey: '', designation: '', taetigkeitsschluessel: '' } });

const filteredBerufe = computed(() => {
  const q = berufSearch.value.trim().toLowerCase();
  if (!q) return berufe.value;
  return berufe.value.filter(b =>
    String(b.jobKey).includes(q) ||
    b.designation.toLowerCase().includes(q) ||
    (b.taetigkeitsschluessel || '').toLowerCase().includes(q)
  );
});

function nextAvailableKey(items, key, start) {
  const highestKey = items.reduce((highest, item) => Math.max(highest, Number(item[key]) || 0), start - 1);
  return highestKey + 1;
}

function openBerufCreate() {
  Object.assign(berufModal, { open: true, isNew: true, id: null, saving: false, error: '', form: { jobKey: nextAvailableKey(berufe.value, 'jobKey', 10001), designation: '', taetigkeitsschluessel: '' } });
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
      berufe.value = [...berufe.value, { ...data.data, mitarbeiterCount: 0 }].sort((a, b) => a.jobKey - b.jobKey);
    } else {
      const { data } = await api.put(`/api/import/berufe/${berufModal.id}`, berufModal.form);
      const idx = berufe.value.findIndex(b => b._id === berufModal.id);
      if (idx !== -1) berufe.value[idx] = { ...data.data, mitarbeiterCount: berufe.value[idx].mitarbeiterCount };
    }
    closeBerufModal();
  } catch (e) {
    berufModal.error = e?.response?.data?.message || 'Fehler beim Speichern.';
  } finally {
    berufModal.saving = false;
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchUsers();
  await loadAsanaUserMap();
  await fetchLocations();
  await fetchKunden();
  await fetchSignatureTypes();
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

async function fetchSignatureTypes() {
  try {
    const { data } = await api.get('/api/signatur-typen');
    signatureTypes.value = (Array.isArray(data) ? data : []).filter((type) => type.isActive !== false);
  } catch (e) {
    locationError.value = e?.response?.data?.message || 'Signaturtypen konnten nicht geladen werden.';
  }
}

function signatureDefaultFor(typeId) {
  let signatureDefault = locationForm.signatureDefaults.find((entry) => String(entry.typ) === String(typeId));
  if (!signatureDefault) {
    signatureDefault = { typ: typeId, name: '', email: '', embedded: true };
    locationForm.signatureDefaults.push(signatureDefault);
  }
  return signatureDefault;
}

function resetLocationForm() {
  locationForm.nameFull = '';
  locationForm.shortName = '';
  locationForm.color = '#6b7280';
  Object.assign(locationForm.address, { street: '', houseNumber: '', postalCode: '', city: '', country: 'Deutschland' });
  locationForm.locationManager = '';
  locationForm.officeKunde = '';
  Object.assign(locationForm.contact, { mainEmail: '', phone: '' });
  Object.assign(locationForm.openingHours, emptyOpeningHours());
  locationForm.timeZone = 'Europe/Berlin';
  Object.assign(locationForm.legal, { legalName: '', vatId: '', registrationNumber: '' });
  locationForm.signatureDefaults = [];
  locationForm.externalId = '';
  Object.assign(locationForm.spaceFolder, { teamKey: '', folderId: '' });
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
  locationForm.officeKunde = location.officeKunde?._id || location.officeKunde || '';
  Object.assign(locationForm.contact, { mainEmail: '', phone: '', ...location.contact });
  Object.assign(locationForm.openingHours, normalizeOpeningHours(location.openingHours));
  locationForm.timeZone = location.timeZone || 'Europe/Berlin';
  Object.assign(locationForm.legal, { legalName: '', vatId: '', registrationNumber: '', ...location.legal });
  locationForm.signatureDefaults = (location.signatureDefaults || []).map((entry) => ({
    typ: entry.typ?._id || entry.typ,
    name: entry.name || '',
    email: entry.email || '',
    embedded: entry.embedded !== false,
  }));
  locationForm.externalId = location.externalId || '';
  Object.assign(locationForm.spaceFolder, { teamKey: '', folderId: '', ...location.spaceFolder });
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
    form: { name: '', email: '', password: '', location: '', locationV2: '', locationAccess: [], roles: ['USER'], isConfirmed: true },
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
      locationAccess: (u.locationAccess || []).map((location) => location._id || location),
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

function searchAsanaUsers(value) {
  asanaModal.search = value;
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

.um {
  color: var(--text);
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
  padding-top: 0;
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
.lohn__row--normalstunden { opacity: 0.58; }
.lohn__kunden { min-width: 180px; }
.lohn__kunden-list { display: flex; flex-wrap: wrap; gap: 4px; }
.lohn__kunde-link { padding: 0; border: 0; background: transparent; color: var(--primary); cursor: pointer; font: inherit; text-align: left; }
.lohn__kunde-link:hover { text-decoration: underline; }
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
  vertical-align: middle;
}

.td-actions__controls {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.asana-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  object-fit: contain;
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

.location-modal-form { min-height: 0; }

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

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
}
.opening-hours__slot span { color: var(--muted); font-size: 0.8rem; }

.signature-defaults {
  display: grid;
  gap: 14px;
}
.signature-defaults__row {
  display: grid;
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 7px;

  strong { font-size: 0.86rem; font-weight: 600; }
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

  input:not(.app-text-input):not([type="checkbox"]), select:not(.app-select) {
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

.hint-text {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.55;
}
</style>
