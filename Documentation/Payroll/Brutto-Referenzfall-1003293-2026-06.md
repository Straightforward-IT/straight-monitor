# Brutto-Referenzfall 1003293, Juni 2026

Der Referenzbetrag lässt sich aus den vorhandenen, voneinander unabhängigen
Stunden- und Tarifdaten exakt reproduzieren:

**76 produktive Stunden × 15,29 EUR = 1.162,04 EUR brutto.**

## Quellen und Befund

Am 16.10.2026 wurden die aktiven importierten Stunden und Tarifdaten für diesen
Mitarbeiter ausschließlich lesend geprüft. Die sechs gespeicherten Wochenzeilen
stimmen mit den entsprechenden Originalzeilen aus `Stunden/2026/Juni.xlsx`
überein. Der Test enthält nur den benötigten Auszug, keine Namen, Kontakt- oder
Bankdaten. Die interne Mitarbeiter-ID ist durch eine synthetische ID ersetzt.

| Grundlage | Quelle | Ergebnis |
| --- | --- | --- |
| Erwartetes Gesamtbrutto | `Lohn Monat Ich.xlsx`, Tabelle1, N2 | 1162.04 EUR; nur Vergleichswert |
| Jahr / Monat / Personalnummer | Dieselbe Datei, B2 / C2 / D2 | 2026 / 6 / 1003293 |
| Produktive Stunden | `Juni.xlsx`, Tabelle1, Zeilen 302, 810, 1818, 1970, 3052, 3344 | 76 Stunden an 12 Tagen; leere KZ zu befüllten T-Zellen |
| Tageskennzeichen FS | Dieselben Stundenzeilen | 18 Tage; keine zusätzlichen Lohnstunden |
| Tarifzuordnung | `709.xlsx`, Tabelle1, Zeile 3836, ID 1107852 | Ab 07.05.2026, offenes Ende; Gruppe 21015, Entgeltgruppe 21017, Stufe 21025 |
| Tarifgruppe | `701.xlsx`, Tabelle1, Zeile 3 | 21015: Lohn Ost KZF |
| Entgeltgruppe / Stufe | `702.xlsx`, Zeile 12 / `703.xlsx`, Zeile 3 | 2. Entgeltgruppe a, Eingangsstufe; Matrix IY 2 / IX 1 |
| Tarifperiode | `704.xlsx`, Tabelle1, Zeile 138, ID 1107092 | 01.01.2026 bis einschließlich 31.08.2026 |
| Grundstundenlohn | `705.xlsx`, Tabelle1, Zeile 1394, ID 1107094 | 15.29 EUR |
| ÜTZ | Aktiver Tarifdatenstand, vollständige Mitarbeiterhistorie | Keine Einträge; keine historischen Personalnummern; fehlende ÜTZ = 0 |
| Basis-Lohnart | `Lohnarten.xlsx`, Tabelle1, Zeile 2 | 100, Berechnungsart 2: Stunden × Stundenlohn |

Der spätere Satz von 15,67 EUR ab 01.09.2026 ist ebenfalls im Test enthalten.
Er darf für Juni nicht verwendet werden. Die Wochenstunden 9,25 aus dem
Monatslohnauszug sind Vertragsdaten und werden nicht als tatsächlich geleistete
Monatsstunden verwendet.

| Kalenderwoche | Produktive Stunden |
| --- | ---: |
| 23 | 12 |
| 24 | 19,5 |
| 25 | 26,5 |
| 26 | 18 |
| 27 | 0 |
| **Summe** | **76** |

## Ausführbarer Test und Aussagegrenze

Aus `api/`:

```sh
npx mocha tests/payrollGrossReference.test.js
```

Der Test erzeugt aus dem festgehaltenen Stunden-Auszug eine Excel-Eingabe für den
echten Stundenparser, löst Mitarbeiter und Tageskennzeichen auf und verwendet
`Mitarbeiter.getTariffHourlyWage(date, context)` am jeweiligen Arbeitstag. Die
Tarifhistorie stammt aus dem festgehaltenen Importstand; es gibt keine Verbindung
zur Live-Datenbank im Test und keine Abhängigkeit vom Windows-Server-Laufwerk.
Der Referenzbetrag ist ausschließlich Erwartungswert, keine Eingabe in die
Berechnung. Stunden und Satz werden nicht aus ihm zurückgerechnet.

Die Multiplikation und Addition verwenden die vorhandene exakte Dezimalarithmetik.
Erst die Monatssumme wird auf Cent gerundet. Fehlender Tariflohn und mehrdeutige
ÜTZ lassen den Test mit Datum und Fehlercode scheitern. Eine zusätzliche ÜTZ
würde eine getrennte Berechnung einschließlich ihrer Verrechnungsgrundlagen
erfordern und ist ausdrücklich außerhalb dieses Referenzfalls.

Dies ist ein Nachweis der Datenbasis für diesen einfachen Fall mit produktiven
Normalstunden. Die Reproduktionsformel steht bewusst im Test; ein allgemeiner
Bruttorechner oder eine automatische Payroll-Buchung wird damit noch nicht
eingeführt. Der Monatsauszug enthält keine einzelnen Lohnpositionen. Dass die
reproduzierte Summe dem Gesamtbrutto entspricht, beweist daher noch keine
positionsweise Übereinstimmung mit Zvoove. Kunden-/Nachtzuschläge, bezahlte
Fehlzeiten, Durchschnitt, AZK-Verrechnung und weitere Lohnarten benötigen eigene
Referenzfälle und die jeweils erforderlichen Eingaben.
