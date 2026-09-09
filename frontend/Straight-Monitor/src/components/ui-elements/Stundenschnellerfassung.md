# Stundenschnellerfassung

Auftragsbezogene Frontend-Erfassung mit Schichtgruppen, Einsätzen, Soll-/Ist-Zeiten, Pausen und Summen. Vorschau unter `/dev/stundenschnellerfassung` (nur Vite-Entwicklung).

```vue
<Stundenschnellerfassung
  :auftrag="auftrag"
  :schichten="schichten"
  :einsaetze="einsaetze"
  :zeiten="zeiten"
  @submit="handleLocalResult"
  @cancel="close"
/>
```

Für die Fensteransicht dieselben Daten an `components/Modals/StundenschnellerfassungModal.vue` übergeben; zusätzlich steuert `v-model` die Sichtbarkeit. Der Wrapper nutzt `ModalFrame`.

## Daten

- `auftrag`: `auftragNr`, `eventTitel`, optional `eventLocation` und `eventOrt`.
- `schichten`: vorhandene Felder aus `Schicht.js` (`_id`, `auftragNr`, `idAuftragArbeitsschichten`, `bezeichnung`, `datumVon`, `uhrzeitVon`, `uhrzeitBis`).
- `einsaetze`: vorhandene Felder aus `Einsatz.js`, mit eindeutiger `_id` und optional angereichertem `mitarbeiterData: { vorname, nachname }`. Zuordnung zuerst über `schicht` (ID oder aufgelöstes Objekt), sonst über `idAuftragArbeitsschichten` und Datum. Nicht eindeutig zuordenbare Einsätze bleiben in einer eigenen Gruppe sichtbar. Fremde Aufträge werden ausgeschlossen.
- `zeiten`: separates Frontend-Array `{ einsatzId, start, end, breakMinutes, paidBreakMinutes, breaks }`. `breaks` enthält maximal drei `{ start, end, paid }`-Blöcke. Diese Eingaben werden nicht an `Einsatz.js` oder `Schicht.js` geschrieben.

Neue Prop-Arrays bzw. eine andere Auftragsnummer initialisieren den Entwurf neu. Eingabe-Props werden nicht verändert.

## Verhalten

Die Ist-Stunden ergeben sich aus der Zeitspanne abzüglich unbezahlter Pausen. Frühere Endzeiten gelten als Folgetag, gleiche Anfangs- und Endzeiten sind ungültig. Pausen werden entweder als Minuten oder als Zeitblöcke erfasst; sobald ein Block begonnen wurde, sind die Minutenfelder berechnet. Beim Entfernen aller Blöcke gelten wieder die vorherigen Minutenwerte. Unvollständige, überlappende oder außerhalb der Arbeitszeit liegende Pausen blockieren das Übernehmen. Es findet keine arbeitsrechtliche oder Payroll-Prüfung statt.

„Erste Zeile übertragen“ kopiert Ist-Zeiten und Pausen innerhalb einer Schicht. Die Sammelaktionen für Soll-Zeiten und Zurücksetzen betreffen die aktuell angezeigten Schichten. Soll-Zeiten ersetzen Beginn/Ende und erhalten vorhandene Pausen. Die Auftragssumme und „Übernehmen“ umfassen alle Schichten; ungültige Einträge zählen nicht zur Summe. Leere Zeilen bleiben offen.

`submit` liefert `{ auftragNr, entries, clearedEinsatzIds, totalMinutes }`. Einträge enthalten `einsatzId`, `personalNr`, `schicht`, `datum`, `start`, `end`, `endDayOffset`, `breaks`, `breakMinutes`, `paidBreakMinutes` und `netMinutes`. Explizit geleerte Zeilen stehen in `clearedEinsatzIds`. Nach dem lokalen Übernehmen werden die aktuellen Werte zur neuen Rücksetz-Basis; Abbrechen verwirft spätere Änderungen und emittiert `cancel`.

Der Dummy ruft keine API auf und schreibt nichts in Local Storage. Eine spätere Anbindung muss Ist-Zeit-Buchungen, Servervalidierung und Persistenz separat ergänzen. Die Testdaten liegen ausschließlich in `components/dev/stundenschnellerfassungDemo.js`.
