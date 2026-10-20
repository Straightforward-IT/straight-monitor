# Lohnartenstamm: Import und schreibgeschützte Übersicht

Stand: 13.10.2026. Dieser Schritt erschließt Stammdaten und Beziehungen.
Er erzeugt keine Lohnpositionen, Beträge, Durchschnittswerte oder AZK-Buchungen.
DATEV und die Berechnung der Verrechnung folgen separat.

## Quellen und geprüfter Bestand

`Documentation/Lohnarten/Lohnarten.xlsx`, Tabelle1, enthält 153 unterschiedliche
Lohnartnummern und 129 Quellspalten. Die Legenden in `Lohnarten4.pdf` und
`Lohnarten5.pdf`, die zugehörigen Markdown-Dateien und die bereitgestellten
Zvoove-Dialogbilder belegen die Codefamilien. Die Quelldatei wurde unverändert
gelesen und in einer isolierten Testdatenbank vollständig importiert.

Ein Import in den aktiven Datenbestand erfolgt über die bestehende
Lohnarten-Importfunktion. Die Implementierung führt keinen automatischen
Produktivimport oder eine automatische Umschreibung alter Zuordnungen aus.

## Importprofile und Erhaltung

`api/domain/payroll/wageTypeImport.js` erkennt getrennte Profile:

| Profil | Kennung | Verhalten |
| --- | --- | --- |
| SQL mit Kopfzeile | `LOHNARTNR` | Vorhandene SQL-Zuordnungen bleiben kompatibel; Spalten dürfen umgeordnet oder ausgelassen werden. |
| SQL ohne Kopfzeile | Genau 24 Spalten, positive Nummer an erster Position | Vorhandene SQL-Reihenfolge; keine Vermutung bei anderen Breiten. |
| Breiter Stammexport | `Lohnart` | Menschenlesbare Überschriften; doppelte Code-/Klartextüberschriften werden über das Vorkommen zugeordnet. |

Die Identität ist ausschließlich `lohnartNummer`. Gleiche Kürzel, Bezeichnungen
oder KB werden nicht zusammengeführt. Nicht gelieferte Lohnarten bleiben erhalten.
Gelieferte Spalten aktualisieren ihre Felder; eine ausdrücklich gelieferte leere
Zelle leert das betreffende Feld. Fehlende Spalten verändern es nicht.

Alle Zeilen und bekannten Code-/Klartextpaare werden vor dem ersten Schreibzugriff
geprüft. Ungültige oder doppelte Nummern, uneindeutige bekannte Überschriften,
gemischte Nummernspalten beider Profile, widersprüchliche bekannte Paare und
mehrere gefüllte Tabellenblätter verhindern den Import. Unbekannte Codes und
fehlende Verrechnungsziele sind Hinweise; die Quellwerte bleiben erhalten.

`source` enthält Datei, Tabellenblatt, ursprüngliche Zeile und **jede** Quellspalte
mit 1-basiertem Index, Originalüberschrift, Vorkommensnummer und unverändertem
Zellwert. Code und Klartext gehen daher auch bei fehlender Modellzuordnung nicht
verloren. `sourceHistory` erhält frühere Quellen, wenn ein neuer Import ihre
Herkunft ersetzt. So bleiben bei schmalen Teilimporten die ursprünglichen 129
Spalten weiter zugänglich. Eine identische Wiederholung verändert weder IDs noch
Zeitstempel und erzeugt keine weitere Herkunftshistorie.

Der Import aktualisiert über die bestehende Lohnartnummer; stabile MongoDB-IDs
und Kundenreferenzen bleiben erhalten. Er enthält explizite Modellfelder für alle
107 zugeordneten Feldnamen, keine pauschale Speicherung der Fachfelder als Blob.
Unbelegte Exportspalten sind zusätzlich vollständig als Quellspalten erhalten.

## Codefamilien und Feldbindungen

Backend und Frontend lesen dieselbe Registry unter
`api/shared/payroll/wageTypeSettings.json`. Eine Definition enthält Schlüssel,
Code, Bedeutung, Hinweis und Quellenbeleg. Numerischer und textueller Wert `0`
sind gültige Codes; leer, fehlend und unbekannt bleiben getrennte Zustände.

| Familie | Modellfeld |
| --- | --- |
| Berechnung K1 | `berechnungsartCode` |
| Durchschnitt K2 SP1 / SP2 | `durchschnittsspeicherCode` / `durchschnittsspeicher2Code` |
| Steuer K4 | `steuerartCode` |
| Steuerung/Speicherung K6 | `steuerungSpeicherungCode` |
| AZK K7 | `gleitzeitCode` |
| Pfändung K8 | `pfaendungCode` |
| Sozialversicherung K11 | `sozialversicherungCode` |
| BG-Pflicht | `bgPflichtCode` |
| Konditionsbereitstellung | `fakturierungCode` |
| Verrechnung | `verrechnungCode` |
| Fehlzeitenbetrachtung | `fehlzeitenbetrachtungCode` |
| Tages-/Monatsübergabe | `tagesMonatsuebergabeCode` |

K3, K5 und BG2 sind als Kataloge dokumentiert, jedoch ohne unbelegte Feldbindung.
K9/K10 bleiben ungeklärt. Die alten SQL-Felder `steuerSpezialCode` (`CSTEUERSPE`),
`berechnungsgrundlageSpalte` (`BGSPALTE`) und `branchenzuschlag*` werden nicht in
die neuen Felder umgedeutet. Insbesondere wird `IBGSPALTESTD_SUB` weder direkt noch
invertiert als BG2 gelesen. Gesamtstunden, Auswertung und BG-/bezahlte Stunden
sind unabhängige Einstellungen.

## Verrechnung und ÜTZ

| Code | Bedeutung |
| --- | --- |
| 0 | Keine Auswahl |
| 1 | Branchenzuschlag |
| 2 | Zulage/Zuschlag |
| 3 | ÜTZ |

Die bekannte Auswahl „Tariflicher Zuschlag“ erhält ohne Quellnachweis keinen
numerischen Code; die Dropdown-Reihenfolge belegt keinen Code 4.

Bestätigter Fall: **110 – ÜTZ → Verrechnung 3 → 602 – Verrechnung mit der
übertariflichen Zulage → Priorität 1**. `verrechnungCode`,
`verrechnungslohnartNummer` und `verrechnungsPrioritaet` bleiben getrennt. Die
Zielnummer wird unverändert gespeichert und beim Lesen zusätzlich zur stabilen
Lohnart-ID aufgelöst. Ein fehlendes Ziel erscheint als konkreter Hinweis.

Priorität 1 belegt weder Vorzeichen noch Reihenfolge, Begrenzung oder Formel.
602 wird nicht als weitere positive Zulage addiert. Zvoove beschreibt zusätzliche
Steuerung über Personalstamm und auftragsseitige Vereinbarungen; diese Grundlagen
müssen später gesondert erschlossen werden.
[Zvoove: ÜTZ-/BZ-Verrechnung](https://go.zvoove.com/knowledge/warum-wird-der-branchenzuschlag-nicht-mit-der-uebertariflichen-zulage-verrechnet).

Für die spätere Payroll gilt: Produktive Stunden erhalten Basis-Lohnart **100**
mit dem Grundstundenlohn und gegebenenfalls **110** als zusätzliche lohnseitige
ÜTZ-Komponente. ÜTZ ist nicht gleichzeitig in Position 100 enthalten.
`getTariffHourlyWage` liefert bereits Grundlohn plus ÜTZ und darf deshalb nicht
unverändert als Satz von 100 neben einer separaten 110 verwendet werden.
Zuschläge vervielfachen die produktive Quellstundensumme nicht.

## Kundenkonditionen

Eine konkrete Kundenkondition trägt `F = Faktur` oder `L = Lohn`. Die Übersicht
zeigt beide Gruppen getrennt mit allen Regeln und Kundenpreislinks; unbekannte
Verwendungen erscheinen separat. Fakturregeln erzeugen keine Mitarbeiterzulagen.
Aktive Kunden werden wie in der bisherigen Übersicht berücksichtigt.

Die Bereitstellung der Lohnart in Konditionstabellen ist davon unabhängig:
`0 = Lohn + Faktur`, `1 = nur Lohn`, `2 = nur Faktur`, `3 = weder Lohn noch Faktur`.
Code 3 schließt etwa 110, 602 oder Fehlzeitenlohnarten nicht global aus einer
Lohnabrechnung aus. AZK (+) ist im Stamm mehrfach vorhanden: **191 hat Code 3**,
**192 hat Code 1**. KB **Q** bleibt für **503 und 506** mehrdeutig.

## Schnittstellen und Oberfläche

- `GET /api/import/lohnarten`: bestehende Rohfelder, bisherigen Berechnungs- und
  Durchschnittsmetadaten, aktive Kundenbezüge und feldbezogene `codeMetadaten`.
  Herkunftsspalten werden zur Begrenzung der Listenantwort erst im Detail geladen.
- `GET /api/import/lohnarten/:id`: vollständige Modellwerte, `source`,
  `sourceHistory`, Kundenkonditionen, Verrechnungsbezug und Klärungshinweise.
- `GET /api/import/lohnarten/nummer/:number`: dieselben Details anhand der
  Lohnartnummer; authentifizierter Lesezugriff wie beim Abruf per ID.
- `POST /api/import/lohnart`: bestehender Dateiimport; vor dem Upload wird die
  **aktuelle Admin-Rolle aus der Datenbank** geprüft. Ein alter ADMIN-Claim im
  Token genügt nach Rollenentzug nicht. Authentifizierter Lesezugriff bleibt wie
  bisher erhalten.

`codeMetadaten` ist nach Modellfeld benannt. Jedes Element enthält `code`, `key`,
`label`, `note`, `family`, `source` und `status = known | missing | unknown`.
`verrechnungsbezug` enthält Rohcode, Priorität, Zielnummer, aufgelöstes Ziel und
`status = matched | missing | none`.

Der Admin-Tab Lohn zeigt die kompakte Liste mit Suche nach Rohwerten und
Bedeutungen sowie Filtern für Berechnung, Bereitstellung, KB und unbekannte Codes.
Das rechte Panel enthält Berechnung, Zeit & Fehlzeiten, Faktur & Konditionen,
Tarif & Verrechnung, Abrechnung und Herkunft. Die Tabs stehen in einer Zeile mit
Scroll-Pfeilen. Die Auswahl bleibt beim Lohnartwechsel erhalten; Ziel-Lohnarten
öffnen sich im selben Panel. Auf schmalen Ansichten nutzt es das vorhandene
responsive SidePanelFrame. Ladefehler sind sichtbar und überholte Antworten
werden verworfen. Herkunft zeigt auch ungeklärte Rohfelder und frühere Quellen.

Das wiederverwendbare `Modals/LohnartModal.vue` nutzt dieselbe Detailkomponente
mit denselben sechs Tabs. „Im Modal öffnen“ im Sidepanel übernimmt die aktuelle
Tab-Auswahl. In der Schnittberechnung öffnen die Lohnartnummern das Modal direkt.
Es wird im globalen Dock gehostet, bleibt beim Seitenwechsel erhalten und lässt
sich minimieren. Erneutes Öffnen derselben Lohnartnummer stellt die bestehende
Instanz samt ausgewähltem Tab wieder her. Verrechnungsziele öffnen ein eigenes
Lohnartmodal; Kundenverweise öffnen die Kundenkarte im Tab Preise.

Aufruf aus einer beliebigen Vue-Komponente innerhalb der App:

```js
import { useLohnartModals } from '@/composables/useLohnartModals';

const { openLohnart } = useLohnartModals();
openLohnart(100); // Auch '100', eine MongoDB-ID oder ein Lohnart-Stammdatensatz
openLohnart(lohnart, { initialTab: 'conditions' });
```

Gültige Starttabs: `calculation`, `time`, `conditions`, `tariff`, `accounting`,
`source`. Das Modal lädt seine Details über die API; übergebene Stammdatensätze
dienen vorab nur der Überschrift. Alle Angaben bleiben schreibgeschützt.

## Prüfung und nächste Schritte

Die fokussierten Tests prüfen die Codefamilien samt Leer-/Null-/unbekannten
Werten, beide Adapter, komplette Dateiprüfung, 153 Datensätze mit je 129
Quellspalten, Speichern/Wiederholen/Teilimport, aktuelle Admin-Rolle, F/L-Trennung,
110 → 602, fehlende Ziele, Suche/Filter, Tabs und schnelle Auswahlwechsel.
Die Speicherung wird gegen eine isolierte MongoDB getestet, nicht gegen den
aktiven Datenbestand. Der Deploymenttest lädt die Registries aus ausschließlich
API-Dateien.

Noch offen: bestätigte Satzquellen und genaue Verrechnungsformeln, Personal-/
Auftragsoptionen, Stundenzeitfenster und Kundenzuordnung für produktive Import-
stunden, Durchschnitt einschließlich separater Fehlzeitentage, AZK-Buchungen,
Rundung und spätere DATEV-Übergabe. Die bisherigen Zvoove-Tagesstunden liefern
allein keine Nachtzeitfenster oder Kundenreferenz. Diese Fragen dürfen nicht durch
Vermutungen aus Stammcodes ersetzt werden.
