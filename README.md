# Straight Monitor

MEVN-Stack Anwendung (MongoDB, Express, Vue 3, Node.js) als zentrale Orchestrierungsplattform für Flip, Asana, Zvoove, YouSign und Microsoft Graph.

## Entwicklung starten

```bash
npm run dev   # startet Frontend (Vite), Backend (Nodemon) und Cloudflared-Tunnel gleichzeitig
```

API läuft auf `http://localhost:5050`, Frontend auf `http://localhost:5173`.

---

## Mitarbeiterdokument: Kündigung

In der Mitarbeiterkarte öffnen beide Aktionsmenüs über **Dokument → Kündigung**
das eigene [KuendigungModal](frontend/Straight-Monitor/src/components/Modals/KuendigungModal.vue).
Der [KuendigungService](api/services/operations/KuendigungService.js) erzeugt das
Kündigungsschreiben unabhängig vom Signaturprozess.

- Das Modal erfordert Standort, Anrede (**Frau/Herr**), Briefdatum und
  Beendigungsdatum. Das Briefdatum wird im Schreiben oben und unten mit
  derselben Ortsangabe ausgegeben.
- Die Freistellung ist optional und ermöglicht unabhängig voneinander
  Arbeitszeitkonto, Resturlaub oder beides samt jeweiligem Wert und
  Freistellungsdatum.
- `GET /api/personal/mitarbeiter/:id/documents/kuendigung` liefert
  Standorte, vorausgefüllte Parameter und bereits erstellte Dokumente.
  `POST /api/personal/mitarbeiter/:id/documents/kuendigung` validiert die
  Werte serverseitig und erzeugt das PDF.
- Die PDF wird über R2 unter
  `employees/<id>/documents/Kuendigung_<Vorname>_<Nachname>_<Briefdatum>.pdf` ab und verknüpft
  Metadaten und verwendete Parameter in `Mitarbeiter.generierteDokumente`.
  Bei fehlgeschlagener DB-Verknüpfung wird die hochgeladene Datei wieder entfernt.
- Downloads verwenden die bestehenden Mitarbeiter-Storage-Endpunkte und sind
  im Modal sowie im Tab **Ablage** verfügbar.
- Keine Signaturanfrage, kein Versand, keine automatische Änderung von
  Aktivstatus oder Austrittsdatum. Das eingegebene Beendigungsdatum wird nicht
  als Kündigungsfrist berechnet oder am Mitarbeiter gespeichert.

Bei Kündigungs-/Fristenlogik gilt die
[GVP-Referenz](Documentation/Payroll/GVP-TARIFVERTRAG-REFERENCE.md).

---

## TODO: Stundenkonto (EmployeeCard Dispo-Bereich)

**Geplante Funktion:** Im Dispo-Bereich der `EmployeeCard` soll für den laufenden Monat angezeigt werden,
wieviele Stunden ein Mitarbeiter arbeiten darf und wieviele davon bereits eingeplant sind.

**Benötigte Modell-Änderung in `api/models/Employee/Mitarbeiter.js`:**
```js
stundenkontoMonatlich: [{
  monat: { type: String, required: true }, // Format: "YYYY-MM"
  erlaubteStunden: { type: Number, required: true }, // z.B. 70 bei KZF/Mini
  // geplant wird dynamisch aus Einsatz-Collection berechnet, nicht gespeichert
}]
```

**Berechnung geplanter Stunden:** Summe der `bedarf`-Felder aller Einsatz-Dokumente
des Mitarbeiters im aktuellen Monat (inkl. zukünftiger Schichten).

**Backend:** `GET /api/personal/:id/einsatz-context` um
`geplantStundenAktuellerMonat: Number` und `erlaubteStundenAktuellerMonat: Number` erweitern.

**Frontend:** `EmployeeCard.vue` Dispo-Sektion zeigt Fortschrittsbalken
`geplantStunden / erlaubteStunden` mit Warnung bei Überschreitung.

---

## Zvoove Daten-Import

Importdateien werden als Excel-Export aus L1 bezogen und über `DatenImport.vue` hochgeladen.

### Listen-Übersicht

| Liste | Inhalt | Prüffeld (Spalte A) |
|-------|--------|---------------------|
| 7001 | Einsatz Komplett (Einsätze, Aufträge, Kunden, Schichten) | `7001` |
| 7002 | Personal (Stammdaten, Berufe, Qualifikationen) | `7002` |
| 7003 | Verfügbarkeiten (EINSATZZEIT_TAEGLICH) | `7003` |
| 6001 | Rechnungen | `6001` |
| 3201 | Personalnr.-Historien | `3201` |

### Migration: Firebird 3 → PostgreSQL 17

Mit der Umstellung der Zvoove-Datenbank von **Firebird 3** auf **PostgreSQL 17** haben sich die SQL-Exporte wie folgt geändert:

#### Liste 7001 (Einsatz Komplett)

| Änderung | Alt (Firebird 3) | Neu (PostgreSQL 17) |
|----------|-----------------|---------------------|
| Spalte Auftrag-Geschäftsstelle | `GESCHST` | `A_GESCHST` |
| Unbesetzte Schichten | *(nicht vorhanden)* | `IST_PSEUDO = 1` (kein PERSONALNR) |
| Headerzeile | *(keine)* | Zeile 0 enthält Spaltennamen |

**`IST_PSEUDO`**: Wert `1` bedeutet, der Einsatzplatz ist offen (kein Mitarbeiter zugewiesen). Diese Zeilen werden beim Import als Schicht-Bedarf gezählt, aber **kein** Einsatz-Datensatz wird angelegt.

Der Backend-Import behandelt beide Formate abwärtskompatibel: `row['A_GESCHST'] || row['GESCHST']`.

#### Liste 7002 (Personal)

Keine strukturellen Änderungen. Der Export enthält weiterhin folgende Spalten (mit Headerzeile):

```
CODE | PERSONALNR | PERSSTATUS | GEBDATUM | EINTRITT1 | AUSTRITT1 | BERUFSCHL_LISTE | QUALSCHL_LISTE | PERSGR | EMAIL | TELEFON
```

#### Alle Listen

Alle PostgreSQL-Exporte enthalten jetzt eine **Headerzeile (Row 0)** mit den Spaltennamen. Der Import-Code erkennt dies automatisch (`isNaN(row[0][0]) → startRow = 1`).

---

## Architektur-Übersicht

```
api/                  Express Backend, REST-API, Background-Jobs
  routes/             API-Routen (dataImportRoutes.js für Zvoove-Import)
  models/             Mongoose-Schemas
  middleware/         Auth (JWT), AsyncHandler, ErrorHandler
  serverRoutines.js   Cron-Jobs (Flip-Sync, Asana-Sync)
  config/registry.js  Zentrale Konfiguration

frontend/Straight-Monitor/
  src/components/     Vue-Komponenten (DatenImport.vue, PeopleDocsModern.vue, …)
  src/stores/         Pinia Stores (auth, dataCache)
  vite.config.js      Proxy → localhost:5050
```

## Umgebungsvariablen

Siehe `.env` in `api/` und `frontend/Straight-Monitor/`. Wichtige Variablen:

- `ENABLE_ROUTINES` / `DISABLE_ROUTINES` – Background-Jobs ein-/ausschalten
- `CLOUDFLARED_TUNNEL` – Tunnel-Name für externe Webhooks (Flip, Asana)
