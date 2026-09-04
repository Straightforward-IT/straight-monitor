<template>
  <ModalFrame
    v-if="modal.open"
    minimizable
    minimize-id="signature-new"
    :minimize-title="signatureDockTitle"
    size="xl"
    :close-on-backdrop="!submitting"
    style="--mf-max-width: 860px; --mf-max-height: 92dvh; --mf-body-padding: 0; --mf-body-overflow: hidden; --mf-footer-padding: 0; --mf-footer-border: none"
    @close="close"
  >
    <template #header>
      <div class="sig-header-title">
        <font-awesome-icon :icon="['fas', modal.context.draftId ? 'pen-nib' : 'file-signature']" />
        <h2>{{ modalTitle }}</h2>
      </div>
    </template>

    <div class="sig-content">

          <!-- Step breadcrumb -->
          <nav class="sig-steps">
            <button
              v-for="(s, i) in steps"
              :key="s.key"
              class="sig-step"
              :class="{ active: currentStep === i, done: currentStep > i, reachable: i <= maxReachableStep }"
              type="button"
              :disabled="i > maxReachableStep"
              @click="i <= maxReachableStep && (currentStep = i)"
            >
              <span class="sig-step-num">
                <font-awesome-icon v-if="currentStep > i" :icon="['fas', 'check']" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="sig-step-label">{{ s.label }}</span>
            </button>
          </nav>

          <!-- Body -->
          <div class="sig-body">
            <!-- ───────── STEP 1: Dokument & Typ ───────── -->
            <section v-show="currentStep === 0" class="sig-section">
              <template v-if="!isGeneratedDocumentFlow">
                <label class="sig-field-label">Location</label>
                <div class="sig-chip-row">
                <FilterChip
                  v-for="location in locations"
                  :key="location._id"
                  :active="form.locationId === location._id"
                  @click="form.locationId = form.locationId === location._id ? null : location._id"
                >
                  {{ location.nameFull }}
                </FilterChip>
                </div>
              </template>

              <label class="sig-field-label" for="sig-name">Bezeichnung</label>
              <input
                id="sig-name"
                v-model="form.name"
                type="text"
                class="sig-input"
                :readonly="isGeneratedDocumentFlow"
                placeholder="z. B. Stundenliste Auftrag 12345"
              />

              <label class="sig-field-label">Dokumenttyp</label>
              <div v-if="typenLoading" class="sig-loading-inline">
                <font-awesome-icon :icon="['fas', 'spinner']" spin /> Typen laden…
              </div>
              <div v-else-if="isGeneratedDocumentFlow" class="sig-fixed-type">
                <font-awesome-icon :icon="typIcon(form.typKey || modal.context.typKey)" />
                <span>
                  <strong>{{ selectedTyp?.label || form.typKey || modal.context.typKey }}</strong>
                  <small>{{ isReisekostenFlow ? 'Das signierte Dokument wird an Invoice ausgeliefert' : 'Das Dokument wird automatisch generiert' }}</small>
                </span>
                <font-awesome-icon :icon="['fas', 'lock']" class="sig-fixed-type-lock" />
              </div>
              <div v-else class="sig-type-grid">
                <button
                  v-for="t in typen"
                  :key="t._id"
                  class="sig-type-card"
                  :class="{ active: form.typId === t._id }"
                  type="button"
                  @click="selectTyp(t)"
                >
                  <font-awesome-icon :icon="typIcon(t.key)" class="sig-type-icon" />
                  <span class="sig-type-label">{{ t.label }}</span>
                  <span class="sig-type-link">{{ linkLabel(t.linkedTo) }}</span>
                </button>
                <button
                  v-if="isAdmin"
                  class="sig-type-card sig-type-card--add"
                  type="button"
                  title="Neuen Typ anlegen"
                  @click="showTypModal = true"
                >
                  <font-awesome-icon :icon="['fas', 'plus']" class="sig-type-icon" />
                  <span class="sig-type-label">Neuer Typ</span>
                </button>
              </div>

              <template v-if="!usesCustomEndpoint && form.typId && templatesForTyp.length">
                <label class="sig-field-label">Vorlage</label>
                <div class="sig-tpl-chips">
                  <button
                    v-for="tpl in templatesForTyp"
                    :key="tpl.id"
                    class="sig-tpl-chip"
                    :class="{ active: form.templateId === tpl.id }"
                    type="button"
                    @click="selectTemplateChip(tpl)"
                  >
                    <font-awesome-icon :icon="['fas', 'file-lines']" />
                    {{ tpl.name }}
                  </button>
                </div>
              </template>

            </section>

            <!-- ───────── STEP 2: Verknüpfung ───────── -->
            <section v-show="currentStep === 1" class="sig-section">
              <template v-if="isGeneratedDocumentFlow">
                <label class="sig-field-label">Verknüpft mit</label>
                <div class="sig-fixed-type">
                  <font-awesome-icon :icon="linkMode === 'kunde' ? ['fas', 'building'] : ['fas', 'id-badge']" />
                  <span>
                    <strong>{{ linkMode === 'kunde' ? selectedKunde?.kundName : `${selectedMitarbeiter?.vorname || ''} ${selectedMitarbeiter?.nachname || ''}`.trim() }}</strong>
                    <small>{{ linkMode === 'kunde' ? selectedKunde?.kuerzel || selectedKunde?.kundenNr : selectedMitarbeiter?.email }}</small>
                  </span>
                  <font-awesome-icon :icon="['fas', 'lock']" class="sig-fixed-type-lock" />
                </div>
              </template>
              <template v-else>
                <label class="sig-field-label">Verknüpfen mit</label>
                <div class="sig-link-toggle">
                  <button
                    v-for="opt in linkOptions"
                    :key="opt.key"
                    class="sig-link-btn"
                    :class="{ active: linkMode === opt.key }"
                    type="button"
                    :disabled="!isLinkAllowed(opt.key)"
                    @click="setLinkMode(opt.key)"
                  >
                    <font-awesome-icon :icon="opt.icon" />
                    {{ opt.label }}
                  </button>
                </div>

                <!-- Kunde search -->
                <div v-if="linkMode === 'kunde'" class="sig-link-search">
                  <ContactSearchPlaceholder
                    v-if="form.kundeId"
                    :title="selectedKunde ? selectedKunde.kundName : ''"
                    :subtitle="selectedKunde ? (selectedKunde.kuerzel || String(selectedKunde.kundenNr || '')) : ''"
                    @clear="clearKunde"
                  />
                  <div v-else class="sig-typeahead" ref="kundeBox">
                    <div class="sig-search-input">
                      <font-awesome-icon :icon="['fas', 'magnifying-glass']" />
                      <input v-model="kundeQuery" type="text" placeholder="Kunde / Kürzel suchen…" @focus="kundeOpen = true" />
                    </div>
                    <div v-if="kundeOpen && filteredKunden.length" class="sig-typeahead-list">
                      <button
                        v-for="k in filteredKunden"
                        :key="k._id"
                        class="sig-typeahead-item"
                        type="button"
                        @click="selectKunde(k)"
                      >
                        <span class="sig-ta-name">{{ k.kundName }}</span>
                        <span v-if="k.kuerzel" class="sig-ta-kuerzel">{{ k.kuerzel }}</span>
                        <span v-else class="sig-ta-kuerzel">{{ k.kundenNr }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Mitarbeiter search -->
                <div v-if="linkMode === 'mitarbeiter'" class="sig-link-search">
                  <ContactSearchPlaceholder
                    v-if="form.mitarbeiterId"
                    :title="selectedMitarbeiter ? `${selectedMitarbeiter.vorname} ${selectedMitarbeiter.nachname}` : ''"
                    :subtitle="selectedMitarbeiter ? (selectedMitarbeiter.email || '') : ''"
                    @clear="clearMitarbeiter"
                  />
                  <div v-else class="sig-typeahead" ref="maBox">
                    <div class="sig-search-input">
                      <font-awesome-icon :icon="['fas', 'magnifying-glass']" />
                      <input v-model="maQuery" type="text" placeholder="Mitarbeiter suchen…" @focus="maOpen = true" />
                    </div>
                    <div v-if="maOpen && filteredMitarbeiter.length" class="sig-typeahead-list">
                      <button
                        v-for="m in filteredMitarbeiter"
                        :key="m._id"
                        class="sig-typeahead-item"
                        type="button"
                        @click="selectMitarbeiter(m)"
                      >
                        <span class="sig-ta-name">{{ m.vorname }} {{ m.nachname }}</span>
                        <span class="sig-ta-kuerzel">{{ m.email || '—' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </template>

            </section>

            <!-- ───────── STEP 3: Unterzeichner ───────── -->
            <section v-show="currentStep === 2" class="sig-section">
              <label class="sig-field-label">Vorlage</label>
              <div v-if="usesCustomEndpoint" class="sig-template-auto">
                <font-awesome-icon :icon="['fas', 'wand-magic-sparkles']" />
                <span>{{ modal.context.sourceDocumentName || `Dokument wird automatisch generiert (${modal.context.typKey}).` }}</span>
              </div>
              <div v-else class="sig-template-row">
                <select v-model="form.templateId" class="sig-select" @change="onTemplateChange">
                  <option :value="null">— Entwurf ohne Vorlage —</option>
                  <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
                <button class="sig-btn sig-btn--ghost" type="button" @click="openBuilder">
                  <font-awesome-icon :icon="['fas', 'pen-ruler']" />
                  {{ form.templateId ? 'Bearbeiten' : 'Neu erstellen' }}
                </button>
              </div>

              <label class="sig-field-label">Unterzeichner</label>
              <div class="sig-submitters">
                <ContactSearchPicker
                  v-for="(sub, i) in form.submitters"
                  :key="i"
                  v-model="form.submitters[i]"
                  :role-name="sub.role || `Unterzeichner ${i + 1}`"
                  :contacts="graphContacts"
                  :mitarbeiter="mitarbeiterList"
                  :mitarbeiter-id="sub.role === 'Mitarbeiter' ? form.mitarbeiterId : null"
                  :kuerzel="selectedKunde?.kuerzel"
                  :company-name="sub.role === 'Entleiher' ? (selectedKunde?.kuerzel || selectedKunde?.kundName) : ''"
                  :locked="isReisekostenFlow"
                  :removable="!hasFixedSignerSlots && form.submitters.length > 1"
                  @remove="removeSubmitter(i)"
                />
              </div>
              <button v-if="!form.templateId && !hasFixedSignerSlots" class="sig-add-submitter" type="button" @click="addSubmitter">
                <font-awesome-icon :icon="['fas', 'user-plus']" /> Unterzeichner hinzufügen
              </button>
            </section>

            <!-- ───────── STEP 4: Folgeaktionen ───────── -->
            <section v-show="currentStep === 3" class="sig-section">

              <!-- Ausliefern an -->
              <label class="sig-field-label">
                <font-awesome-icon :icon="['fas', 'envelope']" /> Fertig­gestelltes Dokument ausliefern an
              </label>

              <!-- Kontakt-Vorschläge vom verlinkten Kunden -->
              <div v-if="linkMode === 'kunde' && kundeContactSuggestions.length" class="sig-follower-suggestions">
                <div class="sig-follower-header">
                  <span class="sig-follower-label">
                    <font-awesome-icon :icon="['fas', 'building']" />
                    Kontakte von {{ selectedKunde?.kundName || selectedKunde?.kuerzel }}
                  </span>
                  <span v-if="followerDefaultsLoading" class="sig-follower-loading">
                    <font-awesome-icon :icon="['fas', 'spinner']" spin /> Laden…
                  </span>
                  <button
                    v-else-if="form.typId"
                    class="sig-follower-save-btn"
                    type="button"
                    :disabled="followerDefaultsSaving"
                    @click="saveFollowerDefaults"
                  >
                    <font-awesome-icon :icon="['fas', followerDefaultsSaving ? 'spinner' : 'floppy-disk']" :spin="followerDefaultsSaving" />
                    Als Standard speichern
                  </button>
                </div>
                <div class="sig-follower-chips">
                  <button
                    v-for="c in kundeContactSuggestions"
                    :key="c.email"
                    class="sig-follower-chip"
                    :class="{ selected: isFollowerSelected(c.email) }"
                    :style="isFollowerSelected(c.email) ? {} : followerChipColor(c.displayName)"
                    type="button"
                    :title="c.email"
                    @click="toggleFollower(c)"
                  >
                    <font-awesome-icon :icon="['fas', isFollowerSelected(c.email) ? 'circle-check' : 'circle']" class="sig-follower-chip-icon" />
                    <span class="sig-follower-chip-name">{{ c.displayName }}</span>
                  </button>
                </div>
              </div>
              <div class="sig-email-add-row">
                <ContactSearchPicker
                  :key="deliveryPickerKey"
                  v-model="deliveryRecipient"
                  role-name="Empfänger"
                  :contacts="graphContacts"
                  :mitarbeiter="mitarbeiterList"
                  :kuerzel="selectedKunde?.kuerzel"
                  :removable="false"
                  :show-delivery-method="false"
                  :excluded-emails="folgeaktionen.ausliefernAn.map(recipient => recipient.email)"
                  @selected="addAusliefernEmail"
                />
              </div>
              <p v-if="newEmailError" class="sig-error" style="margin-top:6px;">{{ newEmailError }}</p>
              <p class="sig-hint" style="margin-top:0;margin-bottom:10px;">
                Nach Abschluss aller Unterschriften wird das signierte PDF an diese Adressen geschickt.
              </p>
              <div class="sig-email-chips">
                <span v-for="(r, i) in folgeaktionen.ausliefernAn" :key="i" class="sig-email-chip">
                  <span>{{ r.displayName || r.email }}</span>
                  <small v-if="r.displayName">{{ r.email }}</small>
                  <button type="button" class="sig-chip-remove" @click="removeAusliefernEmail(i)">×</button>
                </span>
              </div>

              <!-- Asana Aktionen -->
              <label class="sig-field-label" style="margin-top:20px;">
                <font-awesome-icon :icon="['fas', 'robot']" /> Asana-Aktionen nach Abschluss
              </label>

              <!-- Added actions list -->
              <div v-if="folgeaktionen.asanaActions.length" class="sig-asana-list">
                <div v-for="(a, i) in folgeaktionen.asanaActions" :key="i" class="sig-asana-item">
                  <font-awesome-icon :icon="asanaActionIcons[a.type]" class="sig-asana-type-icon" :class="`sig-asana-type--${a.type}`" />
                  <div class="sig-asana-item-info">
                    <span class="sig-asana-action-label">{{ asanaActionLabels[a.type] }}</span>
                    <span class="sig-asana-task-name">{{ a.taskName || a.taskGid }}</span>
                    <span v-if="a.type === 'comment' && a.comment" class="sig-asana-comment-preview">„{{ a.comment }}"</span>
                  </div>
                  <button type="button" class="sig-chip-remove" @click="removeAsanaAction(i)">×</button>
                </div>
              </div>

              <!-- Asana action builder -->
              <div v-if="showAsanaBuilder" class="sig-asana-builder">
                <div class="sig-typeahead">
                  <div class="sig-search-input">
                    <font-awesome-icon :icon="asanaSearching ? ['fas', 'spinner'] : ['fas', 'magnifying-glass']" :spin="asanaSearching" />
                    <input v-model="asanaSearchQuery" type="text" placeholder="Asana-Task suchen…" />
                  </div>
                  <div v-if="asanaSearchResults.length" class="sig-typeahead-list">
                    <button
                      v-for="t in asanaSearchResults"
                      :key="t.gid"
                      class="sig-typeahead-item"
                      type="button"
                      @click="selectAsanaTask(t)"
                    >
                      <span class="sig-ta-name">{{ t.name }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="pendingAction.taskGid" class="sig-asana-action-row">
                  <select v-model="pendingAction.type" class="sig-select sig-select--inline">
                    <option value="complete">Erledigen</option>
                    <option value="comment">Kommentieren</option>
                    <option value="delete">Löschen</option>
                  </select>
                  <textarea
                    v-if="pendingAction.type === 'comment'"
                    v-model="pendingAction.comment"
                    class="sig-input sig-textarea"
                    placeholder="Kommentartext…"
                    rows="2"
                  />
                  <button class="sig-btn sig-btn--primary" type="button" @click="addAsanaAction">
                    <font-awesome-icon :icon="['fas', 'plus']" /> Aktion hinzufügen
                  </button>
                </div>
              </div>

              <button v-if="!showAsanaBuilder" class="sig-add-submitter" type="button" @click="showAsanaBuilder = true">
                <font-awesome-icon :icon="['fas', 'bolt']" /> Asana-Aktion hinzufügen
              </button>
              <button v-else class="sig-add-submitter" style="color:var(--muted);" type="button" @click="showAsanaBuilder = false; asanaSearchQuery = ''; asanaSearchResults = []">
                Abbrechen
              </button>

            </section>
          </div>

          <!-- Close confirm overlay -->
          <div v-if="showCloseConfirm" class="sig-close-confirm">
            <p class="sig-close-confirm-msg">Entwurf speichern?</p>
            <div class="sig-close-confirm-actions">
              <button
                class="sig-btn sig-btn--primary"
                type="button"
                :disabled="savingDraft || !canSaveDraft"
                @click="saveAsDraft"
              >
                <font-awesome-icon :icon="['fas', savingDraft ? 'spinner' : 'floppy-disk']" :spin="savingDraft" />
                Als Entwurf speichern
              </button>
              <button class="sig-btn sig-btn--ghost" type="button" @click="confirmDiscard">Verwerfen</button>
              <button class="sig-btn sig-btn--ghost" type="button" @click="showCloseConfirm = false">Weiter bearbeiten</button>
            </div>
          </div>
    </div>

    <template #footer>
      <div class="sig-footer">
            <p v-if="error" class="sig-error"><font-awesome-icon :icon="['fas', 'triangle-exclamation']" /> {{ error }}</p>
            <p v-else-if="currentStep === 2 && submitBlockReason" class="sig-error"><font-awesome-icon :icon="['fas', 'triangle-exclamation']" /> {{ submitBlockReason }}</p>            <div class="sig-footer-actions">
              <button v-if="currentStep > 0" class="sig-btn sig-btn--ghost" type="button" @click="currentStep--">
                <font-awesome-icon :icon="['fas', 'arrow-left']" /> Zurück
              </button>
              <button v-else class="sig-btn sig-btn--ghost" type="button" @click="close">Abbrechen</button>

              <button
                v-if="canSaveDraft"
                class="sig-btn sig-btn--ghost sig-btn--save-draft"
                type="button"
                :disabled="savingDraft"
                @click="saveAsDraft"
              >
                <font-awesome-icon :icon="['fas', savingDraft ? 'spinner' : 'floppy-disk']" :spin="savingDraft" />
                {{ modal.context.draftId ? 'Änderungen speichern' : 'Als Entwurf speichern' }}
              </button>

              <button
                v-if="currentStep < steps.length - 1"
                class="sig-btn sig-btn--primary"
                type="button"
                :disabled="!canAdvance"
                @click="currentStep++"
              >
                Weiter <font-awesome-icon :icon="['fas', 'arrow-right']" />
              </button>
              <button
                v-else
                class="sig-btn sig-btn--primary"
                type="button"
                :disabled="!canSubmit || submitting"
                @click="submit"
              >
                <font-awesome-icon :icon="['fas', submitting ? 'spinner' : 'paper-plane']" :spin="submitting" />
                {{ submitting ? 'Erstelle…' : 'Signatur erstellen' }}
              </button>
            </div>
      </div>
    </template>
  </ModalFrame>

  <SignaturTypAnlegenModal v-model="showTypModal" @created="onTypCreated" />
  <DocuSealSigningModal
    v-if="inAppSigning"
    :title="inAppSigning.title"
    :signers="inAppSigning.signers"
    @close="inAppSigning = null"
  />
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, h } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faFileSignature, faCheck, faPlus, faArrowLeft, faArrowRight, faPaperPlane,
  faMagnifyingGlass, faSpinner, faTriangleExclamation, faUserPlus,
  faPenRuler, faWandMagicSparkles, faBuilding, faIdBadge, faBan,
  faClock, faTags, faFileContract, faMoneyBillWave, faCar,
  faBolt, faTrash, faCommentDots, faEnvelope, faAt, faRobot,
  faFloppyDisk, faPenNib, faCircleCheck, faCircle,
} from '@fortawesome/free-solid-svg-icons';
import api from '@/utils/api';
import { useSignaturModal } from '@/stores/signaturModal';
import { useSignaturBuilder } from '@/stores/signaturBuilder';
import { useAuth } from '@/stores/auth';
import { useDataCache } from '@/stores/dataCache';
import FilterChip from '@/components/ui-elements/FilterChip.vue';
import ContactSearchPicker from '@/components/ContactSearchPicker.vue';
import SignaturTypAnlegenModal from '@/components/SignaturTypAnlegenModal.vue';
import DocuSealSigningModal from '@/components/Modals/DocuSealSigningModal.vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';

library.add(
  faFileSignature, faCheck, faPlus, faArrowLeft, faArrowRight, faPaperPlane,
  faMagnifyingGlass, faSpinner, faTriangleExclamation, faUserPlus,
  faPenRuler, faWandMagicSparkles, faBuilding, faIdBadge, faBan,
  faClock, faTags, faFileContract, faMoneyBillWave, faCar,
  faBolt, faTrash, faCommentDots, faEnvelope, faAt, faRobot,
  faFloppyDisk, faPenNib, faCircleCheck, faCircle,
);

const modal = useSignaturModal();
const builder = useSignaturBuilder();
const auth = useAuth();
const dataCache = useDataCache();
const modalTitle = computed(() => modal.context.draftId ? 'Entwurf bearbeiten' : 'Neue Signatur');

const showTypModal = ref(false);
const inAppSigning = ref(null);

function onTypCreated(typ) {
  typen.value = [...typen.value, typ].sort((a, b) => (a.order || 0) - (b.order || 0));
  selectTyp(typ);
}

const isAdmin = computed(() => {
  const u = auth.user || {};
  return (Array.isArray(u.roles) && u.roles.includes('ADMIN')) || u.role === 'ADMIN';
});

const steps = [
  { key: 'doc',     label: 'Dokument & Typ' },
  { key: 'link',    label: 'Verknüpfung' },
  { key: 'sign',    label: 'Unterzeichner' },
  { key: 'actions', label: 'Folgeaktionen' },
];

const linkOptions = [
  { key: 'kunde',       label: 'Kunde',       icon: ['fas', 'building'] },
  { key: 'mitarbeiter', label: 'Mitarbeiter', icon: ['fas', 'id-badge'] },
  { key: 'keine',       label: 'Keine',       icon: ['fas', 'ban'] },
];

const currentStep = ref(0);
const submitting = ref(false);
const savingDraft = ref(false);
const showCloseConfirm = ref(false);
const error = ref('');

// Draft saving is not available for custom-endpoint flows (e.g. Stundenliste)
// because those use a specialised backend route that cannot produce a partial draft.
const canSaveDraft = computed(() => !!(form.value.typId && form.value.locationId && form.value.name.trim()));

// ── Folgeaktionen state ──────────────────────────────────────────────────────
const folgeaktionen = ref({
  ausliefernAn: [],
  ausliefernAnSignierer: true,
  emailBenachrichtigung: true,
  asanaActions: [],
});

// "Ausliefern an" contact picker
const deliveryRecipient = ref({ name: '', email: '', embedded: false });
const deliveryPickerKey = ref(0);
const newEmailError = ref('');

function addAusliefernEmail(recipient = deliveryRecipient.value) {
  const email = String(recipient.email || '').trim().toLowerCase();
  if (!email) return;
  if (!/\S+@\S+\.\S+/.test(email)) { newEmailError.value = 'Ungültige E-Mail-Adresse'; return; }
  if (folgeaktionen.value.ausliefernAn.some(r => String(r.email || '').trim().toLowerCase() === email)) {
    deliveryRecipient.value = { name: '', email: '', embedded: false };
    deliveryPickerKey.value += 1;
    newEmailError.value = '';
    return;
  }
  folgeaktionen.value.ausliefernAn.push({
    displayName: recipient.name || '',
    email,
  });
  deliveryRecipient.value = { name: '', email: '', embedded: false };
  deliveryPickerKey.value += 1;
  newEmailError.value = '';
}

function removeAusliefernEmail(i) {
  folgeaktionen.value.ausliefernAn.splice(i, 1);
}

function addSignerDeliveryRecipients() {
  if (folgeaktionen.value.ausliefernAnSignierer === false) return;
  form.value.submitters.forEach(submitter => {
    const email = String(submitter.email || '').trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(email)) return;
    if (!folgeaktionen.value.ausliefernAn.some(recipient => String(recipient.email || '').trim().toLowerCase() === email)) {
      folgeaktionen.value.ausliefernAn.push({ displayName: submitter.name || '', email });
    }
  });
  folgeaktionen.value.ausliefernAnSignierer = false;
}

// Asana action builder
const asanaSearchQuery = ref('');
const asanaSearchResults = ref([]);
const asanaSearching = ref(false);
const pendingAction = ref({ taskGid: '', taskName: '', type: 'complete', comment: '' });
const showAsanaBuilder = ref(false);

let asanaDebounce = null;
watch(asanaSearchQuery, (q) => {
  clearTimeout(asanaDebounce);
  if (!q || q.length < 2) { asanaSearchResults.value = []; return; }
  asanaDebounce = setTimeout(async () => {
    asanaSearching.value = true;
    try {
      const { data } = await api.get('/api/asana/tasks/search', { params: { query: q } });
      asanaSearchResults.value = Array.isArray(data.data) ? data.data.slice(0, 10) : [];
    } catch { asanaSearchResults.value = []; }
    finally { asanaSearching.value = false; }
  }, 350);
});

function selectAsanaTask(task) {
  pendingAction.value.taskGid  = task.gid;
  pendingAction.value.taskName = task.name;
  asanaSearchQuery.value = task.name;
  asanaSearchResults.value = [];
}

function addAsanaAction() {
  if (!pendingAction.value.taskGid) return;
  folgeaktionen.value.asanaActions.push({ ...pendingAction.value });
  pendingAction.value = { taskGid: '', taskName: '', type: 'complete', comment: '' };
  asanaSearchQuery.value = '';
  showAsanaBuilder.value = false;
}

function removeAsanaAction(i) {
  folgeaktionen.value.asanaActions.splice(i, 1);
}

const asanaActionLabels = { complete: 'Erledigen', comment: 'Kommentieren', delete: 'Löschen' };
const asanaActionIcons  = { complete: ['fas', 'check'], comment: ['fas', 'comment-dots'], delete: ['fas', 'trash'] };

const typen = ref([]);
const typenLoading = ref(false);
const templates = ref([]);
const graphContacts = ref([]);
const locations = ref([]);
const linkMode = ref('keine');

const form = ref(emptyForm());
const signatureDockTitle = computed(() => form.value.name.trim() || modalTitle.value);

function emptyForm() {
  const userLocation = auth.user?.locationV2;
  return {
    typId: null,
    typKey: null,
    typLinkedTo: 'Both',
    locationId: typeof userLocation === 'object' ? userLocation?._id || null : userLocation || null,
    name: '',
    kundeId: null,
    mitarbeiterId: null,
    templateId: null,
    templateName: '',
    submitters: [{ role: 'Unterzeichner', name: '', email: '', embedded: false }],
  };
}

// ── Data sources ────────────────────────────────────────────────────────────
const mitarbeiterList = computed(() => dataCache.mitarbeiter || []);
const kundenList = computed(() => dataCache.kunden || []);

const selectedKunde = computed(() => kundenList.value.find(k => k._id === form.value.kundeId) || null);
const selectedMitarbeiter = computed(() => mitarbeiterList.value.find(m => m._id === form.value.mitarbeiterId) || null);

// ── Follower-Vorschläge (Kontakte des ausgewählten Kunden) ──────────────────
const followerDefaultsLoading  = ref(false);
const followerDefaultsSaving   = ref(false);
const followerDefaultsLoaded   = ref(false);

// All Graph contacts whose companyName matches the selected Kunde's kuerzel
const kundeContactSuggestions = computed(() => {
  const kuerzel = selectedKunde.value?.kuerzel;
  if (!kuerzel) return [];

  const k = kuerzel.toLowerCase();
  const seen = new Set();

  return graphContacts.value
    .map(c => {
      const email = (c.emailAddresses?.[0]?.address || '').trim().toLowerCase();

      return {
        ...c,
        email,
        displayName: c.displayName || email,
      };
    })
    .filter(c => {
      if (!c.email) return false;
      if ((c.companyName || '').toLowerCase() !== k) return false;
      if (seen.has(c.email)) return false;

      seen.add(c.email);
      return true;
    });
});

function isFollowerSelected(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  return folgeaktionen.value.ausliefernAn.some(r =>
    String(r.email || '').trim().toLowerCase() === normalizedEmail
  );
}

function followerChipColor(name) {
  let hash = 0;
  for (let i = 0; i < String(name).length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsl(${hue}, 55%, 92%)`,
    borderColor: `hsl(${hue}, 45%, 75%)`,
    color: `hsl(${hue}, 40%, 30%)`,
  };
}

function toggleFollower(contact) {
  const email = String(contact.email || contact.emailAddresses?.[0]?.address || '')
    .trim()
    .toLowerCase();

  if (!email) return;

  const idx = folgeaktionen.value.ausliefernAn.findIndex(r =>
    String(r.email || '').trim().toLowerCase() === email
  );

  if (idx === -1) {
    folgeaktionen.value.ausliefernAn.push({
      displayName: contact.displayName || '',
      email,
    });
  } else {
    folgeaktionen.value.ausliefernAn.splice(idx, 1);
  }
}

async function saveFollowerDefaults() {
  if (!form.value.kundeId || !form.value.typId || followerDefaultsSaving.value) return;
  followerDefaultsSaving.value = true;
  try {
    await api.put('/api/signaturen/folge-defaults', {
      kundeId: form.value.kundeId,
      typId: form.value.typId,
      ausliefernAn: folgeaktionen.value.ausliefernAn,
    });
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Standard gespeichert', type: 'success' } }));
  } catch (e) {
    console.error('Folge-Defaults speichern fehlgeschlagen', e);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Speichern fehlgeschlagen', type: 'error' } }));
  } finally {
    followerDefaultsSaving.value = false;
  }
}

// Load defaults when entering Step 4 with a Kunde+Typ selected
watch(currentStep, async (step) => {
  if (step !== 3) return;
  if (linkMode.value !== 'kunde' || !form.value.kundeId || !form.value.typId) return;
  if (followerDefaultsLoaded.value) return;

  followerDefaultsLoading.value = true;
  try {
    const { data } = await api.get('/api/signaturen/folge-defaults', {
      params: { kundeId: form.value.kundeId, typId: form.value.typId },
    });
    if (folgeaktionen.value.ausliefernAn.length === 0 && data.ausliefernAn?.length) {
      folgeaktionen.value.ausliefernAn = data.ausliefernAn;
    }
    followerDefaultsLoaded.value = true;
  } catch (e) {
    console.error('Folge-Defaults laden fehlgeschlagen', e);
  } finally {
    followerDefaultsLoading.value = false;
  }
});

// Reset loaded flag when Kunde or Typ changes
watch([() => form.value.kundeId, () => form.value.typId], () => {
  followerDefaultsLoaded.value = false;
});

const usesCustomEndpoint = computed(() => !!modal.context.customEndpoint);
const isGeneratedDocumentFlow = computed(() => usesCustomEndpoint.value && !!(form.value.typKey || modal.context.typKey));
const isReisekostenFlow = computed(() =>
  (form.value.typKey || modal.context.typKey) === 'reisekostenabrechnung'
);
const hasFixedSignerSlots = computed(() =>
  isReisekostenFlow.value || (usesCustomEndpoint.value && (form.value.typKey || modal.context.typKey) === 'stundenliste')
);
const selectedTyp = computed(() => typen.value.find(type => type._id === form.value.typId) || null);
const REISEKOSTEN_DELIVERY_EMAIL = 'invoice@straightforward.email';

function addReisekostenDefaultDeliveryEmail() {
  if (!isReisekostenFlow.value) return;
  if (!folgeaktionen.value.ausliefernAn.some(recipient =>
    String(recipient.email || '').trim().toLowerCase() === REISEKOSTEN_DELIVERY_EMAIL
  )) {
    folgeaktionen.value.ausliefernAn.push({
      displayName: 'Straightforward Invoice',
      email: REISEKOSTEN_DELIVERY_EMAIL,
    });
  }
}

// ── Straightforward own-company contacts per Location ───────────────────────
const SF_KUNDENNR = { hamburg: 2100003, berlin: 11000024, koeln: 31000001 };
const selectedLocation = computed(() => locations.value.find(location => location._id === form.value.locationId) || null);
const straightforwardKunde = computed(() => {
  const locationKey = selectedLocation.value?.shortNameKey || selectedLocation.value?.nameKey;
  const nr = selectedLocation.value?.settings?.signaturKundenNr || SF_KUNDENNR[locationKey];
  if (!nr) return null;
  return kundenList.value.find(k => k.kundenNr === nr) || null;
});

// ── Typeahead: Kunde ─────────────────────────────────────────────────────────
const kundeQuery = ref('');
const kundeOpen = ref(false);
const kundeBox = ref(null);
const filteredKunden = computed(() => {
  const q = kundeQuery.value.trim().toLowerCase();
  let list = kundenList.value;
  if (q) {
    list = list.filter(k =>
      (k.kundName || '').toLowerCase().includes(q) ||
      (k.kuerzel || '').toLowerCase().includes(q) ||
      String(k.kundenNr || '').includes(q)
    );
  }
  return list.slice(0, 8);
});

// ── Typeahead: Mitarbeiter ───────────────────────────────────────────────────
const maQuery = ref('');
const maOpen = ref(false);
const maBox = ref(null);
const filteredMitarbeiter = computed(() => {
  const q = maQuery.value.trim().toLowerCase();
  if (!q) return [];
  return mitarbeiterList.value
    .filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q))
    .slice(0, 8);
});

// ── Step gating ──────────────────────────────────────────────────────────────
const canAdvance = computed(() => {
  if (currentStep.value === 0) return !!form.value.typId && !!form.value.locationId && !!form.value.name.trim();
  if (currentStep.value === 1) {
    if (linkMode.value === 'kunde') return !!form.value.kundeId;
    if (linkMode.value === 'mitarbeiter') return !!form.value.mitarbeiterId;
    return true;
  }
  if (currentStep.value === 2) {
    const subs = form.value.submitters;
    if (!subs.some(s => (s.name || '').trim())) return false;
    // When a template is selected all pre-populated roles must be filled
    if (form.value.templateId) return subs.every(s => (s.name || '').trim());
    return true;
  }
  return true;
});

const maxReachableStep = computed(() => {
  if (!form.value.typId || !form.value.locationId || !form.value.name.trim()) return 0;
  if (linkMode.value === 'kunde' && !form.value.kundeId) return 1;
  if (linkMode.value === 'mitarbeiter' && !form.value.mitarbeiterId) return 1;
  return 3;
});

const canSubmit = computed(() => {
  if (!canAdvance.value) return false;
  const subs = form.value.submitters.filter(s => (s.name || '').trim());
  if (!subs.length) return false;
  // Every non-embedded signer must have an email (they receive the link by mail)
  return subs.every(s => s.embedded || (s.email || '').trim());
});

const submitBlockReason = computed(() => {
  const subs = form.value.submitters.filter(s => (s.name || '').trim());
  for (const s of subs) {
    if (!s.embedded && !(s.email || '').trim()) {
      return `${s.role || 'Unterzeichner'} muss eine E-Mail-Adresse haben (Signatur wird per E-Mail versandt).`;
    }
  }
  return '';
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function typIcon(key) {
  return {
    stundenliste:          ['fas', 'clock'],
    preisblatt:            ['fas', 'tags'],
    auerv:                 ['fas', 'file-contract'],
    arbeitsvertrag:        ['fas', 'file-contract'],
    lohnvorschuss:         ['fas', 'money-bill-wave'],
    reisekostenabrechnung: ['fas', 'car'],
  }[key] || ['fas', 'file-signature'];
}

function linkLabel(linkedTo) {
  return { Kunde: 'Kunde', Mitarbeiter: 'Mitarbeiter', Both: 'Kunde / MA', None: '—' }[linkedTo] || '';
}

function isLinkAllowed(key) {
  const lt = form.value.typLinkedTo;
  if (key === 'keine') return true;
  if (lt === 'Both') return true;
  if (key === 'kunde') return lt === 'Kunde';
  if (key === 'mitarbeiter') return lt === 'Mitarbeiter';
  return true;
}

function selectTyp(t, clearTemplate = true) {
  form.value.typId = t._id;
  form.value.typKey = t.key;
  form.value.typLinkedTo = t.linkedTo;
  // Only clear template when user manually picks a different type
  if (clearTemplate) {
    form.value.templateId = null;
    form.value.templateName = '';
  }
  // Auto-pick link mode only for Kunde types; Mitarbeiter may not exist yet
  if (t.linkedTo === 'Kunde') linkMode.value = 'kunde';
}

function selectTemplateChip(tpl) {
  // Toggle off if already selected
  if (form.value.templateId === tpl.id) {
    form.value.templateId = null;
    form.value.templateName = '';
    return;
  }
  form.value.templateId = tpl.id;
  form.value.templateName = tpl.name;
  applyTemplateDefaults(tpl);
}

const templatesForTyp = computed(() =>
  templates.value.filter(t => t.defaultTypId && t.defaultTypId === form.value.typId)
);

function setLinkMode(key) {
  if (!isLinkAllowed(key)) return;
  linkMode.value = key;
  if (key !== 'kunde') { form.value.kundeId = null; }
  if (key !== 'mitarbeiter') { form.value.mitarbeiterId = null; }
}

function selectKunde(k) {
  form.value.kundeId = k._id;
  kundeOpen.value = false;
  kundeQuery.value = '';
}
function clearKunde() { form.value.kundeId = null; }

function selectMitarbeiter(m) {
  form.value.mitarbeiterId = m._id;
  maOpen.value = false;
  maQuery.value = '';
}
function clearMitarbeiter() { form.value.mitarbeiterId = null; }

function onTemplateChange() {
  const t = templates.value.find(t => t.id === form.value.templateId);
  form.value.templateName = t ? t.name : '';
  applyTemplateDefaults(t);
}

function applyTemplateDefaults(template) {
  if (!template) return;
  const defaultTyp = typen.value.find(typ => typ._id === template.defaultTypId);
  if (defaultTyp) selectTyp(defaultTyp, false);
  // Restore template — selectTyp would clear it if clearTemplate were true
  form.value.templateId = template.id;
  form.value.templateName = template.name;
  if (!form.value.name.trim()) {
    const documentTypeLabel = defaultTyp?.label || 'Dokument';
    const now = new Date();
    const date = [now.getDate(), now.getMonth() + 1, now.getFullYear()]
      .map((value, index) => index < 2 ? String(value).padStart(2, '0') : value)
      .join('-');
    form.value.name = `${documentTypeLabel} | ${template.name} | ${date}`;
  }
  // Pre-fill submitter rows from template roles when user hasn't filled any in yet
  const tplSubmitters = Array.isArray(template.submitters) ? template.submitters : [];
  if (tplSubmitters.length) {
    const current = form.value.submitters;
    const untouched = current.every(s => !s.name && !s.email);
    if (untouched) {
      form.value.submitters = tplSubmitters.map(s => ({
        role: s.name || 'Unterzeichner',
        name: '',
        email: '',
        embedded: false,
      }));
    }
  }
}

function addSubmitter() {
  form.value.submitters.push({ role: `Unterzeichner ${form.value.submitters.length}`, name: '', email: '', embedded: false });
}
function removeSubmitter(i) {
  form.value.submitters.splice(i, 1);
}

function normalizeSubmitterNames() {
  form.value.submitters = form.value.submitters.map(submitter => {
    const email = String(submitter.email || '').trim().toLowerCase();
    const mitarbeiter = submitter.mitarbeiterId
      ? mitarbeiterList.value.find(m => m._id === submitter.mitarbeiterId)
      : mitarbeiterList.value.find(m => String(m.email || '').trim().toLowerCase() === email);
    if (mitarbeiter) {
      return { ...submitter, name: `${mitarbeiter.vorname || ''} ${mitarbeiter.nachname || ''}`.trim() || submitter.name };
    }
    const contact = graphContacts.value.find(c => String(c.emailAddresses?.[0]?.address || '').trim().toLowerCase() === email);
    const name = [contact?.givenName, contact?.surname].filter(Boolean).join(' ') || contact?.displayName;
    return name ? { ...submitter, name } : submitter;
  });
}

// ── Auto-fill signers when entering step 3 ───────────────────────────────────
watch(currentStep, (newStep) => {
  if (newStep !== 2) return;
  // Skip if this is a custom-endpoint flow (submitters are pre-set via context)
  if (usesCustomEndpoint.value) return;
  // Skip if user has already filled in signers
  const subs = form.value.submitters;
  const isDefault = subs.length === 1 && !subs[0].name && !subs[0].email;
  if (!isDefault) return;

  const newSubs = [];

  // Signer 1: Straightforward location contact
  const sfKunde = straightforwardKunde.value;
  if (sfKunde) {
    newSubs.push({
      role: 'Du',
      name: sfKunde.kundName || '',
      email: sfKunde.signaturKontaktEmail || '',
      embedded: true,
    });
  } else {
    newSubs.push({ role: 'Du', name: '', email: '', embedded: true });
  }

  // Signer 2: selected Mitarbeiter (if any)
  if (selectedMitarbeiter.value) {
    const m = selectedMitarbeiter.value;
    newSubs.push({
      role: 'Unterzeichner 1',
      name: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
      email: m.email || '',
      embedded: false,
    });
  } else {
    newSubs.push({ role: 'Unterzeichner 1', name: '', email: '', embedded: false });
  }

  form.value.submitters = newSubs;
});

function openBuilder() {
  builder.openBuilder(
    { templateId: form.value.templateId || null, name: form.value.name || null },
    (tpl) => {
      if (tpl && tpl.id) {
        loadTemplates();
        form.value.templateId = tpl.id;
        form.value.templateName = tpl.name || '';
      }
    }
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────
async function loadTypen() {
  typenLoading.value = true;
  try {
    const { data } = await api.get('/api/signatur-typen');
    typen.value = (Array.isArray(data) ? data : []).sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (e) {
    console.error('Typen laden fehlgeschlagen', e);
  } finally {
    typenLoading.value = false;
  }
}

async function loadLocations() {
  try {
    const { data } = await api.get('/api/locations');
    locations.value = Array.isArray(data) ? data : [];
    if (form.value.locationId) return;

    const legacyLocation = String(auth.user?.location || '').trim().toLowerCase();
    const match = locations.value.find((location) =>
      location.nameKey === legacyLocation || location.shortNameKey === legacyLocation
    );
    if (match) form.value.locationId = match._id;
  } catch (e) {
    console.error('Locations laden fehlgeschlagen', e);
  }
}

async function loadTemplates() {
  try {
    const { data } = await api.get('/api/docuseal/templates');
    templates.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Templates laden fehlgeschlagen', e);
  }
}

async function loadGraphContacts() {
  try {
    const { data } = await api.get('/api/graph/contacts');
    graphContacts.value = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);
  } catch (e) {
    console.error('Kontakte laden fehlgeschlagen', e);
  }
}

// ── Open / context hydration ─────────────────────────────────────────────────
watch(() => modal.open, async (open) => {
  if (!open) return;
  // Reset
  currentStep.value = 0;
  error.value = '';
  showCloseConfirm.value = false;
  form.value = emptyForm();
  linkMode.value = 'keine';
  folgeaktionen.value = { ausliefernAn: [], ausliefernAnSignierer: true, emailBenachrichtigung: true, asanaActions: [] };
  deliveryRecipient.value = { name: '', email: '', embedded: false };
  deliveryPickerKey.value += 1;
  newEmailError.value = '';
  followerDefaultsLoaded.value = false;
  showAsanaBuilder.value = false;
  asanaSearchQuery.value = '';
  asanaSearchResults.value = [];
  pendingAction.value = { taskGid: '', taskName: '', type: 'complete', comment: '' };

  // Kick off data loads
  const typenRequest = loadTypen();
  loadLocations();
  const templatesRequest = loadTemplates();
  const graphContactsRequest = loadGraphContacts();
  const kundenRequest = dataCache.loadKunden?.();
  const mitarbeiterRequest = dataCache.loadMitarbeiter?.();

  await Promise.all([typenRequest, templatesRequest, graphContactsRequest, kundenRequest, mitarbeiterRequest]);
  await hydrateFromContext();
  normalizeSubmitterNames();
  addSignerDeliveryRecipients();
});

async function hydrateFromContext() {
  const ctx = modal.context;

  // ── Draft editing: restore full draft state ──────────────────────────────
  if (ctx.draftData) {
    const d = ctx.draftData;
    form.value.name     = d.name     || '';
    form.value.locationId = typeof d.locationV2 === 'object' ? d.locationV2?._id || null : d.locationV2 || null;

    // Restore typ (populated object or ObjectId string)
    if (d.typ && typeof d.typ === 'object') {
      form.value.typId      = d.typ._id || String(d.typ);
      form.value.typKey     = d.typKey  || d.typ.key || null;
      form.value.typLinkedTo = d.typ.linkedTo || 'Both';
      if (d.typ.linkedTo === 'Kunde')       linkMode.value = 'kunde';
      else if (d.typ.linkedTo === 'Mitarbeiter') linkMode.value = 'mitarbeiter';
    }

    // Restore entity links
    if (d.kunde) {
      form.value.kundeId = typeof d.kunde === 'object' ? (d.kunde._id || String(d.kunde)) : d.kunde;
      linkMode.value = 'kunde';
    } else if (d.mitarbeiter) {
      form.value.mitarbeiterId = typeof d.mitarbeiter === 'object' ? (d.mitarbeiter._id || String(d.mitarbeiter)) : d.mitarbeiter;
      linkMode.value = 'mitarbeiter';
    }

    // Restore template
    if (d.docusealTemplateId) {
      form.value.templateId   = d.docusealTemplateId;
      form.value.templateName = d.docusealTemplateName || '';
    }

    // Restore submitters
    if (Array.isArray(d.submitters) && d.submitters.length) {
      form.value.submitters = d.submitters.map(s => ({
        role:     s.role     || 'Unterzeichner',
        name:     s.name     || '',
        email:    s.email    || '',
        embedded: !!s.embedded,
      }));
    }

    // Restore folgeaktionen
    if (d.folgeaktionen) {
      folgeaktionen.value = {
        ausliefernAn:          Array.isArray(d.folgeaktionen.ausliefernAn) ? d.folgeaktionen.ausliefernAn : [],
        ausliefernAnSignierer: d.folgeaktionen.ausliefernAnSignierer !== false,
        emailBenachrichtigung: d.folgeaktionen.emailBenachrichtigung !== false,
        asanaActions:          Array.isArray(d.folgeaktionen.asanaActions) ? d.folgeaktionen.asanaActions : [],
      };
    }
    if (ctx.customEndpoint && form.value.typId) currentStep.value = 2;
    return;
  }

  // ── Standard pre-fill from context ──────────────────────────────────────
  if (ctx.name)    form.value.name    = ctx.name;
  if (ctx.locationId) form.value.locationId = ctx.locationId;

  // Pre-select type by key
  if (ctx.typKey) {
    await loadTypen();
    const t = typen.value.find(t => t.key === ctx.typKey);
    if (t) selectTyp(t);
  }

  // Pre-select entity links
  if (ctx.kundeId) {
    form.value.kundeId = ctx.kundeId;
    linkMode.value = 'kunde';
  } else if (ctx.kundenKuerzel) {
    await dataCache.loadKunden?.();
    const k = (dataCache.kunden || []).find(k => (k.kuerzel || '').toLowerCase() === ctx.kundenKuerzel.toLowerCase());
    if (k) { form.value.kundeId = k._id; linkMode.value = 'kunde'; }
  }
  if (ctx.mitarbeiterId) {
    form.value.mitarbeiterId = ctx.mitarbeiterId;
    linkMode.value = 'mitarbeiter';
  }

  // Pre-fill submitters
  if (Array.isArray(ctx.submitters) && ctx.submitters.length) {
    form.value.submitters = ctx.submitters.map(s => ({
      role: s.role || 'Unterzeichner',
      name: s.name || '',
      email: s.email || '',
      embedded: !!s.embedded,
    }));
  }

  if (ctx.typKey === 'reisekostenabrechnung' && ctx.mitarbeiterId) {
    await dataCache.loadMitarbeiter?.();
    const linkedMitarbeiter = (dataCache.mitarbeiter || []).find(m => m._id === ctx.mitarbeiterId);
    if (linkedMitarbeiter) {
      form.value.submitters = form.value.submitters.map(submitter =>
        submitter.role === 'Mitarbeiter'
          ? {
              ...submitter,
              name: submitter.name || `${linkedMitarbeiter.vorname || ''} ${linkedMitarbeiter.nachname || ''}`.trim(),
              email: submitter.email || linkedMitarbeiter.email || '',
            }
          : submitter
      );
    }
  }

  // Pre-select DocuSeal template
  if (ctx.templateId) {
    form.value.templateId   = ctx.templateId;
    form.value.templateName = ctx.templateName || '';
    applyTemplateDefaults(templates.value.find(t => t.id === ctx.templateId));
  }

  if (ctx.customEndpoint && form.value.typId) {
    currentStep.value = isGeneratedDocumentFlow.value ? 0 : (form.value.kundeId || form.value.mitarbeiterId ? 2 : 1);
  }
  addReisekostenDefaultDeliveryEmail();
}

// ── Submit ───────────────────────────────────────────────────────────────────
async function submit() {
  submitting.value = true;
  error.value = '';
  try {
    const ctx = modal.context;
    let vorgang;

    if (ctx.customEndpoint) {
      // Generated-document flows promote their pre-created draft through their
      // specialised endpoint so the same SignaturVorgang remains the record.
      const payload = {
        name: form.value.name.trim(),
        typId: form.value.typId,
        locationId: form.value.locationId,
        kundeId: linkMode.value === 'kunde' ? form.value.kundeId : undefined,
        mitarbeiterId: linkMode.value === 'mitarbeiter' ? form.value.mitarbeiterId : undefined,
        submitters: form.value.submitters.filter(s => (s.name || '').trim()),
        folgeaktionen: folgeaktionen.value,
        draftId: ctx.draftId || undefined,
      };
      const { data } = await api.post(ctx.customEndpoint, payload);
      vorgang = data;
    } else if (ctx.draftId) {
      // Editing an existing draft → PATCH with submit: true
      const payload = {
        name: form.value.name.trim(),
        typId: form.value.typId,
        locationId: form.value.locationId,
        kundeId: linkMode.value === 'kunde' ? form.value.kundeId : undefined,
        mitarbeiterId: linkMode.value === 'mitarbeiter' ? form.value.mitarbeiterId : undefined,
        templateId: form.value.templateId ?? null,
        templateName: form.value.templateName || '',
        submitters: form.value.submitters.filter(s => (s.name || '').trim()),
        folgeaktionen: folgeaktionen.value,
        submit: true,
      };
      const { data } = await api.patch(`/api/signaturen/${ctx.draftId}`, payload);
      vorgang = data;
    } else {
      const payload = {
        name: form.value.name.trim(),
        typId: form.value.typId,
        locationId: form.value.locationId,
        kundeId: linkMode.value === 'kunde' ? form.value.kundeId : undefined,
        mitarbeiterId: linkMode.value === 'mitarbeiter' ? form.value.mitarbeiterId : undefined,
        templateId: form.value.templateId || undefined,
        templateName: form.value.templateName || undefined,
        submitters: form.value.submitters.filter(s => (s.name || '').trim()),
        folgeaktionen: folgeaktionen.value,
      };
      const { data } = await api.post('/api/signaturen', payload);
      vorgang = data;
    }

    const signingRecord = vorgang?.vorgang || vorgang;
    const signersBySrc = new Map();
    for (const submitter of (signingRecord?.submitters || [])) {
      const signingSrc = submitter.embedSrc || (submitter.slug ? `https://docuseal.eu/s/${submitter.slug}` : '');
      if (submitter.embedded && signingSrc && submitter.status !== 'completed') {
        signersBySrc.set(signingSrc, {
          src: signingSrc,
          role: submitter.role || '',
          name: submitter.name || '',
          email: submitter.email || '',
        });
      }
    }
    if (vorgang?.embed?.src && !signersBySrc.has(vorgang.embed.src)) {
      signersBySrc.set(vorgang.embed.src, {
        src: vorgang.embed.src,
        role: vorgang.embed.role || '',
        name: '',
        email: '',
      });
    }
    const signingSession = signersBySrc.size
      ? { title: signingRecord?.name || form.value.name.trim(), signers: [...signersBySrc.values()] }
      : null;

    modal.notifyCreated(vorgang);
    closeWithoutPrompt();
    if (signingSession) inAppSigning.value = signingSession;
  } catch (e) {
    console.error('Signatur erstellen fehlgeschlagen', e);
    error.value = e?.response?.data?.message || 'Die Signatur konnte nicht erstellt werden.';
  } finally {
    submitting.value = false;
  }
}

async function saveAsDraft() {
  if (!canSaveDraft.value) return;
  savingDraft.value = true;
  error.value = '';
  try {
    const ctx = modal.context;
    const payload = {
      name: form.value.name.trim(),
      typId: form.value.typId,
      locationId: form.value.locationId,
      kundeId: linkMode.value === 'kunde' ? form.value.kundeId : null,
      mitarbeiterId: linkMode.value === 'mitarbeiter' ? form.value.mitarbeiterId : null,
      templateId: form.value.templateId ?? null,
      templateName: form.value.templateName || '',
      submitters: form.value.submitters.filter(s => (s.name || '').trim()),
      folgeaktionen: folgeaktionen.value,
      draft: true,
    };
    if (ctx.draftId) {
      const { data: updatedDraft } = await api.patch(`/api/signaturen/${ctx.draftId}`, payload);
      if (ctx.draftData && updatedDraft) Object.assign(ctx.draftData, updatedDraft);
    } else {
      await api.post('/api/signaturen', payload);
    }
    // Do NOT call notifyCreated — callers like AuftraegePage expect a full submission
    // response (with embed.src), not a draft. The SignaturenPage list updates via SSE.
    closeWithoutPrompt();
  } catch (e) {
    console.error('Entwurf speichern fehlgeschlagen', e);
    error.value = e?.response?.data?.message || 'Entwurf konnte nicht gespeichert werden.';
  } finally {
    savingDraft.value = false;
  }
}

function close() {
  // Prompt to save only for new non-customEndpoint signatures with filled data
  if (!modal.context.draftId && !modal.context.customEndpoint && canSaveDraft.value && !submitting.value) {
    showCloseConfirm.value = true;
    return;
  }
  closeWithoutPrompt();
}

function confirmDiscard() {
  showCloseConfirm.value = false;
  modal.closeModal();
}

function closeWithoutPrompt() {
  showCloseConfirm.value = false;
  modal.closeModal();
}

// Close typeahead dropdowns on outside click
function onDocClick(e) {
  if (kundeBox.value && !kundeBox.value.contains(e.target)) kundeOpen.value = false;
  if (maBox.value && !maBox.value.contains(e.target)) maOpen.value = false;
}
document.addEventListener('click', onDocClick);
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

// Small inline component for a selected entity card
const ContactSearchPlaceholder = {
  props: { title: String, subtitle: String, warn: Boolean },
  emits: ['clear'],
  setup(props, { emit }) {
    return () => h('div', { class: ['sig-selected-entity', { warn: props.warn }] }, [
      h('div', { class: 'sig-selected-entity-info' }, [
        h('div', { class: 'sig-selected-entity-title' }, props.title),
        h('div', { class: 'sig-selected-entity-sub' }, props.subtitle),
      ]),
      h('button', { class: 'sig-selected-entity-clear', type: 'button', onClick: () => emit('clear') }, '✕'),
    ]);
  },
};
</script>

<style scoped lang="scss">
.sig-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.sig-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--primary);
  h2 { font-size: 1.15rem; font-weight: 700; color: var(--text); margin: 0; }
}

/* Steps */
.sig-steps {
  display: flex;
  gap: 4px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border);
}

.sig-step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 600;
  opacity: 0.55;

  &.reachable { opacity: 1; }
  &.active { color: var(--primary); }
  &.done { color: var(--text); }
  &:disabled { cursor: default; }
}

.sig-step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  flex-shrink: 0;
}
.sig-step.active .sig-step-num { background: var(--primary); color: #fff; border-color: var(--primary); }
.sig-step.done .sig-step-num { background: #10b981; color: #fff; border-color: #10b981; }

.sig-step-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Body */
.sig-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
}

.sig-section { display: flex; flex-direction: column; }

.sig-field-label {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin: 14px 0 8px;
  &:first-child { margin-top: 0; }
}

.sig-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.sig-fixed-type {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 55%, var(--border));
  border-radius: 9px;
  background: color-mix(in srgb, var(--primary) 6%, var(--surface));
  color: var(--primary);

  > svg:first-child { width: 20px; font-size: 1.05rem; }
  > span { flex: 1; min-width: 0; }
  strong, small { display: block; }
  strong { color: var(--text); font-size: 0.88rem; }
  small { margin-top: 2px; color: var(--muted); font-size: 0.7rem; }
  .sig-fixed-type-lock { color: var(--muted); font-size: 0.75rem; }
}

.sig-email-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    accent-color: var(--primary);
  }
  span { min-width: 0; }
  strong, small { display: block; }
  strong { color: var(--text); font-size: 0.82rem; }
  small { margin-top: 2px; color: var(--muted); font-size: 0.72rem; }
}

.sig-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--tile-bg, var(--surface));
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  text-align: center;

  &:hover { border-color: color-mix(in srgb, var(--primary) 50%, var(--border)); transform: translateY(-1px); }
  &.active {
    border-color: var(--primary);
    box-shadow: inset 0 0 0 1px var(--primary);
  }
  &--add { border-style: dashed; color: var(--muted); }

  .sig-type-icon { font-size: 1.3rem; color: var(--primary); }
  &--add .sig-type-icon { color: var(--muted); }
  .sig-type-label { font-size: 0.85rem; font-weight: 600; color: var(--text); }
  .sig-type-link { font-size: 0.68rem; color: var(--muted); }
}

.sig-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }

.sig-input, .sig-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg, var(--surface));
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  &:focus { border-color: var(--primary); }
}

/* Link toggle */
.sig-link-toggle { display: flex; gap: 8px; }
.sig-link-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  background: var(--tile-bg, var(--surface));
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  &.active { border-color: var(--primary); color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.sig-link-search { margin-top: 14px; }

.sig-typeahead { position: relative; }
.sig-search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--bg, var(--surface));
  color: var(--muted);
  input { flex: 1; border: none; outline: none; background: transparent; color: var(--text); font-size: 0.9rem; font-family: inherit; }
}

.sig-typeahead-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  max-height: 420px;
  overflow-y: auto;
  padding: 4px;
}
.sig-typeahead-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  text-align: left;
  &:hover { background: var(--hover); }
  .sig-ta-name { flex: 1; font-size: 0.86rem; font-weight: 600; color: var(--text); }
  .sig-ta-kuerzel { font-size: 0.76rem; color: var(--muted); }
  .sig-ta-warn { font-size: 0.72rem; color: #f59e0b; font-weight: 600; }
}

.sig-selected-entity {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1.5px solid var(--primary);
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary) 6%, transparent);
  &.warn { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 8%, transparent); }
  :deep(.sig-selected-entity-info) { flex: 1; }
  :deep(.sig-selected-entity-title) { font-size: 0.92rem; font-weight: 700; color: var(--text); }
  :deep(.sig-selected-entity-sub) { font-size: 0.78rem; color: var(--muted); }
  :deep(.sig-selected-entity-clear) {
    background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.95rem;
    &:hover { color: #ef4444; }
  }
}

.sig-warn {
  margin-top: 10px;
  font-size: 0.8rem;
  color: #f59e0b;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sig-hint {
  margin-top: 14px;
  font-size: 0.82rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 8px;
  code { background: var(--hover); padding: 2px 6px; border-radius: 5px; font-size: 0.78rem; }
}

.sig-tpl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}
.sig-tpl-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg, var(--surface));
  color: var(--text);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  &:hover { border-color: var(--primary); color: var(--primary); }
  &.active {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary);
    font-weight: 600;
  }
}

.sig-template-row { display: flex; gap: 8px; align-items: stretch; }
.sig-template-row .sig-select { flex: 1; }
.sig-template-auto {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  color: var(--text);
  font-size: 0.86rem;
  svg { color: var(--primary); }
}

.sig-submitters { display: flex; flex-direction: column; gap: 10px; }

.sig-add-submitter {
  margin-top: 12px;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1.5px dashed var(--border);
  border-radius: 9px;
  background: none;
  color: var(--primary);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, transparent); }
}

.sig-loading-inline { color: var(--muted); font-size: 0.85rem; display: flex; gap: 8px; align-items: center; padding: 12px 0; }

/* Footer */
.sig-footer {
  border-top: 1px solid var(--border);
  padding: 14px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sig-error {
  font-size: 0.82rem;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sig-footer-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.sig-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 9px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;

  &--primary {
    background: var(--primary);
    color: #fff;
    &:hover:not(:disabled) { background: color-mix(in srgb, var(--primary) 88%, #000); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  &--ghost {
    background: none;
    border-color: var(--border);
    color: var(--text);
    &:hover { background: var(--hover); }
  }
}

/* Close confirm overlay */
.sig-close-confirm {
  border-top: 1px solid var(--border);
  padding: 14px 22px;
  background: color-mix(in srgb, var(--surface) 96%, var(--primary));
}
.sig-close-confirm-msg {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 10px;
}
.sig-close-confirm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Save-draft ghost button variant */
.sig-btn--save-draft {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
  &:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); border-color: var(--primary); }
}

/* ── Folgeaktionen — Ausliefern an ──────────────────────────── */
.sig-email-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.sig-email-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
  border-radius: 20px;
  font-size: 0.82rem;
  color: var(--text);
}
.sig-email-chip small { color: var(--muted); font-size: 0.72rem; }
.sig-chip-remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  &:hover { color: #ef4444; }
}
.sig-email-add-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
  .contact-picker { flex: 1; }
}

/* ── Folgeaktionen — Asana ──────────────────────────────────── */
.sig-asana-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.sig-asana-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--tile-bg, var(--surface));
}
.sig-asana-type-icon {
  font-size: 0.9rem;
  &.sig-asana-type--complete { color: #10b981; }
  &.sig-asana-type--comment  { color: var(--primary); }
  &.sig-asana-type--delete   { color: #ef4444; }
}
.sig-asana-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sig-asana-action-label  { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--muted); }
.sig-asana-task-name     { font-size: 0.86rem; font-weight: 600; color: var(--text); }
.sig-asana-comment-preview { font-size: 0.78rem; color: var(--muted); font-style: italic; }

.sig-asana-builder {
  padding: 12px;
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 8px;
}
.sig-asana-action-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sig-select--inline { width: auto; min-width: 160px; }
.sig-textarea { resize: vertical; min-height: 52px; }

// ── Follower suggestions (Kontakte des Kunden) ──────────────────────────────
.sig-follower-suggestions {
  margin-bottom: 14px;
  padding: 12px 14px;
  background: color-mix(in oklab, var(--primary) 5%, transparent);
  border: 1px solid color-mix(in oklab, var(--primary) 22%, var(--border));
  border-radius: 10px;
}

.sig-follower-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.sig-follower-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--primary);

  svg { font-size: 0.8rem; }
}

.sig-follower-loading {
  font-size: 0.78rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 5px;
}

.sig-follower-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
  border-radius: 7px;
  background: transparent;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: color-mix(in oklab, var(--primary) 10%, transparent); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.sig-follower-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sig-follower-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  background: var(--hover);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  transition: opacity 0.12s, transform 0.1s;

  &:hover { opacity: 0.85; transform: scale(1.03); }

  &.selected {
    border-color: var(--primary) !important;
    background: color-mix(in oklab, var(--primary) 15%, transparent) !important;
    color: var(--primary) !important;

    .sig-follower-chip-icon { color: var(--primary); }
  }

  .sig-follower-chip-icon {
    font-size: 0.7rem;
    opacity: 0.6;
    flex-shrink: 0;
  }
  .sig-follower-chip-name {
    line-height: 1.3;
  }
}
</style>
