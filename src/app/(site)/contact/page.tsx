import type { Metadata } from 'next';
import { IconCheck } from '../site-chrome';
import { DemoForm } from '../demo/demo-form';

export const metadata: Metadata = {
  title: 'Contact — Travelgenix Trips',
  description: 'Get in touch with Travelgenix Trips. Tell us about your trips and we will get back to you, and set up a demo if you would like one.',
};

export default function Contact() {
  return (
    <section className="m-form-page">
      <div className="m-wrap m-form-grid">
        <div className="m-form-aside">
          <h1>Get in touch</h1>
          <p>
            Tell us a little about your trips and we will get back to you. If you would like a look at the platform, we
            will set up a demo at the same time. No pressure, no card.
          </p>
          <ul>
            <li><IconCheck />A straight answer to any question</li>
            <li><IconCheck />A walkthrough with your own trips, if you want one</li>
            <li><IconCheck />Help working out which plan fits your volume</li>
          </ul>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}
