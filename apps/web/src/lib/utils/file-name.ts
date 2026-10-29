import { getEnv } from '@/lib/env';

/** `2026-10-28_1432` in the configured application timezone. */
export function timestampForFileName(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getEnv().APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}${get('minute')}`;
}

/** Removes path separators / unsafe characters from user supplied file names. */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'file';
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
