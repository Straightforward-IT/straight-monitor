# TimeManagement

Frontend-Demo unter `/dev/time-management`, ausschließlich im Vite-Entwicklungsmodus. Keine API-Aufrufe oder Änderung echter Mitarbeiterdaten. „Demo speichern“ setzt den Ausgangsstand der aktuellen Sitzung; Neuladen setzt die Beispieldaten zurück.

## Verwendung

```vue
<TimeManagement
  :key="`${employee.id}-${month}`"
  :employee="employee"
  :month="'2026-09'"
  :initial-data="{ entries, bankMinutes: 1440 }"
  @save="onSave"
/>
```

`employee`: `id`, `name`, `personalNr`, `employmentLabel`, `monthlyHours`.
`entries`: `id`, `date` (YYYY-MM-DD), `label`, `kind` (`productive`, `planned`, `vacation`, `sick`, `absence`, `correction`), `minutes` (nichtnegative ganze Minuten), `credited`, optional `code`, `source`, `note` und Einsatz-/Schichtreferenzen. IDs sind pro Sitzung eindeutig; `bank`, `new`, `remove`, `day:` und `correction-` sind für Eimerziele reserviert. Die Aufrufer liefern ausschließlich Einträge des ausgewählten Mitarbeiters und Monats. Bei Wechsel einen neuen `key` verwenden.

Das `save`-Event liefert `employeeId`, `month`, `entries`, `bankMinutes`, `createdMinutes`, `removedMinutes` und `journal`. Für spätere Persistenz ist ein gesonderter Adapter erforderlich. Die Vorlage definiert hier Eintragsarten, keine Abrechnungsregeln. Die Anrechnung auf Monatsstunden ist beim Anlegen explizit wählbar. `FA` entnimmt die beim Anlegen angegebene Zeit dem Zeitkonto. Geplante Schichten sind nur lesbar und fließen in die Prognose ein.

## Eimer

Der normale Mauszeiger bleibt sichtbar. Der Eimer folgt ihm als zusätzliche Anzeige mit der gehaltenen Zeit und fängt keine Zeigerereignisse ab.

- Rechtsklick: bis zu 60 Minuten sammeln. Linksklick: bis zu 60 Minuten ablegen.
- Shift mit Rechts-/Linksklick: verfügbare Zeit sammeln / ganzen Eimer ablegen. „Neue Stunden“ erzeugt beim Sammeln Zeit; Shift verwendet die dort ausgewählte Menge.
- Cmd/Ctrl mit Rechts-/Linksklick: Minutenregler öffnen. Loslassen der Modifikatortaste übernimmt den Wert. Ein Klick außerhalb oder Fokusverlust schließt nur den Regler ohne Übernahme.
- Alternativ „Sammeln“ / „Ablegen“ wählen und normal klicken (auch Touch/Enter). „Minuten“ öffnet den Regler mit explizitem Übernehmen.
- Escape: laufende Sammelaktion inklusive bereits erfolgter Teilablagen vollständig zurücknehmen, bis der Eimer leer ist. Neu erzeugte Stunden werden dabei verworfen.
- Ein leerer Eimer schließt eine Umbuchung ab. „Rückgängig“ nimmt eine abgeschlossene Aktion zurück; „Verwerfen“ stellt den letzten gespeicherten Stand wieder her.
- Speichern ist mit gefülltem Eimer oder offenem Regler gesperrt.
- Ein leerer Kalendertag ist ein Ablageziel und erstellt beim ersten Ablegen eine Stundenkorrektur. Die Plus-Schaltfläche legt andere Eintragsarten an, auch mit 0 Minuten als vorbereitetes Ziel.

## Anordnung und Auswahl

Oben stehen kompakte Mitarbeiter-/Monatsfelder sowie der Kontext des gewählten Eintrags. Optionale Eintragsfelder `customerName`, `location` und `activity` ergänzen Auftrag, Kunde, Einsatzort und Tätigkeit.

`TimeMonthMatrix` zeigt Wochen als Spalten und Montag bis Sonntag als Zeilen. Ein Kalenderfeld enthält Tagesnummer, Kürzel und je Eintrag einen Stundenwert. Wochenköpfe zeigen die Summe der Ist-Zeit, ohne geplante Stunden. Es werden nur die benötigten vollständigen Kalenderwochen gerendert; angrenzende Monatstage sind nicht bearbeitbar.

Ein Klick auf eine Tagesnummer oder einen Wochenkopf filtert die Detailtabelle darunter. Die Auswahl Monat/Woche/Tag wechselt den Zeitraum; Schichten & Zeiten, Fehlzeiten und Änderungsprotokoll wechseln die Detailansicht. Das Protokoll bleibt monatlich. Kalender und Monatsprognose zeigen immer den gesamten Monat. Stundenfelder im Kalender und in der Tabellenspalte „Aktuell“ sind gleichwertige Eimerziele.

Rechts bleibt die wiederverwendete `HoverDataCard` im `inline`-Modus sichtbar, gefolgt vom Zeitkonto. Auf schmalen Ansichten ordnen sich die Bereiche untereinander an; Kalender und Detailtabelle scrollen horizontal innerhalb ihrer Flächen. Produktive Ist-Zeit, angerechnete Fehlzeiten, Korrekturen und geplante Zeit bilden die Prognose; Eimer und Zeitkonto sind ausgeschlossen. Der Eimer erhält Herkunftslose, um gemischte Entnahmen exakt zu protokollieren und abzubrechen. Alle Berechnungen erfolgen in ganzen Minuten.
