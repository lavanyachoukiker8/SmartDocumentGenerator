import type { Club, FieldValue, FieldValues, Placeholder, TableRow } from "./types";

/**
 * Builds a reference number from a format like `ACM/{FY}/ROOM/{seq}` or `ACM/{AY}/{EVENTCODE}/{seq}`.
 * Used to *suggest* the next number — the user must accept it explicitly.
 */
export function formatReference(
  pattern: string,
  seq: number,
  club: Pick<Club, "financialYear" | "academicYear" | "shortName">,
  eventCode = "GEN"
): string {
  return pattern
    .replaceAll("{FY}", club.financialYear)
    .replaceAll("{AY}", club.academicYear)
    .replaceAll("{CLUB}", club.shortName)
    .replaceAll("{EVENTCODE}", eventCode)
    .replaceAll("{seq}", String(seq).padStart(3, "0"));
}

/** True when a field value should be treated as "not filled". */
export function isEmptyValue(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((row) => isEmptyRow(row));
  }
  return false;
}

export function isEmptyRow(row: TableRow): boolean {
  return Object.values(row).every((v) => !v || v.trim() === "");
}

/** Keys of required placeholders whose value is empty. */
export function missingRequiredKeys(placeholders: Placeholder[], values: FieldValues): string[] {
  return placeholders.filter((p) => p.required && isEmptyValue(values[p.key])).map((p) => p.key);
}

/** Group items by their `section` property while keeping first-seen order. */
export function groupBySection<T extends { section: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return [...map.entries()];
}

/** Masks a sensitive value, keeping the last 4 characters visible. */
export function maskValue(value: string, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "•".repeat(value.length);
  return "•".repeat(Math.min(value.length - visible, 8)) + value.slice(-visible);
}

/** Sum a numeric column of a table field. */
export function sumColumn(rows: TableRow[] | null | undefined, key: string): number {
  if (!rows) return 0;
  return rows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0);
}

export function asRows(value: FieldValue | undefined): TableRow[] {
  return Array.isArray(value) ? value : [];
}

export function asText(value: FieldValue | undefined): string {
  return typeof value === "string" ? value : "";
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

/** Indian-system number to words (for "Amount in words"). */
export function amountInWords(amount: number): string {
  const n = Math.floor(amount);
  if (n === 0) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n / 1_00_000) % 100);
  const thousand = Math.floor((n / 1000) % 100);
  const hundred = Math.floor((n / 100) % 10);
  const rest = n % 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return `${parts.join(" ")} Rupees Only`;
}
