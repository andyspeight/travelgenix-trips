import type { Metadata } from 'next';
import Link from 'next/link';
import { IconPlus } from '../site-chrome';

export const metadata: Metadata = {
  title: 'FAQ — Travelgenix Trips',
  description: 'Common questions about Travelgenix Trips: how the money works, pricing, migrating in, security, and who it is for.',
};

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'How is my money handled?', a: 'You are the merchant. When you take payment it settles into your own Stripe account on your own payout schedule, at your own Stripe rate. We never hold your travellers’ money and we take nothing per booking, so there is no client-money account or safeguarding to worry about through us. We are software, not a payment service.' },
  { q: 'What does it cost?', a: 'A flat monthly subscription banded on your trailing twelve-month booking volume, not on how many trips you build. There is a 14 day free trial with no card needed. See the pricing page for the current bands.' },
  { q: 'How is this different from WeTravel?', a: 'WeTravel takes a cut of every booking on top of card fees and holds the money until payout. We do neither: you keep your own Stripe rate and the funds are yours from the start. The trip pages are brochure quality rather than forms, and your travellers get a proper hub in your brand. There is a full comparison on the vs WeTravel page.' },
  { q: 'Can I sell on my own website?', a: 'Yes. Every trip has an embeddable widget, so a trip card, a grid of your trips or a book button can sit on your own site in your own brand. Every trip also has a hosted page you can simply link to.' },
  { q: 'Can I move my existing trips across quickly?', a: 'Yes. Paste an itinerary you already have and the AI import drafts the trip page for you to tidy and publish, so you are not rebuilding your catalogue from a blank page.' },
  { q: 'Is it white-label?', a: 'Yes. Your logo, colours and font run from the trip page through to the confirmation emails, and you can switch off the small Travelgenix credit entirely. Custom domains are available on the higher plans.' },
  { q: 'How do you keep traveller data safe?', a: 'Sensitive documents like passports go to a private, secure store rather than an email inbox, access is controlled, and data is handled with care. If you have specific requirements, raise them with us and we will talk them through.' },
  { q: 'Who is it for?', a: 'Travel agents, tour operators, retreat and wellness hosts, school and group organisers, and adventure operators. Anyone selling multi-day or group trips. We are onboarding UK and Ireland agents first.' },
  { q: 'Do travellers need an account?', a: 'No. They book with their details and reach their confirmation hub by a private link, the way a booking reference has always worked. No password to forget.' },
  { q: 'Can my team use it?', a: 'Yes. Invite your team with owner, manager or viewer roles, so the right people can do the right things and everyone sees the same live picture.' },
];

export default function Faq() {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap"><h1>Questions, answered</h1><p>The things operators ask us most. If yours is not here, just get in touch.</p></div>
      </section>
      <section className="m-sec">
        <div className="m-wrap">
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
      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>Still have a question?</h2>
          <p>Ask us anything, and see the platform with your own trips.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/contact">Get in touch</Link>
        </div>
      </section>
    </>
  );
}
