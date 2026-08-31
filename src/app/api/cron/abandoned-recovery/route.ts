// =============================================================================
//  GET /api/cron/abandoned-recovery
// =============================================================================
//  A daily come-back nudge to travellers who reserved but never finished: still
//  pending, the hold has lapsed, no recovery sent, created within the last 30
//  days. Sent once (a recovery_sent_at stamp guards a second). Best-effort, and
//  it only actually delivers once an email key is configured; until then the
//  send is logged and the booking is still marked, exactly like the reminder.
//
//  Guarded by CRON_SECRET, like the registration reminder. Without the secret
//  configured the endpoint refuses, so it is never openly triggerable.
// =============================================================================

import { findAbandonedBookings, markRecoverySent } from '@/lib/repo';
import { sendAbandonedRecovery, type BookingEmailContext } from '@/lib/notify';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return json({ error: 'not_configured' }, 503);

  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) return json({ error: 'unauthorised' }, 401);

  if (!tripsDbConfigured()) return json({ error: 'db_unavailable' }, 503);

  const due = await findAbandonedBookings(50);
  let sent = 0;

  for (const b of due) {
    if (!b.traveller_email) continue;
    const ctx: BookingEmailContext = {
      reference: b.reference,
      tripTitle: b.trip_title,
      operatorName: b.operator_name,
      operatorReplyTo: b.operator_reply_to,
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
    const res = await sendAbandonedRecovery(ctx, { operatorSlug: b.operator_slug, tripSlug: b.trip_slug });
    // Mark only on success, so a transient failure is retried tomorrow.
    if (res.ok) { await markRecoverySent(b.id); sent += 1; }
  }

  return json({ ok: true, considered: due.length, recovered: sent }, 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
