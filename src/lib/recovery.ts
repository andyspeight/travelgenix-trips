// =============================================================================
//  lib/recovery.ts — the pure rule for an abandoned booking
// =============================================================================
//  Kept free of the database so "who gets the nudge" is unit-tested, like the
//  rest of the pure layer. A booking is abandoned when it was reserved but never
//  completed: still pending, the hold has lapsed, no recovery sent yet, an email
//  to reach them on, and recent enough that chasing it is not creepy.
// =============================================================================

/** How far back to chase. Older than this and the moment has passed. */
export const RECOVERY_WINDOW_DAYS = 30;

export interface RecoveryCandidate {
  status: string;
  holdExpiresAt: string | null;
  recoverySentAt: string | null;
  travellerEmail: string | null;
  createdAt: string;
}

/** True when this booking should get the one-time come-back email at `now`. */
export function isAbandoned(b: RecoveryCandidate, now: Date = new Date()): boolean {
  if (b.status !== 'pending') return false;              // completed / cancelled: nothing to recover
  if (b.recoverySentAt) return false;                    // already nudged, once only
  if (!b.travellerEmail) return false;                   // no way to reach them
  if (!b.holdExpiresAt) return false;                    // no hold window to have lapsed

  const t = now.getTime();
  const expired = new Date(b.holdExpiresAt).getTime();
  if (!(expired < t)) return false;                      // hold has not lapsed yet, still live

  const created = new Date(b.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const windowMs = RECOVERY_WINDOW_DAYS * 86400000;
  return created >= t - windowMs;                        // recent enough to be worth it
}
