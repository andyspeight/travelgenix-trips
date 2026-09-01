import type { Metadata } from 'next';
import Link from 'next/link';
import { IconCheck } from '../site-chrome';

export const metadata: Metadata = {
  title: 'Pricing — Travelgenix Trips',
  description:
    'A flat monthly subscription banded on your booking volume, not on how many trips you build. We take nothing per booking. Start with a free trial, no card needed.',
};

interface Plan {
  name: string;
  price: string;
  per?: string;
  volume: string;
  feature?: boolean;
  tag?: string;
  points: string[];
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: 'Start', price: '£39', per: '/mo', volume: 'Up to £75k a year',
    points: ['The complete platform', 'One brand', 'Unlimited trips', 'Embeddable widgets', 'You keep your own Stripe rate'],
    cta: 'Book a demo',
  },
  {
    name: 'Grow', price: '£99', per: '/mo', volume: '£75k to £400k a year', feature: true, tag: 'Most popular',
    points: ['Everything in Start', 'Extra team members', 'Saved templates', 'Automated emails', 'Reporting and CSV export'],
    cta: 'Book a demo',
  },
  {
    name: 'Scale', price: '£249', per: '/mo', volume: '£400k+ a year',
    points: ['Everything in Grow', 'Multiple brands', 'API and webhooks', 'Custom domains', 'Priority support'],
    cta: 'Book a demo',
  },
  {
    name: 'Enterprise', price: 'Custom', volume: 'High volume, bespoke needs',
    points: ['Everything in Scale', 'Onboarding and SLA', 'Bespoke work', 'Named contact'],
    cta: 'Talk to us',
  },
];

export default function Pricing() {
  return (
    <>
      <section className="m-sec">
        <div className="m-wrap">
          <div className="m-sec-head">
            <h2>Pricing that grows with your bookings, not your catalogue</h2>
            <p>
              One flat monthly fee, banded on your trailing twelve-month booking volume. Build as many trips as you like.
              We take nothing per booking, so your success stays yours. Start with a 14 day free trial, no card needed.
            </p>
          </div>

          <div className="m-plans">
            {PLANS.map((p) => (
              <div className={`m-plan${p.feature ? ' m-plan--feature' : ''}`} key={p.name}>
                {p.tag && <span className="m-plan-tag">{p.tag}</span>}
                <h3>{p.name}</h3>
                <div className="m-plan-price">{p.price}{p.per && <span>{p.per}</span>}</div>
                <p className="m-plan-vol">{p.volume}</p>
                <ul>
                  {p.points.map((pt) => (<li key={pt}><IconCheck size={17} />{pt}</li>))}
                </ul>
                <Link className={`m-btn ${p.feature ? 'm-btn--primary' : 'm-btn--ghost'}`} href="/demo">{p.cta}</Link>
              </div>
            ))}
          </div>

          <p className="m-cost-note">
            Prices exclude VAT. You are always the merchant: card payments settle into your own Stripe account at your
            own rate, and we take nothing on top per booking.
          </p>
        </div>
      </section>

      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>Not sure which band you are in?</h2>
          <p>Book a short demo and we will work it out with you, and set up your first trip.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
        </div>
      </section>
    </>
  );
}
