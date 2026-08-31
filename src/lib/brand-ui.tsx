// =============================================================================
//  lib/brand-ui.tsx — shared brand furniture for the public journey
// =============================================================================
//  Every page a traveller sees — the trip, the booking form, registration, the
//  review form, the confirmation hub — wears the operator's brand, so the whole
//  journey feels like the operator's own site, not a booking tool they were
//  handed off to. Two pieces are shared here so all five pages agree:
//
//    * BrandMast — the operator's logo (or their name, if no logo) as the page
//      masthead. Deliberately not a kicker above the heading; it is the site
//      identity, the same on every screen.
//    * PoweredBy — a small "Powered by Travelgenix Trips" credit in the footer,
//      shown by default and removed when the operator turns on white-label
//      (hide_powered_by). The one visible Travelgenix mark, and the one the
//      toggle controls.
// =============================================================================

import { safeImageUrl } from './url.ts';

/** The operator identity masthead. Logo if there is one, else the name. */
export function BrandMast({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const logo = safeImageUrl(logoUrl);
  return (
    <header className="t-mast">
      <div className="t-mast-wrap">
        {logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt={name} />
          : <span>{name}</span>}
      </div>
    </header>
  );
}

/** The footer credit. Nothing renders when the operator has gone white-label. */
export function PoweredBy({ hidden }: { hidden?: boolean }) {
  if (hidden) return null;
  return (
    <footer className="t-poweredby">
      <a href="https://trips.travelify.io" target="_blank" rel="noopener noreferrer">
        Powered by Travelgenix Trips
      </a>
    </footer>
  );
}
