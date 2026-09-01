/**
 * Travelgenix Trips — embeddable widgets
 * =============================================================================
 * The operator's own snippet, served from Trips itself (not tg-widgets). One
 * container div plus this script renders an operator-branded widget, and Reserve
 * opens the hosted Trips booking flow in an overlay on the operator's page, so
 * the visitor never leaves their site and the traveller PII stays on our origin.
 *
 * SIX widgets, one script. Put any of these on the page:
 *
 *   <div data-tg-trip="TRIP_ID"></div>            a single trip CARD
 *   <div data-tg-trips="OPERATOR_SLUG"></div>     a GRID of an operator's trips
 *   <div data-tg-book="TRIP_ID"></div>            a bare "Book" BUTTON
 *   <div data-tg-reviews="TRIP_ID"></div>         approved REVIEWS + a star rating
 *   <div data-tg-departures="TRIP_ID"></div>      the upcoming DEPARTURES with prices
 *   <div data-tg-badge="TRIP_ID"></div>           a compact price + availability BADGE
 *   <script src="https://trips.travelify.io/embed.js" defer></script>
 *
 * TRIP_ID is the trip's uuid (or a legacy tgw_ id); OPERATOR_SLUG is the
 * operator's slug. Optional attributes on any container:
 *   data-tg-cta="Reserve a place"   the button label (card + book)
 *   data-tg-api="https://..."       override the API origin (dev only)
 *
 * Reads GET {origin}/api/v1/trips/{id} and /api/v1/operators/{slug}/trips —
 * public, CORS-open, counts only. No traveller data ever reaches this script.
 *
 * CSP-clean: no inline handlers, no injected <script>, no eval, no config
 * through innerHTML. Shadow DOM with :host{all:initial} so a host page's CSS
 * cannot leak in and ours cannot leak out.
 * =============================================================================
 */
(function () {
  'use strict';

  var VERSION = '0.4.0';
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
      || host === 'picsum.photos'
      || host === 'trips.travelify.io'
      || host === 'travelgenix-trips.vercel.app';
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
    // Grid: cards fill the cell rather than cap at 420px.
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(288px,1fr));gap:18px}',
    '.grid .c{max-width:none}',
    '.grid-empty{padding:16px 18px;font-size:13px;color:#6b7671}',
    // Bare book button (data-tg-book).
    '.book{display:inline-block;font-family:var(--tg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);',
    'font-size:15px;font-weight:600;cursor:pointer;color:#fff;background:var(--tg-accent,#0e6e5c);',
    'border:0;border-radius:9px;padding:12px 20px;line-height:1.2}',
    '.book:hover{filter:brightness(1.07)}',
    '.book:active{transform:translateY(1px)}',
    '.book:focus-visible{outline:2px solid var(--tg-accent,#0e6e5c);outline-offset:2px}',
    // Reviews.
    '.revw{font-family:var(--tg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);color:#12211f;max-width:720px}',
    '.rv-sum{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 16px}',
    '.rv-avg{font-weight:700;font-size:1.15rem;font-variant-numeric:tabular-nums}',
    '.rv-cnt{font-size:14px;color:#6b7671}',
    '.rv-stars{display:inline-flex;color:#f5a623;line-height:0}',
    '.rv-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}',
    '.rv-item{border:1px solid #e3e7ea;border-radius:10px;padding:14px 16px;background:#fff}',
    '.rv-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
    '.rv-ttl{font-size:14.5px;font-weight:600}',
    '.rv-body{margin:0;color:#3a4b47;line-height:1.55;white-space:pre-line;font-size:14.5px}',
    '.rv-by{margin:8px 0 0;font-size:13px;color:#8c9894}',
    '.rv-empty{font-size:14px;color:#6b7671}',
    // Departures list.
    '.deps{font-family:var(--tg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);color:#12211f;max-width:520px}',
    '.deps-empty{font-size:14px;color:#6b7671;padding:6px 0}',
    '.dep{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #e3e7ea}',
    '.dep:last-child{border-bottom:0}',
    '.dep-when{flex:1;min-width:0;font-size:14.5px;font-weight:600;line-height:1.25}',
    '.dep-sub{display:block;font-weight:400;font-size:12.5px;color:#6b7671;margin-top:2px}',
    '.dep-price{font-variant-numeric:tabular-nums;font-weight:700;font-size:15px;color:var(--tg-accent,#0e6e5c);white-space:nowrap}',
    '.dep-book{font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#fff;background:var(--tg-accent,#0e6e5c);border:0;border-radius:8px;padding:8px 14px;white-space:nowrap}',
    '.dep-book:hover{filter:brightness(1.07)}',
    '.dep-book:active{transform:translateY(1px)}',
    '.dep-book:focus-visible{outline:2px solid var(--tg-accent,#0e6e5c);outline-offset:2px}',
    '.dep-sold{font-size:12.5px;font-weight:600;color:#8c9894;white-space:nowrap}',
    // Compact price + availability badge.
    '.badge{display:inline-flex;align-items:center;gap:12px;font-family:var(--tg-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif);background:#fff;border:1px solid #e3e7ea;border-radius:999px;padding:7px 8px 7px 16px;box-shadow:0 8px 22px -14px rgba(18,33,31,.55)}',
    '.badge-txt{font-size:13.5px;color:#3a4b47;line-height:1.2}',
    '.badge-txt b{font-variant-numeric:tabular-nums;color:#12211f}',
    '.badge-cta{font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;color:#fff;background:var(--tg-accent,#0e6e5c);border:0;border-radius:999px;padding:8px 16px}',
    '.badge-cta:hover{filter:brightness(1.07)}',
    '.badge-cta:active{transform:translateY(1px)}',
    '.badge-cta:focus-visible{outline:2px solid var(--tg-accent,#0e6e5c);outline-offset:2px}',
    '.err{padding:16px 18px;font-size:13px;color:#6b7671;border:1px solid #e3e7ea;border-radius:12px;max-width:420px;background:#fff}',
  ].join('');

  function addStyle(root) {
    var style = document.createElement('style');
    style.textContent = CARD_CSS;
    root.appendChild(style);
  }

  // Build ONE card element (no <style>), wired to open the booking overlay. The
  // operator is passed separately so the grid can reuse one operator across many
  // trips without repeating it per item.
  function buildCard(trip, op, departures, opts) {
    trip = trip || {};
    op = op || {};
    var brand = op.brand || {};
    var accent = hexColour(brand.primaryColour, '#0e6e5c');
    var hero = safeImg(trip.heroImageUrl);
    var logo = safeImg(brand.logoUrl);
    var price = fromPrice(departures, trip.currency);
    var duration = trip.content && typeof trip.content.durationText === 'string' ? trip.content.durationText : '';
    var where = [trip.location, duration].filter(Boolean).join('  ·  ');

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
      '<span class="dates">' + esc(nextDates(departures)) + '</span>',
      '</div>',
      '<button class="cta" type="button">' + esc(opts.cta) + '</button>',
      '<p class="foot">Booking by ' + esc(op.name || 'the operator') + '</p>',
      '</div>',
    ].join('');

    card.querySelector('.cta').addEventListener('click', function () {
      openBooking(opts.base, op.slug, trip.slug, accent);
    });
    return card;
  }

  function renderCard(root, data, opts) {
    addStyle(root);
    root.appendChild(buildCard(data.trip, data.operator, data.departures, opts));
  }

  // A grid of one operator's published trips. listData = { operator, trips:[{trip,departures}] }.
  function renderGrid(root, listData, opts) {
    addStyle(root);
    var op = listData.operator || {};
    var items = (listData.trips || []).filter(function (it) { return it && it.trip; });
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'grid-empty';
      empty.textContent = 'No trips on sale just now. Please check back soon.';
      root.appendChild(empty);
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'grid';
    for (var i = 0; i < items.length; i++) {
      grid.appendChild(buildCard(items[i].trip, op, items[i].departures, opts));
    }
    root.appendChild(grid);
  }

  // A bare "Book" button that opens the overlay. For operators who already have
  // their own trip page and only want the checkout.
  function renderButton(root, data, opts) {
    addStyle(root);
    var trip = data.trip || {};
    var op = data.operator || {};
    var accent = hexColour((op.brand || {}).primaryColour, '#0e6e5c');
    var btn = document.createElement('button');
    btn.className = 'book';
    btn.type = 'button';
    btn.style.setProperty('--tg-accent', accent);
    btn.textContent = opts.cta;
    btn.addEventListener('click', function () {
      openBooking(opts.base, op.slug, trip.slug, accent);
    });
    root.appendChild(btn);
  }

  // --- departures list -------------------------------------------------------

  // Every open departure as a row: when, a small "N places left" nudge when it
  // is getting tight, the price, and a Book button that opens the same overlay.
  function renderDepartures(root, data, opts) {
    addStyle(root);
    var trip = data.trip || {};
    var op = data.operator || {};
    var accent = hexColour((op.brand || {}).primaryColour, '#0e6e5c');
    var deps = data.departures || [];
    var wrap = document.createElement('div');
    wrap.className = 'deps';
    wrap.style.setProperty('--tg-accent', accent);

    if (!deps.length) {
      wrap.innerHTML = '<div class="deps-empty">No dates on sale just now. Please check back soon.</div>';
      root.appendChild(wrap);
      return;
    }

    var rows = '';
    for (var i = 0; i < deps.length; i++) {
      var d = deps[i] || {};
      var when = dateRange(d.startsOn, d.endsOn);
      var price = money(d.pricePence, trip.currency);
      var left = (typeof d.remaining === 'number' && d.remaining > 0 && d.remaining <= 6)
        ? d.remaining + (d.remaining === 1 ? ' place left' : ' places left') : '';
      rows += '<div class="dep"><span class="dep-when">' + esc(when) +
        (left ? '<span class="dep-sub">' + esc(left) + '</span>' : '') + '</span>' +
        (price ? '<span class="dep-price">' + esc(price) + '</span>' : '') +
        (d.soldOut
          ? '<span class="dep-sold">Sold out</span>'
          : '<button class="dep-book" type="button">' + esc(opts.cta) + '</button>') +
        '</div>';
    }
    // Every value above is esc()'d and the markup is static, so this innerHTML
    // carries no untrusted string.
    wrap.innerHTML = rows;
    var btns = wrap.querySelectorAll('.dep-book');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        openBooking(opts.base, op.slug, trip.slug, accent);
      });
    }
    root.appendChild(wrap);
  }

  // --- compact price + availability badge ------------------------------------

  function renderBadge(root, data, opts) {
    addStyle(root);
    var trip = data.trip || {};
    var op = data.operator || {};
    var accent = hexColour((op.brand || {}).primaryColour, '#0e6e5c');
    var deps = data.departures || [];
    var price = fromPrice(deps, trip.currency);
    var open = deps.filter(function (d) { return d && !d.soldOut; });

    var badge = document.createElement('div');
    badge.className = 'badge';
    badge.style.setProperty('--tg-accent', accent);

    var txt = !open.length
      ? '<span class="badge-txt">Sold out</span>'
      : '<span class="badge-txt">' + (price ? 'from <b>' + esc(price) + '</b> · ' : '') + esc(nextDates(deps)) + '</span>';
    badge.innerHTML = txt + (open.length ? '<button class="badge-cta" type="button">' + esc(opts.cta) + '</button>' : '');

    var cta = badge.querySelector('.badge-cta');
    if (cta) cta.addEventListener('click', function () { openBooking(opts.base, op.slug, trip.slug, accent); });
    root.appendChild(badge);
  }

  // --- reviews ---------------------------------------------------------------

  var starSeq = 0;
  function starSvg(fill) {
    var gid = 'tgs' + (starSeq++);
    var f = fill === 'full' ? 'currentColor' : fill === 'half' ? 'url(#' + gid + ')' : 'none';
    var defs = fill === 'half'
      ? '<defs><linearGradient id="' + gid + '"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs>'
      : '';
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' + defs +
      '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z" fill="' + f +
      '" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  }

  // Static SVG markup for a 0..5 value, rounded to the nearest half star.
  function starsHtml(value) {
    var a = Math.max(0, Math.min(5, typeof value === 'number' ? value : 0));
    var halves = Math.round(a * 2);
    var full = Math.floor(halves / 2), half = halves % 2 === 1, empty = 5 - full - (half ? 1 : 0);
    var out = '<span class="rv-stars" role="img" aria-label="' + esc(a.toFixed(1)) + ' out of 5">';
    for (var i = 0; i < full; i++) out += starSvg('full');
    if (half) out += starSvg('half');
    for (var j = 0; j < empty; j++) out += starSvg('empty');
    return out + '</span>';
  }

  function renderReviews(root, data) {
    addStyle(root);
    var wrap = document.createElement('div');
    wrap.className = 'revw';
    var sum = data.summary || { average: 0, count: 0 };
    var reviews = data.reviews || [];
    if (!reviews.length) {
      wrap.innerHTML = '<p class="rv-empty">No reviews yet.</p>';
      root.appendChild(wrap);
      return;
    }
    var head = '<div class="rv-sum">' + starsHtml(sum.average) +
      '<span class="rv-avg">' + esc((sum.average || 0).toFixed(1)) + '</span>' +
      '<span class="rv-cnt">' + esc(sum.count) + ' ' + (sum.count === 1 ? 'review' : 'reviews') + '</span></div>';
    var items = '<ul class="rv-list">';
    for (var i = 0; i < reviews.length; i++) {
      var r = reviews[i] || {};
      items += '<li class="rv-item"><div class="rv-top">' + starsHtml(r.rating) +
        (r.title ? '<span class="rv-ttl">' + esc(r.title) + '</span>' : '') +
        '</div><p class="rv-body">' + esc(r.body) + '</p>' +
        '<p class="rv-by">' + esc(r.reviewer_name) + '</p></li>';
    }
    items += '</ul>';
    // Every value above is esc()'d; the star markup is static, so this innerHTML
    // carries no untrusted string.
    wrap.innerHTML = head + items;
    root.appendChild(wrap);
  }

  function renderError(root, message) {
    addStyle(root);
    var box = document.createElement('div');
    box.className = 'err';
    box.textContent = message;
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

    var base = apiBase(el);
    var root = el.attachShadow ? el.attachShadow({ mode: 'open' }) : el;
    if (!base) { renderError(root, 'This trip could not be loaded.'); return; }

    // Which widget: reviews, a grid of an operator's trips, a book button, or a card.
    var operatorSlug = el.getAttribute('data-tg-trips');
    var bookId = el.getAttribute('data-tg-book');
    var reviewsId = el.getAttribute('data-tg-reviews');
    var depsId = el.getAttribute('data-tg-departures');
    var badgeId = el.getAttribute('data-tg-badge');
    var tripId = el.getAttribute('data-tg-trip');

    if (reviewsId) {
      fetch(base + '/api/v1/trips/' + encodeURIComponent(reviewsId) + '/reviews', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          if (!data || !data.reviews) { renderError(root, 'Reviews could not be loaded.'); return; }
          renderReviews(root, data);
        })
        .catch(function () { renderError(root, 'Reviews could not be loaded right now.'); });
      return;
    }

    if (operatorSlug) {
      var gopts = { base: base, cta: el.getAttribute('data-tg-cta') || 'Reserve a place' };
      fetch(base + '/api/v1/operators/' + encodeURIComponent(operatorSlug) + '/trips', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
          if (!data || !data.trips) { renderError(root, 'These trips are not available.'); return; }
          renderGrid(root, data, gopts);
        })
        .catch(function () { renderError(root, 'These trips could not be loaded right now.'); });
      return;
    }

    var id = bookId || depsId || badgeId || tripId;
    if (!id) { renderError(root, 'This trip could not be loaded.'); return; }
    var defaultCta = bookId ? 'Book now' : (depsId || badgeId) ? 'Book' : 'Reserve a place';
    var opts = { base: base, cta: el.getAttribute('data-tg-cta') || defaultCta };

    fetch(base + '/api/v1/trips/' + encodeURIComponent(id), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (!data || !data.trip) { renderError(root, 'This trip is not available.'); return; }
        if (depsId) renderDepartures(root, data, opts);
        else if (badgeId) renderBadge(root, data, opts);
        else if (bookId) renderButton(root, data, opts);
        else renderCard(root, data, opts);
      })
      .catch(function () { renderError(root, 'This trip could not be loaded right now.'); });
  }

  function init() {
    var nodes = document.querySelectorAll('[data-tg-trip],[data-tg-trips],[data-tg-book],[data-tg-reviews],[data-tg-departures],[data-tg-badge]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TGTripsEmbed = { version: VERSION, mount: mount, init: init };
})();
