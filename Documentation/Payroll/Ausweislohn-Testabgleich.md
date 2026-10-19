# Testgrundlage AUSWEISLOHN 2026

Stand: 19.10.2026. Die Originaldatei `api/assets/Ausweislohn 2026.xlsx` wurde
vollständig und unverändert gelesen. Diese Prüfung beurteilt die Testgrundlage;
sie ist kein Import in die aktive Datenbank und keine vollständige eigene
Neuberechnung der Zvoove-Ausweisung.

## Bestätigter Umfang

- Januar bis September 2026 sind abgeschlossen und bilden den verbindlichen
  Sollbestand. Oktober ist vorläufig und wird getrennt behandelt.
- Lohn wird zunächst je Mitarbeiter, Monat und Lohnart verglichen. Viele
  lohnseitige Normalstunden stehen nach dem Monatsabschluss am Monatsletzten.
  Dieses Datum wird nicht als ursprünglicher Leistungstag einer Schicht benutzt.
- Faktur wird zusätzlich nach Auftrag und Leistungstag verglichen. Lohn und
  Faktur erhalten getrennte Mengen und Beträge; ihre Stunden werden nicht zu
  einer vermeintlich doppelten produktiven Arbeitszeit addiert.
- Urlaub und weitere entsprechend konfigurierte Lohnarten benötigen das
  Durchschnittsverfahren. Die [historische Schnittberechnung](Schnittberechnung.md)
  nutzt jetzt die AUSWEISLOHN-Testdatei; deren automatische Anwendung auf neu
  erzeugte Fehlzeitenpositionen bleibt ein offenes TODO.

## Geprüfte Quelldaten

Tabelle1 enthält 66.349 Datenzeilen und 24 Spalten, die weiteren beiden
Tabellenblätter sind leer. Enthalten sind 1.200 Personalnummern und 43
Lohnartnummern. Alle 43 Nummern sind im bereitgestellten Lohnartenstamm vorhanden.

| Umfang | Lohn | Faktur | Gesamt |
| --- | ---: | ---: | ---: |
| Gesamtdatei | 49.049 | 17.300 | 66.349 |
| Abgeschlossen: Januar bis September | 48.149 | 16.195 | 64.344 |
| Vorläufig: Oktober | 900 | 1.105 | 2.005 |

Quellspalten:

```text
PERSONALNR AUFTRAGNR EINSORTNR JAHR MONAT WOCHE TAG VERWENDUNG
TAETNR LOHNARTNR LFDNR VON BIS EINFAKTURA STUNDEN PREIS PROZENT
BETRAG RECHNUNGNR ADDLOHNART FKENNZ UMLAGE CPROTBEDIENER DTPROTDATUM
```

`VERWENDUNG` enthält ausschließlich L und F. 10.465 Positionen der Gesamtdatei
haben keinen Auftrag, sämtlich lohnseitig. Sie sind gültige Vergleichsdaten
und werden nicht einem erfundenen Auftrag zugeordnet. Darunter befinden sich
beispielsweise Feiertag, Urlaub und weitere Fehlzeiten. Für Januar bis September
sind es 10.258 Positionen ohne Auftrag.

`VON` und `BIS` sind hier Excel-Kalenderdaten, keine Arbeitsuhrzeiten. In allen
Zeilen stimmen beide Daten überein und entsprechen dem Tag aus
JAHR/MONAT/WOCHE/TAG. Diese Kalenderzuordnung stimmt auch mit den gelieferten
STUNDUHR-Kalenderfeldern überein. Der Zeitraum reicht vom 01.01. bis 31.10.2026.

Die Kombination aus Personalnummer, Auftrag, Einsatzort, Jahr, Monat, Woche,
Tag, Verwendung, Tätigkeit, Lohnart und LFDNR ist in dieser Datei eindeutig.
Das belegt keine globale unveränderliche Zvoove-ID. Ein künftiger Referenzimport
muss sämtliche Originalzeilen samt Herkunft erhalten und darf ähnliche
Positionen nicht still verwerfen.

## Bereits durchgeführte Prüfungen

Für Januar bis September wurden die vorhandenen Ergebnismengen und Sätze mit
exakter Dezimalarithmetik und kaufmännischer Cent-Rundung nachgerechnet:

| Positionen | Formel | Ergebnis |
| --- | --- | --- |
| 28.210 Normalstundenpositionen, Lohnart 100 | STUNDEN × PREIS | Alle ergeben den gelieferten BETRAG |
| 3.646 prozentuale Zuschlagspositionen | STUNDEN × PREIS × PROZENT / 100 | Alle ergeben den gelieferten BETRAG |

Dies bestätigt die rechnerische Konsistenz dieser Ergebniszeilen. Es bestätigt
noch nicht, dass unsere Anwendung dieselben Mengen, Lohnarten und Preise aus
den unabhängigen Stunden-/Tarif-/Konditionsdaten erzeugt. Vorhandene negative
Positionen bleiben dabei mit ihrem Vorzeichen erhalten.

Weitere Befunde für die Nachmodellierung:

- Die Gesamtdatei enthält neben Normalstunden 100 auch 963 lohnseitige
  Positionen 101. Eine allgemeine Erzeugung ausschließlich mit 100 bildet nicht
  jede vorhandene Beschäftigungs-/Lohnkonfiguration ab.
- Normalstunden 100, ÜTZ, AZK und andere lohnseitige Positionen sind getrennt.
  Die Monatsabschlusslogik muss daher zusätzlich zur Übernahme produktiver
  Stunden berücksichtigt werden.
- Bei Urlaub und Krankheit stehen teilweise Beträge trotz `PREIS=0`.
  Diese Positionen verbleiben bis zum Durchschnittsverfahren als offene Fälle.
  Betragslohnarten und andere Berechnungsarten erhalten eigene Prüfungen.
- Die konkrete Ergebnisverwendung stammt aus `VERWENDUNG`. Die L-/F-Einstellung
  der Lohnart und die Verwendung einer Kondition bleiben zusätzliche fachliche
  Konfiguration. Ein Referenzimport entfernt keine gelieferten Sollpositionen
  anhand dieser Stammdaten.

## Nächster Umsetzungsschritt

Ein Adapter für diese konkrete AUSWEISLOHN-Struktur muss die Zeilen als
unabhängigen Sollstand einlesen. Der vorhandene generische Referenzimport
erwartet andere Spalten und ist kein direkter Uploadadapter für diese Datei.

Für den ersten unabhängigen Test werden berechenbare Grundstunden und
Zuschläge aus den Stunden-/Tarif-/Konditionsdaten erzeugt und gegen den Sollstand
verglichen. Preise aus AUSWEISLOHN dienen dabei der Kontrolle, nicht der
unabhängigen Satzermittlung. Fehlende Pausenlagen sperren nur die davon
abhängigen Bewertungen; Durchschnittsfälle bleiben ausdrücklich offen.

Die unteren Payroll-Tabs können anschließend eigene Positionen, Sollpositionen,
Differenzen und offene Fälle getrennt darstellen. Ein offenes Verfahren wird
nicht als Betrag null, erfolgreicher Vergleich oder pauschal falsche Quelldatei
ausgegeben. Fehlende Referenzwerte bleiben ebenfalls von null verschieden.
