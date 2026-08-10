# Straight Monitor - System Architecture Documentation

**Last Updated**: August 10, 2026  
**Project Type**: MEVN Stack (MongoDB, Express, Vue 3, Node.js)  
**Purpose**: Central orchestration platform for employee management, applicant tracking, work orders, and document signing across multiple teams (Berlin, Hamburg, Cologne)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Layers](#architecture-layers)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Database Models](#database-models)
6. [External Service Integrations](#external-service-integrations)
7. [Authentication & Security](#authentication--security)
8. [Data Flow Diagrams](#data-flow-diagrams)
9. [API Endpoints Summary](#api-endpoints-summary)
10. [Development Workflow](#development-workflow)
11. [Deployment & Infrastructure](#deployment--infrastructure)
12. [Key Patterns & Conventions](#key-patterns--conventions)

---

## Project Overview

### Purpose
Straight Monitor is a centralized business operations platform serving three teams across different locations. It integrates with multiple external services to:
- Manage employee data and performance (Flip integration)
- Track applicants and hiring workflows (Asana integration)
- Handle staffing/availability data (Zvoove integration)
- Enable digital document signing (DocuSeal EU Cloud)
- Manage email and file storage (Microsoft Graph)
- Maintain order/work assignment tracking
- Provide monitoring and reporting dashboards

### Key Features
- **Multi-team support** (Berlin, Hamburg, Cologne with independent configurations)
- **Applicant management** with document signing workflows
- **Work order tracking** with staff assignment
- **Real-time synchronization** with external services
- **Document storage** integration with Cloudflare R2
- **Role-based access control** (USER, ADMIN, VERTRIEB)
- **Dark mode support** with dynamic asset switching
- **Automated background jobs** for data sync and cleanup

### Tech Stack

**Frontend**:
- Vue 3 (Composition API, `<script setup>`)
- Pinia (state management)
- Vue Router (routing)
- Tailwind CSS + SCSS (styling)
- Axios (HTTP client)
- Chart.js (data visualization)
- FontAwesome (icons)

**Backend**:
- Express.js (REST API)
- Mongoose (MongoDB ODM)
- Node-cron (background job scheduling)
- Nodemailer (email delivery)
- Official SDKs (Asana, DocuSeal, Microsoft Graph)

**Infrastructure**:
- MongoDB (primary database)
- Cloudflare R2 (file storage)
- Cloudflared Tunnel (webhook exposure in dev)
- Azure/Heroku (production deployment)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
│                    (Vue 3 Single Page App)                           │
│  /frontend/Straight-Monitor/src/                                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP/REST (Axios)
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      API LAYER (Express)                            │
│              /api (Port 5050)                                       │
│  - Request routing & validation                                    │
│  - Authentication middleware                                       │
│  - Service orchestration                                           │
│  - Error handling & logging                                        │
└──────────────┬─────────────────────────────────────────────────────┘
               │
       ┌───────┼───────┬─────────────┬──────────────┐
       │       │       │             │              │
    ┌──▼──┐ ┌──▼──┐ ┌──▼──────┐ ┌──▼──┐ ┌────────▼──┐
    │ DB  │ │ R2  │ │Services │ │Auth │ │Background │
    │     │ │     │ │  Layer  │ │     │ │  Jobs     │
└────┴─────┴─────────┴─────────┴──────┴─────────────┘

External Systems:
  • Flip (Employee App)
  • Asana (Project Management)
  • Zvoove (Staffing/HR)
  • DocuSeal (Document Signing)
  • Microsoft Graph (Email/OneDrive)
  • Cloudflare R2 (File Storage)
```

---

## Frontend Architecture

### Directory Structure

```
frontend/Straight-Monitor/
├── src/
│   ├── main.js                    # Vue app initialization
│   ├── App.vue                    # Root component
│   ├── assets/                    # Static images, icons, styles
│   │   ├── styles/
│   │   │   ├── main.scss          # Global SCSS variables
│   │   │   └── global.scss        # Auto-injected into all components
│   │   └── *.png, *-dark.png      # Icons with dark variants
│   │
│   ├── components/                # 80+ Vue 3 SFC components
│   │   ├── HomeLogin.vue          # Login page
│   │   ├── Dashboard.vue          # Main dashboard
│   │   ├── Personal/
│   │   │   ├── PeopleDocsModern.vue  # Employee list
│   │   │   └── EmployeeCard.vue      # Employee details
│   │   ├── Auftraege/
│   │   │   ├── AuftraegePage.vue     # Work orders
│   │   │   └── AuftragDetail.vue     # Order details
│   │   ├── Bewerber/
│   │   │   ├── BewerberCreate.vue    # New applicant
│   │   │   └── BewerberCard.vue      # Applicant details
│   │   ├── PDF/
│   │   │   ├── PdfBuilder.vue        # PDF template editor
│   │   │   ├── PdfFormFill.vue       # PDF form completion
│   │   │   └── PdfVorgaenge.vue      # Signature workflow
│   │   ├── Signaturen/
│   │   │   ├── SignaturenPage.vue    # Signature documents
│   │   │   └── SignaturCard.vue      # Document details
│   │   ├── DatenImport.vue        # Excel file import (Zvoove)
│   │   ├── HeaderBar.vue          # Navigation header
│   │   └── Common/
│   │       ├── FilterChip.vue     # Toggle/filter component
│   │       ├── SearchBar.vue      # Search input
│   │       └── ContextMenu.vue    # Right-click menu
│   │
│   ├── composables/               # Reusable composition functions
│   │   └── useTheme.js            # Dark mode toggle
│   │
│   ├── router/
│   │   └── index.js               # Route definitions (50+ routes)
│   │                              # Auth guards, role-based access
│   │
│   ├── stores/                    # Pinia state management
│   │   ├── auth.js                # User, token, watchlist
│   │   ├── theme.js               # Dark mode, colors
│   │   ├── ui.js                  # Modals, notifications
│   │   ├── dataCache.js           # IndexedDB caching
│   │   ├── signaturBuilder.js     # PDF template editor state
│   │   ├── dashboardPrefs.js      # Widget preferences
│   │   └── flipAll.ts             # Flip integration data
│   │
│   ├── types/                     # TypeScript definitions
│   │   └── *.ts                   # Component/API types
│   │
│   ├── utils/
│   │   ├── api.js                 # Axios instance (auth headers)
│   │   ├── api-public.js          # Public endpoints
│   │   ├── flipApi.ts             # Flip Bridge SDK wrapper
│   │   └── helpers.js             # Utility functions
│   │
│   └── layouts/                   # Page layout templates
│       ├── MainLayout.vue         # Authenticated layout
│       └── PublicLayout.vue       # Public layout
│
├── public/                        # Static assets served as-is
├── vite.config.js                 # Build config, API proxy
├── package.json                   # Dependencies
└── .env / .env.production         # Configuration
```

### Routing Structure

**Public Routes**:
- `/` — Login page (HomeLogin.vue)
- `/email-bestaetigung` — Email confirmation
- `/api/public/bewerber/:token` — Public applicant form link

**Authenticated Routes** (under `MainLayout`):
- `/dashboard` — Overview dashboard
- `/personal` — Employee management (PeopleDocsModern, EmployeeCard)
- `/auftraege` — Work orders (AuftraegePage)
- `/kunden` — Customer management
- `/bewerber` — Applicant management
- `/dispo` — Staffing/scheduling
- `/pdf-vorlagen` — PDF template builder
- `/pdf-ausfuellen/:id` — PDF form completion
- `/signaturen` — Digital signature documents

**Admin Routes**:
- `/benutzer-verwaltung` — User management (ADMIN only)
- `/mailbox-explorer` — Mailbox viewer (ADMIN only)
- `/onedrive-explorer` — OneDrive browser (ADMIN only)

**Role-Based Access** (router guards):
```
requiresAuth: true       → Must be logged in
roles: ['ADMIN']         → Must have ADMIN role
roles: ['VERTRIEB']      → Must have VERTRIEB (sales) role
```

### Key Components by Domain

| Domain | Components | Purpose |
|--------|-----------|---------|
| **Auth** | HomeLogin | User login page |
| **Dashboard** | Dashboard, Widgets | Overview, KPIs, recent activity |
| **Employees** | PeopleDocsModern, EmployeeCard | Employee list, profiles, documents |
| **Applicants** | BewerberCreate, BewerberCard, BewerberManagementTab | Hiring workflow, document uploads |
| **Work Orders** | AuftraegePage, AuftragDetail | Assignment tracking, staff scheduling |
| **Document Signing** | PdfBuilder, PdfFormFill, SignaturenPage | PDF template creation, form filling, signature tracking |
| **Data Import** | DatenImport | Excel parsing for Zvoove data |
| **Integration** | FlipCreate, FlipProfile, FlipActions | Flip-specific UI and workflows |
| **Navigation** | HeaderBar, FilterPanel, SearchBar | Common UI elements |

### State Management (Pinia Stores)

**auth.js** — User and authentication state
```javascript
State:
  • user: { id, email, roles[], mitarbeiter, kundenWatchlist }
  • token: JWT from login
  • isLoggedIn: boolean

Actions:
  • login(email, password)
  • logout()
  • refreshToken()
  • updateWatchlist(kundeId)
```

**theme.js** — Dark mode and styling
```javascript
State:
  • isDark: boolean
  • primaryColor, accentColor

Actions:
  • toggleDarkMode()
  • setColor(name, value)
```

**ui.js** — Global UI state
```javascript
State:
  • modals: { [key]: { open, data } }
  • notifications: []

Actions:
  • openModal(key, data)
  • closeModal(key)
  • addNotification(message, type)
```

**dataCache.js** — IndexedDB caching for large datasets
```javascript
Purpose:
  • Cache mitarbeiters, locations, customers for offline access
  • Reduce API calls on frequently accessed data

Methods:
  • getCached(key)
  • setCached(key, data)
  • clearCache()
```

### API Client Configuration

**Axios Instance** (`utils/api.js`):
```javascript
baseURL: process.env.VITE_API_BASE_URL  // http://localhost:5050 (dev)

Request Interceptor:
  • Adds x-auth-token header with JWT from localStorage
  • Attaches user context

Response Interceptor:
  • 401 errors → redirect to login
  • Error handling & logging
```

**API Proxy** (vite.config.js):
```javascript
/api → http://localhost:5050
Timeout: 10 minutes (large Excel imports)
```

### Styling Architecture

**CSS Framework**: Tailwind CSS + SCSS  
**Auto-Import**: Global SCSS injected into all components via Vite config

**SCSS Variables** (src/assets/styles/main.scss):
```scss
$primary: #FF8C42           // Orange
$secondary: #282C34         // Dark gray
$success: #4CAF50
$danger: #dc3545
$lightness: #f5f5f5

// Deprecated: DO NOT use darken()
// ✅ Use instead:
color.adjust($color, $lightness: -10%)
color.scale($color, $lightness: -18%)
```

**Dark Mode Icons**:
- Light variants: `icon.png`
- Dark variants: `icon-dark.png`
- Switch via computed ref:
  ```javascript
  const imgIcon = computed(() => 
    useTheme().isDark ? darkImg : lightImg
  );
  ```

---

## Backend Architecture

### Directory Structure

```
api/
├── app.js                         # Express server entry point
├── package.json                   # Node 22, npm 10
├── .env                           # Environment config (secrets)
├── serverRoutines.js              # Cron job definitions
│
├── config/
│   ├── registry.js                # Team configuration registry
│   ├── flipRanks.js               # Flip rank mappings
│   └── teams.json                 # Team metadata
│
├── middleware/
│   ├── auth.js                    # JWT verification
│   ├── publicAuth.js              # Public endpoint auth
│   ├── AsyncHandler.js            # Async error wrapper
│   └── ErrorHandler.js            # Global error handler
│
├── models/                        # Mongoose schemas (40+ models)
│   ├── Mitarbeiter.js             # Employee
│   ├── User.js                    # App user
│   ├── Bewerber.js                # Applicant
│   ├── Auftrag.js                 # Work order
│   ├── Kunde.js                   # Customer
│   ├── Location.js                # Office location
│   ├── SignaturVorgang.js         # Signature workflow
│   ├── DocuSealVorgang.js         # DocuSeal submission
│   ├── PdfTemplate.js             # PDF form template
│   ├── PdfVorgang.js              # PDF form instance
│   ├── ImportLog.js               # Data import audit trail
│   ├── DispoEintrag.js            # Disposition entry
│   └── [30+ other schemas]
│
├── routes/                        # API endpoint definitions (34 files)
│   ├── userRoutes.js              # Auth, profile, preferences
│   ├── mitarbeiterRoutes.js       # Employee CRUD
│   ├── bewerberRoutes.js          # Applicant CRUD
│   ├── auftraegeRoutes.js         # Work order CRUD
│   ├── kundenRoutes.js            # Customer CRUD
│   ├── itemRoutes.js              # Inventory management
│   ├── flipUserFixRoutes.js       # Flip user sync
│   ├── flipTaskRoutes.js          # Flip task creation
│   ├── asanaRoutes.js             # Asana sync endpoints
│   ├── zvooveRoutes.js            # Zvoove import/sync
│   ├── docusealRoutes.js          # DocuSeal submissions
│   ├── graphRoutes.js             # Microsoft Graph (email, OneDrive)
│   ├── pdfTemplateRoutes.js       # PDF template CRUD
│   ├── signaturRoutes.js          # Signature document management
│   ├── dispoRoutes.js             # Scheduling/disposition
│   ├── publicRoutes.js            # Public integration endpoints
│   └── [18+ other route files]
│
├── services/                      # Integration services (deprecated directory)
│
├── *Service.js                    # Top-level integration services
│   ├── FlipService.js             # Flip API integration
│   ├── AsanaService.js            # Asana API integration
│   ├── ZvooveService.js           # Zvoove API integration
│   ├── DocuSealService.js         # DocuSeal signing service
│   ├── GraphService.js            # Microsoft Graph API
│   ├── EmailService.js            # Email delivery
│   ├── BewerberInvitationService.js   # Applicant invitations
│   ├── ApplicantMailRetentionService.js # GDPR cleanup
│   ├── KundenWatchlistReportService.js  # Monthly reports
│   ├── StundenlisteService.js     # Timesheet service
│   └── R2Service.js               # Cloudflare R2 storage
│
├── flipAxios.js                   # Flip API axios instance + token refresh
│
├── utils/
│   ├── logger.js                  # Structured logging
│   ├── encryption.js              # Data encryption/decryption
│   ├── pdfRender.js               # PDF rendering helper
│   └── signaturR2Path.js          # R2 storage path builder
│
└── assets/                        # Static files (if any)
```

### Express Server Setup (app.js)

**Initialization**:
1. Load environment variables
2. Connect to MongoDB (with auto-migration)
3. Test R2 connection
4. Initialize all route handlers
5. Start listening on port 5050

**Middleware Stack** (in order):
```javascript
1. URL normalization (double-slash fix)
2. Express JSON/URL parsers (10MB limit)
3. Raw body preservation (webhook signature verification)
4. CORS configuration (domain + IP allowlisting)
5. Request/response logging
6. Route handlers
7. Global error handler
```

**CORS Allowlist**:
- **Domains**: localhost:5173 (dev), straightmonitor.com, production URLs
- **IP Ranges**: 5.39.7.128–5.39.7.143 (external webhooks), Azure IPs
- **Headers**: x-auth-token (JWT), Content-Type

**Environment Variables**:
```
# Database
MONGO_URI=mongodb+srv://...

# Authentication
JWT_SECRET=...
BCRYPT_ROUNDS=10

# Services
FLIP_ORG_ID_BERLIN=...
FLIP_API_TOKEN_BERLIN=...
ASANA_PAT=...
ZVOOVE_API_KEY=...
DOCUSEAL_API_TOKEN=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
GRAPH_TENANT_ID=...

# Email
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Server
PORT=5050
NODE_ENV=development|production
CRON_PAUSED=false
ENABLE_ROUTINES=flip_token,flipUserRoutine
DISABLE_ROUTINES=
```

### Middleware Details

**auth.js** — Verify JWT and extract user:
```javascript
// Applied to all protected routes
router.use(auth);  // or router.get("/", auth, handler)

// Inside middleware:
// 1. Extract token from x-auth-token header
// 2. Verify signature against JWT_SECRET
// 3. Decode and extract user ID from payload
// 4. Set req.user = { id, ... }
// 5. If invalid/missing → 401 Unauthorized
```

**publicAuth.js** — Allow public endpoints:
```javascript
// Applied to public routes
router.use(publicAuth);  // No JWT required
// May accept token from URL param for email verification
```

**AsyncHandler.js** — Wrap async route handlers:
```javascript
// Converts this:
router.get("/", async (req, res) => {
  const item = await Item.findById(req.params.id);  // If error → unhandled!
  res.json(item);
});

// To this (automatic try-catch):
router.get("/", asyncHandler(async (req, res) => {
  const item = await Item.findById(req.params.id);
  res.json(item);
}));
// Errors caught and passed to ErrorHandler
```

**ErrorHandler.js** — Global error handler:
```javascript
// Catches all route errors
// Logs: request method, URL, error message, stack trace
// Responds: 500 JSON with error details (dev) or generic (prod)
```

### Route Organization

**Pattern**: `/api/{resource}/{action}`

| Prefix | File | Endpoints | Purpose |
|--------|------|-----------|---------|
| `/api/users` | userRoutes.js | POST login, GET profile, PUT preferences | Authentication |
| `/api/personal` | mitarbeiterRoutes.js | GET/POST/PUT/DELETE Mitarbeiter | Employee management |
| `/api/bewerber` | bewerberRoutes.js | GET/POST/PUT/DELETE Bewerber | Applicant management |
| `/api/auftraege` | auftraegeRoutes.js | GET/POST/PUT/DELETE Auftrag | Work order tracking |
| `/api/kunden` | kundenRoutes.js | GET/POST/PUT/DELETE Kunde | Customer management |
| `/api/items` | itemRoutes.js | GET/POST/PUT/DELETE Item | Inventory tracking |
| `/api/flip-users` | flipUserFixRoutes.js | GET/POST Flip user sync | Flip employee sync |
| `/api/flip-tasks` | flipTaskRoutes.js | POST task creation in Flip | Task automation |
| `/api/asana/*` | asanaRoutes.js | GET/POST/PUT Asana data | Asana integration |
| `/api/zvoove/*` | zvooveRoutes.js | GET/POST Zvoove sync | Staffing import |
| `/api/docuseal/*` | docusealRoutes.js | GET/POST signature requests | Document signing |
| `/api/graph/*` | graphRoutes.js | GET email, OneDrive; DELETE messages | Microsoft Graph |
| `/api/pdf-templates` | pdfTemplateRoutes.js | GET/POST/PUT/DELETE PDF templates | PDF builder |
| `/api/pdf-vorgaenge` | pdfVorgangRoutes.js | GET/POST PDF instances | Form completion tracking |
| `/api/signaturen` | signaturRoutes.js | GET/POST signature documents | R2 document management |
| `/api/dispo` | dispoRoutes.js | GET/POST disposition entries | Scheduling |
| `/api/import/*` | dataImportRoutes.js | POST Excel import | Data import |
| `/api/public/*` | publicRoutes.js | GET public data | Public integration |

### Services Layer (Integration Handlers)

**FlipService.js** — Flip Employee App
```javascript
Key Methods:
  • getFlipUsers() → Fetch users from Flip
  • createFlipTask() → Create task in Flip
  • getFlipFiles() → Retrieve documents
  • flipUserRoutine() → Scheduled sync (6h interval)
  
Auth: OAuth 2.0 token refresh via flipAxios.js
Data Sync: Flip users → Mitarbeiter collection (email matching)
```

**AsanaService.js** — Asana Project Management
```javascript
Key Methods:
  • getAsanaTasks() → List tasks
  • createAsanaTask() → Create task
  • updateAsanaTask() → Update task/notes
  • addAsanaStory() → Add comment
  
Auth: Personal Access Token (ASANA_PAT env var)
Rate Limiting: Queue (max 15 concurrent)
Data Sync: Asana tasks → Bewerber (applicants)
```

**ZvooveService.js** — Zvoove HR/Staffing
```javascript
Key Methods:
  • getZvooveCompanies() → List staffing data
  • getZvooveAvailability() → Employee availability
  • parseExcelImport() → Excel file parsing
  
Auth: Bearer token (ZVOOVE_API_KEY)
Data Flow: Excel upload → parsing → Mitarbeiter matching
```

**DocuSealService.js** — DocuSeal Document Signing
```javascript
Key Methods:
  • getDocuSealTemplates() → Available templates
  • createSubmission() → Create signature request
  • getSubmissionStatus() → Check completion
  
Auth: API token (DOCUSEAL_API_TOKEN)
Workflow: Admin creates template → App requests signatures → PDF signed
Storage: Signed PDFs stored in R2
```

**GraphService.js** — Microsoft Graph API
```javascript
Key Methods:
  • getMailboxMessages() → Retrieve emails
  • deleteMessage() → Delete by ID (GDPR)
  • createSubscription() → Webhook subscription
  • renewSubscriptions() → Hourly renewal
  
Auth: OAuth 2.0 Client Credentials
Use Cases:
  • Email retrieval for applicants
  • GDPR mail cleanup (monthly)
  • OneDrive file browser
  • Calendar sync
```

**BewerberInvitationService.js** — Applicant Workflow
```javascript
Workflow:
  1. Admin creates bewerber (applicant) record
  2. Generate invitation link (JWT token)
  3. Send email with form + signing link
  4. Applicant fills form + signs document (DocuSeal)
  5. Backend retrieves signed PDF from DocuSeal
  6. Store in R2 + database
  7. Archive email (GDPR)
```

**R2Service.js** — Cloudflare R2 File Storage
```javascript
Use Cases:
  • Signature document storage
  • Profile pictures
  • Contract PDFs
  • Applicant attachments
  
Methods:
  • uploadFile(key, data) → Store in R2
  • downloadFile(key) → Retrieve from R2
  • deleteFile(key) → Remove from R2
```

### Background Jobs (serverRoutines.js)

**Node-cron Schedule**:

| Routine | Schedule | Purpose | Env Control |
|---------|----------|---------|-------------|
| flip_token | 00:00 daily | Refresh Flip API token | ENABLE_ROUTINES |
| flipUserRoutine | Every 6h | Sync Flip users → Mitarbeiter | (conditional) |
| bewerberRoutine | Every 4h | Sync Asana tasks → Bewerber | (conditional) |
| syncCompanies | Every 24h | Sync Zvoove availability | (conditional) |
| applicantMailCleanup | Monthly (Jan, Jul) | Delete old applicant emails (GDPR) | (conditional) |
| watchlistReports | Monthly | Send customer reports to users | (conditional) |
| graphSubscriptions | Hourly | Renew Microsoft Graph webhooks | (conditional) |

**Environment Controls**:
```
CRON_PAUSED=true              # Pause all routines
ENABLE_ROUTINES=flip_token,flipUserRoutine  # Explicit enable list
DISABLE_ROUTINES=syncCompanies              # Disable specific routines
NODE_ENV=production           # Runs by default (unless disabled)
```

---

## Database Models

### Core Entity Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER (App User)                        │
│  ├─ email (unique)                                          │
│  ├─ password (bcrypt hashed)                                │
│  ├─ roles: ['USER', 'ADMIN', 'VERTRIEB']                    │
│  ├─ mitarbeiter: Ref to Mitarbeiter (1:1)                   │
│  └─ kundenWatchlist: [Kunde IDs] (N:M)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
          1:1 Link     │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  MITARBEITER (Employee)                     │
│  ├─ flip_id (Flip app ID)                                   │
│  ├─ asana_id (Asana user ID)                                │
│  ├─ personalnr (primary personnel number)                   │
│  ├─ personalnummern: [] (all active numbers)                │
│  ├─ email (unique)                                          │
│  ├─ berufe: [Beruf IDs] (job titles)                        │
│  ├─ qualifikationen: [Qualifikation IDs] (skills)           │
│  ├─ locationV2: Ref to Location                             │
│  ├─ signaturOrdner: R2 folder name                          │
│  ├─ documents: [{ name, link, category }]                   │
│  └─ metadata: { hire_date, status, manager }                │
└──────────────────────┬────────────────────────────────────┬─┘
                       │                                    │
           1:N Links   │                  1:M Link          │
                       ▼                                    ▼
        ┌────────────────────┐                 ┌──────────────────────┐
        │ AUFTRAG            │                 │ EINSATZ              │
        │ (Work Order)       │                 │ (Assignment)         │
        ├─ kunde: Ref        │◄────────────────┤─ mitarbeiter: Ref    │
        ├─ location: Ref     │                 ├─ auftrag: Ref        │
        ├─ startDate         │                 ├─ role               │
        ├─ endDate           │                 └─ status             │
        ├─ assignedStaff[]   │
        └─ status            │
        └────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                BEWERBER (Applicant)                         │
│  ├─ asana_id (linked Asana task, unique)                    │
│  ├─ teamKey: 'berlin'|'hamburg'|'koeln'                     │
│  ├─ vorname, nachname, email (required)                     │
│  ├─ telefon, adresse                                        │
│  ├─ dokumente: [{ name, key, contentType, category }]       │
│  ├─ einladungen: [{                                         │
│  │   docuSealId, type, status, sentAt, signedAt             │
│  │ }]                                                       │
│  ├─ importLog: Ref to ImportLog                             │
│  ├─ status: 'neu'|'verarbeitet'|'eingestellt'|'abgelehnt'  │
│  └─ created_at, updated_at                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
         N:1 Link      │
                       ▼
        ┌────────────────────┐
        │ IMPORTLOG          │
        │ (Audit Trail)      │
        ├─ source: 'zvoove'  │
        ├─ filename          │
        ├─ imported_at       │
        └─ record_count      │
        └────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            SIGNATURVORGANG (Signature Workflow)             │
│  ├─ mitarbeiter: Ref (who signs)                            │
│  ├─ dokumentTyp: 'arbeitsvertrag'|'nda'|...                │
│  ├─ r2Key: Path in R2 storage                               │
│  ├─ status: 'pending'|'signed'|'rejected'                   │
│  ├─ signierer: [{                                           │
│  │   name, email, signed_at                                 │
│  │ }]                                                       │
│  └─ created_at, updated_at                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         DOCUSEALVORGANG (DocuSeal Submission)               │
│  ├─ bewerber: Ref (applicant)                               │
│  ├─ docuSealId: External submission ID                      │
│  ├─ templateId: DocuSeal template ID                        │
│  ├─ prefillData: { name, email, ... }                       │
│  ├─ status: 'pending'|'completed'|'declined'                │
│  ├─ signers: [{ email, role, signed_at }]                   │
│  ├─ signedPdfUrl: Download link                             │
│  └─ created_at, updated_at                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│            LOCATION (Office Location)                       │
│  ├─ name: 'Berlin'|'Hamburg'|'Cologne'                      │
│  ├─ nameFull: Full address                                  │
│  ├─ teamKey: 'berlin'|'hamburg'|'koeln'                     │
│  ├─ coordinates: { lat, lng }                               │
│  └─ metadata: { phone, manager, capacity }                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│             KUNDE (Customer)                                │
│  ├─ name (unique)                                           │
│  ├─ type: 'einzelperson'|'unternehmen'|...                 │
│  ├─ email, telefon                                          │
│  ├─ adresse                                                 │
│  ├─ status: 'aktiv'|'inaktiv'|'archiviert'                 │
│  └─ contacts: [{ name, email, role }]                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Model Details

**Mitarbeiter** (Employee):
```javascript
{
  flip_id: String (unique),
  asana_id: String (unique),
  personalnr: String (primary),
  personalnummern: [String] (all active),
  email: String (unique),
  vorname: String,
  nachname: String,
  berufe: [ObjectId] → Beruf,
  qualifikationen: [ObjectId] → Qualifikation,
  locationV2: ObjectId → Location,
  signaturOrdner: String,  // R2 folder
  dokumente: [{
    name: String,
    link: String (R2 URL),
    category: String ('lebenslauf', 'zeugnisse', etc.)
  }],
  metadata: {
    hire_date: Date,
    status: String ('aktiv', 'urlaub', 'gekündigt'),
    manager: String,
    notes: String
  },
  created_at: Date,
  updated_at: Date
}
```

**User** (App User):
```javascript
{
  email: String (unique),
  password: String (bcrypt hashed),
  roles: [String] ('USER', 'ADMIN', 'VERTRIEB'),
  mitarbeiter: ObjectId → Mitarbeiter (optional 1:1),
  kundenWatchlist: [ObjectId] → Kunde,
  dashboardPrefs: {
    widgets: [{ type, position, visible }],
    theme: 'light'|'dark'
  },
  lastLogin: Date,
  created_at: Date,
  updated_at: Date
}
```

**Bewerber** (Applicant):
```javascript
{
  asana_id: String (unique, linked Asana task),
  teamKey: String ('berlin', 'hamburg', 'koeln'),
  vorname: String (required),
  nachname: String (required),
  email: String (required),
  telefon: String,
  adresse: String,
  dokumente: [{
    name: String,
    key: String (R2 storage key),
    contentType: String ('application/pdf', etc.),
    category: String ('lebenslauf', 'zeugnisse', etc.),
    uploadedAt: Date
  }],
  einladungen: [{  // Contract/appointment invitations
    docuSealId: String (external ID),
    type: String ('arbeitsvertrag', 'nda', 'angebot'),
    status: String ('pending', 'signed', 'declined'),
    sentAt: Date,
    signedAt: Date,
    signedPdfUrl: String
  }],
  importLog: ObjectId → ImportLog,
  status: String ('neu', 'verarbeitet', 'eingestellt', 'abgelehnt'),
  created_at: Date,
  updated_at: Date
}
```

**Auftrag** (Work Order):
```javascript
{
  kunde: ObjectId → Kunde (required),
  location: ObjectId → Location (required),
  startDate: Date,
  endDate: Date,
  titel: String,
  beschreibung: String,
  assignedStaff: [ObjectId] → Mitarbeiter,
  status: String ('geplant', 'aktiv', 'abgeschlossen', 'storniert'),
  budget: Number,
  rate: Number (per hour/day),
  created_at: Date,
  updated_at: Date
}
```

---

## External Service Integrations

### Service Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Straight Monitor                            │
│                   (MEVN Application)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬─────────────┐
          │                │                │             │
          ▼                ▼                ▼             ▼
    ┌──────────┐   ┌─────────────┐   ┌─────────┐   ┌──────────┐
    │   Flip   │   │    Asana    │   │ Zvoove  │   │DocuSeal  │
    │ (Emp)    │   │(Projects)   │   │(Staffing)   │(Signing) │
    └──────────┘   └─────────────┘   └─────────┘   └──────────┘
          │                │                │             │
          │   OAuth 2.0    │  PAT Token    │ Bearer      │ API Token
          │                │                │             │
          ▼                ▼                ▼             ▼
    ┌──────────────────────────────────────────────────────────┐
    │              External Service APIs                       │
    └──────────────────────────────────────────────────────────┘

    Additionally:
    • Microsoft Graph (Email, OneDrive, Calendar)
    • Cloudflare R2 (File Storage)
    • Nodemailer (Email Delivery)
    • MongoDB (Primary Database)
```

### Flip Integration

**Service**: [FlipService.js](api/FlipService.js)  
**Auth Type**: OAuth 2.0  
**Token Management**: Stored in `.env`, auto-refresh via [flipAxios.js](api/flipAxios.js)

**Key Operations**:
1. **User Sync** (`flipUserRoutine` — every 6h)
   - GET `/api/flip-users` from Flip API
   - Match email to Mitarbeiter records
   - Update names, phone, departments

2. **Task Creation** (`FlipService.createFlipTask()`)
   - POST task to Flip API
   - Trigger workflows in Flip app
   - Include links to applicant/order data

3. **Document Retrieval** (`FlipService.getFlipFiles()`)
   - Retrieve Laufzettel (shift sheets)
   - Retrieve EventReports (event evaluation)
   - Retrieve EvaluierungMA (employee evaluations)
   - Store metadata in database

4. **Calendar Sync**
   - Retrieve shift calendar from Flip
   - Update availability/scheduling

**Data Flow**:
```
Flip (external) ──(OAuth)──> FlipService.js ──(transform)──> Mitarbeiter collection
                                                              ├─ names, emails
                                                              ├─ departments
                                                              └─ documents (Laufzettel)
```

**Error Handling**:
- Token refresh on 401
- Retry with exponential backoff on rate limit
- Logging via utils/logger.js

### Asana Integration

**Service**: [AsanaService.js](api/AsanaService.js)  
**Auth Type**: Personal Access Token (PAT)  
**SDK**: Official `asana` npm package  

**Key Operations**:
1. **Task Listing** (`asanaRoutes.js → GET /api/asana/tasks`)
   - List all tasks in configured project
   - Filter by section (applicants, tasks, etc.)

2. **Task Creation** (`asanaRoutes.js → POST /api/asana/tasks`)
   - Create task for new applicant
   - Auto-populate fields (name, email, location)
   - Attach subtasks for workflow steps

3. **Task Update** (`asanaRoutes.js → PUT /api/asana/tasks/:id`)
   - Update task status (geplant → aktiv → abgeschlossen)
   - Add HTML-formatted notes
   - Attach file URLs

4. **Comment Addition** (`asanaRoutes.js → POST /api/asana/tasks/:id/stories`)
   - Post updates to Asana task
   - Notify team members of changes

5. **Applicant Sync** (`bewerberRoutine` — every 4h)
   - Poll Asana project for new/updated tasks
   - Create/update Bewerber records
   - Track status changes

**Rate Limiting**:
- Queue-based: max 15 concurrent requests
- Re-queue on HTTP 429 (too many requests)
- Implemented in AsanaService.js

**Data Flow**:
```
Asana Project ──(API)──> AsanaService.js ──(transform)──> Bewerber collection
  (sections)            Queue (max 15)                  ├─ asana_id
  (tasks)                                              ├─ name, email
  (stories)                                            ├─ status
                                                       └─ comments
```

### Zvoove Integration

**Service**: [ZvooveService.js](api/ZvooveService.js)  
**Base URL**: `https://api.zvoove.cloud/temp-staffing-de`  
**Auth Type**: Bearer Token  

**Key Operations**:
1. **Company Listing** (`GET /api/zvoove/companies`)
   - List staffing companies
   - Retrieve employee roster

2. **Availability Sync** (`syncCompanies` — every 24h)
   - Poll Zvoove for availability updates
   - Update Mitarbeiter availability fields

3. **Excel Import** (`POST /api/import/zvoove`)
   - Parse uploaded Excel file (DatenImport.vue)
   - Match columns to Mitarbeiter records
   - Create/update availability records
   - Log import in ImportLog collection

**Data Flow**:
```
Zvoove API ──(Bearer)──> ZvooveService.js ──(Excel parse)──> ImportLog
                                              (match)        Mitarbeiter
                                                            (availability)
```

### DocuSeal Integration

**Service**: [DocuSealService.js](api/DocuSealService.js)  
**SDK**: Official `@docuseal/api` npm package  
**Base URL**: `https://api.docuseal.eu` (EU Cloud)  
**Auth Type**: API Token  

**Workflow**:
```
1. Admin creates template in DocuSeal dashboard
   ├─ Document upload (PDF)
   ├─ Define signature fields
   └─ Configure roles (signer, viewer)

2. App fetches templates
   └─ GET /api/docuseal/templates

3. Applicant invited via email (BewerberInvitationService)
   ├─ Generate JWT invitation token
   ├─ Send email with link + DocuSeal form
   └─ Link opens /api/public/bewerber/:token

4. Applicant fills form + signs
   └─ DocuSeal handles signature UI

5. Submission completed
   ├─ Webhook notification (if configured)
   ├─ Or polling: GET /api/docuseal/submissions/:id
   └─ Retrieve signed PDF

6. Backend stores PDF
   ├─ Upload to R2 (DocuSealService.uploadSignedPdf())
   ├─ Update Bewerber.einladungen[].signedPdfUrl
   └─ Archive applicant email (Graph API)

7. User views signed document
   └─ Frontend displays R2-hosted PDF
```

**Key Endpoints**:
- `GET /api/docuseal/templates` — List templates
- `POST /api/docuseal/submissions` — Create new submission
- `GET /api/docuseal/submissions/:id` — Check status
- `GET /api/docuseal/submissions/:id/download` — Download signed PDF

**Data Flow**:
```
DocuSeal ──(API)──> DocuSealService.js ──(persist)──> DocuSealVorgang
  (template)        (create submission)               (submission tracking)
  (signing)         (retrieve status)
  (signed PDF)      (download PDF)

                                         └──(store)──> R2 (file storage)
                                         └──(link)──> Bewerber.einladungen[]
```

### Microsoft Graph Integration

**Service**: [GraphService.js](api/GraphService.js)  
**Auth Type**: OAuth 2.0 Client Credentials  
**Base URL**: `https://graph.microsoft.com/v1.0`  

**Key Operations**:
1. **Mailbox Management** (`graphRoutes.js`)
   - GET `/api/graph/users/:upn/messages` — Retrieve emails
   - DELETE `/api/graph/users/:upn/messages/:id` — Delete by ID

2. **GDPR Cleanup** (`applicantMailCleanup` routine — monthly)
   - Query mailbox for applicant-related emails
   - Delete messages older than retention period
   - Archive to folder (optional)

3. **Subscription Management** (`graphSubscriptions` routine — hourly)
   - CREATE webhook subscriptions (email, calendar, OneDrive)
   - Store in `.graph-subscription.json` (local file)
   - Auto-renew expiring subscriptions

4. **OneDrive Access** (`graphRoutes.js`)
   - GET `/api/graph/me/drive/root/children` — List files
   - Browse user's OneDrive (admin view)

**Multi-Team Support**:
- Separate mailbox UPN per team (Berlin, Hamburg, Cologne)
- Separate archive folder ID per team
- Configured in `config/registry.js`

**Data Flow**:
```
Microsoft Graph ──(OAuth)──> GraphService.js ──(delete)──> Mailbox (GDPR)
  (mailbox)                    (query)                    (archive if configured)
  (subscriptions)              (subscribe)
  (OneDrive)                   (browse)
```

### R2 Storage Integration

**Service**: [R2Service.js](api/R2Service.js)  
**Provider**: Cloudflare R2 (S3-compatible)  
**SDK**: AWS SDK v3  

**Use Cases**:
1. **Signature Documents**
   - Employee signature folder: `mitarbeiter/{personalnr}/signaturen/`
   - Store signed PDFs

2. **Applicant Documents**
   - Folder: `bewerber/{asana_id}/dokumente/`
   - Store CV, certificates, cover letters

3. **Signed Contracts**
   - Folder: `bewerber/{asana_id}/vertraege/`
   - Store DocuSeal-signed PDFs

4. **Profile Pictures**
   - Folder: `profile-pictures/`
   - Fallback when Flip photo unavailable

**API Methods**:
```javascript
uploadFile(key, buffer, contentType)  // Put object
downloadFile(key)                     // Get object (returns stream)
deleteFile(key)                       // Delete object
listFiles(prefix)                     // List objects by prefix
getPublicUrl(key)                     // Generate public HTTPS URL
```

**Data Flow**:
```
Frontend (file upload) ──> Backend (R2Service) ──(S3)──> Cloudflare R2
                                                         (storage bucket)
                           └──(persist URL)──> Bewerber/Mitarbeiter
```

---

## Authentication & Security

### JWT Authentication Flow

**Login Process**:
```
1. User submits email + password (HomeLogin.vue)
   └─> POST /api/users/login { email, password }

2. Backend validates
   ├─ Find User by email
   ├─ Hash submitted password with bcryptjs
   ├─ Compare with stored hash
   └─ If match:
       └─ Generate JWT: { sub: userId, iat, exp }
       └─ Sign with JWT_SECRET
       └─ Return token to frontend

3. Frontend stores token
   └─ localStorage.setItem('token', jwt)

4. Subsequent requests
   ├─ Frontend adds header: x-auth-token: <jwt>
   ├─ Backend middleware (auth.js) verifies signature
   ├─ Extract userId from payload
   ├─ Attach to req.user
   └─ Grant access to protected route

5. Logout
   └─ Frontend: localStorage.removeItem('token')
```

**JWT Payload** (example):
```json
{
  "sub": "507f1f77bcf86cd799439011",  // User ID
  "iat": 1692374400,                  // Issued at
  "exp": 1692460800                   // Expires (24h)
}
```

### Middleware Authorization

**Protected Routes** (default):
```javascript
// app.js
router.use(auth);  // All routes below require JWT

// Route handler
router.get("/api/personal", asyncHandler(async (req, res) => {
  // req.user is populated by auth middleware
  const mitarbeiters = await Mitarbeiter.find();
  res.json(mitarbeiters);
}));
```

**Public Routes**:
```javascript
// Endpoint allows unauthenticated access
router.get("/api/public/bewerber/:token", publicAuth, asyncHandler(async (req, res) => {
  // Verify token from URL param (not header)
  const bewerber = await Bewerber.findOne({ invitationToken: req.params.token });
  res.json(bewerber);
}));
```

**Role-Based Access** (frontend router):
```javascript
// router/index.js
{
  path: '/benutzer-verwaltung',
  component: UserManagement,
  meta: { 
    requiresAuth: true,
    roles: ['ADMIN']  // Only ADMIN can access
  }
}

// Guard checks: to.meta.roles.includes(authStore.user.role)
```

**Password Security**:
- Hash algorithm: bcrypt
- Rounds: 10 (configurable via BCRYPT_ROUNDS)
- Applied at [User.js model](api/models/User.js) pre-save hook

### CORS & IP Allowlisting

**Allowed Domains** (app.js):
```javascript
[
  'localhost:5173',           // Dev frontend
  'localhost:3000',           // Alternative dev
  'straightmonitor.com',      // Production
  'prod.straightmonitor.com', // Production alias
  'https://heroku*.com'       // Heroku deployment
]
```

**Allowed IP Ranges** (for webhook sources):
```
5.39.7.128 – 5.39.7.143   // External service webhooks (Flip, Asana)
Azure IP ranges            // Microsoft Graph
[Configured per team]
```

**Headers**:
- `x-auth-token` — JWT token (optional for public routes)
- `Content-Type` — application/json, multipart/form-data

### Raw Body Preservation

**Purpose**: Verify webhook signatures (DocuSeal, YouSign)

**Implementation** (app.js):
```javascript
// Preserve raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;  // Store raw bytes
  }
}));

// Webhook handler
router.post("/docuseal/webhook", (req, res) => {
  const signature = req.get('X-Docuseal-Signature');
  const verified = crypto.verify(
    req.rawBody,
    signature,
    DOCUSEAL_SECRET
  );
  // Process webhook if verified
});
```

### Secrets Management

**Environment Variables** (.env file — NOT committed):
```
# Database
MONGO_URI=mongodb+srv://[user]:[pass]@[cluster]...

# JWT
JWT_SECRET=<random-64-char-string>
BCRYPT_ROUNDS=10

# External Services
FLIP_API_TOKEN_BERLIN=<token>
ASANA_PAT=<personal-access-token>
ZVOOVE_API_KEY=<api-key>
DOCUSEAL_API_TOKEN=<token>
GRAPH_CLIENT_ID=<azure-app-id>
GRAPH_CLIENT_SECRET=<secret>
GRAPH_TENANT_ID=<tenant-id>

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[email]
SMTP_PASS=[password]

# R2 (Cloudflare)
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=straight-monitor

# Server
PORT=5050
NODE_ENV=development
```

**Best Practices**:
- Never commit `.env` file
- Use `.env.example` for template
- Rotate secrets regularly in production
- Use Azure Key Vault or similar in production

---

## Data Flow Diagrams

### New Applicant Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. HR creates Bewerber record                              │
│     POST /api/bewerber                                      │
└────────────────────┬────────────────────────────────────────┘
                     │ Bewerber created { asana_id, email, ... }
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Generate invitation & DocuSeal submission               │
│     BewerberInvitationService.sendInvitation()              │
├─ Generate JWT invitation token                             │
├─ Create DocuSeal submission (prefill: name, email)          │
└────────────────────┬────────────────────────────────────────┘
                     │ DocuSealVorgang created { docuSealId, status: pending }
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Send email with invitation link                         │
│     EmailService.sendBewerberInvitation()                   │
├─ To: applicant@example.com                                 │
├─ Body: invitation link + DocuSeal form embed               │
└────────────────────┬────────────────────────────────────────┘
                     │ Email sent
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Applicant clicks link, fills form, signs document      │
│     GET /api/public/bewerber/:token                         │
│     [Applicant fills form in browser]                       │
│     [DocuSeal handles signature UI]                         │
└────────────────────┬────────────────────────────────────────┘
                     │ Signature completed in DocuSeal
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Retrieve signed PDF                                     │
│     DocuSealService.getSubmission(docuSealId)               │
├─ Check status (completed)                                  │
├─ Download signed PDF                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ PDF downloaded from DocuSeal
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Store PDF in R2 & update Bewerber record               │
│     R2Service.uploadFile()                                  │
├─ Store: /bewerber/{asana_id}/vertraege/arbeitsvertrag.pdf   │
├─ Update Bewerber.einladungen[].signedPdfUrl                │
└────────────────────┬────────────────────────────────────────┘
                     │ PDF stored in R2
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  7. GDPR cleanup (optional)                                 │
│     ApplicantMailRetentionService.deleteApplicantMails()   │
├─ Query Graph for emails from applicant                      │
├─ Delete or archive (configurable)                           │
└────────────────────┬────────────────────────────────────────┘
                     │ Email archived/deleted
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  8. Display on frontend                                     │
│     BewerberCard.vue shows:                                 │
│     ├─ Application status                                  │
│     ├─ Uploaded documents                                  │
│     ├─ Signed contracts (links to R2 PDFs)                │
│     └─ Timeline of events                                  │
└─────────────────────────────────────────────────────────────┘
```

### Flip User Sync (Scheduled)

```
┌────────────────────────────────────────────────────────┐
│  Every 6 hours (or on-demand)                          │
│  flipUserRoutine() → FlipService.getFlipUsers()        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │  Call Flip API           │
    │  GET /api/flip-users     │
    │  Auth: OAuth Bearer      │
    └──────────────┬───────────┘
                   │ Returns: [{ flip_id, name, email, dept, ... }]
                   ▼
    ┌──────────────────────────────────────────────┐
    │  For each Flip user:                         │
    │  1. Find Mitarbeiter by email                │
    │  2. Update fields:                           │
    │     ├─ name                                  │
    │     ├─ phone                                 │
    │     ├─ department                            │
    │     └─ flip_id (if new)                      │
    │  3. If not found: create new Mitarbeiter     │
    └──────────────┬───────────────────────────────┘
                   │ Mitarbeiter records updated/created
                   ▼
    ┌──────────────────────────────────────────────┐
    │  Log sync status                             │
    │  ├─ Updated count                            │
    │  ├─ Created count                            │
    │  ├─ Errors (if any)                          │
    │  └─ Next run scheduled for +6h               │
    └──────────────────────────────────────────────┘
```

### Asana Applicant Sync (Scheduled)

```
┌────────────────────────────────────────────────────────┐
│  Every 4 hours (or on-demand)                          │
│  bewerberRoutine() → AsanaService.getAsanaTasks()      │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │  Query Asana project                 │
    │  GET /tasks?project={PROJECT_ID}     │
    │  Auth: PAT Token                     │
    │  Rate Limit: Queue (max 15 concurrent)
    └──────────────┬──────────────────────┘
                   │ Returns: [{ id, name, email, status, ... }]
                   ▼
    ┌────────────────────────────────────────────────────┐
    │  For each Asana task:                              │
    │  1. Check if Bewerber exists (by asana_id)         │
    │  2. If exists: update fields (status, name, etc.)  │
    │  3. If new:                                        │
    │     ├─ Create Bewerber record                      │
    │     ├─ Set asana_id                                │
    │     ├─ Parse email from Asana custom field         │
    │     └─ Set status = 'neu'                          │
    │  4. Extract Asana comments → store in Comment coll │
    └──────────────┬───────────────────────────────────┘
                   │ Bewerber records updated/created
                   ▼
    ┌────────────────────────────────────────────────────┐
    │  Update sync metadata                              │
    │  ├─ Last sync timestamp                            │
    │  ├─ Processed count                                │
    │  └─ Next run scheduled for +4h                     │
    └────────────────────────────────────────────────────┘
```

### Work Order Assignment & Staffing

```
┌─────────────────────────────────────────────────────────┐
│  1. Create Auftrag (work order)                         │
│     POST /api/auftraege                                 │
│     { kunde, location, startDate, endDate, rate }       │
└────────────────────┬────────────────────────────────────┘
                     │ Auftrag created
                     ▼
┌─────────────────────────────────────────────────────────┐
│  2. Assign staff to order                               │
│     POST /api/auftraege/:id/assign                      │
│     { mitarbeiterId, role }                             │
└────────────────────┬────────────────────────────────────┘
                     │ Einsatz (assignment) created
                     ▼
    ┌──────────────────────────────────────────────────┐
    │  Einsatz record links:                           │
    │  ├─ mitarbeiter → Mitarbeiter                    │
    │  ├─ auftrag → Auftrag                            │
    │  ├─ status → 'geplant' | 'aktiv' | 'abgeschlossen'
    │  └─ role → 'leader' | 'staff' | 'driver'         │
    └──────────────┬───────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  3. Create task in Flip (optional)                      │
│     FlipService.createFlipTask()                        │
│     ├─ Task: "[AUFTRAG] {kunde} on {date}"             │
│     ├─ Assigned to: Mitarbeiter (Flip)                 │
│     ├─ Description: link to order in Monitor           │
│     └─ Due: startDate                                  │
└────────────────────┬────────────────────────────────────┘
                     │ Task created in Flip
                     ▼
┌─────────────────────────────────────────────────────────┐
│  4. Update Dispo (scheduling)                           │
│     POST /api/dispo                                     │
│     { mitarbeiter, date, status }                       │
├─ Check availability (Zvoove data)                       │
├─ Create DispoEintrag record                             │
└─ Notify team in Flip                                    │
└──────────────────────────────────────────────────────────┘
```

---

## API Endpoints Summary

### Authentication Routes (`/api/users`)
```
POST   /api/users/login              # Login with email/password
GET    /api/users/profile            # Get current user
PUT    /api/users/profile            # Update profile
POST   /api/users/logout             # Logout
PUT    /api/users/password           # Change password
GET    /api/users/preferences        # Get dashboard preferences
PUT    /api/users/preferences        # Save dashboard preferences
```

### Employee Management (`/api/personal`)
```
GET    /api/personal                 # List all employees
GET    /api/personal/:id             # Get employee details
POST   /api/personal                 # Create employee
PUT    /api/personal/:id             # Update employee
DELETE /api/personal/:id             # Delete employee
GET    /api/personal/:id/documents   # Get employee documents
POST   /api/personal/:id/documents   # Upload document
```

### Applicant Management (`/api/bewerber`)
```
GET    /api/bewerber                 # List all applicants
GET    /api/bewerber/:id             # Get applicant details
POST   /api/bewerber                 # Create applicant
PUT    /api/bewerber/:id             # Update applicant
DELETE /api/bewerber/:id             # Delete applicant
POST   /api/bewerber/:id/dokumente   # Upload applicant document
POST   /api/bewerber/:id/einladung   # Send invitation/contract
GET    /api/bewerber/:id/einladung   # Get invitations status
```

### Work Order Management (`/api/auftraege`)
```
GET    /api/auftraege                # List all work orders
GET    /api/auftraege/:id            # Get order details
POST   /api/auftraege                # Create order
PUT    /api/auftraege/:id            # Update order
DELETE /api/auftraege/:id            # Delete order
POST   /api/auftraege/:id/assign     # Assign staff
GET    /api/auftraege/:id/staff      # Get assigned staff
```

### Customer Management (`/api/kunden`)
```
GET    /api/kunden                   # List all customers
GET    /api/kunden/:id               # Get customer details
POST   /api/kunden                   # Create customer
PUT    /api/kunden/:id               # Update customer
DELETE /api/kunden/:id               # Delete customer
GET    /api/kunden/:id/auftraege     # Get customer's orders
```

### Flip Integration (`/api/flip-*`)
```
GET    /api/flip-users               # Sync users from Flip
POST   /api/flip-tasks               # Create task in Flip
GET    /api/flip-files               # Get Flip documents
PUT    /api/flip-pages               # Update Flip wiki pages
POST   /api/flip-user-fix            # Manual Flip user sync
```

### Asana Integration (`/api/asana`)
```
GET    /api/asana/tasks              # List Asana tasks
GET    /api/asana/tasks/:id          # Get task details
POST   /api/asana/tasks              # Create task
PUT    /api/asana/tasks/:id          # Update task
POST   /api/asana/tasks/:id/stories  # Add comment
GET    /api/asana/subtasks           # Get subtasks
```

### Zvoove Integration (`/api/zvoove`)
```
GET    /api/zvoove/companies         # List companies
GET    /api/zvoove/availability      # Get availability data
POST   /api/import/zvoove            # Import from Excel
```

### Document Signing (`/api/docuseal`)
```
GET    /api/docuseal/templates       # List DocuSeal templates
POST   /api/docuseal/submissions     # Create signature request
GET    /api/docuseal/submissions/:id # Get submission status
```

### Microsoft Graph (`/api/graph`)
```
GET    /api/graph/users/:upn/messages      # List emails
GET    /api/graph/users/:upn/messages/:id  # Get email details
DELETE /api/graph/users/:upn/messages/:id  # Delete email
GET    /api/graph/me/drive/root/children   # List OneDrive files
POST   /api/graph/subscriptions            # Create webhook subscription
```

### PDF Form Templates (`/api/pdf-templates`)
```
GET    /api/pdf-templates            # List templates
GET    /api/pdf-templates/:id        # Get template details
POST   /api/pdf-templates            # Create template
PUT    /api/pdf-templates/:id        # Update template
DELETE /api/pdf-templates/:id        # Delete template
```

### PDF Form Instances (`/api/pdf-vorgaenge`)
```
GET    /api/pdf-vorgaenge            # List form instances
GET    /api/pdf-vorgaenge/:id        # Get instance details
POST   /api/pdf-vorgaenge            # Create form instance
PUT    /api/pdf-vorgaenge/:id        # Fill and submit form
```

### Signature Documents (`/api/signaturen`)
```
GET    /api/signaturen               # List signature documents
GET    /api/signaturen/:id           # Get document details
POST   /api/signaturen               # Create signature document
GET    /api/signaturen/:id/download  # Download PDF
```

### Scheduling (`/api/dispo`)
```
GET    /api/dispo                    # List disposition entries
POST   /api/dispo                    # Create entry
PUT    /api/dispo/:id                # Update entry
DELETE /api/dispo/:id                # Delete entry
```

### Data Import (`/api/import`)
```
POST   /api/import/zvoove            # Import Zvoove data from Excel
GET    /api/import/logs              # Get import history
GET    /api/import/logs/:id          # Get import details
```

### Public Integration (`/api/public`)
```
GET    /api/public/bewerber/:token   # Public applicant form
POST   /api/public/bewerber/:token   # Submit applicant data
GET    /api/public/status/:token     # Check status
```

---

## Development Workflow

### Project Startup

**Start All Services** (from root directory):
```bash
npm run dev
```

**Concurrently starts**:
1. **Frontend** (Vite dev server)
   - Port: 5173
   - Hot module reload
   - Proxy `/api` to backend

2. **Backend** (Nodemon)
   - Port: 5050
   - Auto-restart on file changes
   - MongoDB connected

3. **Cloudflared Tunnel**
   - Exposes `http://localhost:5050` externally
   - Allows webhooks from Flip, Asana, DocuSeal
   - Config: `.wrangler.toml` or `cloudflared config.yaml`

### Development Environment

**Frontend** (`frontend/Straight-Monitor/.env`):
```
VITE_API_BASE_URL=http://localhost:5050
VITE_ENV=development
```

**Backend** (`api/.env`):
```
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/straight-monitor
CRON_PAUSED=false
ENABLE_ROUTINES=flip_token,flipUserRoutine
```

### Frontend Development

**Project Structure**:
- `src/components/` — Vue 3 components
- `src/stores/` — Pinia stores
- `src/router/` — Route definitions
- `src/utils/` — API clients, helpers
- `src/assets/` — Images, styles

**Hot Reload**: Vite auto-refreshes on component/store changes  
**API Debugging**: Use browser DevTools Network tab to inspect requests  
**State Debugging**: Pinia DevTools extension for Chrome/Firefox

### Backend Development

**File Structure**:
- `routes/` — API endpoints
- `models/` — Mongoose schemas
- `*Service.js` — Business logic
- `middleware/` — Auth, error handling
- `utils/` — Helpers, logging

**Auto-Restart**: Nodemon watches `api/**` for changes  
**Logging**: Check terminal output for `logger.info()`, `logger.error()`  
**DB Debugging**: Use MongoDB Compass to inspect collections

### Testing

**Frontend**:
- Manual testing via browser (http://localhost:5173)
- Component console checks
- Pinia store inspection

**Backend**:
- Manual API testing (Postman, curl)
- Example: `test-db.js` in root for database queries
- Logging output in terminal

### Debugging Tips

1. **CORS errors**: Check allowlist in `app.js` (domains, IPs)
2. **Auth failures**: Verify JWT_SECRET matches between frontend/backend
3. **Webhook failures**: Check cloudflared tunnel status
4. **Database connection**: Ensure MONGO_URI is correct
5. **Rate limiting**: Check Asana queue in AsanaService.js

---

## Deployment & Infrastructure

### Production Environment

**Frontend**:
- Build: `npm run build` (root: `frontend/Straight-Monitor`)
- Output: `dist/` directory (Vite static build)
- Hosting: Vercel, Netlify, or static S3 bucket
- Base URL: Production API endpoint

**Backend**:
- Build: `npm install` (no build step needed)
- Runtime: Node.js 22+ (specified in package.json)
- Deployment: Heroku, Azure App Service, Docker
- Environment: `.env` from secrets management (Azure Key Vault)

**Database**:
- MongoDB Atlas (cloud-hosted)
- Connection via MONGO_URI (connection string)
- Automated backups enabled
- IP allowlist configured

**Storage**:
- Cloudflare R2 (S3-compatible file storage)
- Credentials: Access Key ID + Secret Key
- Bucket: `straight-monitor` (or per-env)
- HTTPS URLs for all file links

**Email**:
- SMTP provider (configurable)
- Credentials in environment secrets
- Templates: HTML + text versions

### Deployment Steps

1. **Frontend**:
   ```bash
   cd frontend/Straight-Monitor
   npm run build      # Creates dist/
   # Deploy dist/ to hosting (Vercel, Netlify, S3)
   ```

2. **Backend**:
   ```bash
   # Push to Heroku / Azure
   git push heroku main
   # Or deploy Docker image
   docker build -t straight-monitor-api .
   docker push registry/straight-monitor-api:latest
   ```

3. **Environment Setup**:
   - Set all `.env` variables in deployment platform secrets
   - Test database connection on startup
   - Verify webhook URLs point to production API

4. **Verification**:
   - Test login flow
   - Verify external service integrations
   - Check email delivery
   - Confirm R2 file uploads work

### Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Frontend        │         │   Backend        │          │
│  │  (Vercel/CDN)    │────────▶│  (Heroku/Azure)  │          │
│  │  dist/           │ HTTPS   │  Node.js 22      │          │
│  └──────────────────┘         │  Express         │          │
│         ▲                      │  Port: 443/5050  │          │
│         │                      └────────┬─────────┘          │
│         │                              │                    │
│         │                              ▼                    │
│         │                      ┌──────────────────┐          │
│         │                      │   MongoDB        │          │
│         │                      │   Atlas          │          │
│         │                      │   (cloud)        │          │
│         │                      └──────────────────┘          │
│         │                              │                    │
│         │                              ▼                    │
│         │                      ┌──────────────────┐          │
│         └──────────────────────│  Cloudflare R2   │          │
│                                │  (file storage)  │          │
│                                └──────────────────┘          │
│                                                              │
│  External Services (via API):                               │
│  ├─ Flip (webhook: cloudflared tunnel)                      │
│  ├─ Asana (polling: every 4h)                               │
│  ├─ Zvoove (polling: every 24h)                             │
│  ├─ DocuSeal (API + webhook)                                │
│  └─ Microsoft Graph (OAuth + subscriptions)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Patterns & Conventions

### Backend Code Patterns

**Async Error Handling** (mandatory):
```javascript
// ✅ CORRECT: Wrap all async handlers with asyncHandler
const asyncHandler = require("../middleware/AsyncHandler");

router.get("/", asyncHandler(async (req, res) => {
  const items = await Item.find();
  res.json(items);
}));

// ❌ WRONG: Unhandled promise rejection crashes server
router.get("/", async (req, res) => {
  const items = await Item.find();  // If error → crash!
  res.json(items);
});
```

**Logging**:
```javascript
// ✅ Use logger instead of console.log
const logger = require('./utils/logger');

logger.info('Starting sync');
logger.warn('Unexpected response');
logger.error('Database error', error);
logger.dbConnect();  // Special DB connection log

// ❌ Never use console.log in production
console.log('Debug message');
```

**Service Organization**:
```javascript
// ✅ Business logic in services, routes delegate
// FlipService.js
class FlipService {
  async getUsers() {
    // Complex logic here
  }
}
module.exports = FlipService;

// routes/flipUserFixRoutes.js
router.get("/", asyncHandler(async (req, res) => {
  const users = await flipService.getUsers();
  res.json(users);
}));

// ❌ Don't embed business logic in routes
router.get("/", asyncHandler(async (req, res) => {
  // Complex query logic here (wrong!)
  const users = await User.aggregate([...]);
}));
```

**Model Hooks**:
```javascript
// ✅ Use Mongoose pre/post hooks for automated logic
userSchema.pre('save', async function() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// ✅ Use post hooks for side effects
mitarbeiterSchema.post('save', async function() {
  logger.info(`Mitarbeiter updated: ${this._id}`);
});
```

### Frontend Code Patterns

**Vue 3 Script Setup** (all components):
```vue
<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '@/utils/api';

// State
const items = ref([]);
const loading = ref(false);

// Computed
const sortedItems = computed(() => 
  items.value.sort((a, b) => a.name.localeCompare(b.name))
);

// Lifecycle
onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/api/items');
    items.value = data;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div v-if="loading">Loading...</div>
    <ul v-else>
      <li v-for="item in sortedItems" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>
```

**State Management** (Pinia):
```javascript
// ✅ Use stores for shared state
// stores/auth.js
import { defineStore } from 'pinia';

export const useAuth = defineStore('auth', () => {
  const user = ref(null);
  
  async function login(email, password) {
    const { data } = await api.post('/api/users/login', 
      { email, password }
    );
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }
  
  return { user, login };
});

// Component usage
import { useAuth } from '@/stores/auth';

const authStore = useAuth();
authStore.user.email  // Access state
await authStore.login('user@example.com', 'pass')  // Call action
```

**API Calls**:
```javascript
// ✅ Centralize API logic in stores or utilities
// utils/api.js
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

// Component: use store action (not direct API call)
const result = await authStore.fetchUsers();

// Or: utility function for non-store logic
const { data } = await api.get('/api/items');
```

**Dark Mode Icons** (NO `new URL()` in templates):
```javascript
// ✅ CORRECT: Use computed ref
import lightImg from '@/assets/icon.png';
import darkImg from '@/assets/icon-dark.png';

const { isDark } = useTheme();
const imgIcon = computed(() => isDark ? darkImg : lightImg);

// Template
<img :src="imgIcon" alt="icon" />

// ❌ WRONG: Causes Vite parse error
<img :src="new URL('@/assets/icon.png', import.meta.url).href" />
```

**FilterChip Component** (standard UI):
```vue
<!-- Standard toggle/filter component -->
<template>
  <!-- Active state: orange outline + text, transparent bg -->
  <button
    :class="[
      'px-3 py-1 rounded border-2 transition',
      isActive
        ? 'border-[var(--primary)] text-[var(--primary)] bg-transparent'
        : 'border-gray-300 text-gray-600 bg-gray-100'
    ]"
    @click="toggle"
  >
    {{ label }}
  </button>
</template>
```

### Deprecation Warnings

**SCSS `darken()` function** (DEPRECATED):
```scss
// ❌ WRONG: Triggers Sass deprecation warning
background: darken(#dc3545, 10%);

// ✅ CORRECT: Use color.adjust() or color.scale()
background: color.adjust(#dc3545, $lightness: -10%);

// Or use color.scale() for proportional darkening
background: color.scale(#dc3545, $lightness: -18%);
```

---

## Summary

**Straight Monitor** is a sophisticated MEVN stack application providing centralized orchestration for employee management, applicant tracking, and work order coordination across three regional teams. The architecture leverages:

- **Modular Frontend** (Vue 3 + Pinia) with 80+ components for distinct business domains
- **Service-Oriented Backend** (Express + Mongoose) with dedicated integration services
- **Multi-Team Configuration** supporting independent deployments per location
- **External Service Integration** with Flip, Asana, Zvoove, DocuSeal, and Microsoft Graph
- **Secure Authentication** (JWT) with role-based access control
- **Background Job Scheduling** for automated data synchronization
- **Modern Development Workflow** with Vite hot reload and concurrent services

The system prioritizes **security**, **data integrity**, and **maintainability** through strict patterns (AsyncHandler, logging, service separation) and comprehensive documentation.

---

**Document Version**: 1.0  
**Last Updated**: August 10, 2026  
**Maintained By**: Development Team
