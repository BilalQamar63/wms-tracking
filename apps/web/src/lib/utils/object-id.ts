import { isValidObjectId } from 'mongoose';
import { notFound } from '@/lib/http/errors';

/** Throws a 404 for malformed ids so they never reach a database query. */
export function assertObjectId(id: string, resource = 'Resource'): void {
  if (!isValidObjectId(id)) throw notFound(resource);
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
