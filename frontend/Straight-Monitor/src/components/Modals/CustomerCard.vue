<template>
  <ModalFrame
    minimizable
    size="xl"
    style="--mf-max-width: min(1120px, 94vw); --mf-max-height: 92dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    :data-theme="effectiveTheme"
    :close-on-escape="false"
    @close="emit('close')"
  >
    <template #header>
      <div class="card-header">
      <div class="left">
        <div class="icon-box">
          <font-awesome-icon :icon="['fas', 'building']" class="header-icon" />
        </div>
        <div class="title">
          <span class="kunden-nr">Kunden-Nr. {{ kunde.kundenNr }}</span>
          <div class="name-row">
            <span class="name">{{ kunde.kundName || 'Unbenannt' }}</span>
            <!-- Kuerzel -->
            <template v-if="!editingKuerzel">
              <span v-if="kunde.kuerzel" class="kuerzel-badge" @click="startEditKuerzel" title="Kürzel bearbeiten">{{ kunde.kuerzel }}</span>
              <button v-else class="kuerzel-add-btn" @click="startEditKuerzel" title="Kürzel festlegen">
                <font-awesome-icon :icon="['fas', 'tag']" /> Kürzel
              </button>
            </template>
            <template v-else>
              <div class="kuerzel-edit-row" @keydown.enter="saveKuerzel" @keydown.esc="cancelEditKuerzel">
                <input
                  ref="kuerzelInputRef"
                  v-model="kuerzelInput"
                  class="kuerzel-input"
                  placeholder="z.B. ABB"
                  maxlength="20"
                />
                <button class="kuerzel-save-btn" @click="saveKuerzel" :disabled="kuerzelSaving">
                  <font-awesome-icon :icon="['fas', kuerzelSaving ? 'spinner' : 'check']" :spin="kuerzelSaving" />
                </button>
                <button class="kuerzel-cancel-btn" @click="cancelEditKuerzel">
                  <font-awesome-icon :icon="['fas', 'times']" />
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
      </div>
    </template>

    <template #actions>
      <span class="status-badge" :class="getStatusClass(kunde.kundStatus)">
        {{ getStatusText(kunde.kundStatus) }}
      </span>
    </template>

    <article class="customer-card" :data-theme="effectiveTheme">
      <nav class="customer-tabs" aria-label="Kundendetails">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="customer-tab"
          :class="{ active: activeTab === tab.id }"
          :aria-selected="activeTab === tab.id"
          @click="activeTab = tab.id"
        >
          <font-awesome-icon :icon="['fas', tab.icon]" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

    <!-- Body -->
    <div class="card-body">
      
      <!-- General Info -->
      <section v-if="activeTab === 'allgemein'" class="section info-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'info-circle']" /> Allgemeine Daten
        </h4>
        <div class="kv-grid">
          <div class="kv-item">
            <span class="label">Geschäftsstelle</span>
            <span class="value">{{ getGeschStText(kunde.geschSt) }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kostenstelle</span>
            <span class="value">{{ kunde.kostenSt || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Kunde seit</span>
            <span class="value">{{ formatDate(kunde.kundeSeit) }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Debitorenkonto</span>
            <span class="value">{{ kunde.zvoove_debitorkonto || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">USt-IdNr.</span>
            <span class="value">{{ kunde.ustId || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Steuernummer</span>
            <span class="value">{{ kunde.steuerNummer || '—' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">Handelsregister-Nr.</span>
            <span class="value">{{ kunde.handelsregisterNr || '—' }}</span>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'allgemein'" class="section remarks-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'clipboard']" /> Bemerkungen
          <button class="btn-add-contact remarks-add-btn" type="button" title="Bemerkung hinzufügen" @click="startAddRemark">
            <font-awesome-icon :icon="['fas', 'plus']" /> Bemerkung hinzufügen
          </button>
        </h4>
        <div v-if="remarkDraft !== null" class="remark-editor">
          <input
            ref="remarkInputRef"
            v-model="remarkDraft"
            type="text"
            maxlength="1000"
            placeholder="Bemerkung eingeben"
            @keyup.enter="saveRemark"
            @keyup.escape="cancelRemarkEdit"
          />
          <button type="button" class="remark-action remark-action--save" title="Speichern" :disabled="remarksSaving" @click="saveRemark">
            <font-awesome-icon :icon="['fas', 'check']" />
          </button>
          <button type="button" class="remark-action" title="Abbrechen" :disabled="remarksSaving" @click="cancelRemarkEdit">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </button>
        </div>
        <ul v-if="remarks.length" class="remarks-list">
          <li v-for="(rem, index) in remarks" :key="`${index}-${rem}`" class="remark-item">
            <template v-if="editingRemarkIndex === index">
              <div class="remark-editor">
                <input
                  ref="remarkInputRef"
                  v-model="remarkDraft"
                  type="text"
                  maxlength="1000"
                  @keyup.enter="saveRemark"
                  @keyup.escape="cancelRemarkEdit"
                />
                <button type="button" class="remark-action remark-action--save" title="Speichern" :disabled="remarksSaving" @click="saveRemark">
                  <font-awesome-icon :icon="['fas', 'check']" />
                </button>
                <button type="button" class="remark-action" title="Abbrechen" :disabled="remarksSaving" @click="cancelRemarkEdit">
                  <font-awesome-icon :icon="['fas', 'xmark']" />
                </button>
              </div>
            </template>
            <template v-else>
              <span>{{ rem }}</span>
              <span class="remark-actions">
                <button type="button" class="remark-action" title="Bemerkung bearbeiten" @click="startEditRemark(index)">
                  <font-awesome-icon :icon="['fas', 'pen']" />
                </button>
                <button type="button" class="remark-action remark-action--delete" title="Bemerkung löschen" @click="deleteRemark(index)">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </span>
            </template>
          </li>
        </ul>
        <p v-else-if="remarkDraft === null" class="remarks-empty">Keine Bemerkungen vorhanden.</p>
      </section>

      <!-- Einsätze -->
      <section v-if="activeTab === 'einsaetze' && kunde.kundenNr" class="section top-ma-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'users']" /> Häufigste Mitarbeiter
          <span class="badge">{{ topMaAll.length }}</span>
        </h4>

        <div v-if="topMaLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Wird geladen…
        </div>

        <div v-else-if="topMaAll.length === 0" class="empty-contacts">
          Noch keine Einsatz-Daten vorhanden.
        </div>

        <div v-else>
          <div class="top-ma-list">
            <div
              v-for="(ma, idx) in topMaVisible"
              :key="ma._id"
              class="top-ma-item"
            >
              <div class="top-ma-row">
                <span class="top-ma-rank">#{{ idx + 1 }}</span>
                <button class="top-ma-name" @click.stop="openEmployeeCard(ma._id)" title="Mitarbeiterprofil öffnen">{{ ma.vorname }} {{ ma.nachname }}</button>
                <span class="top-ma-nr" v-if="ma.personalnr">Nr. {{ ma.personalnr }}</span>
                <span class="top-ma-count">{{ ma.count }} Einsatz{{ ma.count !== 1 ? 'e' : '' }}</span>
                <button class="top-ma-expand-btn" @click="toggleMaExpand(ma)" :title="expandedMaIds.has(String(ma._id)) ? 'Einklappen' : 'Einsätze anzeigen'">
                  <font-awesome-icon :icon="['fas', expandedMaIds.has(String(ma._id)) ? 'chevron-up' : 'chevron-down']" />
                </button>
              </div>
              <div v-if="expandedMaIds.has(String(ma._id))" class="top-ma-einsatz-expand">
                <div v-if="maEinsaetzeMap[String(ma._id)]?.loading" class="top-ma-einsatz-loading">
                  <font-awesome-icon :icon="['fas', 'spinner']" spin /> Lade Einsätze…
                </div>
                <div v-else-if="!maEinsaetzeMap[String(ma._id)]?.data?.length" class="top-ma-einsatz-empty">
                  Keine Einsätze gefunden.
                </div>
                <div v-else class="top-ma-einsatz-list">
                  <button
                    v-for="e in maEinsaetzeMap[String(ma._id)].data"
                    :key="e._id"
                    class="top-ma-einsatz-row"
                    @click="openAuftrag(e)"
                    title="In Aufträgen öffnen"
                  >
                    <span class="tme-date">{{ formatEinsatzDate(e.datumVon) }}</span>
                    <span class="tme-title">{{ e.auftrag?.eventTitel || ('Auftrag ' + e.auftragNr) }}</span>
                    <span class="tme-shift" v-if="e.schichtBezeichnung || e.uhrzeitVon">
                      {{ [e.schichtBezeichnung, e.uhrzeitVon && e.uhrzeitBis ? e.uhrzeitVon + '–' + e.uhrzeitBis : e.uhrzeitVon].filter(Boolean).join(' · ') }}
                    </span>
                    <span class="tme-location" v-if="e.auftrag?.eventOrt">{{ e.auftrag.eventOrt }}</span>
                    <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" class="tme-link-icon" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button
            v-if="topMaAll.length > 3"
            class="top-ma-toggle"
            @click="topMaExpanded = !topMaExpanded"
          >
            <font-awesome-icon :icon="['fas', topMaExpanded ? 'chevron-up' : 'chevron-down']" />
            {{ topMaExpanded ? 'Weniger anzeigen' : `Alle ${topMaAll.length} anzeigen` }}
          </button>
        </div>
      </section>

      <!-- Kontakte -->
      <section v-if="activeTab === 'kontakte'" class="section contacts-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakte
          <span class="badge">{{ linkedContacts.length }}</span>
          <button
            v-if="inactiveContacts.length"
            class="btn-add-contact"
            @click="showInactiveContacts = !showInactiveContacts"
          >
            <font-awesome-icon :icon="['fas', showInactiveContacts ? 'eye-slash' : 'eye']" />
            {{ showInactiveContacts ? 'Inaktive ausblenden' : `Inaktive (${inactiveContacts.length})` }}
          </button>
          <button
            v-if="kunde.kuerzel"
            class="btn-add-contact"
            @click="showKontaktAnlegenModal = true"
            title="Neuen Microsoft-Kontakt anlegen"
          >
            <font-awesome-icon :icon="['fas', 'plus']" /> Anlegen
          </button>
        </h4>

        <div v-if="!kunde.kuerzel" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'tag']" class="empty-icon" />
          Kein Kürzel gesetzt — Kürzel im Header festlegen, um verknüpfte Kontakte anzuzeigen.
        </div>

        <div v-else-if="contactsLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Kontakte werden geladen…
        </div>

        <div v-else-if="visibleContacts.length === 0" class="empty-contacts">
          Keine Microsoft-Kontakte mit Kürzel „{{ kunde.kuerzel }}" gefunden.
        </div>

        <div v-if="!signaturKontaktId && linkedContacts.length > 0" class="sig-standard-hint">
          <font-awesome-icon :icon="['fas', 'circle-info']" />
          Noch kein Signatur-Standard gesetzt – wähle einen Kontakt als Standard für Signaturen.
        </div>

        <div v-if="visibleContacts.length > 0" class="contacts-list">
          <div
            v-for="contact in visibleContacts"
            :key="contact.id"
            class="contact-card"
            :class="{ 'contact-card--inactive': isMicrosoftContactInactive(contact) }"
            @click="openContactCard(contact)"
          >
            <div class="contact-header">
              <div class="contact-name">
                <div class="ms-logo-grid" aria-hidden="true">
                  <span style="background:#f25022"></span>
                  <span style="background:#7fba00"></span>
                  <span style="background:#00a4ef"></span>
                  <span style="background:#ffb900"></span>
                </div>
                {{ contact.displayName }}
              </div>
              <div class="contact-meta">
                <span v-if="contact.jobTitle" class="creator">{{ contact.jobTitle }}</span>
              </div>
              <button
                class="contact-menu-btn"
                title="Kontaktoptionen"
                @click.stop="openContactMenu(contact, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </button>
            </div>
            <div class="contact-details">
              <div v-if="contact.emailAddresses && contact.emailAddresses.length" class="detail-row">
                <font-awesome-icon :icon="['fas', 'envelope']" />
                <a :href="`mailto:${contact.emailAddresses[0].address}`" @click.stop>{{ contact.emailAddresses[0].address }}</a>
              </div>
              <div v-if="contact.businessPhones && contact.businessPhones.length" class="detail-row">
                <font-awesome-icon :icon="['fas', 'phone']" />
                <a :href="`tel:${contact.businessPhones[0]}`" @click.stop>{{ contact.businessPhones[0] }}</a>
              </div>
              <div v-else-if="contact.mobilePhone" class="detail-row">
                <font-awesome-icon :icon="['fas', 'mobile-screen']" />
                <a :href="`tel:${contact.mobilePhone}`" @click.stop>{{ contact.mobilePhone }}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Adressen -->
      <section v-if="activeTab === 'allgemein'" class="section addresses-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'location-dot']" /> Adressen
          <span class="badge">{{ kundenAdressen.length }}</span>
          <button class="btn-add-contact" type="button" @click="openCreateAdresse">
            <font-awesome-icon :icon="['fas', 'plus']" /> Adresse anlegen
          </button>
        </h4>
        <div v-if="kundenAdressen.length" class="addresses-list">
          <div v-for="(adr, index) in kundenAdressen" :key="adr.nummer || index" class="address-card">
            <div class="address-header">
              <div class="address-header-content">
                <span class="address-name">{{ formatAddressName(adr, 'Adresse ' + (index + 1)) }}</span>
                <div v-if="adr.isRechnAdr || adr.isPostAdr" class="address-tags">
                  <span v-if="adr.isRechnAdr" class="address-billing-badge">Rechnungsanschrift</span>
                  <span v-if="adr.isPostAdr" class="address-postal-badge">Postanschrift</span>
                </div>
              </div>
              <button
                class="address-menu-btn"
                title="Adressoptionen"
                @click.stop="openAdresseMenu(adr, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </button>
            </div>
            <div class="address-body">
              <div v-if="adr.strasse || adr.plz || adr.ort" class="address-row">
                <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
                <span>
                  <template v-if="adr.strasse">{{ adr.strasse }}<br /></template>
                  {{ [adr.plz, adr.ort].filter(Boolean).join(' ') }}<template v-if="adr.land">, {{ adr.land }}</template>
                </span>
                <CustomTooltip text="In Google Maps öffnen" position="top">
                  <a class="address-map-link" :href="getGoogleMapsUrl(adr)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop>
                    <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                  </a>
                </CustomTooltip>
              </div>
              <div v-for="telefon in adr.telefone" :key="telefon" class="address-row">
                <font-awesome-icon :icon="['fas', 'phone']" />
                <a :href="`tel:${telefon}`">{{ telefon }}</a>
              </div>
              <div v-if="adr.email" class="address-row">
                <font-awesome-icon :icon="['fas', 'envelope']" />
                <a :href="`mailto:${adr.email}`">{{ adr.email }}</a>
              </div>
              <div v-if="adr.homepage" class="address-row">
                <font-awesome-icon :icon="['fas', 'globe']" />
                <a :href="formatUrl(adr.homepage)" target="_blank" rel="noopener noreferrer">{{ adr.homepage }}</a>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-contacts">Keine Adressen vorhanden.</div>
      </section>

      <!-- Ansprechpartner aus Zvoove -->
      <section v-if="activeTab === 'kontakte' && ansprechpartner.length > 0" class="section addresses-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'user-tie']" /> Ansprechpartner
          <span class="badge">{{ ansprechpartner.length }}</span>
        </h4>
        <div class="addresses-list">
          <div v-for="(adr, index) in ansprechpartner" :key="adr.nummer || index" class="address-card">
            <div class="address-header">
              <div class="address-header-content">
                <span class="address-name">{{ formatAnsprechpartnerName(adr.name) || 'Ansprechpartner ' + (index + 1) }}</span>
                <div v-if="adr.branche" class="address-tags">
                  <span class="address-branche">{{ adr.branche }}</span>
                </div>
              </div>
              <button
                class="address-menu-btn"
                title="Ansprechpartneroptionen"
                @click.stop="openAdresseMenu(adr, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </button>
            </div>
            <div class="address-body">
              <div v-if="adr.strasse || adr.plz || adr.ort" class="address-row">
                <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
                <span>
                  <template v-if="adr.strasse">{{ adr.strasse }}<br /></template>
                  {{ [adr.plz, adr.ort].filter(Boolean).join(' ') }}<template v-if="adr.land">, {{ adr.land }}</template>
                </span>
                <CustomTooltip text="In Google Maps öffnen" position="top">
                  <a class="address-map-link" :href="getGoogleMapsUrl(adr)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop>
                    <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                  </a>
                </CustomTooltip>
              </div>
              <div v-for="telefon in adr.telefone" :key="telefon" class="address-row">
                <font-awesome-icon :icon="['fas', 'phone']" />
                <a :href="`tel:${telefon}`">{{ telefon }}</a>
              </div>
              <div v-if="adr.email" class="address-row">
                <font-awesome-icon :icon="['fas', 'envelope']" />
                <a :href="`mailto:${adr.email}`">{{ adr.email }}</a>
              </div>
              <div v-if="adr.homepage" class="address-row">
                <font-awesome-icon :icon="['fas', 'globe']" />
                <a :href="formatUrl(adr.homepage)" target="_blank" rel="noopener noreferrer">{{ adr.homepage }}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'allgemein'" class="section addresses-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'map-location-dot']" /> Einsatzorte
          <span class="badge">{{ visibleEinsatzorte.length }}</span>
          <div class="address-sort" aria-label="Einsatzortsortierung">
            <button type="button" :class="{ active: einsatzortSort === 'name' }" @click="einsatzortSort = 'name'">Name</button>
            <button type="button" :class="{ active: einsatzortSort === 'address' }" @click="einsatzortSort = 'address'">Adresse</button>
          </div>
          <FilterChip
            class="einsatzorte-inactive-toggle"
            :active="showInactiveEinsatzorte"
            :hide-mode="true"
            @click="showInactiveEinsatzorte = !showInactiveEinsatzorte"
          >
            <font-awesome-icon :icon="['fas', showInactiveEinsatzorte ? 'eye' : 'eye-slash']" />
            Inaktive{{ inactiveEinsatzorte.length ? ` (${inactiveEinsatzorte.length})` : '' }}
          </FilterChip>
          <button class="btn-add-contact" type="button" @click="openCreateEinsatzort">
            <font-awesome-icon :icon="['fas', 'plus']" /> Einsatzort anlegen
          </button>
        </h4>
        <div v-if="sortedEinsatzorte.length" class="addresses-list">
          <div v-for="einsatzort in sortedEinsatzorte" :key="einsatzort._id" class="address-card" :class="{ 'address-card--inactive': einsatzort.isActive === false }">
            <div class="address-header">
              <div class="address-header-content">
                <span class="address-name">{{ einsatzort.bezeichnung }}</span>
                <div class="address-tags">
                  <span v-if="einsatzort.isActive === false" class="address-postal-badge">Inaktiv</span>
                </div>
              </div>
              <button class="address-menu-btn" title="Einsatzortoptionen" @click.stop="openEinsatzortMenu(einsatzort, $event)">
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </button>
            </div>
            <div class="address-body">
              <div v-if="einsatzort.adresse?.strasse || einsatzort.adresse?.plz || einsatzort.adresse?.ort" class="address-row">
                <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
                <span><template v-if="einsatzort.adresse?.strasse">{{ einsatzort.adresse.strasse }}<br /></template>{{ [einsatzort.adresse?.plz, einsatzort.adresse?.ort].filter(Boolean).join(' ') }}<template v-if="einsatzort.adresse?.land">, {{ einsatzort.adresse.land }}</template></span>
                <CustomTooltip text="In Google Maps öffnen" position="top">
                  <a class="address-map-link" :href="getGoogleMapsUrl(einsatzort.adresse)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop>
                    <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                  </a>
                </CustomTooltip>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-contacts">Keine Einsatzorte vorhanden.</div>
      </section>

      <!-- Statistik -->
      <section v-if="activeTab === 'statistik' && kunde.kundenNr" class="section analytics-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'chart-bar']" /> Einsatz-Analytics
        </h4>
        <KundenAnalyticsEmbed :kundenNr="kunde.kundenNr" :geschSt="kunde.geschSt" @navigate="$emit('close')" />
      </section>

      <!-- Kennzahlen -->
      <section v-if="activeTab === 'statistik' && kunde.kundenNr && canSeeSensitiveKpi" class="section kpi-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'chart-line']" /> Kennzahlen
        </h4>

        <div v-if="kpiLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Kennzahlen werden geladen…
        </div>

        <div v-else-if="kpi" class="kpi-body">

          <!-- Top row: summary cards -->
          <div class="kpi-summary-row">
            <div class="kpi-card">
              <span class="kpi-value">{{ kpi.einsatz.avgPositionenPerAuftrag }}</span>
              <span class="kpi-label">Ø Positionen / Auftrag</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-value">{{ formatEuro(kpi.umsatz.total) }}</span>
              <span class="kpi-label">Gesamt-Umsatz (Netto)</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-value">{{ kpi.umsatz.shareGlobal }}%</span>
              <span class="kpi-label">Anteil Gesamtumsatz</span>
            </div>
            <div class="kpi-card" v-if="kpi.umsatz.shareStandort > 0">
              <span class="kpi-value">{{ kpi.umsatz.shareStandort }}%</span>
              <span class="kpi-label">Anteil Standortumsatz ({{ getGeschStText(kpi.umsatz.geschSt) }})</span>
            </div>
          </div>

          <!-- Yearly breakdown -->
          <div class="kpi-tables-row">

            <!-- Umsatz per year -->
            <div class="kpi-table-block" v-if="kpi.umsatz.perYear.length">
              <div class="kpi-table-title">Umsatz pro Jahr</div>
              <table class="kpi-table">
                <thead>
                  <tr><th>Jahr</th><th>Netto</th><th>Aktive Mo.</th></tr>
                </thead>
                <tbody>
                  <tr v-for="y in kpi.umsatz.perYear" :key="y.year">
                    <td>{{ y.year }}</td>
                    <td>{{ formatEuro(y.netto) }}</td>
                    <td class="muted-cell">{{ y.activeMonths }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Einsätze per year -->
            <div class="kpi-table-block">
              <div class="kpi-table-title">Einsätze & Positionen pro Jahr</div>
              <table class="kpi-table">
                <thead>
                  <tr><th>Jahr</th><th>Einsätze</th><th>Aufträge</th><th>Ø Pos./Auftrag</th></tr>
                </thead>
                <tbody>
                  <tr v-for="y in kpi.einsatz.perYear" :key="y.year">
                    <td>{{ y.year }}</td>
                    <td>{{ y.einsaetze }}</td>
                    <td class="muted-cell">{{ y.auftraege }}</td>
                    <td>{{ y.avgPositionenPerAuftrag }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Qualifikationen -->
          <div class="kpi-table-block" v-if="kpi.qualifikationen.length">
            <div class="kpi-table-title">Gebuchte Qualifikationen</div>
            <div class="qual-bars">
              <div v-for="q in kpi.qualifikationen.slice(0, 10)" :key="q.qualSchl" class="qual-bar-row">
                <span class="qual-name">{{ q.name }}</span>
                <div class="qual-bar-track">
                  <div class="qual-bar-fill" :style="{ width: q.share + '%' }"></div>
                </div>
                <span class="qual-pct">{{ q.share }}%</span>
                <span class="qual-count muted-cell">({{ q.count }})</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section v-if="activeTab === 'rechnung'" class="section addresses-section rechnung-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'file-invoice']" /> E-Rechnung
        </h4>

        <div class="kv-grid">
          <div class="kv-item">
            <span class="label">Sammelrechnung</span>
            <span class="value">{{ kunde.sammelrechnung ? 'Ja' : 'Nein' }}</span>
          </div>
          <div class="kv-item">
            <span class="label">L1-Rechnungsgruppe</span>
            <span class="value">{{ kunde.l1RechGruppe || '—' }}</span>
          </div>
        </div>

        <form class="erechnung-settings" @submit.prevent="saveERechnungSettings">
          <label>
            <span>Leitweg-ID</span>
            <input v-model.trim="eRechnungForm.leitwegId" type="text" autocomplete="off" placeholder="z. B. 991-..." />
          </label>
          <label>
            <span>Bevorzugtes Format</span>
            <select v-model="eRechnungForm.eRechnungFormat">
              <option value="">Nicht festgelegt</option>
              <option value="ZUGFERD">ZUGFeRD</option>
              <option value="XRECHNUNG">XRechnung</option>
            </select>
          </label>
          <label>
            <span>Mehrwertsteuer</span>
            <select v-model.number="eRechnungForm.mwst">
              <option :value="null">Nicht festgelegt</option>
              <option :value="0">MWST-frei</option>
              <option :value="1">MWST-pflichtig</option>
              <option :value="2">Steuerfreie EG-Umsätze</option>
              <option :value="3">MWST-frei gem. § 13b UStG</option>
            </select>
          </label>
          <button class="erechnung-save-btn" type="submit" :disabled="eRechnungSaving">
            <font-awesome-icon :icon="['fas', eRechnungSaving ? 'spinner' : 'floppy-disk']" :spin="eRechnungSaving" />
            Speichern
          </button>
          <p v-if="eRechnungError" class="erechnung-error">{{ eRechnungError }}</p>
        </form>

        <div v-if="rechnungsanschrift" class="addresses-list">
          <div class="address-card">
            <div class="address-header">
              <div class="address-header-content">
                <span class="address-name">{{ formatAddressName(rechnungsanschrift, 'Rechnungsanschrift') }}</span>
                <div class="address-tags">
                  <span class="address-billing-badge">Rechnungsanschrift</span>
                  <span v-if="rechnungsanschrift.isPostAdr" class="address-postal-badge">Postanschrift</span>
                </div>
              </div>
              <button
                class="address-menu-btn"
                title="Adressoptionen"
                @click.stop="openAdresseMenu(rechnungsanschrift, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </button>
            </div>
            <div class="address-body">
              <div v-if="rechnungsanschrift.strasse || rechnungsanschrift.plz || rechnungsanschrift.ort" class="address-row">
                <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
                <span>
                  <template v-if="rechnungsanschrift.strasse">{{ rechnungsanschrift.strasse }}<br /></template>
                  {{ [rechnungsanschrift.plz, rechnungsanschrift.ort].filter(Boolean).join(' ') }}<template v-if="rechnungsanschrift.land">, {{ rechnungsanschrift.land }}</template>
                </span>
                <CustomTooltip text="In Google Maps öffnen" position="top">
                  <a class="address-map-link" :href="getGoogleMapsUrl(rechnungsanschrift)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop>
                    <font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" />
                  </a>
                </CustomTooltip>
              </div>
              <div v-for="telefon in rechnungsanschrift.telefone" :key="telefon" class="address-row">
                <font-awesome-icon :icon="['fas', 'phone']" />
                <a :href="`tel:${telefon}`">{{ telefon }}</a>
              </div>
              <div v-if="rechnungsanschrift.email" class="address-row">
                <font-awesome-icon :icon="['fas', 'envelope']" />
                <a :href="`mailto:${rechnungsanschrift.email}`">{{ rechnungsanschrift.email }}</a>
              </div>
              <div v-if="rechnungsanschrift.homepage" class="address-row">
                <font-awesome-icon :icon="['fas', 'globe']" />
                <a :href="formatUrl(rechnungsanschrift.homepage)" target="_blank" rel="noopener noreferrer">{{ rechnungsanschrift.homepage }}</a>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-tab-state">
          <font-awesome-icon :icon="['fas', 'file-invoice']" />
          <p>Keine Rechnungsanschrift festgelegt.</p>
        </div>
      </section>

      <section v-if="activeTab === 'lohn'" class="section kundenpreise-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'percent']" /> Zuschlagskonditionen
        </h4>

        <div v-if="konditionenLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Konditionen werden geladen…
        </div>
        <div v-else-if="konditionenError" class="preise-message preise-message--error">
          {{ konditionenError }}
        </div>
        <div v-else-if="kundenkonditionen.length === 0" class="konditionen-empty">
          Keine Zuschlagskonditionen aus Zvoove hinterlegt.
        </div>
        <div v-else class="preise-table-wrap konditionen-table-wrap">
          <table class="preise-table konditionen-table">
            <thead>
              <tr>
                <th>Lohnart</th>
                <th>Regel</th>
                <th>Tage</th>
                <th>Zuschlag</th>
                <th>Verwendung</th>
                <th>Hinweise</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="kondition in kundenkonditionen" :key="kondition._id">
                <td>
                  <span class="preise-quali-name">{{ kondition.lohnart?.lohnartKurzzeichen || kondition.lohnartNummer }}</span>
                  <span class="preise-quali-key">{{ kondition.lohnart?.lohnartBezeichnung || kondition.lohnartNummer }}</span>
                </td>
                <td>{{ formatKonditionsRegel(kondition) }}</td>
                <td><span class="konditionen-days">{{ formatKonditionsTage(kondition.tage) }}</span></td>
                <td class="konditionen-zuschlag">{{ formatKonditionsZuschlag(kondition) }}</td>
                <td>{{ formatKonditionsVerwendung(kondition.verwendung) }}</td>
                <td>
                  <div class="konditionen-flags">
                    <span v-if="kondition.abStundenGrenze != null">ab {{ formatNumber(kondition.abStundenGrenze) }} Std.</span>
                    <span v-if="kondition.branchenzuschlagAddieren">Branchenzuschlag addieren</span>
                    <span v-if="kondition.nichtAutomatisch">Nicht automatisch</span>
                    <span v-if="kondition.berufsSchluessel">Beruf {{ kondition.berufsSchluessel }}</span>
                    <span v-if="kondition.jeEinheit">Je {{ kondition.jeEinheit === 'tag' ? 'Tag' : 'Woche' }}</span>
                    <span v-if="kondition.preisNr">Preisnr. {{ kondition.preisNr }}</span>
                    <span v-if="kondition.zvooveKonditionsId">FID {{ kondition.zvooveKonditionsId }}</span>
                    <span v-if="!hasKonditionsHinweis(kondition)" class="muted-cell">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'coins']" /> Kundenpreise
        </h4>

        <div v-if="preiseLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Preise werden geladen…
        </div>
        <div v-else-if="preiseError" class="preise-message preise-message--error">
          {{ preiseError }}
        </div>
        <div v-else-if="preisBerufe.length === 0" class="empty-tab-state">
          <font-awesome-icon :icon="['fas', 'coins']" />
          <p>Für diesen Kunden sind noch keine Qualifikationspreise hinterlegt.</p>
          <button class="preise-add-btn" type="button" @click="openAddQualifikationDialog">
            <font-awesome-icon :icon="['fas', 'plus']" /> Qualifikation Hinzufügen
          </button>
        </div>
        <template v-else>
          <div class="preise-selector">
            <span class="preise-selector-label">Beruf</span>
            <div class="preise-chip-row">
              <FilterChip
                v-for="beruf in preisBerufe"
                :key="beruf._id"
                :active="selectedPreisBerufId === beruf._id"
                @click="selectPreisBeruf(beruf._id)"
              >
                {{ beruf.designation }}
              </FilterChip>
            </div>
          </div>

          <div class="preise-add-btn-row">
            <button
              class="preise-add-btn"
              type="button"
              @click="openAddQualifikationDialog"
            >
              <font-awesome-icon :icon="['fas', 'plus']" /> Qualifikation Hinzufügen
            </button>
          </div>

          <div class="preise-table-wrap">
            <table class="preise-table">
              <thead>
                <tr>
                  <th>Qualifikation</th>
                  <th>Aktueller Preis</th>
                  <th>Gültig seit</th>
                  <th>Nächste Änderung</th>
                  <th><span class="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="entry in filteredPreisQualifikationen" :key="entry.qualifikation._id">
                  <tr>
                    <td>
                      <span class="preise-quali-name">{{ entry.qualifikation.designation }}</span>
                      <span class="preise-quali-key">{{ entry.qualifikation.qualificationKey }}</span>
                    </td>
                    <td class="preise-current">
                      {{ entry.current ? formatPriceCents(entry.current.hourlyRateCents) : '—' }}
                    </td>
                    <td>{{ entry.current ? formatDate(entry.current.validFrom) : '—' }}</td>
                    <td>
                      <span v-if="entry.next" class="preise-scheduled">
                        {{ formatPriceCents(entry.next.hourlyRateCents) }} ab {{ formatDate(entry.next.validFrom) }}
                      </span>
                      <span v-else class="muted-cell">—</span>
                    </td>
                    <td class="preise-actions-cell">
                      <button class="preise-new-btn" type="button" @click="openNewPrice(entry)">
                        <font-awesome-icon :icon="['fas', 'plus']" /> Neuer Preis
                      </button>
                    </td>
                  </tr>
                  <tr v-if="newPriceQualificationId === entry.qualifikation._id" class="preise-form-row">
                    <td colspan="5">
                      <form class="preise-new-form" @submit.prevent="saveNewPrice(entry)">
                        <label>
                          Preis pro Stunde
                          <div class="preise-input-unit">
                            <input v-model.trim="newPriceAmount" inputmode="decimal" placeholder="0,00" required />
                            <span>€</span>
                          </div>
                        </label>
                        <label>
                          Gültig ab
                          <input v-model="newPriceValidFrom" type="date" required />
                        </label>
                        <div class="preise-form-actions">
                          <button type="button" class="preise-cancel-btn" @click="closeNewPrice">Abbrechen</button>
                          <button type="submit" class="preise-save-btn" :disabled="preiseSaving">
                            <font-awesome-icon :icon="['fas', preiseSaving ? 'spinner' : 'check']" :spin="preiseSaving" />
                            Speichern
                          </button>
                        </div>
                        <p v-if="newPriceError" class="preise-form-error">{{ newPriceError }}</p>
                      </form>
                    </td>
                  </tr>
                  <tr v-if="entry.versions.length > 1" class="preise-history-row">
                    <td colspan="5">
                      <details>
                        <summary>{{ entry.versions.length }} Preisstände anzeigen</summary>
                        <div class="preise-history-list">
                          <span v-for="version in entry.versions" :key="version._id">
                            {{ formatPriceCents(version.hourlyRateCents) }} ab {{ formatDate(version.validFrom) }}
                          </span>
                        </div>
                      </details>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Add Qualification Dialog -->
        <div v-if="showAddQualifikationDialog" class="modal-overlay" @click.self="closeAddQualifikationDialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3>Neue Qualifikation hinzufügen</h3>
              <button class="close-btn" type="button" @click="closeAddQualifikationDialog">
                <font-awesome-icon :icon="['fas', 'xmark']" />
              </button>
            </div>
            <div class="modal-body">
              <form class="add-quali-form" @submit.prevent="saveNewQualifikation">
                <div class="search-select">
                  <label for="add-price-beruf">Beruf</label>
                  <input
                    id="add-price-beruf"
                    v-model="berufSearchQuery"
                    type="search"
                    autocomplete="off"
                    placeholder="Beruf oder Schlüssel suchen"
                    @focus="showBerufResults = true"
                    @input="showBerufResults = true"
                  />
                  <div v-if="showBerufResults" class="search-select-results">
                    <button
                      v-for="beruf in matchingBerufe"
                      :key="beruf._id"
                      type="button"
                      class="search-select-option"
                      @click="selectAddBeruf(beruf)"
                    >
                      <span>{{ beruf.designation }}</span><small>{{ beruf.jobKey }}</small>
                    </button>
                    <p v-if="matchingBerufe.length === 0" class="search-select-empty">Keine Berufe gefunden.</p>
                  </div>
                </div>
                <div class="search-select">
                  <label for="add-price-qualifikation">Qualifikation</label>
                  <input
                    id="add-price-qualifikation"
                    v-model="qualifikationSearchQuery"
                    type="search"
                    autocomplete="off"
                    :disabled="!addQualifikationBerufId"
                    placeholder="Qualifikation oder Schlüssel suchen"
                    @focus="showQualifikationResults = true"
                    @input="showQualifikationResults = true"
                  />
                  <div v-if="showQualifikationResults && addQualifikationBerufId" class="search-select-results">
                    <button
                      v-for="qualifikation in matchingQualifikationen"
                      :key="qualifikation._id"
                      type="button"
                      class="search-select-option"
                      @click="selectAddQualifikation(qualifikation)"
                    >
                      <span>{{ qualifikation.designation }}</span><small>{{ qualifikation.qualificationKey }}</small>
                    </button>
                    <p v-if="matchingQualifikationen.length === 0" class="search-select-empty">Keine verfügbaren Qualifikationen gefunden.</p>
                  </div>
                </div>
                <label>
                  Preis pro Stunde (€)
                  <div class="preise-input-unit">
                    <input v-model.trim="addPriceAmount" inputmode="decimal" placeholder="0,00" required />
                    <span>€</span>
                  </div>
                </label>
                <label>
                  Gültig ab
                  <input v-model="addPriceValidFrom" type="date" required />
                </label>
                <p v-if="addPriceError" class="preise-form-error">{{ addPriceError }}</p>
                <div class="preise-form-actions">
                  <button type="button" class="preise-cancel-btn" @click="closeAddQualifikationDialog">
                    Abbrechen
                  </button>
                  <button type="submit" class="preise-save-btn" :disabled="addPriceSaving">
                    <font-awesome-icon :icon="['fas', addPriceSaving ? 'spinner' : 'check']" :spin="addPriceSaving" />
                    Speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

    </div>

    <!-- Employee Card Modal -->
    <EmployeeCardModal
      :mitarbeiterId="selectedEmployeeId"
      @close="selectedEmployeeId = null"
    />

    <!-- Contact Card Modal -->
    <teleport to="body" :disabled="Boolean(dockedModal)">
      <div v-if="selectedContactCard" class="contact-card-overlay" @click.self="selectedContactCard = null">
        <ContactCard
          :contact="selectedContactCard"
          @close="selectedContactCard = null"
          @deleted="onContactCardDeleted"
          @updated="onContactCardUpdated"
        />
      </div>
    </teleport>

    <!-- Kontakt Anlegen Modal -->
    <KontaktAnlegenModal
      v-if="showKontaktAnlegenModal"
      :prefilledCompanyName="kunde.kuerzel || ''"
      @close="showKontaktAnlegenModal = false"
      @created="onKontaktAngelegt"
    />
    <AdresseFormModal
      v-if="showAdresseFormModal"
      :kunden-nr="kunde.kundenNr"
      :adresse="adresseFormAdresse"
      @close="closeAdresseForm"
      @saved="onAdresseSaved"
    />
    <EinsatzortFormModal
      v-if="showEinsatzortFormModal"
      :kunden-nr="kunde.kundenNr"
      :einsatzort="einsatzortFormEinsatzort"
      @close="closeEinsatzortForm"
      @saved="onEinsatzortSaved"
    />
    <ActionMenu
      :open="Boolean(adresseMenuAdresse)"
      :x="adresseMenuPosition.x"
      :y="adresseMenuPosition.y"
      :items="adresseMenuItems"
      :width="240"
      group-by="false"
      @close="closeAdresseMenu"
      @item-click="handleAdresseMenuAction"
    />
    <ActionMenu
      :open="Boolean(einsatzortMenuEinsatzort)"
      :x="einsatzortMenuPosition.x"
      :y="einsatzortMenuPosition.y"
      :items="einsatzortMenuItems"
      :width="220"
      group-by="false"
      @close="closeEinsatzortMenu"
      @item-click="handleEinsatzortMenuAction"
    />
    <ActionMenu
      :open="Boolean(contactMenuContact)"
      :x="contactMenuPosition.x"
      :y="contactMenuPosition.y"
      :items="contactMenuItems"
      :width="220"
      group-by="false"
      @close="closeContactMenu"
      @item-click="handleContactMenuAction"
    />
    </article>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import { useDataCache } from '@/stores/dataCache';
import ActionMenu from '@/components/ui-elements/ActionMenu.vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import KundenAnalyticsEmbed from '@/components/KundenAnalyticsEmbed.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import AdresseFormModal from '@/components/Modals/AdresseFormModal.vue';
import EinsatzortFormModal from '@/components/Modals/EinsatzortFormModal.vue';
import KontaktAnlegenModal from '@/components/Modals/KontaktAnlegenModal.vue';
import ContactCard from '@/components/ContactCard.vue';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import api from '@/utils/api';

const props = defineProps({
  kunde: { type: Object, required: true },
  initialTab: { type: String, default: 'allgemein' },
});

const emit = defineEmits(['close']);

const tabs = [
  { id: 'allgemein', label: 'Allgemein', icon: 'circle-info' },
  { id: 'rechnung', label: 'Rechnung', icon: 'file-invoice' },
  { id: 'kontakte', label: 'Kontakte', icon: 'address-book' },
  { id: 'einsaetze', label: 'Einsätze', icon: 'calendar-days' },
  { id: 'lohn', label: 'Lohn', icon: 'coins' },
  { id: 'statistik', label: 'Statistik', icon: 'chart-bar' },
];
const activeTab = ref(tabs.some((tab) => tab.id === props.initialTab) ? props.initialTab : 'allgemein');

watch(() => props.initialTab, (tab) => {
  if (tabs.some((item) => item.id === tab)) activeTab.value = tab;
});

const adressen = ref([]);
const adresseDeletingId = ref(null);
const adresseMenuAdresse = ref(null);
const adresseMenuPosition = ref({ x: 0, y: 0 });
const showAdresseFormModal = ref(false);
const adresseFormAdresse = ref(null);
const adresseMenuItems = computed(() => {
  const adresse = adresseMenuAdresse.value;
  const items = [{ value: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] }];
  if (adresse && adresse.art !== 'A') {
    items.push({
      value: 'billing',
      label: adresse.isRechnAdr ? 'Rechnungsanschrift entfernen' : 'Als Rechnungsanschrift festlegen',
      icon: ['fas', 'file-invoice'],
    });
    items.push({
      value: 'postal',
      label: adresse.isPostAdr ? 'Postanschrift entfernen' : 'Als Postanschrift festlegen',
      icon: ['fas', 'envelope'],
    });
  }
  items.push({ value: 'deactivate', label: 'Ausblenden', icon: ['fas', 'trash'], variant: 'danger' });
  return items;
});
const kundenAdressen = computed(() => adressen.value.filter((adresse) => adresse.art !== 'A'));
const ansprechpartner = computed(() => adressen.value.filter((adresse) => adresse.art === 'A'));
const rechnungsanschrift = computed(() => kundenAdressen.value.find((adresse) => adresse.isRechnAdr) || null);
const eRechnungForm = ref({
  leitwegId: props.kunde.leitwegId || '',
  eRechnungFormat: props.kunde.eRechnungFormat || '',
  mwst: props.kunde.mwst ?? null,
});
const eRechnungSaving = ref(false);
const eRechnungError = ref('');

watch(() => [props.kunde.leitwegId, props.kunde.eRechnungFormat, props.kunde.mwst], ([leitwegId, eRechnungFormat, mwst]) => {
  if (eRechnungSaving.value) return;
  eRechnungForm.value = { leitwegId: leitwegId || '', eRechnungFormat: eRechnungFormat || '', mwst: mwst ?? null };
});

async function saveERechnungSettings() {
  eRechnungSaving.value = true;
  eRechnungError.value = '';
  const update = {
    leitwegId: eRechnungForm.value.leitwegId || null,
    eRechnungFormat: eRechnungForm.value.eRechnungFormat || null,
    mwst: eRechnungForm.value.mwst ?? null,
  };
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, update);
    Object.assign(props.kunde, update);
    const cached = dataCache.kunden?.find((kunde) => kunde._id === props.kunde._id);
    if (cached) Object.assign(cached, update);
  } catch (error) {
    eRechnungError.value = error.response?.data?.message || 'Die E-Rechnungseinstellungen konnten nicht gespeichert werden.';
  } finally {
    eRechnungSaving.value = false;
  }
}

const remarks = computed(() => (Array.isArray(props.kunde.bemerkung) ? props.kunde.bemerkung.filter(Boolean) : []));
const editingRemarkIndex = ref(null);
const remarkDraft = ref(null);
const remarksSaving = ref(false);
const remarkInputRef = ref(null);

function startAddRemark() {
  editingRemarkIndex.value = null;
  remarkDraft.value = '';
  nextTick(() => remarkInputRef.value?.focus());
}

function startEditRemark(index) {
  editingRemarkIndex.value = index;
  remarkDraft.value = remarks.value[index];
  nextTick(() => remarkInputRef.value?.focus());
}

function cancelRemarkEdit() {
  editingRemarkIndex.value = null;
  remarkDraft.value = null;
}

async function persistRemarks(nextRemarks) {
  const bemerkung = nextRemarks.map((remark) => String(remark || '').trim()).filter(Boolean);
  remarksSaving.value = true;
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, { bemerkung });
    props.kunde.bemerkung = bemerkung;
    const cached = dataCache.kunden?.find((kunde) => kunde._id === props.kunde._id);
    if (cached) cached.bemerkung = bemerkung;
  } catch (error) {
    console.error('Fehler beim Speichern der Bemerkungen:', error);
    alert(error.response?.data?.message || 'Die Bemerkungen konnten nicht gespeichert werden.');
    throw error;
  } finally {
    remarksSaving.value = false;
  }
}

async function saveRemark() {
  const text = String(remarkDraft.value || '').trim();
  if (!text) return;
  const nextRemarks = [...remarks.value];
  if (editingRemarkIndex.value === null) nextRemarks.push(text);
  else nextRemarks[editingRemarkIndex.value] = text;

  try {
    await persistRemarks(nextRemarks);
    cancelRemarkEdit();
  } catch {}
}

async function deleteRemark(index) {
  if (!confirm('Bemerkung wirklich löschen?')) return;
  try {
    await persistRemarks(remarks.value.filter((_, remarkIndex) => remarkIndex !== index));
  } catch {}
}

const einsatzorte = ref([]);
const einsatzortSort = ref('name');
const showInactiveEinsatzorte = ref(false);
const einsatzortMenuEinsatzort = ref(null);
const einsatzortMenuPosition = ref({ x: 0, y: 0 });
const showEinsatzortFormModal = ref(false);
const einsatzortFormEinsatzort = ref(null);
const inactiveEinsatzorte = computed(() => einsatzorte.value.filter((einsatzort) => einsatzort.isActive === false));
const visibleEinsatzorte = computed(() => einsatzorte.value.filter((einsatzort) =>
  showInactiveEinsatzorte.value ? einsatzort.isActive === false : einsatzort.isActive !== false
));
const sortedEinsatzorte = computed(() => [...visibleEinsatzorte.value].sort((first, second) => {
  const name = (einsatzort) => String(einsatzort.bezeichnung || '').toLocaleLowerCase('de');
  const address = (einsatzort) => [einsatzort.adresse?.plz, einsatzort.adresse?.ort, einsatzort.adresse?.strasse]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('de');
  const firstValue = einsatzortSort.value === 'address' ? address(first) : name(first);
  const secondValue = einsatzortSort.value === 'address' ? address(second) : name(second);
  return firstValue.localeCompare(secondValue, 'de');
}));
const einsatzortMenuItems = computed(() => {
  const einsatzort = einsatzortMenuEinsatzort.value;
  return [
    { value: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] },
    { value: 'status', label: einsatzort?.isActive !== false ? 'Deaktivieren' : 'Aktivieren', icon: ['fas', einsatzort?.isActive !== false ? 'eye-slash' : 'eye'] },
    { value: 'delete', label: 'Löschen', icon: ['fas', 'trash'], variant: 'danger' },
  ];
});

async function loadAdressen() {
  if (!props.kunde.kundenNr) {
    adressen.value = [];
    return;
  }

  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/adressen`);
    adressen.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Fehler beim Laden der Kundenadressen:', error);
    adressen.value = [];
  }

}

onMounted(loadAdressen);
watch(() => props.kunde.kundenNr, loadAdressen);

async function loadEinsatzorte() {
  if (!props.kunde.kundenNr) {
    einsatzorte.value = [];
    return;
  }
  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/einsatzorte`);
    einsatzorte.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Fehler beim Laden der Einsatzorte:', error);
    einsatzorte.value = [];
  }
}

onMounted(() => {
  loadEinsatzorte();
});
watch(() => props.kunde.kundenNr, loadEinsatzorte);

function openEinsatzortMenu(einsatzort, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  einsatzortMenuEinsatzort.value = einsatzort;
  einsatzortMenuPosition.value = { x: rect.right - 190, y: rect.bottom + 4 };
}

function closeEinsatzortMenu() {
  einsatzortMenuEinsatzort.value = null;
}

function openCreateEinsatzort() {
  einsatzortFormEinsatzort.value = null;
  showEinsatzortFormModal.value = true;
}

function closeEinsatzortForm() {
  showEinsatzortFormModal.value = false;
  einsatzortFormEinsatzort.value = null;
}

function onEinsatzortSaved(einsatzort) {
  const index = einsatzorte.value.findIndex((entry) => entry._id === einsatzort._id);
  if (index === -1) einsatzorte.value = [...einsatzorte.value, einsatzort];
  else einsatzorte.value[index] = einsatzort;
  closeEinsatzortForm();
}

async function handleEinsatzortMenuAction({ item }) {
  const einsatzort = einsatzortMenuEinsatzort.value;
  closeEinsatzortMenu();
  if (!einsatzort) return;
  if (item.value === 'edit') {
    einsatzortFormEinsatzort.value = { ...einsatzort };
    showEinsatzortFormModal.value = true;
    return;
  }
  if (item.value === 'status') {
    try {
      const { data } = await api.patch(`/api/kunden/${props.kunde.kundenNr}/einsatzorte/${einsatzort._id}/status`, { isActive: einsatzort.isActive === false });
      const index = einsatzorte.value.findIndex((entry) => entry._id === einsatzort._id);
      if (index !== -1) einsatzorte.value[index] = data.einsatzort;
    } catch (error) {
      alert(error.response?.data?.message || 'Der Einsatzortstatus konnte nicht gespeichert werden.');
    }
    return;
  }
  if (item.value === 'delete' && confirm(`„${einsatzort.bezeichnung}“ wirklich löschen?`)) {
    try {
      await api.delete(`/api/kunden/${props.kunde.kundenNr}/einsatzorte/${einsatzort._id}`);
      einsatzorte.value = einsatzorte.value.filter((entry) => entry._id !== einsatzort._id);
    } catch (error) {
      alert(error.response?.data?.message || 'Der Einsatzort konnte nicht gelöscht werden.');
    }
  }
}

function openAdresseMenu(adresse, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  adresseMenuAdresse.value = adresse;
  adresseMenuPosition.value = { x: rect.right - 190, y: rect.bottom + 4 };
}

function closeAdresseMenu() {
  adresseMenuAdresse.value = null;
}

function handleAdresseMenuAction({ item }) {
  const adresse = adresseMenuAdresse.value;
  closeAdresseMenu();
  if (item.value === 'edit' && adresse) openEditAdresse(adresse);
  if (item.value === 'billing' && adresse) toggleRechnungsanschrift(adresse);
  if (item.value === 'postal' && adresse) togglePostanschrift(adresse);
  if (item.value === 'deactivate' && adresse) deactivateAdresse(adresse);
}

function openCreateAdresse() {
  adresseFormAdresse.value = null;
  showAdresseFormModal.value = true;
}

function openEditAdresse(adresse) {
  adresseFormAdresse.value = { ...adresse };
  showAdresseFormModal.value = true;
}

function closeAdresseForm() {
  showAdresseFormModal.value = false;
  adresseFormAdresse.value = null;
}

function onAdresseSaved(adresse) {
  const index = adressen.value.findIndex((entry) => entry.nummer === adresse.nummer);
  if (index === -1) adressen.value = [...adressen.value, adresse];
  else adressen.value[index] = adresse;
  closeAdresseForm();
  closeEinsatzortForm();
}

async function toggleRechnungsanschrift(adresse) {
  const nummer = String(adresse.nummer || '').trim();
  if (!nummer) return;

  const isRechnAdr = !adresse.isRechnAdr;
  try {
    const { data } = await api.patch(
      `/api/kunden/${props.kunde.kundenNr}/adressen/${encodeURIComponent(nummer)}/rechnungsanschrift`,
      { isRechnAdr },
    );
    adressen.value = adressen.value.map((entry) => ({
      ...entry,
      isRechnAdr: isRechnAdr
        ? entry.nummer === adresse.nummer
        : entry.nummer === adresse.nummer ? false : entry.isRechnAdr,
    }));
    if (data?.adresse) {
      const index = adressen.value.findIndex((entry) => entry.nummer === data.adresse.nummer);
      if (index !== -1) adressen.value[index] = data.adresse;
    }
  } catch (error) {
    console.error('Fehler beim Festlegen der Rechnungsanschrift:', error);
    alert(error.response?.data?.message || 'Die Rechnungsanschrift konnte nicht gespeichert werden.');
  }
}

async function togglePostanschrift(adresse) {
  const nummer = String(adresse.nummer || '').trim();
  if (!nummer) return;

  const isPostAdr = !adresse.isPostAdr;
  try {
    const { data } = await api.patch(
      `/api/kunden/${props.kunde.kundenNr}/adressen/${encodeURIComponent(nummer)}/postanschrift`,
      { isPostAdr },
    );
    adressen.value = adressen.value.map((entry) => ({
      ...entry,
      isPostAdr: isPostAdr
        ? entry.nummer === adresse.nummer
        : entry.nummer === adresse.nummer ? false : entry.isPostAdr,
    }));
    if (data?.adresse) {
      const index = adressen.value.findIndex((entry) => entry.nummer === data.adresse.nummer);
      if (index !== -1) adressen.value[index] = data.adresse;
    }
  } catch (error) {
    console.error('Fehler beim Festlegen der Postanschrift:', error);
    alert(error.response?.data?.message || 'Die Postanschrift konnte nicht gespeichert werden.');
  }
}

async function deactivateAdresse(adresse) {
  const nummer = String(adresse.nummer || '').trim();
  if (!nummer || !confirm(`„${adresse.name || 'Diese Adresse'}“ wirklich ausblenden?`)) return;

  adresseDeletingId.value = nummer;
  try {
    await api.delete(`/api/kunden/${props.kunde.kundenNr}/adressen/${encodeURIComponent(nummer)}`);
    adressen.value = adressen.value.filter((entry) => entry.nummer !== adresse.nummer);
  } catch (error) {
    console.error('Fehler beim Ausblenden der Kundenadresse:', error);
    alert(error.response?.data?.message || 'Die Adresse konnte nicht ausgeblendet werden.');
  } finally {
    adresseDeletingId.value = null;
  }
}
// ── Kundenpreise ─────────────────────────────────────────────────────────────
const kundenpreise = ref([]);
const kundenkonditionen = ref([]);
const konditionenLoading = ref(false);
const konditionenLoaded = ref(false);
const konditionenError = ref('');
const preiseLoading = ref(false);
const preiseLoaded = ref(false);
const preiseError = ref('');
const preiseSaving = ref(false);
const selectedPreisBerufId = ref('');
const newPriceQualificationId = ref('');
const newPriceAmount = ref('');
const newPriceValidFrom = ref('');
const newPriceError = ref('');

// Add Qualifikation Dialog
const showAddQualifikationDialog = ref(false);
const addQualifikationBerufId = ref('');
const addQualifikationId = ref('');
const berufSearchQuery = ref('');
const qualifikationSearchQuery = ref('');
const showBerufResults = ref(false);
const showQualifikationResults = ref(false);
const addPriceAmount = ref('');
const addPriceValidFrom = ref('');
const addPriceError = ref('');
const addPriceSaving = ref(false);

const preisBerufe = computed(() => {
  const berufe = new Map();
  for (const price of kundenpreise.value) {
    const beruf = price.qualifikation?.beruf;
    if (beruf?._id) berufe.set(String(beruf._id), { ...beruf, _id: String(beruf._id) });
  }
  return [...berufe.values()].sort((first, second) =>
    first.designation.localeCompare(second.designation, 'de')
  );
});

const filteredPreisQualifikationen = computed(() => {
  const grouped = new Map();
  for (const price of kundenpreise.value) {
    const qualifikation = price.qualifikation;
    if (!qualifikation?._id || String(qualifikation.beruf?._id) !== selectedPreisBerufId.value) continue;
    const id = String(qualifikation._id);
    if (!grouped.has(id)) grouped.set(id, { qualifikation, versions: [] });
    grouped.get(id).versions.push(price);
  }

  const now = Date.now();
  return [...grouped.values()]
    .map((entry) => {
      entry.versions.sort((first, second) => new Date(second.validFrom) - new Date(first.validFrom));
      const reached = entry.versions.filter((version) => new Date(version.validFrom).getTime() <= now);
      const future = entry.versions
        .filter((version) => new Date(version.validFrom).getTime() > now)
        .sort((first, second) => new Date(first.validFrom) - new Date(second.validFrom));
      return { ...entry, current: reached[0] || null, next: future[0] || null };
    })
    .sort((first, second) => first.qualifikation.qualificationKey - second.qualifikation.qualificationKey);
});

const availableQualifikationen = computed(() => {
  if (!dataCache.qualifikationen || dataCache.qualifikationen.length === 0) return [];
  const assignedIds = new Set(kundenpreise.value.map((p) => String(p.qualifikation._id)));
  return dataCache.qualifikationen
    .filter((q) => !assignedIds.has(String(q._id)) && String(q.beruf?._id) === selectedPreisBerufId.value)
    .sort((first, second) => first.qualificationKey - second.qualificationKey);
});

const allBerufeForDialog = computed(() => {
  return [...dataCache.berufe].sort((a, b) => a.jobKey - b.jobKey);
});

const availableQualifikationenForDialog = computed(() => {
  if (!dataCache.qualifikationen || dataCache.qualifikationen.length === 0 || !addQualifikationBerufId.value) return [];
  const assignedIds = new Set(kundenpreise.value.map((p) => String(p.qualifikation._id)));
  return dataCache.qualifikationen
    .filter((q) => !assignedIds.has(String(q._id)) && String(q.beruf?._id) === addQualifikationBerufId.value)
    .sort((first, second) => first.qualificationKey - second.qualificationKey);
});

const matchingBerufe = computed(() => {
  const query = berufSearchQuery.value.trim().toLocaleLowerCase('de');
  if (!query) return allBerufeForDialog.value;
  return allBerufeForDialog.value.filter((beruf) =>
    `${beruf.jobKey} ${beruf.designation}`.toLocaleLowerCase('de').includes(query)
  );
});

const matchingQualifikationen = computed(() => {
  const query = qualifikationSearchQuery.value.trim().toLocaleLowerCase('de');
  if (!query) return availableQualifikationenForDialog.value;
  return availableQualifikationenForDialog.value.filter((qualifikation) =>
    `${qualifikation.qualificationKey} ${qualifikation.designation}`.toLocaleLowerCase('de').includes(query)
  );
});

async function loadKundenpreise(force = false) {
  if (!props.kunde.kundenNr || (preiseLoaded.value && !force)) return;
  preiseLoading.value = true;
  preiseError.value = '';
  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/preise`);
    kundenpreise.value = data || [];
    preiseLoaded.value = true;
    if (!preisBerufe.value.some((beruf) => beruf._id === selectedPreisBerufId.value)) {
      selectedPreisBerufId.value = preisBerufe.value[0]?._id || '';
    }
  } catch (error) {
    preiseError.value = error.response?.data?.message || 'Kundenpreise konnten nicht geladen werden.';
  } finally {
    preiseLoading.value = false;
  }
}

async function loadKundenkonditionen(force = false) {
  if (!props.kunde.kundenNr || (konditionenLoaded.value && !force)) return;
  konditionenLoading.value = true;
  konditionenError.value = '';
  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/konditionen`);
    kundenkonditionen.value = Array.isArray(data) ? data : [];
    konditionenLoaded.value = true;
  } catch (error) {
    konditionenError.value = error.response?.data?.message || 'Kundenkonditionen konnten nicht geladen werden.';
  } finally {
    konditionenLoading.value = false;
  }
}

function formatKonditionsRegel(kondition) {
  const range = [kondition.abWert, kondition.bisWert].filter((value) => value != null && value !== '').join(' – ');
  const type = kondition.regelArt === 'uhrzeit' ? 'Uhrzeit' : kondition.regelArt === 'stunden' ? 'Stunden' : '';
  return [type, range].filter(Boolean).join(': ') || '—';
}

function formatKonditionsTage(tage = {}) {
  const labels = [
    ['montag', 'Mo'], ['dienstag', 'Di'], ['mittwoch', 'Mi'], ['donnerstag', 'Do'],
    ['freitag', 'Fr'], ['samstag', 'Sa'], ['sonntag', 'So'], ['feiertag', 'Feiertag'],
  ];
  const active = labels.filter(([key]) => tage[key]).map(([, label]) => label);
  return active.length === 7 && !tage.feiertag ? 'Mo–So' : active.join(', ') || '—';
}

function formatKonditionsZuschlag(kondition) {
  if (Number(kondition.zuschlagsProzent)) return `${formatNumber(kondition.zuschlagsProzent)} %`;
  if (kondition.preisBetrag != null) return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(kondition.preisBetrag);
  return '—';
}

function formatKonditionsVerwendung(value) {
  if (value === 'F') return 'Faktur';
  if (value === 'L') return 'Lohn';
  return value || '—';
}

function hasKonditionsHinweis(kondition) {
  return kondition.abStundenGrenze != null || kondition.branchenzuschlagAddieren
    || kondition.nichtAutomatisch || kondition.berufsSchluessel || kondition.jeEinheit
    || kondition.preisNr || kondition.zvooveKonditionsId;
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(value);
}

function selectPreisBeruf(berufId) {
  selectedPreisBerufId.value = berufId;
  closeNewPrice();
}

function openNewPrice(entry) {
  newPriceQualificationId.value = String(entry.qualifikation._id);
  newPriceAmount.value = entry.next?.hourlyRateCents != null
    ? (entry.next.hourlyRateCents / 100).toFixed(2).replace('.', ',')
    : entry.current?.hourlyRateCents != null
      ? (entry.current.hourlyRateCents / 100).toFixed(2).replace('.', ',')
      : '';
  newPriceValidFrom.value = new Date().toISOString().slice(0, 10);
  newPriceError.value = '';
}

function closeNewPrice() {
  newPriceQualificationId.value = '';
  newPriceAmount.value = '';
  newPriceValidFrom.value = '';
  newPriceError.value = '';
}

async function saveNewPrice(entry) {
  const normalizedAmount = newPriceAmount.value.replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount < 0 || !newPriceValidFrom.value) {
    newPriceError.value = 'Bitte einen gültigen Preis und ein Datum angeben.';
    return;
  }

  preiseSaving.value = true;
  newPriceError.value = '';
  try {
    await api.post(`/api/kunden/${props.kunde.kundenNr}/preise`, {
      qualifikation: entry.qualifikation._id,
      hourlyRateCents: Math.round(amount * 100),
      validFrom: newPriceValidFrom.value,
    });
    closeNewPrice();
    await loadKundenpreise(true);
  } catch (error) {
    newPriceError.value = error.response?.data?.message || 'Der neue Preis konnte nicht gespeichert werden.';
  } finally {
    preiseSaving.value = false;
  }
}

function formatPriceCents(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value / 100);
}

async function openAddQualifikationDialog() {
  showAddQualifikationDialog.value = true;
  addPriceError.value = '';
  try {
    await Promise.all([dataCache.loadBerufe(), dataCache.loadQualifikationen()]);
  } catch (error) {
    addPriceError.value = 'Berufe und Qualifikationen konnten nicht geladen werden.';
    return;
  }
  addQualifikationBerufId.value = '';
  addQualifikationId.value = '';
  berufSearchQuery.value = '';
  qualifikationSearchQuery.value = '';
  showBerufResults.value = true;
  showQualifikationResults.value = false;
  addPriceAmount.value = '';
  addPriceValidFrom.value = new Date().toISOString().slice(0, 10);
}

function closeAddQualifikationDialog() {
  showAddQualifikationDialog.value = false;
  addQualifikationBerufId.value = '';
  addQualifikationId.value = '';
  berufSearchQuery.value = '';
  qualifikationSearchQuery.value = '';
  showBerufResults.value = false;
  showQualifikationResults.value = false;
  addPriceAmount.value = '';
  addPriceValidFrom.value = '';
  addPriceError.value = '';
}

function selectAddBeruf(beruf) {
  addQualifikationBerufId.value = String(beruf._id);
  berufSearchQuery.value = `${beruf.jobKey} - ${beruf.designation}`;
  addQualifikationId.value = '';
  qualifikationSearchQuery.value = '';
  showBerufResults.value = false;
  showQualifikationResults.value = true;
}

function selectAddQualifikation(qualifikation) {
  addQualifikationId.value = String(qualifikation._id);
  qualifikationSearchQuery.value = `${qualifikation.qualificationKey} - ${qualifikation.designation}`;
  showQualifikationResults.value = false;
}

async function saveNewQualifikation() {
  if (!addQualifikationId.value) {
    addPriceError.value = 'Bitte eine Qualifikation wählen.';
    return;
  }
  const normalizedAmount = addPriceAmount.value.replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalizedAmount);
  if (!Number.isFinite(amount) || amount < 0 || !addPriceValidFrom.value) {
    addPriceError.value = 'Bitte einen gültigen Preis und ein Datum angeben.';
    return;
  }

  addPriceSaving.value = true;
  addPriceError.value = '';
  try {
    await api.post(`/api/kunden/${props.kunde.kundenNr}/preise`, {
      qualifikation: addQualifikationId.value,
      hourlyRateCents: Math.round(amount * 100),
      validFrom: addPriceValidFrom.value,
    });
    closeAddQualifikationDialog();
    await loadKundenpreise(true);
  } catch (error) {
    addPriceError.value = error.response?.data?.message || 'Die Qualifikation konnte nicht hinzugefügt werden.';
  } finally {
    addPriceSaving.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'lohn') {
    loadKundenpreise();
    loadKundenkonditionen();
  }
});

const auth = useAuth();
const dataCache = useDataCache();
const router = useRouter();
const dockedModal = useCurrentDockedModal();
const isMinimized = dockedModal?.minimized ?? computed(() => false);
const isTopmost = dockedModal?.topmost ?? computed(() => true);

// ── Employee Modal ────────────────────────────────────────────────────────────
const selectedEmployeeId = ref(null);
function openEmployeeCard(id) {
  selectedEmployeeId.value = String(id);
}

// ── MA Einsatz Expand ─────────────────────────────────────────────────────────
const expandedMaIds = ref(new Set());
const maEinsaetzeMap = ref({});

async function toggleMaExpand(ma) {
  const id = String(ma._id);
  if (expandedMaIds.value.has(id)) {
    const next = new Set(expandedMaIds.value);
    next.delete(id);
    expandedMaIds.value = next;
    return;
  }
  expandedMaIds.value = new Set([...expandedMaIds.value, id]);
  if (maEinsaetzeMap.value[id]) return;
  maEinsaetzeMap.value = { ...maEinsaetzeMap.value, [id]: { loading: true, data: [] } };
  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/top-mitarbeiter/${id}/einsaetze`);
    maEinsaetzeMap.value = { ...maEinsaetzeMap.value, [id]: { loading: false, data } };
  } catch {
    maEinsaetzeMap.value = { ...maEinsaetzeMap.value, [id]: { loading: false, data: [] } };
  }
}

function openAuftrag(einsatz) {
  const focusDate = einsatz.datumVon
    ? new Date(einsatz.datumVon).toISOString().slice(0, 10)
    : undefined;
  const query = { auftragnr: String(einsatz.auftragNr) };
  if (focusDate) query.focusDate = focusDate;
  router.push({ path: '/auftraege', query });
  emit('close');
}

function formatEinsatzDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const canSeeSensitiveKpi = computed(() => {
  const primaryRole = String(auth.user?.role || '').toUpperCase();
  const roles = Array.isArray(auth.user?.roles)
    ? auth.user.roles.map((role) => String(role).toUpperCase())
    : [];

  return primaryRole === 'ADMIN'
    || primaryRole === 'VERTRIEB'
    || roles.includes('ADMIN')
    || roles.includes('VERTRIEB');
});

// MS Graph contacts linked via kuerzel
const msContacts = ref([]);
const contactsLoading = ref(false);
const showInactiveContacts = ref(false);

async function loadContacts() {
  if (!props.kunde.kuerzel) return;
  contactsLoading.value = true;
  try {
    const { data } = await api.get('/api/graph/contacts');
    msContacts.value = data.contacts || [];
  } catch (e) {
    msContacts.value = [];
  } finally {
    contactsLoading.value = false;
  }
}

const linkedContacts = computed(() => {
  const kuerzel = (props.kunde.kuerzel || '').trim().toLowerCase();
  if (!kuerzel) return [];
  return msContacts.value.filter(
    c => (c.companyName || '').trim().toLowerCase() === kuerzel
  );
});

const inactiveMicrosoftContactIds = computed(() => new Set(
  (props.kunde.inactiveMicrosoftContactIds || []).map((id) => String(id))
));
const inactiveContacts = computed(() => linkedContacts.value.filter(isMicrosoftContactInactive));
const visibleContacts = computed(() => linkedContacts.value.filter((contact) =>
  showInactiveContacts.value || !isMicrosoftContactInactive(contact)
));

function isMicrosoftContactInactive(contact) {
  return Boolean(contact?.id) && inactiveMicrosoftContactIds.value.has(String(contact.id));
}

onMounted(loadContacts);
watch(() => props.kunde.kuerzel, loadContacts);

// Standard-Signatur-Kontakt
const signaturKontaktId     = ref(props.kunde.signaturKontaktId || '');
const signaturKontaktSaving = ref(false);
const contactMenuContact = ref(null);
const contactMenuPosition = ref({ x: 0, y: 0 });
const contactMenuItems = computed(() => {
  const contact = contactMenuContact.value;
  const isSignatureStandard = contact?.id === signaturKontaktId.value;
  return [
    { value: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] },
    {
      value: 'signature',
      label: isSignatureStandard ? 'Signatur-Standard entfernen' : 'Als Signatur-Standard setzen',
      icon: ['fas', isSignatureStandard ? 'xmark' : 'file-signature'],
      disabled: signaturKontaktSaving.value,
    },
    {
      value: 'inactive',
      label: isMicrosoftContactInactive(contact) ? 'Wieder anzeigen' : 'Ausblenden',
      icon: ['fas', isMicrosoftContactInactive(contact) ? 'eye' : 'eye-slash'],
      variant: isMicrosoftContactInactive(contact) ? 'primary' : 'danger',
    },
  ];
});

watch(() => props.kunde.signaturKontaktId, (val) => {
  signaturKontaktId.value = val || '';
});

function openContactMenu(contact, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  contactMenuContact.value = contact;
  contactMenuPosition.value = { x: rect.right - 220, y: rect.bottom + 4 };
}

function closeContactMenu() {
  contactMenuContact.value = null;
}

function handleContactMenuAction({ item }) {
  const contact = contactMenuContact.value;
  closeContactMenu();
  if (!contact) return;
  if (item.value === 'edit') openContactCard(contact);
  if (item.value === 'signature') toggleSignaturKontakt(contact);
  if (item.value === 'inactive') toggleMicrosoftContactInactive(contact);
}

async function toggleMicrosoftContactInactive(contact) {
  const contactId = String(contact.id || '').trim();
  if (!contactId) return;

  const wasInactive = isMicrosoftContactInactive(contact);
  if (!wasInactive && !confirm(`„${contact.displayName || 'Dieser Kontakt'}“ wirklich ausblenden?`)) return;

  const nextIds = new Set(inactiveMicrosoftContactIds.value);
  if (wasInactive) nextIds.delete(contactId);
  else nextIds.add(contactId);

  const update = { inactiveMicrosoftContactIds: [...nextIds] };
  if (!wasInactive && contactId === signaturKontaktId.value) {
    update.signaturKontaktId = null;
    update.signaturKontaktEmail = null;
  }

  try {
    await api.put(`/api/kunden/${props.kunde._id}`, update);
    props.kunde.inactiveMicrosoftContactIds = update.inactiveMicrosoftContactIds;
    if (update.signaturKontaktId === null) {
      signaturKontaktId.value = '';
      props.kunde.signaturKontaktId = null;
      props.kunde.signaturKontaktEmail = null;
    }
    const cached = dataCache.kunden?.find((kunde) => kunde._id === props.kunde._id);
    if (cached) Object.assign(cached, update);
  } catch (error) {
    console.error('Fehler beim Ausblenden des Microsoft-Kontakts:', error);
    alert(error.response?.data?.message || 'Der Kontaktstatus konnte nicht gespeichert werden.');
  }
}

async function toggleSignaturKontakt(contact) {
  // clicking the active contact deselects it; otherwise select the new one
  const newId    = signaturKontaktId.value === contact.id ? '' : contact.id;
  const newEmail = newId ? (contact.emailAddresses?.[0]?.address || null) : null;
  signaturKontaktId.value     = newId;
  signaturKontaktSaving.value = true;
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, {
      signaturKontaktId:    newId || null,
      signaturKontaktEmail: newEmail,
    });
    props.kunde.signaturKontaktId    = newId || null;
    props.kunde.signaturKontaktEmail = newEmail;
    const cached = dataCache.kunden?.find(k => k._id === props.kunde._id);
    if (cached) {
      cached.signaturKontaktId    = newId || null;
      cached.signaturKontaktEmail = newEmail;
    }
  } catch (e) {
    // revert on error
    signaturKontaktId.value = props.kunde.signaturKontaktId || '';
    console.error('Fehler beim Speichern des Signatur-Kontakts', e);
  } finally {
    signaturKontaktSaving.value = false;
  }
}

// Kennzahlen (KPIs)
const kpi = ref(null);
const kpiLoading = ref(false);

async function loadKpi() {
  if (!props.kunde.kundenNr || !canSeeSensitiveKpi.value) return;
  kpiLoading.value = true;
  try {
    const params = { kundenNr: props.kunde.kundenNr };
    if (props.kunde.geschSt) params.geschSt = props.kunde.geschSt;
    const { data } = await api.get('/api/kunden/analytics/kennzahlen', { params });
    kpi.value = data;
  } catch (e) {
    kpi.value = null;
  } finally {
    kpiLoading.value = false;
  }
}

onMounted(loadKpi);
watch(canSeeSensitiveKpi, (canSee) => {
  if (canSee) {
    loadKpi();
    return;
  }

  kpi.value = null;
  kpiLoading.value = false;
});

// Top-Mitarbeiter
const topMaAll = ref([]);
const topMaLoading = ref(false);
const topMaExpanded = ref(false);

const topMaVisible = computed(() =>
  topMaExpanded.value ? topMaAll.value : topMaAll.value.slice(0, 3)
);

async function loadTopMa() {
  if (!props.kunde.kundenNr) return;
  topMaLoading.value = true;
  try {
    const { data } = await api.get(`/api/kunden/${props.kunde.kundenNr}/top-mitarbeiter`);
    topMaAll.value = data || [];
  } catch {
    topMaAll.value = [];
  } finally {
    topMaLoading.value = false;
  }
}

onMounted(loadTopMa);
const selectedContactCard = ref(null);
const showKontaktAnlegenModal = ref(false);

function onKontaktAngelegt(contact) {
  showKontaktAnlegenModal.value = false;
  msContacts.value.unshift(contact);
}

function openContactCard(contact) {
  selectedContactCard.value = { ...contact };
}

function onContactCardDeleted(contactId) {
  msContacts.value = msContacts.value.filter(c => c.id !== contactId);
  selectedContactCard.value = null;
}

function onContactCardUpdated(updatedContact) {
  const idx = msContacts.value.findIndex(c => c.id === updatedContact.id);
  if (idx !== -1) {
    msContacts.value[idx] = { ...msContacts.value[idx], ...updatedContact };
  }
}

// Kuerzel inline edit
const editingKuerzel = ref(false);
const kuerzelInput = ref('');
const kuerzelSaving = ref(false);
const kuerzelInputRef = ref(null);

function startEditKuerzel() {
  kuerzelInput.value = props.kunde.kuerzel || '';
  editingKuerzel.value = true;
  nextTick(() => kuerzelInputRef.value?.focus());
}

async function saveKuerzel() {
  if (kuerzelSaving.value) return;
  kuerzelSaving.value = true;
  try {
    const val = kuerzelInput.value.trim() || null;
    await api.put(`/api/kunden/${props.kunde._id}`, { kuerzel: val });
    // Update in-place in the cache so the list also reflects the change
    const cached = dataCache.kunden.find(k => k._id === props.kunde._id);
    if (cached) cached.kuerzel = val;
    props.kunde.kuerzel = val;
    editingKuerzel.value = false;
  } finally {
    kuerzelSaving.value = false;
  }
}

function cancelEditKuerzel() {
  editingKuerzel.value = false;
}

const theme = useTheme();
const effectiveTheme = computed(() => (theme.isDark ? 'dark' : 'light'));

function getStatusText(status) {
  switch(status) {
    case 1: return 'Potentiell';
    case 2: return 'Aktiv';
    case 3: return 'Inaktiv';
    default: return 'Unbekannt';
  }
}

function getStatusClass(status) {
  switch(status) {
    case 1: return 'status-lead';
    case 2: return 'status-active';
    case 3: return 'status-inactive';
    default: return '';
  }
}

function getGeschStText(gs) {
  if (!gs) return '—';
  // Standard mappings based on AuftraegePage and other components
  if (gs === '1' || gs === 1) return 'Berlin';
  if (gs === '2' || gs === 2) return 'Hamburg';
  if (gs === '3' || gs === 3) return 'Köln';
  return gs;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

function formatEuro(value) {
  if (value == null || value === 0) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function formatUrl(url) {
  if (!url) return '#';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function getGoogleMapsUrl(address = {}) {
  const query = [address.strasse, [address.plz, address.ort].filter(Boolean).join(' '), address.land]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatAnsprechpartnerName(name) {
  const parts = String(name || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? [...parts.slice(1), parts[0]].join(' ') : parts[0] || '';
}

function formatAddressName(address, fallback) {
  return [address?.name, address?.branche].filter(Boolean).join(' ') || fallback;
}

function closeSatelliteDialogs() {
  selectedEmployeeId.value = null;
  selectedContactCard.value = null;
  showKontaktAnlegenModal.value = false;
  closeAdresseForm();
  editingKuerzel.value = false;
}

function handleEscape(event) {
  if (event.key !== 'Escape' || isMinimized.value || !isTopmost.value) return;

  // CustomerCard owns the Escape order while it is the active hosted modal.
  // Capture mode prevents page-level handlers from closing UI underneath it.
  event.preventDefault();
  event.stopImmediatePropagation();

  if (showAdresseFormModal.value) {
    closeAdresseForm();
    return;
  }
  if (showKontaktAnlegenModal.value) {
    showKontaktAnlegenModal.value = false;
    return;
  }
  if (selectedContactCard.value) {
    selectedContactCard.value = null;
    return;
  }
  if (selectedEmployeeId.value) {
    selectedEmployeeId.value = null;
    return;
  }
  if (editingKuerzel.value) {
    cancelEditKuerzel();
    return;
  }

  emit('close');
}

watch(isMinimized, (minimized) => {
  // Nested Teleports must not remain visible after the host deactivates this
  // component. The customer card itself keeps all of its primary form state.
  if (minimized) closeSatelliteDialogs();
});

onMounted(() => document.addEventListener('keydown', handleEscape, true));
onBeforeUnmount(() => document.removeEventListener('keydown', handleEscape, true));
</script>

<style scoped>
.customer-card {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  background: var(--tile-bg);
  overflow: hidden;
  max-height: 100%;
  width: 100%;
}

.customer-tabs {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  padding: 0 20px;
  background: var(--surface);
  overflow-x: auto;
  scrollbar-width: none;
}

.customer-tabs::-webkit-scrollbar {
  display: none;
}

.customer-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: max-content;
  padding: 10px 12px 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.customer-tab:hover {
  color: var(--text);
  background: var(--hover);
}

.customer-tab.active {
  color: var(--accent, var(--primary));
  border-bottom-color: var(--accent, var(--primary));
}

.customer-tab:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* Header */
.card-header {
  display: flex;
  align-items: center;
  min-width: 0;
}

.left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.icon-box {
  width: 42px;
  height: 42px;
  background: var(--hover);
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--primary);
  font-size: 18px;
}

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.kuerzel-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.15);
  color: var(--primary);
  border: 1px solid var(--primary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;
}

.kuerzel-badge:hover {
  background: rgba(249, 115, 22, 0.25);
}

.kuerzel-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  border: 1px dashed var(--border);
  cursor: pointer;
  transition: all 0.15s;
}

.kuerzel-add-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.kuerzel-edit-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kuerzel-input {
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--primary);
  border-radius: 4px;
  background: var(--tile-bg);
  color: var(--text);
  width: 90px;
  outline: none;
}

.kuerzel-save-btn,
.kuerzel-cancel-btn {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  display: grid;
  place-items: center;
  transition: background 0.15s;
}

.kuerzel-save-btn {
  background: var(--primary);
  color: #fff;
}

.kuerzel-save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kuerzel-cancel-btn {
  background: var(--hover);
  color: var(--muted);
}

.kunden-nr {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}
.status-active { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.status-inactive { background: rgba(107, 114, 128, 0.15); color: #6b7280; }
.status-lead { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

/* Body */
.card-body {
  flex: 1;
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-tab-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  color: var(--muted);
  text-align: center;
}

.empty-tab-state svg {
  color: var(--primary);
  font-size: 24px;
}

.empty-tab-state p {
  margin: 0;
  font-size: 14px;
}

/* Customer qualification prices */
.kundenpreise-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kundenpreise-section > .section-title:not(:first-child) {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.konditionen-table-wrap {
  margin-bottom: 4px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.konditionen-table {
  min-width: 0;
  table-layout: fixed;
}

.konditionen-zuschlag {
  color: var(--primary);
  font-weight: 700;
  white-space: nowrap;
}

.konditionen-days {
  white-space: normal;
}

.konditionen-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.konditionen-flags > span:not(.muted-cell) {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--soft);
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}

.konditionen-empty {
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 13px;
}

.preise-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.preise-selector-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preise-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preise-table-wrap {
  min-width: 0;
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.preise-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.preise-table th,
.preise-table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--border);
}

.preise-table th {
  background: var(--soft);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.preise-table tbody > tr:last-child td {
  border-bottom: 0;
}

.preise-quali-name,
.preise-quali-key {
  display: block;
}

.preise-quali-name {
  color: var(--text);
  font-weight: 600;
}

.preise-quali-key {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.preise-current {
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.preise-scheduled {
  display: inline-flex;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  color: var(--text);
  font-size: 11px;
  white-space: nowrap;
}

.preise-actions-cell {
  text-align: right !important;
}

.preise-new-btn,
.preise-cancel-btn,
.preise-save-btn {
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.preise-new-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  white-space: nowrap;
}

.preise-new-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}

.preise-add-btn-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.preise-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--primary);
  background: transparent;
  color: var(--primary);
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.preise-add-btn:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.preise-form-row td {
  padding: 0;
  background: var(--soft);
}

.preise-new-form {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 14px;
}

.preise-new-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.preise-new-form input {
  height: 34px;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.preise-new-form input:focus {
  outline: 2px solid color-mix(in srgb, var(--primary) 25%, transparent);
  border-color: var(--primary);
}

.preise-input-unit {
  position: relative;
}

.preise-input-unit input {
  width: 120px;
  padding-right: 28px;
}

.preise-input-unit span {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  color: var(--muted);
  font-size: 13px;
}

.preise-form-actions {
  display: flex;
  gap: 7px;
}

.preise-cancel-btn,
.preise-save-btn {
  min-height: 34px;
  padding: 6px 10px;
}

.preise-cancel-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
}

.preise-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
}

.preise-save-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preise-form-error {
  align-self: center;
  margin: 0;
  color: #dc3545;
  font-size: 12px;
}

.preise-history-row td {
  padding: 6px 12px 10px;
  background: var(--surface);
}

.preise-history-row summary {
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
}

.preise-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 8px 0 2px 16px;
  color: var(--muted);
  font-size: 11px;
}

.preise-message {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.preise-message--error {
  border: 1px solid rgba(220, 53, 69, 0.3);
  background: rgba(220, 53, 69, 0.08);
  color: #dc3545;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Modal Dialog */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: var(--tile-bg);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 18px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.add-quali-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-select {
  position: relative;
}

.add-quali-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.add-quali-form select,
.add-quali-form input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.add-quali-form select:focus,
.add-quali-form input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent);
}

.search-select-results {
  position: absolute;
  z-index: 1;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
}

.search-select-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
}

.search-select-option:last-child {
  border-bottom: 0;
}

.search-select-option:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

.search-select-option small {
  color: var(--muted);
  font-size: 11px;
}

.search-select-empty {
  padding: 10px;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 720px) {
  .erechnung-settings {
    grid-template-columns: 1fr;
  }

  .erechnung-save-btn {
    width: 100%;
  }

  .preise-new-form {
    align-items: stretch;
    flex-direction: column;
  }

  .preise-input-unit input {
    width: 100%;
  }

  .preise-form-actions {
    justify-content: flex-end;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.btn-add-contact {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;

  &:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 6%, transparent);
  }
}

.address-sort {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;

  button {
    padding: 3px 8px;
    border: 0;
    border-right: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    cursor: pointer;

    &:last-child { border-right: 0; }

    &:hover { background: var(--soft); color: var(--text); }

    &.active {
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      font-weight: 600;
    }
  }
}

:deep(.einsatzorte-inactive-toggle.filter-chip) {
  height: 24px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;

  svg { font-size: 10px; }
}

.badge {
  background: var(--soft);
  color: var(--text);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

/* Info Grid */
.kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--soft);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.rechnung-section .kv-grid {
  margin-bottom: 16px;
}

.erechnung-settings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--soft);
}

.erechnung-settings h5,
.erechnung-settings label,
.erechnung-error {
  margin: 0;
}

.erechnung-settings h5,
.erechnung-error {
  grid-column: 1 / -1;
  color: var(--text);
  font-size: 13px;
}

.erechnung-settings label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

.erechnung-settings input,
.erechnung-settings select {
  width: 100%;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.erechnung-settings input:focus,
.erechnung-settings select:focus {
  outline: 2px solid color-mix(in srgb, var(--primary) 25%, transparent);
  border-color: var(--primary);
}

.erechnung-save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
}

.erechnung-save-btn:disabled {
  cursor: wait;
  opacity: 0.6;
}

.erechnung-error {
  color: #dc3545;
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.value {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}

/* Remarks */
.remarks-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.remarks-add-btn {
  margin-left: auto;
}

.remark-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding-left: 16px;
  margin-bottom: 8px;
  color: #b42318;
  font-size: 14px;

  > span:first-child {
    flex: 1;
    min-width: 0;
  }
}

.remark-item::before {
  content: "•";
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: bold;
}

.remark-editor {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  margin: 4px 0 8px;

  input {
    flex: 1;
    min-width: 0;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--tile-bg);
    color: var(--text);
    font-size: 13px;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
}

.remark-item .remark-editor {
  margin: 0;
}

.remark-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.remark-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--border);
    background: var(--soft);
    color: var(--text);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.55;
  }
}

.remark-action--save {
  color: var(--success, #10b981);
}

.remark-action--delete:hover:not(:disabled) {
  color: #dc3545;
}

.remarks-empty {
  color: var(--muted);
  font-size: 13px;
}

/* Addresses */
.addresses-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.address-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.address-header-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.address-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 18px;
}

.address-name {
  display: block;
  font-weight: 600;
  color: var(--text);
}

.address-billing-badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.address-postal-badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, #3b82f6 35%, var(--border));
  border-radius: 5px;
  background: color-mix(in srgb, #3b82f6 10%, transparent);
  color: #3b82f6;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.address-branche {
  font-size: 11px;
  color: var(--muted);
}

.address-menu-btn {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  transform: translate(4px, -5px);
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.address-menu-btn:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  color: var(--primary);
}

.address-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.address-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text);

  svg { width: 14px; margin-top: 2px; color: var(--muted); flex-shrink: 0; }

  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
}

.address-map-link {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  margin-left: auto;
  place-items: center;
  border-radius: 5px;
  color: var(--muted) !important;
}

.address-row :deep(.tooltip-container) {
  flex: 0 0 auto;
  margin-left: auto;
}

.address-map-link:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  color: var(--primary) !important;
  text-decoration: none !important;
}

/* Signatur-Standard hint (shown when none is set) */
.sig-standard-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
  padding: 8px 12px;
  background: var(--soft);
  border: 1px dashed var(--border);
  border-radius: 8px;
  margin-bottom: 4px;
}

/* Sig toggle row inside each contact card */
.contact-sig-row {
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sig-set-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.sig-set-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 6%, transparent);
  border-style: solid;
}

.sig-set-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sig-active-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #d97706;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 6px;
  padding: 4px 8px;
  width: 100%;
  box-sizing: border-box;
}

.sig-remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0 2px;
  cursor: pointer;
  color: #d97706;
  opacity: 0.6;
  font-size: 11px;
  margin-left: auto;
  transition: opacity 0.15s;
}

.sig-remove-btn:hover:not(:disabled) {
  opacity: 1;
}

.sig-remove-btn:disabled {
  cursor: not-allowed;
}

/* Contacts */
.contacts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.empty-contacts {
  color: var(--muted);
  font-style: italic;
  font-size: 14px;
}

.contact-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--primary);
  }
}

.contact-card--inactive {
  opacity: 0.62;
}

.contact-open-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.contact-card-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.contact-menu-btn {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  margin: -5px -5px 0 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.contact-menu-btn:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  color: var(--primary);
}

.contact-name {
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg { color: var(--muted); }
}

.ms-logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;

  span {
    display: block;
    border-radius: 1px;
  }
}

.contact-meta {
  font-size: 11px;
  color: var(--muted);
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  
  svg { width: 14px; color: var(--muted); }
  
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
}

.contact-comments {
  margin-top: 8px;
  background: var(--hover);
  padding: 8px 12px;
  border-radius: 6px;
}

/* Contact actions */
.contact-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  background: transparent;
}

.action-edit {
  border-color: var(--border);
  color: var(--muted);
}
.action-edit:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.action-delete {
  border-color: var(--border);
  color: var(--muted);
}
.action-delete:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.action-delete:disabled,
.action-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-save {
  border-color: var(--primary);
  color: var(--primary);
  margin-left: auto;
}
.action-save:hover:not(:disabled) {
  background: var(--primary);
  color: #fff;
}

.action-cancel {
  border-color: var(--border);
  color: var(--muted);
}
.action-cancel:hover {
  background: var(--hover);
}

/* Edit form */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.edit-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--tile-bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}
.edit-input:focus {
  border-color: var(--primary);
}

.edit-input-full {
  width: 100%;
  box-sizing: border-box;
}

.comments-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.comment-item {
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.comment-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.comment-text {
  color: var(--text);
  margin-bottom: 2px;
}

.comment-footer {
  font-size: 10px;
  color: var(--muted);
}

/* ── KPI Section ─────────────────────────────────────────────────────────── */
.kpi-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kpi-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
}

.kpi-label {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-tables-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.kpi-table-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-table-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.kpi-table th {
  text-align: left;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
}

.kpi-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.kpi-table tr:last-child td {
  border-bottom: none;
}

.muted-cell {
  color: var(--muted);
}

/* Qualification bars */
.qual-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.qual-bar-row {
  display: grid;
  grid-template-columns: 160px 1fr 40px 44px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.qual-name {
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qual-bar-track {
  height: 6px;
  background: var(--hover);
  border-radius: 3px;
  overflow: hidden;
}

.qual-bar-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.qual-pct {
  font-weight: 600;
  color: var(--text);
  text-align: right;
}
/* Top Mitarbeiter */
.top-ma-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.top-ma-item {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 7px;
  overflow: hidden;
}

.top-ma-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface);
  font-size: 13px;
}

.top-ma-rank {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  min-width: 24px;
}

.top-ma-name {
  font-weight: 600;
  color: var(--primary);
  flex: 1;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: opacity 0.15s;
  &:hover { opacity: 0.75; text-decoration: underline; }
}

.top-ma-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: none;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  &:hover { color: var(--primary); border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }
}

.top-ma-einsatz-expand {
  border-top: 1px solid var(--border);
  background: var(--soft);
  padding: 6px 0;
}

.top-ma-einsatz-loading,
.top-ma-einsatz-empty {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--muted);
  font-style: italic;
}

.top-ma-einsatz-list {
  display: flex;
  flex-direction: column;
}

.top-ma-einsatz-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  transition: background 0.12s;
  &:last-child { border-bottom: none; }
  &:hover { background: color-mix(in srgb, var(--primary) 7%, transparent); }
}

.tme-date {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 78px;
}

.tme-title {
  font-weight: 600;
  color: var(--text);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tme-shift {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  max-width: 140px;
}

.tme-location {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  max-width: 120px;
}

.tme-link-icon {
  color: var(--primary);
  font-size: 11px;
  flex-shrink: 0;
  opacity: 0.5;
  margin-left: auto;
}

.top-ma-einsatz-row:hover .tme-link-icon { opacity: 1; }

.top-ma-nr {
  font-size: 11px;
  color: var(--muted);
}

.top-ma-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  background: var(--soft);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.top-ma-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--primary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  transition: opacity 0.15s;
}

.top-ma-toggle:hover {
  opacity: 0.75;
}

</style>
