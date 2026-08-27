/**
 * Travelgenix Trips — embeddable trip card
 * =============================================================================
 * The operator's own snippet, served from Trips itself (not tg-widgets). One
 * container div plus this script renders an operator-branded card for a trip,
 * and Reserve opens the hosted Trips booking flow in an overlay on the
 * operator's page, so the visitor never leaves their site and the traveller PII
 * stays on our origin.
 *
 *   <div data-tg-trip="TRIP_ID"></div>
 *   <script src="https://trips.travelify.io/embed.js" defer></script>
 *
 * TRIP_ID is the trip's uuid (or a legacy tgw_ id). Optional attributes:
 *   data-tg-cta="Reserve a place"   the button label
 *   data-tg-api="https://..."       override the API origin (dev only)
 *
 * Reads GET {origin}/api/v1/trips/{id} — public, CORS-open, counts only. No
 * traveller data ever reaches this script.
 *
 * CSP-clean: no inline handlers, no injected <script>, no eval, no config
 * through innerHTML. Shadow DOM with :host{all:initial} so a host page's CSS
 * cannot leak in and ours cannot leak out.
 * =============================================================================
 */
(function () {
  'use strict';

  var VERSION = '0.1.0';
  if (window.__TG_TRIPS_EMBED_VERSION__) return; // double-load guard
  window.__TG_TRIPS_EMBED_VERSION__ = VERSION;

  // The script runs on customer sites, so the API base is the script's OWN
  // origin, never a relative /api path. Captured now, while currentScript is us.
  var SELF = document.currentScript;

  function apiBase(el) {
    if (window.__TG_TRIPS_API__) return String(window.__TG_TRIPS_API__).replace(/\/+$/, '');
    var override = el && el.getAttribute('data-tg-api');
    if (override) return String(override).replace(/\/+$/, '');
    try { return new URL(SELF.src).origin; } catch (e) { return ''; }
  }

  // --- tiny safe helpers -----------------------------------------------------

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Only a real hex colour survives, so an operator brand value can never inject
  // anything into a style string.
  function hexColour(v, fallback) {
    return typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : fallback;
  }

  // Only an https URL on a trusted image host is ever put in an <img>.
  function safeImg(v) {
    if (typeof v !== 'string') return '';
    var u;
    try { u = new URL(v); } catch (e) { return ''; }
    if (u.protocol !== 'https:') return '';
    var host = u.hostname.toLowerCase();
    var ok = host.endsWith('.public.blob.vercel-storage.com')
      || host === 'images.unsplash.com'
      || host === 'images.pexels.com'
      || host === 'player.vimeo.com'
      || host === 'picsum.photos';
    return ok ? u.href : '';
  }

  function money(pence, currency) {
    if (typeof pence !== 'number' || pence <= 0) return null;
    try {
      return new Intl.NumberFormat('en-GB', {
        style: 'currency', currency: String(currency || 'gbp').toUpperCase(),
        currencyDisplay: 'narrowSymbol', minimumFractionDigits: pence % 100 ? 2 : 0,
      }).format(pence / 100);
    } catch (e) { return '£' + Math.round(pence / 100); }
  }

  function fromPrice(departures, currency) {
    var priced = (departures || [])
      .map(function (d) { return d && typeof d.pricePence === 'number' ? d.pricePence : 0; })
      .filter(function (p) { return p > 0; });
    return priced.length ? money(Math.min.apply(null, priced), currency) : null;
  }

  function nextDates(departures) {
    var open = (departures || []).filter(function (d) { return d && !d.soldOut; });
    if (!open.length) return 'Dates coming soon';
    if (open.length === 1) return dateRange(open[0].startsOn, open[0].endsOn);
    return open.length + ' departures';
  }

  function dateRange(a, b) {
    try {
      var s = new Date(a + 'T00:00:00Z'), e = new Date(b + 'T00:00:00Z');
      var o = { timeZone: 'UTC', day: 'numeric', month: 'short' };
      return s.toLocaleDateString('en-GB', o) + ' to ' + e.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    } catch (x) { return ''; }
  }

  // --- the card --------------------------------------------------------------

  var CARD_CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.c{font-family:var(--tg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);',
    'color:#12211f;background:#fff;border:1px solid #e3e7ea;border-radius:14px;overflow:hidden;max-width:420px;',
    'box-shadow:0 10px 30px -20px rgba(18,33,31,.5)}',
    '.hero{display:block;width:100%;height:200px;object-fit:cover;background:#f1f1eb}',
    '.body{padding:16px 18px 18px}',
    '.op{display:flex;align-items:center;gap:8px;margin:0 0 8px;min-height:20px}',
    '.op img{height:20px;width:auto;display:block}',
    '.op span{font-size:12px;letter-spacing:.02em;color:#6b7671}',
    '.title{font-size:1.15rem;line-height:1.25;letter-spacing:-.01em;margin:0 0 4px;font-weight:700}',
    '.where{font-size:13px;color:#6b7671;margin:0 0 14px}',
    '.meta{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 14px}',
    '.price b{font-variant-numeric:tabular-nums;font-size:1.15rem;font-weight:700;color:var(--tg-accent,#0e6e5c)}',
    '.price small{display:block;font-size:11px;color:#6b7671;font-weight:500}',
    '.dates{font-size:13px;color:#3a4b47;text-align:right}',
    '.cta{display:block;width:100%;font:inherit;font-size:15px;font-weight:600;cursor:pointer;',
    'color:#fff;background:var(--tg-accent,#0e6e5c);border:0;border-radius:9px;padding:12px 16px}',
    '.cta:hover{filter:brightness(1.07)}',
    '.cta:active{transform:translateY(1px)}',
    '.cta:focus-visible{outline:2px solid var(--tg-accent,#0e6e5c);outline-offset:2px}',
    '.foot{font-size:11.5px;color:#8c9894;margin:10px 0 0;text-align:center}',
    '.err{padding:16px 18px;font-size:13px;color:#6b7671;border:1px solid #e3e7ea;border-radius:12px;max-width:420px;background:#fff}',
  ].join('');

  function renderCard(root, data, opts) {
    var trip = data.trip || {};
    var op = data.operator || {};
    var brand = op.brand || {};
    var accent = hexColour(brand.primaryColour, '#0e6e5c');
    var hero = safeImg(trip.heroImageUrl);
    var logo = safeImg(brand.logoUrl);
    var price = fromPrice(data.departures, trip.currency);
    var duration = trip.content && typeof trip.content.durationText === 'string' ? trip.content.durationText : '';
    var where = [trip.location, duration].filter(Boolean).join('  ·  ');

    var style = document.createElement('style');
    style.textContent = CARD_CSS;
    root.appendChild(style);

    var card = document.createElement('div');
    card.className = 'c';
    card.style.setProperty('--tg-accent', accent);

    // Static markup only; every dynamic value is esc()'d and every URL is
    // validated above, so this innerHTML carries no untrusted string.
    card.innerHTML = [
      hero ? '<img class="hero" alt="" src="' + esc(hero) + '">' : '',
      '<div class="body">',
      '<p class="op">',
      logo ? '<img alt="' + esc(op.name) + '" src="' + esc(logo) + '">' : '<span>' + esc(op.name || '') + '</span>',
      '</p>',
      '<h3 class="title">' + esc(trip.title || 'Trip') + '</h3>',
      where ? '<p class="where">' + esc(where) + '</p>' : '',
      '<div class="meta">',
      '<span class="price">' + (price ? '<b>' + esc(price) + '</b><small>per person</small>' : '<b>On request</b>') + '</span>',
      '<span class="dates">' + esc(nextDates(data.departures)) + '</span>',
      '</div>',
      '<button class="cta" type="button">' + esc(opts.cta) + '</button>',
      '<p class="foot">Booking by ' + esc(op.name || 'the operator') + '</p>',
      '</div>',
    ].join('');

    root.appendChild(card);

    var btn = card.querySelector('.cta');
    btn.addEventListener('click', function () {
      openBooking(opts.base, op.slug, trip.slug, accent);
    });
  }

  function renderError(root, message) {
    var style = document.createElement('style');
    style.textContent = CARD_CSS;
    var box = document.createElement('div');
    box.className = 'err';
    box.textContent = message;
    root.appendChild(style);
    root.appendChild(box);
  }

  // --- the booking overlay ---------------------------------------------------

  var OVERLAY_CSS = [
    ':host{all:initial}',
    '.back{position:fixed;inset:0;z-index:2147483000;background:rgba(12,22,20,.62);',
    'display:flex;align-items:center;justify-content:center;padding:16px;',
    '-webkit-tap-highlight-color:transparent}',
    '.panel{position:relative;width:100%;max-width:600px;height:min(88vh,900px);',
    'background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)}',
    '.frame{width:100%;height:100%;border:0;display:block}',
    '.x{position:absolute;top:10px;right:10px;width:34px;height:34px;border:0;cursor:pointer;',
    'border-radius:50%;background:rgba(255,255,255,.92);color:#12211f;font-size:20px;line-height:34px;',
    'box-shadow:0 2px 8px rgba(0,0,0,.25)}',
    '.x:hover{background:#fff}',
    '.x:focus-visible{outline:2px solid #0e6e5c;outline-offset:2px}',
  ].join('');

  function openBooking(base, operatorSlug, tripSlug, accent) {
    if (!operatorSlug || !tripSlug) { window.open(base, '_blank', 'noopener'); return; }
    var url = base + '/book/' + encodeURIComponent(operatorSlug) + '/' + encodeURIComponent(tripSlug);

    var host = document.createElement('div');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = OVERLAY_CSS;
    root.appendChild(style);

    var back = document.createElement('div');
    back.className = 'back';
    var panel = document.createElement('div');
    panel.className = 'panel';
    var frame = document.createElement('iframe');
    frame.className = 'frame';
    frame.setAttribute('title', 'Book this trip');
    frame.setAttribute('allow', 'payment');
    frame.src = url;
    var x = document.createElement('button');
    x.className = 'x';
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '×';
    if (accent) x.style.color = accent;

    panel.appendChild(frame);
    panel.appendChild(x);
    back.appendChild(panel);
    root.appendChild(back);

    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    function close() {
      document.documentElement.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      if (host.parentNode) host.parentNode.removeChild(host);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    x.addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
  }

  // --- init ------------------------------------------------------------------

  function mount(el) {
    if (el.getAttribute('data-tg-mounted') === '1') return;
    el.setAttribute('data-tg-mounted', '1');

    var id = el.getAttribute('data-tg-trip');
    var base = apiBase(el);
    var cta = el.getAttribute('data-tg-cta') || 'Reserve a place';
    var root = el.attachShadow ? el.attachShadow({ mode: 'open' }) : el;

    if (!id || !base) { renderError(root, 'This trip could not be loaded.'); return; }

    fetch(base + '/api/v1/trips/' + encodeURIComponent(id), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || !data.trip) { renderError(root, 'This trip is not available.'); return; }
        renderCard(root, data, { base: base, cta: cta });
      })
      .catch(function () { renderError(root, 'This trip could not be loaded right now.'); });
  }

  function init() {
    var nodes = document.querySelectorAll('[data-tg-trip]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TGTripsEmbed = { version: VERSION, mount: mount, init: init };
})();
