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
      <p>Suche den Mitarbeiter in der Toolbar und wähle den Monat. Stundenerfassung und Monatsprüfung teilen diese Auswahl. Die Mitarbeiterkarte lässt sich für weitere Informationen aufklappen.</p>
      <p>„Stand neu laden“ lädt den gespeicherten Stand erneut und fragt vor dem Verwerfen ungespeicherter Eingaben. „Quellen aktualisieren (Entwurf behalten)“ aktualisiert dagegen nur die Quellinformationen, sofern niemand die Vorbereitung zwischenzeitlich gespeichert hat.</p>
    </section>

    <section id="payroll-help-capture" class="help-section">
      <h4>2. Stunden erfassen und übergeben</h4>
      <p>Mitarbeiter können ihre eigenen Stunden einmalig in der Mitarbeiter-App einreichen. Anschließend bearbeitet ein interner Benutzer die Zeiten und Pausen in der Stundenschnellerfassung.</p>
      <p>Öffne die Schnellerfassung über die Toolbar oder über „Erfassen“ im Kalender. „Entwurf speichern“ sichert die Bearbeitung; „An Zeitverwaltung übergeben“ übernimmt die geprüften Zeiten in diese Monatsansicht.</p>
      <p>Noch nicht übergebene Einsätze stehen als Planung im Kalender. Sie werden nie als Abrechnungsmenge übernommen. Die Monatsvorbereitung verändert weder die freigegebenen Arbeitszeiten noch ihre ursprünglichen Arbeitstage.</p>
    </section>

    <section id="payroll-help-day" class="help-section">
      <h4>3. Einen Tag öffnen</h4>
      <p>Klicke auf die Tagesnummer im Kalender. Das gemeinsame Seitenpanel zeigt die Schichten, Zeiten, Fehlzeiten und Auftragsdokumente dieses Tages. Die gespeicherte Bearbeitungshistorie findest du in der Monatsprüfung.</p>
      <p>Dokumente werden je Auftrag einmal angezeigt. Klicke auf ein Dokument, um es anzusehen. Über das Drei-Punkte-Menü im Panel-Kopf öffnest du die Stundenschnellerfassung für den jeweiligen Auftrag.</p>
      <p>Mit „Tageseintrag“ öffnest du die Vorbereitung einer Fehlzeit. Wähle die importierte Art und den ursprünglichen Zeitraum; prüfe die Minuten für jeden Tag ausdrücklich. Zeitraum und gutgeschriebene Stunden sind getrennte Angaben. Fortlaufende Fehlzeiten werden im Ursprungsmonat bearbeitet. Korrekturen und AZK-Vorschläge haben eigene Eintragsarten im Vorbereitungsformular.</p>
    </section>

    <section id="payroll-help-bucket" class="help-section">
      <h4>4. AZK-Bewegungen vorschlagen</h4>
      <p>Aktiviere „Eimer“ in der Toolbar. Ein Klick auf freigegebene Stunden öffnet einen Einzahlungsvorschlag mit Quellenbezug; ein Klick auf das Zeitkonto öffnet einen Auszahlungsvorschlag. Gib die Minuten und eine Begründung ein und füge den Eintrag zum Entwurf hinzu.</p>
      <p>Die ursprünglichen Ist-Stunden bleiben unverändert. Gespeichert werden ausschließlich vorgeschlagene Bewegungen, kein Kontostand und kein nachgerechnetes Kontobuch. „Zeitkonto nicht verfügbar“ bedeutet unbekannt, nicht null Stunden.</p>
      <p>Eine interne Prüfung bestätigt keine Deckung durch ein LODAS-Guthaben. LODAS bleibt für die Zeitkontoführung zuständig; ein unterstützter Kontostandabruf steht noch nicht zur Verfügung.</p>
    </section>

    <section id="payroll-help-shortcuts" class="help-section">
      <h4>5. Entwurf speichern</h4>
      <p>„Zum Entwurf hinzufügen“ übernimmt einen Eintrag zunächst nur lokal. Erst „Vorbereitung speichern“ sichert alle Einträge auf dem Server. Ein Bearbeitungsvermerk ist erforderlich. Bei Fehlern bleiben Eingaben erhalten; ein offenes Eintragsformular muss zunächst übernommen oder abgebrochen werden.</p>
      <p>Bei geänderten Quellen: Quellen aktualisieren, Änderungen in der Monatsprüfung prüfen und den ausdrücklichen Abgleich bestätigen. Bei einem konkurrierenden Speicherstand wird nichts überschrieben; sichere deine eigenen Änderungen vor dem bewussten Neuladen und Abgleichen.</p>
    </section>

    <section id="payroll-help-preview" class="help-section">
      <h4>6. Monatsprüfung und Offline-Vorschau</h4>
      <p>Die Monatsprüfung zeigt vorbereitete Mengen, Quelländerungen, Bearbeitungshistorie und unveränderliche Prüfstände. PAYROLL und ADMIN können einen gespeicherten, abgeglichenen Monat intern abschließen oder wieder öffnen. Standortrechte gelten weiterhin.</p>
      <p>Die interne Prüfung benötigt keine DATEV-Zugangsdaten oder vollständigen Zuordnungen. Die gesonderte LODAS-Vorschau prüft einen Prüfstand gegen eine versionierte Konfiguration und zeigt fehlende oder ungültige Zuordnungen. Es findet keine Übertragung an DATEV statt.</p>
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
  { id: 'payroll-help-shortcuts', label: 'Speichern' },
  { id: 'payroll-help-preview', label: 'Monatsprüfung' },
];
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
