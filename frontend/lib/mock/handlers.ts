/**
 * Mock implementations of every API call. `lib/api.ts` delegates here while
 * NEXT_PUBLIC_USE_MOCK is not "false". Signatures intentionally mirror api.ts.
 */
import type {
  Club,
  ClubEvent,
  DashboardStats,
  DocumentFilters,
  DocumentRecommendation,
  DocumentSummary,
  EventFormInput,
  EventSummary,
  ExportFormat,
  ExportResult,
  FieldValue,
  FieldValues,
  GenerateOptions,
  GeneratedDocument,
  NewTemplateInput,
  Placeholder,
  SaveDocumentResult,
  Status,
  Template,
  TemplateAnalysis,
} from "../types";
import { asRows, asText, formatReference, isEmptyValue, missingRequiredKeys } from "../fields";
import { formatDateTime } from "../format";
import { buildFields, extractFromText, formToValues, recommend } from "./extract";
import { docValuesFor } from "./seed";
import { delay, getDB, nextId, persist, resetDB } from "./store";
import { detectDocxPlaceholders } from "./docx";
import { FIELD_CATALOG } from "./templates";

class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

const now = () => new Date().toISOString();

function findEvent(id: string): ClubEvent {
  const e = getDB().events.find((x) => x.id === id);
  if (!e) throw new NotFoundError("Event");
  return e;
}
function findDoc(id: string): GeneratedDocument {
  const d = getDB().documents.find((x) => x.id === id);
  if (!d) throw new NotFoundError("Document");
  return d;
}
function findTemplate(id: string): Template {
  const t = getDB().templates.find((x) => x.id === id);
  if (!t) throw new NotFoundError("Template");
  return t;
}

function eventValues(e: ClubEvent): FieldValues {
  return Object.fromEntries(e.fields.map((f) => [f.key, f.value]));
}

/** Required keys missing for the recommended (or already generated) templates. */
function eventMissing(e: ClubEvent): string[] {
  const db = getDB();
  const generated = new Set(db.documents.filter((d) => d.eventId === e.id).map((d) => d.templateId));
  const recs = recommend(e, db.templates).filter((r) => r.recommended || generated.has(r.templateId));
  return [...new Set(recs.flatMap((r) => r.missingKeys))];
}

function refreshEventSummary(e: ClubEvent) {
  const v = eventValues(e);
  e.title = asText(v.event_title) || "Untitled event";
  e.category = (asText(v.event_category) as ClubEvent["category"]) || e.category;
  e.startDate = asText(v.start_date) || null;
  e.endDate = asText(v.end_date) || null;
  e.venue = asText(v.venue) || null;
  if (e.status !== "approved") {
    const filled = e.fields.filter((f) => f.source === "user_text").length;
    e.status = filled < 3 ? "draft" : eventMissing(e).length ? "needs_info" : "ready";
  }
}

function toEventSummary(e: ClubEvent): EventSummary {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    startDate: e.startDate,
    endDate: e.endDate,
    venue: e.venue,
    status: e.status,
    documentCount: e.documentIds.length,
    missingCount: eventMissing(e).length,
    updatedAt: e.updatedAt,
  };
}

function toDocSummary(d: GeneratedDocument): DocumentSummary {
  const t = getDB().templates.find((x) => x.id === d.templateId);
  return {
    id: d.id,
    eventId: d.eventId,
    eventTitle: d.eventTitle,
    templateId: d.templateId,
    templateName: d.templateName,
    status: d.status,
    currentVersion: d.currentVersion,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    outOfSync: d.outOfSync,
    missingCount: t ? missingRequiredKeys(t.placeholders, d.values).length : 0,
  };
}

function pushVersion(d: GeneratedDocument, values: FieldValues, note: string, author = "You") {
  const version = d.currentVersion + 1;
  d.versions.push({ version, createdAt: now(), author, note, values: structuredClone(values) });
  d.currentVersion = version;
  d.values = structuredClone(values);
  d.updatedAt = now();
  const t = getDB().templates.find((x) => x.id === d.templateId);
  d.hasPlaceholders = t ? missingRequiredKeys(t.placeholders, values).length > 0 : false;
}

/* ================================================================== */
/* Club                                                                */
/* ================================================================== */

export async function getClub(): Promise<Club> {
  return delay(getDB().club);
}

export async function updateClub(club: Club): Promise<Club> {
  getDB().club = structuredClone(club);
  persist();
  return delay(club, 400);
}

/** Explicitly reserve the next reference number for a category. */
export async function reserveReference(category: string): Promise<string> {
  const club = getDB().club;
  const fmt = club.referenceFormats.find((f) => f.category === category);
  if (!fmt) throw new NotFoundError(`Reference format ${category}`);
  fmt.counter += 1;
  persist();
  return delay(formatReference(fmt.pattern, fmt.counter, club), 250);
}

/* ================================================================== */
/* Events                                                              */
/* ================================================================== */

export async function listEvents(): Promise<EventSummary[]> {
  const list = [...getDB().events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return delay(list.map(toEventSummary));
}

export async function getEvent(id: string): Promise<ClubEvent> {
  return delay(findEvent(id));
}

function createEvent(sourceText: string | null, fields: ClubEvent["fields"]): ClubEvent {
  const e: ClubEvent = {
    id: nextId("evt"),
    title: "",
    category: "other",
    startDate: null,
    endDate: null,
    venue: null,
    status: "draft",
    createdAt: now(),
    updatedAt: now(),
    sourceText,
    fields,
    documentIds: [],
    lastGeneratedAt: null,
    changedSinceGeneration: false,
    changedKeys: [],
  };
  refreshEventSummary(e);
  getDB().events.push(e);
  persist();
  return e;
}

export async function createEventFromText(text: string): Promise<ClubEvent> {
  const db = getDB();
  const extraction = extractFromText(text);
  const e = createEvent(text, buildFields(db.templates, db.club, extraction));
  return delay(e, 900); // "AI" takes a moment
}

export async function createEventFromForm(form: EventFormInput): Promise<ClubEvent> {
  const db = getDB();
  const values = formToValues(form);
  const sources = Object.fromEntries(Object.keys(values).map((k) => [k, "user_text" as const]));
  const confidence = Object.fromEntries(Object.keys(values).map((k) => [k, 1]));
  const e = createEvent(null, buildFields(db.templates, db.club, { values, sources, confidence }));
  return delay(e, 600);
}

/** Apply user edits to event fields. Edited values become "From your text". */
export async function updateEventFields(id: string, updates: Record<string, FieldValue>): Promise<ClubEvent> {
  const e = findEvent(id);
  const db = getDB();
  const docTemplates = db.documents.filter((d) => d.eventId === id).map((d) => findTemplate(d.templateId));
  const docKeys = new Set(docTemplates.flatMap((t) => t.placeholders.map((p) => p.key)));
  for (const [key, value] of Object.entries(updates)) {
    const f = e.fields.find((x) => x.key === key);
    if (!f) continue;
    if (JSON.stringify(f.value) === JSON.stringify(value)) continue;
    f.value = value;
    f.source = isEmptyValue(value) ? "missing" : "user_text";
    f.confidence = isEmptyValue(value) ? 0 : 1;
    if (f.sensitive) f.userConfirmed = !isEmptyValue(value);
    if (e.documentIds.length && docKeys.has(key)) {
      e.changedSinceGeneration = true;
      if (!e.changedKeys.includes(key)) e.changedKeys.push(key);
    }
  }
  if (e.changedSinceGeneration) {
    for (const d of db.documents.filter((x) => x.eventId === id)) {
      const t = findTemplate(d.templateId);
      if (t.placeholders.some((p) => e.changedKeys.includes(p.key))) d.outOfSync = true;
    }
  }
  e.updatedAt = now();
  refreshEventSummary(e);
  persist();
  return delay(e, 400);
}

export async function getRecommendations(eventId: string): Promise<DocumentRecommendation[]> {
  const db = getDB();
  return delay(recommend(findEvent(eventId), db.templates), 300);
}

export async function generateDocuments(
  eventId: string,
  templateIds: string[],
  options: GenerateOptions,
): Promise<GeneratedDocument[]> {
  const db = getDB();
  const e = findEvent(eventId);
  const templates = templateIds.map(findTemplate);
  const values = eventValues(e);
  if (!options.allowPlaceholders) {
    const missing = templates.flatMap((t) => missingRequiredKeys(t.placeholders, values));
    if (missing.length) throw new Error(`Missing required fields: ${[...new Set(missing)].join(", ")}`);
  }
  const out: GeneratedDocument[] = [];
  for (const t of templates) {
    const docValues = docValuesFor(t, e.fields);
    const existing = db.documents.find((d) => d.eventId === e.id && d.templateId === t.id);
    if (existing) {
      pushVersion(existing, docValues, "Regenerated from event", "ClubDocs (generated)");
      existing.outOfSync = false;
      existing.eventTitle = e.title;
      out.push(existing);
      continue;
    }
    const d: GeneratedDocument = {
      id: nextId("doc"),
      eventId: e.id,
      eventTitle: e.title,
      templateId: t.id,
      templateName: t.name,
      title: `${t.shortName} — ${e.title}`,
      status: "draft",
      currentVersion: 1,
      values: docValues,
      versions: [{ version: 1, createdAt: now(), author: "ClubDocs (generated)", note: "Generated from event", values: docValues }],
      createdAt: now(),
      updatedAt: now(),
      outOfSync: false,
      hasPlaceholders: missingRequiredKeys(t.placeholders, docValues).length > 0,
    };
    d.status = d.hasPlaceholders ? "needs_info" : "ready";
    db.documents.push(d);
    e.documentIds.push(d.id);
    t.usageCount += 1;
    out.push(d);
  }
  e.lastGeneratedAt = now();
  e.changedSinceGeneration = false;
  e.changedKeys = [];
  e.updatedAt = now();
  refreshEventSummary(e);
  persist();
  return delay(out, 1100);
}

/** Push current event data into every document of the event (new versions). */
export async function regenerateFromEvent(eventId: string): Promise<GeneratedDocument[]> {
  const db = getDB();
  const e = findEvent(eventId);
  const ev = eventValues(e);
  const docs = db.documents.filter((d) => d.eventId === eventId);
  for (const d of docs) {
    const t = findTemplate(d.templateId);
    const merged: FieldValues = { ...d.values };
    for (const p of t.placeholders) {
      if (!isEmptyValue(ev[p.key])) merged[p.key] = ev[p.key];
    }
    pushVersion(d, merged, "Synced with latest event data", "ClubDocs (generated)");
    d.outOfSync = false;
    d.eventTitle = e.title;
    d.title = `${t.shortName} — ${e.title}`;
  }
  e.changedSinceGeneration = false;
  e.changedKeys = [];
  e.lastGeneratedAt = now();
  e.updatedAt = now();
  persist();
  return delay(docs, 900);
}

/* ================================================================== */
/* Documents                                                           */
/* ================================================================== */

export async function listDocuments(filters: DocumentFilters = {}): Promise<DocumentSummary[]> {
  let docs = [...getDB().documents];
  if (filters.eventId) docs = docs.filter((d) => d.eventId === filters.eventId);
  if (filters.templateId) docs = docs.filter((d) => d.templateId === filters.templateId);
  if (filters.status) docs = docs.filter((d) => d.status === filters.status);
  if (filters.from) docs = docs.filter((d) => d.createdAt.slice(0, 10) >= filters.from!);
  if (filters.to) docs = docs.filter((d) => d.createdAt.slice(0, 10) <= filters.to!);
  docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return delay(docs.map(toDocSummary));
}

export async function getDocument(id: string): Promise<GeneratedDocument> {
  return delay(findDoc(id));
}

/**
 * Save edits as a new version. Shared fields (title, dates, venue) are
 * propagated to the event and every other document of the event.
 */
export async function saveDocument(id: string, values: FieldValues, note = "Edited"): Promise<SaveDocumentResult> {
  const db = getDB();
  const d = findDoc(id);
  const t = findTemplate(d.templateId);
  const sharedKeys = t.placeholders
    .filter((p) => p.shared && JSON.stringify(values[p.key]) !== JSON.stringify(d.values[p.key]))
    .map((p) => p.key);
  pushVersion(d, values, note);
  if (d.status === "needs_info" && !d.hasPlaceholders) d.status = "ready";

  const e = findEvent(d.eventId);
  // Every edited key is mirrored to the event so future documents reuse it.
  for (const p of t.placeholders) {
    const f = e.fields.find((x) => x.key === p.key);
    if (f && JSON.stringify(f.value) !== JSON.stringify(values[p.key]) && !isEmptyValue(values[p.key])) {
      f.value = values[p.key];
      f.source = "user_text";
      f.confidence = 1;
      if (f.sensitive) f.userConfirmed = true;
    }
  }
  const propagatedTo: string[] = [];
  if (sharedKeys.length) {
    for (const other of db.documents.filter((x) => x.eventId === d.eventId && x.id !== d.id)) {
      const ot = findTemplate(other.templateId);
      const keys = sharedKeys.filter((k) => ot.placeholders.some((p) => p.key === k));
      if (!keys.length) continue;
      const next = { ...other.values };
      for (const k of keys) next[k] = values[k];
      pushVersion(other, next, `Synced ${keys.join(", ")} from ${t.shortName}`);
      propagatedTo.push(other.id);
    }
  }
  e.updatedAt = now();
  refreshEventSummary(e);
  d.eventTitle = e.title;
  persist();
  return delay({ document: d, propagatedTo }, 500);
}

export async function setDocumentStatus(id: string, status: Status): Promise<GeneratedDocument> {
  const d = findDoc(id);
  d.status = status;
  d.updatedAt = now();
  const e = findEvent(d.eventId);
  const docs = getDB().documents.filter((x) => x.eventId === e.id);
  if (docs.length && docs.every((x) => x.status === "approved")) e.status = "approved";
  else if (e.status === "approved") {
    e.status = "ready";
    refreshEventSummary(e);
  }
  persist();
  return delay(d, 300);
}

export async function restoreVersion(id: string, version: number): Promise<GeneratedDocument> {
  const d = findDoc(id);
  const v = d.versions.find((x) => x.version === version);
  if (!v) throw new NotFoundError(`Version v${version}`);
  pushVersion(d, v.values, `Restored v${version}`);
  persist();
  return delay(d, 400);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function exportDocument(id: string, format: ExportFormat): Promise<ExportResult> {
  const d = findDoc(id);
  if (format === "pdf") return delay({ kind: "print" } as ExportResult, 200);
  // Mock DOCX: a Word-compatible HTML document. The real backend renders the .docx template.
  const t = findTemplate(d.templateId);
  const club = getDB().club;
  const rows = t.placeholders
    .map((p) => {
      const v = d.values[p.key];
      let cell: string;
      if (p.type === "table") {
        const r = asRows(v);
        cell = r.length
          ? `<table border="1" cellpadding="4" style="border-collapse:collapse">${
              `<tr>${(p.columns ?? []).map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>` +
              r.map((row) => `<tr>${(p.columns ?? []).map((c) => `<td>${escapeHtml(row[c.key] || "[TO BE FILLED]")}</td>`).join("")}</tr>`).join("")
            }</table>`
          : "[TO BE FILLED]";
      } else {
        cell = escapeHtml(asText(v) || "[TO BE FILLED]");
      }
      return `<tr><td style="width:35%;vertical-align:top"><b>${escapeHtml(p.label)}</b></td><td>${cell}</td></tr>`;
    })
    .join("");
  const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(d.title)}</title></head>
<body style="font-family:'Times New Roman',serif">
<p style="text-align:center;color:${club.branding.primaryColor};font-size:18pt;font-weight:bold">${escapeHtml(club.branding.letterheadTitle)}</p>
<p style="text-align:center;font-size:11pt">${escapeHtml(club.branding.letterheadSubtitle)}</p><hr/>
<h2 style="text-align:center">${escapeHtml(t.name)}</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">${rows}</table>
<p style="font-size:9pt;color:#888">Generated by ClubDocs (mock export) · v${d.currentVersion} · ${formatDateTime(now())}</p>
</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const safe = d.title.replace(/[^\w\d-]+/g, "_").replace(/_+/g, "_");
  return delay({ kind: "file", blob, filename: `${safe}_v${d.currentVersion}.doc` } as ExportResult, 500);
}

/* ================================================================== */
/* Templates                                                           */
/* ================================================================== */

export async function listTemplates(): Promise<Template[]> {
  return delay(getDB().templates);
}

export async function getTemplate(id: string): Promise<Template> {
  return delay(findTemplate(id));
}

const SENSITIVE_RE = /(account|acc_no|ifsc|gst|pan|mobile|phone|contact_no|signature|sign|ref(erence)?_?no|approval_note|invoice_no|aadhar|aadhaar)/i;
const DRAFTABLE_RE = /(description|objective|about|summary|outcome|agenda|subject)/i;

function guessPlaceholder(key: string): Placeholder {
  if (FIELD_CATALOG[key]) return { ...FIELD_CATALOG[key] };
  const label = key.replace(/[_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const type: Placeholder["type"] = /date|_on$/i.test(key)
    ? "date"
    : /amount|total|qty|quantity|cost|count|number_of/i.test(key)
      ? "number"
      : /items|rows|list|table|members|accounts/i.test(key)
        ? "table"
        : DRAFTABLE_RE.test(key)
          ? "longtext"
          : "text";
  return {
    key,
    label,
    type,
    required: !/optional|note|remark/i.test(key),
    question: `What is the ${label.toLowerCase()}?`,
    sensitive: SENSITIVE_RE.test(key),
    aiDraftable: DRAFTABLE_RE.test(key) && !SENSITIVE_RE.test(key),
    section: "Details",
    columns: type === "table" ? [{ key: "name", label: "Name", type: "text" }, { key: "value", label: "Value", type: "text" }] : undefined,
  };
}

/** Very small YAML reader for `key:` blocks with `required/type/question` children. */
function applyYaml(placeholders: Placeholder[], yaml: string): { list: Placeholder[]; touched: number } {
  let touched = 0;
  const blocks = new Map<string, Record<string, string>>();
  let current: string | null = null;
  for (const line of yaml.split(/\r?\n/)) {
    const top = /^(?:-\s*key:\s*|)([a-zA-Z_]\w*):\s*$/.exec(line) ?? /^-\s*key:\s*([a-zA-Z_]\w*)\s*$/.exec(line);
    const child = /^\s+([a-z_]+):\s*(.+?)\s*$/.exec(line);
    if (top) {
      current = top[1];
      blocks.set(current, {});
    } else if (child && current) {
      blocks.get(current)![child[1]] = child[2].replace(/^["']|["']$/g, "");
    }
  }
  const list = placeholders.map((p) => {
    const b = blocks.get(p.key);
    if (!b) return p;
    touched++;
    return {
      ...p,
      label: b.label ?? p.label,
      type: (b.type as Placeholder["type"]) ?? p.type,
      required: b.required ? b.required === "true" : p.required,
      question: b.question ?? p.question,
      sensitive: b.sensitive ? b.sensitive === "true" : p.sensitive,
      aiDraftable: b.ai_draftable ? b.ai_draftable === "true" : p.aiDraftable,
    };
  });
  return { list, touched };
}

export async function analyzeTemplate(file: File, schemaFile?: File | null): Promise<TemplateAnalysis> {
  const warnings: string[] = [];
  let keys: string[] = [];
  try {
    keys = await detectDocxPlaceholders(file);
  } catch (err) {
    warnings.push(`Could not read the .docx: ${(err as Error).message}. Showing example placeholders.`);
  }
  if (!keys.length) {
    if (!warnings.length) warnings.push("No {{placeholders}} found in the document. Showing an example schema you can edit.");
    keys = ["event_title", "start_date", "venue", "organizer_name", "description", "items", "total_amount", "account_number", "ifsc", "coordinator_mobile"];
  }
  let detected = keys.map(guessPlaceholder);
  let yamlFileName: string | null = null;
  if (schemaFile) {
    yamlFileName = schemaFile.name;
    const { list, touched } = applyYaml(detected, await schemaFile.text());
    detected = list;
    warnings.push(`Schema YAML applied to ${touched} of ${detected.length} placeholders.`);
  }
  const sensitive = detected.filter((p) => p.sensitive).map((p) => p.label);
  if (sensitive.length) warnings.push(`Marked as sensitive (never auto-filled): ${sensitive.join(", ")}.`);
  return delay(
    {
      fileName: file.name,
      yamlFileName,
      detected,
      suggestedRules: [
        { id: "r1", description: "Event category matches this template", condition: "category in ['workshop']" },
      ],
      warnings,
    },
    1200,
  );
}

export async function createTemplate(input: NewTemplateInput): Promise<Template> {
  const t: Template = {
    id: nextId("tpl"),
    shortName: input.name.split(/[(—-]/)[0].trim(),
    version: 1,
    updatedAt: now(),
    usageCount: 0,
    ...input,
  };
  getDB().templates.push(t);
  persist();
  return delay(t, 600);
}

export async function updateTemplate(id: string, patch: Partial<Omit<Template, "id">>): Promise<Template> {
  const t = findTemplate(id);
  Object.assign(t, patch, { version: t.version + 1, updatedAt: now() });
  persist();
  return delay(t, 500);
}

/* ================================================================== */
/* Analytics                                                           */
/* ================================================================== */

export async function getStats(): Promise<DashboardStats> {
  const db = getDB();
  const month = now().slice(0, 7);
  const byTemplate = db.templates.map((t) => ({
    templateId: t.id,
    templateName: t.shortName,
    count: db.documents.filter((d) => d.templateId === t.id).length,
  }));
  return delay({
    totalDocuments: db.documents.length,
    documentsThisMonth: db.documents.filter((d) => d.createdAt.slice(0, 7) === month).length,
    totalEvents: db.events.length,
    eventsNeedingInfo: db.events.filter((e) => e.status === "needs_info").length,
    approvedDocuments: db.documents.filter((d) => d.status === "approved").length,
    byTemplate,
    hoursSaved: Math.round(db.documents.length * 0.75 * 10) / 10,
  });
}

export async function resetDemoData(): Promise<void> {
  resetDB();
  return delay(undefined, 300);
}
