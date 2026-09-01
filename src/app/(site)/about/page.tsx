import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About — Travelgenix Trips',
  description: 'Travelgenix Trips is the group travel platform that leaves your money alone. Built by Travelgenix for travel agents and operators in the UK and Ireland.',
};

export default function About() {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap">
          <h1>Built for operators, not for the middle</h1>
          <p>
            Travelgenix Trips is the group travel platform that leaves your money alone. We build the pages, the
            bookings and the traveller admin. You keep the payments, the margin and the relationship.
          </p>
        </div>
      </section>

      <section className="m-sec">
        <div className="m-wrap m-prose">
          <p>
            We come from travel technology. Travelgenix already builds the tools travel agents use every day, and we
            kept hearing the same thing about group trips: the booking platforms take a cut of every payment, hold the
            money, and put a page in front of the traveller that does not do the trip justice.
          </p>
          <p>
            So we built the opposite. You connect your own Stripe account and you are the merchant, which means the
            money is yours from the moment it lands and we take nothing per booking. Around that we put a proper trip
            builder, a booking flow that never oversells, and a traveller experience worth the name, all in your brand.
          </p>
          <h2>What we believe</h2>
          <p>
            A platform should earn its keep from the software it provides, not from a slice of your customers’ money.
            That one decision shapes everything: it is why our pricing is a flat monthly fee, why there is no client-money
            account to worry about, and why we can be straight with you about what we do and do not do.
          </p>
          <p>
            We are launching with travel agents in the UK and Ireland, on a platform built to open up to more operators
            next. If you run group trips, we would love to show you around.
          </p>
        </div>
      </section>

      <section className="m-sec m-sec--paper">
        <div className="m-wrap">
          <div className="m-stats-row">
            <div className="m-stat"><b>0%</b><span>Taken per booking</span></div>
            <div className="m-stat"><b>Your own</b><span>Stripe account</span></div>
            <div className="m-stat"><b>One</b><span>Flat monthly fee</span></div>
          </div>
        </div>
      </section>

      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>Come and see it</h2>
          <p>Book a short demo and we will set up your first trip page with you.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
        </div>
      </section>
    </>
  );
}
