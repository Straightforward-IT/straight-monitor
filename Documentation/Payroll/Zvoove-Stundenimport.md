# Zvoove-Stunden als Payroll-Datenquelle

Die Stundenerfassung zeigt importierte Zvoove-Daten schreibgeschützt. Die
bisherigen Stunden aus der Schnellerfassung und alten Monatsvorbereitungen
werden in dieser Ansicht nicht geladen oder migriert. Die operative
Zeiterfassung bleibt ein eigener Workflow. Es werden keine bestehenden
Datenbankbestände gelöscht.

## Quelldatei

Eine Excel-Datei enthält genau einen Monat aus `STUNDEN` mit folgenden Spalten:

```sql
SELECT PERSONALNR, JAHR, MONAT, WOCHE, KW,
       T1, T2, T3, T4, T5, T6, T7,
       KZ1, KZ2, KZ3, KZ4, KZ5, KZ6, KZ7,
       ERSTELLTAM, GEAENDERAM
FROM STUNDEN
WHERE JAHR = [_Jahr] AND MONAT = [_Monat]
ORDER BY JAHR, MONAT, WOCHE, KW;
```

`WOCHE` ist die Wochenposition im Monatskalender. Die erste Woche beginnt am
Montag der Woche, in die der erste Monatstag fällt. `T1`/`KZ1` entsprechen
Montag, `T7`/`KZ7` Sonntag. `KW` wird dagegen als ISO-Kalenderwoche geprüft.
Die Wochenposition darf deshalb nicht als Kalenderwochennummer gelesen werden.
Auch Monate mit sechs tatsächlichen Kalenderwochen sind zulässig.

Nur Tage des angegebenen Monats gehen in die Tagesansicht ein. Eine zusätzliche
vollständig leere Wochenzeile ohne KW bleibt als Quelle erhalten und erzeugt
keine Tagesdaten. Befüllte Zellen außerhalb des Monats werden als Fehler
gemeldet; sie werden nicht heimlich in einen benachbarten Monat übertragen.

| Stundenwert | KB | Bedeutung |
| --- | --- | --- |
| Befüllt, auch ausdrücklich `0` | Leer | Produktive Stunden |
| Befüllt | Befüllt | Stunden und Zuordnung über das KB-Kürzel |
| Leer | Befüllt | Tageskennzeichnung ohne Stundenwert |
| Leer | Leer | Kein Tageseintrag |

`FS` ist die interne Tageskennzeichnung und benötigt keine Lohnart.
Andere KB-Kürzel werden gegen `Lohnart.kb` aufgelöst. Nur ein eindeutiger Treffer
liefert eine Lohnart; fehlende und mehrdeutige Treffer bleiben sichtbar ungeklärt.
Es gibt keine automatisch gewählte Normalstunden-Lohnart für produktive Stunden.

Stunden werden als Dezimalstrings verarbeitet, einschließlich der Präzision
der Quelle. Leere Werte sind `null` und werden nicht als `0` gespeichert.
Die Darstellung darf Stunden für die Lesbarkeit formatieren; der ursprüngliche
Wert bleibt in den Tagesdetails verfügbar. Summen erfolgen ohne vorherige
Rundung auf ganze Minuten. Eine Summe von Quellstunden ist noch keine Aussage
über Lohnfortzahlung, bezahlte Stunden, AZK oder den Durchschnitt.

## Vorschau und Aktivierung

Der Admin-Bereich in Daten Import verwendet `AppFileDropzone` für eine Monatsdatei.
Die Vorschau zeigt Wochenzeilen, Personalnummern, Tagesdaten, Änderungen sowie
Fehler und Hinweise. Ein eigener Aktivierungsschritt übernimmt den geprüften Stand.

Der fachliche Schlüssel lautet `PERSONALNR + JAHR + MONAT + WOCHE`. Eine
mitgelieferte Wochenzeile ersetzt ihre bisherigen Werte vollständig, also auch
geleerte Stunden und KB-Kürzel. Nicht mitgelieferte Wochenzeilen bleiben erhalten.
Es handelt sich um Ergänzen/Aktualisieren, nicht um einen Monats-Vollersatz.

Importläufe und frühere Fassungen bleiben nachvollziehbar. Die Aktivierung
schaltet den Monatsbestand vollständig um. Identische wiederholte Daten erzeugen
keine zusätzlichen fachlichen Wochenzeilen. Hat sich der aktive Monatsstand
seit der Vorschau geändert, wird eine neue Vorschau benötigt.

Datei, Tabellenblatt, Zeile, Tagesposition und sämtliche Quellspalten bleiben
erhalten. Personalnummern werden über aktuelle und historische Nummern auf den
stabilen Mitarbeiterdatensatz aufgelöst. Nicht zuordenbare Quellen gehen nicht
verloren, sondern erscheinen als Hinweise im Importlauf.

## Schnittstellen

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/payroll/imports` | Importhistorie |
| POST | `/api/payroll/imports/preview` | Eine Excel-Datei als Multipart-Feld `file` prüfen |
| GET | `/api/payroll/imports/:id` | Vorschau und Importinformationen |
| POST | `/api/payroll/imports/:id/activate` | Aktivieren mit `expectedRevision` aus der Vorschau |
| GET | `/api/payroll/employees/:employeeId/month?month=YYYY-MM` | Importierte Tagesdaten eines Mitarbeiters |

Importvorschauen enthalten `id`, `month`, `baseRevision`, `valid`, `counts`,
`changes` und `issues`. Monatsantworten enthalten Mitarbeiter, Tagesdaten,
Dezimalstrings für Stunden/Summen, Hinweise und `datasetRevision`.
Import-Endpunkte prüfen die aktuelle Admin-Rolle aus der Datenbank.
Monatsdaten verwenden die bestehende Standortberechtigung der Stundenerfassung.

Der frühere Monatsprüfungs-, Entwurfs- und LODAS-Vorschauworkflow ist in der
aktiven Payroll nicht mehr verfügbar. In Payroll zeigt die tarifbezogene
DataHoverCard die importierten Monatsstunden samt KB-Aufschlüsselung. Die Summe
enthält sämtliche Quellstunden; produktive Stunden (KB leer) sind separat
ausgewiesen. Für Festangestellte und KZF normal/pauschal erfolgt ein Vergleich
mit hinterlegten Monats-Sollstunden. Beide 603-Gruppen zeigen die Stunden ohne
Sollgrenze und ohne Verdienstprognose. Fehlende Sollstunden verhindern die
Anzeige der importierten Mengen nicht. Das KZF-Tageskontingent basiert weiterhin
auf Einsätzen und Vorarbeitgebertagen. EmployeeCard und Dispo behalten ihre
bisherige Einsatzprognose.

Unter der Monatsmatrix ist ein eigener Tab-Bereich für Lohnarten vorbereitet.
Seine Register sind zunächst leer. Ausgewählter Monat und aktuelle Tagesauswahl
werden als gemeinsamer Kontext bereitgestellt; die Zuordnung einzelner Register
zu Tages- oder Monatsdaten und ihre fachlichen Inhalte folgen separat.

## Grenze dieser Version

Direkte Erfassung, Korrekturen, Geldberechnungen, Drei-Monats-Durchschnitt,
AZK-Verrechnung und DATEV-Übertragung folgen in eigenen Schritten. Dieser
Import liefert Stunden und Tageskennzeichen als Grundlage für den späteren
Vergleich mit Zvoove. Er rekonstruiert keine fehlenden Abrechnungsergebnisse.
