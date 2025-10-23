# WPForms Webhook Flow Analyse

## 🔄 Gesamtablauf: Laufzettel → Evaluierung

```
┌─────────────────────────────────────────────────────────────────┐
│ MITARBEITER füllt WPForm "Laufzettel" auf WordPress aus        │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│ WEBHOOK sendet POST zu /api/reports/send (Header: document-type │
│ = "laufzettel")                                                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ↓                   ↓
    [ASANA WORKFLOW]    [FLIP WORKFLOW]
         │                   │
         ↓                   ↓
  Subtask erstellen    Task für Teamleiter
  für Mitarbeiter      in Flip erstellen
         │                   │
         └─────────┬─────────┘
                   ↓
        ┌──────────────────────────────┐
        │ TEAMLEITER füllt             │
        │ WPForm "Evaluierung" aus     │
        └──────────┬───────────────────┘
                   │
                   ↓
        ┌──────────────────────────────┐
        │ WEBHOOK sendet POST mit      │
        │ document-type = "evaluierung"│
        │ + laufzettel_id (Referenz!)  │
        └──────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         ↓                   ↓
   [ASANA KOMMENTAR]   [FLIP COMPLETION]
   An Mitarbeiter      Markiere Teamleiter
   Task kommentieren   Task als erledigt
         │                   │
         └─────────┬─────────┘
                   ↓
          ✅ WORKFLOW ABGESCHLOSSEN
```

---

## 📋 Phase 1: LAUFZETTEL erstellen (WPForms → API)

### Webhook Daten:
```json
{
  "location": 7,              // Feld 7: Berlin/Hamburg/Köln
  "name_mitarbeiter": 2,      // Feld 2: Full Name
  "name_teamleiter": 13|14|15, // Feld 13/14/15: Teamleiter (je nach Location)
  "email": 20,                // Feld 20: Auto-gefüllt mit OIDC Email
  "datum": 8                  // Feld 8: Datum
}
```

### Was passiert im Backend (/api/reports/send):

```javascript
// 1️⃣ MITARBEITER LOOKUP
let mitarbeiter = await Mitarbeiter.findOne({ email });
// Falls nicht vorhanden → create mit email

// 2️⃣ TEAMLEITER LOOKUP (nach Name)
const teamleiterId = await findMitarbeiterByName(name_teamleiter);

// 3️⃣ LAUFZETTEL in MongoDB speichern
const laufzettel = new Laufzettel({
  location,
  name_mitarbeiter,
  name_teamleiter,
  datum,
  mitarbeiter: mitarbeiter._id,      // Link zu Mitarbeiter
  teamleiter: teamleiterId,          // Link zu Teamleiter
  assigned: true/false               // Nur true wenn beide gefunden
});
await laufzettel.save();
```

### 4️⃣ ASANA: Subtask für Mitarbeiter erstellen

```javascript
// Mitarbeiter hat einen Asana Personal Task
// Wir erstellen einen SUBTASK darauf:

if (mitarbeiter.asana_id) {
  const data = {
    name: `LZ [23.10.2025] - TL: Max Mustermann`,
    notes: `Anna Schmidt hat am 23.10.2025 einen Laufzettel angefragt. Teamleiter: Max Mustermann`
  };
  
  await createSubtasksOnTask(mitarbeiter.asana_id, data);
  // ✅ Subtask ist jetzt sichtbar in Mitarbeiter's Asana Task
}
```

### 5️⃣ FLIP: Task für Teamleiter erstellen

```javascript
// Teamleiter bekommt eine Task in Flip zugewiesen:
if (teamleiterId) {
  const task = await assignTeamleiter(laufzettel._id, teamleiterId);
  // ✅ Teamleiter sieht jetzt eine neue Task in Flip:
  //    "Laufzettel für Anna Schmidt vom 23.10.2025"
  
  // Speichere task.id für später (brauchen wir bei Evaluierung)
  laufzettel.task_id = task.id;
  await laufzettel.save();
}
```

---

## 📝 Phase 2: EVALUIERUNG erstellen (WPForms → API)

### Webhook Daten:
```json
{
  "location": 7,
  "name_mitarbeiter": 2,      // SAME Mitarbeiter wie in Laufzettel
  "name_teamleiter": 13|14|15,// SAME Teamleiter wie in Laufzettel
  "email": 20,                // Teamleiter's Email
  "datum": 8,
  "laufzettel_id": "507f...", // ⭐ LINK zurück zu Laufzettel!
  "kunde": "...",
  "puenktlichkeit": "...",
  "grooming": "...",
  // ... weitere Bewertungsfelder
}
```

### Was passiert im Backend (/api/reports/send):

```javascript
// 1️⃣ MITARBEITER LOOKUP (nach Name)
const mitarbeiterId = await findMitarbeiterByName(name_mitarbeiter);

// 2️⃣ TEAMLEITER LOOKUP (nach Email)
let teamleiter = await Mitarbeiter.findOne({ email });

// 3️⃣ EVALUIERUNG in MongoDB speichern
const evaluierung = new EvaluierungMA({
  name_mitarbeiter,
  name_teamleiter,
  mitarbeiter: mitarbeiterId,        // Link zu Mitarbeiter
  teamleiter: teamleiter._id,        // Link zu Teamleiter
  laufzettel: laufzettel_id,         // ⭐ Link zur zugehörigen Laufzettel!
  puenktlichkeit,
  grooming,
  motivation,
  // ... weitere Felder
  assigned: !!(mitarbeiterId && teamleiter._id)
});
await evaluierung.save();
```

### 4️⃣ ASANA: Subtask abschließen + Kommentar hinzufügen

```javascript
// Finde Mitarbeiter's Asana Task
const task = await getTaskById(mitarbeiter.asana_id);

// Finde den Subtask, den wir in Phase 1 erstellt haben
const subtasks = await getSubtaskByTask(task.gid);
const matchingSubtask = subtasks.find(
  sub => sub.name.includes("23.10.2025") && 
         sub.name.includes("Max Mustermann")
);

if (matchingSubtask && !matchingSubtask.completed) {
  // ✅ Markiere Subtask als erledigt (grüner Haken)
  await completeTaskById(matchingSubtask.gid);
}

// ✅ Füge Kommentar mit Evaluierungs-Details hinzu
const commentData = {
  html_text: `<strong>Evaluierung erhalten</strong>
              Pünktlichkeit: ${evaluierung.puenktlichkeit}
              Grooming: ${evaluierung.grooming}
              ...`
};
await createStoryOnTask(task.gid, commentData);
```

### 5️⃣ FLIP: Task für Teamleiter abschließen

```javascript
// Hol die ursprüngliche Laufzettel
const laufzettel = await Laufzettel.findById(laufzettel_id);

// Hol Teamleiter-Daten
const teamleiter = await Mitarbeiter.findById(evaluierung.teamleiter);
const flipUserId = teamleiter.flip_id; // ⭐ Flip User ID

// Finde die Task, die wir in Phase 1 erstellt haben
const assignments = await getFlipTaskAssignments(laufzettel.task_id);
const assignment = assignments.find(a => a.user_id === flipUserId);

if (assignment && !assignment.completed) {
  // ✅ Markiere Flip Task als erledigt (grüner Haken)
  await markAssignmentAsCompleted(assignment.id);
}
```

---

## 🔗 Verbindungen zwischen Systemen

### MongoDB:
```
┌─────────────────────┐
│ Mitarbeiter         │
├─────────────────────┤
│ _id                 │
│ email               │
│ vorname             │
│ nachname            │
│ asana_id            │ ← Link zu Asana Personal Task
│ flip_id             │ ← Link zu Flip User
│ is_teamleiter: bool │
└─────────────────────┘
         ↑
         │ (hat n)
         │
┌─────────────────────────┐         ┌──────────────────────┐
│ Laufzettel              │ ← Link ─│ Evaluierung MA       │
├─────────────────────────┤         ├──────────────────────┤
│ _id                     │         │ _id                  │
│ mitarbeiter: ObjectId   │         │ mitarbeiter: ObjectId│
│ teamleiter: ObjectId    │         │ teamleiter: ObjectId │
│ task_id: String (Flip)  │ ← ← ← ─│ laufzettel: ObjectId │
│ datum                   │         │ datum                │
│ assigned: bool          │         │ assigned: bool       │
│ location                │         │ puenktlichkeit, etc. │
└─────────────────────────┘         └──────────────────────┘
```

### Externe Systeme:

```
FLIP:
  - Teamleiter hat einen "Laufzettel"-Task
  - Task enthält: Mitarbeiter Name, Datum, Location
  - Wenn Evaluierung eingegeben → Task wird grün (erledigt)

ASANA:
  - Mitarbeiter hat einen "Personal Task"
  - Laufzettel → erstellt SUBTASK darauf
  - Evaluierung eingetragen → Subtask wird grün + Kommentar hinzugefügt
```

---

## ⚠️ Fehlerbehandlung

```javascript
// Wenn MITARBEITER nicht gefunden:
if (!mitarbeiter) {
  await sendMail(...) // Admin-Benachrichtigung
  // Laufzettel wird mit assigned=false gespeichert
}

// Wenn TEAMLEITER nicht gefunden:
if (!teamleiterId) {
  await sendMail(...) // Admin-Benachrichtigung
  // Laufzettel wird mit assigned=false gespeichert
}

// Wenn Mitarbeiter KEINE ASANA_ID hat:
if (!mitarbeiter.asana_id) {
  await sendMail(...) // "Mitarbeiter ohne Asana-ID"
  // Subtask kann nicht erstellt werden
}

// Wenn ASANA SUBTASK nicht gefunden bei Evaluierung:
if (!matchingSubtask) {
  await sendMail(...) // "Fehler beim Kommentieren"
  // Evaluierung wird trotzdem gespeichert
}
```

---

## 📊 Zusammenfassung: Was passiert wann?

### Timeline für Anna Schmidt:

```
T0: Anna füllt Laufzettel-Form aus
    └→ Email: anna@straightforward.email
    └→ Niederlassung: Hamburg
    └→ Teamleiter: Max Mustermann
    └→ Datum: 23.10.2025

↓ WEBHOOK sendet POST zu /api/reports/send

T1: Backend speichert Laufzettel in MongoDB
    ✅ Anna wird in Mitarbeiter-Datenbank gefunden
    ✅ Max wird in Teamleiter-Datenbank gefunden

T2: Asana - Subtask erstellt in Anna's Personal Task
    Name: "LZ [23.10.2025] - TL: Max Mustermann"
    Status: OPEN (nicht erledigt)

T3: Flip - Task erstellt für Max
    Inhalt: "Laufzettel für Anna Schmidt - 23.10.2025"
    Status: OPEN (nicht erledigt)

... (ein paar Tage später) ...

T4: Max füllt Evaluierung-Form aus
    └→ Bewertungen eintragen
    └→ Form sendet POST zu /api/reports/send mit type="evaluierung"
    └→ laufzettel_id wird mitgesendet (WICHTIG!)

T5: Backend speichert Evaluierung in MongoDB
    ✅ Verbindung zu Laufzettel hergestellt
    ✅ Verbindung zu Anna hergestellt
    ✅ Verbindung zu Max hergestellt

T6: Asana - Subtask wird COMPLETED
    Status: DONE ✓
    + Kommentar mit Evaluierungs-Details hinzugefügt

T7: Flip - Task für Max wird COMPLETED
    Status: DONE ✓

RESULT: Der gesamte Workflow ist abgeschlossen!
```

---

## 🎯 Wichtigste Erkenntnisse:

1. **Laufzettel = Anfrage des Mitarbeiters an den Teamleiter**
   - Sagt: "Bitte evaluiere mich am 23.10.2025"
   - Erstellt Aufgabe in Asana (Subtask) für Mitarbeiter
   - Erstellt Aufgabe in Flip für Teamleiter

2. **Evaluierung = Antwort des Teamleiters**
   - Referenziert die ursprüngliche Laufzettel via `laufzettel_id`
   - Schließt den Asana-Subtask ab
   - Schließt die Flip-Task ab
   - Kommentiert Evaluierungs-Details in Asana

3. **Asana ist das Hauptdoku-System für Mitarbeiter**
   - Subtasks werden erstellt (Laufzettel)
   - Subtasks werden abgeschlossen (Evaluierung)
   - Kommentare dokumentieren den Prozess

4. **Flip ist das Aufgaben-System für Teamleiter**
   - Teamleiter sieht: "Ich muss Anna evaluieren"
   - Wenn Evaluierung abgeschlossen → Task wird grün

5. **MongoDB speichert alles für Reporting/Analytics**
   - Historische Daten
   - Verbindungen zwischen Documenten
   - Metadaten (assigned, location, etc.)

---

## 🔴 Aktuelle Limitations:

1. **Commented-out Code**: Flip-Completion ist auskommentiert (Zeile ~252)
2. **Fehler-Handling**: Manche Fehler werden gesendet, aber Handler könnte robuster sein
3. **Asana-Matching**: Subtask wird per Datum+Name gemacht - könnte fragil sein
4. **Email-Format**: `formatDateFromDatum` erwartet `datum.unix` - aber WPForms sendet möglicherweise `datum` als String/ISO-Date
