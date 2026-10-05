/**
 * ClubDocs API Client
 *
 * This file is the single typed integration layer between the frontend UI and the API backend.
 * Currently, NEXT_PUBLIC_USE_MOCK is enabled by default or falls back to mock data in lib/mock/handlers.ts.
 *
 * To connect to a real FastAPI backend (e.g. at http://localhost:8000):
 * Set NEXT_PUBLIC_USE_MOCK="false" and NEXT_PUBLIC_API_BASE_URL="http://localhost:8000" in .env.local,
 * or customize the fetchClient functions below.
 */

import * as mock from "./mock/handlers";
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
  ReferencePeekResult,
  SaveDocumentResult,
  Status,
  Template,
  TemplateAnalysis,
} from "./types";

export const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const USE_MOCK = isMockMode;
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not connect to ClubDocs backend at ${BASE_URL}. Is the server running? (${msg})`);
  }

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      const errorBody = await res.text().catch(() => "");
      if (errorBody) errorDetail = errorBody;
    }
    throw new Error(`API Error ${res.status}: ${errorDetail}`);
  }

  const data = await res.json();
  if (data === null || data === undefined) {
    throw new Error(`Empty response received from ${path}`);
  }
  return data as T;
}

/* ================================================================== */
/* Club                                                                */
/* ================================================================== */

export async function getClub(): Promise<Club> {
  if (USE_MOCK) return mock.getClub();
  return request<Club>("/api/club");
}

export async function updateClub(club: Club): Promise<Club> {
  if (USE_MOCK) return mock.updateClub(club);
  return request<Club>("/api/club", {
    method: "PUT",
    body: JSON.stringify(club),
  });
}

export async function peekReference(category: string, eventCode = "GEN"): Promise<ReferencePeekResult> {
  if (USE_MOCK) return mock.peekReference(category, eventCode);
  return request<ReferencePeekResult>(`/api/club/reference/${category}/peek?eventCode=${encodeURIComponent(eventCode)}`);
}

export async function reserveReference(category: string, eventCode = "GEN"): Promise<string> {
  if (USE_MOCK) return mock.reserveReference(category, eventCode);
  return request<string>(`/api/club/reference/${category}/next?eventCode=${encodeURIComponent(eventCode)}`, { method: "POST" });
}

/* ================================================================== */
/* Events                                                              */
/* ================================================================== */

export async function listEvents(): Promise<EventSummary[]> {
  if (USE_MOCK) return mock.listEvents();
  return request<EventSummary[]>("/api/events");
}

export async function getEvent(id: string): Promise<ClubEvent> {
  if (USE_MOCK) return mock.getEvent(id);
  return request<ClubEvent>(`/api/events/${id}`);
}

export async function createEventFromText(text: string): Promise<ClubEvent> {
  if (USE_MOCK) return mock.createEventFromText(text);
  return request<ClubEvent>("/api/events/from-text", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function createEventFromForm(form: EventFormInput): Promise<ClubEvent> {
  if (USE_MOCK) return mock.createEventFromForm(form);
  return request<ClubEvent>("/api/events/from-form", {
    method: "POST",
    body: JSON.stringify(form),
  });
}

export async function updateEventFields(id: string, updates: Record<string, FieldValue>): Promise<ClubEvent> {
  if (USE_MOCK) return mock.updateEventFields(id, updates);
  return request<ClubEvent>(`/api/events/${id}/fields`, {
    method: "PATCH",
    body: JSON.stringify({ updates }),
  });
}

export async function getRecommendations(eventId: string): Promise<DocumentRecommendation[]> {
  if (USE_MOCK) return mock.getRecommendations(eventId);
  return request<DocumentRecommendation[]>(`/api/events/${eventId}/recommendations`);
}

export async function generateDocuments(
  eventId: string,
  templateIds: string[],
  options: GenerateOptions
): Promise<GeneratedDocument[]> {
  if (USE_MOCK) return mock.generateDocuments(eventId, templateIds, options);
  return request<GeneratedDocument[]>(`/api/events/${eventId}/generate`, {
    method: "POST",
    body: JSON.stringify({ templateIds, options }),
  });
}

export async function regenerateFromEvent(eventId: string): Promise<GeneratedDocument[]> {
  if (USE_MOCK) return mock.regenerateFromEvent(eventId);
  return request<GeneratedDocument[]>(`/api/events/${eventId}/regenerate`, {
    method: "POST",
  });
}

/* ================================================================== */
/* Documents                                                           */
/* ================================================================== */

export async function listDocuments(filters: DocumentFilters = {}): Promise<DocumentSummary[]> {
  if (USE_MOCK) return mock.listDocuments(filters);
  const params = new URLSearchParams();
  if (filters.eventId) params.set("eventId", filters.eventId);
  if (filters.templateId) params.set("templateId", filters.templateId);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return request<DocumentSummary[]>(`/api/documents?${params.toString()}`);
}

export async function getDocument(id: string): Promise<GeneratedDocument> {
  if (USE_MOCK) return mock.getDocument(id);
  return request<GeneratedDocument>(`/api/documents/${id}`);
}

export async function saveDocument(id: string, values: FieldValues, note = "Edited"): Promise<SaveDocumentResult> {
  if (USE_MOCK) return mock.saveDocument(id, values, note);
  return request<SaveDocumentResult>(`/api/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify({ values, note }),
  });
}

export async function setDocumentStatus(id: string, status: Status): Promise<GeneratedDocument> {
  if (USE_MOCK) return mock.setDocumentStatus(id, status);
  return request<GeneratedDocument>(`/api/documents/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function restoreVersion(id: string, version: number): Promise<GeneratedDocument> {
  if (USE_MOCK) return mock.restoreVersion(id, version);
  return request<GeneratedDocument>(`/api/documents/${id}/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

function parseContentDispositionFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8Match = /filename\*=UTF-8''([^;\s]+)/i.exec(disposition);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ""));
    } catch {
      // fallback
    }
  }
  const stdMatch = /filename="?([^";]+)"?/i.exec(disposition);
  if (stdMatch && stdMatch[1]) {
    return stdMatch[1].trim();
  }
  return fallback;
}

export async function exportDocument(id: string, format: ExportFormat): Promise<ExportResult> {
  if (USE_MOCK) return mock.exportDocument(id, format);
  const res = await fetch(`${BASE_URL}/api/documents/${id}/export?format=${format}`);
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Export failed (${res.status}): ${errorBody || res.statusText}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = parseContentDispositionFilename(disposition, `document_${id}.${format}`);
  return { kind: "file", blob, filename };
}

/* ================================================================== */
/* Templates                                                           */
/* ================================================================== */

export async function listTemplates(): Promise<Template[]> {
  if (USE_MOCK) return mock.listTemplates();
  return request<Template[]>("/api/templates");
}

export async function getTemplate(id: string): Promise<Template> {
  if (USE_MOCK) return mock.getTemplate(id);
  return request<Template>(`/api/templates/${id}`);
}

export async function analyzeTemplate(file: File, schemaFile?: File | null): Promise<TemplateAnalysis> {
  if (USE_MOCK) return mock.analyzeTemplate(file, schemaFile);
  const formData = new FormData();
  formData.append("file", file);
  if (schemaFile) formData.append("schema", schemaFile);
  const res = await fetch(`${BASE_URL}/api/templates/analyze`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Template analysis failed");
  return res.json();
}

export async function createTemplate(input: NewTemplateInput): Promise<Template> {
  if (USE_MOCK) return mock.createTemplate(input);
  return request<Template>("/api/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTemplate(id: string, patch: Partial<Omit<Template, "id">>): Promise<Template> {
  if (USE_MOCK) return mock.updateTemplate(id, patch);
  return request<Template>(`/api/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/* ================================================================== */
/* Analytics & Admin                                                   */
/* ================================================================== */

export async function getStats(): Promise<DashboardStats> {
  if (USE_MOCK) return mock.getStats();
  return request<DashboardStats>("/api/stats");
}

export async function resetDemoData(): Promise<void> {
  if (USE_MOCK) return mock.resetDemoData();
  await request("/api/reset", { method: "POST" });
}
