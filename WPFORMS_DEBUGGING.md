# WPForms Webhook Debugging Guide

## Logging Levels

Mit `LOG_LEVEL=DEBUG` in der `.env` kannst du folgende Logs sehen:

```bash
LOG_LEVEL=DEBUG
```

## Webhook Flow Logging

### 1️⃣ Laufzettel wird eingereicht:

```
📨 WPForms Webhook received: laufzettel
Laufzettel data: { location: 'Hamburg', name_mitarbeiter: 'Anna Schmidt', ... }
📋 Processing Laufzettel...
✅ Laufzettel created: 507f...
Assigning Laufzettel to Mitarbeiter: 507f...
Creating Asana subtask for Mitarbeiter: asana-123
✅ Asana subtask created successfully
Assigning Laufzettel to Teamleiter: 507f...
✅ Flip task created: flip-456
✅ WPForms webhook processed successfully: laufzettel
```

### 2️⃣ Evaluierung wird eingereicht:

```
📨 WPForms Webhook received: evaluierung
Evaluierung data: { name_mitarbeiter: 'Anna Schmidt', name_teamleiter: 'Max Mustermann', laufzettel_id: '507f...', ... }
📝 Processing Evaluierung...
✅ Evaluierung created: 507g...
Assigning Evaluierung to Mitarbeiter: 507f...
Processing Asana workflow for Evaluierung...
Formatted date: 23.10.2025
Found Asana task: gid-xyz
Found 2 subtasks
Found matching subtask: LZ [23.10.2025] - TL: Max Mustermann (gid-abc)
✅ Asana Subtask marked complete
✅ Asana Kommentar erstellt: gid-comment-123
✅ WPForms webhook processed successfully: evaluierung
```

---

## ❌ Fehlerbehandlung & Debugging

### Problem: "Mitarbeiter nicht gefunden"

**Log Output:**
```
⚠️ Laufzettel could not be fully assigned. Teamleiter: true, Mitarbeiter: false
```

**Ursachen:**
- Email von WPForms stimmt nicht mit Mitarbeiter-Datenbank überein
- Mitarbeiter wurde noch nicht in Datenbank erstellt

**Lösung:**
1. Prüfe: `GET /api/personal` (alle Mitarbeiter)
2. Stelle sicher, dass Mitarbeiter's Email korrekt ist
3. Wenn nicht vorhanden: Erstelle manuell oder synchronisiere aus Flip

---

### Problem: "Asana Subtask nicht gefunden"

**Log Output:**
```
⚠️ No matching Asana Subtask found. Searched for: "23.10.2025" and "Max Mustermann"
```

**Ursachen:**
- Das Asana Subtask wurde nie erstellt (Laufzettel-Webhook fehlgeschlagen)
- Datum-Format stimmt nicht überein
- Teamleiter-Name stimmt nicht überein

**Lösung:**
1. Prüfe Laufzettel-Logs ob Asana subtask erstellt wurde
2. Prüfe manuell in Asana ob Subtask vorhanden ist
3. Wenn nein: Rufe `/api/reports/assign` auf um es manuell nachzuerstellen

---

### Problem: "Teamleiter nicht gefunden"

**Log Output:**
```
⚠️ Laufzettel could not be fully assigned. Teamleiter: false, Mitarbeiter: true
```

**Ursachen:**
- WPForms sendet ungültigen Namen
- Teamleiter existiert nicht in Datenbank
- Name-Matching schlägt fehl (Tippfehler, Umlaute, etc.)

**Lösung:**
1. Test-Endpoint nutzen: `POST /api/reports/test`
   ```json
   {
     "names": ["Max Mustermann", "Anna Schmidt"]
   }
   ```
2. Prüfe ob Namen korrekt in Datenbank gespeichert sind

---

## 🔍 Debugging Endpoints

### Test: Name-Matching

```bash
curl -X POST http://localhost:5050/api/reports/test \
  -H "Content-Type: application/json" \
  -d '{
    "names": ["Max Mustermann", "Anna Schmidt", "Unknown Person"]
  }'
```

**Response:**
```json
{
  "success": true,
  "foundNames": [
    { "name": "Max Mustermann", "userId": "507f..." },
    { "name": "Anna Schmidt", "userId": "507g..." }
  ],
  "notFoundNames": ["Unknown Person"]
}
```

---

## 📊 MongoDB Queries zum Debugging

### Alle Laufzettel anzeigen:

```javascript
db.laufzettels.find().pretty()
```

### Nur unvollständige Laufzettel:

```javascript
db.laufzettels.find({ assigned: false }).pretty()
```

### Laufzettel mit Evaluierung:

```javascript
db.evaluierungmas.find({ laufzettel: ObjectId("507f...") }).pretty()
```

### Alle Mitarbeiter mit asana_id:

```javascript
db.mitarbeiters.find({ asana_id: { $exists: true, $ne: null } }).pretty()
```

---

## 🧪 Manuelles Testing

### 1. Simuliere Laufzettel-Webhook:

```bash
curl -X POST http://localhost:5050/api/reports/send \
  -H "x-auth-token: YOUR_TOKEN" \
  -H "document-type: laufzettel" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Hamburg",
    "name_mitarbeiter": "Anna Schmidt",
    "name_teamleiter": "Max Mustermann",
    "email": "anna@straightforward.email",
    "datum": "2025-10-23"
  }'
```

### 2. Simuliere Evaluierung-Webhook:

```bash
curl -X POST http://localhost:5050/api/reports/send \
  -H "x-auth-token: YOUR_TOKEN" \
  -H "document-type: evaluierung" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Hamburg",
    "name_mitarbeiter": "Anna Schmidt",
    "name_teamleiter": "Max Mustermann",
    "email": "max@straightforward.email",
    "datum": "2025-10-25",
    "laufzettel_id": "507f...",
    "kunde": "TestKunde",
    "puenktlichkeit": "sehr_gut",
    "grooming": "gut",
    "motivation": "gut",
    "technische_fertigkeiten": "gut",
    "lernbereitschaft": "sehr_gut",
    "sonstiges": "Alles Top"
  }'
```

---

## 📝 Log Level Empfehlungen

### Production:
```
LOG_LEVEL=WARN
```
- Nur wichtige Fehler

### Development:
```
LOG_LEVEL=INFO
```
- Info + Warnungen + Fehler

### Debugging:
```
LOG_LEVEL=DEBUG
```
- Alles inklusive Details

---

## 🎯 Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|--------|--------|
| `Cannot read property 'unix' of undefined` | `formatDateFromDatum` Bug (jetzt gefixt) | Update auf neuste Version |
| `Asana Task not found` | Mitarbeiter hat keine asana_id | Prüfe Mitarbeiter-Daten |
| `Evaluierung could not be assigned` | Teamleiter nicht in DB | Synchronisiere von Flip |
| `Laufzettel task_id not saved` | Flip API Error | Prüfe Flip Verbindung |

---

## 🔗 Verwandte Endpoints

- `GET /api/personal` - Alle Mitarbeiter
- `POST /api/reports/assign` - Manuelle Zuweisung
- `POST /api/reports/test` - Name-Matching testen
- `GET /api/asana/tasks/:id` - Asana Task Details
- `GET /api/wpforms/teamleiter/:team` - Teamleiter pro Niederlassung
