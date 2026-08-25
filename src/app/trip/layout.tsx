import './trip.css';

// Public trip pages sit outside the console chrome entirely: no Travelgenix
// header, because the page belongs to the operator's brand, not ours.
export default function TripLayout({ children }: { children: React.ReactNode }) {
  return children;
}
