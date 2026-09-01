// =============================================================================
//  widget-previews.tsx — faithful, static renders of the four embeddable
//  widgets (public/embed.js): the trip card, a grid of trips, the bare book
//  button and the reviews block. The classes (.wg-*) mirror embed.js CARD_CSS
//  value for value, so what a visitor sees here is what the real widget draws,
//  only dressed with our own travel photography and a demo operator brand. No
//  script, no API call: these are marketing previews, not the live component.
// =============================================================================

import type { CSSProperties } from 'react';

// The demo operator's brand navy, on purpose different from the site's teal, so
// the previews read as "your brand on your site", not ours.
const ACCENT = '#1b2b5b';
const accentVar = { '--wg-accent': ACCENT } as CSSProperties;

type Trip = {
  photo: string; op: string; title: string; where: string;
  price: string; per?: string; dates: string;
};

// One trip card, wired like the real widget minus the click-to-book overlay.
export function WidgetCard({ trip, cta = 'Reserve a place' }: { trip: Trip; cta?: string }) {
  return (
    <div className="wg-card" style={accentVar}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="wg-hero" src={trip.photo} alt="" loading="lazy" decoding="async" />
      <div className="wg-body">
        <p className="wg-op"><span>{trip.op}</span></p>
        <h3 className="wg-title">{trip.title}</h3>
        <p className="wg-where">{trip.where}</p>
        <div className="wg-meta">
          <span className="wg-price"><b>{trip.price}</b><small>{trip.per ?? 'per person'}</small></span>
          <span className="wg-dates">{trip.dates}</span>
        </div>
        <span className="wg-cta">{cta}</span>
        <p className="wg-foot">Booking by {trip.op}</p>
      </div>
    </div>
  );
}

export function WidgetGrid({ trips }: { trips: Trip[] }) {
  return (
    <div className="wg-grid">
      {trips.map((t) => <WidgetCard key={t.title} trip={t} />)}
    </div>
  );
}

export function WidgetButton({ label = 'Book your place' }: { label?: string }) {
  return <span className="wg-book" style={accentVar}>{label}</span>;
}

function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="wg-stars" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      <span className="wg-stars-empty" aria-hidden="true">★★★★★</span>
      <span className="wg-stars-fill" aria-hidden="true" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

type Review = { rating: number; title?: string; body: string; by: string };

export function WidgetReviews({ average, count, reviews }: { average: number; count: number; reviews: Review[] }) {
  return (
    <div className="wg-revw">
      <div className="wg-rv-sum">
        <Stars value={average} />
        <span className="wg-rv-avg">{average.toFixed(1)}</span>
        <span className="wg-rv-cnt">{count} {count === 1 ? 'review' : 'reviews'}</span>
      </div>
      <ul className="wg-rv-list">
        {reviews.map((r) => (
          <li className="wg-rv-item" key={r.by + r.body.slice(0, 12)}>
            <div className="wg-rv-top">
              <Stars value={r.rating} />
              {r.title && <span className="wg-rv-ttl">{r.title}</span>}
            </div>
            <p className="wg-rv-body">{r.body}</p>
            <p className="wg-rv-by">{r.by}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- shared demo content ---------------------------------------------------

export const DEMO_CARD: Trip = {
  photo: '/photos/safari.jpg', op: 'Global Travel Solution',
  title: 'Kenya Johari na Bahari Safari', where: 'Kenya  ·  10 nights, small group',
  price: '£3,700', dates: '24 Oct to 3 Nov 2026',
};

export const DEMO_GRID: Trip[] = [
  DEMO_CARD,
  { photo: '/photos/highlands.jpg', op: 'Global Travel Solution', title: 'Highlands Walking Week', where: 'Scotland  ·  7 nights', price: '£1,450', dates: '4 departures' },
  { photo: '/photos/amalfi.jpg', op: 'Global Travel Solution', title: 'Amalfi in Autumn', where: 'Italy  ·  6 nights', price: '£2,200', dates: 'Sep to Nov 2026' },
];

export const DEMO_REVIEWS: Review[] = [
  { rating: 5, title: 'The trip of a lifetime', body: 'Every detail was handled. The guides were superb and the itinerary flowed beautifully from the plains to the coast.', by: 'Marie C.' },
  { rating: 5, title: 'Booked the next one before we flew home', body: 'Deposits and the traveller hub made a group of twelve feel effortless. We always knew what was next.', by: 'Alan T.' },
  { rating: 4, body: 'A wonderful week in the Highlands. Well paced, warm hosts, and the booking was the easiest part.', by: 'Grace H.' },
];

// No-arg demos, so the feature-page visual dispatcher can drop them in.
export function WidgetCardDemo() { return <WidgetCard trip={DEMO_CARD} />; }
export function WidgetGridDemo() { return <WidgetGrid trips={DEMO_GRID} />; }
