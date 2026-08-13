# StraightMonitor → Paychex: Implementierungs- und Freigabestatus

Stand: 12. August 2026  
Implementierungsbranch: `codex/payroll-readiness`

## Ergebnis

StraightMonitor besitzt auf diesem Branch die technische Grundlage, um die operativen Brutto-Lohnarten vor Paychex zu berechnen, zu prüfen, zu erklären und revisionssicher zu übertragen. Paychex bleibt das führende System für Steuer, Sozialversicherung, Meldewesen, Zahlung, gesetzlichen Brutto-Netto-Abschluss und Entgeltabrechnungen.

Der Stand ist **noch nicht produktionsfreigegeben**. Die Anwendung scheitert bei fehlenden oder ungeklärten Payroll-Fakten bewusst mit einem Blocker; Payroll-Mitarbeitende sollen diese Daten nicht direkt in Paychex rekonstruieren.

## Implementierter Umfang

- effective-dated Beschäftigungen mit Entgeltgruppe, Sollzeit, Tarifversion, GVP-Einbeziehung und Übergangsstatus;
- operative Sektoren `GASTRONOMY`, `HOSPITALITY`, `EVENTS`, `CATERING`, `EVENT_CATERING` und `OTHER_VERIFIED`, getrennt von einer Branchenzuschlagvereinbarung;
- unterschriebene Kunden-/Standorterklärung und mitarbeiterbezogene Einsatz-/Kontinuitätserklärung als validierbare, hashgebundene Dokumentdaten;
- tatsächliche Arbeitszeit mit Zeitstempeln, Pausen, Zeitzone, Standort, Freigabe, Sperre und Korrekturhistorie;
- Abwesenheiten mit Monatsaufteilung, Entgeltbehandlung, Evidenz und Paychex-Abwesenheitstyp;
- AZK-Eröffnung, Bewegungen, Teilzeit-Cap, explizite Monatsdisposition einschließlich `NONE`, Auszahlung und Sperre;
- GVP-Tarifversionen und deterministischer Payroll Core für Basislohn, Erfahrungszuschlag, Nacht/Sonntag/Feiertag/Mehrarbeit, Equal Pay, AZK und drei abgerechnete Referenzmonate;
- unveränderliche Mitarbeiter-Snapshots, eingefrorene Monatskohorte, vollständige Laufabdeckung, Revisionserkennung, Audit und Vier-Augen-Freigaben;
- Paychex-Payloadmodi `AMOUNT_ONLY` und `QUANTITY_FACTOR_PERCENT`, Lohnarten-Mapping, exakte Cent-Rundung und wiederaufnehmbare Provider-Operationen;
- Paychex-Public-API-v1.3-Grenze für Mitarbeiter, Verträge, Lohnkomponenten, Abwesenheiten und Dokumente;
- exakter Bruttoabgleich vor Payroll-Abschluss und kontrollierte Entgeltabrechnungs-Dokumentabdeckung;
- Payroll-Readiness-Arbeitsoberfläche sowie öffentliche Zeiterfassung und interne Zeitfreigabe.

Die vertraglichen vier bzw. sechs Mindeststunden sind ausschließlich Fakturierungswerte. Sie werden weder als bezahlte Ist-Zeit noch als AZK-Zugang verwendet.

## Bewusste Produktionsblocker

Eine produktive Übertragung bleibt gesperrt, bis alle folgenden Punkte nachgewiesen sind:

1. realistischer Paychex-Sandboxzugang, API-Zugang und exakt eine geprüfte Company UID;
2. aktuelle Paychex-v1.3-Referenzdaten und eine freigegebene Lohnarten-Zuordnung einschließlich geprüfter Steuer-/SV-Kennzeichen;
3. vollständige, in Paychex geprüfte Steuer-, Sozialversicherungs-, Krankenkassen- und Bankdaten je Mitarbeiter;
4. unterschriebene Standort- und Einsatzdeklarationen; `NONE` darf nicht aus Gastronomie/Event/Catering abgeleitet werden, sondern muss je Standort bestätigt sein;
5. vollständige Equal-Pay-Vergleichsdaten vor Erreichen der Neunmonatsgrenze; monatliche oder weitere regelmäßige Vergleichskomponenten bleiben blockierend, solange keine geprüfte Umrechnungsregel implementiert ist;
6. freigegebene AZK-Eröffnungssalden, Teilzeit-Caps und Monatsdispositionen;
7. drei einzeln freigegebene, hashgebundene vorherige Abrechnungsmonate für Urlaub/Krankheit, wenn die Referenzberechnung benötigt wird;
8. ein vollständiger Shadow-Monat gegen das bisherige zvoove/LANDWEHR-Ergebnis mit identischen Mengen und Bruttosummen innerhalb der freigegebenen Rundungspräzision;
9. fachliche Freigabe durch deutsche Payroll-/Arbeitsrechtsprüfung für GVP, AÜG/Equal Pay, AZK, Zuschlagsüberlagerung, Vertragsanhänge und Übergangsfälle;
10. getestetes Verfahren für negative Korrekturen in gesperrten Paychex-Perioden. Live-Korrekturläufe bleiben bis dahin absichtlich gesperrt;
11. dokumentierter Rollback-, Revisions- und Incident-Ablauf.

## Provider-Konfiguration

Alle Schalter sind standardmäßig geschlossen:

```dotenv
PAYCHEX_ENABLED=false
PAYCHEX_WRITE_ENABLED=false
PAYCHEX_API_BASE_URL=https://app.paychexplus.de/publicapi/v1.3
PAYCHEX_AUTH_MODE=API_KEY
PAYCHEX_API_KEY=
PAYCHEX_JWT=
PAYCHEX_AUTH_SCHEME=Bearer
PAYCHEX_COMPANY_KEY=straightforward
PAYCHEX_COMPANY_UID=
PAYCHEX_TIMEOUT_MS=15000
PAYCHEX_MAX_RETRIES=2
PAYCHEX_RETRY_BASE_DELAY_MS=250
PAYCHEX_RETRY_MAX_DELAY_MS=60000
PAYROLL_DOCUMENT_SYNC_ENABLED=false
PAYCHEX_PAYSLIP_DOCUMENT_TYPES=
PAYROLL_EMPLOYER_INTERNAL_ID=
```

`PAYCHEX_PAYSLIP_DOCUMENT_TYPES` enthält nur die von Paychex und Payroll freigegebenen, exakten Werte des Paychex-Felds `category`. Ohne diese Whitelist zählt kein Dokument als Entgeltabrechnung.

## Datenmigration vor einem Shadow-Lauf

- Indizes und Collections aller neuen `Payroll*`-, Ledger- und Tarifmodelle anlegen;
- Paychex Employee UID konfliktfrei in `Mitarbeiter` verknüpfen;
- Beschäftigungen, Vertragsnachweise und Tarifentscheidungen rückwirkend effective-dated anlegen;
- Kunden-/Standort- und Einsatzdeklarationen importieren und im Vier-Augen-Prinzip freigeben;
- die Echtheit importierter Signaturen über einen vertrauenswürdigen Provider-/Zertifikatsworkflow nachweisen; reine `HASH_EQUALITY_ONLY`-Importe bleiben Entwürfe und blockieren Payroll;
- historische Ist-Zeit statt geplanter Einsatzdauer strukturiert übernehmen oder den Monat blockieren;
- AZK-Eröffnung, Teilzeitverhältnis, Cap und historische Bewegungen abstimmen;
- abgeschlossene Quellmonate in geprüfte `PayrollReferenceMonth`-Datensätze überführen;
- Paychex-Providerprofile und providergeführte gesetzliche Stammdaten bestätigen;
- aktive Paychex-Lohnarten-Zuordnung mit Referenzdatenhash und Freigabeevidenz anlegen;
- bestehende Payroll-Läufe um eingefrorene Kohorte und Reconciliation-Felder ergänzen;
- vorhandene Dokumente erneut synchronisieren; Altdokumente ohne Kategorie-, Monats- und Mitarbeiterbeleg erfüllen die Abdeckung nicht.

## Cutover-Entscheidung

Der technische Feasibility-Verdict bleibt **conditional yes**: Paychex kann als Payroll-Software verwendet werden, wenn StraightMonitor die vollständige vorgelagerte Kette `Einsatz → Ist-Zeit → Freigabe/Sperre → Abwesenheit/AZK → unveränderlicher Snapshot → Lohnart` beherrscht und die oben genannten externen Freigaben erfolgreich durchlaufen wurden.

GVP-Tarifvertrag plus rohe Stunden allein reichen nicht aus.
