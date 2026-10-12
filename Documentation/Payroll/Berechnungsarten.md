# Berechnungsarten der Lohnarten

Die vom Benutzer vorgegebenen Zvoove-Codes stehen zentral in
`shared/payroll/wageCalculationTypes.json`. Backend und Frontend verwenden
dieselbe Definition. `berechnungsartCode` bleibt als ursprünglicher String
gespeichert; die Bedeutung wird beim Lesen ergänzt, nicht in die Datenbank kopiert.
Unbekannte Codes bleiben erhalten und werden ausdrücklich als unbekannt angezeigt.

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

## Durchschnittsspeicherung für das spätere Schnitt-Tool

`durchschnittsspeicherCode` bestimmt, welche Mengen einer Lohnart zur
Durchschnittsbildung beitragen. Diese Codes gehören zu einem eigenen Enum,
unabhängig von der Berechnungsart. Die gemeinsamen Definitionen stehen in
`shared/payroll/averageStorageTypes.json`. Die Lohnarten-API ergänzt
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

Die Definitionen berechnen noch keinen Durchschnitt. Bezugszeitraum,
Tageszählung bei mehreren Lohnarten am selben Tag, FS-Tage, Satzquellen und
Nenner sind Bestandteil des zukünftigen tarifkonformen Schnitt-Tools.
Für Art 5 ist ein Lohndurchschnitt in EUR/Stunde erforderlich; die bloße
Kennzeichnung einer Lohnart liefert diesen Wert noch nicht.
