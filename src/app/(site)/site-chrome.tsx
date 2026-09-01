// Shared chrome for the public marketing site: the nav, the footer, and a small
// set of inline SVG icons (no emoji, one stroke weight — the design skill's
// icon rule). Server components; the site is static apart from the demo form.

import Link from 'next/link';

export const SIGNIN_URL = 'https://id.travelify.io/signin';

/* --- icons (Lucide-style, 1.75 stroke) ----------------------------------- */
type IconProps = { size?: number };
const svg = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export function LogoMark({ size = 20 }: IconProps) {
  // A simple pin + path mark.
  return (<svg {...svg(size)} aria-hidden="true"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
}
export function IconWallet({ size = 22 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a3 3 0 0 1-3-3Z" /><circle cx="17" cy="13" r="1.2" fill="currentColor" stroke="none" /></svg>);
}
export function IconSparkle({ size = 22 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z" /></svg>);
}
export function IconPhone({ size = 22 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>);
}
export function IconCheck({ size = 18 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>);
}
export function IconPlus({ size = 18 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>);
}
export function IconArrow({ size = 18 }: IconProps) {
  return (<svg {...svg(size)} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
}

/* --- nav ------------------------------------------------------------------ */
export function SiteNav() {
  return (
    <nav className="m-nav" aria-label="Primary">
      <div className="m-wrap m-nav-in">
        <Link href="/" className="m-brand"><LogoMark /> Travelgenix Trips</Link>
        <div className="m-nav-links">
          <a href="/#how">How it works</a>
          <a href="/#features">Features</a>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="m-nav-cta">
          <a className="m-btn m-btn--plain" href={SIGNIN_URL}>Sign in</a>
          <Link className="m-btn m-btn--primary" href="/demo">Book a demo</Link>
        </div>
      </div>
    </nav>
  );
}

/* --- footer --------------------------------------------------------------- */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="m-foot">
      <div className="m-wrap m-foot-in">
        <div className="m-foot-brand">
          <Link href="/" className="m-brand"><LogoMark /> Travelgenix Trips</Link>
          <p>Sell group trips and escorted tours, take deposits, and keep the money in your own account. Software, not a payment service.</p>
        </div>
        <div className="m-foot-cols">
          <div className="m-foot-col">
            <h4>Product</h4>
            <a href="/#features">Features</a>
            <a href="/#how">How it works</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/demo">Book a demo</Link>
          </div>
          <div className="m-foot-col">
            <h4>Account</h4>
            <a href={SIGNIN_URL}>Sign in</a>
            <a href="/console">Console</a>
          </div>
        </div>
      </div>
      <div className="m-foot-legal">
        <div className="m-wrap m-foot-legal-in">
          <span>© {year} Travelgenix. All rights reserved.</span>
          <span>Made for group travel operators in the UK and Ireland.</span>
        </div>
      </div>
    </footer>
  );
}
