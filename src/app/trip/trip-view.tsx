// =============================================================================
//  trip-view.tsx — the operator's brochure, rendered
// =============================================================================
//  The presentational half of a trip page: everything from the masthead down.
//  It takes already-fetched data and draws it, so two routes can share it:
//
//    /trip/[operator]/[slug]   the public page   (published only, ISR cached)
//    /trip/preview/[id]        the console preview (any status, never cached)
//
//  It reveals no traveller data and no operator contact details. Availability
//  is counts only.
//
//  VARIANCE 6 · MOTION 4 · DENSITY 4 · RECIPE none
// =============================================================================

import type { ReactNode } from 'react';
import { format as money } from '@/lib/money';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { safeImageUrl, isVideoUrl } from '@/lib/url';
import { PoweredBy } from '@/lib/brand-ui';
import type { Departure, TripContent, TripSection, Operator, Trip, Package, ReviewSummary } from '@/lib/types';
import type { Availability } from '@/lib/capacity';
import { starParts } from '@/lib/reviews';

/** A public review as the trip page shows it (no ids, no booking). */
export interface PublicReview {
  id: string;
  reviewer_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
}

// Trip pages are deliberately light-only, so this is the ground every operator
// colour is checked against. See the note at the top of trip.css.
export const PAGE_BACKGROUND = '#ffffff';

export function TripView({
  operator, trip, departures, availability, packages = [], reviews,
}: {
  operator: Operator;
  trip: Trip;
  departures: Departure[];
  availability: Map<string, Availability>;
  packages?: Package[];
  reviews?: { summary: ReviewSummary; reviews: PublicReview[] };
}) {
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
            {isVideoUrl(heroUrl) ? (
              <video src={heroUrl} autoPlay muted loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroUrl} alt="" />
            )}
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
                <ol className={content.itineraryLayout === 'timeline' ? 't-timeline' : 't-days'}>
                  {content.days.map((day, i) => (
                    <li key={i}>
                      {content.itineraryLayout === 'timeline' && (
                        <span className="t-timeline-mark" aria-hidden="true">{i + 1}</span>
                      )}
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

            {packages.length > 0 && (
              <section>
                <h2>Room options</h2>
                <ul className="t-packages">
                  {packages.map((p) => <PackageCard key={p.id} pkg={p} currency={trip.currency} />)}
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
                      {isVideoUrl(src as string) ? (
                        <video src={src as string} muted loop playsInline controls preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src as string} alt="" loading="lazy" />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {reviews && reviews.reviews.length > 0 && (
              <section>
                <h2>Reviews</h2>
                <div className="t-rev-head">
                  <Stars average={reviews.summary.average} />
                  <span className="t-rev-avg">{reviews.summary.average.toFixed(1)}</span>
                  <span className="t-rev-count">
                    {reviews.summary.count} {reviews.summary.count === 1 ? 'review' : 'reviews'} from travellers who booked
                  </span>
                </div>
                <ul className="t-reviews">
                  {reviews.reviews.map((r) => (
                    <li key={r.id} className="t-review">
                      <div className="t-review-top">
                        <Stars average={r.rating} small />
                        {r.title && <strong className="t-review-title">{r.title}</strong>}
                      </div>
                      <p className="t-review-body">{r.body}</p>
                      <p className="t-review-by">{r.reviewer_name} · {reviewDate(r.created_at)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="t-foot">{trip.title} is operated by {operator.name}.</p>
          </main>
        </div>
        <PoweredBy hidden={operator.hide_powered_by} />
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

/** A room type on the public page: photo, price and a link, the three things
 *  WeTravel's rooming is missing. */
function PackageCard({ pkg, currency }: { pkg: Package; currency: string }) {
  const img = safeImageUrl(pkg.image_url);
  const price = money(pkg.price_pence, currency);
  const info = pkg.info_url && /^https:\/\//i.test(pkg.info_url) ? pkg.info_url : null;

  return (
    <li className="t-package">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" loading="lazy" />
      )}
      <div className="t-package-body">
        <div className="t-package-head">
          <h3>{pkg.name}</h3>
          {price && <span className="t-package-price">{price}<small> pp</small></span>}
        </div>
        {pkg.occupancy > 1 && <p className="t-package-occ">Sleeps {pkg.occupancy}</p>}
        {pkg.description && <p className="t-package-desc">{pkg.description}</p>}
        {info && <a href={info} target="_blank" rel="noopener noreferrer" className="t-package-link">More details</a>}
      </div>
    </li>
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

/** A row of five stars for an average (or a whole rating), full / half / empty. */
function Stars({ average, small }: { average: number; small?: boolean }) {
  const { full, half, empty } = starParts(average);
  const size = small ? 15 : 18;
  const star = (fill: 'full' | 'half' | 'empty', key: number) => (
    <svg key={key} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="t-star">
      {fill === 'half' && (
        <defs>
          <linearGradient id={`half${size}`}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z"
        fill={fill === 'full' ? 'currentColor' : fill === 'half' ? `url(#half${size})` : 'none'}
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
  const stars: ReactNode[] = [];
  let k = 0;
  for (let i = 0; i < full; i++) stars.push(star('full', k++));
  if (half) stars.push(star('half', k++));
  for (let i = 0; i < empty; i++) stars.push(star('empty', k++));
  return <span className="t-stars" role="img" aria-label={`${average.toFixed(1)} out of 5 stars`}>{stars}</span>;
}

function reviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
