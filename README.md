# ClubDocs — Smart Document Generator for College Clubs

Frontend for **ClubDocs**, built for student clubs and chapters (first user: **ACM Student Chapter at SVNIT Surat**).
Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui**.

Branded with ACM Blue (`#4F81BD` primary, `#1F3A5F` dark, white background), serif headings for document letterhead previews, and sans-serif interface controls.

---

## Features & Pages

1. **Dashboard (`/`)**:
   - Recent events with status chips (`Draft`, `Needs info`, `Ready`, `Approved`).
   - Counts of generated documents, hours saved, and attention alerts.
   - Quick links to Templates Catalog and Club Settings.
   - Demo database reset button.

2. **New Request (`/new`)**:
   - **"Describe it"**: Natural language input (e.g., *"We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students"*).
   - **"Fill a form"**: Structured form (title, category, dates, time, venue, mode, participants, description, objective, organizers).
   - Submits directly to the extraction review page.

3. **Extraction Review (`/event/[id]/review`)**:
   - Split layout with field badges: `From your text`, `From club profile`, `AI draft - review`, and `Missing`.
   - Amber **"Needs your input"** panel highlighting missing required fields with specific questions (e.g. *"Who is the faculty coordinator?"*).
   - Hard privacy guard: Sensitive/official data (reference numbers, bank details, GST, mobile numbers, signatures) is **never** auto-filled; displayed with masked inputs and confirmed by the user.
   - Recommended documents with reasoning (Room Permission Letter, Bill Certificate Form BC-R, Bill Summary).
   - Generate options including *"Generate with placeholders"* (`[TO BE FILLED]`).

4. **Document Editor (`/event/[id]/doc/[docId]`)**:
   - Left side: Grouped field editor with table support (add/remove rows for items, reimbursements, and contacts).
   - Right side: Live A4 letterhead preview with ACM & SVNIT Surat logos, blue headings, institute subtitle, and yellow highlights for unfilled fields.
   - Toolbar: Save (creates new version), Download DOCX, Download PDF, Version history drawer with timestamp and restore, and *"Regenerate all documents from event"*.
   - Notice when edits update shared fields across other documents.

5. **Event Hub (`/event/[id]`)**:
   - Overview of the event and list of all generated documents with status.
   - **"Sync changes"** banner that appears whenever event data has been updated after document generation.

6. **Templates Catalog (`/templates`)**:
   - Grid of official templates (Room Permission Letter, Bill Certificate BC-R, Bill Summary).
   - **Add Template Flow**: Upload `.docx` and optional `.yaml` schema; detects `{{placeholders}}` in the browser, lets you customize types, requirements, questions, sensitive/AI-draftable flags, and recommendation rules.

7. **Club Settings (`/settings`)**:
   - Letterhead branding (logos, primary/dark colors, letterhead titles).
   - Signatories list (name, designation, role).
   - Reference numbering patterns and auto-increment counters per category (`ACM/{FY}/ROOM/{seq}`).
   - Academic and financial years.

8. **History & Analytics (`/history`)**:
   - Audit trail of generated documents with type and date filters.
   - Stat cards summarizing turnarounds and approvals.

---

## Getting Started

### 1. Install & Run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Connecting to a Real FastAPI Backend

Currently, the application runs entirely in client-side mock mode via typed handlers in `lib/mock/*` and localStorage persistence.

The backend integration layer is strictly isolated to **`lib/api.ts`** and all data shapes are strictly defined in **`lib/types.ts`**.

### Steps to Swap Mock Data for FastAPI at `http://localhost:8000`:

1. In `frontend/.env.local` (or create it), set:
   ```env
   NEXT_PUBLIC_USE_MOCK="false"
   NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
   ```

2. Your FastAPI backend should implement the following REST endpoints matching `lib/types.ts`:
   - `GET /api/club` & `PUT /api/club`
   - `GET /api/events` & `GET /api/events/{id}`
   - `POST /api/events/from-text` (body: `{ text: string }`)
   - `POST /api/events/from-form` (body: `EventFormInput`)
   - `PATCH /api/events/{id}/fields` (body: `{ updates: Record<string, FieldValue> }`)
   - `GET /api/events/{id}/recommendations`
   - `POST /api/events/{id}/generate` (body: `{ templateIds: string[], options: GenerateOptions }`)
   - `POST /api/events/{id}/regenerate`
   - `GET /api/documents` & `GET /api/documents/{id}`
   - `PUT /api/documents/{id}` (body: `{ values: FieldValues, note: string }`)
   - `PATCH /api/documents/{id}/status`
   - `POST /api/documents/{id}/restore` (body: `{ version: number }`)
   - `GET /api/documents/{id}/export?format={docx|pdf}` (returns binary file)
   - `GET /api/templates` & `POST /api/templates` & `POST /api/templates/analyze`
   - `GET /api/stats`

3. Because all components exclusively call functions imported from `@/lib/api`, **no UI components need to be modified** when switching to the live backend.