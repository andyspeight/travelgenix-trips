// =============================================================================
//  /trip/[operator]/[slug] — the public trip page
// =============================================================================
//  The operator's brochure. Their palette, their typeface, their photography.
//  We supply structure and restraint and nothing else.
//
//  VARIANCE 6 · MOTION 4 · DENSITY 4 · RECIPE none
//
//  Nothing here reveals traveller data or operator contact details.
//  Availability is counts only: the select list is party_size, status and
//  hold_expires_at, and nothing is ever added to it.
// =============================================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedTrip, listOpenDepartures } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import { format as money } from '@/lib/money';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { safeImageUrl } from '@/lib/url';
import { tripsDbConfigured } from '@/lib/supabase';
import type { Departure, TripContent, TripSection, Operator } from '@/lib/types';
import type { Availability } from '@/lib/capacity';

export const revalidate = 60;

// Trip pages are deliberately light-only, so this is the ground every operator
// colour is checked against. See the note at the top of trip.css.
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

  // One value drives the whole page, checked against the ground it renders on.
  const accent = readableOn(operator.brand?.primaryColour, PAGE_BACKGROUND, '#0e6e5c');
  const font = operatorFont(operator.brand?.fontFamily);
  const heroUrl = safeImageUrl(trip.hero_image_url);
  const logoUrl = safeImageUrl(operator.brand?.logoUrl);

  // "From" is the cheapest priced departure. An unpriced one is not free, so it
  // does not get to be the cheapest.
  const priced = departures.map((d) => d.price_pence).filter((p): p is number => !!p && p > 0);
  const fromPence = priced.length ? Math.min(...priced) : null;

  return (
    <>
      {font.href && <link rel="stylesheet" href={font.href} />}

      <div
        className="t-page"
        style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack }}
      >
        {/* The operator's name as a page masthead. Not a kicker above the
            heading, which the craft floor bans outright. */}
        <header className="t-mast">
          <div className="t-mast-wrap">
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt={operator.name} />
              : <span>{operator.name}</span>}
          </div>
        </header>

        {heroUrl && (
          <div className="t-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" />
          </div>
        )}

        <div className="t-body">
          {/* Rail first in the DOM so a phone meets the price early; CSS puts
              it in column two on a wide screen. */}
          <aside className="t-rail">
            <OfferRail
              trip={trip}
              tripSlug={trip.slug}
              operator={operator}
              departures={departures}
              availability={availability}
              fromPence={fromPence}
            />
          </aside>

          <main className="t-main">
            <div className="t-lede">
              <h1 className="t-title">{trip.title}</h1>
              <p className="t-where">
                {[trip.location, content.durationText].filter(Boolean).join('  ·  ')}
              </p>
              {trip.summary && <p className="t-summary">{trip.summary}</p>}
            </div>

            {content.overview && <section><p>{content.overview}</p></section>}

            {content.highlights && content.highlights.length > 0 && (
              <section>
                <h2>Highlights</h2>
                <ul className="t-bullets">
                  {content.highlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </section>
            )}

            {content.glance && content.glance.length > 0 && (
              <section>
                <h2>At a glance</h2>
                <div className="t-scroll">
                  <table className="t-glance">
                    <thead>
                      <tr>
                        <th scope="col">Day</th><th scope="col">Date</th>
                        <th scope="col">Where</th><th scope="col">Staying at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.glance.map((g, i) => (
                        <tr key={i}>
                          <th scope="row">{g.day}</th>
                          <td>{g.date}</td><td>{g.destination}</td><td>{g.accommodation}</td>
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
                      {(day.label || day.date) && (
                        <span className="t-day-label">
                          {[day.label, day.date].filter(Boolean).join('  ·  ')}
                        </span>
                      )}
                      <h3>{day.title}</h3>
                      {day.body && <p>{day.body}</p>}

                      {day.facts && day.facts.length > 0 && (
                        <dl className="t-facts">
                          {day.facts.map((f, k) => (
                            <div key={k}><dt>{f.label}</dt><dd>{f.value}</dd></div>
                          ))}
                        </dl>
                      )}

                      {day.images && day.images.length > 0 && (
                        <div className="t-day-shots">
                          {day.images.map(safeImageUrl).filter(Boolean).map((src, k) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={k} src={src as string} alt="" loading="lazy" />
                          ))}
                        </div>
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
              <section>
                <h2>What is and is not included</h2>
                <div className="t-two-up">
                  {content.included && content.included.length > 0 && (
                    <div>
                      <h3>Included</h3>
                      <ul className="t-bullets">{content.included.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  )}
                  {content.excluded && content.excluded.length > 0 && (
                    <div>
                      <h3>Not included</h3>
                      <ul className="t-bullets">{content.excluded.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  )}
                </div>
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

            {content.sections?.map((section, i) => <Section key={i} section={section} />)}

            {content.gallery && content.gallery.length > 0 && (
              <section>
                <h2>Gallery</h2>
                <ul className="t-gallery">
                  {content.gallery.map(safeImageUrl).filter(Boolean).map((src, i) => (
                    <li key={i}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src as string} alt="" loading="lazy" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="t-foot">{trip.title} is operated by {operator.name}.</p>
          </main>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function OfferRail({
  trip, tripSlug, operator, departures, availability, fromPence,
}: {
  trip: { currency: string };
  tripSlug: string;
  operator: Operator;
  departures: Departure[];
  availability: Map<string, Availability>;
  fromPence: number | null;
}) {
  const from = money(fromPence, trip.currency);

  return (
    <div className="t-rail-inner">
      <div className="t-rail-head">
        <span className="t-rail-from">{from ? 'From' : 'Price'}</span>
        <strong className="t-rail-price">{from ?? 'On request'}</strong>
        <p className="t-rail-per">{from ? 'per person, sharing' : `Ask ${operator.name} for a quote`}</p>
      </div>

      {departures.length === 0 ? (
        <p className="t-rail-note" style={{ padding: '18px 22px' }}>
          No dates on sale at the moment. New departures are added here as they open.
        </p>
      ) : (
        <ul className="t-dates">
          {departures.map((d) => {
            const seats = availability.get(d.id);
            const price = money(d.price_pence, trip.currency);
            const deposit = money(d.deposit_pence, trip.currency);
            return (
              <li key={d.id}>
                <div className={`t-date-when${seats?.soldOut ? ' t-gone' : ''}`}>
                  {formatRange(d.starts_on, d.ends_on)}
                </div>
                <div className="t-date-meta">
                  <span className="t-date-price">{price ?? 'On request'}</span>
                  <span>{describeSeats(seats)}</span>
                </div>
                {deposit && !seats?.soldOut && (
                  <div className="t-date-meta"><span>{deposit} deposit secures a place</span></div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="t-rail-foot">
        {departures.length > 0 ? (
          <>
            <a className="t-cta" href={`/book/${operator.slug}/${tripSlug}`}>Reserve a place</a>
            <p className="t-rail-note">
              We hold your places while {operator.name} confirms. No card is charged now.
            </p>
          </>
        ) : (
          <p className="t-rail-note">
            No dates are open just now. Speak to {operator.name} about future departures.
          </p>
        )}
      </div>
    </div>
  );
}

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
      <section>
        <h2>{section.heading}</h2>
        <div className="t-feature">
          {safeImageUrl(section.image) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={safeImageUrl(section.image) as string} alt="" loading="lazy" />
          )}
          <div><Paragraphs body={section.body} /></div>
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

/** Author copy carries real blank lines. Split rather than setting HTML, so a
 *  paragraph break survives and markup never does. */
function Paragraphs({ body }: { body: string }) {
  return <>{body.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</>;
}

function describeSeats(seats: Availability | undefined): string {
  if (!seats || seats.capacity <= 0) return '';
  if (seats.soldOut) return 'Sold out';
  if (seats.remaining <= 3) return `${seats.remaining} left`;
  return `${seats.remaining} places`;
}

/** Drops the repeated year and month where they add nothing. */
function formatRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'short' };

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  const left = sameMonth
    ? String(start.getUTCDate())
    : start.toLocaleDateString('en-GB', opts);
  const right = end.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${left} to ${right}`;
}
