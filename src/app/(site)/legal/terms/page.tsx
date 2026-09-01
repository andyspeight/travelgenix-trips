import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Travelgenix Trips',
  description: 'The terms on which operators use Travelgenix Trips.',
};

export default function Terms() {
  return (
    <section className="m-doc">
      <div className="m-wrap m-prose">
        <h1>Terms of Service</h1>
        <p className="m-draft">Draft for review. This is a starting outline, not final legal wording. It must be reviewed and approved before the platform goes live.</p>

        <p>These terms govern your use of Travelgenix Trips (the platform) provided by Travelgenix. By creating an account or using the platform you agree to them.</p>

        <h2>1. What the platform is</h2>
        <p>Travelgenix Trips is software that lets you build trip pages, take bookings and manage travellers. It is not a payment service. You connect your own Stripe account and you are the merchant of record for every payment your travellers make. Travelgenix does not hold, control or take a cut of those funds.</p>

        <h2>2. Your account</h2>
        <p>You are responsible for the accuracy of the trips, prices and terms you publish, for the bookings you accept, and for keeping your account and team access secure. You must have the right to sell the trips you list.</p>

        <h2>3. Payments and fees</h2>
        <p>You pay Travelgenix a subscription fee for use of the platform, as set out on the pricing page. Card processing and payouts are handled by Stripe under your own Stripe agreement and at your own Stripe rates. Refunds to travellers are your responsibility as the merchant.</p>

        <h2>4. Your travellers</h2>
        <p>The contract for each trip is between you and your traveller. Travelgenix provides the tools but is not a party to that contract and is not responsible for the delivery of any trip.</p>

        <h2>5. Data</h2>
        <p>You are the controller of the traveller data you collect through the platform. Travelgenix processes it on your behalf to provide the service. See the Privacy Policy for detail.</p>

        <h2>6. Availability and changes</h2>
        <p>We work to keep the platform available and improving. We may update features and these terms from time to time, and will give reasonable notice of material changes.</p>

        <h2>7. Ending your use</h2>
        <p>You can stop using the platform at any time. On request we will help you export your data. Some records may be retained where the law requires.</p>

        <h2>8. Liability</h2>
        <p>To be completed on legal review, including the appropriate limitations and exclusions for a software-as-a-service agreement under the laws of England and Wales.</p>

        <h2>Contact</h2>
        <p>Questions about these terms can be raised through the contact page.</p>
      </div>
    </section>
  );
}
