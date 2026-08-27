// =============================================================================
//  /booked/[reference] — the confirmation
// =============================================================================
//  Shown to the traveller who just booked, and reachable by anyone holding the
//  reference (it is the access token, exactly like a confirmation link). Shows
//  only what a confirmation needs; never the rest of the party.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfirmation } from '@/lib/repo';
import { normaliseReference } from '@/lib/booking';
import { format as money } from '@/lib/money';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Booking confirmed' };

export default async function BookedPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!tripsDbConfigured()) notFound();

  const ref = normaliseReference(decodeURIComponent(reference));
  if (!ref) notFound();

  const c = await getConfirmation(ref);
  if (!c) notFound();

  const total = money(c.total_pence, c.currency);
  const deposit = money(c.deposit_pence, c.currency);
  const held = c.status === 'pending';

  return (
    <div className="t-page bk-page">
      <div className="bk-wrap bk-confirm">
        <div className="bk-tick" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>

        <h1>{held ? 'Your place is held' : 'Booking confirmed'}</h1>
        <p className="bk-ref">Reference <strong>{c.reference}</strong></p>

        <dl className="bk-summary">
          <div><dt>Trip</dt><dd>{c.trip_title}</dd></div>
          <div><dt>Operator</dt><dd>{c.operator_name}</dd></div>
          {c.starts_on && c.ends_on && (
            <div><dt>Dates</dt><dd>{humanDate(c.starts_on)} to {humanDate(c.ends_on)}</dd></div>
          )}
          <div><dt>Travelling</dt><dd>{c.party_size} {c.party_size === 1 ? 'person' : 'people'}</dd></div>
          {total && <div><dt>Total</dt><dd className="bk-money">{total}</dd></div>}
          {deposit && held && <div><dt>Deposit to secure</dt><dd className="bk-money">{deposit}</dd></div>}
        </dl>

        <p className="bk-next">
          {held ? (
            <>We have emailed your confirmation{c.traveller_email ? ` to ${maskEmail(c.traveller_email)}` : ''}. {c.operator_name} will
            be in touch to confirm and take payment. Keep your reference handy.</>
          ) : (
            <>Thank you. {c.operator_name} has your booking and will be in touch with the details.</>
          )}
        </p>

        <p className="bk-note">No card has been charged. Online payment is coming soon.</p>
      </div>
    </div>
  );
}

/** p***a@example.com — enough to recognise, not enough to harvest. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const shown = user.length <= 2 ? user[0] : `${user[0]}***${user[user.length - 1]}`;
  return `${shown}@${domain}`;
}

function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
