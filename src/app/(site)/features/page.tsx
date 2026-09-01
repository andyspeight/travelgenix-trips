import type { Metadata } from 'next';
import { FEATURES } from '../content';
import { CardIndex } from '../content-page';

export const metadata: Metadata = {
  title: 'Features — Travelgenix Trips',
  description: 'Everything you need to sell group trips and escorted tours: brochure pages, bookings, payments in your own account, a traveller hub, embeds, an API and full white-label.',
};

export default function FeaturesIndex() {
  return (
    <CardIndex
      heading="A complete platform, not a booking button"
      intro="Everything an operator needs to sell group trips and run them well. Explore what is inside."
      items={FEATURES}
      base="/features"
    />
  );
}
