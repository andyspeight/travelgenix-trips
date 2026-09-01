import type { Metadata } from 'next';
import Link from 'next/link';
import { IconCheck, IconArrow } from '../site-chrome';
import {
  WidgetCard, WidgetGrid, WidgetButton, WidgetReviews,
  DEMO_CARD, DEMO_GRID, DEMO_REVIEWS,
} from '../widget-previews';

export const metadata: Metadata = {
  title: 'Widgets — Travelgenix Trips',
  description:
    'Four embeddable widgets that put your trips on your own website, in your own brand: a trip card, a grid of trips, a book button and verified reviews. One line of script.',
};

const SCRIPT = '<script src="https://trips.travelify.io/embed.js" defer></script>';

// A snippet block: the container div (with its attribute highlighted) plus the
// one shared script line.
function Snippet({ attr, value }: { attr: string; value: string }) {
  return (
    <pre className="wg-snip" aria-label="Embed snippet">
      <code>
        {`<div ${attr}="`}<span className="k">{value}</span>{`"></div>\n`}
        {SCRIPT}
      </code>
    </pre>
  );
}

type Block = {
  id: string; tag: string; name: string; blurb: string;
  points: string[]; attr: string; value: string; preview: React.ReactNode;
};

const BLOCKS: Block[] = [
  {
    id: 'card', tag: 'data-tg-trip', name: 'Trip card',
    blurb: 'One trip, shown as a rich card with your photography, the from price and the next dates. Reserve opens the booking flow in an overlay, so the visitor never leaves your page.',
    points: ['Hero image, price and live availability', 'Opens booking in an overlay, on your site', 'Your logo, colours and font'],
    attr: 'data-tg-trip', value: 'TRIP_ID',
    preview: <WidgetCard trip={DEMO_CARD} />,
  },
  {
    id: 'grid', tag: 'data-tg-trips', name: 'Trip grid',
    blurb: 'Every trip you have on sale, in a responsive grid that stays in step with what you publish. Add a departure in the console and it appears here, no code change.',
    points: ['Auto-fills from your published trips', 'Responsive from mobile to wide', 'Always current, never a stale list'],
    attr: 'data-tg-trips', value: 'OPERATOR_SLUG',
    preview: <WidgetGrid trips={DEMO_GRID} />,
  },
  {
    id: 'book', tag: 'data-tg-book', name: 'Book button',
    blurb: 'Already have your own trip page and only want the checkout? Drop a single button anywhere and it opens the branded booking flow for that trip.',
    points: ['For pages you have already built', 'Opens the same secure booking overlay', 'Nothing else on the page changes'],
    attr: 'data-tg-book', value: 'TRIP_ID',
    preview: (
      <div className="wg-book-stage">
        <p className="wg-book-lead">…secure your place on the October departure.</p>
        <WidgetButton label="Book your place" />
      </div>
    ),
  },
  {
    id: 'reviews', tag: 'data-tg-reviews', name: 'Reviews',
    blurb: 'Your approved, verified reviews with a star rating roll-up, so the trust you have earned shows where people decide. Only reviews from real bookers, only once you approve them.',
    points: ['Verified: only real travellers can leave one', 'You approve before anything shows', 'A star roll-up plus the words'],
    attr: 'data-tg-reviews', value: 'TRIP_ID',
    preview: <WidgetReviews average={4.8} count={27} reviews={DEMO_REVIEWS} />,
  },
];

export default function WidgetsPage() {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap">
          <h1>Sell your trips anywhere</h1>
          <p>
            Four embeddable widgets put your trips on the website your customers already visit, in your own brand. Add one
            line of script, drop in a container, and you are selling. They are CSP-clean and sandboxed in a shadow root, so
            they sit safely on any site and never inherit its styles.
          </p>
          <div className="m-hero-cta">
            <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
            <Link className="m-btn m-btn--ghost m-btn--lg" href="/features/widgets">How widgets work <IconArrow /></Link>
          </div>
        </div>
      </section>

      {BLOCKS.map((b, i) => (
        <section className={`m-split${i % 2 === 1 ? ' m-split--rev' : ''}`} key={b.id} id={b.id}>
          <div className="m-wrap">
            <div className="m-split-text">
              <p className="wg-kicker"><code>{b.tag}</code></p>
              <h2>{b.name}</h2>
              <p>{b.blurb}</p>
              <ul>
                {b.points.map((p) => (<li key={p}><IconCheck size={18} />{p}</li>))}
              </ul>
              <Snippet attr={b.attr} value={b.value} />
            </div>
            <div className="m-split-visual">
              <div className="wg-stage">{b.preview}</div>
            </div>
          </div>
        </section>
      ))}

      <section className="m-sec m-sec--paper">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>One script, every widget</h2>
            <p>Add the script once, then use as many containers as you like on as many pages as you like.</p>
          </div>
          <div className="m-benefits">
            <div className="m-benefit"><div className="m-benefit-ic"><IconCheck size={20} /></div><h3>Safe on any site</h3><p>CSP-clean and rendered in a shadow root: no inline scripts, and the host page&rsquo;s CSS can neither leak in nor break the widget.</p></div>
            <div className="m-benefit"><div className="m-benefit-ic"><IconCheck size={20} /></div><h3>Always your brand</h3><p>Every widget wears your logo, colours and font, so it looks like part of your site, not a bolt-on from someone else.</p></div>
            <div className="m-benefit"><div className="m-benefit-ic"><IconCheck size={20} /></div><h3>Or a hosted page</h3><p>No website you can edit? Every trip also has its own hosted page, ready to share as a link.</p></div>
          </div>
        </div>
      </section>

      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>Put your trips on your own site</h2>
          <p>Book a short demo and we will set up your first trip and hand you the snippet.</p>
          <div className="m-hero-cta" style={{ justifyContent: 'center' }}>
            <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
            <Link className="m-btn m-btn--ghost m-btn--lg" href="/features/widgets">Widgets, in depth</Link>
          </div>
        </div>
      </section>
    </>
  );
}
