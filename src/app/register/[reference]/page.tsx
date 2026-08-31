// =============================================================================
//  /register/[reference] — a traveller completes their booking
// =============================================================================
//  Reachable by anyone holding the reference, exactly like /booked: it is the
//  same bearer token. Collects each traveller's details, the operator's custom
//  questions and — where the waiver is mandatory — a signature per traveller.
//  Never cached, so a returning traveller sees what they already saved.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRegistrationContext, getOperatorById, getOperatorBrandByReference } from '@/lib/repo';
import { normaliseReference } from '@/lib/booking';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { BrandMast, PoweredBy } from '@/lib/brand-ui';
import { operatorMetadata } from '@/lib/seo';
import { tripsDbConfigured } from '@/lib/supabase';
import { RegistrationForm, type SlotPrefill } from '../registration-form';
import type { Operator } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  if (!tripsDbConfigured()) return { title: 'Complete your booking' };
  const { reference } = await params;
  const b = await getOperatorBrandByReference(normaliseReference(reference) || reference);
  if (!b) return { title: 'Complete your booking' };
  return operatorMetadata({
    title: `Complete your booking · ${b.operatorName}`,
    description: `Add your details to complete your booking with ${b.operatorName}.`,
    operatorName: b.operatorName,
    logoUrl: b.logoUrl,
  });
}

export default async function RegisterPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!tripsDbConfigured()) notFound();

  const ref = normaliseReference(reference);
  if (!ref) notFound();

  const ctx = await getRegistrationContext(ref);
  if (!ctx) notFound();

  // The operator's brand, for the same operator-branded look as the trip page.
  // getRegistrationContext gives the name; the palette lives on the operator row.
  const operator: Operator | null = ctx.booking.operator_id
    ? await getOperatorById(ctx.booking.operator_id)
    : null;
  const accent = readableOn(operator?.brand?.primaryColour, '#ffffff', '#0e6e5c');
  const font = operatorFont(operator?.brand?.fontFamily);

  const dead = ctx.booking.status === 'expired' || ctx.booking.status === 'cancelled';

  // Prefill: existing traveller rows in slot order, plus any answers already
  // given and who has already signed.
  const answersByTraveller = new Map<string, Record<string, string>>();
  for (const r of ctx.responses) if (r.traveller_id) answersByTraveller.set(r.traveller_id, r.answers ?? {});
  const bookingAnswers = ctx.responses.find((r) => r.traveller_id == null)?.answers ?? {};
  const signedIds = new Set(ctx.signatures.map((s) => s.traveller_id).filter((x): x is string => !!x));

  const slots: SlotPrefill[] = ctx.travellers.slice(0, ctx.booking.party_size).map((t) => ({
    id: t.id,
    full_name: t.full_name ?? '',
    email: t.email ?? '',
    phone: t.phone ?? '',
    date_of_birth: t.date_of_birth ?? '',
    answers: answersByTraveller.get(t.id) ?? {},
    signed: signedIds.has(t.id),
    signed_name: signedIds.has(t.id) ? (t.full_name ?? '') : '',
  }));

  return (
    <>
      {font.href && <link rel="stylesheet" href={font.href} />}
      <div className="t-page bk-page" style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack }}>
        <BrandMast name={operator?.name ?? ctx.booking.operator_name} logoUrl={operator?.brand?.logoUrl} />

        <div className="bk-wrap">
          <div className="bk-lede">
            <Link href={`/booked/${ctx.booking.reference}`} className="bk-back">← Back to your confirmation</Link>
            <h1>Complete your booking</h1>
            <p className="bk-sub-line">
              {ctx.booking.trip_title} · reference <strong>{ctx.booking.reference}</strong>
            </p>
          </div>

          {dead ? (
            <p className="bk-soldout">
              This booking is no longer active, so there is nothing to complete. If you still
              want to travel, please book again or contact {ctx.booking.operator_name}.
            </p>
          ) : (
            <RegistrationForm
              reference={ctx.booking.reference}
              partySize={ctx.booking.party_size}
              slots={slots}
              schema={ctx.form?.schema ?? []}
              waiver={ctx.waiver ? { title: ctx.waiver.title, body: ctx.waiver.body, is_mandatory: ctx.waiver.is_mandatory, version: ctx.waiver.version } : null}
              bookingAnswers={bookingAnswers}
              documents={ctx.documents}
            />
          )}
        </div>
        <PoweredBy hidden={operator?.hide_powered_by} />
      </div>
    </>
  );
}
