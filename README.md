# ClubDocs — Smart Document Generator for College Clubs

**ClubDocs** is an intelligent, privacy-first document generation platform built for college clubs and student chapters. Its first deployment is for the **ACM Student Chapter at SVNIT Surat** (Sardar Vallabhbhai National Institute of Technology, Surat).

ClubDocs turns freeform event requirements or structured forms into standardized, editable, branded college documents in **DOCX** and **PDF** formats using data-driven templates that the club can extend without writing code.

---

## 🏛️ Core Principles & Hard Rules

- **R1: Never Fabricate Official Data:** Reference numbers, approval note numbers, bank account numbers, IFSC codes, GST numbers, invoice numbers, mobile numbers, and signatures must **NEVER** be invented, auto-filled, or hallucinated by AI or text extraction. The backend strictly enforces this via an `OFFICIAL_FORBIDDEN_KEYS` post-filter regardless of LLM or user text prompts. Missing official details are always flagged for human input.
- **R2: Templates are Data, Never Code:** Templates live as a directory containing `template.docx`, `schema.yaml`, `rules.yaml`, and `meta.yaml`. Adding or customizing a document template is performed via file upload or filesystem directory creation without redeploying code.
- **R3: Single Source of Truth:** A single `Event` object is the root truth. Shared fields (e.g. `event_title`, `dates`, `venue`, `faculty_coordinator`, `participants`, `mode`) stay synchronized across all documents for an event. Editing a shared field automatically updates all related documents and alerts the user.
- **R4: Safe Rule Evaluation:** Document recommendations are evaluated dynamically using `simpleeval` with a strictly sandboxed namespace—`eval` and `exec` are banned.
- **R5: Privacy & Field Masking:** Sensitive data (bank details, IFSC, GST, phone numbers) are encrypted at rest with Fernet (AES-256-GCM) and masked in the UI (`••••••••1234`) with password-style reveal toggles.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Frontend: Next.js 16 (App Router)        │
│  - TypeScript, Tailwind CSS, shadcn/ui                 │
│  - Desktop-first responsive layout (ACM Blue letterhead)│
│  - Dual Mode: Standalone Mock (v2) or Live FastAPI     │
│  - Stepper: Describe -> Review -> Generate -> Edit     │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (JSON / FormData)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Backend: FastAPI (Python 3.13)           │
│  - Structured Extraction (Regex engine + Optional LLM) │
│  - Hard Rule R1 Post-Filter Guard                      │
│  - SQLModel + SQLite Database with Fernet Encryption   │
│  - Template Loader & Safe Rule Evaluator (simpleeval)  │
│  - Rendering Engine: docxtpl + LibreOffice Headless    │
└───────────────────────────┬────────────────────────────┘
                            │ Reads & Renders
                            ▼
┌────────────────────────────────────────────────────────┐
│                 /templates/<template_id>/              │
│  ├── template.docx (Word letterhead + Jinja2 syntax)   │
│  ├── schema.yaml   (Placeholders, types, questions)    │
│  ├── rules.yaml    (Recommendation conditions)         │
│  └── meta.yaml     (Authority, description, ref code)  │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Starter Templates Included

1. **Room Permission Letter (`room_permission`)**:
   - Official letter addressed to the Head of Department (CSE Dept.) requesting classroom/seminar hall booking.
   - Branded with SVNIT and ACM logos, schedule, event details table, and 4 contact blocks.
2. **Bill Certificate (`bill_certificate`)**:
   - Institute **Form BC-R** addressed to Dean (Student Welfare).
   - Approval note details, itemized table (sr no, item name, qty, rate, total), GST/vendor details, indenter details.
3. **Bill Summary (`bill_summary`)**:
   - Event summary and expense reimbursement sheet with payment recipient details, account numbers, and signatories.

---

## 🚀 Running the Project

### Option 1: Docker Compose (Recommended for Full Stack)

To run both Next.js frontend, FastAPI backend, and LibreOffice PDF conversion in Docker:

```bash
docker compose up --build
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API & Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option 2: Running Locally (FastAPI + Next.js)

#### 1. Backend Setup (FastAPI)
```bash
# In repository root:
python -m venv .venv

# Activate virtual environment:
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run FastAPI backend
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Backend runs at `http://localhost:8000`. API documentation is available at `http://localhost:8000/docs`.

#### 2. Frontend Setup (Next.js)
```bash
cd frontend

# Install packages
npm install

# Configure environment (.env.local)
# For Live Backend mode:
echo "NEXT_PUBLIC_USE_MOCK=false" > .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" >> .env.local

# For Standalone Mock mode (no backend required):
# NEXT_PUBLIC_USE_MOCK=true

# Start frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Verification & Tests

### Backend Unit & Integration Tests (pytest)
Runs 8 comprehensive tests covering health, Fernet encryption/decryption, safe rule evaluator, templates catalog, event lifecycle, document generation, Rule R1 enforcement, and database reset:

```bash
# Windows
.venv\Scripts\pytest -v

# Linux/macOS
pytest -v
```

### Frontend Build & Lint Verification
```bash
cd frontend
npm run lint
npm run build
```

---

## 🔒 Security & Data Masking

- **Masked Fields:** Bank Account Number, IFSC Code, GST Number, Mobile Number are flagged `neverAI: true` and `masked: true`. They are encrypted using Fernet (AES-256) at rest and displayed as `••••••••1234` in the UI with a reveal button.
- **Official Fields:** Reference Numbers, Approval Note Numbers, Purchase Orders, and Invoices are flagged `neverAI: true` and `masked: false`. They are official records that can never be guessed by AI, but do not require masking.
- **Reference Numbers:** Reference numbers are peeked via `GET /api/club/reference/{category}/peek` without burning counters. The sequential counter only increments when generating or approving the document.

---

## 📖 Adding New Templates

See [`docs/TEMPLATES.md`](file:///c:/Users/OMEN/Desktop/SmartDocumentGenerator/docs/TEMPLATES.md) for detailed instructions on authoring and managing templates using `.docx` files, Jinja2 placeholders, `schema.yaml`, and `rules.yaml`.