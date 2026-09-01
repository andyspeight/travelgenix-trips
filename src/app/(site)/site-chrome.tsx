// Shared chrome for the public marketing site: the nav, the footer, and a small
// set of inline SVG icons (no emoji, one stroke weight — the design skill's
// icon rule). Server components; the site is static apart from the demo form.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { FEATURES, SOLUTIONS } from './content';

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

// A single dispatcher so page content can reference an icon by name.
const PATHS: Record<string, React.ReactNode> = {
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" /><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a3 3 0 0 1-3-3Z" /><circle cx="17" cy="13" r="1.1" fill="currentColor" stroke="none" /></>,
  sparkle: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  page: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6Z" /><path d="M9.5 12l1.8 1.8L15 10" /></>,
  layers: <><path d="M12 3 3 8l9 5 9-5Z" /><path d="M3 13l9 5 9-5M3 16.5l9 5 9-5" /></>,
  plug: <><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0Z" /><path d="M12 16v6" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="11.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="16.5" cy="11" r="1" fill="currentColor" stroke="none" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-3M12 16V8M16 16v-6" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-2.3-4.5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" /></>,
  ticket: <><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" /><path d="M13 6v2M13 11v2M13 16v2" /></>,
  tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></>,
  map: <><path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  route: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8.4 6H14a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.6" /></>,
  handshake: <><path d="m3 12 4-4 3 2 4-3 3 3 4 1" /><path d="M14 7l-2.5 2.5a1.5 1.5 0 0 0 0 2.1L13 13" /><path d="M3 12v4l4 3 3-2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg {...svg(size)} aria-hidden="true">{PATHS[name] ?? PATHS.sparkle}</svg>;
}

/* --- nav ------------------------------------------------------------------ */
export function SiteNav() {
  return (
    <nav className="m-nav" aria-label="Primary">
      <div className="m-wrap m-nav-in">
        <Link href="/" className="m-brand"><LogoMark /> Travelgenix Trips</Link>
        <div className="m-nav-links">
          <Link href="/features">Features</Link>
          <Link href="/solutions">Who it is for</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/compare/wetravel">vs WeTravel</Link>
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
            <h4>Features</h4>
            {FEATURES.slice(0, 6).map((f) => (
              <Link key={f.slug} href={`/features/${f.slug}`}>{f.nav}</Link>
            ))}
            <Link href="/features">All features</Link>
          </div>
          <div className="m-foot-col">
            <h4>Who it is for</h4>
            {SOLUTIONS.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`}>{s.nav}</Link>
            ))}
          </div>
          <div className="m-foot-col">
            <h4>Company</h4>
            <Link href="/about">About</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/compare/wetravel">vs WeTravel</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="m-foot-col">
            <h4>Account</h4>
            <a href={SIGNIN_URL}>Sign in</a>
            <Link href="/demo">Book a demo</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
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
