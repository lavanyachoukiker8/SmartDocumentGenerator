/**
 * Tiny in-browser "database" for the mock API.
 * Persists to localStorage so the demo survives page reloads.
 */
import type { Club, ClubEvent, GeneratedDocument, Template } from "../types";
import { mockClub } from "./club";
import { mockTemplates } from "./templates";
import { buildSeed } from "./seed";

export interface MockDB {
  club: Club;
  templates: Template[];
  events: ClubEvent[];
  documents: GeneratedDocument[];
  seq: number;
}

const OLD_STORAGE_KEY = "clubdocs.mock.v1";
const STORAGE_KEY = "clubdocs.mock.v2";
let db: MockDB | null = null;

function migrateV1toV2(rawV1: MockDB): MockDB {
  const isSecretKey = (k: string) => /bank|ifsc|gst|mobile|account/i.test(k);
  const isOfficialKey = (k: string) => /ref_no|approval|invoice|purchase|head_of_account|date/i.test(k);

  // Migrate templates
  for (const t of rawV1.templates || []) {
    for (const p of t.placeholders || []) {
      if (p.neverAI === undefined) {
        p.neverAI = isSecretKey(p.key) || isOfficialKey(p.key) || !!p.sensitive;
      }
      if (p.masked === undefined) {
        p.masked = isSecretKey(p.key);
      }
      if (p.columns) {
        for (const col of p.columns) {
          if (col.neverAI === undefined) col.neverAI = isSecretKey(col.key) || isOfficialKey(col.key) || !!col.sensitive;
          if (col.masked === undefined) col.masked = isSecretKey(col.key);
        }
      }
    }
  }

  // Migrate events
  for (const e of rawV1.events || []) {
    for (const f of e.fields || []) {
      if (f.neverAI === undefined) {
        f.neverAI = isSecretKey(f.key) || isOfficialKey(f.key) || !!f.sensitive;
      }
      if (f.masked === undefined) {
        f.masked = isSecretKey(f.key);
      }
      if (f.columns) {
        for (const col of f.columns) {
          if (col.neverAI === undefined) col.neverAI = isSecretKey(col.key) || isOfficialKey(col.key) || !!col.sensitive;
          if (col.masked === undefined) col.masked = isSecretKey(col.key);
        }
      }
    }
  }

  return rawV1;
}

function seed(): MockDB {
  const { events, documents } = buildSeed();
  return {
    club: structuredClone(mockClub),
    templates: structuredClone(mockTemplates),
    events,
    documents,
    seq: 3000,
  };
}

export function getDB(): MockDB {
  if (db) return db;
  if (typeof window !== "undefined") {
    try {
      const rawV2 = window.localStorage.getItem(STORAGE_KEY);
      if (rawV2) {
        db = JSON.parse(rawV2) as MockDB;
        return db;
      }
      const rawV1 = window.localStorage.getItem(OLD_STORAGE_KEY);
      if (rawV1) {
        const parsed = JSON.parse(rawV1) as MockDB;
        db = migrateV1toV2(parsed);
        persist();
        return db;
      }
    } catch {
      /* corrupted storage → reseed */
    }
  }
  db = seed();
  return db;
}

export function persist(): void {
  if (typeof window === "undefined" || !db) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota exceeded (large logos) — keep in memory only */
  }
}

export function resetDB(): void {
  db = seed();
  persist();
}

export function nextId(prefix: string): string {
  const d = getDB();
  d.seq += 1;
  return `${prefix}-${d.seq}`;
}

/** Simulated network latency so skeleton loaders are visible. */
export function delay<T>(value: T, ms = 350 + Math.random() * 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}
