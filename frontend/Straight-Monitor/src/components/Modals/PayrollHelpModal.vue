<template>
  <HelpModal :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <template #title>Stundenerfassung — Anleitung</template>
    <template #toc>
      <nav class="help-toc" aria-label="Inhalt der Anleitung"><span class="help-toc-label">Inhalt</span><AppButton v-for="section in sections" :key="section.id" size="sm" variant="secondary" :data-section="section.id" @click="scrollToSection(section.id)">{{ section.label }}</AppButton></nav>
    </template>
    <section id="payroll-help-start" class="help-section">
      <h4>1. Mitarbeiter und Monat auswählen</h4>
      <p>Suche den Mitarbeiter per Name oder Personalnummer in der Toolbar und wähle den Monat. Die Mitarbeiterkarte lässt sich für weitere Informationen aufklappen. „Stand neu laden“ lädt die importierten Monatsstunden und die Tarifinformationen erneut.</p>
    </section>
    <section id="payroll-help-source" class="help-section">
      <h4>2. Zvoove als Datenquelle</h4>
      <p>Diese Ansicht zeigt die aktivierten Zvoove-Monatsimporte. Administratoren können die Excel-Dateien über „Daten Import“ prüfen und aktivieren. Frühere Teststunden werden in dieser Ansicht nicht verwendet.</p>
    </section>
    <section id="payroll-help-calendar" class="help-section">
      <h4>3. Stunden und Kennzeichen lesen</h4>
      <p>Die Kalenderwochen zeigen Stunden als Dezimalwerte. „6,50“ bedeutet sechseinhalb Stunden. Ein Stundenwert ohne KB-Kennzeichen ist produktive Zeit und erscheint als „P“. Kennzeichen werden über die Lohnartenstammdaten zugeordnet.</p>
      <p>Eine ausdrücklich eingetragene Null bleibt als „0,00“ sichtbar. Eine Tageskennzeichnung ohne Stunden, etwa „FS“, zeigt einen Strich beim Stundenwert. Leere Tage enthalten keinen Eintrag.</p>
      <p>Geplante Schichten aus der Disposition erscheinen zusätzlich als „PL“ mit gestricheltem Rahmen. Ein Klick zeigt Auftrag, Schicht und geplante Zeit im Seitenpanel. Diese Planungszeiten zählen nicht in die erfassten Stunden, Wochensummen oder Lohn-/Fakturpositionen. Bereits eindeutig gebuchten Einsätzen wird kein zweiter PL-Eintrag hinzugefügt.</p>
    </section>
    <section id="payroll-help-day" class="help-section">
      <h4>4. Einen Tag öffnen</h4>
      <p>Klicke auf eine Tagesnummer oder einen Eintrag. Das Seitenpanel zeigt Stunden, KB, Lohnart, ursprüngliche Personalnummer sowie Datei, Tabellenblatt, Zeile und Tagesquellspalten. Dort bleibt der vollständige Dezimalwert aus der Quelle sichtbar.</p>
      <p>Die importierten Stunden sind schreibgeschützt. Korrekturen werden zunächst über einen neuen geprüften Import übernommen. Der Stundenexport enthält keine Zuordnung zu einem Auftrag oder Einsatz.</p>
    </section>
    <section id="payroll-help-contingent" class="help-section">
      <h4>5. Erfasste Stunden und Tariflohn</h4>
      <p>Unter „Informationen“ zeigt „Kontingent“ die erfassten Zvoove-Stunden im Diagramm und die Aufschlüsselung nach Kennzeichen. Festangestellte und KZF normal/pauschal sehen den Vergleich mit hinterlegten Monats-Sollstunden. Die 603-Tarifgruppen zeigen Stunden ohne Sollvergleich. Im Tab „Lohn“ stehen Tariflohn und ÜTZ für den ausgewählten Monat.</p>
      <p>Das zusätzliche Tageskontingent bei KZF beruht weiterhin auf Einsätzen und Vorarbeitgebertagen. Die Stundensumme enthält sämtliche importierten Kennzeichen; produktive Stunden stehen separat in der Aufschlüsselung. Es findet hier noch keine zusätzliche Lohn-, Fehlzeiten- oder Zeitkontoberechnung statt.</p>
    </section>
    <section id="payroll-help-issues" class="help-section">
      <h4>6. Ungeklärte Zuordnungen</h4>
      <p>Unbekannte oder mehrfach verwendete KB-Kürzel bleiben erhalten und werden als ungeklärt angezeigt. Ungeklärte Personalnummern stehen in der Importvorschau. Prüfe die Quellzeile und die Stammdaten, bevor diese Werte für spätere Berechnungen verwendet werden.</p>
    </section>
  </HelpModal>
</template>

<script setup>
import HelpModal from '@/components/Modals/HelpModal.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
defineProps({ modelValue: { type: Boolean, required: true } });
defineEmits(['update:modelValue']);
const sections = [
  { id: 'payroll-help-start', label: 'Start' }, { id: 'payroll-help-source', label: 'Import' },
  { id: 'payroll-help-calendar', label: 'Kalender' }, { id: 'payroll-help-day', label: 'Tagesdetails' },
  { id: 'payroll-help-contingent', label: 'Informationen' }, { id: 'payroll-help-issues', label: 'Hinweise' },
];
function scrollToSection(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
</script>
