# Brutto-Abgleich mit Zuschlagsfällen, Juni bis September 2026

Die zehn Monatszeilen aus `lohn test.xlsx` wurden am 16.10.2026 mit den aktiven
Stunden- und Tarifimporten verglichen. Die Auswertung erfolgte ausschließlich
lesend. Der reproduzierbare Test verwendet einen beschränkten Quellauszug mit
synthetischen internen Mitarbeiter-IDs und ohne Namen oder Kontaktdaten.

## Ergebnis je Zeile

Alle Beträge sind EUR. Die Spalte 100 + 110 ist ausschließlich die Bewertung
produktiver Importstunden mit dem am jeweiligen Arbeitstag gültigen Tariflohn
und der ÜTZ. Sie ist kein vollständiger Bruttorechner. Die Differenz ist
Gesamtbrutto laut Referenz minus diese Teilsumme.

| Personalnummer | Monat | Produktive Stunden | 100 + 110 | Gesamtbrutto Referenz | Ungeklärte Differenz |
| --- | --- | ---: | ---: | ---: | ---: |
| 2001090 | 2026-06 | 48,50 | 741,57 | 825,67 | +84,10 |
| 2001090 | 2026-07 | 0 | 0,00 | 0,00 | 0,00 |
| 2001090 | 2026-08 | 5,00 | 76,45 | 89,83 | +13,38 |
| 2001090 | 2026-09 | 38,75 | 607,21 | 607,21 | 0,00 |
| 2001120 | 2026-06 | 12,00 | 183,48 | 183,48 | 0,00 |
| 2001120 | 2026-07 | 24,50 | 374,61 | 393,72 | +19,11 |
| 2001120 | 2026-08 | 41,25 | 630,71 | 644,09 | +13,38 |
| 2001120 | 2026-09 | 53,75 | 860,00 | 860,00 | 0,00 |
| 2001170 | 2026-09 | 48,75 | 763,91 | 602,67 | −161,24 |
| 2001193 | 2026-09 | 8,00 | 125,36 | 125,36 | 0,00 |

Fünf Gesamtbeträge stimmen numerisch mit der Teilsumme überein, einschließlich
des leeren Julimonats. Das allein belegt keine vollständige Übereinstimmung
einzelner Lohnpositionen. Bei neun Zeilen stimmt die Teilsumme exakt mit
`STBRUTTOLFD` überein. Die vier positiven Differenzen sind in diesem Feld nicht
enthalten. Ihre konkreten Lohnarten lassen sich aus der Monatssumme nicht ablesen.

Die September-ÜTZ von 2001120 ist als unabhängiger Satz von 0,33 EUR gespeichert:
53,75 Stunden × 15,67 EUR Grundlohn ergeben 842,26 EUR und die separate ÜTZ
17,74 EUR, zusammen 860,00 EUR. Die ÜTZ wird nicht doppelt angesetzt.

2001170 gehört zur Tarifgruppe 27356 mit AZK. Die 48,75 produktiven Stunden zum
Tariflohn ergeben 763,91 EUR. Die Referenz weist dagegen 485,14 EUR in
`STBRUTTOLFD` und 117,53 EUR in `STBRUTTOSO` aus, zusammen 602,67 EUR. Die
AZK-Gruppe enthält zusätzliche Tarifregeln, unter anderem Lohnart 192. Damit ist
eine direkte Auszahlung sämtlicher produktiver Stunden keine ausreichende
Erklärung. Die konkreten AZK-Bewegungen und die Lohnart hinter 117,53 EUR sind
noch unbelegt. Es wird weder auf einen Grenzbetrag gekappt noch eine AZK-Menge
aus dem erwarteten Brutto zurückgerechnet.

## Was für eine Zuschlagsreproduktion fehlt

Der bestehende Join über Mitarbeiterpersonalnummer, Einsatztag, Auftrag und
Kunde liefert Einsatzplanung und Kundenkonditionen. Für die untersuchten
Mitarbeiter und den Zeitraum wurden 43 Planungseinträge und 17 verknüpfte
Kundenkonditionen gefunden. Alle 17 Konditionen tragen `verwendung = F`.
Darunter sind Nachtregeln der Lohnart 166 mit 25 Prozent und dem Fenster
23–6 Uhr. Diese Fakturregeln belegen keine lohnseitige Mitarbeiterregel.
Für diese Mitarbeiter wurden keine freigegebenen `Stundenzeit`-Istintervalle
im Zeitraum Juni bis September gefunden.

Die tatsächlich zugeordneten Tarifperioden enthalten Grund- und Zulagenregeln,
aber keine explizite Nachtregel 166. Der Lohnartenstamm beschreibt eine Nacht-
Lohnart, bestimmt aber allein nicht, wann diese beim Mitarbeiter greift.

Ein konkretes Beispiel zeigt die fehlende Zeitauflösung: Am 29.08.2026 ist für
2001090 ein Einsatz von 21:30 bis 03:30 geplant, also sechs Stunden. Der
Stundenimport enthält fünf produktive Stunden. Die fehlende Stunde sagt nicht,
ob die tatsächliche Anwesenheit kürzer war oder wann eine Pause lag. Deshalb
lassen sich die zuschlagspflichtigen Nachtstunden nicht eindeutig bestimmen.

Für eine unabhängige vollständige Reproduktion benötigen wir:

- Tatsächliche Arbeitsintervalle einschließlich Pausen und sicherer Zuordnung
  der produktiven Importstunden zu Auftrag und Kunde.
- Die für den Mitarbeiter gültigen lohnseitigen Zuschlagsvereinbarungen mit
  Zeitfenstern, Wochentagen, Prozentsatz und Zuschlagsbasis. Kundenbedingungen
  für Faktur werden nicht automatisch zu Lohnbedingungen. Der aktuelle
  Kundenkonditionsstamm besitzt außerdem keine zeitliche Historie.
- Lohnpositionen des Referenzmonats mit Lohnartnummer, Menge, Satz und Betrag,
  um Zuschläge, sonstige Bezüge und AZK-Bewegungen getrennt abzugleichen.

## Test und Quellen

Aus `api/`:

```sh
npx mocha tests/payrollGrossReference.test.js tests/payrollGrossSupplementsReference.test.js
```

`tests/fixtures/payroll/supplements-2026-06-09.json` hält die unabhängigen
Stundenzeilen, Tarif-/ÜTZ-Historien, Konditionen und die getrennten Referenzsummen
fest. Der Erwartungsbetrag fließt nicht in die Stunden- oder Satzberechnung ein.
Die Tests prüfen die zehn Teilsummen und ihre Abweichungen. Grüne Tests bedeuten
hier auch, dass eine bekannte Lücke korrekt erkannt wird; sie bedeuten keine
vollständige Reproduktion aller zehn Bruttobeträge.

Referenz: `/Users/cedricbleck/Windows Server/lohn test.xlsx`, Tabelle1,
Zeilen 2–11; Personalnummer D, Jahr B, Monat C, laufendes Steuerbrutto J,
sonstiges Steuerbrutto K, Gesamtbrutto N. Stundenquellen sind die monatlichen
Dateien Juni bis September 2026. Der Test läuft ohne Zugriff auf die
Live-Datenbank oder die Originaldateien. Import-IDs, Quellzeilen und Tarifquellen
sind im Fixture hinterlegt.
