# ClubDocs: Templates as Data Guide

In ClubDocs, **templates are data, never code** (Hard Rule R2). Adding, updating, or deleting a document template does not require changing any backend code or redeploying the application.

Every template lives inside its own folder in `/templates/<template_id>/`:
```
templates/
├── room_permission/
│   ├── template.docx     # Word document with Jinja2 placeholders
│   ├── schema.yaml       # Field definitions, questions, and sensitivity rules
│   ├── rules.yaml        # Recommendation logic (safe simpleeval conditions)
│   └── meta.yaml         # Display name, issuing authority, and category
├── bill_certificate/
│   ├── template.docx
│   ├── schema.yaml
│   ├── rules.yaml
│   └── meta.yaml
└── bill_summary/
    ├── template.docx
    ├── schema.yaml
    ├── rules.yaml
    └── meta.yaml
```

---

## 1. Directory Structure & Files

### `meta.yaml`
Stores metadata about the document template:
```yaml
id: room-permission
name: Room Permission Letter
short_name: Room Permission
description: Official letter for booking department halls and seminar rooms
authority: Head of Department (CSE Dept.)
ref_category: ROOM
file_name: room_permission_letter.docx
version: 1
```

### `schema.yaml`
Declares the fields required or optional for the document.
```yaml
placeholders:
  - key: event_title
    label: Event Title
    type: text              # text | date | number | longtext | select | table
    required: true
    question: What is the formal title of the event?
    never_ai: false         # True if AI must NEVER generate or fill this value
    masked: false           # True if UI masks with bullets (••••1234)
    ai_draftable: false     # True if AI draft can be proposed during review
    shared: true            # True if shared across multiple documents in the event
    section: General

  - key: ref_no
    label: Reference Number
    type: text
    required: true
    question: What is the official dispatch reference number?
    never_ai: true          # Official number: Rule R1 strictly prohibits AI generation
    masked: false
    ai_draftable: false
    shared: false
    section: Administrative

  - key: account_number
    label: Bank Account Number
    type: text
    required: true
    question: What is the beneficiary bank account number?
    never_ai: true          # Rule R1: Never AI-filled
    masked: true            # Sensitive: Masked in UI and encrypted in DB
    ai_draftable: false
    shared: false
    section: Payment Details
```

#### Table Placeholders
For repeating rows (e.g. items, contacts, vouchers):
```yaml
  - key: items
    label: Purchased Items
    type: table
    required: true
    question: List items purchased with quantity and cost
    never_ai: true
    masked: false
    section: Itemized Expenses
    columns:
      - key: sr_no
        label: Sr No.
        type: number
      - key: item_name
        label: Item Description
        type: text
      - key: qty
        label: Qty
        type: number
      - key: unit_cost
        label: Rate (Rs.)
        type: number
      - key: total
        label: Total Amount (Rs.)
        type: number
```

### `rules.yaml`
Defines recommendation logic using safe python expressions. The condition is evaluated using `simpleeval` with a restricted namespace:
```yaml
rules:
  - id: room-offline
    description: Recommended when event takes place on campus or offline.
    condition: "mode != 'Online' and venue != None"

  - id: bill-expenses
    description: Recommended when food, banners, or material expenses are involved.
    condition: "hasExpenses == True"
```
Safe context variables available in conditions:
- `title` (str)
- `category` (str, e.g. `'workshop'`, `'hackathon'`, `'competition'`, `'seminar'`, `'talk'`)
- `venue` (str | None)
- `mode` (str, `'Offline'` | `'Online'` | `'Hybrid'`)
- `participants` (int | str)
- `hasExpenses` (bool)
- `hasPrizes` (bool)

### `template.docx`
A standard Microsoft Word (`.docx`) file styled with the club's letterhead and fonts. Use `docxtpl` / Jinja2 syntax:
- Scalar variables: `{{ event_title }}`, `{{ ref_no }}`, `{{ venue }}`
- Dates: `{{ start_date }}` to `{{ end_date }}`
- Dynamic tables:
  ```jinja2
  {% for row in items %}
  {{ row.sr_no }} | {{ row.item_name }} | {{ row.qty }} | {{ row.unit_cost }} | {{ row.total }}
  {% endfor %}
  ```
- Unfilled values: If `options.allowPlaceholders` is enabled, empty fields render as `[TO BE FILLED: FIELD_NAME]`.

---

## 2. Hard Rule R1: Official & Sensitive Data

Fields marked `never_ai: true` (e.g., `ref_no`, `approval_note_no`, `account_number`, `ifsc`, `gst`, `signatures`, `mobile`) **will never be generated, guessed, or auto-filled by AI**, even if present in the raw input text. The backend enforces this strictly via `OFFICIAL_FORBIDDEN_KEYS` post-filtering.

Fields marked `masked: true` are stored with AES-256-GCM encryption in the database and displayed as `••••••••1234` in the UI until explicitly revealed by authorized users.

---

## 3. Adding a Template via UI or CLI

### Method A: Web UI
1. Navigate to `/templates` in the ClubDocs interface.
2. Click **Add Template**.
3. Upload your `.docx` file and optional `schema.yaml`.
4. The system inspects all `{{ placeholder }}` tags and automatically categorizes them.
5. Set `never_ai`, `masked`, and validation rules in the table.
6. Click **Save Template**. The backend writes the files directly into `/templates/<template_id>/`.

### Method B: Filesystem
1. Create a new folder under `templates/` (e.g. `templates/faculty_invitation/`).
2. Add `template.docx`, `schema.yaml`, `rules.yaml`, and `meta.yaml`.
3. Refresh the Templates page or call `GET /api/templates`. The new template is instantly available for recommendation and generation.
