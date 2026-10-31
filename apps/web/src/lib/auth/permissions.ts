import type { SessionUser } from '@wms/shared';
import { SUB_CONTRACTORS } from '@wms/shared';
import { forbidden } from '@/lib/http/errors';

export function assignedSubContractorFor(user: SessionUser): string | undefined {
  if (user.role === 'admin') return undefined;
  if (
    !user.assignedSubContractor ||
    !SUB_CONTRACTORS.some((subContractor) => subContractor === user.assignedSubContractor)
  ) {
    throw forbidden('Ask an administrator to assign your sub contractor');
  }
  return user.assignedSubContractor;
}
