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
import { takeHold, getConfirmation } from '@/lib/repo';
import { holdMessage } from '@/lib/hold';
import { sendTravellerConfirmation } from '@/lib/notify';
import type { FieldErrors } from '@/lib/action-state';

export interface BookingState {
  ok: boolean;
  errors: FieldErrors;
  message: string;
}

export const EMPTY_BOOKING_STATE: BookingState = { ok: true, errors: {}, message: '' };

function fields(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string') continue;
    if (k === 'traveller_name') {
      (out[k] ??= []) as string[];
      (out[k] as string[]).push(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function createBookingAction(_prev: BookingState, form: FormData): Promise<BookingState> {
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
      // The operator's own notice needs their email, an operator-gated field
      // the public confirmation does not carry. They see the booking in the
      // console the instant it lands, so the email is a phase-2 nicety.
    }
  } catch {
    // Swallowed: the hold stands regardless.
  }

  redirect(`/booked/${encodeURIComponent(ref)}`);
}
