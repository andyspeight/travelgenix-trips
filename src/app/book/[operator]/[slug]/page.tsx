// =============================================================================
//  /book/[operator]/[slug] — the checkout, up to the payment seam
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedTrip, listOpenDepartures, listPackages, listOptions } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { tripsDbConfigured } from '@/lib/supabase';
import { BookingForm } from '../../form';
import { WaitlistForm } from '../../waitlist-form';

export const dynamic = 'force-dynamic';

interface Params { operator: string; slug: string }
interface Search { departure?: string }

export const metadata: Metadata = { title: 'Book your place' };

export default async function BookPage({
  params, searchParams,
}: {
  params: Promise<Params>; searchParams: Promise<Search>;
}) {
  const { operator: operatorSlug, slug } = await params;
  const { departure } = await searchParams;
  if (!tripsDbConfigured()) notFound();

  const found = await getPublishedTrip(operatorSlug, slug);
  if (!found) notFound();
  const { operator, trip } = found;

  const all = await listOpenDepartures(trip.id);
  const availability = await availabilityByDeparture(all);
  const packages = await listPackages(trip.id);
  const options = await listOptions(trip.id);
  // Only offer departures that still have room. A sold-out date on a booking
  // form is a dead end.
  // A departure only appears if it can actually be held: capacity set, and not
  // sold out. A capacity-0 departure would just return sold_out, a dead end.
  const bookable = all.filter((d) => {
    if (d.capacity <= 0) return false;
    const a = availability.get(d.id);
    return !a || !a.soldOut;
  });

  const accent = readableOn(operator.brand?.primaryColour, '#ffffff', '#0e6e5c');
  const font = operatorFont(operator.brand?.fontFamily);

  return (
    <>
      {font.href && <link rel="stylesheet" href={font.href} />}
      <div className="t-page bk-page" style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack }}>
        <header className="t-mast">
          <div className="t-mast-wrap">
            <a href={`/trip/${operator.slug}/${trip.slug}`} className="bk-back">← {trip.title}</a>
          </div>
        </header>

        <div className="bk-wrap">
          <div className="bk-lede">
            <p className="bk-op">{operator.name}</p>
            <h1>Book {trip.title}</h1>
          </div>

          {bookable.length === 0 ? (
            <WaitlistForm tripId={trip.id} operatorName={operator.name} />
          ) : (
            <BookingForm tripId={trip.id} departures={bookable} packages={packages} options={options} currency={trip.currency} initialDeparture={departure} />
          )}
        </div>
      </div>
    </>
  );
}
