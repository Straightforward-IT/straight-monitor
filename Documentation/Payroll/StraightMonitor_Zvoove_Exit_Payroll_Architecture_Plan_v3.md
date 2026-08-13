# StraightMonitor Zvoove Exit & Payroll Architecture Plan v3

**Status:** 10.08.2026  
**Scope:** Vollständiger interner Ersatz von zvoove/LANDWEHR für Straightforward  
**Basis:** Bestehende StraightMonitor-MEVN-Architektur + bestehender Public Monitor + Paychex Europe Payroll API v1.3  
**Zielarchitektur:** StraightMonitor als führendes Office-/Operations-System + Public Monitor als Employee Self-Service Layer + eigener AÜ-/GVP-Payroll-Core + Paychex als gesetzliche Payroll Engine

---

## 1. Executive Summary

Der bisherige Plan bleibt in seiner Grundidee bestehen, wird aber an die reale StraightMonitor-Codebase angepasst.

Die zentrale Architekturentscheidung lautet:

> **Kein separates Straight-Payroll-Connect-Projekt und zunächst kein Microservice. Payroll wird als klar abgegrenzter Funktionsbereich in die bestehende StraightMonitor-MEVN-Anwendung integriert.**

Dabei wird die vorhandene Projektstruktur beibehalten:

- Vue-Komponenten unter `frontend/Straight-Monitor/src/components/`
- Pinia-Stores unter `src/stores/`
- Express-Routen unter `api/routes/`
- Mongoose-Modelle unter `api/models/`
- Business-/Integrationslogik in Top-Level-`*Service.js`-Dateien
- Cron-/Background-Jobs über `api/serverRoutines.js`
- Logging über `api/utils/logger.js`
- Async-Routen über `middleware/AsyncHandler.js`
- bestehende JWT-/Rollenlogik wird erweitert

Die fachliche Trennung bleibt trotzdem strikt:

```text
StraightMonitor Operational Data
        ↓
Straight Payroll Core
        ↓
Payroll Result / Audit Snapshot
        ↓
Paychex Adapter
        ↓
Paychex API
        ↓
Paychex Payroll / Compliance
```

Paychex ist **nicht** die Quelle der GVP-/AÜG-Logik. Paychex ist der externe Payroll Provider für Brutto-Netto, Steuer, Sozialversicherung, Meldungen und Payroll-Dokumente.


Eine zweite, inzwischen zentrale Architekturentscheidung kommt hinzu:

> **Paychex ist nicht der erste Schritt des zvoove-Ausstiegs. Vor dem produktiven Payroll-Cutover muss StraightMonitor die operative Datenentstehung übernehmen, die heute noch in zvoove/LANDWEHR stattfindet.**

Dazu gehören insbesondere:

- Anlage und Pflege von Events/Aufträgen
- Veröffentlichung von Jobs und Mitarbeitenden-Bewerbungen auf Jobs
- Disposition und Einsatzzuordnung
- Mitarbeiterverfügbarkeit
- tatsächliche Arbeitszeiterfassung und Freigabe
- abrechnungsrelevante Abwesenheiten
- Mitarbeiter-Self-Service für Dokumente
- Kunden-, Preis- und Fakturadaten
- Rechnungserzeugung
- alle weiteren Daten, die heute erst in zvoove entstehen und später als Input für Payroll oder Faktura benötigt werden

Der vorhandene **Public Monitor** wird dabei nicht ersetzt, sondern zum Employee Self-Service / Workforce Portal ausgebaut. Er besitzt bereits Flip-embedded OIDC/PKCE-Authentifizierung, Einsatzansichten, Kalender, Echtzeit-Check-ins, Laufzettel, Evaluierungen und EventReports und ist deshalb der natürliche mobile Eingabe-Layer für ca. 500 Mitarbeitende und Teamleitungen.

---

# 2. Was sich gegenüber Plan v1 ändert

## 2.1 Kein neues paralleles Architekturmodell

Plan v1 schlug eine Struktur wie `src/modules/payroll/...` und ein mögliches separates `packages/payroll-core` vor.

Das wäre für die aktuelle StraightMonitor-Codebase unnötig fremd.

StraightMonitor arbeitet heute mit:

```text
frontend/Straight-Monitor/src/components/
frontend/Straight-Monitor/src/stores/
api/routes/
api/models/
api/*Service.js
api/serverRoutines.js
```

Payroll soll sich daran halten.

## 2.2 Payroll Core bleibt fachlich isoliert

Die Regelengine wird dennoch bewusst von Express, MongoDB und Paychex getrennt.

Dafür wird innerhalb des bestehenden `api/`-Backends ein kleiner interner Ordner eingeführt:

```text
api/payroll-core/
```

Dieser enthält ausschließlich deterministische Berechnungslogik und keine HTTP-/Datenbankzugriffe.

## 2.3 Paychex wird Provider, nicht Domain

Paychex-spezifische IDs, Payloads und API-Aufrufe dürfen nicht in GVP-/AÜG-Regeln landen.

## 2.4 Zvoove-Exit wird explizit berücksichtigt

Die aktuelle Architektur nutzt Zvoove nicht nur indirekt für Payroll, sondern auch für Verfügbarkeitsdaten in der Disposition.

Daher kann zvoove erst vollständig abgeschaltet werden, wenn StraightMonitor diese Funktion selbst übernimmt oder aus einer anderen Quelle bezieht.

---

# 3. Verantwortungsgrenzen

## 3.1 StraightMonitor ist führend für

- Mitarbeiteridentität und internen Status
- Standorte / Teams
- Kunden
- Aufträge
- Einsätze
- Disposition
- Arbeitszeiten / abrechnungsrelevante Stunden
- operative Abwesenheiten
- Beschäftigungs-/Tarifzuordnung, soweit für die eigene Regelengine notwendig
- GVP-Tariflogik
- Entgeltgruppen
- Erfahrungszuschläge
- Branchenzuschläge
- Equal-Pay-Prüfung
- Einsatzhistorie
- Einsatzunterbrechungen
- Arbeitszeitkonto-Logik
- Nacht-/Sonntag-/Feiertags-/Mehrarbeitslogik
- Payroll-Vorbereitung
- Payroll-Validierung
- Berechnungsnachweise
- Provider-Synchronisationsstatus

## 3.2 Paychex ist führend für

- gesetzliche Brutto-Netto-Abrechnung
- Lohnsteuerberechnung
- Sozialversicherungsberechnung
- Krankenkassen-/Beitragslogik
- DEÜV und weitere gesetzliche Meldungen
- gesetzliche Payroll-Verfahren
- Lohnabrechnungsdokumente
- Lohnkonten
- Lohnjournale
- Zahlungs-/SEPA-Ausgaben
- regulatorische Änderungen der allgemeinen deutschen Payroll

## 3.3 Daten, die nicht unnötig dupliziert werden sollen

StraightMonitor sollte nicht automatisch zur zweiten vollständigen Payroll-Stammdatenbank werden.

Insbesondere sensible Daten wie:

- vollständige Steuerdaten
- Sozialversicherungsdetails
- Krankenkassendetails
- Bankverbindungen

sollten nur dann dauerhaft in MongoDB gespeichert werden, wenn StraightMonitor sie für einen konkreten Workflow benötigt.

Bevorzugt:

```text
StraightMonitor UI
    ↓
Backend
    ↓
Paychex API
```

für Read-/Edit-Vorgänge, bei denen Paychex die fachliche Quelle bleiben kann.

Damit reduzieren wir:

- doppelte sensible Datenhaltung
- Synchronisationskonflikte
- Sicherheitsrisiko
- DSGVO-/Berechtigungsumfang

---

# 4. Zielarchitektur im bestehenden System

```text
┌─────────────────────────────────────────────────────────────┐
│               Vue 3 Frontend / MainLayout                  │
│                                                             │
│ Personal | Aufträge | Dispo | Payroll | Dokumente           │
└─────────────────────────────┬───────────────────────────────┘
                              │ Axios /api
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express API                             │
│                                                             │
│ auth → role check → AsyncHandler → route → service         │
└──────────────┬───────────────────────┬──────────────────────┘
               │                       │
               ▼                       ▼
┌─────────────────────────┐   ┌──────────────────────────────┐
│ MongoDB / Mongoose      │   │ PayrollService.js            │
│                         │   │                              │
│ Mitarbeiter             │   │ orchestration                │
│ Kunde                   │   │ calculation                  │
│ Auftrag                 │   │ validation                   │
│ Einsatz                 │   │ snapshot                     │
│ PayrollRun              │   └──────────────┬───────────────┘
│ PayrollResult           │                  │
│ TariffVersion           │                  ▼
│ ProviderMapping         │          ┌───────────────────────┐
└─────────────────────────┘          │ api/payroll-core/     │
                                     │                       │
                                     │ GVP                   │
                                     │ Branchenzuschlag      │
                                     │ Equal Pay             │
                                     │ AZK                   │
                                     │ Zuschläge             │
                                     └───────────┬───────────┘
                                                 │
                                                 ▼
                                     ┌───────────────────────┐
                                     │ PaychexService.js     │
                                     │                       │
                                     │ auth / API client     │
                                     │ employee sync         │
                                     │ salary components     │
                                     │ documents             │
                                     └───────────┬───────────┘
                                                 │ HTTPS
                                                 ▼
                                     ┌───────────────────────┐
                                     │ Paychex Europe        │
                                     │ Payroll               │
                                     └───────────────────────┘
```

---

# 5. Konkrete Dateistruktur

## 5.1 Backend

```text
api/
├── app.js
├── serverRoutines.js
│
├── config/
│   ├── registry.js
│   ├── teams.json
│   └── payroll.js                    # NEW
│
├── models/
│   ├── Mitarbeiter.js                # EXTEND: paychex_id / payroll refs
│   ├── Auftrag.js
│   ├── Kunde.js
│   ├── DispoEintrag.js
│   ├── PayrollRun.js                 # NEW
│   ├── PayrollEmployeeResult.js      # NEW
│   ├── PayrollEmployment.js          # NEW
│   ├── PayrollCustomerRule.js        # NEW
│   ├── TariffVersion.js              # NEW
│   ├── PayrollProviderMapping.js     # NEW
│   └── PayrollAuditLog.js            # NEW / optional after PoC
│
├── routes/
│   └── payrollRoutes.js              # NEW
│
├── payroll-core/                     # NEW – pure domain logic
│   ├── index.js
│   ├── gvp.js
│   ├── experienceBonus.js
│   ├── industrySurcharge.js
│   ├── equalPay.js
│   ├── workingTimeAccount.js
│   ├── premiums.js
│   ├── rounding.js
│   └── explainCalculation.js
│
├── PayrollService.js                 # NEW – orchestration
├── PayrollValidationService.js       # NEW
├── PaychexService.js                 # NEW – external provider adapter
├── PayrollDocumentService.js         # NEW – Paychex → R2/metadata
├── R2Service.js                      # EXISTING – reuse
│
└── utils/
    └── logger.js                     # EXISTING – mandatory
```

### Warum so?

`PaychexService.js` folgt demselben Muster wie `FlipService.js`, `AsanaService.js`, `ZvooveService.js`, `DocuSealService.js` und `GraphService.js`.

`payroll-core/` ist die einzige bewusst neue interne Struktur. Sie dient nicht als Service-Schicht, sondern als testbare Fachbibliothek.

---

## 5.2 Frontend

```text
frontend/Straight-Monitor/src/
├── components/
│   └── Payroll/
│       ├── PayrollDashboard.vue
│       ├── PayrollRunPage.vue
│       ├── PayrollEmployeeTable.vue
│       ├── PayrollEmployeeDetail.vue
│       ├── PayrollPreview.vue
│       ├── PayrollValidationPanel.vue
│       ├── PayrollSyncPanel.vue
│       ├── PayrollDocuments.vue
│       └── PayrollSettings.vue
│
├── stores/
│   └── payroll.js
│
├── types/
│   └── payroll.ts
│
└── router/
    └── index.js
```

Neue Route:

```text
/payroll
/payroll/runs/:id
/payroll/mitarbeiter/:id
/payroll/settings
```

---

# 6. Security und Rollen

Payroll enthält deutlich sensiblere Daten als normale Disposition.

Die vorhandenen Rollen `USER`, `ADMIN`, `VERTRIEB` reichen langfristig nicht aus.

Empfehlung:

```text
PAYROLL
```

oder deutsch:

```text
LOHN
```

Neue Regel:

- `ADMIN` darf administrieren
- `PAYROLL` darf Payroll lesen/bearbeiten
- normale `USER`- und `VERTRIEB`-Accounts haben keinen Zugriff

Wichtig: Die Prüfung darf nicht nur im Vue Router stattfinden.

Es sollte ein Backend-Middleware-Check ergänzt werden, z. B.:

```text
api/middleware/requireRole.js
```

und auf allen `/api/payroll/*`-Routen angewendet werden.

---

# 7. Bestehende Mitarbeiterstruktur erweitern

Der aktuelle `Mitarbeiter` enthält bereits externe IDs wie `flip_id` und `asana_id` sowie `personalnr`.

Für den minimalinvasiven Einstieg wird ergänzt:

```javascript
paychex_id: String
```

Optional später sauberer zusammenführbar zu:

```javascript
integrations: {
  flip: { userId: String },
  asana: { userId: String },
  paychex: { employeeUid: String }
}
```

Für den PoC ist eine komplette Migration der bestehenden Integrations-IDs **nicht** notwendig.

---

# 8. Employment-Modell statt Payroll-Felder in Mitarbeiter

Der aktuelle Mitarbeiterdatensatz enthält nur begrenzte Beschäftigungsmetadaten (`hire_date`, `status`).

Für Payroll reicht das nicht.

Es wird daher ein separates zeitabhängiges Modell empfohlen:

```text
PayrollEmployment
```

Beispiel:

```javascript
{
  mitarbeiter: ObjectId,
  validFrom: Date,
  validTill: Date | null,

  employmentType: 'regular' | 'minijob' | 'short_term' | 'student',
  weeklyHours: Number,

  tariff: {
    system: 'GVP',
    group: 'EG1',
    ruleVersion: ObjectId
  },

  baseHourlyRate: Number,
  status: 'active' | 'ended',

  paychexSync: {
    lastSyncedAt: Date,
    status: String
  }
}
```

Vorteil:

- Historie bleibt erhalten
- Vertragsänderungen überschreiben keine alten Abrechnungsgrundlagen
- Korrekturabrechnungen bleiben reproduzierbar
- Tarif-/Wochenstundenänderungen können datiert werden

---

# 9. Kunde / Branche / Equal Pay

Das bestehende `Kunde`-Modell enthält aktuell keine ausreichende Payroll-Fachlogik.

Für Branchenzuschlag und Equal Pay sollten diese Werte nicht lose in `Kunde` verstreut werden.

Empfehlung:

```text
PayrollCustomerRule
```

Beispiel:

```javascript
{
  kunde: ObjectId,
  validFrom: Date,
  validTill: Date | null,

  industry: 'METAL_ELECTRICAL',
  industrySurchargeTariff: 'TV_BZ_ME',

  equalPay: {
    comparisonHourlyRate: Number,
    source: String,
    lastVerifiedAt: Date
  }
}
```

Damit kann sich die Branchen-/Equal-Pay-Bewertung eines Kunden ändern, ohne alte PayrollRuns zu verändern.

---

# 10. Einsatzhistorie ist zentral

StraightMonitor besitzt bereits `Auftrag` und `Einsatz`.

Diese Daten sollen künftig die Grundlage für folgende Payroll-Fragen sein:

- Bei welchem Kunden war der Mitarbeiter eingesetzt?
- Seit wann läuft der Einsatz?
- Gab es Unterbrechungen?
- Welche Einsatzzeiten zählen zusammen?
- Welche Branchenzuschlagsstufe gilt?
- Wann wird Equal Pay relevant?

Vor Implementierung der Rule Engine muss geprüft werden, ob das existierende `Einsatz`-Modell zuverlässig enthält:

- `mitarbeiter`
- `auftrag`
- Startdatum
- Enddatum
- Status
- tatsächliche Einsatzhistorie

Falls Start-/Enddatum aktuell nur über `Auftrag` indirekt verfügbar sind, sollte `Einsatz` für Payroll um eigene Zeitgrenzen erweitert werden.

**Keine Payroll-Berechnung darf von veränderlichen Live-Auftragsdaten abhängen, ohne einen Snapshot zu erzeugen.**

---

# 11. Arbeitszeitdaten

Die Architektur enthält bereits `StundenlisteService.js`, Disposition und Zvoove-bezogene Zeit-/Verfügbarkeitsflüsse, nennt aber kein eindeutiges zentrales Mongoose-Zeitbuchungsmodell.

Vor Payroll-Implementierung ist daher eine technische Bestandsaufnahme erforderlich:

```text
Wo liegt heute die abrechnungsrelevante Ist-Zeit je Mitarbeiter und Tag?
```

Wenn bereits ein belastbares Modell existiert, wird dieses verwendet.

Falls nicht, muss ein natives Modell eingeführt werden, beispielsweise:

```text
ArbeitszeitBuchung
```

mit mindestens:

```javascript
{
  mitarbeiter: ObjectId,
  auftrag: ObjectId,
  einsatz: ObjectId,
  date: Date,
  start: String,
  end: String,
  breakMinutes: Number,
  hours: Number,
  source: 'monitor' | 'flip' | 'import',
  status: 'draft' | 'approved' | 'locked'
}
```

Nur freigegebene/gesperrte Zeiten dürfen in einen PayrollRun einfließen.

---

# 12. Zvoove-Exit Dependency: Verfügbarkeit

Aktuell prüft die Disposition Verfügbarkeit auf Basis von Zvoove-Daten.

Paychex ersetzt diese Funktion **nicht**.

Für den vollständigen Zvoove-Ausstieg benötigt StraightMonitor daher zusätzlich eine native Quelle für Mitarbeiterverfügbarkeit.

Empfohlene Ergänzung:

```text
Verfuegbarkeit
```

oder Erweiterung der bestehenden Dispo-Datenstruktur.

Minimal:

```javascript
{
  mitarbeiter: ObjectId,
  date: Date,
  from: String,
  till: String,
  available: Boolean,
  allDay: Boolean,
  source: 'monitor' | 'flip' | 'employee',
  updatedAt: Date
}
```

Vor Abschalten von Zvoove muss `/api/dispo` vollständig ohne `getZvooveAvailability()` funktionieren.

---


# 12A. Zvoove Exit Readiness – operative Voraussetzungen vor produktivem Paychex

## 12A.1 Warum Paychex nicht der erste Produktivschritt sein darf

Paychex kann die gesetzliche Payroll übernehmen, aber Paychex erzeugt nicht die operativen Daten, aus denen die Payroll entsteht.

Heute entstehen wesentliche Teile dieser Kette noch in zvoove/LANDWEHR:

```text
Event / Auftrag
      ↓
Job / Bedarf
      ↓
Bewerbungen
      ↓
Disposition / Einsatz
      ↓
Arbeitszeit
      ↓
Freigabe / Korrektur
      ↓
abrechnungsrelevante Stunden
      ↓
Payroll
```

Zusätzlich hängt auch die Faktura an derselben operativen Kette:

```text
Event / Auftrag
      ↓
Kunde + Konditionen
      ↓
geleistete Stunden / Einheiten
      ↓
Zuschläge / vereinbarte Preise
      ↓
Rechnungspositionen
      ↓
Rechnung
```

Solange zvoove für diese Daten noch führend ist, wäre:

```text
StraightMonitor
      +
zvoove
      +
Paychex
```

keine Ablösung, sondern ein Drei-System-Betrieb.

**Daher gilt:**

- Paychex Read-only-Integration und PoC können früh starten.
- Shadow Payroll kann parallel aufgebaut werden.
- **Produktive Payroll über Paychex beginnt erst, wenn die abrechnungsrelevanten Upstream-Prozesse in StraightMonitor belastbar sind.**
- Zvoove kann endgültig erst abgeschaltet werden, wenn zusätzlich Faktura, operative Verwaltung und erforderliche Historien migriert sind.

---

# 12B. Zielbild nach Zvoove: Zwei Benutzeroberflächen, ein Datenmodell

Nach dem Exit soll nicht eine einzige riesige Oberfläche für alle Benutzer entstehen.

Stattdessen:

```text
┌──────────────────────────────────────────────────────────────┐
│                   STRAIGHTMONITOR OFFICE                    │
│             Verwaltung / Disposition / Payroll              │
│                                                              │
│ Kunden · Events · Jobs · Dispo · Zeiten · Payroll · Faktura │
└──────────────────────────────┬───────────────────────────────┘
                               │
                       gemeinsame MongoDB
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                    PUBLIC MONITOR                           │
│            Employee Self-Service in Flip                    │
│                                                              │
│ Jobs · Bewerben · Kalender · Check-In · Zeiten · Dokumente  │
│ Laufzettel · EventReport · Evaluierung                      │
└──────────────────────────────────────────────────────────────┘
```

Beide Oberflächen verwenden dieselben kanonischen StraightMonitor-Modelle.

Es soll **keine separate Public-Monitor-Datenwelt** entstehen.

---

# 12C. Public Monitor als Employee Self-Service Layer

Der Public Monitor ist bereits produktiv als in Flip eingebettete Vue-3-SPA unter `/integration/*` vorhanden.

Bestehende Fähigkeiten:

- Flip SSO über OIDC Authorization Code + PKCE
- Identifikation über `flip_id`
- Mitarbeiterprofil
- Einsatz-/Jobhistorie
- Monatskalender
- Teamleiter-Ansichten
- Event-/Jobdetail
- Echtzeit-Check-In / No-Show über SSE
- Laufzettel
- Mitarbeiter-Evaluierungen
- EventReports
- Integration zu Flip, Asana und E-Mail

Diese Architektur soll weiterverwendet werden.

## Geplante Erweiterungen

```text
Public Monitor
│
├── Meine Jobs
│   ├── offene Jobs
│   ├── Jobdetails
│   ├── Bewerben
│   ├── Bewerbung zurückziehen
│   └── Bewerbungsstatus
│
├── Meine Einsätze
│   ├── Kalender
│   ├── Einsatzdetails
│   ├── Check-In
│   └── Check-Out
│
├── Meine Zeiten
│   ├── Start / Ende
│   ├── Pause
│   ├── nachträgliche Korrekturanfrage
│   ├── Tagesübersicht
│   └── Monatsübersicht
│
├── Meine Dokumente
│   ├── Dokumente ansehen
│   ├── Dokumente herunterladen
│   ├── Dokumente hochladen
│   ├── Ablaufdaten
│   └── fehlende Dokumente / To-dos
│
├── Verfügbarkeit
│   ├── verfügbar
│   ├── nicht verfügbar
│   ├── Zeitfenster
│   └── wiederkehrende Verfügbarkeit
│
└── bestehende Bereiche
    ├── Laufzettel
    ├── Evaluierungen
    ├── EventReport
    └── Teamleiter-Funktionen
```

Der bestehende OIDC-/PKCE-Flow bleibt die bevorzugte Authentifizierung.

Der Legacy-`FLIP_PUBLIC_JWT` sollte im Zuge dieses Ausbaus entfernt werden, bevor im Public Monitor sensible Dokumente oder Zeiterfassung freigeschaltet werden.

---

# 12D. Capability-Matrix für den zvoove-Ersatz

| Bereich | Heute / vorhandener Baustein | Ziel in StraightMonitor | Blockiert Paychex produktiv? |
|---|---|---|---|
| Mitarbeiter-Stammdaten | teilweise vorhanden | vollständig kanonisch in StraightMonitor | Ja |
| Beschäftigung / Vertrag | teilweise vorhanden | `PayrollEmployment` + Vertragsdaten | Ja |
| Kunden | vorhanden | um Faktura-/Payroll-Regeln erweitern | Ja |
| Events / Aufträge | vorhanden, aber zvoove weiterhin produktiv relevant | vollständige Anlage und Pflege in StraightMonitor | Ja |
| Jobs / Bedarfe | teilweise über Auftrag/Dispo | eigenes Job-/Bedarfsmodell | Ja |
| Job-Veröffentlichung | zvoove / bisher nicht vollständig Public Monitor | Public Monitor Jobbörse | Nein für PoC, Ja für zvoove Exit |
| Job-Bewerbung | zvoove | Public Monitor Self-Service | Nein für Payroll-PoC, Ja für zvoove Exit |
| Disposition | vorhanden | vollständig ohne zvoove | Ja |
| Verfügbarkeit | zvoove-Abhängigkeit | StraightMonitor + Public Monitor | Ja |
| Einsatzhistorie | vorhanden | vollständig kanonisch + unveränderbare Historie | Ja |
| Check-In / No-Show | Public Monitor vorhanden | weiterverwenden | Nein |
| Arbeitszeiterfassung | noch nicht vollständig kanonisch | Public Monitor + Office-Freigabe | **Ja – kritisch** |
| Zeitkorrekturen | noch zu definieren | Änderungs-/Freigabeworkflow | **Ja – kritisch** |
| Laufzettel | Public Monitor vorhanden | weiterverwenden / mit Zeiten verknüpfen | unterstützend |
| Abwesenheiten | Quelle klären | kanonisches Modell + Freigabe | Ja |
| Dokumentmanagement MA | teilweise vorhanden | Public Monitor Self-Service + R2 | Nein für Payroll, Ja für operativen Exit |
| EventReport / Evaluation | Public Monitor vorhanden | weiterverwenden | Nein |
| Fakturakonditionen | zvoove / Modell ergänzen | StraightMonitor | Nein für Payroll, Ja für zvoove Exit |
| Rechnungspositionen | zvoove | aus freigegebenen Leistungsdaten generieren | Nein für Payroll, Ja für zvoove Exit |
| Rechnungen | zvoove | StraightMonitor Invoice Domain | Nein für Payroll, Ja für zvoove Exit |
| Payroll | zvoove | Straight Payroll Core + Paychex | Endziel |

---

# 12E. Event-, Job- und Bedarfsmodell

Das bestehende `Auftrag`-Modell ist ein guter Ausgangspunkt, reicht für einen vollständigen zvoove-Ersatz aber voraussichtlich nicht allein aus.

Es müssen mindestens drei Ebenen sauber unterscheidbar sein:

```text
Event / Auftrag
      │
      ├── Kunde
      ├── Ort
      ├── Zeitraum
      ├── Ansprechpartner
      ├── Abrechnungsregeln
      │
      ▼
Schicht / Job / Bedarf
      │
      ├── Tätigkeit / Qualifikation
      ├── Beginn / Ende
      ├── Anzahl benötigter Personen
      ├── Treffpunkt
      ├── Teamleiterbedarf
      ├── Mitarbeiterlohn-Kontext
      └── Kundenpreis-Kontext
      │
      ▼
Einsatz / Besetzung
          ├── Mitarbeiter
          ├── Status
          ├── Bewerbungsherkunft
          └── tatsächliche Einsatzdaten
```

Empfohlene Prüfung:

- Kann `Auftrag` das Event bleiben?
- Existiert bereits ein belastbares Schicht-/Bedarfsmodell?
- Falls nicht: Einführung z. B. `AuftragSchicht` oder `Job`.

**Nicht** alle Bedarfe in Arrays innerhalb eines riesigen `Auftrag`-Dokuments verstecken, wenn sie einzeln veröffentlicht, besetzt, geändert und abgerechnet werden müssen.

---

# 12F. Job Marketplace und Bewerbungsworkflow

Der Public Monitor soll zur primären Jobbörse für bestehende Mitarbeitende werden.

## Zielprozess

```text
Office erstellt Event
      ↓
Schichten / Bedarfe definieren
      ↓
Job wird veröffentlicht
      ↓
Public Monitor zeigt passenden Mitarbeitenden den Job
      ↓
Mitarbeiter klickt "Bewerben"
      ↓
JobApplication
      ↓
Disposition prüft Bewerbungen
      ↓
Zusage / Absage / Warteliste
      ↓
Einsatz wird erzeugt
      ↓
Mitarbeiter sieht Einsatz im Kalender
```

Empfohlenes Modell:

```text
JobApplication
```

Beispiel:

```javascript
{
  job: ObjectId,
  mitarbeiter: ObjectId,

  status: 'APPLIED' | 'WAITLIST' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN',

  appliedAt: Date,
  decidedAt: Date,
  decidedBy: ObjectId,

  source: 'public-monitor' | 'office',
  note: String
}
```

Wichtige Regeln:

- Unique Constraint für `job + mitarbeiter`
- keine Bewerbung auf kollidierende bestätigte Einsätze ohne Warnung
- Qualifikationsprüfung
- Arbeits-/Ruhezeiten-Prüfung perspektivisch
- transparente Statusanzeige im Public Monitor
- Push/Flip-Task kann zur Benachrichtigung weiterverwendet werden

---

# 12G. Arbeitszeiterfassung – kritischer Payroll-Vorläufer

Dies ist der wichtigste operative Baustein vor produktivem Paychex.

Payroll darf nicht auf geplanten Schichtzeiten beruhen, sondern auf **freigegebenen Ist-Zeiten**.

## Zielprozess

```text
geplanter Einsatz
      ↓
Mitarbeiter / Teamleiter Check-In
      ↓
Arbeitsbeginn
      ↓
Pause(n)
      ↓
Check-Out / Arbeitsende
      ↓
vorläufige Zeitbuchung
      ↓
Mitarbeiter / TL bestätigt
      ↓
Office prüft Auffälligkeiten
      ↓
APPROVED
      ↓
Payroll Lock
      ↓
PayrollRun
```

Empfohlenes Modell:

```text
ArbeitszeitBuchung
```

Erweitertes Zielmodell:

```javascript
{
  mitarbeiter: ObjectId,
  auftrag: ObjectId,
  job: ObjectId,
  einsatz: ObjectId,

  date: Date,

  planned: {
    start: Date,
    end: Date
  },

  actual: {
    start: Date,
    end: Date,
    breakMinutes: Number
  },

  source: 'public-monitor' | 'teamlead' | 'office' | 'import',

  status: 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'LOCKED',

  corrections: [{
    requestedBy: ObjectId,
    requestedAt: Date,
    reason: String,
    before: Object,
    requested: Object,
    status: String
  }],

  approvedBy: ObjectId,
  approvedAt: Date,

  payrollRun: ObjectId | null
}
```

## Public Monitor UI

Mitarbeitende:

```text
Heute – Hotel XYZ

Geplant      16:00 – 01:00
Beginn       15:54
Pause        00:30
Ende         --:--

[Arbeit beenden]
```

Teamleitungen können – wo fachlich gewünscht – Crew-Zeiten gesammelt prüfen.

Office erhält eine Exception View:

```text
⚠ Check-Out fehlt
⚠ 3h Abweichung zur Planung
⚠ Pause fehlt
⚠ Überschneidung
⚠ manuelle Änderung beantragt
```

Nur `APPROVED`/`LOCKED` fließt in Payroll.

---

# 12H. Verfügbarkeit im Public Monitor

Die bisherige Zvoove-Verfügbarkeit sollte nicht nur durch ein Office-Formular ersetzt werden.

Der bessere Zielprozess:

```text
Mitarbeiter
    ↓ Public Monitor
Verfügbarkeit / Sperrzeit eintragen
    ↓
StraightMonitor
    ↓
Dispo
```

Damit entsteht die Information direkt an der Quelle.

Empfohlen:

- Tagesverfügbarkeit
- Zeitfenster
- ganztägig verfügbar/nicht verfügbar
- wiederkehrende Regeln optional später
- Urlaub/Krankheit nicht mit normaler „nicht verfügbar“-Markierung vermischen
- Änderungshistorie

Die Dispo liest anschließend ausschließlich StraightMonitor-Verfügbarkeit.

---

# 12I. Mitarbeiter-Dokumentmanagement über Public Monitor

Der Public Monitor eignet sich als Mitarbeiter-Self-Service für Dokumente, weil Identität über Flip-OIDC bereits vorhanden ist.

## Mitarbeiter kann

- eigene freigegebene Dokumente sehen
- Dokumente herunterladen
- neue Nachweise hochladen
- fehlende Dokumente erkennen
- Ablaufdaten sehen
- erneuerte Dokumente einreichen

Beispiele:

- Immatrikulationsbescheinigung
- Aufenthaltstitel
- Arbeitserlaubnis
- Führerschein
- Bescheinigungen
- Vertragsdokumente
- später ggf. Payslips

## Modell

Die vorhandene Dokumentstruktur in `Mitarbeiter` und R2 sollte nicht unkontrolliert weiter wachsen.

Für revisions-/workflowrelevante Dokumente ist perspektivisch ein eigenes Modell sinnvoll:

```text
EmployeeDocument
```

z. B.:

```javascript
{
  mitarbeiter: ObjectId,
  type: 'STUDENT_CERTIFICATE',
  r2Key: String,
  filename: String,
  validFrom: Date,
  validTill: Date,
  status: 'UPLOADED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED',
  uploadedBy: 'employee' | 'office' | 'system',
  reviewedBy: ObjectId,
  reviewedAt: Date
}
```

Sicherheitsregel:

> Keine dauerhaften öffentlichen R2-URLs für personenbezogene Mitarbeiterdokumente.

---

# 12J. Faktura / Invoice Domain

Paychex löst Payroll, aber nicht die Kundenabrechnung.

Wenn Rechnungen heute in zvoove erzeugt werden, braucht der zvoove-Exit einen eigenen Faktura-Baustein.

Die Faktura sollte dieselben freigegebenen Leistungsdaten verwenden wie Payroll – aber mit **Kundenpreisen statt Mitarbeiterlohn**.

```text
ArbeitszeitBuchung APPROVED
            │
            ├──────────────► Payroll
            │                Mitarbeiterlohn
            │
            ▼
        Faktura
        Kundenpreis
```

## Benötigte Stammdaten

Pro Kunde / Vertrag / Event / Job beispielsweise:

- Stundenpreis
- Mindeststunden
- Nachtzuschlag Kunde
- Sonntag
- Feiertag
- kurzfristige Buchung
- Teamleiter
- Fahrtkosten
- Material / Equipment
- Storno
- individuelle Pauschalen
- Umsatzsteuerlogik
- Kostenstelle / Referenz
- Bestellnummer des Kunden

Nicht alles muss in Version 1 unterstützt werden. Es muss aber vor Migration inventarisiert werden.

## Empfohlene Modelle

```text
CustomerBillingRule
Invoice
InvoiceLine
```

Beispiel `InvoiceLine`:

```javascript
{
  invoice: ObjectId,
  auftrag: ObjectId,
  job: ObjectId,
  type: 'LABOR',
  description: 'Servicepersonal 18:00–02:00',
  quantity: 8.0,
  unit: 'HOUR',
  unitPrice: 29.50,
  amount: 236.00,
  sourceRefs: {
    workingTimeIds: [...]
  }
}
```

Wichtig:

**Eine Rechnung muss jederzeit auf die zugrunde liegenden Einsätze/Zeiten zurückgeführt werden können.**

---

# 12K. Gemeinsame „Operational Ledger“-Idee

Payroll und Faktura sollten nicht unabhängig voneinander dieselbe Einsatzrealität neu interpretieren.

Empfehlung:

```text
Planung
  ↓
Einsatz
  ↓
Ist-Zeit
  ↓
Freigabe
  ↓
LOCKED OPERATIONAL FACT
       │
       ├────────► Payroll Rule Engine
       │
       ├────────► Faktura
       │
       └────────► Reporting
```

Das bedeutet nicht zwingend ein eigenes `OperationalLedger`-Modell in Version 1.

Es bedeutet eine Architekturregel:

> **Payroll und Faktura beziehen sich auf dieselben freigegebenen, versionierten Einsatz-/Arbeitszeitdatensätze.**

Damit vermeiden wir später:

> Mitarbeiter wurde für 8,0 Stunden bezahlt, Kunde aber für 7,5 Stunden fakturiert, weil zwei unterschiedliche Datenstände verwendet wurden.

Abweichungen müssen bewusst als Regel/Override gespeichert werden.

---

# 12L. Office-seitige Funktionsbereiche, die Zvoove ersetzen müssen

Zusätzlich zum Public Monitor benötigt die interne StraightMonitor-Oberfläche mindestens:

## Events / Aufträge

- Event anlegen
- Kunde wählen
- Einsatzort
- Ansprechpartner
- Zeitraum
- interne Notizen
- Kundenreferenzen
- Status
- Kopieren wiederkehrender Events

## Jobs / Schichten

- Bedarfe anlegen
- Rollen / Qualifikationen
- benötigte Anzahl
- Zeiten
- Treffpunkt
- Lohn-/Tarifkontext
- Kundenpreis
- Veröffentlichung

## Bewerbungen / Disposition

- Bewerberliste pro Job
- Qualifikationen
- Verfügbarkeit
- Konflikte
- Zusage
- Absage
- Warteliste
- direkte Besetzung
- Massenaktionen

## Zeiten

- geplante vs. tatsächliche Zeit
- Check-In-/Check-Out-Daten
- Fehlende Zeitstempel
- Korrekturen
- Freigabe
- Lock für Payroll/Faktura

## Faktura

- abrechenbare Leistungen
- Rechnungsvorschau
- Sammelrechnung / Einzelrechnung
- Korrekturen / Storno
- PDF
- Versand
- Export an Buchhaltung

---

# 12M. Technische Erweiterungen des Public Monitor

Die bestehende Struktur unter `/integration/*` und `/api/public/*` soll beibehalten werden.

Mögliche neue Frontend-Komponenten:

```text
components/Public/
├── PublicJobs.vue
├── PublicJobApplication.vue
├── PublicAvailability.vue
├── PublicTimeTracking.vue
├── PublicTimeHistory.vue
├── PublicTimeCorrection.vue
├── PublicDocuments.vue
├── PublicDocumentUpload.vue
└── PublicPayslips.vue              # später
```

Neue Public Endpoints ungefähr:

```http
GET    /api/public/jobs
GET    /api/public/jobs/:id
POST   /api/public/jobs/:id/apply
DELETE /api/public/jobs/:id/application

GET    /api/public/applications
GET    /api/public/availability
PUT    /api/public/availability

GET    /api/public/time-entries
POST   /api/public/time-entries/check-in
POST   /api/public/time-entries/check-out
POST   /api/public/time-entries/:id/correction

GET    /api/public/documents
POST   /api/public/documents
GET    /api/public/documents/:id/download
```

Alle Endpoints leiten den Mitarbeiter aus der OIDC-Session ab.

**Keine Mitarbeiter-ID aus dem Request Body darf ausreichen, um fremde Self-Service-Daten zu lesen oder zu verändern.**

---

# 12N. Public-Monitor-Sicherheitsupgrade vor Dokumenten und Zeiterfassung

Bevor sensible Self-Service-Funktionen ausgerollt werden:

1. Legacy Shared Token `FLIP_PUBLIC_JWT` für Mitarbeiterflows abschalten.
2. OIDC-Session als alleinige Mitarbeiteridentität verwenden.
3. Backend-Autorisierung pro Objekt erzwingen.
4. Uploads serverseitig nach MIME/Dateityp/Größe validieren.
5. Private R2-Objekte verwenden.
6. Security-/Audit-Logs für Zeitkorrekturen und Dokumentstatus einführen.
7. Rate Limits für Schreibendpunkte ergänzen.
8. Session-/Token-Revocation-Konzept für ausgeschiedene Mitarbeiter prüfen.

---

# 12O. Event-/Zeit-Echtzeitarchitektur

Der vorhandene SSE-Mechanismus ist für Teamleiter-Check-In bereits sinnvoll.

Für Version 1 kann SSE auch für Live-Updates der Eventfläche weiterverwendet werden:

- Check-In
- Check-Out
- No-Show
- Crewstatus

Aber:

Die aktuelle In-Memory-Map funktioniert nur zuverlässig auf einem einzelnen Backend-Dyno.

Bevor StraightMonitor horizontal skaliert oder Zeiterfassung geschäftskritisch vollständig darüber läuft, muss entschieden werden:

```text
Option A: Single Dyno bewusst beibehalten
Option B: Redis Pub/Sub / Event Bus ergänzen
```

Die dauerhafte Zeitbuchung selbst liegt immer in MongoDB; SSE ist nur der Live-Transport.

---

# 12P. Upstream Definition of Done vor produktivem Paychex

**Paychex darf produktiv für einen Payroll-Monat genutzt werden, wenn mindestens folgende Punkte erfüllt sind:**

### Mitarbeiter / Beschäftigung

- [ ] alle abzurechnenden Mitarbeiter existieren kanonisch in StraightMonitor
- [ ] Personalnummer/Identitätsaliasing ist stabil
- [ ] Eintritt/Austritt und Beschäftigungsart sind vorhanden
- [ ] Tarif-/Entgeltgruppe ist versioniert

### Event / Einsatz

- [ ] relevante Events/Jobs werden in StraightMonitor geführt
- [ ] tatsächliche Einsatzzuordnung ist vollständig
- [ ] Kundenbezug je Einsatz ist eindeutig
- [ ] Einsatzhistorie ist reproduzierbar

### Arbeitszeit

- [ ] Ist-Zeiten entstehen außerhalb von Zvoove
- [ ] Zeitkorrekturen sind workflowbasiert
- [ ] Zeiten besitzen Freigabestatus
- [ ] Payroll kann nur `LOCKED`/freigegebene Zeiten lesen
- [ ] ein abgeschlossener Monat kann gegen nachträgliche stille Änderungen geschützt werden

### Payroll-relevante Regeln

- [ ] Abwesenheiten sind verfügbar
- [ ] AZK-Quelle steht fest
- [ ] GVP-Regelversion steht fest
- [ ] Branchen-/Equal-Pay-Kundenregeln sind gepflegt

### Betrieb

- [ ] Verwaltung kann Fehler/Ausnahmen in StraightMonitor bearbeiten
- [ ] Audit Trail ist vorhanden
- [ ] Shadow-Vergleich gegen zvoove war erfolgreich

**Nicht zwingend erforderlich für den ersten produktiven Paychex-Monat, aber erforderlich für den vollständigen zvoove-Vertragsausstieg:**

- [ ] Public-Monitor-Jobbewerbung produktiv
- [ ] Mitarbeiter-Dokument-Self-Service produktiv
- [ ] Faktura vollständig in StraightMonitor
- [ ] alle relevanten zvoove-Reports ersetzt
- [ ] historische Daten gesichert/migriert


# 13. Tarifversionierung

Tarifwerte dürfen niemals als frei verteilte Konstanten im Code leben.

Neues Modell:

```text
TariffVersion
```

Beispiel:

```javascript
{
  code: 'GVP_2026_09',
  validFrom: '2026-09-01',
  validTill: null,

  groups: {
    EG1: { hourlyRate: 15.33 },
    EG2A: { hourlyRate: null }
  },

  experienceBonusRules: [...],
  metadata: {
    source: String,
    createdBy: ObjectId,
    createdAt: Date
  }
}
```

Jeder PayrollEmployeeResult speichert die konkret verwendete `TariffVersion`.

---

# 14. Payroll Core

`api/payroll-core/` enthält nur pure functions.

Keine Funktion dort darf:

- Mongoose importieren
- Express kennen
- HTTP aufrufen
- Paychex kennen
- Dateien schreiben
- Environment Variables lesen

Beispiel:

```javascript
const result = calculatePayrollContext({
  employee,
  employment,
  assignments,
  workingTimes,
  absences,
  customerRules,
  tariffVersion,
  payrollMonth
});
```

Ausgabe:

```javascript
{
  components: [...],
  warnings: [...],
  explanations: [...],
  ruleVersion: 'GVP_2026_09'
}
```

---

# 15. Payroll Result als unveränderbarer Snapshot

Eine Abrechnung darf nicht später durch geänderte Stammdaten „anders aussehen“.

Daher wird pro Mitarbeiter/Monat ein Snapshot persistiert:

```text
PayrollEmployeeResult
```

Beispiel:

```javascript
{
  payrollRun: ObjectId,
  mitarbeiter: ObjectId,
  month: '2026-08',

  inputSnapshot: {
    employment: {...},
    assignments: [...],
    workingTimes: [...],
    customerRules: [...]
  },

  components: [
    {
      type: 'BASE_WAGE',
      quantity: 152.5,
      rate: 15.33,
      amount: 2337.83,
      explanation: {...}
    },
    {
      type: 'INDUSTRY_SURCHARGE',
      amount: 284.50,
      explanation: {...}
    }
  ],

  warnings: [],
  calculationVersion: 'payroll-core-1.0.0',
  tariffVersion: ObjectId,
  calculatedAt: Date
}
```

Nach `SYNCED_TO_PAYCHEX` wird dieser Snapshot nicht still geändert.

Änderungen erfordern Recalculate/Revision.

---

# 16. PayrollRun

Zentrales Prozessobjekt:

```text
PayrollRun
```

Beispiel:

```javascript
{
  month: '2026-08',
  scope: {
    teamKeys: ['hamburg'],
    companyKey: 'straightforward'
  },

  status: 'DRAFT',

  employeeCount: 214,
  counters: {
    calculated: 0,
    validated: 0,
    synced: 0,
    completed: 0,
    documentsImported: 0,
    errors: 0
  },

  createdBy: ObjectId,
  createdAt: Date,
  closedAt: null
}
```

Statusmodell:

```text
DRAFT
  ↓
CALCULATED
  ↓
VALIDATED
  ↓
READY_FOR_EXPORT
  ↓
SYNCED_TO_PAYCHEX
  ↓
PAYROLL_COMPLETED
  ↓
DOCUMENTS_IMPORTED
  ↓
CLOSED
```

Fehlerstatus separat pro Mitarbeiter, nicht zwingend für den gesamten Run.

---

# 17. Paychex Integration

## 17.1 PaychexService.js

Verantwortlich für:

- Authentifizierung
- API-Client
- Retry-/Timeout-Handling
- Employee Mapping
- Contract-/Employment Sync
- Salary Components
- Documents
- API-Fehlernormalisierung

Nicht verantwortlich für:

- GVP-Berechnung
- Equal Pay
- Branchenzuschlag
- AZK-Entscheidungen

## 17.2 EmployeeSalaryComponent

Zentraler Endpunkt für berechnete monatliche Komponenten:

```http
POST /companies/{company_uid}/employees/{employee_uid}/salary-components/
```

StraightMonitor berechnet fachlich den Wert und mappt ihn anschließend auf eine Paychex Company Salary Component.

Beispiel intern:

```text
INDUSTRY_SURCHARGE
amount = 284.50 EUR
```

Mapping:

```text
INDUSTRY_SURCHARGE
→ Paychex company_salary_component UUID
```

Paychex Payload:

```javascript
{
  company_salary_component: '<uuid>',
  amount: 28450,
  valid_from_month: '2026-08',
  valid_till_month: '2026-08'
}
```

Paychex unterstützt dabei u. a.:

- `amount` in Euro-Cent
- `quantity`
- `factor`
- `percent`
- `valid_from_month`
- `valid_till_month`

## 17.3 Provider Mapping

Neues Modell:

```text
PayrollProviderMapping
```

Beispiel:

```javascript
{
  provider: 'paychex',
  companyKey: 'straightforward',
  mappings: {
    BASE_WAGE: '<uuid>',
    EXPERIENCE_BONUS: '<uuid>',
    INDUSTRY_SURCHARGE: '<uuid>',
    NIGHT_PREMIUM: '<uuid>',
    SUNDAY_PREMIUM: '<uuid>',
    HOLIDAY_PREMIUM: '<uuid>',
    AZK_PAYOUT: '<uuid>'
  }
}
```

Keine Paychex UUID im Payroll Core.

---

# 18. Paychex Company Mapping

StraightMonitor ist multi-team-fähig (Berlin, Hamburg, Köln), aber ein Team ist nicht automatisch eine eigene juristische Arbeitgebergesellschaft.

Daher darf `teamKey` nicht direkt als Paychex Company UID interpretiert werden.

`api/config/payroll.js` sollte eine explizite Zuordnung enthalten:

```javascript
{
  providers: {
    paychex: {
      companies: {
        straightforward: {
          companyUid: process.env.PAYCHEX_COMPANY_UID
        }
      }
    }
  }
}
```

Falls zukünftig mehrere Arbeitgebergesellschaften existieren, wird hier erweitert.

---

# 19. API-Routen im StraightMonitor

Neue Datei:

```text
api/routes/payrollRoutes.js
```

Empfohlene Endpunkte:

```http
GET    /api/payroll/runs
POST   /api/payroll/runs
GET    /api/payroll/runs/:id

POST   /api/payroll/runs/:id/calculate
POST   /api/payroll/runs/:id/validate
POST   /api/payroll/runs/:id/sync-paychex
POST   /api/payroll/runs/:id/sync-documents
POST   /api/payroll/runs/:id/close

GET    /api/payroll/runs/:id/employees
GET    /api/payroll/runs/:id/employees/:mitarbeiterId
POST   /api/payroll/runs/:id/employees/:mitarbeiterId/recalculate

GET    /api/payroll/paychex/salary-components
POST   /api/payroll/paychex/sync-employee/:mitarbeiterId
GET    /api/payroll/paychex/status/:mitarbeiterId

GET    /api/payroll/settings/mappings
PUT    /api/payroll/settings/mappings
```

Alle async Handler verwenden zwingend `AsyncHandler`.

Alle relevanten Aktionen werden über `logger` protokolliert.

---

# 20. Kein automatischer Payroll-Push zu Beginn

StraightMonitor besitzt bereits Cron-Infrastruktur in `serverRoutines.js`.

Trotzdem sollte das Übertragen abrechnungswirksamer Salary Components im ersten Produktivstand **nicht automatisch per Cron** erfolgen.

Besser:

```text
User öffnet PayrollRun
        ↓
Calculate
        ↓
Validate
        ↓
Fehlerliste = 0
        ↓
[An Paychex übertragen]
        ↓
explizite Backend-Aktion
```

Automatisierung erst nach stabiler Produktivphase.

---

# 21. Sinnvolle Background Jobs

Über `serverRoutines.js` können später ungefährliche Sync-Jobs ergänzt werden.

## `paychexReferenceSync`

Zweck:

- Salary Components aktualisieren
- relevante Options-/Reference-Daten cachen
- Provider-Konfiguration prüfen

Rhythmus: täglich oder manuell.

## `paychexDocumentSync`

Zweck:

- neue Payroll-Dokumente erkennen
- Dokumente für abgeschlossene Runs importieren

Rhythmus: z. B. stündlich während der Abrechnungsphase oder manuell.

Beide werden in das bestehende Env-Control-System aufgenommen:

```text
ENABLE_ROUTINES=
DISABLE_ROUTINES=
CRON_PAUSED=
```

---

# 22. Payroll-Dokumente und R2

Die bestehende `R2Service.js`-Integration soll wiederverwendet werden.

Payroll-Dokumente benötigen aber strengere Regeln als normale Bewerber-/Signaturdokumente.

Empfohlener Pfad:

```text
mitarbeiter/{personalnr}/payroll/{YYYY-MM}/
```

Beispiele:

```text
payslip.pdf
deuev.pdf
lohnsteuerbescheinigung.pdf
```

**Payroll-Dokumente dürfen nicht über dauerhaft öffentliche R2-URLs ausgeliefert werden.**

Download bevorzugt:

```text
Frontend
  ↓ authenticated request
Backend
  ↓ authorization check
R2Service.downloadFile()
  ↓
stream/file response
```

---

# 23. Frontend-Workflow

## Payroll Dashboard

```text
Payroll – August 2026

Hamburg
──────────────────────────────
Mitarbeiter              214
Berechnet                214 ✓
Validiert                211 ✓
Warnungen / Fehler         3 ⚠
Paychex Sync             211 ✓
Dokumente                211 ✓
```

## Employee Detail

```text
Max Mustermann
August 2026

Grundlohn              2.337,83 €
Erfahrungszuschlag        35,07 €
Branchenzuschlag         284,50 €
Sonntag                   96,00 €
Nacht                     54,20 €
────────────────────────────────
Expected Gross         2.807,60 €

Tarif: GVP_2026_09
Einsatz: Kunde XYZ
BZ-Stufe: 3

✓ Arbeitszeiten vollständig
✓ Einsatzhistorie plausibel
✓ Salary Component Mapping vorhanden

[Neu berechnen]
[An Paychex übertragen]
```

---

# 24. Validierung vor Paychex Sync

Ein Mitarbeiter darf nur synchronisiert werden, wenn alle Pflichtprüfungen erfolgreich sind.

Mindestens:

- Mitarbeiter hat `paychex_id`
- aktives PayrollEmployment vorhanden
- Personalnummer vorhanden
- Payroll-Zeitraum liegt im Beschäftigungszeitraum
- Tarifversion vorhanden
- Entgeltgruppe vorhanden
- Arbeitszeiten freigegeben
- Einsatzdaten vollständig
- benötigte Kunden-/Branchenregel vorhanden
- keine offene Equal-Pay-Warnung
- alle internen Payroll Components haben Paychex Mapping
- kein bereits erfolgreicher identischer Export vorhanden

---

# 25. Idempotenz und Duplicate Protection

Payroll-Synchronisation darf bei Retry keine doppelten Lohnbestandteile erzeugen.

StraightMonitor speichert deshalb pro exportierter Komponente mindestens:

```javascript
{
  provider: 'paychex',
  localComponentId: ObjectId,
  remoteComponentId: String,
  payloadHash: String,
  syncedAt: Date,
  status: 'synced'
}
```

Vor erneutem POST:

1. existiert Remote-ID?
2. gleicher Payload-Hash?
3. falls geändert → PATCH/PUT statt neuer POST

---

# 26. Audit Trail

Für jede kritische Aktion speichern:

- User
- Zeitpunkt
- PayrollRun
- Mitarbeiter
- Aktion
- vorheriger Status
- neuer Status
- Payload-Hash
- Provider Response / Reference ID
- Fehlercode

Kritische Aktionen:

```text
CALCULATE
RECALCULATE
VALIDATE
MANUAL_OVERRIDE
SYNC_PAYCHEX
DELETE_REMOTE_COMPONENT
MARK_PAYROLL_COMPLETE
IMPORT_DOCUMENTS
CLOSE_RUN
```

Keine geheimen Tokens oder vollständigen sensiblen Payloads in normalen Logs.

---

# 27. Unit-/Regression-Tests werden Pflicht

Die aktuelle Architektur beschreibt primär manuelle Tests. Für Payroll reicht das nicht.

Für `api/payroll-core/` wird ein automatisiertes Test-Setup Pflicht.

Mindestens Testfälle für:

- GVP-Entgeltgruppe
- Tarifwechsel während Beschäftigung
- Eintritt im Monat
- Austritt im Monat
- Erfahrungszuschlag
- Unterbrechungslogik
- mehrere Einsätze beim gleichen Kunden
- Kundenwechsel
- Branchenzuschlagsstufen
- Equal Pay
- AZK Aufbau
- AZK Abbau
- Nacht
- Sonntag
- Feiertag
- Mehrarbeit
- Krankheit
- Urlaub
- Rundung
- negative Korrekturkomponenten
- Rückrechnung / Revision

Golden-Master-Testfälle sollten gegen bereits korrekt abgerechnete zvoove-Monate erzeugt werden.

---

# 28. Paychex Public API – bekannte Grenze

Die vorhandene API v1.3 ist stark genug für Stammdaten und Salary Components.

Aktuell ist jedoch kein dokumentierter klassischer Endpoint bestätigt für:

```text
POST payroll-run
POST payroll-calculate
POST payroll-finalize
```

und keine vollständige strukturierte Brutto-Netto-Ergebnis-API wurde bestätigt.

Daher bleibt für Version 1 der geplante Betriebsmodus:

```text
StraightMonitor
  ↓ Daten vorbereiten
Paychex API
  ↓
Paychex Browser UI
  ↓ Prüfung / Payroll-Verarbeitung
Paychex
  ↓ Documents API
StraightMonitor
```

Dies ist für den internen Betrieb akzeptabel und vermeidet riskante Vollautomatisierung.

---

# 29. Zvoove-Migrationsplan

Der bisherige Payroll-zentrierte Migrationsplan wird durch einen **operativen Exit-Plan** ersetzt.

## Phase 0 – Vollständige Zvoove Capability Inventory

Nicht nur Datenfelder inventarisieren, sondern alle produktiven Prozesse.

Mindestens:

```text
Mitarbeiter
Verträge
Kunden
Events / Aufträge
Schichten / Bedarfe
Jobveröffentlichung
Jobbewerbungen
Disposition
Verfügbarkeiten
Einsätze
Arbeitszeiten
Korrekturen
Abwesenheiten
AZK
Payroll
Rechnungen
Faktura-Regeln
Reports
Exporte
Dokumente
```

Für jeden Prozess festhalten:

```text
Current Source of Truth
Current UI
Current API / DB dependency
Future StraightMonitor Model
Future Office UI
Future Public Monitor UI
Migration requirement
Cutover criterion
```

## Phase 1 – Operational Core

Priorität vor produktiver Payroll:

- Event-/Auftragsmodell vervollständigen
- Job-/Schicht-/Bedarfsmodell festlegen
- Einsatzmodell historisch belastbar machen
- native Verfügbarkeit
- native Arbeitszeitbuchungen
- Freigabe-/Korrekturworkflow
- Abwesenheitsquelle festlegen
- PayrollEmployment aufbauen

Ziel:

> StraightMonitor kann einen vollständigen Einsatz vom Event bis zur freigegebenen Ist-Zeit ohne zvoove abbilden.

## Phase 2 – Public Monitor Workforce Ausbau

Implementieren:

- Jobbörse
- Bewerbungen
- Bewerbungsstatus
- Verfügbarkeit
- Check-In/Check-Out
- Zeitübersicht
- Korrekturanfragen
- Dokument-Self-Service

Bestehende Bereiche wie Kalender, Laufzettel, Evaluierung, EventReport und TL-Check-In werden integriert weiterverwendet.

## Phase 3 – Office Operations

StraightMonitor-Verwaltungsoberfläche vervollständigen:

- Eventanlage
- Schichten/Bedarfe
- Veröffentlichung
- Bewerbungsmanagement
- Disposition
- Zeitfreigabe
- Exceptions

Ab diesem Zeitpunkt darf die operative Planung nicht mehr auf zvoove als Schreibsystem angewiesen sein.

## Phase 4 – Payroll Foundation

Implementieren:

- Payroll Security
- PayrollEmployment
- TariffVersion
- PayrollCustomerRule
- PayrollRun
- PayrollEmployeeResult
- PayrollProviderMapping
- Payroll UI
- payroll-core + Tests

## Phase 5 – Paychex PoC

5–10 repräsentative Mitarbeiter.

Paychex wird technisch getestet, obwohl zvoove weiterhin produktiv abrechnet.

Testen:

- Stammdaten
- Beschäftigung
- Salary Components
- Korrekturen
- Dokumente
- Provider Mapping
- API Idempotenz

## Phase 6 – Shadow Payroll

Mindestens ein vollständiger Abrechnungsmonat:

```text
StraightMonitor Operational Facts
        ↓
Straight Payroll Core
        ↓
Paychex Test/Parallel
```

gegen:

```text
zvoove produktive Abrechnung
```

Differenzen werden pro Mitarbeiter automatisiert kategorisiert.

Keine Auszahlung aus Paychex.

## Phase 7 – Payroll Cutover

Nur wenn die Upstream Definition of Done aus Abschnitt 12P erfüllt ist.

Dann:

- Paychex wird produktive Payroll
- StraightMonitor wird führend für Payroll-Input
- zvoove-Payroll wird read-only / Referenz

## Phase 8 – Faktura Replacement

Falls noch nicht zuvor fertiggestellt:

- CustomerBillingRule
- Invoice
- InvoiceLine
- Rechnungsfreigabe
- PDF
- Versand
- Finanzbuchhaltungs-/Steuerberaterexport

Parallelbetrieb und Vergleich mit bisherigen zvoove-Rechnungen.

## Phase 9 – Full Zvoove Exit

Erst wenn alle benötigten Capabilities ersetzt sind:

- keine neuen Events in zvoove
- keine Jobbewerbungen in zvoove
- keine Disposition in zvoove
- keine Arbeitszeiten in zvoove
- keine Payroll in zvoove
- keine Rechnungen in zvoove

Danach:

```text
syncCompanies
ZVOOVE_API_KEY
/api/zvoove/*
ZvooveService.js
DatenImport-Zvoove-Workflow
```

deaktivieren.

Historische Daten und Legacy-Code zunächst archivieren/read-only halten statt sofort löschen.

---

# 30. Umgang mit bestehendem Zvoove-Code

Während Migration:

```text
ZvooveService.js
```

bleibt unverändert und dient als Legacy Adapter.

Neue Payroll-Logik importiert **niemals** `ZvooveService` direkt.

Falls Altdaten benötigt werden:

```text
MigrationScript / LegacyImportService
        ↓
Zvoove
        ↓
StraightMonitor canonical models
```

Danach arbeitet Payroll ausschließlich gegen StraightMonitor-Modelle.

---

# 31. Konfiguration / Environment Variables

Neue Variablen ungefähr:

```text
PAYCHEX_API_BASE_URL=
PAYCHEX_CLIENT_ID=
PAYCHEX_CLIENT_SECRET=
PAYCHEX_COMPANY_UID=
PAYCHEX_ENABLED=false
PAYCHEX_WRITE_ENABLED=false
PAYROLL_DOCUMENT_SYNC_ENABLED=false
```

Wichtig:

`PAYCHEX_WRITE_ENABLED=false` als Kill Switch für Development, Migration und Notfälle.

Produktive Schreibzugriffe müssen explizit aktiviert werden.

---

# 32. Logging

Bestehenden `utils/logger.js` verwenden.

Beispiele:

```text
Payroll run created
Payroll employee calculated
Payroll validation failed
Paychex employee synced
Paychex salary component updated
Payroll document imported
```

Nicht loggen:

- Bankverbindungen
- Steuer-IDs
- vollständige SV-Daten
- Access Tokens
- komplette Payroll Payloads mit sensiblen Daten

---

# 33. Fehlerbehandlung

Alle Payroll Routes:

```text
AsyncHandler → PayrollService → typed/normalized error → ErrorHandler
```

PaychexService sollte externe Fehler in eigene Kategorien normalisieren:

```text
PAYCHEX_AUTH_ERROR
PAYCHEX_VALIDATION_ERROR
PAYCHEX_RATE_LIMIT
PAYCHEX_CONFLICT
PAYCHEX_NOT_FOUND
PAYCHEX_UNAVAILABLE
```

Frontend zeigt fachliche Fehler statt rohe Provider-Meldungen.

---

# 34. Keine unnötige Echtzeit-Synchronisation

Nicht jede Änderung an `Mitarbeiter` soll sofort einen Paychex API Call erzeugen.

Besser:

- Änderungsstatus markieren
- Payroll Sync Status anzeigen
- explizit synchronisieren oder kontrolliert batchen

Beispiel:

```text
Mitarbeiter geändert
      ↓
payrollSyncStatus = DIRTY
      ↓
Payroll UI zeigt "Synchronisierung erforderlich"
      ↓
kontrollierter Sync
```

Dadurch vermeiden wir API-Spam und versehentliche Payroll-Änderungen.

---

# 35. Source-of-Truth Matrix

| Datengruppe | Führendes System nach Exit | Eingabeoberfläche |
|---|---|---|
| Mitarbeiteridentität | StraightMonitor | Office / Recruiting |
| Personalnummer | StraightMonitor | System / Office |
| Beschäftigung | StraightMonitor `PayrollEmployment` | Office |
| Mitarbeiterqualifikationen | StraightMonitor | Office |
| Kunden | StraightMonitor | Office |
| Event / Auftrag | StraightMonitor | Office |
| Job / Schicht / Bedarf | StraightMonitor | Office |
| Jobveröffentlichung | StraightMonitor | Office |
| Jobbewerbung | StraightMonitor | **Public Monitor** |
| Dispositionsentscheidung | StraightMonitor | Office |
| Verfügbarkeit | StraightMonitor | **Public Monitor + Office** |
| Einsatz | StraightMonitor | Office/System |
| Check-In / Check-Out | StraightMonitor | **Public Monitor / Teamlead** |
| Arbeitszeit-Ist | StraightMonitor | **Public Monitor + Office** |
| Zeitfreigabe | StraightMonitor | Office / Teamlead |
| Laufzettel | StraightMonitor | Public Monitor |
| EventReport | StraightMonitor | Public Monitor |
| Mitarbeiterdokumente | StraightMonitor metadata + private R2 | **Public Monitor + Office** |
| GVP Entgeltgruppe | StraightMonitor | Office |
| Einsatzhistorie | StraightMonitor | System |
| Kundenbranche | StraightMonitor | Office |
| Branchenzuschlag | StraightMonitor Payroll Core | System |
| Equal Pay | StraightMonitor Payroll Core | System/Office |
| AZK-Fachlogik | StraightMonitor | System/Office |
| Steuerstammdaten | bevorzugt Paychex | Paychex / StraightMonitor read-through |
| SV-Stammdaten | bevorzugt Paychex | Paychex / StraightMonitor read-through |
| Bankdaten | bevorzugt Paychex | Paychex |
| Brutto-Netto | Paychex | Paychex |
| DEÜV / Meldungen | Paychex | Paychex |
| Payslip | Paychex → private R2/metadata | Paychex / später Public Monitor |
| Kundenpreise / Fakturaregeln | StraightMonitor | Office |
| Rechnungspositionen | StraightMonitor | System/Office |
| Rechnung | StraightMonitor | Office |
| Buchhaltungsexport | StraightMonitor / später gewählter Finance Connector | System |

---

# 36. Architektur-Regeln

## Rule 1

**Kein GVP-Code in `PaychexService.js`.**

## Rule 2

**Keine Paychex UUID in `payroll-core/`.**

## Rule 3

**Kein Payroll-Business-Code direkt in `payrollRoutes.js`.**

## Rule 4

**Berechnete Payroll wird als Snapshot persistiert.**

## Rule 5

**Jede Regel ist versionierbar und testbar.**

## Rule 6

**Keine Payroll-Dokumente über öffentliche URLs.**

## Rule 7

**Schreibzugriffe zu Paychex sind idempotent und auditierbar.**

## Rule 8

**Zvoove wird erst abgeschaltet, wenn alle operativen Abhängigkeiten ersetzt sind.**

## Rule 9

**Paychex darf nie direkt geplante Schichtzeiten als abrechnungsfähige Wahrheit erhalten. Nur freigegebene StraightMonitor-Ist-Zeiten dürfen Payroll-Input sein.**

## Rule 10

**Public Monitor ist die Employee-Self-Service-Oberfläche; StraightMonitor Office bleibt die Verwaltungs-/Freigabeoberfläche. Beide verwenden dieselben kanonischen Modelle.**

## Rule 11

**Payroll und Faktura verwenden dieselben freigegebenen Einsatz-/Arbeitszeit-Facts als Ausgangspunkt.**

## Rule 12

**Kein neuer operativer Workflow darf während der Migration zvoove als versteckte dauerhafte Source of Truth behalten.**

---

# 37. PoC-Erfolgskriterien

Der Paychex-PoC gilt nur dann als erfolgreich, wenn:

1. Mitarbeiter zuverlässig erstellt/aktualisiert werden können.
2. Ein-/Austritts- und relevante Beschäftigungsdaten synchronisierbar sind.
3. benötigte Company Salary Components konfigurierbar sind.
4. StraightMonitor die Components zuverlässig zuordnen kann.
5. `EmployeeSalaryComponent` für alle relevanten variablen Lohnbestandteile funktioniert.
6. Korrekturen ohne Duplikate möglich sind.
7. Paychex-Ergebnis fachlich mit der bisherigen korrekten zvoove-Abrechnung übereinstimmt.
8. Dokumente wieder abrufbar sind.
9. Fehler sauber in StraightMonitor dargestellt werden können.
10. die Verwaltung den Ablauf ohne technische Hilfe bedienen kann.
11. Fluktuationskosten im vereinbarten Preisrahmen bleiben.

---

# 38. Offene Fragen vor Produktivbau

## Paychex

- Exakte Preislogik bei hoher Fluktuation?
- Gebühren für Ein-/Austritt, DEÜV, Korrekturen, Repeat Runs?
- Eigene Lohnarten vollständig konfigurierbar?
- Semantik von `amount`, `quantity`, `factor`, `percent` je Lohnart?
- Payroll Run API außerhalb Public API v1.3?
- strukturierte Brutto-Netto-Ergebnis-API?
- Webhooks für Payroll Completion / Documents?
- Sandbox mit realistischem deutschen Payroll-Verhalten?

## StraightMonitor

- Welches Modell ist heute die echte Quelle für Arbeitszeiten?
- Wo liegen aktuelle Abwesenheiten?
- Wie vollständig ist `Einsatz` historisiert?
- Wie wird Mitarbeiterverfügbarkeit künftig ohne Zvoove erfasst?
- Welche zvoove/PostgreSQL-Reports müssen ersetzt werden?
- Welche historischen AZK-Salden müssen in StraightMonitor übernommen werden?

---

# 39. Empfohlene Implementierungsreihenfolge

Die Reihenfolge wird bewusst von „Payroll zuerst“ auf **„operative Datenkette zuerst“** geändert.

```text
1. Vollständige Zvoove Capability Inventory
2. Canonical Data Model für Event → Job → Einsatz → Ist-Zeit
3. Event-/Job-/Schichtverwaltung in StraightMonitor vervollständigen
4. Native Verfügbarkeit
5. Public Monitor: Jobbörse + Bewerbungen
6. Public Monitor: Check-In/Check-Out + Arbeitszeiterfassung
7. Office: Zeitprüfung / Korrektur / Freigabe / Lock
8. Abwesenheiten + AZK-Datenquelle festlegen
9. Public Monitor: Dokument-Self-Service
10. Payroll Security / PAYROLL Rolle
11. PayrollEmployment
12. TariffVersion
13. PayrollCustomerRule
14. payroll-core + automatisierte Tests
15. PayrollRun + PayrollEmployeeResult
16. Payroll UI Preview / Validation
17. PaychexService Read-only
18. Salary Component Mapping
19. Paychex Write PoC
20. Document Sync
21. Shadow Payroll gegen zvoove
22. Produktiver Paychex Cutover
23. CustomerBillingRule / Faktura vervollständigen
24. Rechnungs-Shadow-Run gegen zvoove
25. Produktiver Faktura-Cutover
26. Reports / Legacy-Abhängigkeiten ersetzen
27. Zvoove vollständig deaktivieren
```

### Was davon parallel laufen kann

Nicht alles muss streng seriell entwickelt werden.

Sinnvolle parallele Streams:

```text
STREAM A – OPERATIONS
Event → Job → Dispo → Zeit

STREAM B – EMPLOYEE SELF-SERVICE
Public Monitor → Jobs → Verfügbarkeit → Zeiten → Dokumente

STREAM C – PAYROLL FOUNDATION
Tarife → Payroll Core → Paychex PoC

STREAM D – FAKTURA
Preise → Leistungspositionen → Rechnung
```

Aber der **produktive Paychex-Cutover** hängt von Stream A ab.

---

# 40. Finale Empfehlung

Das Zielprojekt sollte nicht länger primär als „Payroll Replacement“ beschrieben werden.

Die passendere Sicht ist:

> **StraightMonitor wird das interne Workforce-/Operations-System. Public Monitor wird der Employee Self-Service Layer. Paychex wird ausschließlich die gesetzliche Payroll Engine.**

Die vollständige Zielarchitektur:

```text
                         FLIP APP
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC MONITOR                          │
│                                                             │
│ Jobs / Bewerben / Verfügbarkeit / Zeiten / Dokumente        │
│ Kalender / Laufzettel / Check-In / EventReport             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    STRAIGHTMONITOR                         │
│                                                             │
│ Mitarbeiter · Kunden · Events · Jobs · Dispo · Einsätze    │
│ Zeiten · Freigaben · Dokumente · Faktura · Payroll Prep     │
└──────────────────────┬──────────────────────┬───────────────┘
                       │                      │
                       ▼                      ▼
             ┌──────────────────┐    ┌──────────────────┐
             │ Payroll Core     │    │ Faktura Engine   │
             │ GVP / AÜG / AZK  │    │ Kundenpreise     │
             │ BZ / Equal Pay   │    │ Invoice Lines    │
             └────────┬─────────┘    └──────────────────┘
                      │
                      ▼
             ┌──────────────────┐
             │ Paychex          │
             │ Payroll / Tax/SV │
             │ DEÜV / Payslips  │
             └──────────────────┘
```

## Drei getrennte Projektergebnisse

### A) Straight Operations

Ersetzt die operativen zvoove-Funktionen:

- Event-/Auftragserstellung
- Jobs / Bedarfe
- Bewerbungen
- Disposition
- Verfügbarkeit
- Einsätze
- Arbeitszeiten
- Freigaben
- operative Abwesenheiten

### B) Public Monitor Workforce

Wird zum mobilen Mitarbeiterportal in Flip:

- Jobbörse
- Bewerbung
- Verfügbarkeit
- Zeiterfassung
- Zeitkorrekturen
- Dokumentmanagement
- bestehende Laufzettel-/EventReport-/TL-Funktionen

### C) Straight Payroll + Paychex

Ersetzt die zvoove-Lohnabrechnung:

- GVP-/AÜG-Fachlogik in StraightMonitor
- Payroll Preview / Validation
- Paychex als Brutto-Netto-/Steuer-/SV-/Melde-Engine
- Rückimport von Payroll-Dokumenten

### D) Straight Faktura

Ersetzt die zvoove-Kundenabrechnung:

- Kundenkonditionen
- abrechenbare Leistungen
- Rechnungspositionen
- Rechnungen
- Korrekturen
- PDF / Versand / Buchhaltungsexport

---

## Entscheidender Cutover-Grundsatz

**Wir können Paychex technisch früh anbinden. Wir sollten Paychex aber nicht produktiv zum neuen Payroll-System machen, solange zvoove noch die Wahrheit über die abzurechnenden Einsätze und Arbeitszeiten erzeugt.**

Der produktive Cutover kommt erst nach:

```text
Event
→ Einsatz
→ Ist-Zeit
→ Freigabe
→ Payroll Snapshot
```

vollständig in StraightMonitor.

Damit vermeiden wir eine fragile Übergangsarchitektur und schaffen gleichzeitig die Grundlage dafür, zvoove tatsächlich zu kündigen statt lediglich dessen Payroll durch einen weiteren Anbieter zu ergänzen.

---

## Neue Definition of Done vor Paychex Production

Der Paychex-Produktivstart ist freigegeben, wenn:

- der abzurechnende Mitarbeiterbestand in StraightMonitor vollständig ist,
- Beschäftigungsdaten versioniert sind,
- Event-/Einsatzdaten nicht mehr aus zvoove benötigt werden,
- Ist-Arbeitszeiten außerhalb von zvoove entstehen,
- alle Payroll-Zeiten freigegeben und lockbar sind,
- Abwesenheiten/AZK verfügbar sind,
- GVP-/Branchen-/Equal-Pay-Regeln berechnet werden können,
- Payroll Preview und Audit Snapshot funktionieren,
- ein vollständiger Shadow-Monat fachlich mit zvoove abgeglichen wurde.

Der vollständige **Zvoove Exit** hat zusätzliche Bedingungen:

- Jobbörse/Bewerbungen ersetzt,
- native Verfügbarkeit ersetzt,
- Dokumentworkflows ersetzt,
- Faktura ersetzt,
- relevante Reports ersetzt,
- historische Daten gesichert,
- keine produktive Write-Abhängigkeit zu zvoove mehr vorhanden.

---

**Aktueller nächster Entwicklungsschwerpunkt ist daher nicht Paychex selbst, sondern die kanonische operative Kette `Event → Job → Einsatz → Arbeitszeit → Freigabe`.**

Paychex kann parallel als PoC integriert werden, aber diese Kette entscheidet darüber, ob aus dem Projekt wirklich ein zvoove-Ersatz wird.
