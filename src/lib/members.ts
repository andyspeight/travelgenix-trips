// =============================================================================
//  lib/members.ts — team role rules, the pure parts
// =============================================================================
//
//  Trips does not own identity (tg-widgets SSO does). It owns AUTHORISATION:
//  which people under an operator may do what. These rules decide a person's
//  role from the operator's contact and its member list, and are kept free of
//  the database so they are unit-tested exactly like validate.ts and booking.ts.
//
//  Two invariants make the feature safe to ship:
//    - The operator's own contact_email is always owner. A team can never lock
//      itself out, and the contact can never be demoted or removed.
//    - Until any member is added, everyone under the client is owner. Adding the
//      first member is the deliberate act that turns gating on; before that,
//      nothing changes for anyone.
// =============================================================================

import type { FieldErrors } from './action-state.ts';
import type { OperatorRole } from './types.ts';

export const ROLES: ReadonlyArray<{ role: OperatorRole; label: string; help: string }> = [
  { role: 'owner', label: 'Owner', help: 'Full control, including managing the team.' },
  { role: 'manager', label: 'Manager', help: 'Edit trips and bookings. Cannot manage the team.' },
  { role: 'viewer', label: 'Viewer', help: 'Read-only.' },
];

const VALID_ROLES = new Set<OperatorRole>(['owner', 'manager', 'viewer']);

/** Case-insensitive, trimmed email compare key. */
export function emailKey(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

export interface MemberLike { email: string; role: OperatorRole }

/**
 * The signed-in person's role for one operator.
 *
 * @param contactEmail the operator's own contact_email (always owner)
 * @param email        the signed-in person's email
 * @param members      the operator's configured members (may be empty)
 */
export function resolveOperatorRole(
  contactEmail: string | null,
  email: string,
  members: MemberLike[],
): OperatorRole {
  const me = emailKey(email);

  // The contact is always owner, whatever the member list says.
  if (me && emailKey(contactEmail ?? '') === me) return 'owner';

  const mine = members.find((m) => emailKey(m.email) === me);
  if (mine && VALID_ROLES.has(mine.role)) return mine.role;

  // No team configured yet: everyone keeps full access. A configured team makes
  // an unlisted person read-only rather than locking them out.
  return members.length === 0 ? 'owner' : 'viewer';
}

/** May this role change anything? Owners and managers, not viewers. */
export function canEdit(role: OperatorRole): boolean {
  return role === 'owner' || role === 'manager';
}

/** May this role manage the team? Owners only. */
export function canManageTeam(role: OperatorRole): boolean {
  return role === 'owner';
}

// ---------------------------------------------------------------------------
//  Validation for the add / change-role form (operator input)
// ---------------------------------------------------------------------------

export interface MemberInput { email: string; role: OperatorRole }

function looksLikeEmail(value: string): boolean {
  const s = String(value ?? '').trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254;
}

export function validateMember(raw: Record<string, unknown>): {
  ok: boolean; errors: FieldErrors; value: MemberInput;
} {
  const errors: FieldErrors = {};

  const email = String(raw.email ?? '').trim().toLowerCase();
  if (!email) errors.email = 'Give the person’s email.';
  else if (!looksLikeEmail(email)) errors.email = 'That email does not look right.';

  const roleRaw = String(raw.role ?? '') as OperatorRole;
  const role: OperatorRole = VALID_ROLES.has(roleRaw) ? roleRaw : 'viewer';

  return { ok: Object.keys(errors).length === 0, errors, value: { email, role } };
}
