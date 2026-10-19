# Schnittberechnung mit historischer Zvoove-Ausweisung

Stand: 19.10.2026. `/payroll` öffnet über **Schnitt** ein Modal für den ausgewählten
Mitarbeiter. Standard sind drei vollständige Kalendermonate vor dem
Stichtagsmonat; Stichtag und Monatsanzahl (1–12) lassen sich ändern. Nach Änderungen
bereitet **Aufbereiten** die gewählten Daten neu auf.
Die Spaltenüberschriften der Lohnarten- und Arbeitstagetabelle sortieren per Klick
aufsteigend; ein weiterer Klick kehrt die Richtung um. Beide Tabellen behalten
ihre eigene Sortierung. Zahlen werden exakt numerisch und Monate chronologisch
verglichen; offene Werte bleiben am Ende. Berechnung und Summen bleiben unverändert.

## Quellen und Abgrenzung

Die ausdrücklich gewählte Grundlage sind historische **AUSWEISLOHN-Lohnpositionen**,
nicht die eigene Berechnungsvorschau. Für den vorhandenen Teststand liest
`AusweislohnHistoryService` die Dateien `api/assets/Ausweislohn YYYY.xlsx`
schreibgeschützt, prüft alle 24 Originalspalten und erhält Originalzeilen und
Herkunft im Adapter. Der Dateihash bezeichnet den verwendeten Stand. Der gelesene
Stand wird anhand von Dateigröße und Änderungszeiten zwischengespeichert.

Es wird kein neuer aktiver Datenbankimport angelegt. Ein allgemeiner
AUSWEISLOHN-Upload mit Vorschau/Aktivierung und dessen Nutzung für den vollständigen
Soll-Ist-Vergleich bleiben getrennte Arbeitsschritte. Die eigene
`PayrollPositionsService`-Berechnung verwendet weiterhin keine AUSWEISLOHN-Sollwerte.
Der Schnitt schreibt auch keine Fehlzeitenbewertung oder Lohnabrechnung zurück.

Nur `VERWENDUNG=L` trägt bei. Fehlende Aufträge sind gültig. Aktuelle und historische
Personalnummern werden dem ausgewählten Mitarbeiter zugeordnet; mehrdeutige
Personenzuordnungen werden abgelehnt. Januar bis September 2026 sind der bestätigte
abgeschlossene Sollstand, Oktober ist vorläufig und wird entsprechend gekennzeichnet.

Die Tageszählung verwendet alle **Kalendertage Montag–Freitag** des jeweiligen
Monats. Weder Buchungen noch deren SP1-Einstellung bestimmen diesen Nenner.
Der aktive monatliche STUNDEN-/KB-Import liefert nur die zusätzliche Angabe
„Davon FS“. Fehlt dieser Tagesstand, bleibt die FS-Aufschlüsselung offen;
die kalendarische Werktagszahl und daraus berechenbare Kennzahlen bleiben bekannt.

## SP1 und Arbeitstage

Die Regeln stammen aus dem aktuellen Lohnartenstamm und
`api/shared/payroll/averageStorageTypes.json`. Tage, Stunden und Betrag werden
jeweils unabhängig beschrieben. Für diesen Schnitt werden Stunden und Betrag
entsprechend addiert, subtrahiert oder nicht berücksichtigt. Beispielsweise
tragen 110/146 mit SP1=2 nur zum Betrag bei; ihre Stunden erscheinen mit 0,00.
Unbekannte Einstellungen für Stunden oder Betrag bleiben offen. Die
SP1-Tagesbeiträge sind für den Nenner dieses Schnitts nicht maßgeblich.

Bestätigte Zählregel für **diesen Schnitt**: ausschließlich **Montag–Freitag**,
je Datum höchstens einmal, unabhängig von vorhandenen Tageskennzeichen. FS,
Freizeitausgleich, andere Fehlzeiten und ungebuchte Wochentage verringern diese
kalendarische Zahl nicht. Auch ein
produktiver Wochenendtag erzeugt in diesem Verfahren keinen zusätzlichen
Arbeitstag. Stunden und Beträge der historischen Lohnpositionen werden weiterhin
für den gesamten Monat berücksichtigt, einschließlich Zuschlägen für Wochenenden.
Korrektur des Falls Personalnummer 2000134: Die drei FA-Tage vom 13.–15.07.2026
wurden zuvor wegen SP1=2 nicht gezählt. Juli hat hier 23 statt 20 Werktage.
Mai/Juni/Juli ergeben 21 + 22 + 23 = 66 statt 63 Tage. Aus den vorhandenen
470 Stunden und 7.430,55 € folgen 7,12 Std./Tag und 112,58 €/Tag.

## Formeln und Rundung

- Schnitt Stunden = Summe Stunden / Summe Werktage.
- Schnitt Betrag = Summe Betrag / Summe Stunden.
- Tagessatz = Summe Betrag / Summe Werktage.

Summen werden mit exakter Dezimalarithmetik gebildet. Jede Kennzahl wird direkt
aus den Summen berechnet und erst zum Anzeigen kaufmännisch auf zwei Stellen
gerundet. Ein bereits angezeigter Stunden- oder Geldschnitt wird nicht als
Zwischenergebnis für einen anderen Schnitt verwendet. Fehlende Eingaben und
nichtpositive Nenner liefern keinen scheinbar gültigen Geldsatz.

## Referenzprüfung „Schnitt Mascha“

Die bereitgestellte Datei `Schnitt Mascha.xlsx`, Blatt `Schnittberechnung Monat`,
enthält für Personalnummer 2000638 mit Stichtag 01.08.2026 sieben
Monats-/Lohnartgruppen. Die historischen AUSWEISLOHN-Positionen und der bereitgestellte
Lohnartenstamm reproduzieren die Zeilen 10–16. Die tatsächlichen Monatsdateien
Mai/Juni/Juli mit ihren KB-Kennzeichen reproduzieren 21/22/23 Tage aus Zeilen 18–20.
Die Auswertung der Originaldateien erfolgt getrennt von der produktiven Datenbank.

| Kennzahl | Ergebnis / Referenz Zeile 22 |
| --- | ---: |
| Summe Stunden | 264,00 |
| Summe Arbeitstage | 66,00 |
| Summe Betrag | 4.855,50 € |
| Schnitt Stunden | 4,00 |
| Schnitt Betrag | 18,39 €/Std. |
| Tagessatz | 73,57 €/Tag |

Der ungerundete Stundenbetrag beträgt 4.855,50 / 264 = 18,392045… €/Std.
18,39 × 4,00 ergibt dagegen 73,56 €. Diese Zwischenrundung kann also einen Cent
Abweichung erzeugen. Die direkte Rechnung 4.855,50 / 66 ergibt 73,568181… und
damit den Referenzwert 73,57 €. Die Referenz enthält gespeicherte Zahlen, keine
Excel-Formeln; die internen Zvoove-Rechenschritte sind daraus nicht vollständig
abzulesen. Die zusätzlichen Referenzfelder zur Aufteilung der Grundvergütung und
Zulagen sind dort null und werden ohne bestätigte Regel nicht ergänzt.

## API und Prüfungen

`GET /api/payroll/employees/:employeeId/average?cutoff=YYYY-MM-DD&months=3`
erfordert die aktuelle ADMIN-/PAYROLL-Rolle und Mitarbeiter-Standortberechtigung.
Die Antwort enthält ausschließlich die ausgewählten historischen Lohnpositionen,
Monatstage, Summen, Kennzahlen, Quellen und offene Punkte. Nicht berechtigte
Benutzer erhalten auch in der Toolbar keinen Zugriff auf Geldwerte.

Fokussierte Tests: `payrollAverage.test.js`, `payrollAverageApi.test.js` und
`frontend/Straight-Monitor/tests/payrollAverage.spec.js`. Sie prüfen unter anderem
L-/F-Trennung, SP1-Dimensionen, FS und Wochenenden, Datumseindeutigkeit,
Referenzbeträge, Rundung, fehlende Quellen, Berechtigungen und verspätete Antworten.
