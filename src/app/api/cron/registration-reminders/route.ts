// =============================================================================
//  GET /api/cron/registration-reminders
// =============================================================================
//  A daily nudge to travellers who booked but may not have finished their
//  details: still live, 2 to 14 days old, never reminded. Sent once (a
//  reminder_sent_at stamp guards against a second). Best-effort, and it only
//  actually delivers once an email key is configured; until then the send is
//  logged and the booking is still marked, exactly like the rest of the seam.
//
//  Guarded by CRON_SECRET. Vercel Cron sends it as a Bearer token; without the
//  secret configured the endpoint refuses, so it is never openly triggerable.
// =============================================================================

import { findBookingsToRemind, markBookingReminded } from '@/lib/repo';
import { sendRegistrationReminder, type BookingEmailContext } from '@/lib/notify';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return json({ error: 'not_configured' }, 503);

  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) return json({ error: 'unauthorised' }, 401);

  if (!tripsDbConfigured()) return json({ error: 'db_unavailable' }, 503);

  const due = await findBookingsToRemind(50);
  let sent = 0;

  for (const b of due) {
    if (!b.traveller_email) continue;
    const ctx: BookingEmailContext = {
      reference: b.reference,
      tripTitle: b.trip_title,
      operatorName: b.operator_name,
      operatorReplyTo: b.operator_reply_to,
      operatorLogoUrl: b.operator_logo_url,
      operatorAccent: b.operator_accent,
      operatorHidePoweredBy: b.operator_hide_powered_by,
      startsOn: b.starts_on ?? '',
      endsOn: b.ends_on ?? '',
      partySize: b.party_size,
      leadName: b.traveller_name ?? '',
      leadEmail: b.traveller_email,
      currency: b.currency,
      totalPence: b.total_pence,
      depositPence: b.deposit_pence,
      holdExpiresAt: null,
    };
    const res = await sendRegistrationReminder(ctx);
    // Mark only on success, so a transient failure is retried tomorrow.
    if (res.ok) { await markBookingReminded(b.id); sent += 1; }
  }

  return json({ ok: true, considered: due.length, reminded: sent }, 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
