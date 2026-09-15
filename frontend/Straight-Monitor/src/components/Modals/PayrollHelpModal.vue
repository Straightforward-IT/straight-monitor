<template>
  <HelpModal
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>Stundenerfassung — Anleitung</template>
    <template #toc>
      <nav class="help-toc" aria-label="Inhalt der Anleitung">
        <span class="help-toc-label">Inhalt</span>
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          :data-section="section.id"
          @click="scrollToSection(section.id)"
        >
          {{ section.label }}
        </button>
      </nav>
    </template>

    <section id="payroll-help-start" class="help-section">
      <h4>1. Mitarbeiter und Monat auswählen</h4>
      <p>Suche den Mitarbeiter in der Toolbar und wähle den Monat. Die Mitarbeiterkarte lässt sich für weitere Informationen aufklappen. Der Kalender zeigt die Einträge des Monats, rechts daneben oder darunter stehen Monatsprognose und Zeitkonto.</p>
      <p>„Stand neu laden“ lädt die gespeicherten Daten erneut. Lokale Änderungen in der Vorschau werden dabei zurückgesetzt.</p>
    </section>

    <section id="payroll-help-capture" class="help-section">
      <h4>2. Stunden erfassen und übergeben</h4>
      <p>Mitarbeiter können ihre eigenen Stunden einmalig in der Mitarbeiter-App einreichen. Anschließend bearbeitet ein interner Benutzer die Zeiten und Pausen in der Stundenschnellerfassung.</p>
      <p>Öffne die Schnellerfassung über die Toolbar oder über „Erfassen“ im Kalender. „Entwurf speichern“ sichert die Bearbeitung; „An Zeitverwaltung übergeben“ übernimmt die geprüften Zeiten in diese Monatsansicht.</p>
      <p>Noch nicht übergebene Einsätze stehen als Planung im Kalender. Ihre Stunden können erst nach der Übergabe mit dem Eimer bearbeitet werden.</p>
    </section>

    <section id="payroll-help-day" class="help-section">
      <h4>3. Einen Tag öffnen</h4>
      <p>Klicke auf die Tagesnummer im Kalender. Das Seitenpanel zeigt die Auftragsdokumente dieses Tages sowie „Detailerfassung“, „Schichten &amp; Zeiten“, „Fehlzeiten“ und das Änderungsprotokoll. Das Protokoll umfasst die lokalen Änderungen des gesamten Monats.</p>
      <p>Dokumente werden je Auftrag einmal angezeigt. Klicke auf ein Dokument, um es anzusehen. Über das Drei-Punkte-Menü im Panel-Kopf öffnest du die Stundenschnellerfassung für den jeweiligen Auftrag.</p>
      <p>Mit „Tageseintrag“ legst du beispielsweise Urlaub, Krankheit oder eine Stundenkorrektur an. Bei bearbeitbaren Kalendereinträgen öffnet ein Klick auf das Kürzel links, etwa P, U oder K, die Auswahl der Eintragsart.</p>
    </section>

    <section id="payroll-help-bucket" class="help-section">
      <h4>4. Stunden mit dem Eimer verschieben</h4>
      <p>Aktiviere zuerst „Eimer“ in der Toolbar. Der Modus ist beim Öffnen der Seite ausgeschaltet; normale Klicks öffnen dann die Tagesdetails. „Eimer aktiv“ zeigt, dass Sammeln und Ablegen eingeschaltet sind. Der normale Mauszeiger bleibt sichtbar.</p>
      <p>Ein erneuter Klick auf den Eimer schaltet den Modus aus und setzt eine noch laufende Sammlung zurück. Bereits abgeschlossene Umbuchungen bleiben in der Vorschau erhalten.</p>
      <p>Rechtsklick auf bearbeitbare Stunden oder das Zeitkonto sammelt jeweils eine Stunde. Der Eimer neben dem Mauszeiger zeigt die gesammelte Menge. Im Modus „Ablegen“ legt ein Linksklick jeweils eine Stunde am Ziel ab.</p>
      <p>Beispiel: Sammle zwei Stunden aus Schicht A und vier Stunden aus Schicht B. Klicke anschließend mit gedrückter Shift-Taste auf das Zeitkonto, um alle sechs Stunden dort abzulegen. Das Seitenpanel kannst du dabei schließen; die Stunden bleiben im Eimer.</p>
      <p>Unter „Detailerfassung“ kannst du über „Neue Stunden“ zusätzliche Stunden sammeln oder mit „Entfernen“ gesammelte Stunden aus der Vorschau herausnehmen. Die Auswahl neben „Neue Stunden“ bestimmt die Menge bei Shift + Rechtsklick.</p>
      <p>Ohne Rechtsklick wechselst du über „Sammeln“ und „Ablegen“ den Modus für den Linksklick. „Minuten“ öffnet die genaue Mengenauswahl auch ohne Tastenkombination.</p>
    </section>

    <section id="payroll-help-shortcuts" class="help-section">
      <h4>Maus und Tastatur</h4>
      <table class="help-shortcuts" aria-label="Eimer-Bedienung">
        <tbody>
          <tr><td><kbd>Rechtsklick</kbd></td><td>Eine Stunde sammeln; bei weniger Restzeit den verbleibenden Betrag.</td></tr>
          <tr><td><kbd>Linksklick</kbd></td><td>Im Modus „Ablegen“ eine Stunde am Ziel ablegen.</td></tr>
          <tr><td><kbd>Shift</kbd> + Klick</td><td>Alle verfügbaren Stunden sammeln oder den gesamten Eimer ablegen.</td></tr>
          <tr><td><kbd>⌘ / Ctrl</kbd> + Klick</td><td>Minuten per Regler oder Zahlenfeld auswählen. Taste loslassen übernimmt die Menge.</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Die laufende Sammlung abbrechen und ihre Stunden an den Ursprung zurücklegen.</td></tr>
        </tbody>
      </table>
      <p>Ist keine Sammlung aktiv, schließt Escape das Seitenpanel. In dieser Anleitung schließt Escape nur das Hilfefenster.</p>
    </section>

    <section id="payroll-help-preview" class="help-section">
      <h4>5. Auswirkungen prüfen und zurücknehmen</h4>
      <p>Die Monatsprognose berücksichtigt produktive Ist-Zeit, angerechnete Fehlzeiten, Korrekturen und geplante Schichten. Stunden im Zeitkonto oder im Eimer zählen nicht zu den Monatsstunden.</p>
      <p>„Rückgängig“ nimmt die letzte Aktion zurück. „Verwerfen“ stellt den geladenen Stand wieder her. Escape setzt nur die laufende Sammlung zurück.</p>
      <p>Umbuchungen, Zeitkontoänderungen und neue Tageseinträge sind hier derzeit eine lokale Vorschau. Sie werden nicht dauerhaft gespeichert. Das Speichern und Übergeben in der Stundenschnellerfassung ist davon getrennt.</p>
    </section>
  </HelpModal>
</template>

<script setup>
import HelpModal from '@/components/Modals/HelpModal.vue';

defineProps({ modelValue: { type: Boolean, required: true } });
defineEmits(['update:modelValue']);

const sections = [
  { id: 'payroll-help-start', label: 'Start' },
  { id: 'payroll-help-capture', label: 'Stunden erfassen' },
  { id: 'payroll-help-day', label: 'Tagesdetails' },
  { id: 'payroll-help-bucket', label: 'Eimer' },
  { id: 'payroll-help-shortcuts', label: 'Shortcuts' },
  { id: 'payroll-help-preview', label: 'Vorschau' },
];
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
