# Stundenerfassung: Public → Schnellerfassung → Zeitverwaltung

## Umfang

`Stundenzeit` ist der operative Erfassungs- und Prüfdatensatz zu einem `Einsatz`.
Er hängt direkt an Auftrag/Schicht/Einsatz und benötigt keine Tarif- oder
Kundenlohnregel. Freigegebene Revisionen stehen für spätere Auswertungs- oder
Exportadapter zur Verfügung, ohne dass die Erfassung an einen Payroll-Datensatz
gekoppelt ist.

## Zustände und Berechtigungen

1. Mitarbeiter reicht **einmal pro Einsatz** ein: `SUBMITTED`.
2. Interner, bestätigter `User` speichert Anpassungen: `DRAFT`.
3. Interner User übergibt ausdrücklich: `RELEASED`.
4. Ein interner User kann einen einzelnen übergebenen Einsatz zurücknehmen. Der
  Status wechselt zu `DRAFT`, die freigegebene Monatsprojektion wird entfernt
  und die Zeile ist in der Schnellerfassung wieder bearbeitbar.

Der Mongo-Primärschlüssel entspricht der Einsatz-ID. Gleichzeitige Einreichungen
können deshalb nicht zwei Datensätze erzeugen. Es gibt keine Public-Update- oder
Delete-Route und keinen Status, der die Mitarbeitereingabe erneut freischaltet.
Auch eine zuerst vom Büro erfasste Zeit sperrt die spätere Public-Eingabe.
Andere Einsätze desselben Mitarbeiters/Auftrags bleiben unabhängig erfassbar.

Public-Zugriff benötigt einen persönlich verifizierten OIDC-Session-Token im
Header `x-public-token`. E-Mail, Personalnummer, Flip-ID oder User-ID aus dem
Request werden nicht als Identität übernommen. Der Einsatz muss dem ermittelten
aktiven Mitarbeiter gehören. Ein geteilter Legacy-Token genügt hier nicht.

Intern: `x-auth-token`, aktueller bestätigter User aus MongoDB. Auftragsstandort
muss in `locationV2`/`locationAccess` liegen; Admins haben standortübergreifenden
Zugriff. Der komplette Mitarbeitermonat folgt dem Mitarbeiterstandort. Das
Bearbeiten der einzelnen Aufträge benötigt zusätzlich den jeweiligen
Auftragsstandort. Es wurde keine neue Payroll-Rollenbeschränkung eingeführt.

## Speicherung

- `employeeSubmission` und `employeeSubmittedAt`: unveränderte Originaleingabe.
- `current`: letzter interner Entwurf bzw. letzte Einreichung.
- `released`: zuletzt explizit übergebene Zeit. Ausschließlich diese zählt in der
  Monatsprojektion; ein neuer Entwurf lässt die bisherige Freigabe bestehen.
- `revision`: Versionsprüfung bei jeder internen Mutation; 0 für neue Einträge.
- `history`: Original und jede Bürorevision mit Zeitpunkt, User, Vermerk, Zeiten.
  Rücknahmen werden als `WITHDRAWN` protokolliert.

Interne Sammelaktionen laufen atomar in einer MongoDB-Transaktion. Ein veralteter
Datensatz führt zu HTTP 409 und verhindert die gesamte Aktion. Eine erneute
Übergabe ersetzt die freigegebene Projektion desselben Einsatzes; sie addiert
keine zweite Monatsbuchung. MongoDB muss als Replica Set laufen (wie bereits für
andere transaktionale Arbeitsabläufe im Projekt).

## API

Public:

- `GET /api/public/working-times/:einsatzId` → `locked`, `status`, `original`.
- `POST /api/public/working-times/:einsatzId` → `{start, end, breakMinutes}`;
  201 nach Speicherung, 409 bei bereits vorhandener Erfassung.

Intern:

- `GET /api/working-times/orders/:auftragNr?employeeId=…` → Auftrag, Schichten,
  Einsätze und bestehende Stunden. Mitarbeiterfilter optional.
- `POST /api/working-times/orders/:auftragNr` →
  `{action: 'save'|'release'|'withdraw', reason, entries: [{einsatzId, revision, start, end,
  breakMinutes, paidBreakMinutes, breaks: [{start, end, paid}]}]}`.
- `GET /api/working-times/employees/:employeeId/orders?month=YYYY-MM`.
- `GET /api/working-times/employees/:employeeId/month?month=YYYY-MM` → Props für
  `TimeManagement`: `employee`, `month`, `initialData`.

IDs, Beziehungen, Datum, Nettominuten und Status werden serverseitig ermittelt.
Client-Nettosummen oder Identitäten sind nicht maßgeblich. Uhrzeiten sind HH:MM,
Pausen ganze Minuten. Ein Ende vor Beginn fällt auf den Folgetag. Einsatztage
werden als vorhandene datumsbezogene Felder interpretiert, Uhrzeiten in
Europe/Berlin. Nicht existente/mehrdeutige Uhrenzeiten bei Zeitumstellung werden
zur manuellen Klärung abgewiesen. Ist-Stunden in der Zukunft werden abgewiesen.
Die Berechnung ist Zeitdauervalidierung, keine vollständige ArbZG-/Lohnprüfung.

## Frontend

- `PublicJobDetail` lädt die Sperre vom Server und zeigt Erfolg erst nach HTTP
  201. Kein lokaler Fallback, kein E-Mail-basierter Schreibzugriff.
- Auftragsaktionen und EmployeeCard öffnen das gemeinsame dockbare
  `TimeCaptureModal` mit `Stundenschnellerfassung` im verbundenen Modus.
- Speichern und Übergabe sind getrennte Aktionen. Der Bearbeitungsvermerk ist
  Pflicht. Bei Fehlern bleiben Eingaben erhalten; 409 verlangt bewusstes Neuladen.
- Jeder Einsatz kann über den Pfeil am Zeilenende einzeln übergeben werden.
  Übergebene Zeilen sind gesperrt; der umgekehrte Pfeil nimmt nur diesen Einsatz
  aus der Zeitverwaltung zurück und entsperrt ihn nach dem Server-Reload.
- `/payroll?employeeId=:employeeId&month=YYYY-MM` ist die zentrale Ansicht für
  tatsächlich übergebene Schichtstunden und den Mitarbeiterkontext.

**Weiterhin Vorschau:** Eimer-Umbuchungen, manuell erzeugte Fehlzeiten und das
Zeitkonto werden dort noch nicht persistiert. Die Fehlzeitarten kommen aus den
importierten `LOHNART`-Stammdaten: Nur Lohnarten mit einem gültigen `KB` werden
angeboten; `KB` ist dabei maßgeblich, nicht `LOHNARTKUR`. Der angezeigte Pool startet mit 0
und ist kein importierter Kontostand. Der Speicherbutton ist in der verbundenen
Monatsansicht deaktiviert. Die bestehende `/dev/time-management`-Demo bleibt
separat und kann ihre lokale Sitzung weiterhin speichern.

Frühere Erfassungen werden nicht automatisch als bestätigte Einreichungen
importiert. Vor produktiver Einführung müssen bestehende Erfassungen abgeglichen
werden, damit bereits außerhalb dieses Workflows eingereichte Stunden nicht
nochmals eingereicht werden können.

## Auftragsdokumente in beiden Ansichten

`OrderDocuments` wird in der Schnellerfassung und im Dokument-Slot der Payroll-
Ansicht wiederverwendet. Der Slot erhält die Auftragsnummer der gerade
ausgewählten Schicht. Dokumente öffnen sich über `useDocumentPreviewModals` im
dockbaren `DocumentPreviewModal`, einschließlich Download, Druck und Extratab.

- EventReports und Laufzettel werden aus gespeicherten strukturierten Daten als
  Text-PDF mit den vorhandenen Noto-Schriften gerendert; Freitext ist kein HTML.
- SignaturVorgänge aller Typen, verknüpfte alte DocuSealVorgänge, Reisekosten und
  deren Belege werden über ihre tatsächliche Auftragsverknüpfung aufgelöst.
- Vorhandene ausgefüllte/signierte Stundenlisten werden zuerst angeboten.
  Unausgefüllte Vorlagen sind ausdrücklich so benannt; eine abgeschlossene
  Signatur ohne gespeicherte fertige Datei fällt nicht auf eine leere Vorlage zurück.
- `GET /api/working-times/orders/:auftragNr/documents` liefert nur Metadaten.
- `GET /api/working-times/orders/:auftragNr/documents/:kind/:id/preview` prüft den
  aktuellen User und die Auftragszugehörigkeit erneut. Berichte liefern PDF,
  Dateien einen kurzlebigen R2-Link. Der Client kann keinen R2-Key vorgeben.
- Die Vorschau lädt R2 ohne App-Token; API-PDFs kommen über `loadBlob` mit internem
  Auth-Header. Wechsel der Schicht bricht offene Listenabfragen ab.
- Beide Dev-Demos zeigen fiktive, als Demo markierte PDFs ohne Backend-Anfragen.
