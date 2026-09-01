// =============================================================================
//  mockups.tsx — realistic CSS renders of the real product screens.
// =============================================================================
//  Used as the feature-page visuals in place of stock images. Everything is
//  drawn in markup and CSS (mk- classes), so there are no external assets and
//  nothing to host. To use a real screenshot later, replace the <Mockup> in a
//  feature page's visuals with an <img>; the layout slot is unchanged.
// =============================================================================

import { IconCheck } from './site-chrome';
import { WidgetCardDemo, WidgetGridDemo } from './widget-previews';

function Browser({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="mk" aria-hidden="true">
      <div className="mk-bar">
        <span className="mk-dot" /><span className="mk-dot" /><span className="mk-dot" />
        <span className="mk-url">{url}</span>
      </div>
      <div className="mk-body">{children}</div>
    </div>
  );
}

function App({ tab, children }: { tab: string; children: React.ReactNode }) {
  const tabs = ['Trips', 'Bookings', 'Reports', 'Integrations'];
  return (
    <div className="mk" aria-hidden="true">
      <div className="mk-app">
        <b>Travelgenix Trips</b>
        <div className="mk-tabs">
          {tabs.map((t) => <span key={t} className={t === tab ? 'on' : undefined}>{t}</span>)}
        </div>
      </div>
      <div className="mk-body">{children}</div>
    </div>
  );
}

function Trip() {
  return (
    <Browser url="yourbrand.com/trips/kenya-safari">
      <div className="mk-cover" style={{ backgroundImage: 'url(/photos/safari.jpg)' }} />
      <div className="mk-h">Kenya Johari na Bahari Safari</div>
      <div className="mk-sub">Global Travel Solution · 10 nights, small group</div>
      <div className="mk-list">
        <div className="mk-li"><span className="grow">Day 1 · Nairobi to the Mara</span></div>
        <div className="mk-li"><span className="grow">Day 2 · Great Rift Valley</span></div>
        <div className="mk-li"><span className="grow">From price</span><span className="mk-money">£3,700</span></div>
      </div>
      <div className="mk-btn">Book your place</div>
    </Browser>
  );
}

function Console() {
  const rows = [
    ['Kenya Johari na Bahari Safari', 'Escorted tour · Kenya', 'ok', 'Published'],
    ['Highlands Walking Week', 'Group trip · Scotland', 'ok', 'Published'],
    ['Amalfi in Autumn', 'Escorted tour · Italy', 'mut', 'Draft'],
  ] as const;
  return (
    <App tab="Trips">
      <div className="mk-h2">Your trips</div>
      <div className="mk-list">
        {rows.map(([t, meta, pill, label]) => (
          <div className="mk-li" key={t}>
            <span className="grow">{t}<small>{meta}</small></span>
            <span className={`mk-pill ${pill}`}>{label}</span>
          </div>
        ))}
      </div>
    </App>
  );
}

function Bookings() {
  const rows = [
    ['TGT-8FQ2-KE', 'Marie Curie', 'ok', 'Paid', '£7,400'],
    ['TGT-3JX9-KE', 'Ada Lovelace', 'warn', 'Deposit', '£1,000'],
    ['TGT-KP41-HW', 'Alan Turing', 'warn', 'Deposit', '£600'],
    ['TGT-7Z2M-AA', 'Grace Hopper', 'mut', 'Held', '—'],
  ] as const;
  return (
    <App tab="Bookings">
      <div className="mk-h2">Bookings</div>
      <div className="mk-list">
        {rows.map(([ref, name, pill, label, amt]) => (
          <div className="mk-li" key={ref}>
            <span className="grow">{name}<small>{ref}</small></span>
            <span className={`mk-pill ${pill}`}>{label}</span>
            <span className="mk-money">{amt}</span>
          </div>
        ))}
      </div>
    </App>
  );
}

function Reports() {
  return (
    <App tab="Reports">
      <div className="mk-tiles">
        <div className="mk-tile"><small>Booked</small><b>£128k</b></div>
        <div className="mk-tile"><small>Collected</small><b>£82k</b></div>
        <div className="mk-tile"><small>Outstanding</small><b className="accent">£46k</b></div>
      </div>
      <div className="mk-bars">
        <i style={{ height: '40%' }} /><i style={{ height: '62%' }} /><i style={{ height: '52%' }} />
        <i style={{ height: '78%' }} /><i className="hi" style={{ height: '92%' }} /><i style={{ height: '70%' }} />
        <i style={{ height: '84%' }} />
      </div>
      <div className="mk-btn ghost">Download bookings CSV</div>
    </App>
  );
}

function BookingForm() {
  return (
    <Browser url="yourbrand.com/book/kenya-safari">
      <div className="mk-h2">Book Kenya Johari na Bahari Safari</div>
      <div className="mk-field"><span>Departure</span><span className="val">24 Oct 2026</span></div>
      <div className="mk-two">
        <div className="mk-field"><span>Travellers</span><span className="val">2</span></div>
        <div className="mk-field"><span>Room</span><span className="val">Twin</span></div>
      </div>
      <div className="mk-li"><span className="grow">Deposit to secure</span><span className="mk-money">£1,000</span></div>
      <div className="mk-btn">Book your place</div>
    </Browser>
  );
}

function Registration() {
  return (
    <Browser url="yourbrand.com/register/TGT-3JX9-KE">
      <div className="mk-h2">Traveller 1 of 2</div>
      <div className="mk-two">
        <div className="mk-field"><span>Full name</span><span className="val">Ada Lovelace</span></div>
        <div className="mk-field"><span>Date of birth</span><span className="val">10 Dec</span></div>
      </div>
      <div className="mk-field"><span>Dietary needs</span><span className="val">Vegetarian</span></div>
      <div className="mk-li"><span className="grow">Passport</span><span className="mk-pill ok">Uploaded</span></div>
      <div className="mk-li"><span className="grow">Waiver</span><span className="mk-pill ok">Signed</span></div>
    </Browser>
  );
}

function Hub() {
  const items = [['Send us your flight details', true], ['Book travel insurance', true], ['Complete health form', false]] as const;
  return (
    <Browser url="yourbrand.com/booked/TGT-8FQ2-KE">
      <div className="mk-tick"><IconCheck size={22} /></div>
      <div className="mk-h">Booking confirmed</div>
      <div className="mk-sub">Reference TGT-8FQ2-KE · Kenya Johari na Bahari Safari</div>
      <div className="mk-h2" style={{ marginTop: 4 }}>Your checklist</div>
      <div className="mk-list">
        {items.map(([label, done]) => (
          <div className="mk-li" key={label}>
            <span className={`mk-box${done ? ' on' : ''}`} />
            <span className="grow">{label}</span>
          </div>
        ))}
      </div>
    </Browser>
  );
}

function Integrations() {
  return (
    <App tab="Integrations">
      <div className="mk-h2">Webhooks</div>
      <div className="mk-list">
        <div className="mk-li"><span className="grow">hooks.yourcrm.com/tg<small>booking.created, booking.updated</small></span><span className="mk-pill ok">OK 200</span></div>
        <div className="mk-li"><span className="grow">hooks.slack.com/…<small>booking.created</small></span><span className="mk-pill ok">Active</span></div>
      </div>
      <div className="mk-h2" style={{ marginTop: 4 }}>API keys</div>
      <div className="mk-li"><span className="grow" style={{ fontFamily: 'ui-monospace, monospace' }}>tgk_live_9f3a…</span><span className="mk-pill mut">Last used 2h ago</span></div>
    </App>
  );
}

function Branding() {
  return (
    <App tab="Trips">
      <div className="mk-h2">Branding preview</div>
      <div className="mk" style={{ boxShadow: 'none' }}>
        <div className="mk-app"><b style={{ color: 'var(--m-accent-ink)' }}>Global Travel Solution</b></div>
        <div className="mk-body"><div className="mk-sub">This is how your public pages are headed.</div></div>
      </div>
      <div className="mk-li"><span className="grow">Brand colour</span><span className="mk-swatches"><span className="mk-swatch" style={{ background: '#1b2b5b' }} /><span className="mk-swatch" style={{ background: '#0e6e5c' }} /></span></div>
      <div className="mk-toggle"><span>Show “Powered by Travelgenix Trips”</span><span className="mk-sw" /></div>
    </App>
  );
}

function Widget() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="mk-code">{`<div data-tg-trip="`}<span className="k">kenya-safari</span>{`"></div>
<script src="trips.travelify.io/`}<span className="k">embed.js</span>{`"></script>`}</div>
      <div className="mk" aria-hidden="true">
        <div className="mk-body">
          <div className="mk-cover" style={{ height: 70, backgroundImage: 'url(/photos/coast.jpg)' }} />
          <div className="mk-h2">Kenya Johari na Bahari Safari</div>
          <div className="mk-li"><span className="grow mk-sub">from</span><span className="mk-money">£3,700</span></div>
          <div className="mk-btn">Book your place</div>
        </div>
      </div>
    </div>
  );
}

function Import() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="mk" aria-hidden="true">
        <div className="mk-body">
          <div className="mk-sub">Paste your itinerary</div>
          <div className="mk-field" style={{ display: 'block', color: 'var(--m-ink-2)', lineHeight: 1.5 }}>
            Day 1 Arrive Nairobi, transfer to camp. Day 2 Game drive in the Maasai Mara. Day 3…
          </div>
          <div className="mk-btn">Draft my trip page</div>
        </div>
      </div>
      <div className="mk-arrow">↓</div>
      <div className="mk" aria-hidden="true">
        <div className="mk-body">
          <div className="mk-cover" style={{ height: 56, backgroundImage: 'url(/photos/coast.jpg)' }} />
          <div className="mk-h2">Kenya Johari na Bahari Safari <span className="mk-pill mut">Draft</span></div>
          <div className="mk-sub">Day 1 · Day 2 · Day 3 …</div>
        </div>
      </div>
    </div>
  );
}

const MOCKS: Record<string, () => React.ReactNode> = {
  trip: Trip, console: Console, bookings: Bookings, reports: Reports,
  bookingForm: BookingForm, registration: Registration, hub: Hub,
  integrations: Integrations, branding: Branding, widget: Widget, import: Import,
};

export function Mockup({ name }: { name: string }) {
  const M = MOCKS[name] ?? Console;
  return <M />;
}

// Real product screenshots, captured from the live console and traveller pages
// (see docs/trips-platform-handover.md). Where a visual name has a real shot it
// is shown; every other name still renders its CSS mockup above, so the layout
// slot is identical either way and the page never has an empty visual.
const REAL: Record<string, { src: string; w: number; h: number; alt: string }> = {
  reports: { src: '/shots/reports.png', w: 1880, h: 1312, alt: 'Cross-trip reporting: booked, collected and outstanding across every trip' },
  bookings: { src: '/shots/bookings.png', w: 1880, h: 876, alt: 'The bookings list in the operator console, with reference, status and money' },
  integrations: { src: '/shots/integrations.png', w: 1880, h: 2142, alt: 'Webhooks and API keys set up in the console' },
  branding: { src: '/shots/branding.png', w: 1880, h: 1568, alt: 'Branding settings, with a live preview of a headed public page' },
  hub: { src: '/shots/booked.png', w: 1800, h: 2000, alt: 'A traveller’s booking confirmation hub, in the operator’s brand' },
  console: { src: '/shots/console.png', w: 1880, h: 1228, alt: 'The trips list in the operator console' },
};

// Faithful renders of the real embed widgets, for pages that showcase them.
const WIDGET_PREVIEWS: Record<string, () => React.ReactNode> = {
  wgcard: WidgetCardDemo,
  wggrid: WidgetGridDemo,
};

// The visual slot on a feature or solution page: a live widget preview, else a
// real screenshot when we have one, otherwise the CSS mockup of the same name.
export function Visual({ name }: { name: string }) {
  const W = WIDGET_PREVIEWS[name];
  if (W) return <W />;
  const real = REAL[name];
  if (!real) return <Mockup name={name} />;
  return (
    // A static asset from /public; plain img keeps static export simple.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="m-shot"
      src={real.src}
      width={real.w}
      height={real.h}
      alt={real.alt}
      loading="lazy"
      decoding="async"
      style={{ display: 'block', width: '100%', height: 'auto' }}
    />
  );
}
