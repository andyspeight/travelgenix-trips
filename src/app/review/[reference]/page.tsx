// =============================================================================
//  /review/[reference] — leave a verified review
// =============================================================================
//  Reachable by anyone holding the booking reference, the same bearer token as
//  /booked and /register. That is what makes a review verified: it can only come
//  from someone who actually booked. The review lands pending and is shown
//  publicly only once the operator approves it.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getReviewContext, getOperatorById } from '@/lib/repo';
import { normaliseReference } from '@/lib/booking';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { tripsDbConfigured } from '@/lib/supabase';
import { ReviewForm } from '../review-form';
import type { Operator } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leave a review' };

export default async function ReviewPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  if (!tripsDbConfigured()) notFound();

  const ref = normaliseReference(reference);
  if (!ref) notFound();

  const ctx = await getReviewContext(ref);
  if (!ctx) notFound();

  const operator: Operator | null = await getOperatorById(ctx.operatorId);
  const accent = readableOn(operator?.brand?.primaryColour, '#ffffff', '#0e6e5c');
  const font = operatorFont(operator?.brand?.fontFamily);

  return (
    <>
      {font.href && <link rel="stylesheet" href={font.href} />}
      <div className="t-page bk-page" style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack }}>
        <header className="t-mast">
          <div className="t-mast-wrap">
            <Link href={`/booked/${ref}`} className="bk-back">← Back to your booking</Link>
          </div>
        </header>

        <div className="bk-wrap">
          <div className="bk-lede">
            <p className="bk-op">{ctx.operatorName}</p>
            <h1>How was {ctx.tripTitle}?</h1>
            <p className="bk-sub-line">Your review helps other travellers. It appears once {ctx.operatorName} has approved it.</p>
          </div>

          {ctx.alreadyReviewed ? (
            <div className="bk-reg-done">
              <p>Thank you, you have already reviewed this trip.</p>
              <Link className="bk-cta bk-cta--ghost" href={`/booked/${ref}`}>Back to your booking</Link>
            </div>
          ) : (
            <ReviewForm reference={ref} defaultName={ctx.leadName ?? ''} />
          )}
        </div>
      </div>
    </>
  );
}
