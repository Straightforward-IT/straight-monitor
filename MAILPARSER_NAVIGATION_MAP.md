# MailParser Navigation Map

## 🗺️ Where Users Can Find MailParser

```
┌──────────────────────────────────────────────────────────┐
│           STRAIGHT MONITOR DASHBOARD                     │
│                                                          │
│  [Bestand] [Verlauf] [Personal] [Dokumente]            │
│  [Mail Parser] ← PRIMARY ACCESS (Tile)                  │
│  [Excel] [Lohnabrechnungen] [Flip User] [Flip Exit]    │
│                                                          │
└──────────────────────────────────────────────────────────┘
         ↑ Click "Mail Parser" tile to open


┌─────────────────────────────────┐
│      TOOLS SIDEBAR              │
├─────────────────────────────────┤
│ Teamleiter Excel                │
│ Lohnabrechnungen                │
│ ─────────────────────────────── │
│ ✉️  Mail Parser        ← HERE   │
│ ─────────────────────────────── │
│ Flip: Benutzer erstellen        │
│ Flip: Austritte                 │
└─────────────────────────────────┘
  ↑ SECONDARY: Click "Tools" button
    then click "Mail Parser"
```

---

## 🔗 Two Access Paths

### Path 1: Dashboard Tile (PRIMARY)
```
1. Navigate to Dashboard (home page)
2. See Mail Parser tile with envelope icon ✉️
3. Click the tile
4. Opens /mailparser
```

**Best for:** Primary entry point, discovering the feature

---

### Path 2: Tools Sidebar (SECONDARY)
```
1. Click "Tools" button in top right corner
2. Find "Mail Parser" button in the tools list
3. Click it
4. Opens /mailparser
```

**Best for:** Quick access to all tools, alternative route

---

## 🎭 Visual States

### Dashboard Tile
```
Normal State:
┌──────────────────┐
│      ✉️          │
│                  │
│   Mail Parser    │
└──────────────────┘

Hover State:
┌──────────────────┐
│      ✉️          │  ↑ Slightly raised
│                  │  • Background color changes
│   Mail Parser    │  • Shadow effect
└──────────────────┘

Hidden (Feature Flag Disabled):
(Tile not shown at all)
```

### Tools Sidebar
```
Normal:
  ✉️  Mail Parser

Hover:
  ✉️  Mail Parser  (background highlighted)

Active:
  ✉️  Mail Parser  (selected state)
```

---

## 🎯 Feature Flag Badge

The feature is currently marked as "IN ARBEIT" (In Progress) and visibility is controlled by the environment variable.

---

## 🚀 Future Enhancements

- [ ] Add badge/counter to Mail Parser tile (pending templates)
- [ ] Add visual indicator for active parsing
- [ ] Show recent templates in tooltip
- [ ] Analytics dashboard for parsing activity
- [ ] Quick-start guide modal on first visit

---

## ⚙️ Feature Flag Control

The Mail Parser tile visibility is controlled by:
```bash
VITE_ENABLE_NEW_PAGES=true    # Show tile
VITE_ENABLE_NEW_PAGES=false   # Hide tile (default)
```

When enabled:
- ✅ Tile appears on Dashboard
- ✅ Button appears in Tools menu
- ✅ Route is accessible at `/mailparser`

When disabled:
- ❌ Tile hidden from Dashboard
- ✅ Button still in Tools (but navigates to dashboard)
- ✅ Route protected, redirects to dashboard

---

## 📱 Responsive Behavior

### Desktop (> 768px)
- Full-size tiles in responsive grid
- 4-6 columns depending on screen width
- Mail Parser tile with full text label
- Tools sidebar available
- All functionality accessible

### Mobile (≤ 768px)
- Tiles in 2-column grid (compact)
- Smaller tile sizes
- Shorter text labels
- Tools sidebar still accessible
- Touch-friendly tap targets
- Full functionality preserved

---

## 🔐 Authentication & Access

```
User Journey:
├─ Not Logged In
│  └─ Redirected to login page
│
├─ Logged In + Feature Flag Enabled
│  └─ Dashboard loaded with Mail Parser tile visible
│     ├─ Click tile → /mailparser (MailParser component)
│     └─ Click Tools → Mail Parser option available
│
└─ Logged In + Feature Flag Disabled
   └─ Dashboard loaded without Mail Parser tile
      └─ Click Tools → Mail Parser redirects to dashboard
```

---

## � Component Hierarchy

```
MainLayout (Authenticated)
├─ HeaderBar
├─ Dashboard
│  ├─ Monitor 2.0 Section (Info)
│  └─ Tiles Grid
│     ├─ [Bestand Tile]
│     ├─ [Verlauf Tile]
│     ├─ [Personal Tile] (if enabled)
│     ├─ [Dokumente Tile] (if enabled)
│     ├─ [Mail Parser Tile] ← HERE (if enabled)
│     ├─ [Excel Tools Tile]
│     ├─ [Lohnabrechnungen Tile]
│     ├─ [Flip User Tile]
│     └─ [Flip Exit Tile]
├─ Tools Sidebar (Side Panel)
│  ├─ [Teamleiter Excel Button]
│  ├─ [Lohnabrechnungen Button]
│  ├─ [Mail Parser Button] ← HERE
│  ├─ [Flip User Button]
│  └─ [Flip Exit Button]
└─ Footer
```

---

## ✅ Testing Checklist

- [ ] Desktop: See Mail Parser tile on dashboard
- [ ] Desktop: Click Mail Parser tile → navigates to /mailparser
- [ ] Desktop: Click Tools → Mail Parser button visible
- [ ] Desktop: Click Tools → Mail Parser → navigates to /mailparser
- [ ] Mobile: Tile visible on dashboard (responsive grid)
- [ ] Mobile: Click Mail Parser tile → navigates to /mailparser
- [ ] Mobile: Tools sidebar accessible and functional
- [ ] Feature flag disabled: Tile not shown
- [ ] Feature flag disabled: Tools button redirects to dashboard
- [ ] Dark theme: Tile styling looks correct
- [ ] Light theme: Tile styling looks correct
- [ ] Auth: Not logged in → cannot access /mailparser

---

## 🎯 Feature Flag Badge

