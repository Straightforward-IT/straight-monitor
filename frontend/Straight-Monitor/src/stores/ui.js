import { defineStore } from 'pinia';

export const useUi = defineStore('ui', {
  state: () => ({
    panelType: null,   // 'shortcuts' | 'tools' | 'flip' | null
    hidden: false,     // vom User manuell geschlossen?
  }),
  getters: {
    isOpen: (s) => !s.hidden && (s.panelType !== null || true),
  },
  actions: {
    open(type){ this.hidden = false; this.panelType = type; },
    close(){ this.hidden = true; this.panelType = null; },

    // Klassisches Toggle (ohne Default-Wissen)
    toggle(type){
      const same = this.panelType === type && !this.hidden;
      if (same) this.close(); else this.open(type);
    },

    // Schlaues Toggle: berücksichtigt, dass das Panel auch
    // durch die Routen-"Defaults" sichtbar sein kann
    toggleSmart(type, currentDefault){
      const showingDefault = !this.panelType && !this.hidden && currentDefault === type;
      if (this.panelType === type || showingDefault) this.close();
      else this.open(type);
    }
  }
});
