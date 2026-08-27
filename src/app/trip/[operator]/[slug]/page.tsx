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
import { readableOn } from '@/lib/colour';
import type { Departure, TripContent, TripSection } from '@/lib/types';

// Matches the 60s CDN cache the widget availability endpoint already uses, so
// the origin is hit about once a minute per trip however busy the page gets.
export const revalidate = 60;

// Public trip pages are deliberately light-only, so this is the ground every
// operator colour is checked against. See the note at the top of trip.css.
const PAGE_BACKGROUND = '#ffffff';

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

  // The operator's colour, checked against the white the page actually renders
  // on and nudged only if it fails. It keeps their hue, so it still reads as
  // their brand rather than being swapped for ours.
  const accent = readableOn(operator.brand?.primaryColour, PAGE_BACKGROUND, '#0e6e5c');

  return (
    <main className="t-page" style={{ ["--op-accent" as string]: accent }}>
      {trip.hero_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="t-hero" src={trip.hero_image_url} alt="" />
      )}

      <p className="t-operator">{operator.name}</p>
      <h1 className="t-title">{trip.title}</h1>
      {(trip.location || content.durationText) && (
        <p className="t-location">
          {[trip.location, content.durationText].filter(Boolean).join(' · ')}
        </p>
      )}
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
                  <span className="t-price">
                    {price ?? 'Price on request'}
                    {deposit && <small className="t-deposit">{deposit} deposit</small>}
                  </span>
                  <span className="t-seats">{describeAvailability(seats)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {content.priceNote && <p className="t-quiet t-note">{content.priceNote}</p>}
        <p className="t-quiet t-book">
          Booking opens shortly. In the meantime, get in touch with {operator.name} to reserve a place.
        </p>
      </section>

      {content.glance && content.glance.length > 0 && (
        <section>
          <h2>At a glance</h2>
          <div className="t-scroll">
            <table className="t-glance">
              <thead>
                <tr><th scope="col">Day</th><th scope="col">Date</th><th scope="col">Where</th><th scope="col">Staying at</th></tr>
              </thead>
              <tbody>
                {content.glance.map((g, i) => (
                  <tr key={i}>
                    <th scope="row">{g.day}</th>
                    <td>{g.date}</td>
                    <td>{g.destination}</td>
                    <td>{g.accommodation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {content.days && content.days.length > 0 && (
        <section>
          <h2>Day by day</h2>
          <ol className="t-days">
            {content.days.map((day, i) => (
              <li key={i}>
                {day.label && <span className="t-day-label">{day.label}{day.date ? ` · ${day.date}` : ''}</span>}
                <h3>{day.title}</h3>
                {day.body && <p>{day.body}</p>}

                {day.facts && day.facts.length > 0 && (
                  <dl className="t-facts">
                    {day.facts.map((f, k) => (
                      <div key={k}>
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {day.optionalActivities && day.optionalActivities.length > 0 && (
                  <ul className="t-extras">
                    {day.optionalActivities.map((o, k) => (
                      <li key={k}>
                        <span>{o.name}</span>
                        <span className="t-extra-price">
                          {money(o.pricePence ?? null, trip.currency) ?? 'On request'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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
      {content.extras && content.extras.length > 0 && (
        <section>
          <h2>Optional extras</h2>
          <ul className="t-extras t-extras--wide">
            {content.extras.map((x, i) => (
              <li key={i}>
                <span>
                  {x.name}
                  {x.recommended && <em className="t-flag">Recommended</em>}
                  {x.note && <small>{x.note}</small>}
                </span>
                <span className="t-extra-price">
                  {/* Zero is unpriced, not free. */}
                  {money(x.pricePence ?? null, trip.currency) ?? 'On request'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {content.sections?.map((section, i) => (
        <Section key={i} section={section} />
      ))}

      {content.gallery && content.gallery.length > 0 && (
        <section>
          <h2>Gallery</h2>
          <div className="t-gallery">
            {content.gallery.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" loading="lazy" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/** The three practical-section shapes the Tour Builder emits. */
function Section({ section }: { section: TripSection }) {
  if (section.type === 'columns') {
    return (
      <section>
        <h2>{section.heading}</h2>
        <div className="t-two-up">
          {section.columns.map((col, i) => (
            <div key={i}>
              <h3>{col.heading}</h3>
              <ul className="t-bullets">{col.items.map((it, k) => <li key={k}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.type === 'feature') {
    return (
      <section className="t-feature">
        {section.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={section.image} alt="" loading="lazy" />
        )}
        <div>
          <h2>{section.heading}</h2>
          <Paragraphs body={section.body} />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>{section.heading}</h2>
      <Paragraphs body={section.body} />
    </section>
  );
}

/** Author copy carries real blank lines. Split rather than dangerously setting
 *  HTML, so a paragraph break survives and markup never does. */
function Paragraphs({ body }: { body: string }) {
  return (
    <>
      {body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
    </>
  );
}

function describeAvailability(seats: { capacity: number; remaining: number; soldOut: boolean } | undefined): string {
  if (!seats || seats.capacity <= 0) return '';
  if (seats.soldOut) return 'Sold out';
  if (seats.remaining <= 3) return `Only ${seats.remaining} left`;
  return `${seats.remaining} places left`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
