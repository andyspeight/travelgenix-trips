// =============================================================================
//  lib/webhooks.ts — outbound webhook signing and payloads
// =============================================================================
//  The pure core of the integrations feature. An operator registers HTTPS
//  endpoints; when a booking is created or changes status, Trips POSTs a signed
//  JSON envelope. This module owns the two things that must be exactly right and
//  are therefore unit-tested without a database or a network:
//
//    * the SIGNATURE — HMAC-SHA256 over `${timestamp}.${body}`, Stripe-style, so
//      a receiver proves the payload is ours and un-tampered, and the timestamp
//      lets them reject replays. signBody and verifyBody are inverses.
//    * the PAYLOAD shape — one stable envelope { id, type, created_at, data },
//      with the money figures (collected / outstanding) computed by the SAME
//      finance rules the Reports and CSV use, so a webhook reconciles with the
//      screen and the export.
//
//  Runs on the Node serverless runtime, so node:crypto is fine and keeps signing
//  synchronous. No secret is ever logged or placed in a payload — only the
//  signature derived from it.
// =============================================================================

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { bookingCollected, bookingOutstanding } from './finance.ts';

/** The event types an endpoint may subscribe to. booking.created fires on a new
 *  hold; booking.updated fires when an operator changes a booking's status
 *  (deposit taken, paid in full, cancelled). Kept deliberately small and stable
 *  — new types are added here, never invented at a call site. */
export const WEBHOOK_EVENTS = ['booking.created', 'booking.updated'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(x: unknown): x is WebhookEvent {
  return typeof x === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(x);
}

/** Header names a receiver reads. Lower-case; fetch normalises them anyway. */
export const SIGNATURE_HEADER = 'x-tg-signature';
export const TIMESTAMP_HEADER = 'x-tg-timestamp';
export const EVENT_HEADER = 'x-tg-event';

/** The signed message is `${timestamp}.${body}` so the signature covers both the
 *  payload and the moment it was sent. Hex SHA-256 HMAC. */
function signedMessage(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

export function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(signedMessage(timestamp, body)).digest('hex');
}

/** Constant-time check that a presented signature matches. Length-guarded so
 *  timingSafeEqual never throws on a mismatched-length forgery. */
export function verifyBody(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = signBody(secret, timestamp, body);
  if (typeof signature !== 'string' || signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

/** A fresh signing secret, shown to the operator once. `whsec_` prefix so it is
 *  recognisably a webhook secret and never confused with any other credential. */
export function genSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

/** For display: never show a whole secret after creation, only enough to
 *  recognise which one it is. */
export function redactSecret(secret: string): string {
  if (!secret || secret.length <= 8) return '••••';
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}

/** The money-and-facts of one booking, the source for a booking event. Nullable
 *  money mirrors the DB (a bare hold may not have priced yet). */
export interface BookingEventData {
  reference: string;
  status: string;
  trip: string;
  operator: string;
  party_size: number;
  currency: string;
  total_pence: number | null;
  deposit_pence: number | null;
  starts_on: string | null;
  ends_on: string | null;
  lead_name: string | null;
  lead_email: string | null;
  package: string | null;
  promo: string | null;
}

export interface WebhookEnvelope {
  id: string;
  type: WebhookEvent;
  created_at: string;
  data: BookingEventData & { collected_pence: number; outstanding_pence: number };
}

/** Wrap booking facts in the stable envelope, computing collected / outstanding
 *  with the shared finance rules so every surface agrees. `opts` lets a test pin
 *  the id and clock; production leaves them to default. */
export function buildBookingEvent(
  type: WebhookEvent,
  data: BookingEventData,
  opts: { id?: string; now?: Date } = {},
): WebhookEnvelope {
  const total = data.total_pence ?? 0;
  const deposit = data.deposit_pence ?? 0;
  return {
    id: opts.id ?? randomUUID(),
    type,
    created_at: (opts.now ?? new Date()).toISOString(),
    data: {
      ...data,
      collected_pence: bookingCollected(data.status, total, deposit),
      outstanding_pence: bookingOutstanding(data.status, total, deposit),
    },
  };
}
