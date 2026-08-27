// =============================================================================
//  lib/hold.ts
// =============================================================================
//
//  The caller side of the atomic hold. The database function gt_hold_places is
//  the authority on whether a place can be taken; this is the orchestration
//  around it: minting the reference, and handling the three things the SQL
//  cannot handle from inside a single round trip.
//
//    busy            the departure row was locked past lock_timeout. Back off a
//                    little and retry the SAME reference, bounded.
//    reference_taken the rare reference collision. Mint a fresh one and retry.
//    ambiguous       a network error or client abort where we do not know if
//                    the hold committed. The reference is the idempotency key,
//                    so probe for it before retrying: a found row means it
//                    committed and we must NOT insert a second one.
//
//  Kept pure over injected transports (HoldDeps) so every retry, backoff and
//  probe path is unit-tested without a database. repo.ts supplies the real
//  transports.
// =============================================================================

import type { TravellerInput } from './booking.ts';

/** The raw shape gt_hold_places returns (PostgREST hands back the jsonb value
 *  directly for a returns-jsonb function, not wrapped in an array). */
export interface RpcResult {
  ok: boolean;
  reason?: string;
  id?: string;
  reference?: string;
  hold_expires_at?: string;
  remaining?: number;
  capacity?: number;
  taken?: number;
}

export interface HoldRequest {
  departure_id: string;
  party_size: number;
  lead_name: string;
  lead_email: string;
  lead_phone: string | null;
  travellers: TravellerInput[];
}

export interface HeldBooking {
  id: string;
  reference: string;
  holdExpiresAt: string | null;
  remaining: number | null;
}

export type HoldReason =
  | 'sold_out'
  | 'insufficient_capacity'
  | 'departure_closed'
  | 'not_found'
  | 'invalid'
  | 'busy'          // gate stayed jammed after every retry
  | 'error';        // an unexpected or unrecoverable failure

export type HoldOutcome =
  | { ok: true; booking: HeldBooking }
  | { ok: false; reason: HoldReason; remaining?: number };

export interface HoldDeps {
  /** POST rpc/gt_hold_places. Rejects on network error / abort. */
  callRpc: (args: {
    p_departure_id: string;
    p_party_size: number;
    p_reference: string;
    p_lead_name: string;
    p_lead_email: string;
    p_lead_phone: string | null;
    p_travellers: TravellerInput[];
  }) => Promise<RpcResult>;
  /** GET the booking by reference. Null when none exists. Never rejects. */
  probeByReference: (reference: string) => Promise<HeldBooking | null>;
  /** A fresh, unique-enough reference (booking.ts newReference). */
  mintReference: () => string;
  /** Sleep, injected so tests do not actually wait. */
  sleep: (ms: number) => Promise<void>;
  /** 0..1, injected so backoff is deterministic in tests. */
  jitter: () => number;
}

const MAX_BUSY_RETRIES = 3;
const MAX_REFERENCE_RETRIES = 5;
const MAX_AMBIGUOUS_RETRIES = 1;
// Belt and braces: no path should loop this many times, but a bug must not spin.
const HARD_ITERATION_CAP = 12;

/** Exponential backoff with jitter, in ms: ~120, ~240, ~480, plus up to half. */
function backoffMs(attempt: number, jitter: number): number {
  const base = 120 * 2 ** (attempt - 1);
  return Math.round(base * (1 + jitter * 0.5));
}

const TERMINAL: Record<string, HoldReason> = {
  sold_out: 'sold_out',
  insufficient_capacity: 'insufficient_capacity',
  departure_closed: 'departure_closed',
  not_found: 'not_found',
  invalid: 'invalid',
};

/**
 * Take a hold, or report why it could not be taken. The reference is minted
 * here (never by the database) so booking.ts's tested, quotable format stays
 * authoritative.
 */
export async function holdPlaces(deps: HoldDeps, req: HoldRequest): Promise<HoldOutcome> {
  let reference = deps.mintReference();
  let busy = 0;
  let refCollisions = 0;
  let ambiguous = 0;

  for (let i = 0; i < HARD_ITERATION_CAP; i++) {
    let res: RpcResult;
    try {
      res = await deps.callRpc({
        p_departure_id: req.departure_id,
        p_party_size: req.party_size,
        p_reference: reference,
        p_lead_name: req.lead_name,
        p_lead_email: req.lead_email,
        p_lead_phone: req.lead_phone,
        p_travellers: req.travellers,
      });
    } catch {
      // Ambiguous: the request may have committed before the failure. The
      // reference is the idempotency key, so look for the row before doing
      // anything that could double-insert.
      const found = await deps.probeByReference(reference).catch(() => null);
      if (found) return { ok: true, booking: found };
      if (++ambiguous <= MAX_AMBIGUOUS_RETRIES) continue;
      return { ok: false, reason: 'error' };
    }

    if (res.ok && res.id) {
      return {
        ok: true,
        booking: {
          id: res.id,
          reference: res.reference ?? reference,
          holdExpiresAt: res.hold_expires_at ?? null,
          remaining: typeof res.remaining === 'number' ? res.remaining : null,
        },
      };
    }

    const reason = res.reason ?? 'error';

    if (reason === 'busy') {
      if (++busy > MAX_BUSY_RETRIES) return { ok: false, reason: 'busy' };
      await deps.sleep(backoffMs(busy, deps.jitter()));
      continue;
    }

    if (reason === 'reference_taken') {
      if (++refCollisions > MAX_REFERENCE_RETRIES) return { ok: false, reason: 'error' };
      reference = deps.mintReference();
      continue;
    }

    const terminal = TERMINAL[reason];
    if (terminal) {
      return terminal === 'insufficient_capacity'
        ? { ok: false, reason: terminal, remaining: res.remaining }
        : { ok: false, reason: terminal };
    }

    // An unknown reason is a contract mismatch, not something to retry.
    return { ok: false, reason: 'error' };
  }

  // Exhausted the hard cap: treat as a transient failure the traveller can retry.
  return { ok: false, reason: 'busy' };
}

/** A user-facing sentence for each outcome. Warm, plain, UK English. */
export function holdMessage(reason: HoldReason, remaining?: number): string {
  switch (reason) {
    case 'sold_out':
      return 'This departure has just sold out. Please choose another date.';
    case 'insufficient_capacity':
      return remaining && remaining > 0
        ? `Only ${remaining} ${remaining === 1 ? 'place is' : 'places are'} left on this departure, fewer than you asked for.`
        : 'There are not enough places left on this departure for your party.';
    case 'departure_closed':
      return 'This departure is no longer taking bookings. Please choose another date.';
    case 'not_found':
      return 'We could not find that departure. Please choose a date and try again.';
    case 'invalid':
      return 'Something in the booking was not right. Please check your details and try again.';
    case 'busy':
      return 'A lot of people are booking this trip right now. Please try again in a moment.';
    default:
      return 'Something went wrong holding your place. Please try again.';
  }
}
