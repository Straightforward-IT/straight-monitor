# Tarifmodul 17055

Das eigenständige Modul unter `/tarife` übernimmt alle 14 Tabellen aus dem Zvoove-Tarifexport. Seite und API sind ausschließlich für Admins zugänglich. Die aktuelle Rolle wird bei jedem API-Aufruf aus der Benutzerdatenbank gelesen. Tarifdaten werden ausschließlich durch vollständige Imports gepflegt; das Modul ist unabhängig von der bestehenden Payroll.

## Importieren

Im Tab **Import** jede der 14 Dateien ihrer ausdrücklich benannten Rolle zuordnen. Dateinamen bestimmen die Rolle nicht. Insbesondere enthält `Tarif Mitarbeiter Gruppe.xlsx` die Varianten und `Tarifgruppe.xlsx` die Entgeltgruppen. Office-Sperrdateien (`~$…`) und zusätzliche Branchenexporte gehören nicht zu diesem Importpaket.

**Importvorschau erstellen** liest die Tabellen, filtert Tarifvertrag 17055 mitsamt seinen abhängigen Daten und zeigt Anzahlen, Änderungen, Fehler und Hinweise. Inaktive Varianten, historische Tarifperioden und vollständige ÜTZ-Historien der vorkommenden Personalnummern bleiben erhalten. Leere Nebentabellen sind mit vollständigen Spaltenüberschriften erlaubt.

Fehlerhafte Pflichtfelder, Beziehungen, Matrixzellen oder unlesbare Kalenderdaten verhindern die Aktivierung. Umgekehrte Tarifperioden bleiben ebenfalls blockierend. Mitarbeiterzuordnungen und ÜTZ mit einem Enddatum vor ihrem Beginn werden dagegen vollständig als `intervalStatus: INEFFECTIVE` erhalten: Sie gelten an keinem Stichtag, erscheinen als Hinweis und verhindern die Aktivierung nicht. Ungeklärte Mitarbeiter und undokumentierte Regelbedeutungen sind ebenfalls Hinweise. Quelldaten werden mit allen Spalten sowie Datei, Tabellenblatt und Zeile erhalten; Codes werden nicht eigenmächtig interpretiert. Dezimalwerte müssen ohne Rundung in Decimal128 darstellbar sein.

**Geprüften Datenstand aktivieren** veröffentlicht den vollständig gespeicherten Importlauf über einen gemeinsamen Zeiger. Alle Lesezugriffe verwenden genau einen Importstand. Eine zwischenzeitliche Aktivierung eines anderen Admins führt zu HTTP 409; die Importdetails müssen erneut geprüft werden. Identische Datenstände werden wiederverwendet. Vorherige Stände bleiben gespeichert; die Oberfläche zeigt die letzten 50 Importläufe. Nach einem Prozessabbruch kann eine seit 15 Minuten verwaiste Vorbereitung durch erneute Vorschau ersetzt werden.

## Tarifübersicht und Mitarbeiter

Die Tarifübersicht zeigt Vertragsregeln, Varianten, Gruppen, Stufen, Ecklohn-Konfiguration sowie Perioden mit Entgeltmatrix und ihren Regeln. In der Mitarbeiteransicht lässt sich nach Namen oder importierten Personalnummern suchen. Aktuelle und historische Personalnummern werden numerisch normalisiert und nur bei genau einem passenden Mitarbeiter mit dessen stabiler ID verknüpft. Fehlende und mehrdeutige Zuordnungen bleiben als eigene Einträge sichtbar; ein weiterer Import prüft sie erneut.

Die Tarifübersicht verbindet die Auswahl von Variante, Stichtag und Matrixplatz. Der Tarifpfad zeigt die beteiligte Variante, die gültige Periode, Entgeltgruppe und Stufe sowie den exakten Grundwert. Ein Klick auf eine Matrixzelle aktualisiert auch deren historische Werte in der chronologischen Periodenleiste. Der Vergleich zur eindeutig vorherigen, abgeschlossenen Periode wird ohne Gleitkommarundung berechnet. Fehlende oder überlappende Perioden sowie mehrfache Matrixwerte erzeugen einen Klärungshinweis.

Vertragsregeln (Urlaub und Kündigung), Variantenkonfiguration (Ecklohn) und Periodenregeln (Lohnarten, Sonderzahlungen, Einsatzzulagen) sind getrennt aufklappbar. Echte Gruppen-/Stufenverweise und dokumentierte Matrixbereiche erhalten die zugehörigen Namen. Undokumentierte Codes behalten ihre Quellwerte; daraus wird keine persönliche Anwendbarkeit abgeleitet. Sämtliche Originalspalten und ihre Herkunft bleiben über Quelldetails erreichbar. Die Mitarbeiterabfrage verwendet denselben Tarifpfad.

Die Oberfläche verwendet `InformationCard`, `AppButton`, `AppSelect` und `AppTextInput` innerhalb des bestehenden `RouterPageLayout`. Auf schmalen Ansichten ersetzt eine Auswahl die Varianten-Seitenleiste.

Die Grundwertabfrage verwendet inklusive Datumsgrenzen und die Kette:

`Mitarbeiterzuordnung → Tarifvariante → Tarifperiode → Tarifstufe.INR / IX + Tarifgruppe.INR / IY → DWERT`.

Ein fehlender oder mehrfacher Treffer liefert einen Klärungshinweis. ÜTZ werden separat angezeigt. Lohnarten, Sonderzahlungen, Einsatzzulagen, Urlaub und Kündigungsfristen werden in dieser Version nicht berechnet.

Unwirksame Tarifzuordnungen und ÜTZ sind in der Mitarbeiterhistorie ausdrücklich markiert. Ihre Originaldaten bleiben sichtbar, sie werden bei Stichtagsabfragen und Überschneidungsprüfungen ausgeschlossen. Das ist keine Interpretation als Zvoove-Storno, sondern die Folge des leeren Gültigkeitszeitraums.

## Tariflohn und ÜTZ am Mitarbeiter

Auf einem geladenen Mongoose-Dokument aus `api/models/Employee/Mitarbeiter.js` stehen zwei asynchrone, rein lesende Methoden zur Verfügung:

```js
const mitarbeiter = await Mitarbeiter.findById(mitarbeiterId);
const tarif = await mitarbeiter.getTariffBaseRate('2026-10-07');
const uetz = await mitarbeiter.getAboveTariffValues('2026-10-07');

if (tarif.status === 'RESOLVED') {
  // tarif.value: exakter Dezimalstring, z. B. "15.33"
  // tarif.payGroup: Entgeltgruppe mit Name, Quell-ID und Matrixposition
}
if (uetz.status === 'RESOLVED') {
  // uetz.values.DPREIS: individueller ÜTZ-Quellwert als Dezimalstring
  // DPREISPROD, DEINSATZZULAGE und DPREISGEHALT bleiben getrennte Werte.
  // uetz.record: ursprüngliche Zuordnung mit Zeitraum und Quelldaten
}
```

Ohne Datum gilt der aktuelle Kalendertag in `Europe/Berlin`; explizite Datumsargumente müssen `YYYY-MM-DD` entsprechen. Die Methoden verwenden die stabile Mitarbeiter-ID aus dem aktiven Import, einschließlich der beim Import zugeordneten historischen Personalnummern. Sie sind auf geladenen Dokumenten verfügbar, nicht auf Objekten aus `.lean()`.

Fehlende oder mehrdeutige Treffer liefern `UNRESOLVED` mit `code` und `message`. ÜTZ wird unabhängig von einer gültigen Tarifzuordnung gefunden. `ABOVE_TARIFF_MISSING` bedeutet kein gültiger ÜTZ-Eintrag, `ABOVE_TARIFF_AMBIGUOUS` mehrere gleichzeitige Einträge, `NO_ACTIVE_IMPORT` einen noch nicht aktivierten Datenstand. Es wird kein Betrag angenommen oder summiert. Ungültige Stichtage führen zu einem Fehler mit Status 400.

Die Lohn-Section in `EmployeeCard` zeigt für Admins Tariflohn, Entgeltgruppe und – sofern vorhanden – den ÜTZ-Wert `DPREIS` für den angezeigten Stichtag. Liegen beide Beträge eindeutig vor, zeigt sie zusätzlich die dezimalgenaue Summe aus Tariflohn und `DPREIS`. Andere ÜTZ-Felder fließen nicht in diese Summe ein; bei fehlender oder mehrdeutiger Zuordnung wird keine Summe angenommen. Sie lädt erst beim Öffnen des Profils. Ein kompakter `wage-info`-Aufruf ermittelt beide Ergebnisse aus demselben Importstand; diese gemeinsame Antwort sollte verwendet werden, wenn ein gleichzeitiger Importwechsel zwischen zwei getrennten Methodenaufrufen ausgeschlossen werden muss. Die Rolle wird serverseitig aktuell aus der Datenbank geprüft. Bei Mitarbeiterwechsel, Schließen oder Rollenentzug werden laufende Antworten verworfen.

## API

Alle Endpunkte liegen unter `/api/tariffs`, benötigen `x-auth-token` und die aktuelle Adminrolle.

| Methode / Pfad | Ergebnis |
|---|---|
| `GET /catalog` | Aktiver Vertrag, Varianten und Perioden einschließlich Quelldaten |
| `GET /employees?search=&page=1` | Mitarbeitergruppen und ungeklärte Personalnummern, 50 pro Seite |
| `GET /employee-history?key=` | Tarifzuordnungen und ÜTZ; Schlüssel ist die Mitarbeiter-ID oder `personal:<Personalnummer>` |
| `GET /employees/:id/base-rate?date=YYYY-MM-DD` | `RESOLVED` mit Dezimalstring `value` und Herleitung oder `UNRESOLVED` mit Grund |
| `GET /employees/:id/wage-info?date=YYYY-MM-DD` | Kompakte Lohnanzeige: `baseRate`, `aboveTariff`, Stichtag und ein gemeinsamer `activeImportId` |
| `GET /imports` | Letzte 50 Importläufe und aktiver Import |
| `GET /imports/:id` | Vorschau einschließlich aktualisiertem Vergleich zum aktiven Stand und `basedOnImportId` |
| `POST /imports/preview` | Multipart mit 14 Dateien; speichert Vorschau, veröffentlicht nichts |
| `POST /imports/:id/activate` | JSON `{ "expectedActiveImportId": "…" }`, beim Erstimport `null` |

Die Multipart-Felder heißen `contract`, `employeeGroups`, `payGroups`, `stages`, `periods`, `rates`, `wageRules`, `specialPayments`, `assignmentAllowances`, `employeeAssignments`, `aboveTariff`, `referenceWages`, `noticePeriods`, `vacationRules`. Pro Feld ist genau eine `.xls`- oder `.xlsx`-Datei mit höchstens 20 MiB erlaubt. Es werden bis zu 2 Millionen Zellen je Blatt eingelesen.

## Validierung der bereitgestellten Dateien

Aus dem Verzeichnis `api` lässt sich mit `node scripts/validateTariffExports.js` die lokale Sammlung unter `Documentation/Tarif` ohne Datenbankzugriff prüfen. Ein anderer Basisordner kann als Argument angegeben werden. Die Ausgabe enthält Anzahlen, die zwei Referenzgrundwerte und Fehler mit Datei/Zeile; sie enthält keine Mitarbeiterlisten. Exitcode 1 signalisiert Datenfehler.

Die bereitgestellten Dateien ergeben für Tarif 17055: 8 Varianten, 80 Entgeltgruppen, 8 Stufen, 148 Perioden, 1.480 Entgeltwerte, 4.461 Mitarbeiterzuordnungen und 8.394 ÜTZ-Zeilen. Die Referenzperiode 1108622 liefert 15,33 € für IY 1 und 16,08 € für IY 3 bei IX 1. Alle 14 Dateien können gelesen werden; 4 Mitarbeiterzuordnungen und 12 ÜTZ-Zeilen besitzen umgekehrte Zeiträume. Nach ausdrücklicher fachlicher Entscheidung bleiben sie vollständig als unwirksame Historie erhalten und verhindern die Aktivierung nicht. Diese Quelldaten werden nicht automatisch korrigiert.

Der [erste Testlauf vom 06.10.2026](Testlauf_2026-10-06.md) dokumentiert die Prüfung vor dieser Entscheidung: Das Originalpaket wurde damals blockiert, eine temporäre Diagnosekopie ließ sich vollständig importieren. Nach der Entscheidung wird das vollständige Originalpaket einschließlich der 16 unwirksamen Zeilen übernommen. Beide Referenzgrundwerte und die Wiederverwendung identischer Imports sind durch gezielte Tests bestätigt.

Gezielte automatisierte Prüfung: `npx mocha tests/tariffDomain.test.js tests/tariffApi.test.js` im Verzeichnis `api` und `npx vitest run tests/Tarife.spec.js tests/TariffOverview.spec.js tests/TariffPeriodTimeline.spec.js tests/TariffRelatedRules.spec.js tests/EmployeeTariffWage.spec.js` im Frontend. Die API-Tests verwenden eine isolierte lokale MongoDB, keine Produktionsdatenbank. Lokale Dateiprüfung und Testfälle bestätigen keine produktive Aktivierung oder authentifizierte Browserprüfung.

## Import über ein lokales Skript

`node scripts/importTariffs.js` prüft die vollständigen Originaldateien gegen die tatsächlichen Mitarbeiter in der über `api/.env` konfigurierten Datenbank. Standardmäßig wird ausschließlich gelesen; es werden keine Collections oder Indizes angelegt. Die Ausgabe enthält Anzahlen und Hinweise als Aggregate, keine Mitarbeiteridentitäten oder Zugangsdaten.

Ein ausdrücklich beauftragter Import mit Aktivierung verwendet `--write --activate`. Zieldatenbank und erwarteter bisheriger aktiver Import müssen angegeben werden, beispielsweise für einen geprüften Erstimport:

```sh
node scripts/importTariffs.js --write --activate --expected-database=DB_01 --expected-active-import=none --report=/private/tmp/tariff-import-report.json
```

Bei einem vorhandenen Stand wird anstelle von `none` dessen Import-ID verwendet. Es werden nur die sieben Tarifcollections angelegt und verändert. Vor der Aktivierung werden alle gespeicherten Anzahlen, sämtliche Quellwerte und die beiden Referenzwerte gegen die eingelesenen Dateien geprüft. Der aktive Zeiger wird nur bei unverändertem Ausgangsstand umgeschaltet.

CLI-Aktionen speichern `createdActor` und `activatedActor` mit `kind: CLI`, Herkunftslabel und Skriptname. `createdBy` und `activatedBy` bleiben dabei leer; es wird kein Admin als handelnder Benutzer dargestellt. Die HTTP-API verwendet weiterhin den aktuell berechtigten, angemeldeten Admin und übernimmt keine vom Client angegebenen Actorfelder.

## Aktivierter Datenstand

Der [echte Import vom 06.10.2026](Import_2026-10-06.md) ist in DB_01 unter `6ac55b6506e971ddd419f433` aktiv. Alle 14 Tabellen und die 16 unwirksamen historischen Zeilen sind vollständig gespeichert. Der Bericht dokumentiert auch die beim tatsächlichen Mitarbeiterabgleich ungeklärten Personalnummern und Überschneidungen.

## Prüfung der Beziehungsansicht am 07.10.2026

30 gezielte Frontendtests und der Vite-Produktionsbuild sind erfolgreich. Zusätzlich wurde `/tarife` im lokal laufenden, angemeldeten Frontend mit dem aktivierten Datenstand geprüft: 8 Varianten, 148 Perioden, 1.480 Entgeltwerte; 15,33 € und 16,08 € in Periode 1108622 sowie 15,69 € für Entgeltgruppe 2b beim Wechsel auf Periode 1107092. Variantenwechsel und die schmale Darstellung wurden ebenfalls geprüft. Die Mitarbeiterabfrage ist durch Komponententests abgedeckt; eine neue produktive Bereitstellung ist damit nicht bestätigt.

## Prüfung der Mitarbeiter-Lohnanzeige

Die Ergänzung ist mit 21 Domain- und 21 API-Tests sowie 36 Frontendtests geprüft. Die API-Tests laufen gegen eine isolierte lokale MongoDB. Der Frontend-Build und ESLint für die neue Komponente sind erfolgreich. Im angemeldeten lokalen Frontend wurden sowohl eine fehlende Tarifzuordnung als auch die Anzeige von Tariflohn, Entgeltgruppe und separater ÜTZ mit vorhandenen Importdaten bestätigt.
