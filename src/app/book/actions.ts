'use server';

// =============================================================================
//  Booking action — the public checkout, up to the payment seam
// =============================================================================
//
//  Public: the traveller is not signed in. It validates, takes an ATOMIC hold
//  through takeHold (which never oversells), fires the best-effort confirmation
//  emails, and redirects to the confirmation page. The Stripe deposit call is
//  the one thing that is NOT here yet — it takes the place after the hold.
//
//  A hold that succeeds is a real reservation whether or not the email sends
//  and whether or not payment is wired, so nothing after the hold is allowed to
//  fail the booking.
// =============================================================================

import { redirect } from 'next/navigation';
import { validateBooking } from '@/lib/booking';
import { validateWaitlist } from '@/lib/validate';
import { takeHold, getConfirmation, joinWaitlist, getBookingOperatorContact, checkPromoCode, setTaskDone } from '@/lib/repo';
import { holdMessage } from '@/lib/hold';
import { fail, type ActionState } from '@/lib/action-state';
import { sendTravellerConfirmation, sendOperatorNotice } from '@/lib/notify';
// A 'use server' module may export ONLY async functions. The state shape and its
// empty value therefore live in action-state.ts, not here: a plain const or
// interface exported from this file does not survive the client boundary, and a
// client reading its `.errors` gets undefined (the /book 500 fixed 27 Aug 2026,
// exactly the hazard action-state.ts already documents for the console). fail
// and the ActionState type are imported above.

// traveller_name and option_id can each appear many times (one per traveller,
// one per ticked extra), so they collect into arrays; everything else is scalar.
const MULTI = new Set(['traveller_name', 'option_id']);

function fields(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (MULTI.has(k)) {
      (out[k] ??= []) as string[];
      (out[k] as string[]).push(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function createBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw = fields(form);

  const { ok, errors, value } = validateBooking(raw);
  if (!ok) return { ok: false, errors, message: 'Please check the highlighted fields.' };

  const lead = value.travellers.find((t) => t.is_lead)!;

  const outcome = await takeHold({
    departure_id: value.departure_id,
    party_size: value.party_size,
    lead_name: lead.full_name,
    lead_email: lead.email ?? '',
    lead_phone: lead.phone,
    travellers: value.travellers,
    package_id: value.package_id,
    promo_code: value.promo_code,
    option_ids: value.option_ids,
  });

  if (!outcome.ok) {
    // sold_out / insufficient_capacity are about the DATE, so surface them on
    // the departure field; the rest are a general message.
    const onDeparture = outcome.reason === 'sold_out' || outcome.reason === 'insufficient_capacity';
    const message = holdMessage(outcome.reason, outcome.remaining);
    return { ok: false, errors: onDeparture ? { departure_id: message } : {}, message };
  }

  // Held. Everything from here is best-effort and must not fail the booking.
  const ref = outcome.booking.reference;
  try {
    const c = await getConfirmation(ref);
    if (c && c.traveller_email) {
      const ctx = {
        reference: c.reference,
        tripTitle: c.trip_title,
        operatorName: c.operator_name,
        startsOn: c.starts_on ?? '',
        endsOn: c.ends_on ?? '',
        partySize: c.party_size,
        leadName: c.traveller_name ?? lead.full_name,
        leadEmail: c.traveller_email,
        currency: c.currency,
        totalPence: c.total_pence,
        depositPence: c.deposit_pence,
        holdExpiresAt: c.hold_expires_at,
      };
      await sendTravellerConfirmation(ctx);

      // The operator's own new-booking notice. Their email is operator-gated, so
      // it is looked up by the booking id we just created, never carried on the
      // public confirmation. Best-effort like everything post-hold.
      const opc = await getBookingOperatorContact(outcome.booking.id);
      if (opc?.email) {
        await sendOperatorNotice({ ...ctx, operatorReplyTo: opc.replyTo }, opc.email);
      }
    }
  } catch {
    // Swallowed: the hold stands regardless.
  }

  redirect(`/booked/${encodeURIComponent(ref)}`);
}

// ---------------------------------------------------------------------------
//  Waitlist — public, when a trip is full. Never redirects: it stays on the
//  page and confirms in place.
// ---------------------------------------------------------------------------

/** Public: does a code apply to this trip? For the book form's live check. The
 *  hold re-validates, so this only ever previews. */
export async function checkPromoAction(tripId: string, code: string): Promise<{ valid: boolean; describe?: string }> {
  return checkPromoCode(String(tripId), String(code));
}

/** Public: a booking ticks one of its checklist tasks. Reference-gated on the
 *  server, so a booking can only ever change its own checklist. */
export async function setTaskDoneAction(reference: string, taskId: string, done: boolean): Promise<{ ok: boolean }> {
  const ok = await setTaskDone(String(reference), String(taskId), Boolean(done));
  return { ok };
}

export async function joinWaitlistAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;

  const { ok, errors, value } = validateWaitlist(raw);
  if (!ok) return fail(errors, 'Please check the highlighted fields.');

  const done = await joinWaitlist(value);
  if (!done) return fail({}, 'Sorry, we could not add you just now. Please try again.');

  return { ok: true, errors: {}, message: "You are on the list. We will email you the moment a place opens." };
}
