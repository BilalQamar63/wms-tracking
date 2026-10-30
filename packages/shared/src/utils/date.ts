const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const pad = (n: number): string => String(n).padStart(2, '0');

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const toYmd = (y: number, m: number, d: number): string | null =>
  isValidYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;

const expandYear = (y: number): number => (y < 100 ? 2000 + y : y);

/** `2026-03-24T00:00:00.000Z` | Date -> `2026-03-24` (UTC based, safe for <input type="date">). */
export function toDateInputValue(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` -> Date at UTC midnight. */
export function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
}

/** Adds calendar days to `YYYY-MM-DD` without depending on the machine timezone. */
export function addDaysToYmd(ymd: string, days: number): string {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Counts calendar days from the plan start through its end, inclusive. */
export function getPlanDurationDays(startDate: string, endDate: string): number | null {
  const isValidDate = (ymd: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
    const date = ymdToUtcDate(ymd);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === ymd;
  };
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) return null;

  return (ymdToUtcDate(endDate).getTime() - ymdToUtcDate(startDate).getTime()) / 86_400_000 + 1;
}

/** Returns the signed number of calendar days from today until `date`. */
export function getCalendarDaysUntil(date: string, now = new Date()): number | null {
  const ymd = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const target = ymdToUtcDate(ymd);
  if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 10) !== ymd) return null;

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

/** Counts remaining calendar days, including the end date; returns null for an invalid date. */
export function getPlanDaysRemaining(endDate: string, now = new Date()): number | null {
  const daysUntilEnd = getCalendarDaysUntil(endDate, now);
  return daysUntilEnd === null ? null : Math.max(0, daysUntilEnd + 1);
}

/** Returns the current local calendar date as `YYYY-MM-DD`. */
export function getTodayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Formats the inclusive duration between the planned start and end dates. */
export function formatPlanValidity(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
): string {
  const start = toDateInputValue(startDate);
  const end = toDateInputValue(endDate);
  if (!start || !end) return '';
  const days = getPlanDurationDays(start, end);
  if (days === null) return '';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

/** Formats dates as `DD-MMM-YYYY` (e.g. 24-Mar-2026). */
export function formatDisplayDate(value?: string | Date | null): string {
  const ymd = toDateInputValue(value);
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return `${pad(d)}-${MONTH_LABELS[m - 1]}-${y}`;
}

/**
 * Parses the many date shapes found in spreadsheets and returns `YYYY-MM-DD`,
 * or `null` when the value cannot be interpreted as a date.
 */
export function parseFlexibleDate(input: unknown): string | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString().slice(0, 10);
  }

  if (typeof input === 'number') {
    // Excel serial date (days since 1899-12-30).
    if (input < 1 || input > 2958465) return null;
    return new Date(Math.round((input - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }

  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) return toYmd(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text); // dd/mm/yyyy
  if (match) return toYmd(expandYear(Number(match[3])), Number(match[2]), Number(match[1]));

  match = /^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s,-]+(\d{2,4})$/.exec(text); // 24-Mar-26 | 24 March 2026
  if (match) {
    const month = MONTHS.indexOf((match[2] as string).slice(0, 3).toLowerCase());
    if (month >= 0) return toYmd(expandYear(Number(match[3])), month + 1, Number(match[1]));
  }

  return null;
}
