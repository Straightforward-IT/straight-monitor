# Jahresimport von Stundenvortrag und Stunduhr

Stand: 19.10.2026. Grundlage sind die Originaldateien
`api/assets/Stundenvortrag 2026.xlsx` und `api/assets/Stunduhr 2026.xlsx`.
Der Import bildet deren Tabellenstruktur ab. Er überträgt nichts nach Zvoove.

## Verwendung

Als Admin unter **Daten Import → STUNDENVORTRAG und STUNDUHR – Jahresimport** das Jahr wählen,
die Dateien ihrer jeweiligen Tabelle zuweisen, die Vorschau prüfen und den
Jahresstand aktivieren. Eine Datei kann auch einzeln geliefert werden.

Eine gelieferte Tabelle ersetzt ihren **vollständigen Jahresstand**. Die andere
Tabelle bleibt aus dem aktiven Jahresstand erhalten. Spätere Auszüge müssen
deshalb wieder alle Zeilen der gelieferten Tabelle für das Jahr enthalten.
Ein Tabellenblatt nur mit vollständiger Kopfzeile leert die betreffende Rolle.
Alte Stände und ihre Originalzeilen bleiben erhalten.

Die Vorschau verändert weder den aktiven Datenstand noch die Schnellerfassung.
Die Aktivierung schaltet den Jahresstand und seine zuordenbaren Vorträge in
einer MongoDB-Transaktion um; sie benötigt ein Replica Set. Gleichzeitige
Änderungen seit der Vorschau ergeben HTTP 409. Ein identischer Folgeimport
erzeugt keine doppelten Originalzeilen oder Zeitbuchungen.

## Tabellenkonfiguration

Dateinamen bestimmen keine Rolle. Das jeweilige Multipart-Dateifeld bestimmt
`STUNDENVORTRAG` oder `STUNDUHR`. Die Spalten können anders angeordnet sein;
alle konfigurierten Überschriften müssen vorhanden und eindeutig sein.
Zusatzspalten bleiben in den Originaldaten erhalten. Pro Datei ist genau ein
befülltes Tabellenblatt zulässig; zusätzliche leere Blätter werden ignoriert.
Grenzen: zwei Dateien, 40 MiB je Datei, 200.000 Zeilen je Paket.

Die expliziten Feldverträge stehen in
`api/domain/payroll/zvooveTimeImport.js`; die Mongoose-Untermodelle `vortrag`
und `stunduhr` bilden jedes dieser Felder ab. Importierte Feldwerte werden als
String oder `null` geführt. Zusätzlich bleiben unveränderte Zellwerte, sämtliche
Quellspalten, Originalüberschriften, Datei, Blatt und Zeilennummer gespeichert.
Excel-Datumsserien, einschließlich des 1904-Systems, werden berücksichtigt.

| Tabelle | Spalten | Fachliche Felder |
| --- | ---: | --- |
| STUNDENVORTRAG | 40 | ID/DBID und REPL-Identität, Schicht, Mitarbeiter, Datum, Ist-Zeiten/-Stunden, Gesamtpause und bezahlte Pause, drei genaue Pausen und deren Bezahlstatus, separate bezahlte Pausenintervalle, Anlage-/Übertragungs-/Bearbeitungsinformationen und Sperren |
| STUNDUHR | 34 | REPL-Identität, Mitarbeiter, Auftrag, Einsatzort, Datum und Kalenderfelder, PAUSE/LFDNR, Von/Bis, STUNDEN, KZ, Projekt, Bearbeitung/Transfer, Bemerkung, Leistung/Akkord, Schicht, Arbeits-/Pausen-GUIDs und bezahlte Pause |

Der stabile Schlüssel einer Zeile ist
`Tabellenrolle:REPL_DATABASE:REPL_ID`. Geänderte Inhalte bilden eine neue
unveränderliche Version dieses Schlüssels. Fehlende oder doppelte Schlüssel
werden abgelehnt; es wird keine Zeile still verworfen. `DATUM` muss zum
gewählten Importjahr gehören. Personalnummern bleiben in den Quellen Strings.

Originalzeilen und vorbereitete Zuordnungen liegen in einzelnen Dokumenten
(`ZvooveTimeSourceRow` und `ZvooveTimeProjection`). Der Jahresdatenstand
referenziert die Zeilen. So landet nicht das gesamte Jahrespaket in einem
MongoDB-Dokument mit einer Grenze von 16 MiB.

## Arbeitszeit und Pausen

Für diese Originaltabellen gilt:

- `STUNDUHR.PAUSE=0` ist eine Arbeitszeile. Deren `STUNDEN` ist die bereits
  gebuchte Nettomenge; die Pause wird davon nicht nochmals abgezogen.
- `PAUSE=1`, `2` oder `3` bezeichnet eine Pausenzeile. Ihre `STUNDEN` ist die
  Pausendauer in Dezimalstunden. `PAUSE` selbst ist keine Dauer.
- Pausenzeilen können trotz vorhandener Dauer leere `VON`/`BIS` enthalten.
  Der Import erfindet dann kein Intervall. Vorhandene Intervalle stammen aus
  STUNDUHR und werden gegen Dauer, Arbeitszeit und Überschneidungen geprüft.
- `STUNDENVORTRAG.PAUSE` und `PAUSEBEZAHLT` sind Stundenmengen.
  `PAUSEnISTBEZAHLT` ist ein Kennzeichen. Ein gesetztes Kennzeichen ohne
  Intervall belegt keine bezahlte STUNDUHR-Pause. Alle Angaben bleiben getrennt.

Arbeits- und Pausenzeilen werden über Quell-Datenbank, Personalnummer, Auftrag,
Einsatzort, Tag, Schicht-ID und `LFDNR` verbunden. Unterschiedliche konkrete
Schicht-Datenbanken werden nicht zusammengeführt. Im vorliegenden Export
haben 111 Pausenzeilen `DBIDARBEITSSCHICHT=-1` und einen abweichenden
Schichtwert. Hier ist die Verbindung nur erlaubt, wenn die übrigen Felder
genau eine Arbeitszeile liefern; der Platzhalter bleibt als Hinweis erhalten.
Mehrdeutige oder verwaiste Zeilen bleiben als Original mit Diagnose erhalten.

Gebuchte Nettostunden bleiben in `/payroll` sichtbar, auch wenn eine Buchung
fachlich ungeklärt ist. Die eigene Geldberechnung überspringt fehlerhafte
Buchungen. Ohne genaue Pausenlage darf sie die bekannte Nettomenge als
Grundstunden verwenden, wenn die Grundregel für die gesamte Zeit gilt.
Betroffene Zuschläge, unklare bezahlte Pausen und Tages-/Monatsaufteilungen
bleiben unvollständig. Die App verteilt keine Pause willkürlich auf Zeitfenster.

## Verbindung zur Schnellerfassung

Ein Vortrag wird über Personalnummer, Schicht und Tag eindeutig einem
vorhandenen Mitarbeiter und Einsatz zugeordnet. Aktuelle und historische
Personalnummern werden berücksichtigt. Fehlende Mitarbeiter/Einsätze werden
nicht erfunden; ihre Quellen bleiben vollständig importiert.

Nur eindeutige und gültige Zuordnungen werden als bestehende `Stundenzeit`
mit der Einsatz-ID bereitgestellt:

- Nicht übertragener Vortrag: `current` aus STUNDENVORTRAG, Status `SUBMITTED`.
- Übertragener Vortrag: zusätzlich `released` aus der eindeutig passenden
  gültigen STUNDUHR-Buchung, Status `RELEASED`.
- Die importierte Quellzeile bleibt unveränderlich. Korrekturen in der
  Schnellerfassung ändern `current` und ergänzen die Bearbeitungshistorie.

`employeeSubmission` bleibt bei neu importierten Datensätzen leer: Der Export
belegt nicht die ursprüngliche Fassung vor allen Disponentenkorrekturen.
`importSource` und der Historieneintrag `IMPORTED` kennzeichnen die Herkunft.

Bestehende lokale Erfassungen werden nicht überschrieben. Auch ein importierter
Vortrag wird nach lokalem Speichern, Freigeben oder Zurücknehmen vor weiteren
Importaktualisierungen geschützt. Mehrere Vorträge für denselben Einsatz
werden nicht zu einer erfundenen Einzelerfassung zusammengezogen. Entfallene
Quellzeilen löschen keine bereits angelegte lokale Erfassung.

Die Aktivierung ist eine Übernahme des Zvoove-Stands. Eine anschließende lokale
Freigabe verwendet weiterhin den bestehenden `TimeCaptureService`; die
zusätzliche Veröffentlichung solcher Änderungen als neue kanonische
`Zeitbuchung` ist ein eigener, noch offener Verbindungsschritt. Lokale Änderungen
an `current` verändern deshalb keine importierte STUNDUHR-Buchung.

## Payroll, Lohn und Faktur

Der aktive Jahresstand liefert kanonische `Zeitbuchung`-Dokumente für die
bestehende Lohn-/Fakturausweisung. Auftragsregeln aus AUFTRLOA und unabhängige
Sollwerte werden weiterhin getrennt über die bestehenden Detail-/Referenzimporte
geliefert. Bei gleichzeitig vorhandenem Jahres- und altem Auftragszeitimport
hat der Jahresstand für dieses Jahr Vorrang; Stunden werden nicht doppelt gezählt.

`/payroll` verwendet bei aktivem STUNDUHR-Jahresstand die Arbeitszeilen als
produktive Stundenquelle. Tages-/Monatszuordnung erfolgt dort anhand des
gebuchten Quell-Datums. Bestehende STUNDEN-Kennzeichnungen, etwa Abwesenheiten,
bleiben zusätzlich erhalten. Produktive STUNDEN-Summen werden nicht addiert.
Die ursprünglichen STUNDEN-Tagesdaten stehen als `monthlyReference` weiter zur
Kontrolle bereit. Ohne STUNDUHR-Jahresstand gilt der bisherige Monatsimport.

## API

Alle folgenden Endpunkte prüfen die aktuelle bestätigte Admin-Rolle aus MongoDB:

| Methode | Pfad | Inhalt |
| --- | --- | --- |
| POST | `/api/payroll/time-imports/preview` | Multipart `year`, optional jeweils eine Datei `STUNDENVORTRAG` und `STUNDUHR` |
| POST | `/api/payroll/time-imports/:id/activate` | JSON `expectedRevision` aus `baseRevision` der Vorschau |
| GET | `/api/payroll/time-imports` | Letzte 50 Importläufe |
| GET | `/api/payroll/time-imports/:id` | Status, Mengen, Diagnosen und Aktivierungsergebnis |
| GET | `/api/payroll/time-imports/:id/rows?role=STUNDUHR&page=0` | 100 Originalzeilen pro Seite, alternativ Rolle STUNDENVORTRAG |

Die bisherigen Detailimporte sind für Auftragsregeln und Referenzen weiter
verfügbar. Original-STUNDUHR mit separaten Arbeits-/Pausenzeilen wird dort
abgelehnt und an diesen Jahresimport verwiesen.

## Prüfung mit den gelieferten Dateien

Die isolierten Tests lesen und persistieren den vollständigen gelieferten Stand:

| Kennzahl | Ergebnis |
| --- | ---: |
| STUNDENVORTRAG-Zeilen | 18.188 |
| STUNDUHR-Zeilen | 28.827 |
| Davon Arbeitszeilen / kanonische Zeitbuchungen | 17.681 |
| Davon Pausenzeilen | 11.146 |
| Originalzeilen insgesamt | 47.015 |
| Gebuchte Netto-Arbeitsstunden | 115.831 |
| Pausenstunden, separat | 6.102 |
| Buchungen ohne genaue Pausenlage | 5.940 |
| Fachlich ungeklärte Buchungen | 16 |
| Nicht zugeordnete STUNDUHR-Zeilen | 0 |

Die 16 ungeklärten Buchungen enthalten sechs widersprüchliche
Pausenintervalle/-dauern, ein fehlendes oder leeres Arbeitsintervall und neun
nicht eindeutig auflösbare Uhrzeiten zur Zeitumstellung. Diese Befunde werden
nicht automatisch korrigiert. Die 5.940 fehlenden Pausenlagen sind ein eigener
Hinweis und werden nicht pauschal als fehlerhafte Nettomenge behandelt.

Tests: `api/tests/zvooveTimeImport.test.js` zusammen mit den bestehenden
Abrechnungs-, Erfassungs- und Monatsimporttests sowie
`frontend/Straight-Monitor/tests/ZvooveTimeImport.spec.js` und den bestehenden
Monatsimport-/Payroll-UI-Tests. Es wird eine isolierte lokale MongoDB verwendet;
Tests mit den Originaldateien werden übersprungen, falls diese lokal fehlen.
Damit sind weder ein Import in die aktive Datenbank noch ein authentifizierter
Browserablauf oder ein Abgleich fertiger Zvoove-Abrechnungsergebnisse belegt.

Prüfung am 19.10.2026: 67 Backend-Tests und 22 UI-Tests erfolgreich;
Frontend-Produktionsbuild, Syntaxprüfung der neuen Backendmodule und
`git diff --check` ebenfalls erfolgreich.
