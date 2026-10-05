/**
 * Mock "AI" extraction. In production this lives in the FastAPI backend
 * (LLM + rules). Here we use a few regexes so the demo feels real.
 *
 * Golden rule mirrored from the product spec: sensitive / official fields
 * (reference numbers, bank details, GST, mobile numbers, signatures) are
 * NEVER filled automatically. They stay `missing` until a human types them.
 */
import type {
  Club,
  ClubEvent,
  DocumentRecommendation,
  EventCategory,
  EventFormInput,
  ExtractedField,
  FieldSource,
  FieldValue,
  FieldValues,
  Placeholder,
  TableRow,
  Template,
} from "../types";
import { formatReference, isEmptyValue } from "../fields";
import { formatDate, formatDateRange, formatTime, todayIso } from "../format";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

export interface ExtractionResult {
  values: FieldValues;
  sources: Record<string, FieldSource>;
  confidence: Record<string, number>;
  category: EventCategory;
  flags: { hasExpenses: boolean; hasPrizes: boolean };
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function guessYear(month: number, day: number): number {
  const now = new Date();
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  // If the date already passed by more than a month, assume next year.
  return candidate.getTime() < now.getTime() - 30 * 86400_000 ? y + 1 : y;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function titleCase(s: string): string {
  const small = new Set(["and", "or", "of", "on", "in", "the", "a", "an", "for", "to", "with", "&"]);
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z0-9]{2,}$/.test(w)) return w; // keep acronyms (ACM, AI, ML)
      const lw = w.toLowerCase();
      if (i > 0 && small.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

function to24h(h: string, m: string | undefined, ap: string): string {
  let hour = Number(h) % 12;
  if (ap.toLowerCase() === "pm") hour += 12;
  return `${String(hour).padStart(2, "0")}:${m ?? "00"}`;
}

export function detectCategory(text: string): EventCategory {
  const t = text.toLowerCase();
  if (/hackathon/.test(t)) return "hackathon";
  if (/workshop|bootcamp|hands-on/.test(t)) return "workshop";
  if (/competition|contest|quiz|coding round/.test(t)) return "competition";
  if (/seminar|symposium/.test(t)) return "seminar";
  if (/talk|lecture|session|webinar/.test(t)) return "talk";
  if (/meet|meeting|orientation/.test(t)) return "meeting";
  return "other";
}

/** Parse free text into field values. Only non-sensitive fields are ever set. */
export function extractFromText(text: string): ExtractionResult {
  const values: FieldValues = {};
  const sources: Record<string, FieldSource> = {};
  const confidence: Record<string, number> = {};
  const set = (key: string, value: FieldValue, conf: number, source: FieldSource = "user_text") => {
    values[key] = value;
    sources[key] = source;
    confidence[key] = conf;
  };

  const clean = text.replace(/\s+/g, " ").trim();

  // ---- Title -------------------------------------------------------
  const titleMatch =
    /(?:conduct(?:ing)?|organi[sz](?:e|ing)|host(?:ing)?|hold(?:ing)?|plan(?:ning)?|arrang(?:e|ing))\s+(?:an?\s+|the\s+|our\s+)?(?:(one|two|three|four|five|\d+)[- ]day\s+)?(.+?)(?=\s+(?:on|in|at|for|from|during|between|with)\s|[,.;]|$)/i.exec(clean);
  let durationDays = 1;
  if (titleMatch) {
    const d = titleMatch[1];
    if (d) durationDays = NUM_WORDS[d.toLowerCase()] ?? (Number(d) || 1);
    set("event_title", titleCase(titleMatch[2].replace(/^(a|an|the)\s+/i, "")), 0.86);
  } else {
    const dayMatch = /(one|two|three|four|five|\d+)[- ]day/i.exec(clean);
    if (dayMatch) durationDays = NUM_WORDS[dayMatch[1].toLowerCase()] ?? (Number(dayMatch[1]) || 1);
  }

  // ---- Dates -------------------------------------------------------
  const rangeRe = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|—|to|and|&)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}(?:,?\\s+(\\d{4}))?`, "i");
  const singleRe = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?`, "i");
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/;
  const range = rangeRe.exec(clean);
  if (range) {
    const month = MONTHS[range[3].slice(0, 3).toLowerCase()];
    const year = range[4] ? Number(range[4]) : guessYear(month, Number(range[1]));
    set("start_date", iso(year, month, Number(range[1])), 0.93);
    set("end_date", iso(year, month, Number(range[2])), 0.93);
  } else {
    const single = singleRe.exec(clean);
    const isoM = isoRe.exec(clean);
    let start: string | null = null;
    if (single) {
      const month = MONTHS[single[2].slice(0, 3).toLowerCase()];
      const year = single[3] ? Number(single[3]) : guessYear(month, Number(single[1]));
      start = iso(year, month, Number(single[1]));
    } else if (isoM) {
      start = isoM[0];
    }
    if (start) {
      set("start_date", start, 0.9);
      // End date inferred from "two-day" → lower confidence.
      set("end_date", addDays(start, durationDays - 1), durationDays > 1 ? 0.72 : 0.8);
    }
  }

  // ---- Time --------------------------------------------------------
  const timeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:-|–|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  const tm = timeRe.exec(clean);
  if (tm) {
    set("start_time", to24h(tm[1], tm[2], tm[3]), 0.9);
    set("end_time", to24h(tm[4], tm[5], tm[6]), 0.9);
  }

  // ---- Venue -------------------------------------------------------
  const venueRe =
    /\b(?:in|at)\s+(?:the\s+)?((?:[A-Z0-9][\w.&-]*\s+){0,4}(?:Seminar Hall|Hall|Auditorium|Lab(?:oratory)?|Room|Theatre|Theater|Centre|Center|LT|Amphitheatre|Ground)(?:[\s-]*\d+[A-Z]?)?(?:,\s*[A-Z][\w\s&]*?Department)?)/;
  const vm = venueRe.exec(text) ?? /\b(?:in|at)\s+(?:the\s+)?(seminar hall(?:\s*\d+)?|auditorium|lab\s*\d*)/i.exec(text);
  if (vm) set("venue", titleCase(vm[1]).replace(/\bLt\b/, "LT"), 0.88);

  // ---- Participants ------------------------------------------------
  const pm = /(?:around|about|approx\.?|approximately|nearly|~|over)?\s*(\d{2,5})\s*(\+)?\s*(?:students|participants|attendees|people|members|delegates)/i.exec(clean);
  if (pm) set("participants", `${pm[1]}${pm[2] ?? ""}`, 0.9);

  // ---- Mode --------------------------------------------------------
  if (/hybrid/i.test(clean)) set("mode", "Hybrid", 0.92);
  else if (/online|virtual|google meet|zoom|webinar/i.test(clean)) set("mode", "Online", 0.9);
  else if (/offline|in[- ]person/i.test(clean)) set("mode", "Offline", 0.92);
  else if (values.venue) set("mode", "Offline", 0.7);

  // ---- Category ----------------------------------------------------
  const category = detectCategory(clean);
  set("event_category", category, 0.8);

  return {
    values,
    sources,
    confidence,
    category,
    flags: {
      hasExpenses: /refreshment|snack|lunch|food|purchase|print|goodies|kit|stationery|banner|bill|expense|swag|certificate/i.test(clean) ||
        ["workshop", "hackathon", "competition"].includes(category),
      hasPrizes: /prize|reward|reimburse|winner|cash/i.test(clean) || ["hackathon", "competition"].includes(category),
    },
  };
}

/** Values the club profile can legitimately supply. */
export function clubProfileValues(club: Club, venue: string | null): FieldValues {
  const chair = club.signatories.find((s) => /chairperson|student head/i.test(s.role));
  const secretary = club.signatories.find((s) => /secretary/i.test(s.role));
  const faculty = club.signatories.find((s) => /faculty/i.test(s.role));
  const [facDesignation, facDept] = (faculty?.designation ?? "").split(",").map((s) => s.trim());
  const contacts: TableRow[] = [
    { name: chair?.name ?? "", designation: chair?.designation ?? "", admission_no: "", branch: "", mobile: "" },
    { name: "", designation: `Tech Assistant, ${venue ?? "Venue"}`, admission_no: "", branch: club.department, mobile: "" },
    { name: "", designation: `Faculty in-charge, ${venue ?? "Venue"}`, admission_no: "", branch: club.department, mobile: "" },
    { name: faculty?.name ?? "", designation: `Chairman, ${club.shortName}`, admission_no: "", branch: club.department, mobile: "" },
  ];
  const org = `${club.shortName} NIT-Surat`;
  return {
    submitted_to: club.defaultSubmittedTo,
    organizers: `${club.shortName} Core ${club.academicYear}`,
    chapter_name: club.shortName,
    stock_office: "Student Council",
    indenter_name: faculty?.name ?? null,
    indenter_designation: facDesignation || null,
    indenter_department: facDept?.replace(/^.*\b(CSE|ECE|EE|ME|CE|CHE)\b.*$/, "$1") || null,
    contacts,
    signatories: [
      { role: "Student Head", name: chair?.name ?? "", org },
      { role: "Student Secretary", name: secretary?.name ?? "", org },
      { role: "Faculty Chairman", name: faculty?.name ?? "", org },
    ],
  };
}

/** AI-drafted text for draftable fields. Always flagged "AI draft – review". */
export function aiDrafts(values: FieldValues, club: Club): FieldValues {
  const title = (values.event_title as string) || "the event";
  const venue = (values.venue as string) || "the requested venue";
  const category = (values.event_category as string) || "event";
  const participants = (values.participants as string) || "";
  const drafts: FieldValues = {
    subject: `Requesting Permission to Conduct ${title} in ${venue}.`,
    description:
      `${club.shortName} NIT Surat is organizing ${/^[aeiou]/i.test(title) ? "an" : "a"} ${title}` +
      (category === "workshop" ? ", a hands-on session where participants will learn through guided exercises and live demonstrations" : "") +
      `. The ${category} is open to students${participants ? ` (around ${participants} participants are expected)` : ""} and aims to build practical skills and encourage peer learning.`,
    objective:
      `To give participants practical exposure to the topics covered in ${title}, encourage hands-on learning, and foster a collaborative technical community in alignment with the chapter's vision.`,
  };
  const start = values.start_date as string | null;
  const end = (values.end_date as string | null) ?? start;
  if (start) {
    const rows: TableRow[] = [];
    const time = values.start_time && values.end_time
      ? `${formatTime(values.start_time as string)} – ${formatTime(values.end_time as string)}`
      : "";
    let d = start;
    let i = 1;
    while (d <= (end ?? start) && i <= 7) {
      rows.push({ date: formatDate(d), time, session: `Day ${i}: ${title}` });
      d = addDays(d, 1);
      i++;
    }
    drafts.schedule = rows;
  }
  return drafts;
}

export function allPlaceholders(templates: Template[]): Placeholder[] {
  const map = new Map<string, Placeholder>();
  for (const t of templates) {
    for (const p of t.placeholders) {
      const existing = map.get(p.key);
      map.set(p.key, existing ? { ...existing, required: existing.required || p.required } : p);
    }
  }
  return [...map.values()];
}

/** Suggestions are shown next to a field; the user must click to accept. */
export function suggestions(club: Club): Record<string, string> {
  const room = club.referenceFormats.find((f) => f.category === "ROOM");
  const faculty = club.signatories.find((s) => /faculty/i.test(s.role));
  const out: Record<string, string> = {
    letter_date: todayIso(),
    summary_date: todayIso(),
  };
  if (room) out.ref_no = formatReference(room.pattern, room.counter + 1, club);
  if (faculty) {
    out.faculty_coordinator = faculty.name;
    out.certifying_person = faculty.name;
  }
  return out;
}

/**
 * Merge user values, club profile values and AI drafts into ExtractedField[].
 * Priority: user text > club profile > AI draft > missing.
 */
export function buildFields(
  templates: Template[],
  club: Club,
  user: ExtractionResult | { values: FieldValues; sources?: Record<string, FieldSource>; confidence?: Record<string, number> },
  opts: { withDrafts?: boolean; confirmedSensitive?: boolean } = {},
): ExtractedField[] {
  const withDrafts = opts.withDrafts ?? true;
  const profile = clubProfileValues(club, (user.values.venue as string) ?? null);
  const drafts = withDrafts ? aiDrafts({ ...profile, ...user.values }, club) : {};
  const sugg = suggestions(club);

  return allPlaceholders(templates).map((p) => {
    let value: FieldValue = null;
    let source: FieldSource = "missing";
    let conf = 0;
    const userVal = user.values[p.key];
    const neverAI = p.neverAI || !!p.sensitive;
    const masked = p.masked || /bank|ifsc|gst|mobile|account/i.test(p.key);

    if (!isEmptyValue(userVal)) {
      value = userVal;
      source = user.sources?.[p.key] ?? "user_text";
      conf = user.confidence?.[p.key] ?? 0.95;
    } else if (!neverAI && !isEmptyValue(profile[p.key])) {
      value = profile[p.key];
      source = "club_profile";
      conf = 1;
    } else if (!neverAI && p.aiDraftable && !isEmptyValue(drafts[p.key])) {
      value = drafts[p.key];
      source = "ai_draft";
      conf = 0.6;
    }
    // Hard guard: neverAI / official fields only survive when explicitly typed by a human
    if (neverAI && source !== "user_text") {
      value = null;
      source = "missing";
      conf = 0;
    }
    return {
      key: p.key,
      label: p.label,
      type: p.type,
      value,
      source,
      confidence: conf,
      required: p.required,
      neverAI,
      masked,
      sensitive: p.sensitive,
      aiDraftable: p.aiDraftable,
      question: p.question,
      section: p.section,
      shared: p.shared,
      options: p.options,
      columns: p.columns,
      helpText: p.helpText,
      userConfirmed: neverAI && source === "user_text" ? true : undefined,
      suggestion: sugg[p.key],
    };
  });
}

export function formToValues(form: EventFormInput): FieldValues {
  const v: FieldValues = {
    event_title: form.title,
    event_category: form.category,
    start_date: form.startDate,
    end_date: form.endDate || form.startDate,
    start_time: form.startTime,
    end_time: form.endTime,
    venue: form.venue,
    mode: form.mode ? form.mode.charAt(0).toUpperCase() + form.mode.slice(1) : "",
    participants: form.participants,
    description: form.description,
    objective: form.objective,
    organizers: form.organizers,
  };
  for (const k of Object.keys(v)) if (isEmptyValue(v[k])) delete v[k];
  return v;
}

/** Decide which templates to recommend and why. */
export function recommend(event: ClubEvent, templates: Template[]): DocumentRecommendation[] {
  const values = Object.fromEntries(event.fields.map((f) => [f.key, f.value]));
  const text = (event.sourceText ?? "") + " " + (values.description ?? "");
  const flags = extractFromText(text).flags;
  const category = event.category;
  const mode = (values.mode as string) ?? "";

  return templates.map((t) => {
    const missingKeys = t.placeholders
      .filter((p) => p.required && isEmptyValue(values[p.key]))
      .map((p) => p.key);
    let recommended = false;
    let reason = "Not usually needed for this kind of event — select it if required.";
    if (t.id === "room-permission") {
      recommended = !!values.venue && mode !== "Online";
      reason = recommended
        ? `You need ${values.venue} on ${formatDateRange(event.startDate, event.endDate) || "the event dates"}; the HoD must approve room usage.`
        : mode === "Online"
          ? "The event is online, so no room booking is needed."
          : "No venue detected yet — add a venue if you need a hall or lab.";
    } else if (t.id === "bill-certificate") {
      recommended = flags.hasExpenses;
      reason = recommended
        ? `${category.charAt(0).toUpperCase() + category.slice(1)}s usually involve purchases (refreshments, printing, kits) that DSW reimburses via Form BC-R.`
        : "Only needed if you buy items or services for the event.";
    } else if (t.id === "bill-summary") {
      recommended = flags.hasPrizes;
      reason = recommended
        ? "Prize money or reimbursements must be summarised with bank details for payment."
        : "Only needed when there is prize money or reimbursements to individuals.";
    } else {
      reason = t.rules[0] ? `Rule: ${t.rules[0].description}` : "Custom template — select if needed.";
    }
    return { templateId: t.id, templateName: t.name, reason, recommended, missingKeys };
  });
}
