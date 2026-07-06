import { defineStore } from 'pinia';

/**
 * signaturModal — global state for the universal "Neue Signatur" modal.
 *
 * The modal (<SignaturNeuModal>) is mounted once in MainLayout.vue and can be
 * opened from anywhere in the app via openModal(context). Typical callers:
 *   - SignaturenPage "Neue Signatur" button (empty context)
 *   - AuftraegePage Stundenliste action (pre-filled auftragNr + submitters)
 *
 * After a Vorgang is created, the registered onCreated callback (if any) fires
 * so the opening page can react (e.g. show the embedded signing form, or refresh
 * its list — the SignaturenPage also receives it live via SSE).
 */
const emptyContext = () => ({
  auftragNr: null,        // links the created Vorgang to an Auftrag (Stundenliste flow)
  kundeId: null,          // pre-selects a Kunde entity
  kundenKuerzel: null,    // for contact filtering + R2 path
  mitarbeiterId: null,    // pre-selects a Mitarbeiter entity
  typKey: null,           // e.g. 'stundenliste' → pre-selects the type, skips step 1
  name: null,             // pre-filled document name
  standort: null,         // pre-selected Standort (team key)
  submitters: [],         // pre-filled submitter rows [{ role, name, email, embedded }]
  // Optional: an existing endpoint to call instead of the generic POST /api/signaturen.
  // Used by the Stundenliste flow which generates the PDF server-side.
  customEndpoint: null,   // e.g. '/api/docuseal/stundenliste/12345'
  // Draft editing: set these to re-open an existing draft for editing.
  draftId: null,          // ObjectId of the existing draft SignaturVorgang
  draftData: null,        // full draft object (populated from list) for form pre-fill
});

export const useSignaturModal = defineStore('signaturModal', {
  state: () => ({
    open: false,
    context: emptyContext(),
    _onCreated: null,
  }),

  actions: {
    /**
     * Open the modal with optional pre-fill context.
     * @param {object} contextOverrides - partial context (see emptyContext)
     * @param {function} [onCreated] - callback invoked with the created Vorgang
     */
    openModal(contextOverrides = {}, onCreated = null) {
      this.context = { ...emptyContext(), ...contextOverrides };
      this._onCreated = typeof onCreated === 'function' ? onCreated : null;
      this.open = true;
    },

    closeModal() {
      this.open = false;
      this.context = emptyContext();
      this._onCreated = null;
    },

    /** Invoked by the modal after a successful creation. */
    notifyCreated(vorgang) {
      if (this._onCreated) {
        try { this._onCreated(vorgang); } catch (_) { /* ignore */ }
      }
    },
  },
});
