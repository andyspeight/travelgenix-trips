// Validation is the server's only defence against a hand-rolled POST, so the
// tests go after the edges rather than the happy path.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify, isUsableSlug, isSafeHttpUrl, isRealDate, validateTrip, validateDeparture, validatePackage,
  validateOption,
} from '../src/lib/validate.ts';

// --------------------------------------------------------------------------
//  Slugs end up in public URLs, so they must be boring
// --------------------------------------------------------------------------

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Kenya Safari 2027'), 'kenya-safari-2027');
});

test('slugify strips accents rather than dropping the letter', () => {
  assert.equal(slugify('Málaga Città'), 'malaga-citta');
});

test('slugify collapses punctuation and trims hyphens', () => {
  assert.equal(slugify('  ***Rome & Florence!!  '), 'rome-florence');
  assert.equal(slugify('--already--slugged--'), 'already-slugged');
});

test('slugify never leaves a trailing hyphen, even after the length cap', () => {
  const out = slugify('a'.repeat(58) + ' bb');
  assert.ok(!out.endsWith('-'), `got "${out}"`);
  assert.ok(out.length <= 60);
});

test('slugify survives input with nothing usable in it', () => {
  assert.equal(slugify('!!!'), '');
  assert.equal(slugify(''), '');
});

test('reserved slugs are refused so they cannot shadow our routes', () => {
  for (const s of ['api', 'console', 'trip', 'admin', 'new', '_next']) {
    assert.equal(isUsableSlug(s), false, `${s} should be reserved`);
  }
  assert.equal(isUsableSlug('kenya-safari'), true);
  assert.equal(isUsableSlug('a'), false, 'one character is too short');
});

// --------------------------------------------------------------------------
//  URLs get rendered into a page
// --------------------------------------------------------------------------

test('only https URLs with a real host are accepted', () => {
  assert.equal(isSafeHttpUrl('https://cdn.example.com/a.jpg'), true);
  assert.equal(isSafeHttpUrl('http://example.com/a.jpg'), false, 'plain http');
  assert.equal(isSafeHttpUrl('https://localhost/a.jpg'), false, 'no dot in host');
  assert.equal(isSafeHttpUrl('not a url'), false);
});

test('script and data URLs never pass validation', () => {
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('JavaScript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeHttpUrl('vbscript:msgbox(1)'), false);
});

// --------------------------------------------------------------------------
//  Trips
// --------------------------------------------------------------------------

const goodTrip = { title: 'Kenya Safari', kind: 'group', currency: 'gbp' };

test('a good trip validates and derives its slug from the title', () => {
  const r = validateTrip(goodTrip);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.slug, 'kenya-safari');
});

test('an explicit slug wins over the title', () => {
  const r = validateTrip({ ...goodTrip, slug: 'Big Five 2027' });
  assert.equal(r.value.slug, 'big-five-2027');
});

test('a missing title is rejected', () => {
  const r = validateTrip({ ...goodTrip, title: '   ' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.title);
});

test('a title with no usable characters explains the slug problem', () => {
  const r = validateTrip({ ...goodTrip, title: '!!!' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.slug);
});

test('a title that slugs to a reserved word is rejected', () => {
  const r = validateTrip({ ...goodTrip, title: 'Console' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.slug);
});

test('an unknown kind or currency is rejected, not defaulted', () => {
  assert.equal(validateTrip({ ...goodTrip, kind: 'cruise' }).ok, false);
  assert.equal(validateTrip({ ...goodTrip, currency: 'btc' }).ok, false);
});

test('a blank currency falls back to gbp', () => {
  const r = validateTrip({ title: 'A Trip', kind: 'group' });
  assert.equal(r.ok, true);
  assert.equal(r.value.currency, 'gbp');
});

test('a hostile hero image URL is rejected', () => {
  const r = validateTrip({ ...goodTrip, hero_image_url: 'javascript:alert(1)' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.hero_image_url);
});

test('empty optional fields become null, not empty strings', () => {
  const r = validateTrip(goodTrip);
  assert.equal(r.value.summary, null);
  assert.equal(r.value.location, null);
  assert.equal(r.value.hero_image_url, null);
});

// --------------------------------------------------------------------------
//  Dates
// --------------------------------------------------------------------------

test('a date that does not exist is rejected rather than rolled forward', () => {
  assert.equal(isRealDate('2026-02-31'), false);
  assert.equal(isRealDate('2026-13-01'), false);
  assert.equal(isRealDate('2026-02-28'), true);
  assert.equal(isRealDate('2028-02-29'), true, '2028 is a leap year');
  assert.equal(isRealDate('2027-02-29'), false, '2027 is not');
});

test('a malformed date string is rejected', () => {
  assert.equal(isRealDate('25/12/2026'), false);
  assert.equal(isRealDate('2026-1-1'), false);
  assert.equal(isRealDate(''), false);
});

// --------------------------------------------------------------------------
//  Departures
// --------------------------------------------------------------------------

const goodDep = { starts_on: '2027-03-01', ends_on: '2027-03-10', capacity: '12' };

test('a good departure validates', () => {
  const r = validateDeparture(goodDep);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.capacity, 12);
});

test('returning before departing is rejected', () => {
  const r = validateDeparture({ ...goodDep, ends_on: '2027-02-01' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.ends_on);
});

test('a same-day departure is allowed', () => {
  const r = validateDeparture({ ...goodDep, ends_on: goodDep.starts_on });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('a blank price means unpriced, not zero', () => {
  const r = validateDeparture({ ...goodDep, price_pence: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.price_pence, null);
});

test('prices are read as pounds and stored as pence', () => {
  const r = validateDeparture({ ...goodDep, price_pence: '1299.50' });
  assert.equal(r.value.price_pence, 129950);
});

test('a deposit larger than the price is rejected', () => {
  const r = validateDeparture({ ...goodDep, price_pence: '1000', deposit_pence: '1500' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.deposit_pence);
});

test('a deposit is fine when the trip is unpriced', () => {
  const r = validateDeparture({ ...goodDep, price_pence: '', deposit_pence: '200' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('a balance due after departure is rejected', () => {
  const r = validateDeparture({ ...goodDep, balance_due_date: '2027-03-05' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.balance_due_date);
});

test('a balance due before departure is fine', () => {
  const r = validateDeparture({ ...goodDep, balance_due_date: '2027-01-15' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('a negative or absurd capacity is rejected', () => {
  assert.equal(validateDeparture({ ...goodDep, capacity: '-1' }).ok, false);
  assert.equal(validateDeparture({ ...goodDep, capacity: '99999' }).ok, false);
});

test('a blank capacity is zero, which reads as "not set"', () => {
  const r = validateDeparture({ ...goodDep, capacity: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.capacity, 0);
});

test('a price beyond the sane ceiling is rejected (overflow guard)', () => {
  // £500k a head is the ceiling; 60,000,000 pence = £600k must fail.
  assert.ok(validateDeparture({ ...goodDep, price_pence: '600000' }).errors.price_pence);
  // A real, high-but-plausible price passes.
  assert.equal(validateDeparture({ ...goodDep, price_pence: '25000' }).ok, true);
});

test('an unknown status is rejected, not defaulted', () => {
  assert.equal(validateDeparture({ ...goodDep, status: 'nearly' }).ok, false);
});

// --------------------------------------------------------------------------
//  Packages — room types (phase 5)
// --------------------------------------------------------------------------

test('a package converts price to pence and defaults occupancy', () => {
  const r = validatePackage({ name: 'Twin share', price_pence: '3700', info_url: 'https://hotel.example.com/room' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.price_pence, 370000);
  assert.equal(r.value.occupancy, 1, 'occupancy defaults to 1');
  assert.equal(r.value.capacity, null, 'blank capacity is null, not zero');
});

test('a package needs a name', () => {
  assert.ok(validatePackage({ name: '  ' }).errors.name);
});

test('a package rejects an unsafe image or info link', () => {
  assert.ok(validatePackage({ name: 'Suite', image_url: 'javascript:alert(1)' }).errors.image_url);
  assert.ok(validatePackage({ name: 'Suite', info_url: 'http://insecure/room' }).errors.info_url);
});

test('a package price beyond the ceiling is rejected', () => {
  assert.ok(validatePackage({ name: 'Gold', price_pence: '600000' }).errors.price_pence);
});

test('an empty package price means "on request", not zero', () => {
  const r = validatePackage({ name: 'Standard', price_pence: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.price_pence, null);
});

// --------------------------------------------------------------------------
//  Options — priced add-ons
// --------------------------------------------------------------------------

test('an option reads price as pence and defaults to per-traveller', () => {
  const r = validateOption({ name: 'Airport transfer', price_pence: '40' });
  assert.equal(r.ok, true);
  assert.equal(r.value.price_pence, 4000);
  assert.equal(r.value.per, 'traveller');
  assert.equal(r.value.is_required, false);
});

test('an option needs a name', () => {
  assert.ok(validateOption({ name: '  ' }).errors.name);
});

test('an option can be charged per booking and marked required', () => {
  const r = validateOption({ name: 'Private guide', price_pence: '250', per: 'booking', is_required: 'on' });
  assert.equal(r.ok, true);
  assert.equal(r.value.per, 'booking');
  assert.equal(r.value.is_required, true);
});

test('an unknown per falls back to traveller, not an error', () => {
  const r = validateOption({ name: 'Meals', price_pence: '10', per: 'nonsense' });
  assert.equal(r.ok, true);
  assert.equal(r.value.per, 'traveller');
});

test('a blank option price means "no charge", not zero-as-error', () => {
  const r = validateOption({ name: 'Welcome pack', price_pence: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.price_pence, null);
});

test('an option price beyond the ceiling is rejected', () => {
  assert.ok(validateOption({ name: 'Yacht', price_pence: '600000' }).errors.price_pence);
});
