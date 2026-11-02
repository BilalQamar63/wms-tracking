function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDateParts(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }
  return formatUtcDate(date);
}

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function normalizeAuthorizationDate(value: string | number | Date): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatUtcDate(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 100_000) return '';
    return formatUtcDate(new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000)));
  }

  const text = value.trim().replace(/^'/, '').trim();
  if (!text) return '';

  const isoTimestamp = text.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoTimestamp) return normalizeAuthorizationDate(isoTimestamp[1]);

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+.*)?$/);
  if (iso) return validDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numericDate = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s+.*)?$/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const year = numericDate[3].length === 2
      ? Number(`20${numericDate[3]}`)
      : Number(numericDate[3]);
    if (first > 12) return validDateParts(year, second, first);
    if (second > 12) return validDateParts(year, first, second);
    return validDateParts(year, second, first);
  }

  const dayMonthName = text.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-,\s/](\d{2,4})(?:\s+.*)?$/);
  const monthNameDay = text.match(/^([A-Za-z]{3,})[-\s/](\d{1,2})[,]?[-\s/](\d{2,4})(?:\s+.*)?$/);
  const named = dayMonthName
    ? { day: dayMonthName[1], month: dayMonthName[2], year: dayMonthName[3] }
    : monthNameDay
      ? { day: monthNameDay[2], month: monthNameDay[1], year: monthNameDay[3] }
      : null;
  if (named) {
    const month = MONTH_NUMBERS[named.month.slice(0, 3).toLocaleLowerCase()] ?? 0;
    const year = named.year.length === 2 ? Number(`20${named.year}`) : Number(named.year);
    if (month > 0) return validDateParts(year, month, Number(named.day));
  }

  const serial = text.match(/^\d{4,5}(?:\.\d+)?$/);
  if (serial) return normalizeAuthorizationDate(Number(text));

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}
