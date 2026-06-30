// No pipeline caller yet — CSV and GitHub adapters do not supply experience dates.
// Utility for future experience.start / experience.end normalization.

const YYYY_MM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YYYY_MM_DD = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YYYY_SLASH_MM = /^(\d{4})\/(0[1-9]|1[0-2])$/;
const MM_SLASH_YYYY = /^(0[1-9]|1[0-2])\/(\d{4})$/;
const YYYY_ONLY = /^(\d{4})$/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toYearMonth(year: number, month: number): string | null {
  if (month < 1 || month > 12) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function normalizeDate(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower === "present" || lower === "current" || lower === "now") {
    return null;
  }

  const yyyyMm = trimmed.match(YYYY_MM);
  if (yyyyMm) {
    return toYearMonth(Number(yyyyMm[1]), Number(yyyyMm[2]));
  }

  const yyyyMmDd = trimmed.match(YYYY_MM_DD);
  if (yyyyMmDd) {
    const year = Number(yyyyMmDd[1]);
    const month = Number(yyyyMmDd[2]);
    const day = Number(yyyyMmDd[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }
    return toYearMonth(year, month);
  }

  const yyyySlashMm = trimmed.match(YYYY_SLASH_MM);
  if (yyyySlashMm) {
    return toYearMonth(Number(yyyySlashMm[1]), Number(yyyySlashMm[2]));
  }

  const mmSlashYyyy = trimmed.match(MM_SLASH_YYYY);
  if (mmSlashYyyy) {
    return toYearMonth(Number(mmSlashYyyy[2]), Number(mmSlashYyyy[1]));
  }

  const yyyyOnly = trimmed.match(YYYY_ONLY);
  if (yyyyOnly) {
    return toYearMonth(Number(yyyyOnly[1]), 1);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return toYearMonth(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1);
  }

  return null;
}
