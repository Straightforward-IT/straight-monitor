import { defineStore } from 'pinia';

/**
 * signaturBuilder — global state for the embedded DocuSeal template builder modal.
 *
 * <SignaturTemplateBuilderModal> is mounted once in MainLayout.vue. It can be opened:
 *   - from the SignaturenPage "Templates" tab (create/edit a template)
 *   - from inside SignaturNeuModal ("Vorlage bearbeiten/erstellen")
 *
 * The builder loads a DocuSeal JWT from GET /api/signaturen/builder-token. When a
 * template is saved, the registered onSaved callback fires with the template data
 * so the caller can pick up the new templateId.
 */
export const useSignaturBuilder = defineStore('signaturBuilder', {
  state: () => ({
    open: false,
    templateId: null,   // null → create new template
    name: null,         // suggested name for a new template
    _onSaved: null,
  }),

  actions: {
    openBuilder({ templateId = null, name = null } = {}, onSaved = null) {
      this.templateId = templateId;
      this.name = name;
      this._onSaved = typeof onSaved === 'function' ? onSaved : null;
      this.open = true;
    },

    closeBuilder() {
      this.open = false;
      this.templateId = null;
      this.name = null;
      this._onSaved = null;
    },

    notifySaved(template) {
      if (this._onSaved) {
        try { this._onSaved(template); } catch (_) { /* ignore */ }
      }
    },
  },
});
