import type { ApprovalContactRole } from '../constants/options';

const VALIDATION_WMS_ROLES = new Set([
  'area authority/permit issuer',
  'permit issuer',
  'area authority',
]);
const APPROVAL_WMS_ROLES = new Set(['area authority/permit issuer', 'area authority']);

function normalizeWmsRole(wmsRole: string): string {
  return wmsRole.trim().toLowerCase().replace(/\s*\/\s*/g, '/');
}

export function isApprovalContactEligibleForRole(
  wmsRole: string,
  contactRole: ApprovalContactRole,
): boolean {
  if (contactRole === 'performingAuthority') return true;
  const normalizedRole = normalizeWmsRole(wmsRole);
  return (contactRole === 'validationBy' ? VALIDATION_WMS_ROLES : APPROVAL_WMS_ROLES).has(
    normalizedRole,
  );
}
