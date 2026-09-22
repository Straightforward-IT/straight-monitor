# Apple Wallet pass generation

The authenticated backend endpoint `POST /api/wallet-passes/generate` creates a
signed generic Apple Wallet pass. It does not depend on frontend code or load an
order from MongoDB yet.

## Server configuration

The signing identity must stay outside the repository. Configure either file
paths or Base64 values:

```dotenv
APPLE_WALLET_PASS_TYPE_ID=pass.de.straightforward.auftraege
APPLE_WALLET_TEAM_ID=P675J3K7M9
APPLE_WALLET_ORGANIZATION_NAME=H. & P. Straightforward GmbH

# Local/server file variant
APPLE_WALLET_P12_PATH=/secure/path/auftrag-pass.p12
APPLE_WALLET_WWDR_PATH=/secure/path/AppleWWDRCAG4.cer

# Deployment secret variant instead of the two paths above
# APPLE_WALLET_P12_BASE64=<base64 encoded p12>
# APPLE_WALLET_WWDR_BASE64=<base64 encoded WWDR G4 certificate>

APPLE_WALLET_P12_PASSWORD=<p12 password>
```

The optional `APPLE_WALLET_LOGO_PATH` is resolved relative to `api`; without it,
`api/assets/straightforward-logo-black.png` is used.

## Request

Send the normal `x-auth-token` header and JSON such as:

```json
{
  "serialNumber": "auftrag-4711",
  "title": "Messe Hamburg",
  "subtitle": "Auftrag 4711",
  "startDate": "2026-09-21T12:00:00+02:00",
  "expirationDate": "2026-09-22T12:00:00+02:00",
  "location": "Messeplatz 1, Hamburg",
  "reference": "4711",
  "notes": "Treffpunkt am Haupteingang",
  "barcode": {
    "message": "auftrag:4711",
    "altText": "4711",
    "format": "PKBarcodeFormatQR"
  }
}
```

The response has content type `application/vnd.apple.pkpass` and is returned as
an attachment. Supplying the same pass type and serial number again creates a
replacement for the existing Wallet pass; push-based updates are not part of
this first route.
