# Berechnungsarten der Lohnarten

Die vom Benutzer vorgegebenen Zvoove-Codes stehen zentral in
`api/shared/payroll/wageCalculationTypes.json`. Backend und Frontend verwenden
dieselbe Definition. `berechnungsartCode` bleibt als ursprünglicher String
gespeichert; die Bedeutung wird beim Lesen ergänzt, nicht in die Datenbank kopiert.
Unbekannte Codes bleiben erhalten und werden ausdrücklich als unbekannt angezeigt.

Die gemeinsamen JSON-Definitionen liegen innerhalb von `api/`, damit sie auch
bei einem Heroku-Deployment nur dieses Verzeichnisses enthalten sind. Das Frontend
importiert dieselben Dateien direkt; es gibt keine separate Kopie oder
Build-Abhängigkeit für das Backend.

| Code | Bedeutung | Eingaben |
| --- | --- | --- |
| 0 | Betrag | Betrag in EUR |
| 1 | Tage × Stunden/Tag × Stundenlohn | Tage, Stunden je Tag, Satz in EUR/Stunde |
| 2 | Stunden × Stundenlohn | Stunden, Satz in EUR/Stunde |
| 3 | Stunden × (Stundenlohn + Zuschlag) | Stunden, Grundsatz und Zuschlag in EUR/Stunde |
| 4 | Stunden × Zuschlag | Stunden, Zuschlag in EUR/Stunde |
| 5 | Stunden × Durchschnitt | Stunden, Durchschnitt in EUR/Stunde |
| 6 | Einheiten × Betragssatz | Einheiten, Satz in EUR/Einheit |
| 7 | Betragssatz × Zuschlag | Betrag in EUR, Zuschlagsfaktor |
| 17 | Betrag (Stunden × Stundenlohn) | Stunden und Satz; Betragsvorrang noch ungeklärt |

Die Definitionen enthalten Enum-Schlüssel, Code, Bezeichnung, Formel,
Eingabefelder mit Einheiten und erforderlichen Kontext. Formeln sind Metadaten,
kein ausführbarer Code. Sie werden nicht über `eval` ausgeführt.
`GET /api/import/lohnarten` ergänzt `berechnungsart` um diese Metadaten;
bei unbekannten oder fehlenden Codes ist der Wert `null`.

## Noch offene Berechnungsgrundlagen

- Satzquelle je Lohnart festlegen: Normalstunden, separat ausgewiesene ÜTZ,
  individuelle Beträge und Zulagen dürfen nicht denselben Gesamtsatz erhalten.
  Die bestehende Methode für Tariflohn plus ÜTZ bleibt für die Einsatzprognose.
- Zuschlagsbasis für 3, 4 und 7 bestätigen. Ein Prozentsatz muss zuerst in einen
  passenden Satz umgerechnet werden; ein Prozentwert ist kein EUR-Stundensatz.
  25 Prozent entsprechen beispielsweise dem Faktor 0,25. Art 3 enthält den
  Grundlohn, Art 4 nur den Zuschlag.
- TODO: Schnitt-Tool für Art 5. Ein Stundenschnitt und ein Lohndurchschnitt in
  EUR/Stunde sind unterschiedliche Größen und benötigen getrennte Definitionen.
  Ein fehlender Durchschnitt bleibt ungeklärt, nicht null oder aktueller Tariflohn.
- TODO: Art 17 gegenüber Art 2 klären, insbesondere ob ein übergebener Betrag
  maßgeblich ist oder aus Stunden und Satz neu berechnet werden soll.
- Bei späterer Berechnung Stichtag und verwendete Satzquelle nachvollziehbar
  festhalten. Exakte Dezimalarithmetik verwenden; Rundungsebene ausdrücklich
  festlegen. Steuer-, SV-, AZK- und Stundenanrechnung folgen eigenen Regeln.
- FS ist eine interne Tageskennzeichnung für das spätere Schnitt-Tool und
  erhält keine dieser Geldformeln.

Der jetzige Schritt liefert Enum, Eingabedefinitionen und die verständliche
Anzeige/Suche in der Lohnartentabelle. Er verändert weder Stunden noch Beträge
und baut noch kein neues Erfassungsformular oder Abrechnungssystem.

## Festgelegte Zuordnung produktiver Stunden für die spätere Payroll

Vom Benutzer am 12.10.2026 festgelegt: Produktive Stunden erhalten in unserer
Payroll **immer die Basis-Lohnart 100 (Normalstunden)**. Bei den importierten
Zvoove-Stunden sind das befüllte `T1`–`T7`-Werte mit leerem zugehörigem
`KZ1`–`KZ7`, einschließlich eines ausdrücklich gelieferten Stundenwerts `0`.
Die Nummer 100 ist eine feste fachliche Zuordnung; sie wird nicht aus einem
mehrdeutigen Kürzel wie `NST` oder aus dem Namen einer Lohnart geraten.

Die spätere Ausweisung besteht aus getrennten Positionen:

- Lohnart 100: produktive Stunden mit dem für den Stichtag maßgeblichen
  Grundstundenlohn. Bei tarifgebundenen Mitarbeitern ist dies der Tarifgrundwert,
  ohne eine bereits eingerechnete ÜTZ. Die Satzquelle für eigene Verträge und
  mögliche individuelle Abweichungen bleibt noch festzulegen.
- ÜTZ: gegebenenfalls als zusätzliche lohnseitige Position **110** mit ihrem
  eigenen Satz. Fehlende ÜTZ zählt als null; widersprüchliche Zuordnungen bleiben
  ungeklärt. Der endgültige Betrag kann von Verrechnungsregeln abhängen;
  Ziel-Lohnart 602 wird nicht pauschal als weitere positive Zulage addiert.
- Kundenbezogene Zuschläge: zusätzlich, wenn eine für den tatsächlichen
  Kunden/Einsatz passende lohnseitige Kondition greift, beispielsweise Nacht-
  oder Samstagszuschläge. Die bloße Verknüpfung einer Lohnart mit einem Kunden
  löst noch keinen Zuschlag aus. Regelart, Zeitraum, Wochentage, Schwellen und
  eine gegebenenfalls ausgeschlossene automatische Ausweisung sind zu prüfen.

`getTariffHourlyWage` enthält bereits Tariflohn plus ÜTZ. Dieses Gesamtergebnis
darf nicht gleichzeitig als Satz der Lohnart 100 und als Grundlage einer
zusätzlichen ÜTZ-Position verwendet werden, sonst würde die ÜTZ doppelt zählen.
Die Zuschlagsbasis bleibt wie oben beschrieben separat zu klären.

Lohnart 100 ist im bereitgestellten Zvoove-Stamm für **Gesamtstunden** markiert.
Dieses Kennzeichen regelt die Stundenanrechnung und ist unabhängig von der
festgelegten Basis-Lohnart sowie von AZK-, Durchschnitts- und BG-Kennzeichen.
Mehrere Lohnpositionen für dieselben produktiven Stunden dürfen die produktive
Quellstundensumme nicht vervielfachen. Ihre weitere Stundenanrechnung folgt den
jeweils belegten Kennzeichen; Zuschlags- und ÜTZ-Mengen werden nicht pauschal
noch einmal als zusätzliche Arbeitsstunden gezählt.

Der Monatsimport enthält keine Kunden-/Einsatzreferenz und keine Arbeitszeit-
Zeitfenster. Für die spätere Zuschlagsberechnung werden diese Informationen
zusätzlich benötigt; insbesondere Nachtstunden lassen sich aus einer
Tagesstundensumme allein nicht bestimmen. Dieser Abschnitt hält die Zielregel
fest. Die aktuelle Ansicht und der Import erzeugen noch keine Lohnpositionen.

## Durchschnittsspeicherung für das Schnitt-Tool

`durchschnittsspeicherCode` bestimmt, welche Mengen einer Lohnart zur
Durchschnittsbildung beitragen. Diese Codes gehören zu einem eigenen Enum,
unabhängig von der Berechnungsart. Die gemeinsamen Definitionen stehen in
`api/shared/payroll/averageStorageTypes.json`. Die Lohnarten-API ergänzt
`durchschnittsspeicherung`; unbekannte Codes liefern `null` und bleiben gespeichert.

| Code | Tage | Stunden | Betrag |
| --- | --- | --- | --- |
| 0 | Separate Einstellung erforderlich | Kein Beitrag | Keine Addition |
| 1 | Addieren | Addieren | Addieren |
| 2 | Kein Beitrag | Kein Beitrag | Addieren |
| 3 | Addieren | Kein Beitrag | Kein Beitrag |
| 4 | Kein Beitrag | Addieren | Kein Beitrag |
| 5 | Subtrahieren | Subtrahieren | Subtrahieren |
| 6 | Kein Beitrag | Kein Beitrag | Subtrahieren |
| 7 | Kein Beitrag | Subtrahieren | Kein Beitrag |

`contributions` speichert je Dimension `1`, `0` oder `-1`. `null` bezeichnet eine
ungeklärte Bedeutung und darf nicht als `0` behandelt werden. Bei Code 0 werden
Stunden und Betrag nicht addiert. Ob Tage einer Fehlzeiten-Lohnart zählen,
regelt eine separate Einstellung. Diese muss noch nachgepflegt werden;
bis dahin bleibt der Tagesbeitrag ungeklärt (`null`).

TODO: Die separate Einstellung zur Tageszählung für Fehlzeiten-Lohnarten
modellieren und nachpflegen. Code 0 allein darf deren Tage nicht ausschließen.

Die Definitionen selbst liefern nur Beitragsregeln. Das
[Schnitt-Tool](Schnittberechnung.md) verwendet historische AUSWEISLOHN-Lohnpositionen
und kalendarische Werktage. Es zählt für dieses Verfahren alle Montag–Freitag
des Monats unabhängig von Buchungen und SP1-Tagesbeiträgen. Die drei Kennzahlen werden direkt
aus den ungerundeten Summen berechnet.
Für Art 5 ist ein Lohndurchschnitt in EUR/Stunde erforderlich; die bloße
Kennzeichnung einer Lohnart liefert diesen Wert noch nicht.

Bestätigung vom 19.10.2026: Urlaub und weitere entsprechend konfigurierte
Lohnarten verwenden das noch nicht implementierte Durchschnittsverfahren.
SP1 (`durchschnittsspeicherCode`) ist bereits vorhanden; die automatische Anwendung
des Schnitts auf neue Fehlzeitenpositionen bleibt ein offenes TODO. Der erste
[AUSWEISLOHN-Testabgleich](Ausweislohn-Testabgleich.md) erhält deren Sollpositionen,
weist ihre eigene Berechnung aber als noch nicht implementiert aus. Fehlende
Durchschnittswerte werden weder durch null noch durch den aktuellen Tariflohn
ersetzt. Ein gelieferter Sollbetrag bei `PREIS=0` ist deshalb für sich genommen
kein Rechenfehler. Die Zuordnung erfolgt je Lohnart, nicht pauschal für jede
Fehlzeit.

## Bereitstellung in Konditionstabellen (Fakturierung)

Die Zvoove-Quellspalte `ILOHNFAKTUR` wird unverändert als
`Lohnart.fakturierungCode` gespeichert. Die folgenden Bedeutungen wurden vom
Benutzer am 12.10.2026 für den nächsten Schritt zur Etablierung der Lohnarten
bestätigt:

| Code | Bedeutung | In lohnseitigen Konditionstabellen bereitstellen | In fakturseitigen Konditionstabellen bereitstellen |
| --- | --- | --- | --- |
| 0 | Lohn + Faktur | Ja | Ja |
| 1 | Nur Lohn | Ja | Nein |
| 2 | Nur Faktur | Nein | Ja |
| 3 | Weder Lohn noch Faktur | Nein | Nein |

Der Geltungsbereich ist die **Bereitstellung in Konditionstabellen**. Code 3
ist kein genereller Ausschluss aus der Lohnabrechnung: Eine Lohnart kann über
einen anderen fachlichen Weg, etwa eine Fehlzeitenzuordnung oder eine tarifliche
Sonderzahlungsregel, weiterhin verwendet werden. Der Code allein bestimmt
weder die Erzeugung einer Lohnbuchung noch deren Berechnung oder Auszahlung.

Beispiele aus dem geprüften Stamm und den Benutzerangaben:

- Code 1: AZK (+) **192**, AZK (-), VMA steuerfrei, VMA steuerpflichtig,
  Rückerstattung Hemden, HemdenRückzahlung, SneakerRückzahlung,
  Übernachtung steuerfrei, Prämie und Tantieme Geschäftsführer-Gesellschafter.
- Code 3: AZK (+) **191**, ÜTZ **110**, Verrechnung mit der übertariflichen
  Zulage **602**, Urlaub, Krankengeld und Urlaubsgeld.

Die Beispiele erklären die vorhandene Konfiguration; zukünftige Zuordnungen
erfolgen über den gespeicherten Code, nicht über den Namen einer Lohnart.
Die vier Optionsnamen und die Einstellung auf Seite 2 des Lohnartenstamms sind
in der [Zvoove-Dokumentation zur Bereitstellung von Lohnarten](https://go.zvoove.com/knowledge/wo-kann-ich-festlegen-ob-eine-lohnart-nur-lohn-oder-fakturseitig-bzw.-f%C3%BCr-beides-gelten-und-ber%C3%BCcksichtigt-werden-soll)
beschrieben. Die numerische Zuordnung stammt aus der Bestätigung des Benutzers.

Das gemeinsame Enum und seine Darstellung in API und Oberfläche sind in
`api/shared/payroll/wageTypeSettings.json` umgesetzt. Es bleibt unabhängig von
Berechnungsart, Durchschnitt, Steuer/SV, AZK und der Verwendung einer konkreten
Kundenkondition (`F` beziehungsweise `L`). Fehlende oder unbekannte Codes werden
ausdrücklich angezeigt und nicht als Code 0 oder Code 3 behandelt.

Die tatsächliche Erzeugung und Berechnung von Lohnpositionen folgt separat.
Andere Erzeugungswege dürfen insbesondere bei Code 3 nicht durch einen globalen
Filter unterdrückt werden. Import, Datenmodell und Detailübersicht beschreibt
[Lohnartenstamm](Lohnartenstamm.md).
