# MailParser Tool - Frontend Component Documentation

## Overview

The MailParser is a sophisticated email parsing tool with two main modes:
- **Configure Mode**: Create reusable email parsing templates
- **View Mode**: Apply templates to parse incoming emails and extract variables

## Features

### 🔧 Configure Mode

#### 1. HTML Structure Display
- Emails are parsed into a hierarchical tree of HTML elements
- Each element shows:
  - **Tag**: HTML element type (p, div, h1, etc.) or "text"
  - **Content**: Preview of the element's text content
  - **Depth**: Indentation showing nesting level
  - **Status badges**: Shows if marked as keyword or value

#### 2. Pattern Creation

##### Keyword Pattern
- Mark specific text as a keyword to search for
- Used to identify and anchor extraction points
- Example: Mark "Name:" as a keyword to know where to look for the name value

##### Value Pattern
- Mark elements to extract actual variable values
- Multiple extraction strategies to handle ambiguity:
  - **Next Line**: Extract the next line after the keyword
  - **Next Element**: Extract the next HTML element
  - **Same Line After**: Get text after keyword on same line
  - **Same Line Before**: Get text before keyword on same line
  - **Parent Element**: Extract full text from parent element
  - **Custom**: Use CSS selector or XPath for precise targeting

##### Handling Multiple Occurrences
When the same value appears multiple times:
- **First occurrence only**: Extract only the first match
- **All occurrences**: Return as array for batch processing
- **Last occurrence**: Extract only the final occurrence

#### 3. Template Management

Templates include:
```javascript
{
  id: "template-123",
  name: "Indeed Job Application",
  tags: ["job-application", "indeed"],
  patterns: [
    {
      type: "keyword",
      text: "Full Name:",
      variableName: "keyword_1"
    },
    {
      type: "value",
      variableName: "applicant_name",
      selector: "nextLine",
      occurrence: "first"
    }
  ],
  htmlSignature: "body > div.indeed-wrapper", // Optional: for auto-detection
  createdAt: "2025-10-22T10:00:00Z"
}
```

**Template Properties:**
- `name`: Human-readable template name
- `tags`: Classification tags (job-application, order, support-ticket, etc.)
- `patterns`: Array of extraction patterns
- `htmlSignature`: CSS selector to auto-detect this template
- `createdAt`: Creation timestamp

#### 4. Right-Click Context Menu
When configuring:
1. Click on an HTML element to select it
2. Right-click to open context menu
3. Choose:
   - **Mark as Keyword**: Flag this text as a keyword
   - **Mark as Value**: Open value dialog for extraction strategy
   - **Clear Marking**: Remove any previous marking

#### 5. Save Templates
- Templates are saved to browser localStorage (backend integration TBD)
- Can be edited or deleted anytime
- Persist across sessions

### 👁️ View Mode

#### 1. Template Selection
- Choose from saved templates dropdown
- Shows template name and associated tags

#### 2. Email Parsing
- Paste email HTML or upload
- Click "Parse Email" to apply template
- Extraction based on configured patterns

#### 3. Results Display
- Shows extracted variables in key-value format
- Original email displayed with highlights showing matched sections
- Visual indicators for:
  - Keywords found
  - Values extracted
  - Matched elements

### 🚀 Future Features (Phase 2)

#### Email Template Auto-Detection
- Analyze HTML structure of incoming email
- Compare against stored templates' `htmlSignature`
- Suggest matching template (with confidence score)
- Handle forwarded emails (stripped HTML wrapper)

#### Actions System
Each template can have multiple actions:
```javascript
{
  template: "Indeed Application",
  actions: [
    {
      type: "forward",
      forwardTo: "hr@company.com",
      subject: "New {job_title} Application"
    },
    {
      type: "createAsanaTask",
      taskSettings: {
        project: "applicants-project",
        name: "New {applicant_name} - {job_title}",
        customFields: {
          source: "indeed",
          salary: "{salary_expectation}"
        }
      }
    },
    {
      type: "webhook",
      url: "https://api.example.com/webhook",
      payload: {
        applicant: "{applicant_name}",
        email: "{email}",
        template: "Indeed"
      }
    }
  ]
}
```

#### Backend Integration
- Store templates in MongoDB
- API endpoints for CRUD operations
- Template sharing between users/teams
- Usage analytics (which templates are used most, success rates)

---

## Usage Examples

### Example 1: Creating an Indeed Template

1. Go to **Configure Mode**
2. Click **New Template**
3. Enter name: "Indeed Job Application"
4. Add tags: "job-application, indeed"
5. Paste Indeed email HTML
6. Configure patterns:
   - Find and mark "Name:" as Keyword
   - Mark the line below as Value → `applicant_name` (nextLine)
   - Find and mark "Email:" as Keyword
   - Mark the value as Value → `email` (sameLineAfter)
7. Save Template
8. Go to **View Mode**
9. Select template and parse incoming Indeed emails

### Example 2: Creating a Generic Contact Form Template

1. **New Template** → "Website Contact Form"
2. Add tags: "contact, form"
3. Paste form email HTML
4. Configure:
   - Mark form fields as keywords
   - Mark input values as values with appropriate selectors
5. Save and reuse for all contact form submissions

### Example 3: Handling Ambiguous Data

Email contains "Price: $100" and later "Final Price: $150"

- Create keyword "Price:"
- Create value pattern with `occurrence: "first"` to get $100
- Create another value pattern with `occurrence: "last"` to get $150
- Or use `occurrence: "all"` to get both as array

---

## Data Storage (Phase 1)

Currently: Browser localStorage
```javascript
localStorage.getItem('mailParserTemplates')
```

Phase 2: MongoDB (backend storage)
```
/api/mail-parser/templates (GET, POST)
/api/mail-parser/templates/:id (PUT, DELETE)
/api/mail-parser/parse (POST) - parse email with template
```

---

## Technical Architecture

### Component Structure
```
MailParser.vue (main component)
├── View Mode
│   ├── Template Selector
│   ├── Parse Results
│   └── Email Preview (with highlights)
├── Configure Mode
│   ├── Template Editor
│   │   ├── Template Info Form
│   │   ├── HTML Hierarchy Display (left panel)
│   │   └── Pattern Configuration (right panel)
│   ├── Templates List (grid view)
│   └── Context Menu
├── ContextMenu.vue (utility)
└── ValueDialog.vue (modal for value extraction strategy)
```

### Key Functions

**parseHtmlToElements()**: Convert HTML string to hierarchical element tree
**updateEmailElements()**: Trigger when email HTML changes
**addKeywordPattern()**: Mark selected element as keyword
**confirmValuePattern()**: Save value extraction strategy
**saveTemplate()**: Persist template to localStorage
**parseWithTemplate()**: Apply template to extract variables (Phase 2)

---

## Notes for Future Development

1. **Email Forwarding**: Need to strip "Forwarded Message" wrapper before processing
2. **HTML Normalization**: Different email clients produce different HTML - may need to normalize
3. **Template Versioning**: Allow template updates without breaking existing uses
4. **Conflict Resolution**: If multiple templates match, how to resolve?
5. **Performance**: Consider caching parsed elements for large emails
6. **Testing**: Unit tests for pattern matching logic especially important

---

## Dependencies

- Vue 3 (Composition API)
- TypeScript
- FontAwesome icons (for UI)
- SCSS for styling

---

## API Integration (Future)

Endpoints needed:
- `POST /api/mail-parser/templates` - Create template
- `GET /api/mail-parser/templates` - List all templates
- `GET /api/mail-parser/templates/:id` - Get single template
- `PUT /api/mail-parser/templates/:id` - Update template
- `DELETE /api/mail-parser/templates/:id` - Delete template
- `POST /api/mail-parser/parse` - Parse email with template
- `GET /api/mail-parser/auto-detect` - Detect template for email

