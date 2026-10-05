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

const STORAGE_KEY = "clubdocs.mock.v1";
let db: MockDB | null = null;

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
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        db = JSON.parse(raw) as MockDB;
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
