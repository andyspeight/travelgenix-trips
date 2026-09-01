import type { Metadata } from 'next';
import Link from 'next/link';
import { IconCheck } from '../../site-chrome';

export const metadata: Metadata = {
  title: 'Travelgenix Trips vs WeTravel',
  description: 'How Travelgenix Trips compares to WeTravel: your own Stripe account and no per-booking cut, brochure-quality trip pages, a traveller hub and full white-label.',
};

interface Row { label: string; us: string | true; them: string | true; }

const ROWS: Row[] = [
  { label: 'Where the money settles', us: 'Your own Stripe account', them: 'The platform, then paid out to you' },
  { label: 'Platform cut per booking', us: 'None', them: 'Around 1% on every transaction' },
  { label: 'Card processing', us: 'Your own Stripe rate', them: 'Their rate on top of the platform cut' },
  { label: 'Funds held by a third party', us: 'No, you are the merchant', them: 'Yes, until payout' },
  { label: 'Brochure-quality trip pages', us: true, them: 'Text-heavy, limited customisation' },
  { label: 'AI import from your itinerary', us: true, them: '—' },
  { label: 'Traveller booking hub in your brand', us: true, them: 'A participant dashboard' },
  { label: 'Embeddable widgets for your site', us: true, them: 'Limited' },
  { label: 'Full white-label, credit removed', us: true, them: 'On higher tiers' },
  { label: 'Webhooks and an API', us: true, them: 'On higher tiers' },
  { label: 'Pricing', us: 'Flat monthly, banded on volume', them: 'Subscription plus a cut of every booking' },
];

function Cell({ v }: { v: string | true }) {
  if (v === true) return <span><IconCheck size={18} /> Yes</span>;
  return <span className={v === '—' ? 'm-x' : undefined}>{v}</span>;
}

export default function CompareWeTravel() {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap">
          <h1>Travelgenix Trips vs WeTravel</h1>
          <p>
            Both sell group trips and take payments. The difference is who sits in the middle. WeTravel is a payments
            company that added trip pages, and takes a cut of every booking. We are a travel platform that leaves your
            money alone.
          </p>
          <div className="m-hero-cta">
            <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
            <Link className="m-btn m-btn--ghost m-btn--lg" href="/pricing">See pricing</Link>
          </div>
        </div>
      </section>

      <section className="m-sec">
        <div className="m-wrap">
          <div className="m-compare">
            <table>
              <thead>
                <tr><th>&nbsp;</th><th>WeTravel</th><th>Travelgenix Trips</th></tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td><Cell v={r.them} /></td>
                    <td><Cell v={r.us} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-cost-note">
            Comparison based on WeTravel’s publicly described pricing and features. The one part that does not depend on
            our price: our marginal rate is your Stripe rate, roughly two percentage points below a platform that adds a
            cut on top of card fees. We will run your own numbers with you.
          </p>
        </div>
      </section>

      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>Keep more of every booking</h2>
          <p>Book a demo and we will show you the difference on your own volume.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
        </div>
      </section>
    </>
  );
}
