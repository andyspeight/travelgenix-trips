// =============================================================================
//  /trip/preview/[id] — the operator's own preview of a trip page
// =============================================================================
//  The same brochure the public sees, but reachable for a trip in ANY status
//  and never cached, so an operator can check their work before publishing and
//  see an edit the moment they save it.
//
//  Gated exactly like the console: you must be signed in (or in the review
//  preview session), and getTripOwned returns null for a trip that is not
//  yours, so a guessed id cannot preview someone else's draft. A draft is only
//  ever visible through here, never on the public /trip/[operator]/[slug] route.
// =============================================================================

import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ensureOperator, getTripOwned, listOpenDepartures, listPackages, getApprovedReviews } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import { tripsDbConfigured } from '@/lib/supabase';
import { TripView } from '../../trip-view';

export const dynamic = 'force-dynamic';

export default async function TripPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!tripsDbConfigured()) notFound();

  const session = await getSession();
  if (!session) notFound();

  const operator = await ensureOperator(session);
  if (!operator) notFound();

  const trip = await getTripOwned(id, operator.id);
  if (!trip) notFound();

  const departures = await listOpenDepartures(trip.id);
  const availability = await availabilityByDeparture(departures);
  const packages = await listPackages(trip.id);
  const reviews = await getApprovedReviews(trip.id);

  const published = trip.status === 'published';

  return (
    <>
      {/* A slim, deliberately un-branded bar so it is unmistakably the console
          preview and never mistaken for the operator's live page. Inline styles
          keep it self-contained and unable to clash with the operator palette. */}
      <div
        role="status"
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center',
          padding: '9px 18px', background: '#12211f', color: '#e9edea',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          fontSize: 13, lineHeight: 1.4,
        }}
      >
        <strong style={{ fontWeight: 600 }}>Preview</strong>
        <span style={{ color: '#9fb0ab' }}>
          {published
            ? 'This is your live page. Edits show here the moment you save.'
            : 'Draft. Only you can see this. Publish to make it public.'}
        </span>
        <a
          href={`/console/trips/${trip.id}`}
          style={{ marginLeft: 'auto', color: '#7fd7c0', textDecoration: 'none', fontWeight: 600 }}
        >
          Back to editor
        </a>
      </div>

      <TripView operator={operator} trip={trip} departures={departures} availability={availability} packages={packages} reviews={reviews} />
    </>
  );
}
