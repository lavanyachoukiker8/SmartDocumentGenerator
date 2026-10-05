/**
 * ClubDocs domain types.
 *
 * These types are the contract between the UI and the API layer (`lib/api.ts`).
 * The FastAPI backend should return JSON matching these shapes (snake_case keys
 * are NOT converted automatically — keep the backend models in camelCase or add
 * a conversion step inside `lib/api.ts`).
 */

/* ------------------------------------------------------------------ */
/* Primitive enums                                                     */
/* ------------------------------------------------------------------ */

/** Lifecycle status used for both events and documents. */
export type Status = "draft" | "needs_info" | "ready" | "approved";

/** Where an extracted value came from. */
export type FieldSource = "user_text" | "club_profile" | "ai_draft" | "missing";

/** Data type of a placeholder / field. */
export type FieldType =
  | "text"
  | "longtext"
  | "date"
  | "time"
  | "number"
  | "select"
  | "table";

export type EventCategory =
  | "workshop"
  | "seminar"
  | "talk"
  | "competition"
  | "hackathon"
  | "meeting"
  | "other";

export type EventMode = "offline" | "online" | "hybrid";

/** A row inside a table field (items, contacts, bank accounts ...). */
export type TableRow = Record<string, string>;

/** A field value: scalar text, a table, or empty. */
export type FieldValue = string | TableRow[] | null;

/** Map of placeholder key -> value. */
export type FieldValues = Record<string, FieldValue>;

/* ------------------------------------------------------------------ */
/* Club profile                                                        */
/* ------------------------------------------------------------------ */

export interface Signatory {
  id: string;
  name: string;
  shortName: string;
  designation: string;
  /** Role in the documents, e.g. "Chairperson", "Faculty Chairman". */
  role: string;
}

export interface ReferenceFormat {
  /** Document category, e.g. ROOM, BILL, GEN. */
  category: string;
  /** Pattern with tokens {FY}, {AY}, {CLUB}, {seq}. */
  pattern: string;
  /** Last used sequence number. The next number is counter + 1. */
  counter: number;
}

export interface ClubBranding {
  /** Data URL or public path. */
  logoLeft: string;
  logoRight: string;
  primaryColor: string;
  darkColor: string;
  headingFont: string;
  bodyFont: string;
  letterheadTitle: string;
  letterheadSubtitle: string;
}

export interface Club {
  id: string;
  shortName: string;
  name: string;
  institute: string;
  department: string;
  branding: ClubBranding;
  defaultSubmittedTo: string;
  signatories: Signatory[];
  referenceFormats: ReferenceFormat[];
  /** e.g. "2026-27" */
  academicYear: string;
  /** e.g. "26-27" — used for {FY} */
  financialYear: string;
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export interface TableColumn {
  key: string;
  label: string;
  type: "text" | "number";
  sensitive?: boolean;
  /** Visual width hint in the editor (fr units). */
  width?: number;
}

export interface Placeholder {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Question asked to the user when the value is missing. */
  question: string;
  /** Official / personal data that must never be AI-filled. */
  sensitive: boolean;
  /** Text the AI may draft (description, objective ...). */
  aiDraftable: boolean;
  /** Editor section heading. */
  section: string;
  /** Shared across all documents of an event (title, dates, venue). */
  shared?: boolean;
  options?: string[];
  columns?: TableColumn[];
  helpText?: string;
}

export interface RecommendationRule {
  id: string;
  /** Human readable rule, shown in the UI. */
  description: string;
  /** Machine condition, evaluated by the backend. e.g. `venue != null` */
  condition: string;
}

export interface Template {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Addressed authority, e.g. "HoD (CSE Dept.)" */
  authority: string;
  /** Reference number category (matches ReferenceFormat.category). */
  refCategory: string;
  fileName: string;
  version: number;
  updatedAt: string;
  placeholders: Placeholder[];
  rules: RecommendationRule[];
  /** Number of documents generated from this template. */
  usageCount: number;
}

/** Result of uploading a .docx (and optional YAML) for a new template. */
export interface TemplateAnalysis {
  fileName: string;
  yamlFileName: string | null;
  detected: Placeholder[];
  suggestedRules: RecommendationRule[];
  warnings: string[];
}

export interface NewTemplateInput {
  name: string;
  description: string;
  authority: string;
  refCategory: string;
  fileName: string;
  placeholders: Placeholder[];
  rules: RecommendationRule[];
}

/* ------------------------------------------------------------------ */
/* Events & extraction                                                 */
/* ------------------------------------------------------------------ */

export interface ExtractedField {
  key: string;
  label: string;
  type: FieldType;
  value: FieldValue;
  source: FieldSource;
  /** 0..1 — model confidence. 0 for missing / club profile. */
  confidence: number;
  required: boolean;
  sensitive: boolean;
  aiDraftable: boolean;
  question: string;
  section: string;
  options?: string[];
  columns?: TableColumn[];
  helpText?: string;
  /** For sensitive fields: was the value explicitly entered by a human? */
  userConfirmed?: boolean;
  /** Optional suggestion the user may explicitly accept (never auto-applied). */
  suggestion?: string;
}

export interface DocumentRecommendation {
  templateId: string;
  templateName: string;
  reason: string;
  recommended: boolean;
  /** Keys of required fields this template still needs. */
  missingKeys: string[];
}

export interface ClubEvent {
  id: string;
  title: string;
  category: EventCategory;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  /** Original natural-language request, if any. */
  sourceText: string | null;
  fields: ExtractedField[];
  documentIds: string[];
  lastGeneratedAt: string | null;
  /** True when event fields changed after documents were generated. */
  changedSinceGeneration: boolean;
  /** Keys changed since last generation. */
  changedKeys: string[];
}

export interface EventSummary {
  id: string;
  title: string;
  category: EventCategory;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  status: Status;
  documentCount: number;
  missingCount: number;
  updatedAt: string;
}

export interface EventFormInput {
  title: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  mode: EventMode;
  participants: string;
  description: string;
  objective: string;
  organizers: string;
}

export interface GenerateOptions {
  /** Leave unfilled fields as [TO BE FILLED]. */
  allowPlaceholders: boolean;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export interface DocumentVersion {
  version: number;
  createdAt: string;
  author: string;
  note: string;
  values: FieldValues;
}

export interface GeneratedDocument {
  id: string;
  eventId: string;
  eventTitle: string;
  templateId: string;
  templateName: string;
  title: string;
  status: Status;
  currentVersion: number;
  values: FieldValues;
  versions: DocumentVersion[];
  createdAt: string;
  updatedAt: string;
  /** Event data changed after this document was generated. */
  outOfSync: boolean;
  /** Generated with [TO BE FILLED] placeholders. */
  hasPlaceholders: boolean;
}

export interface DocumentSummary {
  id: string;
  eventId: string;
  eventTitle: string;
  templateId: string;
  templateName: string;
  status: Status;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  outOfSync: boolean;
  missingCount: number;
}

export interface DocumentFilters {
  eventId?: string;
  templateId?: string;
  status?: Status;
  /** ISO date (inclusive) */
  from?: string;
  /** ISO date (inclusive) */
  to?: string;
}

export interface SaveDocumentResult {
  document: GeneratedDocument;
  /** Other documents updated because shared fields changed. */
  propagatedTo: string[];
}

export type ExportFormat = "docx" | "pdf";

export type ExportResult =
  | { kind: "file"; blob: Blob; filename: string }
  /** Mock only: ask the UI to print the on-screen A4 preview as PDF. */
  | { kind: "print" };

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardStats {
  totalDocuments: number;
  documentsThisMonth: number;
  totalEvents: number;
  eventsNeedingInfo: number;
  approvedDocuments: number;
  byTemplate: { templateId: string; templateName: string; count: number }[];
  /** Hours saved estimate (mock heuristic: 45 min / doc). */
  hoursSaved: number;
}
