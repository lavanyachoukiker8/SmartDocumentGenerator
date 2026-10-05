import type { ClubEvent, DocumentVersion, ExtractedField, FieldValues, GeneratedDocument, Status, Template } from "../types";
import { mockClub } from "./club";
import { mockTemplates } from "./templates";
import { buildFields, detectCategory, extractFromText } from "./extract";
import { missingRequiredKeys } from "../fields";

/** Values typed by humans for the seeded events. */
interface SeedEvent {
  id: string;
  status: Status;
  createdAt: string;
  sourceText: string | null;
  values: FieldValues;
  docs: { id: string; templateId: string; status: Status; createdAt: string; versions?: number }[];
  changedKeys?: string[];
}

const seedEvents: SeedEvent[] = [
  {
    id: "evt-1001",
    status: "approved",
    createdAt: "2026-08-04T18:20:00+05:30",
    sourceText:
      "ACM Executives Meet on 8 August 2026 from 6 pm to 7:30 pm in Seminar Hall 402, CSE Department, for 150+ members to plan upcoming activities.",
    values: {
      event_title: "ACM Executives Meet",
      event_category: "meeting",
      start_date: "2026-08-08",
      end_date: "2026-08-08",
      start_time: "18:00",
      end_time: "19:30",
      venue: "Seminar Hall 402, CSE Department",
      mode: "Offline",
      participants: "150+",
      description:
        "ACM NIT Surat is organizing an Executive Meet to discuss the chapter's vision, provide guidance on organizing events and initiatives, and facilitate effective collaboration among executive members. The meet will also focus on planning upcoming activities and coordinating group projects.",
      objective:
        "To provide guidance to the ACM executive team on organizing events, coordinating group projects, and fostering effective collaboration in alignment with the chapter's vision and upcoming initiatives.",
      ref_no: "ACM/26-27/ROOM/009",
      letter_date: "2026-08-05",
      subject: "Requesting Permission to Conduct ACM Executives Meet in Seminar Hall 402, CSE Department.",
      faculty_coordinator: "Dr. Sankita J. Patel",
      schedule: [{ date: "8 Aug 2026", time: "06:00 PM – 07:30 PM", session: "Executives Meet" }],
      contacts: [
        { name: "Ansh Gupta", designation: "Chairperson, ACM", admission_no: "I24AI005", branch: "Artificial Intelligence", mobile: "9876543210" },
        { name: "Sunny Bodiwala", designation: "Tech Assistant, Seminar Hall", admission_no: "", branch: "Computer Science & Engineering", mobile: "9876501234" },
        { name: "Shri. Rakesh P. Gohil", designation: "Faculty in-charge, Seminar Hall", admission_no: "", branch: "Computer Science & Engineering", mobile: "" },
        { name: "Dr. Sankita J. Patel", designation: "Chairman, ACM", admission_no: "", branch: "Computer Science & Engineering", mobile: "" },
      ],
    },
    docs: [{ id: "doc-2001", templateId: "room-permission", status: "approved", createdAt: "2026-08-05T09:10:00+05:30", versions: 2 }],
  },
  {
    id: "evt-1002",
    status: "ready",
    createdAt: "2026-09-02T11:00:00+05:30",
    sourceText:
      "SIH Internal Hackathon on 6–7 September 2026 in the Central Computer Centre for around 200 students. Prize money for top 3 teams and refreshments purchased.",
    values: {
      event_title: "SIH Internal Hackathon 2026",
      event_category: "hackathon",
      start_date: "2026-09-06",
      end_date: "2026-09-07",
      start_time: "09:00",
      end_time: "21:00",
      venue: "Central Computer Centre, Lab 3",
      mode: "Offline",
      participants: "200",
      approval_note_no: "ACM/2026-27/SIH/001",
      approval_date: "2026-09-08",
      head_of_account: "6/52",
      purchase_order: "NiL",
      advance_drawn: "NiL",
      certifying_person: "Dr. Sankita J. Patel",
      items: [
        { name: "Refreshments (tea, snacks) – Day 1", qty: "220", unit_cost: "35", total: "7700" },
        { name: "Refreshments (tea, snacks) – Day 2", qty: "210", unit_cost: "35", total: "7350" },
        { name: "Printing of problem statements", qty: "60", unit_cost: "12", total: "720" },
      ],
      taxes: "0",
      supplier_name: "Shree Caterers, Ichchhanath",
      supplier_gst: "24ABCDE1234F1Z5",
      invoice_no: "1059",
      invoice_date: "2026-09-08",
      payee_name: "Shree Caterers",
      account_number: "50100234561234",
      account_holder: "Shree Caterers",
      bank_name: "HDFC Bank",
      bank_branch: "Athwa Lines, Surat",
      ifsc: "HDFC0001234",
      reimbursements: [
        { name: "Team ByteForce", account: "XXXXXXXX7781 (SBI)", paid_to: "Riya Shah (Leader)", amount: "5000" },
        { name: "Team NullPointers", account: "XXXXXXXX2290 (BoB)", paid_to: "Karan Mehta (Leader)", amount: "3000" },
        { name: "Team Segfault", account: "XXXXXXXX0457 (HDFC)", paid_to: "Aditi Rao (Leader)", amount: "2000" },
      ],
      other_accounts: [],
      summary_date: "2026-09-10",
    },
    docs: [
      { id: "doc-2002", templateId: "bill-certificate", status: "ready", createdAt: "2026-09-09T15:30:00+05:30", versions: 3 },
      { id: "doc-2003", templateId: "bill-summary", status: "ready", createdAt: "2026-09-10T10:05:00+05:30", versions: 1 },
    ],
    changedKeys: ["venue"],
  },
  {
    id: "evt-1003",
    status: "needs_info",
    createdAt: "2026-10-04T20:15:00+05:30",
    sourceText:
      "We are conducting a two-day Web Development Workshop on 14–15 October in Seminar Hall for around 120 students",
    values: {},
    docs: [],
  },
  {
    id: "evt-1004",
    status: "draft",
    createdAt: "2026-10-05T19:40:00+05:30",
    sourceText: "Talk on competitive programming for first years, sometime next week, online.",
    values: {
      event_title: "Intro to Competitive Programming",
      event_category: "talk",
      mode: "Online",
    },
    docs: [],
  },
  {
    id: "evt-1005",
    status: "approved",
    createdAt: "2026-07-28T10:00:00+05:30",
    sourceText: null,
    values: {
      event_title: "Git & GitHub Bootcamp",
      event_category: "workshop",
      start_date: "2026-08-22",
      end_date: "2026-08-22",
      start_time: "14:00",
      end_time: "17:00",
      venue: "Seminar Hall 402, CSE Department",
      mode: "Offline",
      participants: "90",
      description: "A hands-on bootcamp introducing version control with Git and collaboration on GitHub through guided exercises.",
      objective: "To make students comfortable with Git workflows, pull requests and open-source contribution.",
      ref_no: "ACM/26-27/ROOM/007",
      faculty_coordinator: "Dr. Sankita J. Patel",
      approval_note_no: "ACM/2026-27/GIT/002",
      approval_date: "2026-08-24",
      head_of_account: "6/52",
      certifying_person: "Dr. Sankita J. Patel",
      items: [{ name: "Snacks for participants", qty: "95", unit_cost: "40", total: "3800" }],
      supplier_name: "Campus Canteen",
      supplier_gst: "24AAACC1111C1Z9",
      invoice_no: "CC/882",
      invoice_date: "2026-08-22",
      payee_name: "Campus Canteen",
      account_number: "33445566778899",
      account_holder: "Campus Canteen",
      bank_name: "State Bank of India",
      ifsc: "SBIN0001234",
    },
    docs: [
      { id: "doc-2004", templateId: "room-permission", status: "approved", createdAt: "2026-08-12T12:00:00+05:30" },
      { id: "doc-2005", templateId: "bill-certificate", status: "approved", createdAt: "2026-08-25T12:00:00+05:30", versions: 2 },
    ],
  },
  {
    id: "evt-1006",
    status: "approved",
    createdAt: "2026-09-15T09:00:00+05:30",
    sourceText: null,
    values: {
      event_title: "CodeSprint 2026",
      event_category: "competition",
      start_date: "2026-09-27",
      end_date: "2026-09-27",
      start_time: "10:00",
      end_time: "13:00",
      venue: "Lab 201, CSE Department",
      mode: "Offline",
      participants: "140",
      description: "A three-hour competitive coding contest for all years.",
      objective: "To encourage problem-solving and algorithmic thinking among students.",
      ref_no: "ACM/26-27/ROOM/008",
      faculty_coordinator: "Dr. Sankita J. Patel",
      reimbursements: [
        { name: "Winner", account: "XXXXXXXX5521 (SBI)", paid_to: "Meet Patel", amount: "3000" },
        { name: "Runner-up", account: "XXXXXXXX9912 (ICICI)", paid_to: "Sneha Iyer", amount: "2000" },
      ],
      summary_date: "2026-09-29",
    },
    docs: [
      { id: "doc-2006", templateId: "room-permission", status: "approved", createdAt: "2026-09-18T12:00:00+05:30" },
      { id: "doc-2007", templateId: "bill-summary", status: "approved", createdAt: "2026-09-29T12:00:00+05:30" },
    ],
  },
];

function valuesFromFields(fields: ExtractedField[]): FieldValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.value]));
}

export function docValuesFor(template: Template, fields: ExtractedField[]): FieldValues {
  const all = valuesFromFields(fields);
  return Object.fromEntries(template.placeholders.map((p) => [p.key, all[p.key] ?? null]));
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

export function buildSeed(): { events: ClubEvent[]; documents: GeneratedDocument[] } {
  const events: ClubEvent[] = [];
  const documents: GeneratedDocument[] = [];

  for (const s of seedEvents) {
    let fields: ExtractedField[];
    if (s.id === "evt-1003" && s.sourceText) {
      // Built through the same extraction path the UI uses.
      fields = buildFields(mockTemplates, mockClub, extractFromText(s.sourceText));
    } else {
      const sources = Object.fromEntries(Object.keys(s.values).map((k) => [k, "user_text" as const]));
      fields = buildFields(mockTemplates, mockClub, { values: s.values, sources }, { withDrafts: s.status !== "approved" });
    }
    const v = valuesFromFields(fields);
    const lastUpdate = s.docs.length ? addHours(s.docs[s.docs.length - 1].createdAt, 2) : s.createdAt;

    const docIds: string[] = [];
    for (const d of s.docs) {
      const tpl = mockTemplates.find((t) => t.id === d.templateId)!;
      const values = docValuesFor(tpl, fields);
      const n = d.versions ?? 1;
      const versions: DocumentVersion[] = Array.from({ length: n }, (_, i) => ({
        version: i + 1,
        createdAt: addHours(d.createdAt, i * 5),
        author: i === 0 ? "ClubDocs (generated)" : i % 2 ? "Arshad Khatib" : "Ansh Gupta",
        note: i === 0 ? "Generated from event" : i === n - 1 ? "Final corrections" : "Updated details",
        values,
      }));
      docIds.push(d.id);
      documents.push({
        id: d.id,
        eventId: s.id,
        eventTitle: (v.event_title as string) ?? "Untitled event",
        templateId: tpl.id,
        templateName: tpl.name,
        title: `${tpl.shortName} — ${v.event_title}`,
        status: d.status,
        currentVersion: n,
        values,
        versions,
        createdAt: d.createdAt,
        updatedAt: versions[n - 1].createdAt,
        outOfSync: !!s.changedKeys?.length,
        hasPlaceholders: missingRequiredKeys(tpl.placeholders, values).length > 0,
      });
    }

    // Simulate a venue change after generation for evt-1002.
    if (s.changedKeys?.includes("venue")) {
      const f = fields.find((x) => x.key === "venue")!;
      f.value = "Central Computer Centre, Lab 1 & 2";
    }

    events.push({
      id: s.id,
      title: (v.event_title as string) || "Untitled event",
      category: (v.event_category as ClubEvent["category"]) ?? detectCategory(s.sourceText ?? ""),
      startDate: (v.start_date as string) ?? null,
      endDate: (v.end_date as string) ?? null,
      venue: (fields.find((x) => x.key === "venue")?.value as string) ?? null,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.changedKeys?.length ? "2026-10-03T17:45:00+05:30" : lastUpdate,
      sourceText: s.sourceText,
      fields,
      documentIds: docIds,
      lastGeneratedAt: s.docs.length ? s.docs[s.docs.length - 1].createdAt : null,
      changedSinceGeneration: !!s.changedKeys?.length,
      changedKeys: s.changedKeys ?? [],
    });
  }
  return { events, documents };
}
