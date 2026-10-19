# Zeitbuchungen, Lohn und Faktur

Stand: 19.10.2026. Ziel ist ein eigener fachlicher Ablauf:

**Erfassung → Zeitbuchung mit Pausen → Segmentierung → Lohn-/Fakturpositionen → Monatssummen/Rechnungsentwurf.**

Zvoove liefert zunächst Eingangsdaten und unabhängig davon erwartete Ergebnisse.
Referenzbeträge sind niemals Berechnungseingaben. Später kann die App-Erfassung
dieselben Fachmodelle beliefern. Die bestehende `Stundenzeit` mit Meldung,
Bearbeitung und Freigabe bleibt erhalten; eine App-Freigabe erzeugt in dieser
Phase keine zusätzliche abrechenbare Zvoove-Zeitbuchung.

## Fachmodelle

`api/models/Payroll/Abrechnung.js` enthält explizite Mongoose-Schemata:

| Modell | Verantwortung |
| --- | --- |
| `Zeitbuchung` | Tatsächliche Zeitpunkte, Pausenintervalle, produktive Minuten, Originalmengen, Zuordnung, Hinweise |
| `AbrechnungsregelVersion` | L-/F-Verwendung, Auftrag/Mitarbeiter/Einsatzposition, Zeitfenster, Gültigkeit, Tage, Sätze, ursprüngliche Schalter |
| `AbrechnungDatenstand` | Unveränderlicher Eingabe- oder Referenzstand mit Originalzeilen |
| `ZvooveDetailImport` / `AbrechnungImportState` | Vorschau, Aktivierung und aktiver Zeiger je Importumfang |
| `Ausweisung` | Unveränderliche Eingaben, Parameter und Ergebnisse einer eigenen Berechnung |
| `AbrechnungVergleich` | Vergleich mit einem ausdrücklich gewählten Referenzstand |

`Lohnposition` und `Fakturposition` sind getrennte, typisierte Positionslisten
innerhalb der Ausweisung. Positionen enthalten exakte Mengenbrüche, Sätze,
Prozentsätze, exakte Beträge vor Rundung, Modellbeträge, Zeitsegmente sowie
Buchungs-/Regelreferenzen. Monatssummen und Rechnungsentwürfe werden daraus
abgeleitet. Bestehende Rechnungsköpfe und Bestandsrechnungen bleiben erhalten.

Anwesenheit, produktive Zeit und bezahlte Pausen sind getrennt. Das bisherige
`Stundenzeit.netMinutes` inklusive bezahlter Pause wird nicht als allgemeine
produktive oder fakturierbare Menge übernommen. Zuschlagsmengen vervielfachen
keine tatsächlich geleisteten Stunden.

## Excel-Eingaben importieren

Für die vollständigen Originaltabellen mit separaten Arbeits-/Pausenzeilen gilt
der [Jahresimport von Stundenvortrag und Stunduhr](Zvoove-Zeitimport.md).
Er verwendet alle 40 bzw. 34 Quellspalten, stabile REPL-Identitäten und liefert
die aktiven Zeitbuchungen. Der Jahresstand hat für seine Zeitdaten Vorrang vor
einem älteren Auftragszeitimport. Auftragsregeln und Referenzen verwenden
weiterhin die folgenden Detail-Endpunkte.

### Bisheriger Adapter für aufbereitete Auftragsdateien

`POST /api/payroll/detail-imports/preview` erwartet Multipart:

- `kind=INPUT`, `auftragNr`, optional `pauseUnit=HOURS|MINUTES`.
- Optional `ruleTimeUnit=DECIMAL_HOURS`, wenn AUFTRLOA-Zeitfenster als Stundenwerte
  wie `23` bis `6` vorliegen. Standard `CLOCK` erwartet `HH:MM`/Excel-Tagesbruchteile.
- Eine bis drei Dateien in den Dateifeldern `STUNDUHR`, `STUNDENVORTRAG`, `AUFTRLOA`.

Dateinamen bestimmen keine Rolle. Jede `.xlsx`/`.xls`-Datei enthält ein befülltes
Tabellenblatt mit eindeutiger Kopfzeile. Ein Blatt nur mit vollständiger Kopfzeile
kann eine Rolle ausdrücklich leeren. Grenzen: 20 MB je Datei, 15000 Zeilen und
normalisiert 8 MB je Paket. Originalüberschriften, Zellen, sämtliche Quellspalten,
Datei, Blatt, Zeile und vorhandene Quell-IDs bleiben erhalten.

Ein INPUT-Stand gehört zu genau einem Auftrag (`order:2510476`). Eine gelieferte
Rolle ersetzt **alle bisherigen Zeilen dieser Rolle für diesen Auftrag**.
Nicht gelieferte Rollen bleiben erhalten. Für Ergänzungen einer Rolle muss also
deren vollständiger aktueller Auftragsauszug geliefert werden. Damit benötigen
wir keinen erfundenen stabilen Zvoove-Zeilenschlüssel. Mehrere Buchungen je Tag
bleiben erhalten; Überschneidungen benötigen Klärung.

Die Vorschau liefert `id`, `snapshotId`, `baseRevision`, `counts`, `issues`,
`status=PREVIEW|INVALID`. Fachlich ungeklärte Buchungen können gespeichert und
aktiviert werden; ihre Hinweise sperren anschließend die Berechnung. Falsche
Aufträge und ungültige Referenzdaten verhindern die Aktivierung.

`POST /api/payroll/detail-imports/:id/activate` erwartet JSON mit
`expectedRevision` gleich der geprüften `baseRevision`. Gleichzeitige Änderungen
ergeben HTTP 409. Eine doppelte Aktivierung desselben aktuellen Imports ist
unschädlich. Alte Stände bleiben erhalten. `GET /api/payroll/detail-imports`
liefert die Historie, `GET /api/payroll/detail-imports/:id` auch Quellen und Stand.

### Zeiten, Pausen und Regeln

Die folgende Pausensummen-Konfiguration beschreibt den bisherigen Adapter für
aufbereitete Dateien. Sie ist **nicht** die Semantik von `STUNDUHR.PAUSE` in
den Originaljahresdateien: Dort ist PAUSE ein Zeilentyp und STUNDEN die jeweilige
Arbeits- oder Pausenmenge. Solche Originaldateien werden im alten Adapter
abgelehnt. Im Jahresimport bleiben Nettostunden ohne genaue Pausenlage nutzbar;
betroffene Zuschläge benötigen eine Klärung.

`STUNDUHR` benötigt `PERSONALNR`, `AUFTRAGSNR`, `DATUM`, `VON`, `BIS`, `STUNDEN`,
`PAUSE`. `IDARBEITSSCHICHT`, `EINSORT`, `BEZAHLTE_PAUSE` und weitere Spalten bleiben
erhalten. Ein explizites `EINSPERSNR` kann die Einsatzregelzuordnung belegen.

`STUNDENVORTRAG` benötigt `ID`, `PERSONALNR`, `DATUM`, `IDARBEITSSCHICHT`,
`ISTZEITENVON`, `ISTZEITENBIS`. Hinzu kommen tatsächliche `PAUSE1VON/BIS` bis
`PAUSE3VON/BIS` samt `PAUSEnISTBEZAHLT`. Die Zuordnung über Personalnummer,
Schicht und Tag muss eindeutig sein. Arbeitszeiten und Pausensummen müssen
übereinstimmen. Eine positive Pausensumme benötigt eine ausdrücklich gewählte
Einheit. Fehlende Pausenlagen werden nicht geschätzt.

Unterstützt sind ISO-/deutsche Kalenderdaten, Excel-Datumsserien einschließlich
1904-System und Uhrzeiten als `HH:MM` oder Excel-Tagesbruchteile. `24:00` ist als
Ende erlaubt. Sekunden werden nicht gerundet. Mitternacht wird in vollständige
Zeitpunkte mit `Europe/Berlin` aufgelöst. Mehrdeutige oder nicht existente lokale
DST-Zeiten bleiben ungeklärt. Abweichende gebuchte Stunden werden gespeichert
und vor der Ausweisung zur Klärung markiert. `STUNDEN` und der bestehende
Monatsimport bleiben unabhängige Summenkontrollen.

`AUFTRLOA` benötigt mindestens `AUFTRAGNR`, `LOHNART`, `VERWENDUNG`. Eine automatisch
auswertbare Regel benötigt zusätzlich `AB`, `BIS`, `MONTAG` bis `SONNTAG`,
`FEIERTAG`, `NICHTAUTOM` und einen eindeutigen Satz. Unbekannte relevante Codes
bleiben erhalten und werden als unbestätigte Semantik markiert. Uhrzeitwerte
werden gemäß der ausdrücklich gewählten `ruleTimeUnit` interpretiert.

## Eigene Ausweisung

### Berechnungspositionen in `/payroll`

Die unteren Tabs zeigen eine eigene, schreibgeschützte Berechnungsvorschau.
`GET /api/payroll/employees/:employeeId/positions?month=YYYY-MM` benötigt die
aktuelle ADMIN-/PAYROLL-Rolle und die Mitarbeiter-Standortberechtigung.
Fakturpositionen sind weiterhin ADMIN vorbehalten; PAYROLL erhält ausschließlich
lohnseitige Daten. Ein Rollenwechsel leert auch bereits geladene Positionen.

Die Ansicht verwendet die bestehende Rechenlogik für aktive Zeitbuchungen,
Tarifgrundlohn, separate ÜTZ und auftragsbezogene Zuschlagsregeln. Es werden keine
Sollmengen oder Sollpreise aus AUSWEISLOHN als Berechnungseingaben verwendet.
Die Vorschau legt keine Ausweisung oder Rechnung in der Datenbank an.

Ein eindeutiger, am Buchungstag gültiger Kundenpreis zur Einsatzqualifikation
kann fehlende fakturseitige Grundstundenregeln für diese Vorschau ergänzen.
Diese Grundstunden bleiben ausdrücklich eine Teilbewertung, bis die konkreten
Auftragskonditionen geprüft sind. Es gibt keinen Vorrang vor vorhandenen
Auftragsregeln und keinen daraus abgeleiteten Zuschlagssatz. Mehrdeutige Preise
werden nicht ausgewählt. Kundenkonditionsvorlagen sind im eigenen Tab sichtbar.

- **LOHN/FAKTUR** enthält alle Positionen beider Seiten, einschließlich
  Fehlzeiten, Freischichten und offener Bewertungen.
- **SUMME LOHN** und **SUMME FAKTUR** filtern dieselben Positionen nach Seite
  und verdichten gleiche Lohnart, Satz, Prozent und Kategorie.
- **FEHLZEITEN** enthält ausschließlich nichtproduktive Einträge und
  Tageskennzeichnungen. Durchschnittsbeträge bleiben offen.
- Die weiteren Summenansichten verdichten dieselben Daten, bei A./E. zusätzlich
  nach Auftrag und Einsatzort. Noch nicht implementierte Bereiche werden benannt.

Lohnzeilen sind grün, Fakturzeilen blau. Die Auswahl eines Tages filtert nach
dem in der Stundenmatrix dargestellten Buchungstag. Auch über Mitternacht
gehörende Abschnitte bleiben dieser Auswahl zugeordnet; ihr tatsächlicher
Abschnittstag wird in `serviceDate` erhalten. Ohne Tagesauswahl gilt der Monat.
`Monat anzeigen` hebt die Tagesauswahl auf. Tab- und Scrollzustand bleiben beim
Laden anderer Monate erhalten.

Gesamtstunden folgen ausschließlich `Lohnart.fuerGesamtstunden`, einschließlich
der im Stamm gelieferten Werte `Ja`/`Nein`. Lohn und Faktur werden dabei getrennt
summiert. Insbesondere führt eine zusätzliche 110-Zeile nicht automatisch zu
weiteren Arbeitsstunden. Fehlende Kennzeichen und Zeitkonflikte werden als offene
Stundenanrechnung angezeigt. ÜTZ zeigt Verrechnungsart, Ziel-Lohnart und Priorität;
eine noch ungeklärte Verrechnung wird nicht als abgeschlossen ausgewiesen.

Fehlende Preise oder Zuschlagsmengen bleiben leer und begründet. Bekannte
Nettomengen ohne genaue Pausenlage bleiben für Grundstunden verwendbar;
betroffene Zuschläge erscheinen als offene Zeilen ohne erfundene Menge.
Die Betragsanzeige unterscheidet fertige Summen von bewerteten Teilpositionen.
Monatsaggregate aus STUNDEN werden nicht zusätzlich zu Detailzeiten desselben
Tages gezählt. Die eigentliche Monatsabschluss-/AZK- und Durchschnittslogik bleibt
von dieser Tagesvorschau getrennt.

### Gespeicherte Ausweisungen

`GET /api/working-times/bookings?auftragNr=2510476` liest aktive Buchungen.
Alternativ sind `employeeId` und `month=YYYY-MM` zusammen zulässig. Aggregierte
Tages-/Monatsstunden werden nicht zusätzlich zu Detailzeiten gezählt.

`POST /api/abrechnung/ausweisungen` akzeptiert beispielsweise:

```json
{
  "side": "F",
  "auftragNr": 2510476,
  "policies": {
    "rounding": "HALF_UP_PER_POSITION",
    "dayBasis": "SEGMENT_DATE",
    "supplementBasis": "RULE_PRICE",
    "overlap": "STACK",
    "precedence": "EMPLOYEE_OVER_ORDER"
  }
}
```

Dies sind ausdrücklich gewählte **Modellannahmen**, keine bestätigten
Zvoove-Voreinstellungen. Fehlende relevante Parameter erzeugen Hinweise.
Alternativen: `dayBasis=SHIFT_DATE`, `supplementBasis=BASE_RATE`,
`overlap=HIGHEST_ONLY`. Feiertagsregeln benötigen zusätzlich konkrete
`holidayDates` für den untersuchten Umfang. Ein leeres Array bedeutet die
ausdrückliche Annahme, dass im untersuchten Umfang keine Feiertage gelten.

Die erste Berechnung unterstützt:

- F-Grundstunden 100 aus einer eindeutigen AUFTRLOA-Regel mit explizitem `PREIS`.
- Prozentuale Zuschläge mit Berechnungsart 4 aus getrennten L-/F-Regeln.
- L-Grundstunden 100 aus dem bestehenden Tarifmodul 17055 und separate ÜTZ 110
  aus dessen Stichtagshistorie. F-Regeln erzeugen keine L-Zuschläge.
- Exakte Bruchrechnung bis zur Modellrundung auf Cent je Position. Positionen
  entstehen je Buchung, Kalendertag und Regel. Monatswechsel werden nach dem
  tatsächlichen Leistungsdatum aufgeteilt.

Weitere Tarifregeln (z. B. AZK), ÜTZ-Verrechnung, Garantien, manuelle Lohnarten,
bezahlte Pausen und unbekannte Codes erzeugen Klärungshinweise. `EINSPERSNR` wird
niemals mit Mongo-ID oder Schicht-ID gleichgesetzt. Der Einsatzimport erhält
dafür optionale explizite `EINSPERSNR`-/`EINSORTNR`-Spalten. Ein fehlender
AUFTRLOA-Preis wird nicht durch einen unbestätigten Vorrang von PREISE/KOND
ersetzt; die Geldbewertung bleibt unvollständig.

Antworten enthalten `lohnpositionen` oder `fakturpositionen`, `monthlySummaries`,
`invoiceDrafts`, `issues`, `totals`, `inputs`, `calculationVersion`, `stale` und
`transmissionEnabled=false`. `PREVIEW` bedeutet vollständig innerhalb dieses
begrenzten Rechenprofils. `INCOMPLETE` enthält Teilpositionen, jedoch keine
vollständige Gesamtsumme/Rechnungsnettosumme. Das ist weder Gesamtbrutto noch
Nettoauszahlung, ausgestellte Rechnung oder produktiver Abrechnungslauf.

`GET /api/abrechnung/ausweisungen/:id` liest den unveränderlichen Lauf.
Identische Eingaben werden wiederverwendet. Geänderte aktive Buchungs-/Regelstände,
Tarifimporte oder relevante Lohnartenmetadaten machen ihn überholt.

## Referenzimport und Abgleich

Referenzen verwenden dieselben Import-Endpunkte mit `kind=REFERENCE` und
`scope=order:2510476` oder `scope=month:2026-10`. Dateifelder sind ausdrücklich
`LOHNPOSITIONEN`, `LOHNARTENSUMMEN`, `FAKTURPOSITIONEN`, `RECHNUNGEN`.

Dies sind **kanonische Austauschformate unseres Backends**, keine behaupteten
Zvoove-Tabellennamen. Echte Ergebnisexporte müssen anhand ihrer tatsächlichen
Spalten zugeordnet werden; unbekannte Herstellerformate werden nicht geraten.

| Rolle | Pflichtspalten |
| --- | --- |
| `LOHNPOSITIONEN` | `PERSONALNR`, `DATUM`, `LOHNART`, `MENGE`, `EINHEIT`, `BETRAG` |
| `LOHNARTENSUMMEN` | `PERSONALNR`, `MONAT`, `LOHNART`, `MENGE`, `EINHEIT`, `BETRAG` |
| `FAKTURPOSITIONEN` | `PERSONALNR`, `AUFTRAGNR`, `DATUM`, `LOHNART`, `MENGE`, `EINHEIT`, `BETRAG` |
| `RECHNUNGEN` | `AUFTRAGNR`, `BETRAG` |

`MONAT` ist `YYYY-MM`; Stunden verwenden `EINHEIT=HOUR`. Optionaler `SATZ`
bezeichnet den Grund-/Bezugssatz vor Prozentzuschlag, `BETRAG` den Netto-
Positionsbetrag bzw. die Rechnungsnettosumme in EUR. `PROZENT` und `RECHNUNGNR` können ergänzt
werden. Auftragsreferenzen benötigen `AUFTRAGNR` auch für Lohnreferenzen.
Monatsreferenzen benötigen Monat oder Leistungsdatum. Lohn-Tagespositionen
müssen innerhalb einer Vergleichsrolle einheitlich mit oder ohne Auftrag vorliegen.

`POST /api/abrechnung/ausweisungen/:id/compare` erwartet:

```json
{
  "referenceSnapshotId": "ID_DES_REFERENZDATENSTANDS",
  "referenceKind": "RECHNUNGEN"
}
```

Referenz und Ausweisung müssen denselben fachlichen Umfang enthalten.
Verglichen werden Tagespositionen, Mitarbeiter-/Monats-/Lohnartensummen oder
Rechnungsnettosummen je Auftrag. Differenzen unterscheiden fehlende/zusätzliche
Positionen, Menge, Satz und Betrag. Mengen bleiben exakte Stundenbrüche.
`granularity` benennt den geprüften Umfang: Auftragsnetto, Monatslohnartensumme
oder Tageslohnartensumme, bei vollständig gelieferten Sätzen/Prozenten zusätzlich
je Satz/Prozent. Ein übereinstimmender Rechnungsnettobetrag beweist allein noch
keine übereinstimmenden Einzelpositionen.
Ergebnisse sind `MATCH`, `DIFFERENT`, `INCOMPLETE`. Unvollständige Berechnungen
und fehlende Referenzen können keinen MATCH ergeben. Gewählte Referenzstände
bleiben auch nach späteren Aktivierungen reproduzierbar.

## Zugriff und Prüfung

Rollen werden bei jedem Aufruf aus MongoDB gelesen. Imports und Referenzvergleiche
sind zunächst Admin-Aufgabe. F-Ausweisungen sind Admins vorbehalten.
L-Ausweisungen benötigen ADMIN/PAYROLL; PAYROLL verwendet eine Mitarbeiterauswahl
mit Standortprüfung. Buchungsabfragen verwenden die bestehende Mitarbeiter-/
Auftragsstandortberechtigung. Bestehende Monats-/Erfassungsrouten bleiben erhalten.

Isolierte Domain-/API-Tests: `api/tests/abrechnung.test.js`. Sie prüfen unter
anderem Originalerhalt, Pausenlage, Nachtarbeit, Monatswechsel, Überlappungen,
L-/F-Trennung, Modellrechnung 2510476, Referenzunabhängigkeit, unveränderliche
Stände und Rollenentzug. 593,55 EUR bleibt ein Modellvergleich; eine echte
Zvoove-Faktur wurde damit nicht bestätigt.

Prüfung am 19.10.2026: 93 fokussierte Domain-/API-Tests einschließlich der
bestehenden Stunden-, Lohnarten- und Tarifreferenztests erfolgreich; Syntaxprüfung
und `git diff --check` ebenfalls erfolgreich. Alle Datenbank-/HTTP-Prüfungen
verwendeten isolierte lokale Testinstanzen. Es wurden keine produktiven Daten
importiert, keine Rechnung ausgestellt und keine externen Lohnübergaben gestartet.
