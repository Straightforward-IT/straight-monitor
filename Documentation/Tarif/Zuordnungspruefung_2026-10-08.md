# Prüfung der Mitarbeiter-Tarifzuordnungen am 08.10.2026

Geprüft wurden 578 aktive Mitarbeiter und der aktive Import
`6ac55b6506e971ddd419f433`. Die Datenbankprüfung war ausschließlich lesend;
Quellzeilen, offene Enddaten und der aktive Import wurden nicht verändert.

## Ursache und Auflösungsregel

Personalnummernhistorien verknüpfen mehrere Nummern mit demselben Mitarbeiter.
Sie enthalten keine fachlichen Gültigkeitszeiträume: `updatedAt` ist der Zeitpunkt
einer Änderung oder eines Imports und kein Datum für einen Beschäftigungswechsel.
Alte Tarif- und ÜTZ-Zeilen können trotzdem ein offenes Ende haben. Die bisherige
Auflösung wertete diese gemeinsam mit den Zeilen der aktuellen Nummer aus und
meldete dadurch Überschneidungen.

Die Auflösung verwendet jetzt zuerst die am Stichtag gültigen Zeilen zur aktuellen
Personalnummer. Fehlen solche Zeilen, dient die historische Nummer als Rückfall.
Mehrere Treffer innerhalb der aktuellen Nummer oder mehrere historische Treffer
ohne aktuelle Zeile bleiben klärungsbedürftig. Datum, Import-Reihenfolge und
Quell-ID werden nicht zur Rangfolge konkurrierender historischer Nummern benutzt.
Tarif und ÜTZ werden unabhängig nach dieser Regel aufgelöst. Die Oberfläche
erklärt die verwendete Nummer; sämtliche historischen Zeilen bleiben einsehbar.

## Ergebnis

| Tariflohn am 08.10.2026 | Vorher | Nachher |
| --- | ---: | ---: |
| Eindeutig aufgelöst | 326 | 467 |
| Überlappende Zuordnungen | 142 | 1 |
| Fehlende Zuordnung | 110 | 110 |

| ÜTZ am 08.10.2026 | Vorher | Nachher |
| --- | ---: | ---: |
| Eindeutig aufgelöst | 144 | 163 |
| Überlappende Zuordnungen | 19 | 0 |
| Kein gültiger ÜTZ-Eintrag | 415 | 415 |

## Rekonstruktion: Elida Abazi

Aktuelle Personalnummer: **3000523**; historische Nummer: **3000174**.
Die im Kommentar genannte Nummer **5000523** ist in den geprüften Zuordnungen
und ihrer Personalnummernhistorie nicht vorhanden.

| Personalnummer | Von | Bis | Tarifvariante | Entgeltgruppe | Quellzeile |
| --- | --- | --- | --- | --- | ---: |
| 3000174 | 27.02.2025 | offen | Lohn Ost KZF | 2a | 2815 |
| 3000523 | 27.02.2025 | 17.06.2026 | Lohn Ost KZF | 2a | 3997 |
| 3000523 | 18.06.2026 | 31.08.2026 | Lohn Ost KZF | 2a | 4027 |
| 3000523 | 01.09.2026 | offen | Lohn Ost Festangestellt (Gastro) | 2a | 4441 |

Quelle: `Main/Tarif Personal.xlsx`, Blatt `Tabelle1` (Zeilen einschließlich Kopfzeile).
Die alte Nummer bleibt im Export offen; ein tatsächliches Ende lässt sich aus
der Personalnummernhistorie nicht rekonstruieren und wurde deshalb nicht ergänzt.

Für den Stichtag wird Zeile 4441, Zuordnung `1109247`, verwendet:
Variante `21195`, Entgeltgruppe `21197`, Eingangsstufe `21205`, Periode `1108736`.
Tariflohn **15,67 €**, individuelle ÜTZ **1,83 €**, Summe **17,50 €**.
Die Werte wurden zusätzlich in der laufenden Mitarbeiter-Lohnsection geprüft.

## Verbleibende Fälle

- **110 Mitarbeiter:** Es existiert im aktiven Tarifstand 17055 keine Tarifzeile
  unter ihrer aktuellen oder historischen Nummer. Hier werden aktuelle,
  vollständige Tarif-Personal-Exporte oder zusätzliche fachliche Daten benötigt.
- **Ben Marquardt, 1003561:** Keine Tarifzeile zur aktuellen Nummer. Gleichzeitig
  gelten historische Zuordnungen zu `1002039` (ab 01.02.2024, KZF, Gruppe 2a)
  und `1002865` (ab 01.06.2026, Festangestellt, Gruppe 2b), beide mit offenem Ende.
  Ohne Gültigkeitsnachweis wird keine davon automatisch bevorzugt.

Die vollständige Liste aller 111 offenen Mitarbeiter steht in
[Zuordnungspruefung_2026-10-08.json](./Zuordnungspruefung_2026-10-08.json).

## Wiederholen der Leseprüfung

Aus dem Verzeichnis `api`:

```sh
node scripts/auditTariffAssignments.js --date=2026-10-08 --report=../Documentation/Tarif/Zuordnungspruefung_2026-10-08.json
```

Die Prüfung liest einen festen aktiven Importstand und legt keine Datenbank-
Collections oder Indizes an. Nur der ausdrücklich angegebene lokale Bericht wird
geschrieben. Die Zähler hängen vom aktuellen Mitarbeiterbestand ab.

## Validierung

- 46 Backend-Domain-/API-Tests erfolgreich, einschließlich Nummernwechsel,
  historischer Stichtage, unveränderter Originalzeilen und echter Überschneidungen.
- 22 Frontend-Tests erfolgreich; Frontend-Build erfolgreich.
- Elidas korrigierte Werte in `/personal` im Browser bestätigt.
