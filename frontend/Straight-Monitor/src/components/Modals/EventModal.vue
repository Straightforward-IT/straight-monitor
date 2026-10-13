<template>
  <ModalFrame
    :model-value="true"
    :title="modalTitle"
    :subtitle="creating ? 'Neuer Auftrag' : `${draft.customer?.kundName || 'Auftrag'} · ${dateLabel(order.day)}`"
    size="xl"
    :minimizable="minimizable"
    :minimize-id="minimizeId"
    :minimize-title="minimizeTitle || modalTitle"
    :close-on-escape="closeOnEscape"
    :layer="layer"
    class="auftrag-editor-frame"
    style="--mf-max-width: min(1280px, 96vw); --mf-max-height: 94dvh; --mf-body-padding: 0; --mf-body-overflow: hidden"
    @close="requestClose"
  >
    <template #actions>
      <span v-if="!creating" class="order-status">{{ order.auftStatus === 2 ? 'Bestätigt' : 'Entwurf' }}</span>
    </template>
    <div class="auftrag-editor">
      <AppTabs v-model="activeTab" :tabs="tabs" :id-prefix="tabPrefix" label="Auftrag bearbeiten" size="sm" scroll-controls />
      <main class="editor-body" :aria-busy="loading || busy">
        <LoadingSpinner v-if="loading" label="Auftrag wird geladen …" />
        <p v-if="error" class="feedback feedback--error" role="alert">{{ error }}</p>
        <p v-if="notice" class="feedback" role="status">{{ notice }}</p>
        <div v-if="!loading && (linked || creating && dates.length > 1)" class="day-navigation">
          <label v-if="creating">Tag planen
            <AppSelect :model-value="activeDay" :disabled="pending" @update:model-value="selectDay">
              <option v-for="day in dates" :key="day" :value="day">{{ dateLabel(day) }}</option>
            </AppSelect>
          </label>
          <label v-else>Verknüpfter Auftrag
            <AppSelect :model-value="String(order.auftragNr)" :disabled="pending" @update:model-value="switchOrder">
              <option v-for="member in members" :key="member.auftragNr" :value="String(member.auftragNr)">{{ dateLabel(member.day || member.startingDay || member.vonDatum) }} · #{{ member.auftragNr }}</option>
            </AppSelect>
          </label>
          <AppButton v-if="nextCursor" variant="ghost" size="sm" :disabled="pending" @click="load(order.auftragNr, nextCursor)">Weitere Tage laden</AppButton>
          <span>Gemeinsame Änderungen gelten für alle erbenden Tage. Personal bleibt tagesspezifisch.</span>
        </div>

        <section v-if="!loading && activeTab === 'order'" :id="panelId('order')" role="tabpanel" :aria-labelledby="`${tabPrefix}-order`">
          <header class="section-heading"><h3>Auftragsdaten</h3><span>Kontext, Bestellung und Einsatzort</span></header>
          <fieldset :disabled="pending">
            <div class="context-grid">
              <article class="editor-card">
                <h4>Auftrag & Kunde</h4>
                <label class="field">Titel <AppTextInput :model-value="order.eventTitel" aria-label="Auftragstitel" @update:model-value="setOrder('eventTitel', $event.trim())" /></label>
                <label class="field">Standort
                  <AppSelect :model-value="order.locationV2" :disabled="!creating && order.auftStatus === 2" aria-label="Standort" @update:model-value="setOrder('locationV2', $event)">
                    <option value="">Standort wählen</option><option v-for="location in locations" :key="location._id" :value="location._id">{{ location.shortName || location.nameFull }}</option>
                  </AppSelect>
                </label>
                <div class="field">
                  <span>Kunde {{ creating ? '*' : '· fest zugeordnet' }}</span>
                  <KundeSearch v-if="creating" v-model="draft.customer" :location-v2="order.locationV2 || null" :disabled="pending" input-id="auftrag-editor-kunde" @select="selectCustomer" />
                  <div v-else class="fixed-customer"><strong>{{ draft.customer?.kundName || `Kunde ${order.kundenNr || 'fehlt'}` }}</strong><small>Nach Erstellung nicht änderbar</small></div>
                </div>
                <div class="form-row">
                  <label class="field">Bestelldatum <AppTextInput :model-value="order.bestDatum" type="date" @update:model-value="setOrder('bestDatum', $event)" /></label>
                  <label class="field">Referenz <AppTextInput :model-value="order.referenz" placeholder="Bestellung / PO" @update:model-value="setOrder('referenz', $event.trim())" /></label>
                </div>
              </article>
              <article class="editor-card">
                <h4>Startdatum</h4>
                <template v-if="creating">
                  <div class="chip-row">
                    <FilterChip :active="!multiDay" :disabled="pending" @click="useSingleDay">Ein Tag</FilterChip>
                    <FilterChip :active="multiDay" :disabled="pending" @click="multiDay = true">Mehrere Tage</FilterChip>
                  </div>
                  <label v-if="!multiDay" class="field">Auftragstag <AppTextInput :model-value="dates[0]" type="date" @update:model-value="setSingleDay" /></label>
                  <template v-else>
                    <p class="muted">Ein eigener Auftrag je ausgewähltem Startdatum. Auch nicht aufeinanderfolgende Tage sind möglich.</p>
                    <div class="date-add"><AppTextInput v-model="dateDraft" type="date" aria-label="Weiteres Startdatum" /><AppButton variant="secondary" :disabled="!dateDraft" @click="addDate">Tag hinzufügen</AppButton></div>
                    <ul class="selected-dates"><li v-for="day in dates" :key="day"><span>{{ dateLabel(day) }}</span><AppButton variant="ghost" size="sm" :disabled="dates.length === 1" :aria-label="`${dateLabel(day)} entfernen`" @click="removeDate(day)">Entfernen</AppButton></li></ul>
                  </template>
                </template>
                <template v-else><strong>{{ dateLabel(order.day) }}</strong><p class="muted">Der Auftrag gehört zum Starttag. Eine Schicht darf nach Mitternacht enden.</p></template>
              </article>
            </div>
            <AuftragSiteSelection v-if="!creating" :order="order" :sites="sites" :linked="linked" :disabled="pending" @select="setOrder('einsatzort', $event)" @scope="model.toggleOrderOverride('einsatzort')" @saved="siteSaved" />
            <article class="editor-card bestellung">
              <div class="card-heading"><h4>Bestellung</h4><FilterChip v-if="linked" :active="order.bestelltextOverride" @click="model.toggleOrderOverride('bestelltext')">{{ order.bestelltextOverride ? 'Nur dieser Tag' : 'Gemeinsam' }}</FilterChip></div>
              <label class="field">Bestellungstext (optional)<AppTextarea :model-value="order.bestelltext" rows="4" placeholder="Was wurde bestellt? Angaben aus E-Mail oder Telefonat …" @update:model-value="setOrder('bestelltext', $event)" /></label>
              <div v-if="linked" class="chip-row"><FilterChip :active="fileTarget === 'group'" @click="fileTarget = 'group'">Anlagen für alle Tage</FilterChip><FilterChip :active="fileTarget === 'order'" @click="fileTarget = 'order'">Anlagen nur für diesen Tag</FilterChip></div>
              <AppFileDropzone label="Bestelldokumente" prompt="Bestelldokumente hinzufügen" hint="Mehrere Dateien möglich · maximal 30 MB je Datei · intern sichtbar" multiple :disabled="pending" @select="queueFiles($event, linked ? fileTarget : 'order')" />
              <ul v-if="files.length" class="file-list"><li v-for="file in files" :key="file.id"><div><strong>{{ file.file?.name || file.filename }}</strong><small>{{ file.target === 'group' ? 'Alle verknüpften Tage' : dateLabel(file.day || drafts[file.dayKey]?.order.day) }} · {{ fileStatus(file.status) }}</small><span v-if="file.error" class="error-text">{{ file.error }}</span></div><AppButton v-if="file.status === 'pending'" size="sm" variant="ghost" :disabled="pending" @click="files.splice(files.indexOf(file), 1)">Entfernen</AppButton></li></ul>
              <OrderDocuments v-if="order.auftragNr" :key="documentRefresh" :auftrag-nr="order.auftragNr" :allow-upload="false" compact />
            </article>
          </fieldset>
        </section>

        <section v-if="!loading && activeTab === 'site'" :id="panelId('site')" role="tabpanel" :aria-labelledby="`${tabPrefix}-site`"><AuftragSiteSelection :order="order" :sites="sites" :linked="linked" :disabled="pending" @select="setOrder('einsatzort', $event)" @scope="model.toggleOrderOverride('einsatzort')" @saved="siteSaved" /></section>

        <section v-if="!loading && activeTab === 'planning'" :id="panelId('planning')" role="tabpanel" :aria-labelledby="`${tabPrefix}-planning`">
          <header class="section-heading"><div><h3>Schichten & Personal</h3><span>{{ dateLabel(order.day) }} · {{ totalAssigned }} / {{ totalDemand }} eingeplant</span></div><AppButton :disabled="pending" @click="createShift()">Schicht hinzufügen</AppButton></header>
          <div v-if="linked" class="chip-row"><FilterChip :active="!newShiftDayOnly" :disabled="pending" @click="newShiftDayOnly = false">Neue Schicht gemeinsam</FilterChip><FilterChip :active="newShiftDayOnly" :disabled="pending" @click="newShiftDayOnly = true">Neue Schicht nur für diesen Tag</FilterChip></div>
          <p v-if="!order.einsatzort" class="feedback">Für die Planung einen Einsatzort unter <AppButton variant="ghost" size="sm" @click="activeTab = creating ? 'site' : 'order'">Auftragsdaten</AppButton> auswählen oder speichern.</p>
          <div v-if="patterns.length" class="pattern-row"><small>Letzte Schichten</small><AppButton v-for="pattern in patterns.slice(0, 6)" :key="pattern._id" variant="ghost" size="sm" :disabled="pending" @click="createShift(pattern)">{{ pattern.bezeichnung }} · {{ pattern.uhrzeitVon }}</AppButton></div>
          <div v-if="shifts.length" class="planning-layout">
            <aside class="shift-list" aria-label="Schichtauswahl">
              <button v-for="shift in shifts" :key="shift.clientId" type="button" :class="{ selected: selectedShift?.clientId === shift.clientId }" :disabled="pending" @click="selectShift(shift)" @dragover.prevent @drop.prevent="dropOnShift(shift)">
                <strong>{{ shift.bezeichnung || 'Neue Schicht' }}</strong><span>{{ shift.uhrzeitVon || '–' }}–{{ shift.uhrzeitBis || '–' }}{{ shift.datumBis > shift.datumVon ? ` · bis ${dateLabel(shift.datumBis)}` : '' }}</span><small>{{ assignmentsFor(shift).length }} / {{ shift.bedarf || 0 }} eingeplant</small>
              </button>
            </aside>
            <div v-if="selectedShift" class="shift-details editor-card">
              <div class="card-heading"><h4>Schicht bearbeiten</h4><div><AppButton variant="ghost" size="sm" :disabled="pending" @click="duplicateShift">Duplizieren</AppButton><AppButton variant="danger" size="sm" :disabled="pending" @click="deleteShiftConfirm = true">Löschen</AppButton></div></div>
              <fieldset :disabled="pending">
                <div class="field"><ScopeLabel field="bezeichnung" text="Bezeichnung" /><AppTextInput :model-value="selectedShift.bezeichnung" aria-label="Schichtbezeichnung" @update:model-value="editShift('bezeichnung', $event)" /></div>
                <div class="form-row"><div class="field"><ScopeLabel field="uhrzeitVon" text="Von" /><AppTextInput :model-value="selectedShift.uhrzeitVon" type="time" aria-label="Schichtbeginn" @update:model-value="editShift('uhrzeitVon', $event)" /></div><div class="field"><ScopeLabel field="uhrzeitBis" text="Bis" /><AppTextInput :model-value="selectedShift.uhrzeitBis" type="time" aria-label="Schichtende" @update:model-value="editShift('uhrzeitBis', $event)" /></div></div>
                <div class="form-row"><div class="field"><ScopeLabel field="datumBis" text="Enddatum" /><AppTextInput :model-value="selectedShift.datumBis" type="date" aria-label="Schicht-Enddatum" :min="selectedShift.datumVon" @update:model-value="editShift('datumBis', $event)" /></div><div class="field"><ScopeLabel field="bedarf" text="Bedarf" /><AppTextInput :model-value="selectedShift.bedarf" type="number" aria-label="Personalbedarf" min="0" @update:model-value="editShift('bedarf', $event)" /></div></div>
                <div class="form-row"><div class="field"><ScopeLabel field="berufSchl" text="Beruf" /><AppSelect :model-value="selectedShift.berufSchl" aria-label="Beruf" @update:model-value="editShift('berufSchl', $event)"><option value="">Kein Beruf</option><option v-for="job in jobs" :key="job._id" :value="String(job.jobKey)">{{ job.designation }}</option></AppSelect></div><div class="field"><ScopeLabel field="qualSchl" text="Qualifikation" /><AppSelect :model-value="selectedShift.qualSchl" aria-label="Qualifikation" @update:model-value="editShift('qualSchl', $event)"><option value="">Keine Qualifikation</option><option v-for="qualification in qualifications" :key="qualification._id" :value="String(qualification.qualificationKey)">{{ qualification.designation }}</option></AppSelect></div></div>
                <label class="field">Garantiestunden {{ linked ? '· nur dieser Tag' : '' }} <AppTextInput :model-value="selectedShift.garantiestundenLohn" type="number" min="0" step="0.25" @update:model-value="editLocalShift(selectedShift, 'garantiestundenLohn', $event)" /></label>
                <details class="shift-extra"><summary>Treffpunkt & Ansprechpartner</summary>
                  <div class="form-row"><div class="field"><ScopeLabel field="treffpunkt" text="Treffpunktzeit" /><AppTextInput :model-value="selectedShift.treffpunkt" type="time" aria-label="Treffpunktzeit" @update:model-value="editShift('treffpunkt', $event)" /></div><div class="field"><ScopeLabel field="treffpunktOrt" text="Treffpunkt" /><AppTextInput :model-value="selectedShift.treffpunktOrt" aria-label="Treffpunkt-Ort" @update:model-value="editShift('treffpunktOrt', $event)" /></div></div>
                  <div v-for="field in contactFields" :key="field.key" class="field"><ScopeLabel :field="field.key" :text="field.label" /><AppTextInput :model-value="selectedShift[field.key]" :aria-label="field.label" :type="field.type || 'text'" @update:model-value="editShift(field.key, $event)" /></div>
                </details>
                <details class="shift-extra"><summary>Einsatzinformationen <small v-if="selectedShift.einsatzinformation?.templateVersion">· Snapshot V{{ selectedShift.einsatzinformation.templateVersion }}</small><small v-if="selectedShift.infoUnresolved.length"> · {{ selectedShift.infoUnresolved.length }} offene Textmarken</small></summary>
                  <p v-if="linked" class="muted">Manuelle Texte und ausdrücklich ersetzte Snapshots gelten nur für diesen Tag.</p>
                  <AppButton size="sm" variant="secondary" :disabled="pending || !order.kundenNr" @click="templateConfirm = true">Aktuelle passende Vorlage übernehmen</AppButton>
                  <RichTextTemplateEditor :key="selectedShift.clientId" :model-value="selectedShift.einsatzinformationSourceHtml" :disabled="pending" :textmarks="textmarks" :preview-html="selectedShift.infoPreview" :unresolved="selectedShift.infoUnresolved" @update:model-value="setInformation" @change="previewInformation" />
                </details>
              </fieldset>
            </div>
            <section v-if="selectedShift" class="personnel editor-card" aria-label="Personal für die ausgewählte Schicht">
              <div class="card-heading"><h4>Personal</h4><strong>{{ assignmentsFor(selectedShift).length }} / {{ selectedShift.bedarf || 0 }}</strong></div>
              <p class="muted">Einplanungen werden vorgemerkt und erst nach der Prüfung gespeichert.</p>
              <ul class="assignments"><li v-for="assignment in assignmentsFor(selectedShift)" :key="assignment._id || assignment.clientId"><div><strong>{{ employeeName(assignment) }}</strong><small>{{ assignment.type === 'assign' ? 'Vorgemerkt' : 'Eingeplant' }}</small></div><AppButton variant="ghost" size="sm" :disabled="pending" @click="removeAssignment(assignment)">Entfernen</AppButton></li></ul>
              <FilterChip :active="includeOtherLocations" :disabled="pending" @click="includeOtherLocations = !includeOtherLocations; loadCandidates()">Weitere freigegebene Standorte</FilterChip>
              <div class="candidate-filter"><FilterChip v-for="filter in candidateFilters" :key="filter.id" :active="candidateFilter === filter.id" :disabled="pending" @click="candidateFilter = filter.id">{{ filter.label }} {{ candidates.filter(candidate => candidate.status === filter.id).length }}</FilterChip></div>
              <AppButton v-if="selectedCandidateIds.size" variant="secondary" size="sm" :disabled="pending" @click="assignSelected">{{ selectedCandidateIds.size }} ausgewählte einplanen</AppButton>
              <LoadingSpinner v-if="candidateLoading" label="Personal wird geprüft …" />
              <div v-else class="candidate-list">
                <article v-for="candidate in filteredCandidates" :key="candidate._id" class="candidate" :class="candidate.status" :draggable="!pending" @dragstart="dragCandidateId = candidate._id">
                  <input type="checkbox" :aria-label="`${candidate.vorname} ${candidate.nachname} auswählen`" :checked="selectedCandidateIds.has(candidate._id)" :disabled="pending" @change="toggleCandidate(candidate._id)" />
                  <div><strong>{{ candidate.vorname }} {{ candidate.nachname }}</strong><small>{{ [...(candidate.reasons || []), ...(candidate.warnings || []), ...(candidate.conflicts || []).map(item => item.label)].join(' · ') }}</small></div>
                  <AppButton variant="ghost" size="sm" :disabled="pending" @click="assign(candidate)">Einplanen</AppButton>
                </article>
                <p v-if="!filteredCandidates.length" class="muted">Keine Mitarbeitenden in dieser Auswahl.</p>
              </div>
              <AppButton variant="ghost" size="sm" :disabled="pending || candidateLoading" @click="loadCandidates">Vorschläge aktualisieren</AppButton>
            </section>
          </div>
          <AppButton v-else variant="outlined" :disabled="pending" @click="createShift()">Erste Schicht anlegen</AppButton>
        </section>

        <section v-if="!loading && activeTab === 'review'" :id="panelId('review')" role="tabpanel" :aria-labelledby="`${tabPrefix}-review`">
          <header class="section-heading"><h3>{{ creating ? 'Prüfen & erstellen' : 'Änderungen prüfen' }}</h3><span>Erst nach Bestätigung werden Auftrag, Schichten und Personal gespeichert.</span></header>
          <article class="editor-card"><h4>{{ creating ? `${dates.length} Auftrag${dates.length === 1 ? '' : 'e'} erstellen` : 'Betroffene Aufträge' }}</h4><p>{{ draft.customer?.kundName }} · {{ order.eventTitel }}</p><p v-if="creating">{{ dates.map(dateLabel).join(' · ') }}</p><p v-else-if="linked" class="muted">Gemeinsame Änderungen betreffen alle erbenden Tage, auch bereits bestätigte Aufträge. Tagesspezifische Werte bleiben erhalten.</p><p>{{ totalDemand - totalAssigned > 0 ? `${totalDemand - totalAssigned} offene Positionen – Freigabe trotzdem möglich` : 'Bedarf gedeckt' }}</p></article>
          <LoadingSpinner v-if="reviewLoading" label="Auswirkungen auf verknüpfte Aufträge werden geprüft …" />
          <p v-if="reviewError" class="feedback feedback--error" role="alert">{{ reviewError }} <AppButton variant="ghost" size="sm" :disabled="reviewLoading || pending" @click="loadReview()">Erneut prüfen</AppButton></p>
          <p v-if="serverReview" class="muted">{{ serverReview.totalAffected }} betroffene Aufträge · {{ reviewDays.length }} angezeigt</p>
          <article v-for="day in reviewDays" :key="day.key || day.auftragNr || day.day" class="editor-card review-changes"><div class="card-heading"><h4>{{ dateLabel(day.day) }}{{ day.auftragNr ? ` · #${day.auftragNr}` : '' }}</h4><AppButton variant="ghost" size="sm" :disabled="pending" @click="goToChanges(day)">Bearbeiten</AppButton></div><dl><div v-for="(change, index) in day.changes" :key="change.key || `${change.label}-${index}`"><dt>{{ change.label }}</dt><dd><span>{{ changeValue(change.before) }}</span><span aria-hidden="true">→</span><strong>{{ changeValue(change.after) }}</strong></dd></div></dl></article>
          <AppButton v-if="serverReview?.nextCursor" variant="secondary" :disabled="reviewLoading || pending" @click="loadReview(serverReview.nextCursor)">Weitere betroffene Tage anzeigen</AppButton>
          <p v-if="!reviewDays.length && !creating && !reviewLoading && !reviewError" class="feedback">Keine Feld- oder Personaländerungen vorgemerkt.</p>
          <article v-if="files.length" class="editor-card"><h4>Anlagen</h4><ul class="file-list"><li v-for="file in files" :key="file.id"><div><strong>{{ file.file?.name || file.filename }}</strong><small>{{ file.target === 'group' ? 'Alle Tage' : dateLabel(file.day || drafts[file.dayKey]?.order.day) }} · {{ fileStatus(file.status) }}</small><span v-if="file.error" class="error-text">{{ file.error }}</span><AppFileDropzone v-if="!file.file && file.status !== 'completed'" :label="`${file.filename} erneut auswählen`" prompt="Originaldatei erneut auswählen" :disabled="busy" @select="model.restoreFile(file, $event)" /></div></li></ul></article>
          <p v-for="site in savedSites" :key="site._id" class="feedback">Einsatzort „{{ site.bezeichnung }}“ bereits als Kundenstammdaten gespeichert. Die Auftragszuordnung wird erst bei der Übernahme gespeichert.</p>
          <ul v-if="validation.length" class="feedback feedback--error"><li v-for="message in validation" :key="message">{{ message }}</li></ul>
          <article v-if="progress" class="editor-card" role="status"><h4>{{ progress.status === 'completed' ? 'Aufträge gespeichert · Anlagen abschließen' : 'Vorgang läuft / ist unvollständig' }}</h4><p>{{ progress.completed }} / {{ progress.total }} Tage gespeichert</p><p v-if="progress.failedDays?.length">Fehlgeschlagen: {{ progress.failedDays.join(', ') }}</p><p v-if="progress.pendingDays?.length">Ausstehend: {{ progress.pendingDays.join(', ') }}</p><p class="muted">Bereits gespeicherte Tage bleiben erhalten. Erneut versuchen setzt nur ausstehende Arbeiten fort.</p></article>
          <div v-if="!creating && order.auftStatus !== 2 && !dirty && !pending" class="release"><strong>Auftrag ist ein Entwurf</strong><AppButton :loading="releasing" @click="release">Auftrag freigeben</AppButton></div>
        </section>
      </main>
      <footer class="editor-footer">
        <AppButton variant="ghost" :disabled="busy || releasing" @click="requestClose">Schließen</AppButton>
        <span role="status">{{ busy ? 'Wird übernommen …' : pending ? 'Vorgang unvollständig' : dirty ? 'Ungespeicherte Änderungen' : 'Gespeicherter Stand' }}</span>
        <AppButton v-if="creating && activeTab !== 'review'" :disabled="pending" @click="nextStage">Weiter</AppButton>
        <AppButton v-else-if="activeTab !== 'review'" :disabled="busy || releasing" @click="activeTab = 'review'">Änderungen prüfen</AppButton>
        <AppButton v-else :loading="busy" :disabled="releasing || progress?.canResume === false || !pending && (validation.length > 0 || !dirty && !creating || !reviewReady)" @click="confirmSubmission">{{ progress?.canResume === false ? 'Anderer Bearbeiter übernimmt' : pending ? 'Ausstehende Arbeiten erneut versuchen' : creating ? dates.length === 1 ? 'Auftrag erstellen' : 'Aufträge erstellen' : 'Änderungen übernehmen' }}</AppButton>
      </footer>
      <div v-if="confirmClose || deleteShiftConfirm || templateConfirm || conflictCandidate" class="confirm-overlay">
        <section ref="confirmCard" class="editor-card confirm-card" role="alertdialog" aria-modal="true" tabindex="-1" :aria-labelledby="`${tabPrefix}-confirm`" @keydown.escape.stop.prevent="cancelConfirmation">
          <h3 :id="`${tabPrefix}-confirm`">{{ confirmClose ? 'Änderungen verwerfen?' : deleteShiftConfirm ? 'Schicht löschen?' : templateConfirm ? 'Gespeicherten Snapshot ersetzen?' : 'Planungskonflikt bestätigen' }}</h3>
          <p>{{ confirmClose ? 'Vorgemerkte Felder, Einplanungen und nicht hochgeladene Anlagen gehen verloren. Gespeicherte Einsatzorte bleiben erhalten.' : deleteShiftConfirm ? 'Schicht und zugehörige Einplanungen werden zur Löschung vorgemerkt. Die Prüfung zeigt die Auswirkungen vor dem Speichern.' : templateConfirm ? 'Die aktuelle passende Vorlage ersetzt den Informationstext als vorgemerkte Änderung.' : conflictCandidate.conflicts.map(item => item.label).join(' · ') }}</p>
          <label v-if="conflictCandidate" class="field">Begründung <AppTextarea v-model.trim="conflictReason" rows="3" /></label>
          <div v-if="deleteShiftConfirm && linked" class="chip-row"><FilterChip :active="!deleteDayOnly" @click="deleteDayOnly = false">Alle verknüpften Tage</FilterChip><FilterChip :active="deleteDayOnly" @click="deleteDayOnly = true">Nur dieser Tag</FilterChip></div>
          <div class="confirm-actions"><AppButton variant="secondary" @click="cancelConfirmation">Weiter bearbeiten</AppButton><AppButton :variant="conflictCandidate || templateConfirm ? 'primary' : 'danger'" :disabled="Boolean(conflictCandidate && !conflictReason)" @click="runConfirmation">{{ confirmClose ? 'Verwerfen' : deleteShiftConfirm ? 'Löschen vormerken' : templateConfirm ? 'Vorlage übernehmen' : 'Konflikt bestätigen & vormerken' }}</AppButton></div>
        </section>
      </div>
    </div>
  </ModalFrame>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AuftragSiteSelection from '@/components/orders/AuftragSiteSelection.vue';
import AppTabs from '@/components/ui-elements/AppTabs.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import AppSelect from '@/components/ui-elements/AppSelect.vue';
import AppTextarea from '@/components/ui-elements/AppTextarea.vue';
import AppFileDropzone from '@/components/ui-elements/AppFileDropzone.vue';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import KundeSearch from '@/components/ui-elements/KundeSearch.vue';
import LoadingSpinner from '@/components/ui-elements/LoadingSpinner.vue';
import OrderDocuments from '@/components/ui-elements/OrderDocuments.vue';
import RichTextTemplateEditor from '@/components/ui-elements/RichTextTemplateEditor.vue';
import { useAuth } from '@/stores/auth';
import { editorDay, scopeField, shiftDto, useAuftragEditor } from '@/composables/useAuftragEditor';
import api from '@/utils/api';

const props = defineProps({
  auftragNr: { type: [String, Number], default: null }, initialLocationV2: { type: String, default: '' },
  minimizable: { type: Boolean, default: true }, minimizeId: { type: String, default: '' },
  minimizeTitle: { type: String, default: '' }, closeOnEscape: { type: Boolean, default: false }, layer: { type: String, default: 'base' },
});
const emit = defineEmits(['close', 'updated']);
const auth = useAuth();
const model = useAuftragEditor({ auftragNr: props.auftragNr, locationV2: props.initialLocationV2 || String(auth.user?.locationV2?._id || auth.user?.locationV2 || ''), onUpdated: row => emit('updated', row) });
const { creating, drafts, draft, order, shifts, dates, activeDay, multiDay, group, members, nextCursor, loading, busy, error, notice, progress, files, savedSites, dirty, pending, linked, validation, changesByDay, load, setOrder, setShift, toggleOverride, addShift, assignmentsFor, stageAssignment, removeAssignment, queueFiles } = model;
const activeTab = ref(props.auftragNr ? 'planning' : 'order');
const tabPrefix = `auftrag-editor-${props.minimizeId || crypto.randomUUID()}`;
const panelId = id => `${tabPrefix}-panel-${id}`;
const tabs = computed(() => (creating.value
  ? [{ id: 'order', label: '1 · Auftrag' }, { id: 'site', label: '2 · Einsatzort' }, { id: 'planning', label: '3 · Schichten & Personal' }, { id: 'review', label: '4 · Prüfen' }]
  : [{ id: 'planning', label: 'Schichten & Personal' }, { id: 'order', label: 'Auftragsdaten' }, { id: 'review', label: 'Prüfen' }]
).map(tab => ({ ...tab, panelId: panelId(tab.id), disabled: busy.value })));
const modalTitle = computed(() => creating.value ? 'Auftrag anlegen' : `${order.value.eventTitel || 'Auftrag'} · #${order.value.auftragNr || props.auftragNr}`);
const locations = ref([]), jobs = ref([]), qualifications = ref([]), sites = ref([]), patterns = ref([]), placeholders = ref({});
const selectedShiftId = ref(''), dateDraft = ref(editorDay(new Date())), fileTarget = ref('group'), documentRefresh = ref(0);
const newShiftDayOnly = ref(false), deleteDayOnly = ref(false), conflictQueue = ref([]);
const serverReview = ref(null), reviewLoading = ref(false), reviewError = ref('');
const reviewDays = computed(() => linked.value && !creating.value && serverReview.value ? serverReview.value.orders : changesByDay.value);
const reviewReady = computed(() => !linked.value || creating.value || Boolean(serverReview.value && !reviewLoading.value && !reviewError.value && !serverReview.value.errors?.length));
const selectedShift = computed(() => shifts.value.find(shift => shift.clientId === selectedShiftId.value) || shifts.value[0] || null);
const totalAssigned = computed(() => shifts.value.reduce((sum, shift) => sum + assignmentsFor(shift).length, 0));
const totalDemand = computed(() => shifts.value.reduce((sum, shift) => sum + Number(shift.bedarf || 0), 0));
const textmarks = computed(() => Object.entries(placeholders.value).map(([key, label]) => ({ key, label })));
const contactFields = [{ key: 'ansprechpartnerName', label: 'Ansprechpartner' }, { key: 'ansprechpartnerTelefon', label: 'Telefon', type: 'tel' }, { key: 'ansprechpartnerEmail', label: 'E-Mail', type: 'email' }];
const confirmClose = ref(false), deleteShiftConfirm = ref(false), templateConfirm = ref(false), conflictCandidate = ref(null), conflictReason = ref(''), releasing = ref(false);
const confirmCard = ref(null);
const confirming = computed(() => confirmClose.value || deleteShiftConfirm.value || templateConfirm.value || Boolean(conflictCandidate.value));
let previousFocus;
const candidates = ref([]), candidateLoading = ref(false), candidateFilter = ref('recommended'), includeOtherLocations = ref(false), selectedCandidateIds = ref(new Set()), dragCandidateId = ref('');
const candidateFilters = [{ id: 'recommended', label: 'Empfohlen' }, { id: 'possible', label: 'Möglich' }, { id: 'conflict', label: 'Konflikte' }];
const filteredCandidates = computed(() => candidates.value.filter(candidate => candidate.status === candidateFilter.value && !assignmentsFor(selectedShift.value || {}).some(assignment => String(assignment.mitarbeiterId || assignment.mitarbeiterData?._id) === String(candidate._id))));
let candidateRequest = 0, contextRequest = 0, previewRequest = 0, reviewRequest = 0, candidateTimer;
const dateLabel = value => { const day = editorDay(value); return day ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(new Date(`${day}T12:00:00Z`)) : 'Kein Datum'; };
const fileStatus = status => ({ pending: 'Vorgemerkt', missing: 'Originaldatei fehlt', uploading: 'Lädt hoch …', failed: 'Upload ausstehend', completed: 'Gespeichert' })[status];
const changeValue = value => value === '' || value == null ? '–' : Array.isArray(value) ? value.join(', ') || '–' : typeof value === 'boolean' ? value ? 'Ja' : 'Nein' : String(value).replace(/<[^>]*>/g, '').slice(0, 500);
const employeeName = item => item.employeeName || (item.mitarbeiterData ? `${item.mitarbeiterData.vorname} ${item.mitarbeiterData.nachname}` : `Personal ${item.personalNr}`);

const ScopeLabel = defineComponent({
  props: { field: { type: String, required: true }, text: { type: String, required: true } },
  setup(scope) {
    return () => h('span', { class: 'scope-label' }, [scope.text, linked.value && selectedShift.value && (selectedShift.value.dayOnly || selectedShift.value._id && !selectedShift.value.groupShiftKey ? h('small', 'Nur dieser Tag') : h(FilterChip, {
      active: selectedShift.value.overrides.includes(scopeField(scope.field)), disabled: pending.value,
      'aria-label': `${scope.text}: ${selectedShift.value.overrides.includes(scopeField(scope.field)) ? 'Gemeinsamen Wert wiederherstellen' : 'Nur diesen Tag bearbeiten'}`,
      onClick: event => { event.preventDefault(); toggleOverride(selectedShift.value, scope.field); },
    }, () => selectedShift.value.overrides.includes(scopeField(scope.field)) ? 'Nur dieser Tag' : 'Gemeinsam'))]);
  },
});
async function siteSaved(site) { savedSites.push(site); setOrder('einsatzort', site._id); await loadContext(); }
async function loadContext() {
  const request = ++contextRequest;
  if (!order.value.kundenNr) { sites.value = []; patterns.value = []; placeholders.value = {}; return; }
  try {
    const [siteResponse, recentResponse, infoResponse] = await Promise.all([
      api.get(`/api/kunden/${order.value.kundenNr}/einsatzorte`),
      api.get('/api/auftraege/recent-options', { params: { locationV2: order.value.locationV2, kundenNr: order.value.kundenNr, einsatzortId: order.value.einsatzort || undefined } }),
      api.get(`/api/kunden/${order.value.kundenNr}/einsatzinformationen`),
    ]);
    if (request !== contextRequest) return;
    sites.value = (siteResponse.data || []).filter(site => site.isActive !== false);
    patterns.value = recentResponse.data.recentShiftPatterns || [];
    placeholders.value = infoResponse.data.placeholders || {};
  } catch (failure) { if (request === contextRequest) error.value = failure.response?.data?.message || 'Einsatzorte und Vorlagen konnten nicht geladen werden.'; }
}
async function selectCustomer(customer) {
  if (!creating.value) return;
  if (order.value.kundenNr !== (customer?.kundenNr ?? null)) {
    for (const value of Object.values(drafts)) { value.customer = customer; value.order.einsatzort = ''; value.order.einsatzortOverride = false; }
    setOrder('kundenNr', customer?.kundenNr ?? null); setOrder('einsatzort', '');
    await loadContext();
  }
}
function setSingleDay(day) {
  dates.value = day ? [day] : []; activeDay.value = day; order.value.day = day;
  if (day) shifts.value.forEach(shift => { shift.datumVon = day; if (shift.datumBis < day) shift.datumBis = day; });
}
function useSingleDay() { multiDay.value = false; setSingleDay(activeDay.value); }
function addDate() { if (!dateDraft.value || dates.value.includes(dateDraft.value)) return; dates.value = [...dates.value, dateDraft.value].sort(); }
function removeDate(day) { dates.value = dates.value.filter(value => value !== day); if (activeDay.value === day) selectDay(dates.value[0]); }
function selectDay(day) { model.selectCreationDay(day); selectedShiftId.value = ''; loadCandidates(); }
function nextDay(day) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
async function switchOrder(number) { await load(number); selectedShiftId.value = ''; await loadContext(); await loadCandidates(); }
function createShift(pattern = {}) { const { _id, datumVon, datumBis, ...values } = pattern; const shift = addShift({ ...values, dayOnly: newShiftDayOnly.value }); selectedShiftId.value = shift.clientId; applyTemplate(false); }
function duplicateShift() {
  const shift = addShift({ ...selectedShift.value, clientId: undefined, groupShiftKey: undefined, bezeichnung: `${selectedShift.value.bezeichnung} – Kopie`, overrides: [], dayOnly: newShiftDayOnly.value });
  selectedShiftId.value = shift.clientId; previewInformation();
}
function selectShift(shift) { selectedShiftId.value = shift.clientId; selectedCandidateIds.value = new Set(); loadCandidates(); }
function editShift(field, value) {
  setShift(selectedShift.value, field, value);
  if (['uhrzeitVon', 'uhrzeitBis'].includes(field) && selectedShift.value.uhrzeitBis && selectedShift.value.uhrzeitVon && selectedShift.value.uhrzeitBis <= selectedShift.value.uhrzeitVon && selectedShift.value.datumBis === selectedShift.value.datumVon) setShift(selectedShift.value, 'datumBis', nextDay(selectedShift.value.datumVon));
  if (['berufSchl', 'qualSchl'].includes(field) && !selectedShift.value.einsatzinformationCustomized) applyTemplate(false);
}
function editLocalShift(shift, field, value) {
  if (linked.value && !shift.overrides.includes(field)) shift.overrides.push(field);
  setShift(shift, field, value);
}
function setInformation(value) {
  editLocalShift(selectedShift.value, 'einsatzinformationSourceHtml', value);
  editLocalShift(selectedShift.value, 'einsatzinformationCustomized', true);
}
async function applyTemplate(explicit) {
  const shift = selectedShift.value;
  if (!shift || !order.value.kundenNr) return;
  try {
    const { data } = await api.get(`/api/kunden/${order.value.kundenNr}/einsatzinformationen/resolve`, { params: {
      einsatzortId: order.value.einsatzort || undefined,
      berufId: jobs.value.find(job => String(job.jobKey) === String(shift.berufSchl))?._id,
      qualifikationId: qualifications.value.find(qualification => String(qualification.qualificationKey) === String(shift.qualSchl))?._id,
    } });
    if (data.template) {
      const local = linked.value && (explicit || order.value.einsatzortOverride || shift.dayOnly || shift.overrides.some(field => ['berufSchl', 'qualSchl'].includes(field)));
      if (local) {
        editLocalShift(shift, 'einsatzinformationSourceHtml', data.template.htmlTemplate);
        editLocalShift(shift, 'einsatzinformationCustomized', false);
      } else {
        setShift(shift, 'einsatzinformationSourceHtml', data.template.htmlTemplate);
        setShift(shift, 'einsatzinformationCustomized', false);
      }
      shift.applyLatestTemplate = explicit;
      await previewInformation();
    }
  } catch (failure) { error.value = failure.response?.data?.message || 'Die passende Vorlage konnte nicht geladen werden.'; }
}
async function previewInformation() {
  const shift = selectedShift.value; const request = ++previewRequest;
  if (!shift || !order.value.kundenNr || !shift.einsatzinformationSourceHtml) return;
  try {
    const { data } = await api.post(`/api/kunden/${order.value.kundenNr}/einsatzinformationen/preview`, { htmlTemplate: shift.einsatzinformationSourceHtml, einsatzortId: order.value.einsatzort || undefined, auftrag: order.value, schicht: shift });
    if (request === previewRequest) { shift.infoPreview = data.renderedHtml; shift.infoUnresolved = data.unresolvedPlaceholders || []; }
  } catch (failure) { if (request === previewRequest) error.value = failure.response?.data?.message || 'Die Einsatzinformation konnte nicht geprüft werden.'; }
}
async function loadCandidates() {
  const request = ++candidateRequest;
  candidates.value = []; selectedCandidateIds.value = new Set(); candidateLoading.value = false;
  if (!selectedShift.value?.datumVon || !selectedShift.value.datumBis || !order.value.kundenNr || !order.value.einsatzort || pending.value) return;
  candidateLoading.value = true;
  try {
    const { data } = await api.post('/api/auftraege/editor/candidates', { auftragNr: order.value.auftragNr, kundenNr: order.value.kundenNr, locationV2: order.value.locationV2, einsatzort: order.value.einsatzort, schicht: shiftDto(selectedShift.value), includeOtherLocations: includeOtherLocations.value, stagedAssignments: model.stagedAssignments() });
    if (!Array.isArray(data.candidates)) throw new Error('Die Personalprüfung hat keine gültige Vorschlagsliste geliefert.');
    if (request === candidateRequest) candidates.value = data.candidates;
  } catch (failure) { if (request === candidateRequest) error.value = failure.response?.data?.message || 'Personal konnte nicht geprüft werden.'; }
  finally { if (request === candidateRequest) candidateLoading.value = false; }
}
function toggleCandidate(id) { const ids = new Set(selectedCandidateIds.value); if (ids.has(id)) ids.delete(id); else ids.add(id); selectedCandidateIds.value = ids; }
function assign(candidate) { if (candidate.conflicts?.length) { conflictCandidate.value = candidate; conflictReason.value = ''; } else { stageAssignment(candidate, selectedShift.value, undefined, includeOtherLocations.value); loadCandidates(); } }
function assignSelected() {
  const selected = candidates.value.filter(item => selectedCandidateIds.value.has(item._id));
  for (const candidate of selected.filter(item => !item.conflicts?.length)) stageAssignment(candidate, selectedShift.value, undefined, includeOtherLocations.value);
  conflictQueue.value = selected.filter(item => item.conflicts?.length);
  conflictCandidate.value = conflictQueue.value.shift() || null; conflictReason.value = ''; loadCandidates();
}
async function dropOnShift(shift) {
  const id = dragCandidateId.value; dragCandidateId.value = ''; selectedShiftId.value = shift.clientId;
  await loadCandidates();
  const candidate = candidates.value.find(item => item._id === id);
  if (candidate) assign(candidate); else error.value = 'Der Mitarbeiter ist für diese Schicht nicht verfügbar.';
}
function cancelConfirmation() { confirmClose.value = false; deleteShiftConfirm.value = false; templateConfirm.value = false; conflictCandidate.value = null; conflictQueue.value = []; }
function confirmationKeydown(event) {
  if (!confirming.value || !confirmCard.value?.getClientRects().length || event.key !== 'Tab') return;
  const controls = [...confirmCard.value.querySelectorAll('button:not([disabled]),textarea:not([disabled])')];
  const index = controls.indexOf(document.activeElement);
  if (index < 0 || !event.shiftKey && index === controls.length - 1 || event.shiftKey && index === 0) {
    event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
  }
}
async function runConfirmation() {
  if (confirmClose.value) { emit('close'); return; }
  if (deleteShiftConfirm.value) { model.deleteShift(selectedShift.value, linked.value && deleteDayOnly.value); selectedShiftId.value = ''; }
  if (templateConfirm.value) await applyTemplate(true);
  if (conflictCandidate.value) {
    stageAssignment(conflictCandidate.value, selectedShift.value, { confirmed: true, reason: conflictReason.value, conflicts: conflictCandidate.value.conflicts }, includeOtherLocations.value);
    if (conflictQueue.value.length) { conflictCandidate.value = conflictQueue.value.shift(); conflictReason.value = ''; return; }
    loadCandidates();
  }
  cancelConfirmation();
}
function requestClose() {
  if (busy.value || releasing.value) return;
  if (pending.value && progress.value?.canResume !== false) { error.value = 'Der Vorgang ist noch unvollständig. Bitte unter Prüfen die ausstehenden Arbeiten fortsetzen.'; activeTab.value = 'review'; return; }
  if (dirty.value) confirmClose.value = true; else emit('close');
}
function nextStage() {
  if (activeTab.value === 'order' && (!order.value.kundenNr || !order.value.eventTitel || !order.value.locationV2)) { error.value = 'Bitte Titel, Kunde und Standort angeben.'; return; }
  if (activeTab.value === 'site' && !order.value.einsatzort) { error.value = 'Bitte einen Einsatzort auswählen oder speichern.'; return; }
  error.value = ''; activeTab.value = ({ order: 'site', site: 'planning', planning: 'review' })[activeTab.value] || 'review';
}
async function loadReview(cursor) {
  if (!linked.value || creating.value || pending.value) return;
  const request = ++reviewRequest; reviewLoading.value = true; reviewError.value = '';
  if (!cursor) serverReview.value = null;
  try {
    const { data } = await api.post('/api/auftraege/editor/review', { ...model.submissionPayload(), cursor });
    if (request !== reviewRequest) return;
    if (!Array.isArray(data.orders)) throw new Error('Die Änderungsprüfung hat keine betroffenen Aufträge geliefert.');
    const rows = cursor ? [...serverReview.value.orders, ...data.orders] : data.orders;
    serverReview.value = { ...data, orders: rows };
    if (data.errors?.length) reviewError.value = data.errors.map(item => typeof item === 'string' ? item : item.message).join(' ');
  } catch (failure) { if (request === reviewRequest) reviewError.value = failure.response?.data?.message || failure.message || 'Die Änderungen konnten nicht geprüft werden.'; }
  finally { if (request === reviewRequest) reviewLoading.value = false; }
}
async function confirmSubmission() { if (!pending.value && !reviewReady.value) return; await model.submit(); documentRefresh.value += 1; }
async function release() {
  if (dirty.value || pending.value || releasing.value) return;
  releasing.value = true; error.value = '';
  try { const { data } = await api.post(`/api/auftraege/${order.value.auftragNr}/release`); order.value.auftStatus = data.auftrag?.auftStatus || 2; notice.value = 'Auftrag freigegeben.'; emit('updated', { ...order.value, schichten: shifts.value, einsaetze: draft.value.assignments }); }
  catch (failure) { error.value = failure.response?.data?.message || 'Freigabe fehlgeschlagen.'; }
  finally { releasing.value = false; }
}
function goToChanges(day) { if (day.auftragNr && day.auftragNr !== order.value.auftragNr) switchOrder(day.auftragNr); activeTab.value = day.changes.some(change => change.kind !== 'order') ? 'planning' : 'order'; }
watch(() => order.value?.kundenNr, loadContext);
watch(() => order.value?.locationV2, () => { if (creating.value) loadContext(); });
watch(() => order.value?.einsatzort, () => { loadContext(); loadCandidates(); });
watch(() => selectedShift.value && JSON.stringify(shiftDto(selectedShift.value)), () => { clearTimeout(candidateTimer); candidateTimer = setTimeout(loadCandidates, 250); });
watch(activeTab, value => { if (value === 'review') loadReview(); else { reviewRequest++; reviewLoading.value = false; serverReview.value = null; } });
watch(confirming, async open => { if (open) { previousFocus = document.activeElement; await nextTick(); confirmCard.value?.focus(); } else previousFocus?.focus(); });
watch(() => JSON.stringify(model.submissionPayload()), () => { if (activeTab.value === 'review' && !pending.value) loadReview(); });
onBeforeUnmount(() => { clearTimeout(candidateTimer); candidateRequest++; contextRequest++; previewRequest++; reviewRequest++; document.removeEventListener('keydown', confirmationKeydown); });
onMounted(async () => {
  document.addEventListener('keydown', confirmationKeydown);
  try {
    const [locationResponse, jobResponse, qualificationResponse] = await Promise.all([api.get('/api/locations'), api.get('/api/import/berufe'), api.get('/api/import/qualifikationen')]);
    locations.value = locationResponse.data || []; jobs.value = jobResponse.data.data || []; qualifications.value = qualificationResponse.data.data || [];
    if (props.auftragNr) { await load(props.auftragNr); if (pending.value) activeTab.value = 'review'; }
    await loadContext(); await loadCandidates(); await nextTick();
  } catch (failure) { error.value = failure.response?.data?.message || failure.message || 'Grunddaten konnten nicht geladen werden.'; }
});
</script>

<style scoped>
.auftrag-editor { display: flex; flex: 1; height: 100%; flex-direction: column; min-height: 0; overflow: hidden; position: relative; color: var(--text); background: var(--panel); }
.auftrag-editor :deep(.app-tabs-container) { flex-shrink: 0; padding: 0 18px; background: var(--surface); border-bottom: 1px solid var(--border); }
.editor-body { flex: 1; padding: 18px; overflow: auto; min-height: 0; }
.editor-footer { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 12px 18px; background: var(--surface); border-top: 1px solid var(--border); }
.editor-footer > span { flex: 1; color: var(--muted); font-size: .8rem; }
.order-status { font-size: .75rem; padding: 4px 9px; border: 1px solid var(--border); border-radius: 20px; }
.section-heading,.card-heading { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-heading h3 { font-size: 1.15rem; font-weight: 650; margin: 0; }
.section-heading span,.muted { color: var(--muted); font-size: .8rem; }
.section-heading > div { display: grid; gap: 4px; }
.editor-card { padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 14px; min-width: 0; }
.editor-card h4 { font-size: .9rem; font-weight: 600; margin: 0 0 12px; }
.card-heading h4 { margin: 0; }
.context-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: grid; gap: 6px; margin-bottom: 12px; font-size: .78rem; color: var(--muted); min-width: 0; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.fixed-customer { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); }
.fixed-customer small,.assignments small,.candidate small,.file-list small { display: block; color: var(--muted); font-size: .72rem; margin-top: 3px; }
.chip-row,.candidate-filter { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
.date-add { display: flex; gap: 8px; margin-top: 12px; }
.selected-dates,.file-list,.assignments { padding: 0; margin: 10px 0; list-style: none; }
.selected-dates li,.file-list li,.assignments li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.file-list strong { overflow-wrap: anywhere; }
.day-navigation { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.day-navigation label { display: grid; gap: 5px; font-size: .75rem; flex-shrink: 0; }
.day-navigation > span { color: var(--muted); font-size: .75rem; }
.site-selection :deep(.site-grid) { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 8px; }
.site-selection :deep(.site-choice) { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; text-align: left; cursor: pointer; font: inherit; }
.site-selection :deep(.site-choice span) { color: var(--muted); font-size: .75rem; }
.site-selection :deep(.selected),.shift-list button.selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.planning-layout { display: grid; grid-template-columns: 190px minmax(280px,1fr) minmax(280px,1fr); gap: 14px; align-items: start; }
.shift-list { display: grid; gap: 8px; }
.shift-list button { display: grid; gap: 5px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: left; font: inherit; cursor: pointer; }
.shift-list button span,.shift-list button small { color: var(--muted); font-size: .75rem; }
.scope-label { display: flex; align-items: center; justify-content: space-between; gap: 4px; flex-wrap: wrap; }
.scope-label :deep(.filter-chip) { font-size: .65rem; padding: 2px 5px; }
.shift-extra { border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; }
.shift-extra summary { cursor: pointer; font-size: .8rem; font-weight: 500; margin-bottom: 12px; }
.pattern-row { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.candidate-list { display: grid; gap: 8px; margin-top: 12px; }
.candidate { display: flex; align-items: center; gap: 8px; padding: 9px; border: 1px solid var(--border); border-radius: 8px; border-left: 3px solid var(--status-success-text); }
.candidate.possible { border-left-color: var(--status-warning); }.candidate.conflict { border-left-color: var(--status-danger-text); }
.candidate > div { flex: 1; min-width: 0; }.candidate strong { font-size: .8rem; }.candidate small { overflow-wrap: anywhere; }
.feedback { padding: 10px 12px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); background: var(--surface); font-size: .8rem; }
.feedback--error,.error-text { color: var(--status-danger-text); }.feedback--error { border-color: var(--status-danger-text); }
.feedback li { margin-left: 14px; }
.review-changes dl { margin: 0; }.review-changes dl > div { display: grid; grid-template-columns: minmax(120px,1fr) 2fr; padding: 9px 0; border-bottom: 1px solid var(--border); gap: 16px; font-size: .8rem; }
.review-changes dd { display: flex; gap: 14px; margin: 0; overflow-wrap: anywhere; }.review-changes dd > span:first-child { color: var(--muted); }
.release { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.confirm-overlay { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 18px; background: var(--modal-overlay-bg,rgba(0,0,0,.45)); }
.confirm-card { width: min(500px,100%); box-sizing: border-box; box-shadow: 0 12px 40px rgba(0,0,0,.2); }.confirm-card h3 { margin-bottom: 12px; }
.confirm-card p { margin-bottom: 16px; font-size: .85rem; }.confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
button:focus-visible,summary:focus-visible { outline: 2px solid var(--control-focus-ring,var(--primary)); outline-offset: 2px; }
@media (max-width: 1050px) { .planning-layout { grid-template-columns: 170px minmax(0,1fr); }.personnel { grid-column: 2; }.section-heading > span { display: none; } }
@media (max-width: 650px) {
  :global(.auftrag-editor-frame) { --mf-max-width: 98vw; --mf-header-padding: 10px 12px; --mf-title-size: .95rem; }
  .editor-body { padding: 10px; }.auftrag-editor :deep(.app-tabs-container) { padding: 0 8px; }
  .context-grid,.planning-layout { grid-template-columns: 1fr; }.personnel { grid-column: auto; }
  .shift-list { display: flex; overflow-x: auto; min-width: 0; padding: 1px; }.shift-list button { flex: 0 0 150px; }.editor-card { padding: 12px; }
  .editor-footer { flex-wrap: wrap; padding: 8px; }.editor-footer > span { font-size: .7rem; }.editor-footer > :deep(.app-button:last-child) { max-width: 100%; white-space: normal; }
  .day-navigation { align-items: flex-start; flex-direction: column; }.review-changes dl > div { grid-template-columns: 1fr; gap: 4px; }
  .card-heading { flex-wrap: wrap; }.section-heading { align-items: flex-start; }.candidate { flex-wrap: wrap; }
}
</style>
