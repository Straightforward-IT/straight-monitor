# Flip Fusion Connector

This connector exposes a small API surface for Flip Fusion. It is protected by a dedicated shared API key and does not use a user session.

## Server configuration

Set a long, random value in the backend environment:

```env
FLIP_FUSION_API_KEY=replace-with-a-long-random-secret
```

Restart the backend after changing the variable. Do not commit the key or include it in a Fusion prompt.

## Flip Fusion configuration

- **Name:** Straight Monitor
- **Base URL (development):** `https://dev-api.straightmonitor.com/api/flip-fusion`
- **Base URL (production):** `https://straight-monitor-684d4006140b.herokuapp.com/api/flip-fusion`
- **Authentication:** API key in request header
- **Header name:** `x-api-key`
- **API key:** the value of `FLIP_FUSION_API_KEY` (the same API key is used for development and production)

The same API key is used for development and production.

Use the development URL above while testing through the Cloudflare tunnel.

## Test endpoint

`GET /test` returns a connection confirmation:

```json
{
  "data": {
    "message": "Straight Monitor Flip Fusion connector is connected.",
    "connectedAt": "2026-09-23T12:00:00.000Z",
    "connector": "straight-monitor"
  }
}
```

Example request:

```bash
curl -H "x-api-key: $FLIP_FUSION_API_KEY" \
  https://dev-api.straightmonitor.com/api/flip-fusion/test
```

## Employee endpoint

`GET /mitarbeiter/:flipUserId` validates the supplied Flip user ID through the Flip Admin API. When the user exists, it returns the Straight Monitor `Mitarbeiter` record whose `flip_id` matches the verified ID.

The endpoint returns the employee's operational profile data, including name, contact information, employment status, working-time information, qualifications, and rank. It does not return bank, tax, social-security, address, or internal-note data.

### Request parameters

| Parameter | Location | Required | Description |
| --- | --- | --- | --- |
| `flipUserId` | Path | Yes | The Flip user ID to validate and resolve. |

There are currently no optional query parameters. The response always contains the safe employee profile fields listed below; unavailable values are `null`.

```bash
curl -H "x-api-key: $FLIP_FUSION_API_KEY" \
  https://dev-api.straightmonitor.com/api/flip-fusion/mitarbeiter/<flip-user-id>
```

### Response object

Successful requests return the following object in `data`:

```json
{
  "data": {
    "_id": "MongoDB employee ID",
    "flip_id": "Flip user ID",
    "personalnr": "Employee number",
    "vorname": "First name",
    "nachname": "Last name",
    "email": "Email address",
    "telefon": "Phone number",
    "profilbild": "R2 profile image key",
    "isActive": true,
    "geburtsdatum": "2026-01-01T00:00:00.000Z",
    "eintrittsdatum": "2026-01-01T00:00:00.000Z",
    "austrittsdatum": null,
    "arbeitsverhaeltnis": {
      "von": "2026-01-01T00:00:00.000Z",
      "typ": 0,
      "durchschnittBeiFortfuehren": false
    },
    "arbeitszeit": {
      "von": "2026-01-01T00:00:00.000Z",
      "bis": null,
      "montag": 7,
      "dienstag": 7,
      "mittwoch": 7,
      "donnerstag": 7,
      "freitag": 7,
      "samstag": null,
      "sonntag": null,
      "woche": 35,
      "monat": 151.67,
      "zeitkontoPlusLimit": 150,
      "zeitkontoMinusLimit": 0
    },
    "persgruppe": 101,
    "isBewerberstatus": false,
    "isStudent": false,
    "isSchueler": false,
    "berufe": ["Beruf ID"],
    "qualifikationen": ["Qualifikation ID"],
    "rank": "gold",
    "einsatzCount": 42
  }
}
```

`arbeitsverhaeltnis.typ` is `0` for full-time, `1` for part-time, `2` for marginal employment, and `3` for short-term employment. `persgruppe` can be `101`, `110`, `109`, or `106`. `berufe` and `qualifikationen` contain Straight Monitor IDs.

- `200`: the linked employee record in `{ "data": ... }`
- `401`: the supplied Flip user ID is not valid
- `404`: no Straight Monitor employee is linked to the valid Flip user

New connector endpoints belong in `api/routes/integrations/flipFusionRoutes.js` and inherit the same API-key protection.