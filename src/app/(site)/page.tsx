import type { Metadata } from 'next';
import Link from 'next/link';
import {
  IconWallet, IconSparkle, IconPhone, IconCheck, IconPlus, IconArrow,
} from './site-chrome';

export const metadata: Metadata = {
  title: 'Travelgenix Trips — sell group trips, keep your money',
  description:
    'The platform for selling group trips and escorted tours. Build a beautiful trip page, take the booking, and keep every payment in your own account. We never take a cut.',
};

const DEMO_TRIP = '/trip/global-travel-solution/kenya-johari-na-bahari-safari';

export default function Home() {
  return (
    <>
      {/* hero */}
      <section className="m-hero">
        <div className="m-wrap m-hero-grid">
          <div className="m-rise">
            <h1>The group travel platform that leaves your money alone.</h1>
            <p className="m-lede">
              Build a beautiful trip page, take the booking, and keep every traveller and every payment in your own
              hands. You are the merchant, so the money lands in your own account, at your own rate. We never take a cut.
            </p>
            <div className="m-hero-cta">
              <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
              <Link className="m-btn m-btn--ghost m-btn--lg" href={DEMO_TRIP}>See a live trip <IconArrow /></Link>
            </div>
            <p className="m-hero-note">Now onboarding travel agents in the UK and Ireland.</p>
          </div>

          <div className="m-rise m-rise-2" aria-hidden="true">
            <div className="m-shot">
              <div className="m-shot-bar">
                <span className="m-shot-dot" /><span className="m-shot-dot" /><span className="m-shot-dot" />
                <span className="m-shot-url">yourbrand.com/trips/kenya-safari</span>
              </div>
              <div className="m-shot-body">
                <div className="m-shot-cover" style={{ backgroundImage: 'url(/photos/safari.jpg)' }} />
                <div className="m-shot-inner">
                  <h3>Kenya Johari na Bahari Safari</h3>
                  <p className="m-shot-op">Global Travel Solution</p>
                  <div className="m-shot-rows">
                    <div className="m-shot-row"><span>10 nights, small group</span><b>from £3,700</b></div>
                    <div className="m-shot-row"><span>Deposit to secure</span><b>£500</b></div>
                    <div className="m-shot-row"><span>Places left</span><b>6</b></div>
                  </div>
                  <div className="m-shot-cta">Book your place</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* pillars */}
      <section className="m-sec">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>Everything WeTravel does, without the payments company in the middle.</h2>
            <p>We are a travel platform that leaves your money alone, not a payments business that added trip pages.</p>
          </div>
          <div className="m-pillars">
            <div className="m-pillar">
              <div className="m-pillar-ic"><IconWallet /></div>
              <h3>Your money is yours</h3>
              <p>
                You are the merchant. Payments settle into your own Stripe account, on your own payout schedule, at your
                own rate. We take nothing per booking, so you keep roughly two points on every pound that moves.
              </p>
            </div>
            <div className="m-pillar">
              <div className="m-pillar-ic"><IconSparkle /></div>
              <h3>The trip sells itself</h3>
              <p>
                A real brochure-quality trip page, not a form. Paste in the itinerary you already have and get a page
                back, drop it on your own site with a widget, and let the photography do the work.
              </p>
            </div>
            <div className="m-pillar">
              <div className="m-pillar-ic"><IconPhone /></div>
              <h3>Travellers get an app, not a receipt</h3>
              <p>
                Every booking has its own hub: the itinerary, documents, a checklist and reviews, all in your brand.
                The traveller feels looked after from the moment they book to the day they fly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className="m-sec m-sec--paper" id="features">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>A complete platform, not a booking button</h2>
            <p>Built for group trips and escorted tours, with everything an operator needs to sell and run them.</p>
          </div>
          <div className="m-feats">
            {FEATURES.map((f) => (
              <div className="m-feat" key={f.t}>
                <IconCheck />
                <div><b>{f.t}</b><span>{f.d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="m-sec" id="how">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>Live in an afternoon</h2>
            <p>No migration project, no payments onboarding maze. Build a trip, share it, take bookings.</p>
          </div>
          <div className="m-steps">
            <div className="m-step">
              <div className="m-step-n">1</div>
              <h3>Build the trip</h3>
              <p>Add your dates, rooms and add-ons, or paste an existing brochure and let the import do the first draft. It comes out as a page you would be proud to send.</p>
            </div>
            <div className="m-step">
              <div className="m-step-n">2</div>
              <h3>Share it</h3>
              <p>Send the link, or drop a widget on your own website so the trip sells where your customers already are. It wears your logo, colours and font, not ours.</p>
            </div>
            <div className="m-step">
              <div className="m-step-n">3</div>
              <h3>Take the booking</h3>
              <p>Travellers book and register their party, upload documents and tick off what you need. You see it all in one place, and the money stays with you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* cost */}
      <section className="m-sec m-sec--paper">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>Cheaper on every pound that moves</h2>
            <p>WeTravel takes a platform cut on top of card processing. We take nothing on top of your own Stripe rate.</p>
          </div>
          <div className="m-cost">
            <div className="m-cost-card">
              <h3>WeTravel</h3>
              <div className="m-cost-big">3.9%<span style={{ fontSize: 15, fontWeight: 500 }}> + fee</span></div>
              <p className="m-cost-sub">A ~1% platform cut plus card processing, on every transaction, on top of the subscription.</p>
            </div>
            <div className="m-cost-card m-cost-card--ours">
              <h3>Travelgenix Trips</h3>
              <div className="m-cost-big">~1.5%<span style={{ fontSize: 15, fontWeight: 500 }}> + fee</span></div>
              <p className="m-cost-sub">Your own Stripe rate, and nothing on top from us. A flat monthly subscription, whatever your volume.</p>
            </div>
          </div>
          <p className="m-cost-note">
            Illustrative, using UK Stripe standard card rates. Your exact saving depends on your card mix and volume, so
            we will run your own numbers with you. The point that does not move: we are about two percentage points
            cheaper on every pound, whatever we charge.
          </p>
        </div>
      </section>

      {/* pricing teaser */}
      <section className="m-sec">
        <div className="m-wrap m-sec-head" style={{ marginBottom: 0 }}>
          <h2>Simple pricing, banded on volume</h2>
          <p style={{ marginBottom: 24 }}>
            One flat monthly fee that grows only with your booking volume, never with how many trips you build. A free
            trial to start, no card needed.
          </p>
          <Link className="m-btn m-btn--ghost m-btn--lg" href="/pricing">See the plans <IconArrow /></Link>
        </div>
      </section>

      {/* faq */}
      <section className="m-sec m-sec--paper">
        <div className="m-wrap">
          <div className="m-sec-head"><h2>Questions, answered</h2></div>
          <div className="m-faq">
            {FAQ.map((q) => (
              <details key={q.q}>
                <summary>{q.q}<span className="m-faq-plus"><IconPlus /></span></summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* cta band */}
      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>See it with your own trips</h2>
          <p>Book a short demo and we will set up your first trip page with you.</p>
          <div className="m-hero-cta" style={{ justifyContent: 'center' }}>
            <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
            <Link className="m-btn m-btn--ghost m-btn--lg" href={DEMO_TRIP}>See a live trip</Link>
          </div>
        </div>
      </section>
    </>
  );
}

const FEATURES: Array<{ t: string; d: string }> = [
  { t: 'Brochure-quality trip pages', d: 'Itinerary, packages, priced add-ons and real photography.' },
  { t: 'AI brochure import', d: 'Paste an itinerary you already have and get a trip page back.' },
  { t: 'Bookings and deposits', d: 'Places held safely, never oversold, deposits to secure a seat.' },
  { t: 'Registration and waivers', d: 'Collect each traveller, your own questions, a signed waiver.' },
  { t: 'Passport and document upload', d: 'Sensitive documents to a private, secure store.' },
  { t: 'Participant checklists', d: 'A per-booking to-do list travellers tick off before they fly.' },
  { t: 'Reviews', d: 'Verified reviews from real travellers, shown on the trip page.' },
  { t: 'Waitlists', d: 'Fill sold-out departures the moment a place opens up.' },
  { t: 'Broadcast messaging', d: 'Email everyone on a trip at once, from saved templates.' },
  { t: 'Automated emails', d: 'Confirmations, reminders and come-back emails, in your brand.' },
  { t: 'Promo and early-bird codes', d: 'Run offers without discounting the whole catalogue.' },
  { t: 'Reporting and CSV export', d: 'Money across every trip, ready for your accounts.' },
  { t: 'Team roles', d: 'Owner, manager and viewer access for your whole team.' },
  { t: 'Embeddable widgets', d: 'Sell your trips on your own website, in your own brand.' },
  { t: 'Webhooks and an API', d: 'Wire Trips into your CRM, accounting or anything else.' },
  { t: 'Full white-label', d: 'Your logo, colours and font from the trip page to the emails.' },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How is my money handled?',
    a: 'You are the merchant. When you take payment it settles into your own Stripe account on your own payout schedule, at your own Stripe rate. We never hold your travellers’ money and we take nothing per booking, which is why there is no FCA authorisation or client-money account to worry about. We are software, not a payment service.',
  },
  {
    q: 'How is this different from WeTravel?',
    a: 'WeTravel is a payments company that added trip pages, and the economics show it: a platform cut on every transaction on top of card fees. We are a travel platform that leaves your money alone. You keep your own Stripe rate, the trip pages are brochure quality rather than forms, and your travellers get a proper booking hub in your brand.',
  },
  {
    q: 'Can I sell on my own website?',
    a: 'Yes. Every trip has an embeddable widget, so a trip card, a grid of your trips or a book button can sit on your own site, in your own logo, colours and font. The hosted page is there when you want it, but the trip can sell where your customers already are.',
  },
  {
    q: 'What does it cost?',
    a: 'A flat monthly subscription banded on your booking volume, not on how many trips you build. There is a free trial to start with no card needed. See the plans for the current bands.',
  },
  {
    q: 'Who is it for?',
    a: 'Travel agents, tour operators, retreat hosts and group leaders who sell multi-day and group trips. We are onboarding UK and Ireland agents first, on a platform built to open up to more operators next.',
  },
];
