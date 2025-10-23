# MailParser Email Integration Setup Guide

## Overview
The MailParser now integrates with Microsoft Graph API to receive emails sent to `parser@straightforward.email` and automatically display their HTML content for template configuration.

---

## Architecture

### Shared Mailbox Configuration
- **Shared Mailbox**: `parser@straightforward.email`
- **Primary User**: `it@straightforward.email` (has access to the shared mailbox)
- **Authentication**: Uses IT user's credentials from `.env` (EMAIL_CLIENT_ID_IT, EMAIL_SECRET_IT, etc.)

### How It Works
1. User sends test email to `parser@straightforward.email`
2. Microsoft Graph webhook fires to `/api/graph/parser/webhook`
3. Backend fetches email HTML and stores in memory cache (last 10 emails)
4. Frontend can:
   - Click "Fetch Latest Email" to manually pull newest email
   - Select from cached emails dropdown
   - Automatically loads cached emails on component mount

---

## Setup Steps

### 1. Get the Folder ID for Parser Mailbox

You need to find the folder ID for the parser shared mailbox inbox. Run this PowerShell command or use Graph Explorer:

**Option A: Using Graph Explorer** (https://developer.microsoft.com/en-us/graph/graph-explorer)
```
GET https://graph.microsoft.com/v1.0/users/it@straightforward.email/mailFolders
```

Look for the folder with `displayName: "Inbox"` under the shared mailbox or find the specific folder for `parser@straightforward.email`.

**Option B: Using API Call**
```bash
# Get access token first, then:
curl -H "Authorization: Bearer <TOKEN>" \
  https://graph.microsoft.com/v1.0/users/it@straightforward.email/mailFolders
```

**Option C: Test endpoint**
You can also use the backend to list folders:
```bash
# Start the backend, then:
curl http://localhost:5050/api/graph/parser/fetch
# Check the error message - it might show available folders
```

### 2. Update teams.json

Once you have the folder ID, update `/api/config/teams.json`:

```json
{
  "key": "parser",
  "aliases": ["mailparser", "email-parser"],
  "displayName": "Mail Parser",
  "developmentOnly": true,
  "email": { "address": "parser@straightforward.email" },
  "graph": {
    "upn": "it@straightforward.email",
    "folderId": "YOUR_ACTUAL_FOLDER_ID_HERE",  // ← Replace this!
    "sharedMailbox": "parser@straightforward.email"
  },
  "asana": null,
  "routine": {
    "enabled": false
  }
}
```

### 3. Create the Subscription

Once the folder ID is set, create the Graph API subscription:

**Using curl:**
```bash
curl http://localhost:5050/api/graph/ensure-subscription?team=parser
```

**Using browser:**
Navigate to: `http://localhost:5050/api/graph/ensure-subscription?team=parser`

**Expected Response:**
```json
{
  "ok": true,
  "message": "Subscription ensured (single)",
  "upn": "it@straightforward.email",
  "folderId": "YOUR_FOLDER_ID"
}
```

### 4. Verify Subscription

Check that the subscription was created:

```bash
curl http://localhost:5050/api/graph/subscriptions
```

You should see a subscription for the parser mailbox with:
- `resource`: `/users('it@straightforward.email')/mailFolders('YOUR_FOLDER_ID')/messages`
- `notificationUrl`: Your webhook URL (e.g., `https://dev-api.straightmonitor.com/api/graph/webhook`)
- `clientState`: Your client state from `.env` (GRAPH_CLIENT_STATE)

---

## Testing

### Test 1: Send Email
1. Send an email to `parser@straightforward.email`
2. Wait a few seconds for webhook delivery
3. Check backend logs for: `[parser] Processing email: <messageId>`
4. Verify email is cached: `curl http://localhost:5050/api/graph/parser/emails`

### Test 2: Manual Fetch
1. Open MailParser in browser
2. Go to Configure mode
3. Click "New Template"
4. Click "Fetch Latest Email" button
5. Verify email HTML appears in the hierarchy panel

### Test 3: Cached Emails
1. Send multiple test emails to parser@straightforward.email
2. Open MailParser Configure mode
3. Click the dropdown "Or select from cache..."
4. Select a cached email
5. Verify HTML loads in the hierarchy panel

---

## API Endpoints

### Backend Routes

#### `POST /api/graph/parser/webhook`
**Purpose**: Receives Microsoft Graph notifications for new emails in parser mailbox  
**Access**: Public (called by Microsoft Graph)  
**Response**: `202 Accepted`  
**Side Effect**: Stores email HTML in `parserEmailsCache` (max 10)

#### `GET /api/graph/parser/emails`
**Purpose**: List cached parser emails  
**Query Params**: `?limit=10` (optional)  
**Response**:
```json
{
  "ok": true,
  "count": 3,
  "emails": [
    {
      "id": "AAMk...",
      "subject": "Test Application",
      "from": { "name": "John Doe", "address": "john@example.com" },
      "receivedDateTime": "2025-10-22T10:30:00Z",
      "bodyHtml": "<html>...",
      "timestamp": 1729594200000
    }
  ]
}
```

#### `GET /api/graph/parser/emails/:id`
**Purpose**: Get specific cached email by ID  
**Response**: Single email object or 404

#### `GET /api/graph/parser/fetch`
**Purpose**: Manually fetch latest email from parser mailbox  
**Response**:
```json
{
  "ok": true,
  "email": {
    "id": "AAMk...",
    "subject": "...",
    "bodyHtml": "..."
  }
}
```
**Note**: Also adds to cache automatically

---

## Troubleshooting

### Issue: "Parser folder ID not configured"
**Solution**: You haven't replaced `REPLACE_WITH_ACTUAL_FOLDER_ID` in `teams.json`. Follow Step 1 to get the folder ID.

### Issue: "No emails found"
**Possible Causes**:
1. No emails sent to parser@straightforward.email yet
2. Wrong folder ID in teams.json
3. Subscription not created
4. Webhook not receiving notifications

**Debug Steps**:
```bash
# Check if subscription exists
curl http://localhost:5050/api/graph/subscriptions

# Check cached emails
curl http://localhost:5050/api/graph/parser/emails

# Try manual fetch
curl http://localhost:5050/api/graph/parser/fetch
```

### Issue: Webhook not firing
**Possible Causes**:
1. Subscription expired or not created
2. notificationUrl not accessible from Microsoft servers
3. clientState mismatch

**Debug Steps**:
1. Verify subscription exists and is not expired
2. Check backend logs for incoming webhook calls
3. Recreate subscription: `curl http://localhost:5050/api/graph/ensure-subscription?team=parser`

### Issue: "403 Forbidden" or "401 Unauthorized"
**Possible Causes**:
1. IT user doesn't have access to shared mailbox
2. App registration missing permissions
3. Expired credentials

**Solution**:
1. Verify `it@straightforward.email` has **FullAccess** permission to `parser@straightforward.email` in Exchange
2. Verify App Registration has **Mail.Read** (application permission) in Azure AD
3. Check credentials in `.env` are current

---

## Shared Mailbox Notes

### How Shared Mailboxes Work with Graph API

Microsoft Graph doesn't have a direct "shared mailbox" endpoint. Instead:
1. You authenticate as a **user who has access** to the shared mailbox
2. You target a **specific folder ID** within that user's mailbox structure
3. The folder represents the shared mailbox's inbox

### Permissions Required

**In Exchange/Microsoft 365 Admin**:
- IT user (`it@straightforward.email`) needs **FullAccess** permission on shared mailbox (`parser@straightforward.email`)

**In Azure AD App Registration**:
- **Application Permission**: `Mail.Read` (to read emails as app)
- **Admin Consent**: Must be granted by tenant admin

### Subscription Lifecycle

Microsoft Graph subscriptions:
- **Expiration**: Max 4230 minutes (~3 days)
- **Renewal**: Backend auto-renews in `serverRoutines.js` (graph_subscriptions cron)
- **Validation**: Microsoft sends validation token on creation
- **Reauthorization**: May require periodic reauth (handled automatically)

---

## Environment Variables

Make sure these are set in `.env`:

```env
# Microsoft Graph Configuration
GRAPH_TENANT_ID=YOUR_TENANT_ID_HERE
GRAPH_CLIENT_ID=YOUR_CLIENT_ID_HERE
GRAPH_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GRAPH_NOTIFICATION_URL=https://dev-api.straightmonitor.com/api/graph/webhook
GRAPH_CLIENT_STATE=sf-secret-dev

# IT User (has access to parser shared mailbox)
EMAIL_CLIENT_ID_IT=YOUR_CLIENT_ID_HERE
EMAIL_SECRET_IT=YOUR_CLIENT_SECRET_HERE
EMAIL_AUTHORITY_IT=https://login.microsoftonline.com/YOUR_TENANT_ID_HERE
```

---

## Frontend Integration

### MailParser Component

**Location**: `frontend/Straight-Monitor/src/components/MailParser.vue`

**New Features**:
1. **Fetch Latest Email Button**: Manually pulls newest email from parser mailbox
2. **Cached Email Selector**: Dropdown to select from previously fetched emails
3. **Auto-load Cache**: Loads cached emails from backend on mount

**Usage Flow**:
```
1. User clicks "Configure" mode
2. User clicks "New Template"
3. User clicks "Fetch Latest Email" (or selects from cache)
4. Email HTML loads in hierarchy panel
5. User marks keywords and values
6. User saves template
```

### API Calls

```typescript
// Fetch latest email
await api.get('/api/graph/parser/fetch');

// Load cached emails
await api.get('/api/graph/parser/emails');

// Load specific email
await api.get(`/api/graph/parser/emails/${emailId}`);
```

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Folder ID correctly configured in `teams.json`
- [ ] Subscription created and verified
- [ ] Test emails sent and received successfully
- [ ] Webhook endpoint accessible from Microsoft servers
- [ ] Environment variables set in production
- [ ] IT user has FullAccess permission to shared mailbox
- [ ] App registration has Mail.Read permission with admin consent

### Monitoring

**Check subscription health**:
```bash
curl https://api.straightmonitor.com/api/graph/subscriptions
```

**Check cached emails**:
```bash
curl https://api.straightmonitor.com/api/graph/parser/emails
```

**Backend logs to watch**:
- `[parser] Processing email:` - Email received via webhook
- `📧 Parser email cached:` - Email stored in cache
- `🎯 Created Graph subscription:` - Subscription created/renewed

---

## Security Considerations

1. **Webhook Endpoint**: Public endpoint, but validates clientState
2. **Email Cache**: In-memory only (lost on restart), max 10 emails
3. **No Persistence**: Emails not saved to database (privacy)
4. **Access Control**: Frontend requires authentication to access
5. **Shared Mailbox**: Only IT user has access, not exposed to all teams

---

## Future Enhancements

- [ ] Real-time updates via WebSocket/SSE instead of polling
- [ ] Persistent storage for email templates
- [ ] Email attachment handling in templates
- [ ] Auto-detect template based on sender/subject patterns
- [ ] Email forwarding/actions from parsed data
- [ ] Multi-mailbox support (different parser addresses per team)

---

## Support

**Issues?**
1. Check backend logs: `npm run backend`
2. Check browser console for frontend errors
3. Verify subscription exists: `/api/graph/subscriptions`
4. Test manual fetch: `/api/graph/parser/fetch`
5. Review this guide's Troubleshooting section

**Need Help?**
Contact IT team or check Azure Portal for Graph API subscription status.
