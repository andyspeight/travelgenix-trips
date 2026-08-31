// =============================================================================
//  /trip/[operator]/[slug] — the public trip page
// =============================================================================
//  The operator's brochure. Their palette, their typeface, their photography.
//  We supply structure and restraint and nothing else. Published trips only;
//  the drawing lives in ../../trip-view.tsx, shared with the console preview.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedTrip, listOpenDepartures, listPackages, getApprovedReviews } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import { isVideoUrl } from '@/lib/url';
import { operatorMetadata } from '@/lib/seo';
import { tripsDbConfigured } from '@/lib/supabase';
import { TripView } from '../../trip-view';

export const revalidate = 60;

interface Params { operator: string; slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { operator, slug } = await params;
  if (!tripsDbConfigured()) return {};
  const found = await getPublishedTrip(operator, slug);
  if (!found) return {};
  return operatorMetadata({
    title: `${found.trip.title} · ${found.operator.name}`,
    description: found.trip.summary,
    operatorName: found.operator.name,
    logoUrl: found.operator.brand?.logoUrl,
    image: found.trip.hero_image_url && !isVideoUrl(found.trip.hero_image_url) ? found.trip.hero_image_url : null,
  });
}

export default async function TripPage({ params }: { params: Promise<Params> }) {
  const { operator: operatorSlug, slug } = await params;
  if (!tripsDbConfigured()) notFound();

  const found = await getPublishedTrip(operatorSlug, slug);
  if (!found) notFound();
  const { operator, trip } = found;

  const departures = await listOpenDepartures(trip.id);
  const availability = await availabilityByDeparture(departures);
  const packages = await listPackages(trip.id);
  const reviews = await getApprovedReviews(trip.id);

  return <TripView operator={operator} trip={trip} departures={departures} availability={availability} packages={packages} reviews={reviews} />;
}
