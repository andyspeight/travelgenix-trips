import type { Metadata } from 'next';
import { SOLUTIONS } from '../content';
import { CardIndex } from '../content-page';

export const metadata: Metadata = {
  title: 'Who it is for — Travelgenix Trips',
  description: 'Travel agents, tour operators, retreat and wellness hosts, school and group organisers, and adventure operators all sell group trips on Travelgenix Trips.',
};

export default function SolutionsIndex() {
  return (
    <CardIndex
      heading="Built for the people who run group trips"
      intro="However you sell group travel, the shape is the same: a page that sells, a booking that holds, and the money in your own account. See how it fits your world."
      items={SOLUTIONS}
      base="/solutions"
    />
  );
}
