// =============================================================================
//  /trip/[operator]/[slug] — the public trip page
// =============================================================================
//  Operator-branded, not Travelgenix-branded: the palette comes from the
//  operator's own brand record, not from our tokens.
//
//  Nothing here reveals traveller data. Availability is counts only: the select
//  list is party_size, status and hold_expires_at, and nothing is ever added
//  to it.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedTrip, listOpenDepartures } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import { format as money } from '@/lib/money';
import { tripsDbConfigured } from '@/lib/supabase';
import type { Departure, TripContent } from '@/lib/types';

// Matches the 60s CDN cache the widget availability endpoint already uses, so
// the origin is hit about once a minute per trip however busy the page gets.
export const revalidate = 60;

interface Params { operator: string; slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { operator, slug } = await params;
  if (!tripsDbConfigured()) return {};
  const found = await getPublishedTrip(operator, slug);
  if (!found) return {};
  return {
    title: `${found.trip.title} · ${found.operator.name}`,
    description: found.trip.summary ?? undefined,
    openGraph: {
      title: found.trip.title,
      description: found.trip.summary ?? undefined,
      images: found.trip.hero_image_url ? [found.trip.hero_image_url] : undefined,
    },
  };
}

export default async function TripPage({ params }: { params: Promise<Params> }) {
  const { operator: operatorSlug, slug } = await params;
  if (!tripsDbConfigured()) notFound();

  const found = await getPublishedTrip(operatorSlug, slug);
  if (!found) notFound();
  const { operator, trip } = found;

  const departures = await listOpenDepartures(trip.id);
  const availability = await availabilityByDeparture(departures);

  const content: TripContent = trip.content ?? {};
  const accent = safeColour(operator.brand?.primaryColour) ?? 'var(--tg-accent)';

  return (
    <main className="t-page">
      {trip.hero_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="t-hero" src={trip.hero_image_url} alt="" />
      )}

      <p className="t-operator">{operator.name}</p>
      <h1 className="t-title">{trip.title}</h1>
      {trip.location && <p className="t-location">{trip.location}</p>}
      {trip.summary && <p className="t-summary">{trip.summary}</p>}

      {content.overview && <p>{content.overview}</p>}

      {content.highlights && content.highlights.length > 0 && (
        <section>
          <h2>Highlights</h2>
          <ul className="t-bullets">
            {content.highlights.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </section>
      )}

      <section>
        <h2>Dates and prices</h2>
        {departures.length === 0 ? (
          <p className="t-quiet">No dates on sale at the moment.</p>
        ) : (
          <ul className="t-departures">
            {departures.map((d) => {
              const seats = availability.get(d.id);
              // A zero price is not free, it is unpriced.
              const price = money(d.price_pence, trip.currency);
              const deposit = money(d.deposit_pence, trip.currency);

              return (
                <li key={d.id}>
                  <span className="t-when">
                    {formatDate(d.starts_on)} to {formatDate(d.ends_on)}
                  </span>
                  <span className="t-price" style={{ color: accent }}>
                    {price ?? 'Price on request'}
                    {deposit && <small className="t-deposit">{deposit} deposit</small>}
                  </span>
                  <span className="t-seats">{describeAvailability(seats)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="t-quiet t-book">
          Booking opens shortly. In the meantime, get in touch with {operator.name} to reserve a place.
        </p>
      </section>

      {content.days && content.days.length > 0 && (
        <section>
          <h2>Day by day</h2>
          <ol className="t-days">
            {content.days.map((day, i) => (
              <li key={i}>
                <h3>{day.title}</h3>
                {day.body && <p>{day.body}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(content.included?.length || content.excluded?.length) && (
        <section className="t-two-up">
          {content.included && content.included.length > 0 && (
            <div>
              <h2>What is included</h2>
              <ul className="t-bullets">{content.included.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          {content.excluded && content.excluded.length > 0 && (
            <div>
              <h2>What is not</h2>
              <ul className="t-bullets">{content.excluded.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function describeAvailability(seats: { capacity: number; remaining: number; soldOut: boolean } | undefined): string {
  if (!seats || seats.capacity <= 0) return '';
  if (seats.soldOut) return 'Sold out';
  if (seats.remaining <= 3) return `Only ${seats.remaining} left`;
  return `${seats.remaining} places left`;
}

/** Operator brand colours are author-supplied, so they are whitelisted rather
 *  than interpolated. Anything that is not a plain hex is ignored. */
function safeColour(value: string | undefined): string | null {
  return value && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : null;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
