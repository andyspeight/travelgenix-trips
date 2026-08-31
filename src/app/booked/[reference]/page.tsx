// =============================================================================
//  /booked/[reference] — the confirmation
// =============================================================================
//  Shown to the traveller who just booked, and reachable by anyone holding the
//  reference (it is the access token, exactly like a confirmation link). Shows
//  only what a confirmation needs; never the rest of the party.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getConfirmation, getChecklist, getOperatorBrandByReference } from '@/lib/repo';
import { normaliseReference } from '@/lib/booking';
import { format as money } from '@/lib/money';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { BrandMast, PoweredBy } from '@/lib/brand-ui';
import { operatorMetadata } from '@/lib/seo';
import { tripsDbConfigured } from '@/lib/supabase';
import { Checklist } from '../checklist';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  if (!tripsDbConfigured()) return { title: 'Booking confirmed' };
  const { reference } = await params;
  const b = await getOperatorBrandByReference(normaliseReference(reference) || reference);
  if (!b) return { title: 'Booking confirmed' };
  return operatorMetadata({
    title: `Booking confirmed · ${b.operatorName}`,
    description: `Your booking with ${b.operatorName}.`,
    operatorName: b.operatorName,
    logoUrl: b.logoUrl,
  });
}

export default async function BookedPage({
  params, searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ registered?: string }>;
}) {
  const { reference } = await params;
  const { registered } = await searchParams;
  if (!tripsDbConfigured()) notFound();

  // params are already decoded by Next; a second decode throws on a lone '%'.
  const ref = normaliseReference(reference);
  if (!ref) notFound();

  const c = await getConfirmation(ref);
  if (!c) notFound();
  const justRegistered = registered === '1';

  // The operator's checklist for this booking, if the trip has one.
  const dead0 = c.status === 'expired' || c.status === 'cancelled';
  const checklist = dead0 ? [] : await getChecklist(ref);

  const total = money(c.total_pence, c.currency);
  const deposit = money(c.deposit_pence, c.currency);
  const held = c.status === 'pending';
  const dead = c.status === 'expired' || c.status === 'cancelled';
  const confirmed = c.status === 'deposit_paid' || c.status === 'paid';

  // The balance is what is left after the deposit. Only meaningful while there
  // is a priced total and a deposit smaller than it.
  const balancePence =
    typeof c.total_pence === 'number' && typeof c.deposit_pence === 'number' && c.deposit_pence < c.total_pence
      ? c.total_pence - c.deposit_pence
      : null;
  const balance = money(balancePence, c.currency);

  // The confirmation wears the operator's brand too, so the whole journey holds
  // together from the trip page to here.
  const accent = readableOn(c.operator_primary_colour, '#ffffff', '#0e6e5c');
  const font = operatorFont(c.operator_font);

  return (
    <>
      {font.href && <link rel="stylesheet" href={font.href} />}
      <div className="t-page bk-page" style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack }}>
        <BrandMast name={c.operator_name} logoUrl={c.operator_logo_url} />
        <div className="bk-wrap bk-confirm">
        <div className={`bk-tick${dead ? ' bk-tick--dead' : ''}`} aria-hidden="true">
          {dead ? (
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </div>

        <h1>{dead ? (c.status === 'expired' ? 'This hold has expired' : 'This booking was cancelled') : confirmed ? 'Booking confirmed' : 'Your place is held'}</h1>
        <p className="bk-ref">Reference <strong>{c.reference}</strong></p>

        <dl className="bk-summary">
          <div><dt>Trip</dt><dd>{c.trip_title}</dd></div>
          <div><dt>Operator</dt><dd>{c.operator_name}</dd></div>
          {c.starts_on && c.ends_on && (
            <div><dt>Dates</dt><dd>{humanDate(c.starts_on)} to {humanDate(c.ends_on)}</dd></div>
          )}
          {c.package_name && <div><dt>Room</dt><dd>{c.package_name}</dd></div>}
          <div><dt>Travelling</dt><dd>{c.party_size} {c.party_size === 1 ? 'person' : 'people'}</dd></div>
          {c.promo_code && <div><dt>Discount</dt><dd>{c.promo_code}</dd></div>}
          {c.selected_options.map((o) => (
            <div key={o.option_id}>
              <dt>{o.name}{o.quantity > 1 ? ` ×${o.quantity}` : ''}</dt>
              <dd className="bk-money">{money(o.amount_pence, c.currency)}</dd>
            </div>
          ))}
          {total && <div><dt>Total</dt><dd className="bk-money">{total}</dd></div>}
          {deposit && held && <div><dt>Deposit to secure</dt><dd className="bk-money">{deposit}</dd></div>}
          {balance && held && <div><dt>Balance due later</dt><dd className="bk-money">{balance}</dd></div>}
        </dl>

        <p className="bk-next">
          {dead ? (
            <>This place is no longer held. If you still want to travel, please book again or contact {c.operator_name}.</>
          ) : held ? (
            <>We have emailed your confirmation{c.traveller_email ? ` to ${maskEmail(c.traveller_email)}` : ''}. {c.operator_name} will
            be in touch to confirm and take payment. Keep your reference handy.</>
          ) : (
            <>Thank you. {c.operator_name} has your booking and will be in touch with the details.</>
          )}
        </p>

        {!dead && (
          justRegistered ? (
            <div className="bk-reg-done">
              <p>Thank you, we have your travellers’ details. You can update them any time using the button below.</p>
              <a className="bk-cta bk-cta--ghost" href={`/register/${c.reference}`}>Review or update details</a>
            </div>
          ) : (
            <div className="bk-reg-cta">
              <p>Next, add each traveller’s details{c.party_size > 1 ? ' for your party' : ''} and complete anything {c.operator_name} needs.</p>
              <a className="bk-cta" href={`/register/${c.reference}`}>Complete your booking</a>
            </div>
          )
        )}

        {!dead && checklist.length > 0 && <Checklist reference={c.reference} items={checklist} />}

        {!dead && <p className="bk-note">No card has been charged. Online payment is coming soon.</p>}
        </div>
        <PoweredBy hidden={c.operator_hide_powered_by} />
      </div>
    </>
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
