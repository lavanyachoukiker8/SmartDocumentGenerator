import type { Placeholder, Template } from "../types";

/**
 * Field catalog: every placeholder used by the built-in templates.
 * Templates reference these keys so that shared values (title, dates, venue)
 * stay consistent across all documents of an event.
 */
const S = {
  event: "Event details",
  about: "About the event",
  letter: "Letter details",
  official: "Official references",
  contacts: "Contacts & signatories",
  items: "Items & amounts",
  supplier: "Supplier details",
  payment: "Payment details",
  indenter: "Indenter details",
  reimburse: "Reimbursements",
} as const;

export const FIELD_CATALOG: Record<string, Placeholder> = {
  /* ---------- shared event fields ---------- */
  event_title: {
    key: "event_title", label: "Event title", type: "text", required: true, shared: true,
    question: "What is the name of the event?", sensitive: false, aiDraftable: false, section: S.event,
  },
  event_category: {
    key: "event_category", label: "Category", type: "select", required: false,
    options: ["workshop", "seminar", "talk", "competition", "hackathon", "meeting", "other"],
    question: "What kind of event is this?", sensitive: false, aiDraftable: false, section: S.event,
  },
  start_date: {
    key: "start_date", label: "Start date", type: "date", required: true, shared: true,
    question: "On which date does the event start?", sensitive: false, aiDraftable: false, section: S.event,
  },
  end_date: {
    key: "end_date", label: "End date", type: "date", required: true, shared: true,
    question: "On which date does the event end?", sensitive: false, aiDraftable: false, section: S.event,
  },
  start_time: {
    key: "start_time", label: "Start time", type: "time", required: true,
    question: "What time does the event start each day?", sensitive: false, aiDraftable: false, section: S.event,
  },
  end_time: {
    key: "end_time", label: "End time", type: "time", required: true,
    question: "What time does the event end each day?", sensitive: false, aiDraftable: false, section: S.event,
  },
  venue: {
    key: "venue", label: "Venue", type: "text", required: true, shared: true,
    question: "Which room or hall do you need?", sensitive: false, aiDraftable: false, section: S.event,
  },
  mode: {
    key: "mode", label: "Mode", type: "select", required: true, options: ["Offline", "Online", "Hybrid"],
    question: "Is the event offline, online or hybrid?", sensitive: false, aiDraftable: false, section: S.event,
  },
  participants: {
    key: "participants", label: "Number of participants", type: "text", required: true,
    question: "Roughly how many participants do you expect?", sensitive: false, aiDraftable: false, section: S.about,
  },
  description: {
    key: "description", label: "Brief description", type: "longtext", required: true,
    question: "Describe the event in 2–3 sentences.", sensitive: false, aiDraftable: true, section: S.about,
  },
  objective: {
    key: "objective", label: "Objective", type: "longtext", required: true,
    question: "What is the objective of the event?", sensitive: false, aiDraftable: true, section: S.about,
  },
  organizers: {
    key: "organizers", label: "Event organizers", type: "text", required: true,
    question: "Who is organizing the event?", sensitive: false, aiDraftable: false, section: S.about,
  },
  faculty_coordinator: {
    key: "faculty_coordinator", label: "Faculty coordinator", type: "text", required: true,
    question: "Who is the faculty coordinator?", sensitive: false, aiDraftable: false, section: S.contacts,
    helpText: "The faculty member responsible for this event. Not assumed from the club profile.",
  },

  /* ---------- room permission ---------- */
  ref_no: {
    key: "ref_no", label: "Reference number", type: "text", required: true,
    question: "Which reference number should this letter carry?", sensitive: true, aiDraftable: false, section: S.official,
    helpText: "Official numbers are never generated automatically. You can accept the next number from your counter.",
  },
  letter_date: {
    key: "letter_date", label: "Letter date", type: "date", required: false,
    question: "What date should appear on the letter?", sensitive: false, aiDraftable: false, section: S.letter,
  },
  submitted_to: {
    key: "submitted_to", label: "Submitted to", type: "text", required: true,
    question: "To whom is the letter addressed?", sensitive: false, aiDraftable: false, section: S.letter,
  },
  subject: {
    key: "subject", label: "Subject", type: "text", required: true,
    question: "What is the subject line?", sensitive: false, aiDraftable: true, section: S.letter,
  },
  schedule: {
    key: "schedule", label: "Schedule of event", type: "table", required: true,
    question: "What is the day-wise schedule?", sensitive: false, aiDraftable: true, section: S.about,
    columns: [
      { key: "date", label: "Date", type: "text", width: 1 },
      { key: "time", label: "Time", type: "text", width: 1 },
      { key: "session", label: "Session", type: "text", width: 2 },
    ],
  },
  contacts: {
    key: "contacts", label: "Contact persons", type: "table", required: true,
    question: "Who are the contact persons for this event?", sensitive: false, aiDraftable: false, section: S.contacts,
    helpText: "Mobile numbers are personal data and are never filled automatically.",
    columns: [
      { key: "name", label: "Name", type: "text", width: 2 },
      { key: "designation", label: "Designation", type: "text", width: 2 },
      { key: "admission_no", label: "Admission no.", type: "text", width: 1 },
      { key: "branch", label: "Branch", type: "text", width: 2 },
      { key: "mobile", label: "Mobile no.", type: "text", sensitive: true, width: 1.5 },
    ],
  },

  /* ---------- bill certificate ---------- */
  chapter_name: {
    key: "chapter_name", label: "Chapter name", type: "text", required: true,
    question: "Which chapter is claiming the bill?", sensitive: false, aiDraftable: false, section: S.official,
  },
  head_of_account: {
    key: "head_of_account", label: "Head of account (code no.)", type: "text", required: true,
    question: "What is the head of account / budget code (e.g. 6/52)?", sensitive: true, aiDraftable: false, section: S.official,
  },
  approval_note_no: {
    key: "approval_note_no", label: "Approval note no.", type: "text", required: true,
    question: "What is the approval note number issued for this expense?", sensitive: true, aiDraftable: false, section: S.official,
  },
  approval_date: {
    key: "approval_date", label: "Approval note date", type: "date", required: true,
    question: "On which date was the approval note issued?", sensitive: false, aiDraftable: false, section: S.official,
  },
  purchase_order: {
    key: "purchase_order", label: "Purchase order no. & date", type: "text", required: false,
    question: "Is there a purchase order? (write NiL if none)", sensitive: true, aiDraftable: false, section: S.official,
  },
  advance_drawn: {
    key: "advance_drawn", label: "Advance drawn (Rs.)", type: "text", required: false,
    question: "Was any advance drawn? (write NiL if none)", sensitive: false, aiDraftable: false, section: S.official,
  },
  certifying_person: {
    key: "certifying_person", label: "Certifying person", type: "text", required: true,
    question: "Who certifies that the goods are of requisite quality?", sensitive: false, aiDraftable: false, section: S.indenter,
  },
  items: {
    key: "items", label: "Items purchased", type: "table", required: true,
    question: "Which items were purchased (name, quantity, unit cost)?", sensitive: false, aiDraftable: false, section: S.items,
    columns: [
      { key: "name", label: "Name of item", type: "text", width: 3 },
      { key: "qty", label: "Qty", type: "number", width: 1 },
      { key: "unit_cost", label: "Unit cost (Rs.)", type: "number", width: 1.5 },
      { key: "total", label: "Total (Rs.)", type: "number", width: 1.5 },
    ],
  },
  taxes: {
    key: "taxes", label: "Taxes or other charges (Rs.)", type: "number", required: false,
    question: "Any taxes or other charges on the invoice?", sensitive: false, aiDraftable: false, section: S.items,
  },
  supplier_name: {
    key: "supplier_name", label: "Name of the supplier", type: "text", required: true,
    question: "Who is the supplier?", sensitive: false, aiDraftable: false, section: S.supplier,
  },
  supplier_gst: {
    key: "supplier_gst", label: "GST no.", type: "text", required: true,
    question: "What is the supplier's GST number (from the invoice)?", sensitive: true, aiDraftable: false, section: S.supplier,
  },
  invoice_no: {
    key: "invoice_no", label: "Invoice no.", type: "text", required: true,
    question: "What is the invoice number?", sensitive: true, aiDraftable: false, section: S.supplier,
  },
  invoice_date: {
    key: "invoice_date", label: "Invoice date", type: "date", required: true,
    question: "What is the invoice date?", sensitive: false, aiDraftable: false, section: S.supplier,
  },
  payee_name: {
    key: "payee_name", label: "Name of the party", type: "text", required: true,
    question: "Who should receive the payment?", sensitive: false, aiDraftable: false, section: S.payment,
  },
  account_number: {
    key: "account_number", label: "Account number", type: "text", required: true,
    question: "What is the payee's bank account number?", sensitive: true, aiDraftable: false, section: S.payment,
  },
  account_holder: {
    key: "account_holder", label: "Account holder name", type: "text", required: true,
    question: "Whose name is the account in?", sensitive: true, aiDraftable: false, section: S.payment,
  },
  bank_name: {
    key: "bank_name", label: "Name of the bank", type: "text", required: true,
    question: "Which bank is the account with?", sensitive: true, aiDraftable: false, section: S.payment,
  },
  bank_branch: {
    key: "bank_branch", label: "Name of the branch", type: "text", required: false,
    question: "Which branch?", sensitive: true, aiDraftable: false, section: S.payment,
  },
  ifsc: {
    key: "ifsc", label: "IFSC code", type: "text", required: true,
    question: "What is the IFSC code of the branch?", sensitive: true, aiDraftable: false, section: S.payment,
  },
  stock_office: {
    key: "stock_office", label: "Laboratory / office for stock entry", type: "text", required: false,
    question: "Which office maintains the stock register?", sensitive: false, aiDraftable: false, section: S.indenter,
  },
  indenter_name: {
    key: "indenter_name", label: "Indenter (Faculty Chairman)", type: "text", required: true,
    question: "Who is the indenter (Faculty Chairman / Co-Chairman)?", sensitive: false, aiDraftable: false, section: S.indenter,
  },
  indenter_designation: {
    key: "indenter_designation", label: "Indenter designation", type: "text", required: true,
    question: "What is the indenter's designation?", sensitive: false, aiDraftable: false, section: S.indenter,
  },
  indenter_department: {
    key: "indenter_department", label: "Department", type: "text", required: true,
    question: "Which department does the indenter belong to?", sensitive: false, aiDraftable: false, section: S.indenter,
  },

  /* ---------- bill summary ---------- */
  summary_date: {
    key: "summary_date", label: "Summary date", type: "date", required: false,
    question: "What date should appear on the bill summary?", sensitive: false, aiDraftable: false, section: S.letter,
  },
  reimbursements: {
    key: "reimbursements", label: "Reimbursement table", type: "table", required: true,
    question: "Who should be reimbursed, and how much?", sensitive: false, aiDraftable: false, section: S.reimburse,
    columns: [
      { key: "name", label: "Name", type: "text", width: 2 },
      { key: "account", label: "Account details", type: "text", sensitive: true, width: 2 },
      { key: "paid_to", label: "To be paid to", type: "text", width: 2 },
      { key: "amount", label: "Amount (INR)", type: "number", width: 1 },
    ],
  },
  other_accounts: {
    key: "other_accounts", label: "Other bank accounts", type: "table", required: false,
    question: "Are there other bank accounts to be paid?", sensitive: false, aiDraftable: false, section: S.reimburse,
    columns: [
      { key: "name", label: "Name", type: "text", width: 2 },
      { key: "account_no", label: "Account no.", type: "text", sensitive: true, width: 2 },
      { key: "ifsc", label: "IFSC code", type: "text", sensitive: true, width: 1.5 },
      { key: "amount", label: "Amount", type: "number", width: 1 },
    ],
  },
  signatories: {
    key: "signatories", label: "Signatories", type: "table", required: true,
    question: "Who signs the bill summary?", sensitive: false, aiDraftable: false, section: S.contacts,
    helpText: "Names come from the club profile. Physical signatures are added on paper.",
    columns: [
      { key: "role", label: "Role", type: "text", width: 1.5 },
      { key: "name", label: "Name", type: "text", width: 2 },
      { key: "org", label: "Organisation", type: "text", width: 1.5 },
    ],
  },
};

function pick(keys: string[], overrides: Record<string, Partial<Placeholder>> = {}): Placeholder[] {
  return keys.map((k) => ({ ...FIELD_CATALOG[k], ...overrides[k] }));
}

export const mockTemplates: Template[] = [
  {
    id: "room-permission",
    name: "Room Permission Letter",
    shortName: "Room Permission",
    description: "Request to the HoD for using a seminar hall or lab, with event details and contact persons.",
    authority: "HoD (CSE Dept.)",
    refCategory: "ROOM",
    fileName: "room_permission_v3.docx",
    version: 3,
    updatedAt: "2026-08-02T10:15:00+05:30",
    usageCount: 14,
    placeholders: pick([
      "ref_no", "letter_date", "submitted_to", "subject",
      "event_title", "event_category", "start_date", "end_date", "start_time", "end_time", "venue", "mode",
      "schedule", "description", "objective", "participants", "organizers",
      "faculty_coordinator", "contacts",
    ]),
    rules: [
      { id: "r1", description: "Event is held offline or hybrid on campus", condition: "mode in ['Offline','Hybrid']" },
      { id: "r2", description: "A venue (hall, lab, room) is mentioned", condition: "venue != null" },
    ],
  },
  {
    id: "bill-certificate",
    name: "Bill Certificate (Form BC-R)",
    shortName: "Bill Certificate",
    description: "Dean Student Welfare form for recurring expenditure: items purchased, supplier and payment details.",
    authority: "Dean Student Welfare",
    refCategory: "BILL",
    fileName: "bill_certificate_bcr.docx",
    version: 2,
    updatedAt: "2026-07-21T16:40:00+05:30",
    usageCount: 9,
    placeholders: pick([
      "chapter_name", "head_of_account", "approval_note_no", "approval_date", "purchase_order", "advance_drawn",
      "event_title",
      "items", "taxes",
      "supplier_name", "supplier_gst", "invoice_no", "invoice_date",
      "payee_name", "account_number", "account_holder", "bank_name", "bank_branch", "ifsc",
      "certifying_person", "stock_office", "indenter_name", "indenter_designation", "indenter_department",
    ], { event_title: { required: false } }),
    rules: [
      { id: "r1", description: "Purchases, refreshments, printing or other expenses are mentioned", condition: "has_expenses == true" },
      { id: "r2", description: "Event is a workshop, hackathon or competition (usually involves purchases)", condition: "category in ['workshop','hackathon','competition']" },
    ],
  },
  {
    id: "bill-summary",
    name: "Bill Summary",
    shortName: "Bill Summary",
    description: "Reimbursement summary listing who is paid how much, with bank account details and signatories.",
    authority: "Faculty Chairman",
    refCategory: "SUM",
    fileName: "bill_summary.docx",
    version: 1,
    updatedAt: "2026-06-30T12:00:00+05:30",
    usageCount: 6,
    placeholders: pick(["event_title", "summary_date", "reimbursements", "other_accounts", "signatories"]),
    rules: [
      { id: "r1", description: "Prize money or reimbursements are involved", condition: "has_prizes or has_reimbursements" },
      { id: "r2", description: "Event is a hackathon or competition", condition: "category in ['hackathon','competition']" },
    ],
  },
];
