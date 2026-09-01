import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Travelgenix Trips',
  description: 'How Travelgenix Trips handles personal data.',
};

export default function Privacy() {
  return (
    <section className="m-doc">
      <div className="m-wrap m-prose">
        <h1>Privacy Policy</h1>
        <p className="m-draft">Draft for review. This is a starting outline, not final legal wording. It must be reviewed and approved before the platform goes live.</p>

        <p>This policy explains how Travelgenix handles personal data in Travelgenix Trips. We take the privacy of operators and travellers seriously.</p>

        <h2>Who is responsible for what</h2>
        <p>When a traveller books a trip, the operator is the controller of that traveller’s data. Travelgenix is the processor, handling the data on the operator’s behalf to provide the platform. For operator account data, Travelgenix is the controller.</p>

        <h2>What we collect</h2>
        <ul>
          <li>Operator account details: name, company, email and team access.</li>
          <li>Traveller booking data: the details, answers and documents a traveller provides when booking and registering, as configured by the operator.</li>
          <li>Usage data needed to run and secure the service.</li>
        </ul>

        <h2>Sensitive documents</h2>
        <p>Where an operator collects documents such as passports or ID, they are stored in a private, access-controlled store, not in email. They are available only to the operator that collected them.</p>

        <h2>Payments</h2>
        <p>Card payments are handled by Stripe under the operator’s own Stripe account. Travelgenix does not store card numbers.</p>

        <h2>Sharing</h2>
        <p>We do not sell personal data. We share it only with the processors needed to run the service, such as our hosting and email providers, under appropriate terms.</p>

        <h2>Retention</h2>
        <p>Data is kept for as long as needed to provide the service and to meet legal obligations, then deleted or anonymised.</p>

        <h2>Your rights</h2>
        <p>Travellers should contact the operator they booked with to exercise their data rights. Operators can contact Travelgenix about their own account data. The full detail of rights and lawful bases is to be completed on legal review, in line with UK GDPR.</p>

        <h2>Contact</h2>
        <p>Data questions can be raised through the contact page.</p>
      </div>
    </section>
  );
}
