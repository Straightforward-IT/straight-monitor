# Bericht: Public Monitor – H. & P. Straightforward GmbH

Ein analytischer Überblick über Architektur, Funktion und technische Umsetzung des in die **Flip-App** eingebetteten Mitarbeiterportals des Straight Monitor.

---

## 1. Einordnung & Zweck

Der **Public Monitor** ist ein eingebettetes Self-Service-Portal innerhalb der Flip-App von H. & P. Straightforward GmbH. Er bildet die letzte Meile der internen IT-Plattform „Straight Monitor" Richtung der ca. 500 Aushilfen, Teamleiter und Festangestellten ab. Während der interne Monitor (Office/Disposition) als zentrale Steuerungsinstanz mit Zvoove, Asana, YouSign und Microsoft Graph orchestriert, dient der Public Monitor als **schmaler, mobil-optimierter Konsum- und Eingabe-Layer für Mitarbeitende im operativen Eventgeschäft**.

Implementiert als Vue-3-SPA unter dem Route-Prefix `/integration/*` und über den Backend-Namespace `/api/public/*` angesprochen, ersetzt er Schritt für Schritt papier-/excel-basierte Workflows: Laufzettel, Event-Reports, Mitarbeiter-Evaluierungen und Echtzeit-Check-Ins am Veranstaltungstag.

---

## 2. Architektur & Authentifizierung

### 2.1 Routenstruktur

| Frontend-Route | Komponente | Funktion |
|---|---|---|
| `/integration/mitarbeiter/einsaetze` | `PublicEinsaetze.vue` | Shell, Datenladung, View-Switch |
| `/integration/task-bestaetigen` | `TaskBestaetigen.vue` | Quittiert Flip-Task nach Laufzettel-Abschluss |
| `/integration/monitor-login` | (Flip→Monitor SSO) | Auto-Login Office-Modus |

### 2.2 Authentifizierungsfluss (OIDC + PKCE)

Der Public Monitor implementiert einen **vollständigen OIDC-Authorization-Code-Flow mit PKCE** gegen das Flip-Keycloak (`straightforward.flip-app.com/auth/realms/hpstraightforward`):

1. Frontend erzeugt `code_verifier` + `code_challenge` (SHA-256, Base64URL) über die native Web-Crypto-API – ohne externe Bibliothek.
2. Redirect zu Keycloak mit `prompt=none` → Silent SSO, da der User in Flip bereits authentisiert ist.
3. Authorization-Code wird an `POST /api/public/oidc/callback` gesendet.
4. Backend tauscht Code gegen ID-Token, validiert dieses gegen JWKS (RS256, 1 h-Cache, JWK→PEM via `crypto.createPublicKey`).
5. Backend signiert eigenes Session-JWT (12 h, `JWT_SECRET`) mit `flip_id` und `email` als Claims.
6. Frontend persistiert das Token in `sessionStorage` (`oidc_session`) und sendet es per `x-public-token`-Header.

Die Middleware `publicAuth.js` arbeitet **dual**: zunächst Verifikation des OIDC-Session-JWT, bei Fehlschlag Fallback auf den statischen `FLIP_PUBLIC_JWT` (Legacy-WPForms-Pfad). Identifikation erfolgt bevorzugt über `req.oidcFlipId`, der direkt aus `claims.sub` stammt – dies umgeht E-Mail-Mismatches, die in der Praxis häufig auftreten (Zweit-Mails, Tippfehler).

### 2.3 Datenfluss

```
Flip-App  ─OIDC─►  Keycloak  ─ID-Token─►  Public Monitor SPA
                                              │
                                              ▼ x-public-token
                              /api/public/* (Express, publicAuth)
                                              │
                ┌─────────────────────────────┼───────────────────────────┐
                ▼                             ▼                           ▼
        MongoDB (Mitarbeiter,           Asana API                    Flip API
         Einsatz, Auftrag,           (Feedback-Stories)         (Tasks, Badges,
         Laufzettel, EventReport,                                Gruppen-Rang)
         CheckIn)
                                              │
                                              ▼
                                      E-Mail (Graph)
```

---

## 3. Komponentenanalyse

| Komponente | Rolle | Kernfunktion |
|---|---|---|
| `PublicEinsaetze.vue` | Shell | OIDC-Handshake, Profil- & Einsatzladung, Routing |
| `PublicDashboard.vue` | Landing | Rollen-adaptive Kachel-Navigation; Teamleiter sehen 30-Tage-Vorschau |
| `PublicKalender.vue` | TL/MA | Monatskalender, Tagesdetail, Multi-Schicht-Anzeige |
| `PublicJobDetail.vue` | TL | Schicht-gruppierte MA-Liste, **SSE-basierter Check-In**, No-Show, Bereich-Filter (Service/Logistik) |
| `PublicLaufzettel.vue` | MA | Einreichung Einsatzbericht inkl. Teamleiter-Zuordnung |
| `PublicEvaluierungen.vue` | TL | Tab-Liste offener vs. abgeschlossener Laufzettel |
| `PublicEvaluierung.vue` | TL | Bewertungsformular → mergt v2-Felder in Laufzettel |
| `PublicEventReport.vue` | TL | Event-Bericht mit Pro-Mitarbeiter-Feedback |
| `PublicVergangeneJobs.vue` | TL/MA | Such- und filterbares Archiv |
| `PublicMitarbeiter.vue` | TL | MA-Stammdaten-Ansicht |
| `PublicHeader.vue` / `PublicFooter.vue` | Layout | Dark-Mode via `@getflip/bridge`, Mobile-Menu, Legal |
| `TaskBestaetigen.vue` | MA | Bestätigt Flip-Task zu fertigem Laufzettel |

---

## 4. Backend – Public Routes (`/api/public/*`)

| Endpoint | Zweck |
|---|---|
| `GET /mitarbeiter` | Profil + Laufzettel-Historie + `isTeamleiter` (Qualifikation 50055) |
| `GET /einsaetze?personalNr=` | Alle Einsätze (Vergangenheit/Zukunft) angereichert mit Auftrag |
| `GET /einsatz-mitarbeiter?auftragNr=` | Crew je Schicht, mit Bereich-Klassifikation und Job-Counter |
| `GET /einsatz-teamleiter?auftragNr=` | Verfügbare TL für Laufzettel-Zuordnung |
| `POST /laufzettel` | Erzeugt Laufzettel + Flip-Task + Badge-Update |
| `POST /evaluierung` | Mergt v2-Felder in Laufzettel, schließt Flip-Task, schreibt Asana-Story, mailt Niederlassung |
| `POST /eventreport` | Event-Report mit Pro-MA-Feedback → Asana-Stories pro MA |
| `GET /checkins/events` | **SSE-Stream** für Echtzeit-Check-In-Broadcasts |
| `POST /checkins/toggle` / `POST /noshow/toggle` | Live-Toggles auf der Eventfläche |

---

## 5. Domänenlogik – Highlights

### 5.1 Rollenmodell

Keine eigene Rollen-Tabelle – die Rolle „Teamleiter" wird **implizit über die Zvoove-Qualifikation `qualificationKey: 50055`** ermittelt. Das hält das Modell schlank, koppelt aber die Anwendungsrechte an HR-Stammdaten – ein klassischer Trade-off, der in der Forschungsfrage aufgegriffen werden kann.

### 5.2 Laufzettel v1 ↔ v2

Zwei Generationen koexistieren in einer Collection. v1 ermittelt Status implizit über die Existenz einer `EvaluierungMA`, v2 hält `status` und alle Bewertungsfelder im Laufzettel selbst. Migration findet **rolling** beim nächsten Schreibvorgang statt – ohne Downtime.

### 5.3 Identitäts-Aliasing (`personalnrHistory`)

Da Zvoove Personalnummern teilweise rotiert, aggregiert der Job-Badge in `PublicJobDetail.vue` über alle historischen Personalnummern eines Mitarbeitenden. So bleibt die „X. Job"-Anzeige biografisch konsistent.

### 5.4 Rangsystem (Backend-only, Roadmap-relevant)

`flipRanks.js` definiert 8 Tiers (Bronze 1 → Immortal 1000 Einsätze). Diese werden aktuell **nur backend-seitig in Flip-Gruppen synchronisiert** und **noch nicht im Public Monitor visualisiert** – ein offensichtlicher Erweiterungspunkt (Gamification).

### 5.5 Echtzeit-Check-In via SSE

In-Memory-Map `Map<auftragNr, Set<Response>>`, 25 s Keep-Alive (Heroku-tauglich), `setNoDelay` + `X-Accel-Buffering: no` zur Vermeidung von Proxy-Pufferung. Bewusste Architekturentscheidung gegen WebSockets – einfacher zu betreiben, ausreichend für das unidirektionale Broadcast-Pattern.

### 5.6 Fire-and-Forget-Orchestrierung

Beim Speichern eines Event-Reports oder einer Evaluierung werden **asynchron, ohne Blockierung der API-Response**: (a) Flip-Tasks erstellt/gelöscht, (b) Asana-Stories geschrieben (mit `asana_story_gid` zur späteren Verknüpfungs-Auflösung), (c) E-Mails an die Niederlassung versendet. Das Pattern ist hochperformant, opfert aber Transaktionsgarantien.

---

## 6. Sicherheit

- **PKCE S256** vollständig (CSRF-State, sicherer Random via `crypto.getRandomValues`).
- **JWT-Verifikation** lokal gegen gecachte JWKS – kein Remote-Call pro Request.
- **Datentrennung**: Backend gibt nie Mitarbeiterdaten anderer User zurück; TL-Sicht ist auf `laufzettel_received` und gemeinsame Auftragsnummern beschränkt.
- **CORS-Allowlist + Raw-Body-Preservation** in `app.js` für Webhook-Signaturprüfung.
- **Schwachpunkt**: Der Legacy-Pfad `?token=FLIP_PUBLIC_JWT` ist ein geteiltes Geheimnis und sollte mittelfristig retiriert werden.

---

## 7. Bewertende Beobachtungen

| Stärke | Schwäche / Risiko |
|---|---|
| Saubere OIDC-Implementierung **ohne** Auth-Library | Implizite Rolle „Teamleiter" gekoppelt an HR-Qualifikation |
| Echtzeit-Check-In ohne WebSocket-Komplexität | In-Memory-SSE-State nicht horizontal skalierbar (Single-Dyno) |
| Multi-System-Orchestrierung in einer Transaktion (Mongo + Flip + Asana + Mail) | Fire-and-Forget ohne Retry/Outbox → potenzielle Inkonsistenzen |
| Versionierte Schemata (Laufzettel v1/v2) | Status-Inferenz für v1 ist fragil |
| Identitäts-Aliasing über `personalnrHistory` | Rangsystem bisher unsichtbar für Endnutzer (Gamification-Lücke) |

---

## 8. Vorschlag Forschungsfrage (Bachelorarbeit)

### Haupt-Forschungsfrage

> **„Wie wirkt sich die Integration eines OIDC-gestützten, multi-system-orchestrierten Mitarbeiter-Self-Service-Portals in eine bestehende Kommunikations-App (Flip) auf Prozessqualität, Datenkonsistenz und Akzeptanz im operativen Personaleinsatzmanagement eines mittelständischen Eventdienstleisters aus?"**

### Mögliche Teilfragen

1. **Architektur**: Welche Kompromisse entstehen, wenn Authentifizierung, Aufgabenverwaltung und Stammdaten zwischen drei produktiv genutzten Drittsystemen (Flip, Asana, Zvoove) orchestriert werden, ohne klassische Transaktionsgarantien?
2. **Echtzeitkommunikation**: Unter welchen Bedingungen ist Server-Sent Events gegenüber WebSockets für unidirektionale Broadcasts im Eventbetrieb die wirtschaftlich überlegene Wahl?
3. **Identität & Rollen**: Welche Implikationen hat eine **implizite Rollenmodellierung** über HR-Stammdaten (Qualifikationen) gegenüber einem expliziten RBAC-Modell hinsichtlich Pflegeaufwand, Auditierbarkeit und Sicherheitsrisiken?
4. **Prozesswirkung**: Wie verändert die Digitalisierung von Laufzetteln und Event-Reports messbare Kennzahlen wie Durchlaufzeit, Fehlerquote und Mitarbeiterzufriedenheit gegenüber dem papierbasierten Vorprozess?
5. **Gamification (Ausblick)**: Welchen Einfluss kann ein sichtbares Rangsystem (Bronze→Immortal) auf Mitarbeiterbindung und Verfügbarkeit im saisonalen Eventgeschäft haben?

### Methodischer Vorschlag

- **Design Science Research** als Rahmen (Hevner et al.) – das System selbst als Artefakt.
- **Quantitativ**: Vorher-/Nachher-Vergleich KPIs (Anzahl rechtzeitig eingereichte Laufzettel, mittlere Bearbeitungsdauer Evaluierung, Anzahl Check-In-Korrekturen).
- **Qualitativ**: Leitfadeninterviews mit Teamleitern und Office-Disposition.
- **Architektur-Evaluation**: ATAM-light zur Bewertung von Skalierbarkeit, Wartbarkeit und Sicherheit.
