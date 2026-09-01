import type { Metadata } from 'next';
import { IconCheck } from '../site-chrome';
import { DemoForm } from './demo-form';

export const metadata: Metadata = {
  title: 'Book a demo — Travelgenix Trips',
  description: 'See Travelgenix Trips with your own trips. Book a short demo and we will set up your first trip page with you.',
};

export default function Demo() {
  return (
    <section className="m-form-page">
      <div className="m-wrap m-form-grid">
        <div className="m-form-aside">
          <h1>See it with your own trips</h1>
          <p>
            Book a short demo and we will set up your first trip page with you, and work out which plan fits your volume.
            No pressure, no card.
          </p>
          <ul>
            <li><IconCheck />A working trip page, built from your own itinerary</li>
            <li><IconCheck />How the money stays in your own Stripe account</li>
            <li><IconCheck />Your trips embedded on your own website</li>
            <li><IconCheck />A straight answer on what it would cost you</li>
          </ul>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}
