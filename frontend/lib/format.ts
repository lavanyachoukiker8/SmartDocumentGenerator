const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "2026-10-14" -> "14 Oct 2026" */
export function formatDate(iso: string | null | undefined, long = false): string {
  if (!iso) return "";
  const d = parseIso(iso);
  if (!d) return iso;
  const months = long ? MONTHS_LONG : MONTHS;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-10-14" -> "14/10/2026" (format used on official forms) */
export function formatDateSlash(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseIso(iso);
  if (!d) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Formats a start/end date pair compactly: "14–15 Oct 2026". */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined, long = false): string {
  if (!start) return "";
  if (!end || end === start) return formatDate(start, long);
  const s = parseIso(start);
  const e = parseIso(end);
  if (!s || !e) return `${start} – ${end}`;
  const months = long ? MONTHS_LONG : MONTHS;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${formatDate(start, long)} – ${formatDate(end, long)}`;
}

/** "18:00" -> "06:00 PM" */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m[2]} ${suffix}`;
}

/** ISO timestamp -> "5 Oct 2026, 10:42 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getHours();
  const time = `${String(h % 12 || 12).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Relative time like "3 days ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
  ];
  let value = -diff;
  for (const [factor, unit] of steps) {
    if (Math.abs(value) < factor) return rtf.format(Math.round(value), unit);
    value /= factor;
  }
  return formatDateTime(iso);
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
