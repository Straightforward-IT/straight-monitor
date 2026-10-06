<template>
  <ModalFrame
    minimizable
    size="xl"
    :title="kunde.kundName || 'Kundenkarte'"
    style="--mf-max-width: min(1120px, 94vw); --mf-max-height: 92dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    :data-theme="effectiveTheme"
    :close-on-escape="false"
    @close="requestCloseCustomer"
  >
    <template #header="{ titleId }">
      <div class="card-header">
      <div class="left">
        <div class="icon-box">
          <font-awesome-icon :icon="['fas', 'building']" class="header-icon" />
        </div>
        <div class="title">
          <span class="kunden-nr">Kunden-Nr. {{ kunde.kundenNr }}</span>
          <div class="name-row">
            <h2 :id="titleId" class="name">{{ kunde.kundName || 'Unbenannt' }}</h2>
            <!-- Kuerzel -->
            <template v-if="!editingKuerzel">
              <AppButton v-if="kunde.kuerzel" class="kuerzel-badge" size="sm" variant="outlined" :aria-label="`Kürzel ${kunde.kuerzel} bearbeiten`" @click="startEditKuerzel">{{ kunde.kuerzel }}</AppButton>
              <AppButton v-else class="kuerzel-add-btn" size="sm" variant="secondary" @click="startEditKuerzel">
                <font-awesome-icon :icon="['fas', 'tag']" /> Kürzel
              </AppButton>
            </template>
            <template v-else>
              <div class="kuerzel-edit-row">
                <AppTextInput
                  ref="kuerzelInputRef"
                  v-model="kuerzelInput"
                  class="kuerzel-input"
                  placeholder="z.B. ABB"
                  maxlength="20"
                  :disabled="kuerzelSaving"
                  aria-label="Kürzel"
                  @keydown.enter.prevent="saveKuerzel"
                  @keydown.esc.prevent="cancelEditKuerzel"
                />
                <AppIconButton class="kuerzel-save-btn" size="sm" label="Kürzel speichern" :loading="kuerzelSaving" @click="saveKuerzel">
                  <font-awesome-icon v-if="!kuerzelSaving" :icon="['fas', 'check']" />
                </AppIconButton>
                <AppIconButton class="kuerzel-cancel-btn" size="sm" variant="ghost" label="Kürzelbearbeitung abbrechen" :disabled="kuerzelSaving" @click="cancelEditKuerzel">
                  <font-awesome-icon :icon="['fas', 'times']" />
                </AppIconButton>
              </div>
            </template>
          </div>
          <span v-if="kuerzelError" class="kuerzel-error" role="alert">{{ kuerzelError }}</span>
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
      <nav class="customer-tabs" role="tablist" aria-label="Kundendetails">
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="customer-tab"
          :class="{ active: activeTab === tab.id }"
          :id="customerTabId(tab.id)"
          :aria-controls="customerPanelId"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          :disabled="customerWritePending || showAddQualifikationDialog || showSignatureContactCollapseDialog"
          @click="activeTab = tab.id"
          @keydown="navigateCustomerTab($event, tab.id)"
        >
          <font-awesome-icon :icon="['fas', tab.icon]" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

    <!-- Body -->
    <div :id="customerPanelId" class="card-body" role="tabpanel" :aria-labelledby="customerTabId(activeTab)" tabindex="0">
      
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
          <AppButton class="remarks-add-btn" size="sm" variant="secondary" :disabled="remarksSaving" @click="startAddRemark">
            <font-awesome-icon :icon="['fas', 'plus']" /> Bemerkung hinzufügen
          </AppButton>
        </h4>
        <div v-if="remarkDraft !== null && editingRemarkIndex === null" class="remark-editor">
          <AppTextInput
            :ref="setRemarkInputRef"
            v-model="remarkDraft"
            maxlength="1000"
            placeholder="Bemerkung eingeben"
            aria-label="Bemerkung"
            :disabled="remarksSaving"
            @keyup.enter.prevent="saveRemark"
            @keyup.esc.prevent="cancelRemarkEdit"
          />
          <AppIconButton class="remark-action" size="sm" label="Bemerkung speichern" :loading="remarksSaving" @click="saveRemark">
            <font-awesome-icon v-if="!remarksSaving" :icon="['fas', 'check']" />
          </AppIconButton>
          <AppIconButton class="remark-action" size="sm" variant="ghost" label="Bemerkung abbrechen" :disabled="remarksSaving" @click="cancelRemarkEdit">
            <font-awesome-icon :icon="['fas', 'xmark']" />
          </AppIconButton>
        </div>
        <p v-if="remarkError" class="remark-error" role="alert">{{ remarkError }}</p>
        <ul v-if="remarks.length" class="remarks-list">
          <li v-for="(rem, index) in remarks" :key="`${index}-${rem}`" class="remark-item">
            <template v-if="editingRemarkIndex === index">
              <div class="remark-editor">
                <AppTextInput
                  :ref="setRemarkInputRef"
                  v-model="remarkDraft"
                  maxlength="1000"
                  :aria-label="`Bemerkung ${index + 1}`"
                  :disabled="remarksSaving"
                  @keyup.enter.prevent="saveRemark"
                  @keyup.esc.prevent="cancelRemarkEdit"
                />
                <AppIconButton class="remark-action" size="sm" :label="`Bemerkung ${index + 1} speichern`" :loading="remarksSaving" @click="saveRemark">
                  <font-awesome-icon v-if="!remarksSaving" :icon="['fas', 'check']" />
                </AppIconButton>
                <AppIconButton class="remark-action" size="sm" variant="ghost" :label="`Bemerkung ${index + 1} abbrechen`" :disabled="remarksSaving" @click="cancelRemarkEdit">
                  <font-awesome-icon :icon="['fas', 'xmark']" />
                </AppIconButton>
              </div>
            </template>
            <template v-else>
              <span>{{ rem }}</span>
              <span class="remark-actions">
                <AppIconButton class="remark-action" size="sm" variant="ghost" :label="`Bemerkung ${index + 1} bearbeiten`" :disabled="remarksSaving" @click="startEditRemark(index)">
                  <font-awesome-icon :icon="['fas', 'pen']" />
                </AppIconButton>
                <AppIconButton class="remark-action" size="sm" variant="ghost" :label="`Bemerkung ${index + 1} löschen`" :disabled="remarksSaving" @click="deleteRemark(index)">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </AppIconButton>
              </span>
            </template>
          </li>
        </ul>
        <p v-else-if="remarkDraft === null" class="remarks-empty">Keine Bemerkungen vorhanden.</p>
      </section>

      <!-- Einsätze -->
      <section v-if="activeTab === 'einsaetze' && kunde.kundenNr" class="section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'calendar-days']" /> Auftragskalender
        </h4>
        <CustomerOrderCalendar :key="kunde.kundenNr" :kunden-nr="kunde.kundenNr" @open="openAuftrag" />
      </section>

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
                <AppButton class="top-ma-name" size="sm" variant="ghost" :aria-label="`Mitarbeiterprofil von ${ma.vorname} ${ma.nachname} öffnen`" @click.stop="openEmployeeCard(ma._id)">{{ ma.vorname }} {{ ma.nachname }}</AppButton>
                <span class="top-ma-nr" v-if="ma.personalnr">Nr. {{ ma.personalnr }}</span>
                <span class="top-ma-count">{{ ma.count }} Einsatz{{ ma.count !== 1 ? 'e' : '' }}</span>
                <AppIconButton class="top-ma-expand-btn" size="sm" variant="ghost" :label="`Einsätze von ${ma.vorname} ${ma.nachname} ${expandedMaIds.has(String(ma._id)) ? 'einklappen' : 'anzeigen'}`" :active="expandedMaIds.has(String(ma._id))" @click="toggleMaExpand(ma)">
                  <font-awesome-icon :icon="['fas', expandedMaIds.has(String(ma._id)) ? 'chevron-up' : 'chevron-down']" />
                </AppIconButton>
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
          <AppButton
            v-if="topMaAll.length > 3"
            class="top-ma-toggle"
            size="sm"
            variant="ghost"
            @click="topMaExpanded = !topMaExpanded"
          >
            <font-awesome-icon :icon="['fas', topMaExpanded ? 'chevron-up' : 'chevron-down']" />
            {{ topMaExpanded ? 'Weniger anzeigen' : `Alle ${topMaAll.length} anzeigen` }}
          </AppButton>
        </div>
      </section>

      <!-- Kontakte -->
      <section v-if="activeTab === 'kontakte'" class="section contacts-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'address-book']" /> Kontakte
          <span class="badge">{{ linkedContacts.length }}</span>
          <AppButton
            v-if="inactiveContacts.length"
            class="section-action-btn--push"
            size="sm"
            variant="secondary"
            @click="showInactiveContacts = !showInactiveContacts"
          >
            <font-awesome-icon :icon="['fas', showInactiveContacts ? 'eye-slash' : 'eye']" />
            {{ showInactiveContacts ? 'Inaktive ausblenden' : `Inaktive (${inactiveContacts.length})` }}
          </AppButton>
          <AppButton
            v-if="kunde.kuerzel"
            :class="{ 'section-action-btn--push': !inactiveContacts.length }"
            size="sm"
            variant="secondary"
            @click="showKontaktAnlegenModal = true"
          >
            <font-awesome-icon :icon="['fas', 'plus']" /> Anlegen
          </AppButton>
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

        <div v-if="!signaturKontaktIds.length && linkedContacts.length > 0" class="sig-standard-hint">
          <font-awesome-icon :icon="['fas', 'circle-info']" />
          Noch kein Signatur-Standard gesetzt – wähle einen Kontakt als Standard für Signaturen.
        </div>

        <div v-if="visibleContacts.length > 0" class="contacts-list">
          <InformationCard
            v-for="contact in visibleContacts"
            :key="contact.id"
            interactive
            :inactive="isMicrosoftContactInactive(contact)"
            :highlighted="isSignaturKontakt(contact)"
            @click="openContactCard(contact)"
          >
            <template v-if="isSignaturKontakt(contact)" #legend>
              <font-awesome-icon :icon="['fas', 'file-signature']" /> {{ contact.id === signaturKontaktId ? 'Signatur-Standard' : 'Weiterer Signatur-Standard' }}
            </template>
            <template #icon>
              <div class="ms-logo-grid" aria-hidden="true">
                <span style="background:#f25022"></span>
                <span style="background:#7fba00"></span>
                <span style="background:#00a4ef"></span>
                <span style="background:#ffb900"></span>
              </div>
            </template>
            <template #title>{{ contact.displayName }}</template>
            <template #actions>
              <AppIconButton
                class="contact-menu-btn"
                size="sm"
                variant="ghost"
                :label="`Optionen für ${contact.displayName || 'Kontakt'}`"
                @click.stop="openContactMenu(contact, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </AppIconButton>
            </template>
            <div v-if="contact.jobTitle" class="detail-row contact-position">
              <font-awesome-icon :icon="['fas', 'briefcase']" />
              <span>{{ contact.jobTitle }}</span>
            </div>
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
          </InformationCard>
        </div>
      </section>

      <!-- Adressen -->
      <section v-if="activeTab === 'allgemein'" class="section addresses-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'location-dot']" /> Adressen
          <span class="badge">{{ kundenAdressen.length }}</span>
          <AppButton class="section-action-btn--push" size="sm" variant="secondary" @click="openCreateAdresse">
            <font-awesome-icon :icon="['fas', 'plus']" /> Adresse anlegen
          </AppButton>
        </h4>
        <div v-if="kundenAdressen.length" class="addresses-list">
          <InformationCard v-for="(adr, index) in kundenAdressen" :key="adr.nummer || index">
            <template v-if="adr.isRechnAdr || adr.isPostAdr" #legend>{{ adr.isRechnAdr ? 'Rechnungsanschrift' : 'Postanschrift' }}</template>
            <template #icon><font-awesome-icon :icon="['fas', 'location-dot']" /></template>
            <template #title>{{ formatAddressName(adr, 'Adresse ' + (index + 1)) }}</template>
            <template #actions>
              <AppIconButton
                class="address-menu-btn"
                size="sm"
                variant="ghost"
                :label="`Optionen für ${formatAddressName(adr, 'Adresse ' + (index + 1))}`"
                @click.stop="openAdresseMenu(adr, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </AppIconButton>
            </template>
            <div v-if="adr.strasse || adr.plz || adr.ort" class="address-row">
              <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
              <span>
                <template v-if="adr.strasse">{{ adr.strasse }}<br /></template>
                {{ [adr.plz, adr.ort].filter(Boolean).join(' ') }}<template v-if="adr.land">, {{ adr.land }}</template>
              </span>
              <CustomTooltip text="In Google Maps öffnen" position="top">
                <a class="address-map-link" :href="getGoogleMapsUrl(adr)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop><font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" /></a>
              </CustomTooltip>
            </div>
            <div v-for="telefon in adr.telefone" :key="telefon" class="address-row"><font-awesome-icon :icon="['fas', 'phone']" /><a :href="`tel:${telefon}`">{{ telefon }}</a></div>
            <div v-if="adr.email" class="address-row"><font-awesome-icon :icon="['fas', 'envelope']" /><a :href="`mailto:${adr.email}`">{{ adr.email }}</a></div>
            <div v-if="adr.homepage" class="address-row"><font-awesome-icon :icon="['fas', 'globe']" /><a :href="formatUrl(adr.homepage)" target="_blank" rel="noopener noreferrer">{{ adr.homepage }}</a></div>
          </InformationCard>
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
          <InformationCard v-for="(adr, index) in ansprechpartner" :key="adr.nummer || index">
            <template #icon><font-awesome-icon :icon="['fas', 'user-tie']" /></template>
            <template #title>{{ formatAnsprechpartnerName(adr.name) || 'Ansprechpartner ' + (index + 1) }}</template>
            <template #actions>
              <AppIconButton
                class="address-menu-btn"
                size="sm"
                variant="ghost"
                :label="`Optionen für ${formatAnsprechpartnerName(adr.name) || 'Ansprechpartner ' + (index + 1)}`"
                @click.stop="openAdresseMenu(adr, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </AppIconButton>
            </template>
            <span v-if="adr.branche" class="address-branche">{{ adr.branche }}</span>
            <div v-if="adr.strasse || adr.plz || adr.ort" class="address-row">
              <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
              <span><template v-if="adr.strasse">{{ adr.strasse }}<br /></template>{{ [adr.plz, adr.ort].filter(Boolean).join(' ') }}<template v-if="adr.land">, {{ adr.land }}</template></span>
              <CustomTooltip text="In Google Maps öffnen" position="top"><a class="address-map-link" :href="getGoogleMapsUrl(adr)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop><font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" /></a></CustomTooltip>
            </div>
            <div v-for="telefon in adr.telefone" :key="telefon" class="address-row"><font-awesome-icon :icon="['fas', 'phone']" /><a :href="`tel:${telefon}`">{{ telefon }}</a></div>
            <div v-if="adr.email" class="address-row"><font-awesome-icon :icon="['fas', 'envelope']" /><a :href="`mailto:${adr.email}`">{{ adr.email }}</a></div>
            <div v-if="adr.homepage" class="address-row"><font-awesome-icon :icon="['fas', 'globe']" /><a :href="formatUrl(adr.homepage)" target="_blank" rel="noopener noreferrer">{{ adr.homepage }}</a></div>
          </InformationCard>
        </div>
      </section>

      <section v-if="activeTab === 'allgemein'" class="section addresses-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'map-location-dot']" /> Einsatzorte
          <span class="badge">{{ visibleEinsatzorte.length }}</span>
          <AppSegmentedControl v-model="einsatzortSort" class="address-sort" size="sm" label="Einsatzortsortierung" :options="einsatzortSortOptions" />
          <AppHiddenItemsButton
            :active="showInactiveEinsatzorte"
            :inactive-label="inactiveEinsatzorte.length ? `Inaktive (${inactiveEinsatzorte.length})` : 'Inaktive'"
            :inactive-aria-label="`${inactiveEinsatzorte.length} inaktive Einsatzorte anzeigen`"
            active-aria-label="Aktive Einsatzorte anzeigen"
            @click="showInactiveEinsatzorte = !showInactiveEinsatzorte"
          />
          <AppButton class="section-action-btn--push" size="sm" variant="secondary" @click="openCreateEinsatzort">
            <font-awesome-icon :icon="['fas', 'plus']" /> Einsatzort anlegen
          </AppButton>
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
              <AppIconButton class="address-menu-btn" size="sm" variant="ghost" :label="`Optionen für ${einsatzort.bezeichnung}`" @click.stop="openEinsatzortMenu(einsatzort, $event)">
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </AppIconButton>
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

      <section v-if="activeTab === 'einsatzinfos'" class="section einsatzinfos-section">
        <EinsatzinformationenEditor :kunden-nr="kunde.kundenNr" :einsatzorte="einsatzorte" />
      </section>

      <CustomerSignaturesPanel v-if="activeTab === 'signatur'" class="section" :kunde="kunde" />
      <section v-if="activeTab === 'einstellungen'" class="section customer-settings-section">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'gear']" /> Einstellungen
        </h4>
        <section class="customer-settings-group">
          <h5><font-awesome-icon :icon="['fas', 'file-signature']" /> Signatur</h5>
          <label class="stundenliste-double-copy-toggle">
            <input v-model="stundenlisteSignaturDoppelt" type="checkbox" :disabled="stundenlisteSettingSaving" @change="saveStundenlisteSetting" />
            <span>
              <strong>Stundenliste als Doppelausfertigung</strong>
              <small>Erste Ausfertigung sperrt Beginn bis Unterschrift; die zweite bleibt leer.</small>
            </span>
            <font-awesome-icon v-if="stundenlisteSettingSaving" :icon="['fas', 'spinner']" spin />
          </label>
          <label class="stundenliste-double-copy-toggle">
            <input v-model="stundenlisteSignaturDuAnrede" type="checkbox" :disabled="stundenlisteSettingSaving" @change="saveStundenlisteSetting" />
            <span>
              <strong>Stundenliste mit Du-Anrede</strong>
              <small>Verwendet „Hallo {Vorname}“ statt der formellen Anrede im Einsatznachweis.</small>
            </span>
            <font-awesome-icon v-if="stundenlisteSettingSaving" :icon="['fas', 'spinner']" spin />
          </label>
          <label class="stundenliste-double-copy-toggle">
            <input v-model="stundenlisteMehrereEinladungen" type="checkbox" :disabled="stundenlisteSettingSaving" @change="handleMehrereEinladungenChange" />
            <span>
              <strong>Stundenliste an weitere Empfänger senden</strong>
              <small>Erlaubt zusätzliche Einladungen mit demselben Entleiher-Signaturlink.</small>
            </span>
            <font-awesome-icon v-if="stundenlisteSettingSaving" :icon="['fas', 'spinner']" spin />
          </label>
          <p v-if="stundenlisteSettingError" class="stundenliste-double-copy-error" role="alert">{{ stundenlisteSettingError }}</p>
        </section>
      </section>

      <!-- Statistik -->
      <section v-if="activeTab === 'statistik' && kunde.kundenNr && canSeeSensitiveKpi" class="section analytics-section">
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
            <AppTextInput v-model.trim="eRechnungForm.leitwegId" autocomplete="off" placeholder="z. B. 991-..." :disabled="eRechnungSaving" />
          </label>
          <label>
            <span>Bevorzugtes Format</span>
            <AppSelect v-model="eRechnungForm.eRechnungFormat" :disabled="eRechnungSaving">
              <option value="">Nicht festgelegt</option>
              <option value="ZUGFERD">ZUGFeRD</option>
              <option value="XRECHNUNG">XRechnung</option>
            </AppSelect>
          </label>
          <label>
            <span>Mehrwertsteuer</span>
            <AppSelect v-model="eRechnungForm.mwst" :disabled="eRechnungSaving">
              <option :value="null">Nicht festgelegt</option>
              <option :value="0">MWST-frei</option>
              <option :value="1">MWST-pflichtig</option>
              <option :value="2">Steuerfreie EG-Umsätze</option>
              <option :value="3">MWST-frei gem. § 13b UStG</option>
            </AppSelect>
          </label>
          <AppButton class="erechnung-save-btn" size="sm" type="submit" :loading="eRechnungSaving">
            <font-awesome-icon :icon="['fas', 'floppy-disk']" />
            Speichern
          </AppButton>
          <p v-if="eRechnungError" class="erechnung-error" role="alert">{{ eRechnungError }}</p>
        </form>

        <div v-if="rechnungsanschrift" class="addresses-list">
          <InformationCard>
            <template #legend>Rechnungsanschrift</template>
            <template #icon><font-awesome-icon :icon="['fas', 'location-dot']" /></template>
            <template #title>{{ formatAddressName(rechnungsanschrift, 'Rechnungsanschrift') }}</template>
            <template #actions>
              <AppIconButton
                class="address-menu-btn"
                size="sm"
                variant="ghost"
                :label="`Optionen für ${formatAddressName(rechnungsanschrift, 'Rechnungsanschrift')}`"
                @click.stop="openAdresseMenu(rechnungsanschrift, $event)"
              >
                <font-awesome-icon :icon="['fas', 'ellipsis-vertical']" />
              </AppIconButton>
            </template>
            <div v-if="rechnungsanschrift.strasse || rechnungsanschrift.plz || rechnungsanschrift.ort" class="address-row">
              <font-awesome-icon :icon="['fas', 'map-marker-alt']" />
              <span>
                <template v-if="rechnungsanschrift.strasse">{{ rechnungsanschrift.strasse }}<br /></template>
                {{ [rechnungsanschrift.plz, rechnungsanschrift.ort].filter(Boolean).join(' ') }}<template v-if="rechnungsanschrift.land">, {{ rechnungsanschrift.land }}</template>
              </span>
              <CustomTooltip text="In Google Maps öffnen" position="top">
                <a class="address-map-link" :href="getGoogleMapsUrl(rechnungsanschrift)" target="_blank" rel="noopener noreferrer" aria-label="In Google Maps öffnen" @click.stop><font-awesome-icon :icon="['fas', 'arrow-up-right-from-square']" /></a>
              </CustomTooltip>
            </div>
            <div v-for="telefon in rechnungsanschrift.telefone" :key="telefon" class="address-row"><font-awesome-icon :icon="['fas', 'phone']" /><a :href="`tel:${telefon}`">{{ telefon }}</a></div>
            <div v-if="rechnungsanschrift.email" class="address-row"><font-awesome-icon :icon="['fas', 'envelope']" /><a :href="`mailto:${rechnungsanschrift.email}`">{{ rechnungsanschrift.email }}</a></div>
            <div v-if="rechnungsanschrift.homepage" class="address-row"><font-awesome-icon :icon="['fas', 'globe']" /><a :href="formatUrl(rechnungsanschrift.homepage)" target="_blank" rel="noopener noreferrer">{{ rechnungsanschrift.homepage }}</a></div>
          </InformationCard>
        </div>

        <div v-else class="empty-tab-state">
          <font-awesome-icon :icon="['fas', 'file-invoice']" />
          <p>Keine Rechnungsanschrift festgelegt.</p>
        </div>
      </section>

      <section v-if="activeTab === 'rechnung'" class="section kundenpreise-section">
        <div class="kundenpreise-section__conditions">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'percent']" /> Zuschlagskonditionen
        </h4>

        <div v-if="konditionenLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Konditionen werden geladen…
        </div>
        <div v-else-if="konditionenError" class="preise-message preise-message--error" role="alert">
          {{ konditionenError }}
          <AppButton size="sm" variant="secondary" @click="loadKundenkonditionen(true)">Erneut laden</AppButton>
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
        </div>

        <div class="kundenpreise-section__prices">
        <h4 class="section-title">
          <font-awesome-icon :icon="['fas', 'coins']" /> Kundenpreise
        </h4>

        <div v-if="preiseLoading" class="empty-contacts">
          <font-awesome-icon :icon="['fas', 'spinner']" spin /> Preise werden geladen…
        </div>
        <div v-else-if="preiseError" class="preise-message preise-message--error" role="alert">
          {{ preiseError }}
          <AppButton size="sm" variant="secondary" @click="loadKundenpreise(true)">Erneut laden</AppButton>
        </div>
        <div v-else-if="filteredPreisQualifikationen.length === 0" class="empty-tab-state">
          <font-awesome-icon :icon="['fas', 'coins']" />
          <p>Für diesen Kunden sind noch keine Qualifikationspreise hinterlegt.</p>
          <AppButton class="preise-add-btn" size="sm" variant="outlined" @click="openAddQualifikationDialog">
            <font-awesome-icon :icon="['fas', 'plus']" /> Qualifikation hinzufügen
          </AppButton>
        </div>
        <template v-else>
          <div class="preise-add-btn-row">
            <AppButton
              class="preise-add-btn"
              size="sm"
              variant="outlined"
              @click="openAddQualifikationDialog"
            >
              <font-awesome-icon :icon="['fas', 'plus']" /> Qualifikation hinzufügen
            </AppButton>
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
                      <AppButton class="preise-new-btn" size="sm" variant="secondary" :disabled="preiseSaving" @click="openNewPrice(entry)">
                        <font-awesome-icon :icon="['fas', 'plus']" /> Neuer Preis
                      </AppButton>
                    </td>
                  </tr>
                  <tr v-if="newPriceQualificationId === entry.qualifikation._id" class="preise-form-row">
                    <td colspan="5">
                      <form class="preise-new-form" @submit.prevent="saveNewPrice(entry)">
                        <label>
                          Preis pro Stunde
                          <div class="preise-input-unit">
                            <AppTextInput v-model.trim="newPriceAmount" inputmode="decimal" placeholder="0,00" :disabled="preiseSaving" required />
                            <span>€</span>
                          </div>
                        </label>
                        <label>
                          Gültig ab
                          <AppTextInput v-model="newPriceValidFrom" type="date" :disabled="preiseSaving" required />
                        </label>
                        <div class="preise-form-actions">
                          <AppButton size="sm" variant="secondary" :disabled="preiseSaving" @click="closeNewPrice">Abbrechen</AppButton>
                          <AppButton size="sm" type="submit" :loading="preiseSaving">
                            <font-awesome-icon :icon="['fas', 'check']" />
                            Speichern
                          </AppButton>
                        </div>
                        <p v-if="newPriceError" class="preise-form-error" role="alert">{{ newPriceError }}</p>
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
        </div>

        <!-- Add Qualification Dialog -->
        <ModalFrame
          v-if="showAddQualifikationDialog"
          layer="elevated"
          size="sm"
          title="Neue Qualifikation hinzufügen"
          style="--mf-max-width: min(500px, calc(100vw - 2rem))"
          :show-close="!addPriceSaving"
          :close-on-escape="false"
          :close-on-backdrop="!addPriceSaving"
          @close="closeAddQualifikationDialog"
        >
          <form class="add-quali-form" @submit.prevent="saveNewQualifikation">
                <div class="search-select">
                  <label for="add-price-qualifikation">Qualifikation</label>
                  <AppTextInput
                    id="add-price-qualifikation"
                    v-model="qualifikationSearchQuery"
                    type="search"
                    autocomplete="off"
                    :disabled="addPriceSaving"
                    placeholder="Qualifikation oder Schlüssel suchen"
                    @focus="showQualifikationResults = true"
                    @input="showQualifikationResults = true"
                  />
                  <div v-if="showQualifikationResults" class="search-select-results">
                    <button
                      v-for="qualifikation in matchingQualifikationen"
                      :key="qualifikation._id"
                      type="button"
                      class="search-select-option"
                      :disabled="addPriceSaving"
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
                    <AppTextInput v-model.trim="addPriceAmount" inputmode="decimal" placeholder="0,00" :disabled="addPriceSaving" required />
                    <span>€</span>
                  </div>
                </label>
                <label>
                  Gültig ab
                  <AppTextInput v-model="addPriceValidFrom" type="date" :disabled="addPriceSaving" required />
                </label>
                <p v-if="addPriceError" class="preise-form-error" role="alert">{{ addPriceError }}</p>
                <div class="preise-form-actions">
                  <AppButton size="sm" variant="secondary" :disabled="addPriceSaving" @click="closeAddQualifikationDialog">Abbrechen</AppButton>
                  <AppButton size="sm" type="submit" :loading="addPriceSaving">
                    <font-awesome-icon :icon="['fas', 'check']" />
                    Speichern
                  </AppButton>
                </div>
          </form>
        </ModalFrame>
      </section>

    </div>

    <!-- Employee Card Modal -->
    <EmployeeCardModal
      :mitarbeiterId="selectedEmployeeId"
      @close="selectedEmployeeId = null"
    />

    <!-- Contact Card Modal -->
    <ContactCard
      v-if="selectedContactCard"
      :contact="selectedContactCard"
      :initial-editing="selectedContactCard.editing"
      @close="selectedContactCard = null"
      @deleted="onContactCardDeleted"
      @updated="onContactCardUpdated"
    />

    <!-- Kontakt Anlegen Modal -->
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
    <ContextMenu
      v-if="adresseMenuAdresse"
      :x="adresseMenuPosition.x"
      :y="adresseMenuPosition.y"
      :options="adresseMenuItems"
      :width="240"
      @close="closeAdresseMenu"
      @select="handleAdresseMenuAction"
    />
    <ContextMenu
      v-if="einsatzortMenuEinsatzort"
      :x="einsatzortMenuPosition.x"
      :y="einsatzortMenuPosition.y"
      :options="einsatzortMenuItems"
      :width="220"
      @close="closeEinsatzortMenu"
      @select="handleEinsatzortMenuAction"
    />
    <ContextMenu
      v-if="contactMenuContact"
      :x="contactMenuPosition.x"
      :y="contactMenuPosition.y"
      :options="contactMenuItems"
      :width="220"
      @close="closeContactMenu"
      @select="handleContactMenuAction"
    />
    <ModalFrame
      v-if="showSignatureContactCollapseDialog"
      layer="elevated"
      size="sm"
      title="Signatur-Standard auswählen"
      style="--mf-max-width: min(420px, calc(100vw - 2rem))"
      :show-close="!stundenlisteSettingSaving"
      :close-on-escape="false"
      :close-on-backdrop="!stundenlisteSettingSaving"
      @close="cancelSignatureContactCollapse"
    >
      <div class="signature-contact-collapse-dialog">
        <p>Für diesen Kunden bleibt ein einzelner Signatur-Standard bestehen.</p>
        <label v-for="contact in selectedSignatureContacts" :key="contact.id" class="signature-contact-choice">
          <input v-model="signatureContactCollapseId" type="radio" :value="contact.id" name="signature-contact-collapse" :disabled="stundenlisteSettingSaving" />
          <span>{{ contact.name || contact.email }}</span>
          <small>{{ contact.email }}</small>
        </label>
        <p v-if="stundenlisteSettingError" class="stundenliste-double-copy-error" role="alert">{{ stundenlisteSettingError }}</p>
        <div class="signature-contact-collapse-actions">
          <AppButton size="sm" variant="secondary" :disabled="stundenlisteSettingSaving" @click="cancelSignatureContactCollapse">Abbrechen</AppButton>
          <AppButton size="sm" :loading="stundenlisteSettingSaving" :disabled="!signatureContactCollapseId" @click="confirmSignatureContactCollapse">Übernehmen</AppButton>
        </div>
      </div>
    </ModalFrame>
    </article>
  </ModalFrame>
</template>

<script setup>
import { computed, ref, nextTick, watch, onMounted, onBeforeUnmount, useId } from 'vue';
import { useRouter } from 'vue-router';
import { useCurrentDockedModal } from '@bleck-it/vue-modal-dock';
import { useAuth } from '@/stores/auth';
import { useTheme } from '@/stores/theme';
import { useDataCache } from '@/stores/dataCache';
import ContextMenu from '@/components/ContextMenu.vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import KundenAnalyticsEmbed from '@/components/KundenAnalyticsEmbed.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';
import AdresseFormModal from '@/components/Modals/AdresseFormModal.vue';
import EinsatzortFormModal from '@/components/Modals/EinsatzortFormModal.vue';
import { useAdditionalModals } from '@/composables/useAdditionalModals';
import ContactCard from '@/components/ContactCard.vue';
import EmployeeCardModal from '@/components/Modals/EmployeeCardModal.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppHiddenItemsButton from '@/components/ui-elements/AppHiddenItemsButton.vue';
import AppIconButton from '@/components/ui-elements/AppIconButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
import InformationCard from '@/components/ui-elements/InformationCard.vue';
import CustomerSignaturesPanel from '@/components/customer/CustomerSignaturesPanel.vue';
import EinsatzinformationenEditor from '@/components/customer/EinsatzinformationenEditor.vue';
import CustomerOrderCalendar from '@/components/customer/CustomerOrderCalendar.vue';
import api from '@/utils/api';

const props = defineProps({
  kunde: { type: Object, required: true },
  initialTab: { type: String, default: 'allgemein' },
});

const emit = defineEmits(['close']);

function applyCustomerPatch(update) {
  // This card receives the shared cached customer object; keep sibling views in sync after successful writes.
  // eslint-disable-next-line vue/no-mutating-props
  Object.assign(props.kunde, update);
}

const auth = useAuth();

const tabs = [
  { id: 'allgemein', label: 'Allgemein', icon: 'circle-info' },
  { id: 'rechnung', label: 'Rechnung', icon: 'file-invoice' },
  { id: 'kontakte', label: 'Kontakte', icon: 'address-book' },
  { id: 'einsaetze', label: 'Einsätze', icon: 'calendar-days' },
  { id: 'signatur', label: 'Signatur', icon: 'file-signature' },
  { id: 'einsatzinfos', label: 'Vorlagen', icon: 'envelope-open-text' },
  { id: 'statistik', label: 'Statistik', icon: 'chart-bar' },
  { id: 'einstellungen', label: 'Einstellungen', icon: 'gear' },
];
const customerTabsId = useId();
const customerTabId = (tab) => `${customerTabsId}-tab-${tab}`;
const customerPanelId = `${customerTabsId}-panel`;
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
const visibleTabs = computed(() => tabs.filter((tab) =>
  tab.id !== 'statistik' || canSeeSensitiveKpi.value
));
const normalizeCustomerTab = (tab) => (tab === 'lohn' || tab === 'preise' ? 'rechnung' : tab);
const activeTab = ref(visibleTabs.value.some((tab) => tab.id === normalizeCustomerTab(props.initialTab))
  ? normalizeCustomerTab(props.initialTab) : 'allgemein');

watch(() => props.initialTab, (tab) => {
  const normalized = normalizeCustomerTab(tab);
  if (visibleTabs.value.some((item) => item.id === normalized)) activeTab.value = normalized;
});
watch(canSeeSensitiveKpi, (canSee) => {
  if (!canSee && activeTab.value === 'statistik') activeTab.value = 'allgemein';
});

function navigateCustomerTab(event, currentTab) {
  const key = event.key;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key) || customerWritePending.value
    || showAddQualifikationDialog.value || showSignatureContactCollapseDialog.value) return;
  event.preventDefault();
  const items = visibleTabs.value;
  const current = items.findIndex((tab) => tab.id === currentTab);
  const index = key === 'Home' ? 0 : key === 'End' ? items.length - 1
    : (current + (key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
  activeTab.value = items[index].id;
  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[index]?.focus();
}

const adressen = ref([]);
const adresseDeletingId = ref(null);
const adresseMenuAdresse = ref(null);
const adresseMenuPosition = ref({ x: 0, y: 0 });
const showAdresseFormModal = ref(false);
const adresseFormAdresse = ref(null);
const adresseMenuItems = computed(() => {
  const adresse = adresseMenuAdresse.value;
  const items = [{ action: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] }];
  if (adresse && adresse.art !== 'A') {
    items.push({
      action: 'billing',
      label: adresse.isRechnAdr ? 'Rechnungsanschrift entfernen' : 'Als Rechnungsanschrift festlegen',
      icon: ['fas', 'file-invoice'],
    });
    items.push({
      action: 'postal',
      label: adresse.isPostAdr ? 'Postanschrift entfernen' : 'Als Postanschrift festlegen',
      icon: ['fas', 'envelope'],
    });
  }
  items.push({ action: 'deactivate', label: 'Ausblenden', icon: ['fas', 'trash'], variant: 'danger' });
  return items;
});
const kundenAdressen = computed(() => adressen.value
  .filter((adresse) => adresse.art !== 'A')
  .sort((first, second) => {
    const relevance = (adresse) => (adresse.isRechnAdr ? 0 : adresse.isPostAdr ? 1 : 2);
    return relevance(first) - relevance(second);
  })
);
const ansprechpartner = computed(() => adressen.value.filter((adresse) => adresse.art === 'A'));
const rechnungsanschrift = computed(() => kundenAdressen.value.find((adresse) => adresse.isRechnAdr) || null);
const eRechnungForm = ref({
  leitwegId: props.kunde.leitwegId || '',
  eRechnungFormat: props.kunde.eRechnungFormat || '',
  mwst: props.kunde.mwst ?? null,
});
const eRechnungSaving = ref(false);
const eRechnungError = ref('');
const stundenlisteSignaturDoppelt = ref(props.kunde.stundenlisteSignaturDoppelt === true);
const stundenlisteSignaturDuAnrede = ref(props.kunde.stundenlisteSignaturDuAnrede === true);
const stundenlisteMehrereEinladungen = ref(props.kunde.stundenlisteMehrereEinladungen === true);
const stundenlisteSettingSaving = ref(false);
const stundenlisteSettingError = ref('');

watch(() => [props.kunde.leitwegId, props.kunde.eRechnungFormat, props.kunde.mwst], ([leitwegId, eRechnungFormat, mwst]) => {
  if (eRechnungSaving.value) return;
  eRechnungForm.value = { leitwegId: leitwegId || '', eRechnungFormat: eRechnungFormat || '', mwst: mwst ?? null };
});

watch(() => props.kunde.stundenlisteSignaturDoppelt, (value) => {
  if (!stundenlisteSettingSaving.value) stundenlisteSignaturDoppelt.value = value === true;
});
watch(() => props.kunde.stundenlisteSignaturDuAnrede, (value) => {
  if (!stundenlisteSettingSaving.value) stundenlisteSignaturDuAnrede.value = value === true;
});
watch(() => props.kunde.stundenlisteMehrereEinladungen, (value) => {
  if (!stundenlisteSettingSaving.value) stundenlisteMehrereEinladungen.value = value === true;
});

async function saveStundenlisteSetting() {
  if (stundenlisteSettingSaving.value) return;
  const previousValue = props.kunde.stundenlisteSignaturDoppelt === true;
  const previousDuAnrede = props.kunde.stundenlisteSignaturDuAnrede === true;
  const previousMehrereEinladungen = props.kunde.stundenlisteMehrereEinladungen === true;
  stundenlisteSettingSaving.value = true;
  stundenlisteSettingError.value = '';
  try {
    const { data: updatedKunde } = await api.put(`/api/kunden/${props.kunde._id}`, {
      stundenlisteSignaturDoppelt: stundenlisteSignaturDoppelt.value,
      stundenlisteSignaturDuAnrede: stundenlisteSignaturDuAnrede.value,
      stundenlisteMehrereEinladungen: stundenlisteMehrereEinladungen.value,
    });
    applyCustomerPatch({
      stundenlisteSignaturDoppelt: stundenlisteSignaturDoppelt.value,
      stundenlisteSignaturDuAnrede: stundenlisteSignaturDuAnrede.value,
      stundenlisteMehrereEinladungen: stundenlisteMehrereEinladungen.value,
    });
    await dataCache.updateCachedKunde({ ...props.kunde, ...updatedKunde });
  } catch (error) {
    stundenlisteSignaturDoppelt.value = previousValue;
    stundenlisteSignaturDuAnrede.value = previousDuAnrede;
    stundenlisteMehrereEinladungen.value = previousMehrereEinladungen;
    stundenlisteSettingError.value = error.response?.data?.message || 'Einstellung konnte nicht gespeichert werden.';
  } finally {
    stundenlisteSettingSaving.value = false;
  }
}

function handleMehrereEinladungenChange() {
  if (!stundenlisteMehrereEinladungen.value && signaturKontaktIds.value.length > 1) {
    stundenlisteMehrereEinladungen.value = true;
    signatureContactCollapseId.value = signaturKontaktId.value || signaturKontaktIds.value[0] || '';
    showSignatureContactCollapseDialog.value = true;
    return;
  }
  saveStundenlisteSetting();
}

async function saveERechnungSettings() {
  if (eRechnungSaving.value) return;
  eRechnungSaving.value = true;
  eRechnungError.value = '';
  const update = {
    leitwegId: eRechnungForm.value.leitwegId || null,
    eRechnungFormat: eRechnungForm.value.eRechnungFormat || null,
    mwst: eRechnungForm.value.mwst ?? null,
  };
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, update);
    applyCustomerPatch(update);
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
const remarkError = ref('');
const remarkInputRef = ref(null);

function setRemarkInputRef(instance) {
  if (instance) remarkInputRef.value = instance;
}

function startAddRemark() {
  if (remarksSaving.value) return;
  remarkError.value = '';
  editingRemarkIndex.value = null;
  remarkDraft.value = '';
  nextTick(() => remarkInputRef.value?.focus());
}

function startEditRemark(index) {
  if (remarksSaving.value) return;
  remarkError.value = '';
  editingRemarkIndex.value = index;
  remarkDraft.value = remarks.value[index];
  nextTick(() => remarkInputRef.value?.focus());
}

function cancelRemarkEdit() {
  if (remarksSaving.value) return;
  editingRemarkIndex.value = null;
  remarkDraft.value = null;
  remarkError.value = '';
}

async function persistRemarks(nextRemarks) {
  const bemerkung = nextRemarks.map((remark) => String(remark || '').trim()).filter(Boolean);
  remarksSaving.value = true;
  remarkError.value = '';
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, { bemerkung });
    applyCustomerPatch({ bemerkung });
    const cached = dataCache.kunden?.find((kunde) => kunde._id === props.kunde._id);
    if (cached) cached.bemerkung = bemerkung;
  } catch (error) {
    console.error('Fehler beim Speichern der Bemerkungen:', error);
    remarkError.value = error?.response?.data?.message || 'Die Bemerkungen konnten nicht gespeichert werden.';
    throw error;
  } finally {
    remarksSaving.value = false;
  }
}

async function saveRemark() {
  if (remarksSaving.value) return;
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
  if (remarksSaving.value) return;
  if (!confirm('Bemerkung wirklich löschen?')) return;
  try {
    await persistRemarks(remarks.value.filter((_, remarkIndex) => remarkIndex !== index));
  } catch {}
}

const einsatzorte = ref([]);
const einsatzortSort = ref('name');
const einsatzortSortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'address', label: 'Adresse' },
];
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
    { action: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] },
    { action: 'status', label: einsatzort?.isActive !== false ? 'Deaktivieren' : 'Aktivieren', icon: ['fas', einsatzort?.isActive !== false ? 'eye-slash' : 'eye'] },
    { action: 'delete', label: 'Löschen', icon: ['fas', 'trash'], variant: 'danger' },
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

async function handleEinsatzortMenuAction(action) {
  const einsatzort = einsatzortMenuEinsatzort.value;
  closeEinsatzortMenu();
  if (!einsatzort) return;
  if (action === 'edit') {
    einsatzortFormEinsatzort.value = { ...einsatzort };
    showEinsatzortFormModal.value = true;
    return;
  }
  if (action === 'status') {
    try {
      const { data } = await api.patch(`/api/kunden/${props.kunde.kundenNr}/einsatzorte/${einsatzort._id}/status`, { isActive: einsatzort.isActive === false });
      const index = einsatzorte.value.findIndex((entry) => entry._id === einsatzort._id);
      if (index !== -1) einsatzorte.value[index] = data.einsatzort;
    } catch (error) {
      alert(error.response?.data?.message || 'Der Einsatzortstatus konnte nicht gespeichert werden.');
    }
    return;
  }
  if (action === 'delete' && confirm(`„${einsatzort.bezeichnung}“ wirklich löschen?`)) {
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

function handleAdresseMenuAction(action) {
  const adresse = adresseMenuAdresse.value;
  closeAdresseMenu();
  if (action === 'edit' && adresse) openEditAdresse(adresse);
  if (action === 'billing' && adresse) toggleRechnungsanschrift(adresse);
  if (action === 'postal' && adresse) togglePostanschrift(adresse);
  if (action === 'deactivate' && adresse) deactivateAdresse(adresse);
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
const newPriceQualificationId = ref('');
const newPriceAmount = ref('');
const newPriceValidFrom = ref('');
const newPriceError = ref('');

// Add Qualifikation Dialog
const showAddQualifikationDialog = ref(false);
const addQualifikationId = ref('');
const qualifikationSearchQuery = ref('');
const showQualifikationResults = ref(false);
const addPriceAmount = ref('');
const addPriceValidFrom = ref('');
const addPriceError = ref('');
const addPriceSaving = ref(false);

const filteredPreisQualifikationen = computed(() => {
  const grouped = new Map();
  for (const price of kundenpreise.value) {
    const qualifikation = price.qualifikation;
    if (!qualifikation?._id) continue;
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
    .filter((q) => !assignedIds.has(String(q._id)))
    .sort((first, second) => first.qualificationKey - second.qualificationKey);
});

const matchingQualifikationen = computed(() => {
  const query = qualifikationSearchQuery.value.trim().toLocaleLowerCase('de');
  if (!query) return availableQualifikationen.value;
  return availableQualifikationen.value.filter((qualifikation) =>
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

function openNewPrice(entry) {
  if (preiseSaving.value) return;
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
  if (preiseSaving.value) return;
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
  if (addPriceSaving.value) return;
  showAddQualifikationDialog.value = true;
  addPriceError.value = '';
  try {
    await dataCache.loadQualifikationen();
  } catch (error) {
    addPriceError.value = 'Qualifikationen konnten nicht geladen werden.';
    return;
  }
  addQualifikationId.value = '';
  qualifikationSearchQuery.value = '';
  showQualifikationResults.value = true;
  addPriceAmount.value = '';
  addPriceValidFrom.value = new Date().toISOString().slice(0, 10);
}

function closeAddQualifikationDialog() {
  if (addPriceSaving.value) return;
  resetAddQualifikationDialog();
}

function resetAddQualifikationDialog() {
  showAddQualifikationDialog.value = false;
  addQualifikationId.value = '';
  qualifikationSearchQuery.value = '';
  showQualifikationResults.value = false;
  addPriceAmount.value = '';
  addPriceValidFrom.value = '';
  addPriceError.value = '';
}

function selectAddQualifikation(qualifikation) {
  addQualifikationId.value = String(qualifikation._id);
  qualifikationSearchQuery.value = `${qualifikation.qualificationKey} - ${qualifikation.designation}`;
  showQualifikationResults.value = false;
}

async function saveNewQualifikation() {
  if (addPriceSaving.value) return;
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
    resetAddQualifikationDialog();
    await loadKundenpreise(true);
  } catch (error) {
    addPriceError.value = error.response?.data?.message || 'Die Qualifikation konnte nicht hinzugefügt werden.';
  } finally {
    addPriceSaving.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'rechnung') {
    loadKundenpreise();
    loadKundenkonditionen();
  }
}, { immediate: true });

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
const visibleContacts = computed(() => linkedContacts.value
  .filter((contact) => showInactiveContacts.value || !isMicrosoftContactInactive(contact))
  .sort((first, second) => {
    const relevance = (contact) => String(contact.id) === String(signaturKontaktId.value) ? 0 : 1;
    return relevance(first) - relevance(second);
  })
);

function isMicrosoftContactInactive(contact) {
  return Boolean(contact?.id) && inactiveMicrosoftContactIds.value.has(String(contact.id));
}

onMounted(loadContacts);
watch(() => props.kunde.kuerzel, loadContacts);

// Standard-Signatur-Kontakt
const normalizeSignaturKontaktIds = (kunde) => {
  const ids = Array.isArray(kunde.signaturKontakte) ? kunde.signaturKontakte.map((contact) => String(contact?.id || '').trim()) : [];
  if (kunde.signaturKontaktId) ids.unshift(String(kunde.signaturKontaktId));
  return [...new Set(ids.filter(Boolean))];
};
const signaturKontaktId = ref(props.kunde.signaturKontaktId || '');
const signaturKontaktIds = ref(normalizeSignaturKontaktIds(props.kunde));
const signaturKontaktSaving = ref(false);
const showSignatureContactCollapseDialog = ref(false);
const signatureContactCollapseId = ref('');
const contactMenuContact = ref(null);
const contactMenuPosition = ref({ x: 0, y: 0 });
const contactMenuItems = computed(() => {
  const contact = contactMenuContact.value;
  const isSignatureStandard = isSignaturKontakt(contact);
  return [
    { action: 'edit', label: 'Bearbeiten', icon: ['fas', 'pen'] },
    {
      action: 'signature',
      label: isSignatureStandard ? 'Signatur-Standard entfernen' : 'Als Signatur-Standard setzen',
      icon: ['fas', isSignatureStandard ? 'xmark' : 'file-signature'],
      disabled: signaturKontaktSaving.value,
    },
    {
      action: 'inactive',
      label: isMicrosoftContactInactive(contact) ? 'Wieder anzeigen' : 'Ausblenden',
      icon: ['fas', isMicrosoftContactInactive(contact) ? 'eye' : 'eye-slash'],
      variant: isMicrosoftContactInactive(contact) ? 'primary' : 'danger',
    },
  ];
});

watch(() => props.kunde.signaturKontaktId, (val) => {
  signaturKontaktId.value = val || '';
});
watch(() => props.kunde.signaturKontakte, () => {
  if (!signaturKontaktSaving.value) signaturKontaktIds.value = normalizeSignaturKontaktIds(props.kunde);
}, { deep: true });

const selectedSignatureContacts = computed(() => signaturKontaktIds.value.map((contactId) => {
  const current = linkedContacts.value.find((contact) => String(contact.id) === contactId);
  const stored = (props.kunde.signaturKontakte || []).find((contact) => String(contact.id) === contactId);
  return current
    ? { id: String(current.id), name: current.displayName || '', email: current.emailAddresses?.[0]?.address || '' }
    : { id: contactId, name: stored?.name || '', email: stored?.email || '' };
}));

function isSignaturKontakt(contact) {
  return Boolean(contact?.id) && signaturKontaktIds.value.includes(String(contact.id));
}

function openContactMenu(contact, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  contactMenuContact.value = contact;
  contactMenuPosition.value = { x: rect.right - 220, y: rect.bottom + 4 };
}

function closeContactMenu() {
  contactMenuContact.value = null;
}

function handleContactMenuAction(action) {
  const contact = contactMenuContact.value;
  closeContactMenu();
  if (!contact) return;
  if (action === 'edit') openContactCard(contact, true);
  if (action === 'signature') toggleSignaturKontakt(contact);
  if (action === 'inactive') toggleMicrosoftContactInactive(contact);
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
  if (!wasInactive && isSignaturKontakt(contact)) {
    const nextIds = signaturKontaktIds.value.filter((id) => id !== contactId);
    const nextPrimaryId = nextIds.includes(signaturKontaktId.value) ? signaturKontaktId.value : (nextIds[0] || '');
    const nextPrimary = selectedSignatureContacts.value.find((entry) => entry.id === nextPrimaryId);
    update.signaturKontakte = selectedSignatureContacts.value.filter((entry) => entry.id !== contactId);
    update.signaturKontaktId = nextPrimaryId || null;
    update.signaturKontaktEmail = nextPrimary?.email || null;
  }

  try {
    await api.put(`/api/kunden/${props.kunde._id}`, update);
    applyCustomerPatch(update);
    if (update.signaturKontaktId !== undefined) {
      signaturKontaktIds.value = update.signaturKontakte.map((entry) => entry.id);
      signaturKontaktId.value = update.signaturKontaktId || '';
    }
    const cached = dataCache.kunden?.find((kunde) => kunde._id === props.kunde._id);
    if (cached) Object.assign(cached, update);
  } catch (error) {
    console.error('Fehler beim Ausblenden des Microsoft-Kontakts:', error);
    alert(error.response?.data?.message || 'Der Kontaktstatus konnte nicht gespeichert werden.');
  }
}

async function toggleSignaturKontakt(contact) {
  const contactId = String(contact.id || '');
  const multipleEnabled = props.kunde.stundenlisteMehrereEinladungen === true;
  const newIds = multipleEnabled
    ? (isSignaturKontakt(contact) ? signaturKontaktIds.value.filter((id) => id !== contactId) : [...signaturKontaktIds.value, contactId])
    : (isSignaturKontakt(contact) ? [] : [contactId]);
  const newId = newIds.includes(signaturKontaktId.value) ? signaturKontaktId.value : (newIds[0] || '');
  const contacts = newIds.map((id) => {
    const selected = id === contactId ? contact : linkedContacts.value.find((entry) => String(entry.id) === id);
    return selected && { id, name: selected.displayName || '', email: selected.emailAddresses?.[0]?.address || '' };
  }).filter(Boolean);
  signaturKontaktSaving.value = true;
  try {
    await api.put(`/api/kunden/${props.kunde._id}`, {
      signaturKontaktId: newId || null,
      signaturKontaktEmail: contacts.find((entry) => entry.id === newId)?.email || null,
      signaturKontakte: contacts,
    });
    signaturKontaktIds.value = newIds;
    signaturKontaktId.value = newId;
    applyCustomerPatch({
      signaturKontaktId: newId || null,
      signaturKontaktEmail: contacts.find((entry) => entry.id === newId)?.email || null,
      signaturKontakte: contacts,
    });
    const cached = dataCache.kunden?.find(k => k._id === props.kunde._id);
    if (cached) {
      cached.signaturKontaktId = props.kunde.signaturKontaktId;
      cached.signaturKontaktEmail = props.kunde.signaturKontaktEmail;
      cached.signaturKontakte = contacts;
    }
  } catch (e) {
    // revert on error
    signaturKontaktIds.value = normalizeSignaturKontaktIds(props.kunde);
    signaturKontaktId.value = props.kunde.signaturKontaktId || '';
    console.error('Fehler beim Speichern des Signatur-Kontakts', e);
  } finally {
    signaturKontaktSaving.value = false;
  }
}

function cancelSignatureContactCollapse() {
  if (stundenlisteSettingSaving.value) return;
  dismissSignatureContactCollapse();
}

function dismissSignatureContactCollapse() {
  showSignatureContactCollapseDialog.value = false;
  signatureContactCollapseId.value = '';
}

async function confirmSignatureContactCollapse() {
  if (stundenlisteSettingSaving.value) return;
  const selected = selectedSignatureContacts.value.find((contact) => contact.id === signatureContactCollapseId.value);
  if (!selected) return;
  stundenlisteSettingSaving.value = true;
  stundenlisteSettingError.value = '';
  try {
    const update = {
      stundenlisteMehrereEinladungen: false,
      signaturKontaktId: selected.id,
      signaturKontaktEmail: selected.email || null,
      signaturKontakte: [selected],
    };
    const { data: updatedKunde } = await api.put(`/api/kunden/${props.kunde._id}`, update);
    applyCustomerPatch({ ...update, ...updatedKunde });
    signaturKontaktIds.value = [selected.id];
    signaturKontaktId.value = selected.id;
    stundenlisteMehrereEinladungen.value = false;
    await dataCache.updateCachedKunde({ ...props.kunde });
    dismissSignatureContactCollapse();
  } catch (error) {
    stundenlisteSettingError.value = error.response?.data?.message || 'Einstellung konnte nicht gespeichert werden.';
  } finally {
    stundenlisteSettingSaving.value = false;
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
const { openContact } = useAdditionalModals();
watch(showKontaktAnlegenModal, open => {
  if (!open) return;
  showKontaktAnlegenModal.value = false;
  openContact({ prefilledCompanyName: props.kunde.kuerzel || '' }, onKontaktAngelegt);
});

function onKontaktAngelegt(contact) {
  showKontaktAnlegenModal.value = false;
  msContacts.value.unshift(contact);
}

function openContactCard(contact, editing = false) {
  selectedContactCard.value = { ...contact, editing };
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
const kuerzelError = ref('');
const kuerzelInputRef = ref(null);

function startEditKuerzel() {
  kuerzelError.value = '';
  kuerzelInput.value = props.kunde.kuerzel || '';
  editingKuerzel.value = true;
  nextTick(() => kuerzelInputRef.value?.focus());
}

async function saveKuerzel() {
  if (kuerzelSaving.value) return;
  kuerzelSaving.value = true;
  kuerzelError.value = '';
  try {
    const val = kuerzelInput.value.trim() || null;
    await api.put(`/api/kunden/${props.kunde._id}`, { kuerzel: val });
    // Update in-place in the cache so the list also reflects the change
    const cached = dataCache.kunden.find(k => k._id === props.kunde._id);
    if (cached) cached.kuerzel = val;
    applyCustomerPatch({ kuerzel: val });
    editingKuerzel.value = false;
  } catch (error) {
    kuerzelError.value = error?.response?.data?.message || 'Kürzel konnte nicht gespeichert werden.';
  } finally {
    kuerzelSaving.value = false;
  }
}

function cancelEditKuerzel() {
  if (kuerzelSaving.value) return;
  editingKuerzel.value = false;
  kuerzelError.value = '';
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
  if (!addPriceSaving.value) resetAddQualifikationDialog();
  if (!stundenlisteSettingSaving.value) dismissSignatureContactCollapse();
}

const customerWritePending = computed(() => kuerzelSaving.value || remarksSaving.value || eRechnungSaving.value
  || preiseSaving.value || addPriceSaving.value || stundenlisteSettingSaving.value);

function requestCloseCustomer() {
  if (!customerWritePending.value && !showAddQualifikationDialog.value && !showSignatureContactCollapseDialog.value) emit('close');
}

function handleEscape(event) {
  if (event.key !== 'Escape' || isMinimized.value || !isTopmost.value) return;

  // CustomerCard owns the Escape order while it is the active hosted modal.
  // Capture mode prevents page-level handlers from closing UI underneath it.
  event.preventDefault();
  event.stopImmediatePropagation();

  if (customerWritePending.value) return;

  if (showAddQualifikationDialog.value) {
    closeAddQualifikationDialog();
    return;
  }
  if (showSignatureContactCollapseDialog.value) {
    cancelSignatureContactCollapse();
    return;
  }

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
  if (remarkDraft.value !== null) {
    cancelRemarkEdit();
    return;
  }

  requestCloseCustomer();
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
  color: var(--action-accent-text);
  border-bottom-color: var(--accent, var(--primary));
}

.customer-tab:focus-visible {
  outline: 2px solid var(--control-focus-ring);
  outline-offset: -2px;
}

.customer-tab:disabled { cursor: not-allowed; opacity: .65; }

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
  color: var(--action-accent-text);
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
  --app-button-background: color-mix(in srgb, var(--primary) 12%, transparent);
  --app-button-color: var(--action-accent-text);
  min-height: 26px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.kuerzel-add-btn {
  gap: 4px;
  min-height: 26px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border-style: dashed;
}

.kuerzel-edit-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kuerzel-input {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  width: 90px;
  min-height: 26px;
}

.kuerzel-save-btn,
.kuerzel-cancel-btn {
  --app-button-icon-size: 26px;
  min-height: 26px;
  border-radius: 4px;
  font-size: 12px;
}

.kuerzel-error { color: var(--status-danger-text); font-size: 0.74rem; }

.kunden-nr {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
}

.name {
  margin: 0;
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
.status-active { background: color-mix(in srgb, var(--status-success-text) 15%, transparent); color: var(--status-success-text); }
.status-inactive { background: var(--hover); color: var(--text); }
.status-lead { background: color-mix(in srgb, var(--status-warning-text) 15%, transparent); color: var(--status-warning-text); }

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
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
  order: -1;
}

.kundenpreise-section__prices {
  order: 1;
}

.kundenpreise-section__conditions {
  order: 2;
}

.rechnung-section {
  flex: 0 0 auto;
}

.kundenpreise-section__conditions {
  margin-top: 28px;
  padding-top: 20px;
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
  color: var(--action-accent-text);
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

.preise-add-btn-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
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

.preise-new-form input { min-height: 34px; }

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

.preise-form-error {
  align-self: center;
  margin: 0;
  color: var(--status-danger-text);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--status-danger-text) 30%, var(--border));
  background: color-mix(in srgb, var(--status-danger-text) 8%, var(--surface));
  color: var(--status-danger-text);
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

.search-select-option:focus-visible,
.top-ma-einsatz-row:focus-visible,
.address-map-link:focus-visible {
  outline: 2px solid var(--control-focus-ring);
  outline-offset: 2px;
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
  
  > svg { color: var(--muted); }
}

.section-action-btn--push { margin-left: auto; }

.customer-settings-section { display: grid; gap: .45rem; max-width: 500px; }
.customer-settings-section .section-title { margin-bottom: 0; }
.customer-settings-group { display: grid; gap: .4rem; padding: .55rem .65rem; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); }
.customer-settings-group h5 { display: flex; align-items: center; gap: .4rem; margin: 0; font-size: .76rem; color: var(--text); }
.customer-settings-group h5 svg { color: var(--primary); }
.stundenliste-double-copy-toggle { display: flex; align-items: center; gap: .55rem; color: var(--text); cursor: pointer; }
.stundenliste-double-copy-toggle input { width: 1rem; height: 1rem; accent-color: var(--primary); }
.stundenliste-double-copy-toggle > span { display: grid; gap: .1rem; flex: 1; }
.stundenliste-double-copy-toggle strong { font-size: .86rem; }
.stundenliste-double-copy-toggle small { color: var(--muted); font-size: .76rem; }
.stundenliste-double-copy-toggle > svg { color: var(--primary); }
.stundenliste-double-copy-toggle:has(input:disabled) { cursor: wait; opacity: .75; }
.stundenliste-double-copy-error { margin: 0; color: var(--status-danger-text); font-size: .8rem; }
.signature-contact-collapse-dialog { display: grid; gap: .65rem; }
.signature-contact-collapse-dialog > p:first-child { margin: 0; color: var(--muted); font-size: .86rem; }
.signature-contact-choice { display: grid; grid-template-columns: auto 1fr; column-gap: .55rem; align-items: center; padding: .45rem .5rem; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
.signature-contact-choice input { grid-row: span 2; accent-color: var(--primary); }
.signature-contact-choice span { color: var(--text); font-size: .88rem; }
.signature-contact-choice small { color: var(--muted); font-size: .78rem; }
.signature-contact-collapse-actions { display: flex; justify-content: flex-end; gap: .5rem; }

.address-sort { flex-shrink: 0; }

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

.erechnung-settings :is(input, select) {
  width: 100%;
  min-width: 0;
  min-height: 34px;
}

.erechnung-save-btn {
  min-height: 34px;
}

.erechnung-error {
  color: var(--status-danger-text);
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
  color: var(--text);
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
  color: var(--action-accent-text);
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
    min-height: 30px;
    padding: 7px 9px;
    border-radius: 5px;
    font-size: 13px;
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
  --app-button-icon-size: 26px;
  min-height: 26px;
  border-radius: 5px;
}

.remark-error { margin: 0 0 8px; color: var(--status-danger-text); font-size: 0.82rem; }

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
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--hover);
  color: var(--text);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.address-branche {
  font-size: 11px;
  color: var(--muted);
}

.address-menu-btn {
  --app-button-icon-size: 26px;
  min-height: 26px;
  flex: 0 0 auto;
  transform: translate(4px, -5px);
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
  color: var(--action-accent-text) !important;
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
  position: relative;
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

.contact-card--signature-standard {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
}

.sig-standard-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  position: absolute;
  top: -11px;
  right: 12px;
  padding: 3px 6px;
  border-radius: 4px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
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
  --app-button-icon-size: 26px;
  min-height: 26px;
  flex: 0 0 auto;
  margin: -5px -5px 0 0;
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
  
  a { color: var(--action-accent-text); text-decoration: none; }
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
  color: var(--action-accent-text);
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
  color: var(--action-accent-text);
  min-width: 24px;
}

.top-ma-name {
  flex: 1;
  justify-content: flex-start;
  min-height: 24px;
  padding: 0 2px;
  text-align: left;
}

.top-ma-expand-btn {
  --app-button-icon-size: 26px;
  min-height: 26px;
  flex-shrink: 0;
  font-size: 10px;
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
  color: var(--action-accent-text);
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
  align-self: flex-start;
}

</style>
