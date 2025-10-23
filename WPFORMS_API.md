# WPForms Management API - Dokumentation

## Übersicht

Die WPForms Management API ermöglicht es dir, die Auswahlmöglichkeiten von WPForms-Feldern über das Backend zu verwalten und zu aktualisieren. Dies ist besonders nützlich für dynamische Inhalte wie Teamleiter-Listen.

## API Endpoints

### 1. Teamleiter für eine Niederlassung abrufen

**Endpoint:** `GET /api/wpforms/teamleiter/:team`

**Parameter:**
- `team` (path): `berlin`, `hamburg`, oder `koeln`

**Beispiel:**
```bash
curl -H "x-auth-token: YOUR_TOKEN" \
  http://localhost:5050/api/wpforms/teamleiter/hamburg
```

**Response:**
```json
{
  "success": true,
  "team": "hamburg",
  "location": "Hamburg",
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "vorname": "Max",
      "nachname": "Mustermann",
      "email": "max@straightforward.email"
    },
    ...
  ]
}
```

---

### 2. Alle Teamleiter gruppiert nach Niederlassung abrufen

**Endpoint:** `GET /api/wpforms/teamleiter`

**Beispiel:**
```bash
curl -H "x-auth-token: YOUR_TOKEN" \
  http://localhost:5050/api/wpforms/teamleiter
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "Hamburg",
      "teamleiter": [
        {
          "id": "507f1f77bcf86cd799439011",
          "vorname": "Max",
          "nachname": "Mustermann",
          "email": "max@straightforward.email"
        }
      ]
    },
    ...
  ]
}
```

---

### 3. Teamleiter-Auswahlmöglichkeiten für eine Niederlassung aktualisieren

**Endpoint:** `POST /api/wpforms/update-teamleiter`

**Request Body:**
```json
{
  "team": "hamburg",
  "teamleiter": [
    {
      "id": "507f1f77bcf86cd799439011",
      "vorname": "Max",
      "nachname": "Mustermann"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "vorname": "Anna",
      "nachname": "Schmidt"
    }
  ]
}
```

**Beispiel:**
```bash
curl -X POST -H "x-auth-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team": "hamburg",
    "teamleiter": [
      {
        "id": "507f1f77bcf86cd799439011",
        "vorname": "Max",
        "nachname": "Mustermann"
      }
    ]
  }' \
  http://localhost:5050/api/wpforms/update-teamleiter
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "fieldId": 14,
    "optionsCount": 2,
    "message": "Field 14 updated with 2 options"
  }
}
```

---

### 4. Alle Teamleiter-Felder von der Datenbank synchronisieren

**Endpoint:** `POST /api/wpforms/sync-teamleiter`

Dies synchronisiert automatisch alle Teamleiter aus der MongoDB-Datenbank zu den entsprechenden WPForms-Feldern.

**Beispiel:**
```bash
curl -X POST -H "x-auth-token: YOUR_TOKEN" \
  http://localhost:5050/api/wpforms/sync-teamleiter
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "results": [
      {
        "success": true,
        "fieldId": 13,
        "optionsCount": 3,
        "message": "Field 13 updated with 3 options"
      },
      ...
    ],
    "message": "Successfully synced 3 locations"
  }
}
```

---

### 5. Konfiguration eines Feldes abrufen

**Endpoint:** `GET /api/wpforms/config/:formId/:fieldId`

**Parameter:**
- `formId` (path): WPForms Form ID (z.B. 171)
- `fieldId` (path): Field ID (z.B. 14)

**Beispiel:**
```bash
curl -H "x-auth-token: YOUR_TOKEN" \
  http://localhost:5050/api/wpforms/config/171/14
```

**Response:**
```json
{
  "success": true,
  "fieldId": "14",
  "formId": "171",
  "label": "Teamleiter*in (Hamburg)",
  "choices": {
    "40": {
      "label": "Abdul Iddrisu",
      "value": "",
      "image": "",
      "icon": "face-smile",
      "icon_style": "regular"
    },
    ...
  }
}
```

---

## Feld-Mapping für Laufzettel (Form 171)

| Field ID | Niederlassung | Bedingung |
|----------|---|---|
| 13 | Berlin | Wenn Niederlassung = 1 |
| 14 | Hamburg | Wenn Niederlassung = 2 |
| 15 | Köln | Wenn Niederlassung = 3 |

---

## Authentifizierung

Alle Endpoints erfordern einen gültigen JWT-Token im Header:
```
x-auth-token: YOUR_JWT_TOKEN
```

---

## Automatisierte Synchronisierung

Du kannst die Synchronisierung auch automatisiert einrichten, indem du einen Cron-Job in `serverRoutines.js` hinzufügst:

```javascript
// In serverRoutines.js
cron.schedule('0 0 * * 0', async () => { // Jeden Sonntag um 00:00
  try {
    const result = await WPFormsUpdateService.syncTeamleiterFromDatabase();
    logger.info('✓ WPForms teamleiter sync completed');
  } catch (error) {
    logger.error('WPForms sync failed:', error);
  }
});
```

---

## Fehlerbehandlung

Wenn ein Request fehlschlägt, erhältst du eine Error-Response:

```json
{
  "success": false,
  "error": "Field 14 not found in form"
}
```

Häufige Fehler:
- `401 Unauthorized` - Ungültiger oder fehlender Token
- `404 Not Found` - Form oder Field nicht gefunden
- `400 Bad Request` - Ungültige Request-Daten
- `500 Internal Server Error` - WordPress API-Fehler

---

## Beispiel: Frontend Integration

```javascript
// Teamleiter für Hamburg abrufen
async function loadTeamleiterForHamburg() {
  try {
    const response = await api.get('/api/wpforms/teamleiter/hamburg');
    
    if (response.data.success) {
      console.log('Teamleiter:', response.data.data);
      // Update UI with teamleiter list
    }
  } catch (error) {
    console.error('Failed to load teamleiter:', error);
  }
}

// Teamleiter synchronisieren
async function syncTeamleiter() {
  try {
    const response = await api.post('/api/wpforms/sync-teamleiter');
    
    if (response.data.success) {
      console.log('Sync completed!');
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```
