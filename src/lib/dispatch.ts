// =============================================================================
//  lib/dispatch.ts — deliver booking events to an operator's webhooks
// =============================================================================
//  The server side of integrations: given an operator, an event type and the
//  booking facts, POST a signed envelope to every active endpoint subscribed to
//  that event. Everything here is BEST-EFFORT and swallowed — a slow or broken
//  receiver must never fail a booking or a status change. The pure signing and
//  payload shaping live in lib/webhooks; this module only does the I/O.
//
//  A seam like Stripe and email: if the operator has registered no endpoints,
//  this is a silent no-op. Nothing to configure, nothing logged.
// =============================================================================

import 'server-only';
import { listActiveWebhooksForEvent, recordWebhookResult, getBookingEventById } from './repo.ts';
import {
  buildBookingEvent, signBody, type WebhookEvent, type BookingEventData,
  SIGNATURE_HEADER, TIMESTAMP_HEADER, EVENT_HEADER,
} from './webhooks.ts';

/** How long we wait on any one receiver before giving up on that delivery. A
 *  receiver is not allowed to hold up the booking flow. */
const DELIVERY_TIMEOUT_MS = 4000;

/** Deliver one already-built, already-serialised envelope to one endpoint,
 *  signed with that endpoint's own secret. Records the resulting status. Returns
 *  the HTTP status, or 0 if the request never completed. Never throws. */
export async function deliverOne(
  endpoint: { id: string; url: string; secret: string },
  body: string,
  eventType: string,
): Promise<number> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signBody(endpoint.secret, timestamp, body);
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [EVENT_HEADER]: eventType,
        [TIMESTAMP_HEADER]: timestamp,
        [SIGNATURE_HEADER]: signature,
        'user-agent': 'TravelgenixTrips-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    await recordWebhookResult(endpoint.id, res.status);
    return res.status;
  } catch {
    await recordWebhookResult(endpoint.id, 0);
    return 0;
  }
}

/** Fire a booking event to all of an operator's matching endpoints. The envelope
 *  is built and serialised once, then signed per endpoint. Fully guarded so a
 *  caller can `await dispatchBookingEvent(...)` inside a best-effort block
 *  without any chance of it throwing. */
export async function dispatchBookingEvent(
  operatorId: string,
  type: WebhookEvent,
  data: BookingEventData,
): Promise<void> {
  try {
    const endpoints = await listActiveWebhooksForEvent(operatorId, type);
    if (endpoints.length === 0) return;
    const envelope = buildBookingEvent(type, data);
    const body = JSON.stringify(envelope);
    await Promise.all(endpoints.map((e) => deliverOne({ id: e.id, url: e.url, secret: e.secret }, body, type)));
  } catch {
    // Integrations are never allowed to break the thing they observe.
  }
}

/** Fire an event for a booking by id, resolving its operator itself. Used on the
 *  booking.created path, which has no operator session. Guarded end to end. */
export async function dispatchBookingEventById(bookingId: string, type: WebhookEvent): Promise<void> {
  try {
    const found = await getBookingEventById(bookingId);
    if (!found) return;
    await dispatchBookingEvent(found.operatorId, type, found.data);
  } catch {
    // Best-effort.
  }
}
