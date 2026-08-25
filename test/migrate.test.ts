// The mapper is tested against the REAL saved Kenya config, not an invented
// one. The whole risk of a migration is that it silently drops content, so the
// assertions are about what must survive.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapWidgetConfig, priceOrNull } from '../src/lib/migrate/from-widget.ts';

const kenya = JSON.parse(
  readFileSync(new URL('./fixtures/kenya-tour.json', import.meta.url), 'utf8'),
);
const WIDGET_ID = 'tgw_1786354272633_taufrk';
const mapped = mapWidgetConfig(kenya, WIDGET_ID);

test('the trip head maps across', () => {
  assert.equal(mapped.trip.title, 'Kenya Johari na Bahari Safari');
  assert.equal(mapped.trip.slug, 'kenya-johari-na-bahari-safari');
  assert.equal(mapped.trip.kind, 'tour');
  assert.equal(mapped.trip.location, 'Kenya');
  assert.equal(mapped.trip.currency, 'gbp');
  assert.equal(mapped.trip.legacy_widget_id, WIDGET_ID);
  assert.ok(mapped.trip.hero_image_url?.startsWith('https://'));
});

test('the subtitle becomes the summary', () => {
  assert.ok(mapped.trip.summary?.startsWith('Eleven days from the plains'));
});

test('nothing is dropped from the long-form content', () => {
  const c = mapped.trip.content;
  assert.equal(c.days?.length, 9, 'all nine day entries survive');
  assert.equal(c.glance?.length, 11, 'the at-a-glance table survives');
  assert.equal(c.highlights?.length, 7);
  assert.equal(c.included?.length, 11);
  assert.equal(c.excluded?.length, 4);
  assert.equal(c.gallery?.length, 4);
  assert.equal(c.sections?.length, 4, 'packing list, visas, vehicle, good to know');
  assert.equal(c.extras?.length, 2);
  assert.equal(c.durationText, '11 days / 10 nights');
  assert.ok(c.priceNote?.includes('Per person sharing'));
});

test('per-day facts keep their order', () => {
  const dayTwo = mapped.trip.content.days?.[1];
  assert.equal(dayTwo?.title, 'Nairobi to Ol Pejeta');
  assert.deepEqual(
    dayTwo?.facts?.map((f) => f.label),
    ['Accommodation', 'Meals', 'Driving time', 'Altitude'],
  );
});

test('per-day optional activities survive with their prices', () => {
  const dayTwo = mapped.trip.content.days?.[1];
  assert.equal(dayTwo?.optionalActivities?.length, 3);
  assert.equal(dayTwo?.optionalActivities?.[0]?.pricePence, 10000);
});

test('the three section shapes are all preserved', () => {
  const kinds = mapped.trip.content.sections?.map((s) => s.type);
  assert.deepEqual(kinds, ['columns', 'text', 'feature', 'text']);

  const packing = mapped.trip.content.sections?.[0];
  assert.equal(packing?.type, 'columns');
  if (packing?.type === 'columns') {
    assert.equal(packing.columns.length, 2);
    assert.equal(packing.columns[0]?.items.length, 8);
  }

  const vehicle = mapped.trip.content.sections?.[3 - 1];
  assert.equal(vehicle?.type, 'feature');
  if (vehicle?.type === 'feature') assert.ok(vehicle.image?.startsWith('https://'));
});

test('the saved dates become one open departure', () => {
  assert.equal(mapped.departures.length, 1);
  const d = mapped.departures[0]!;
  assert.equal(d.starts_on, '2026-10-24');
  assert.equal(d.ends_on, '2026-11-03');
  assert.equal(d.capacity, 7);
  assert.equal(d.price_pence, 370000);
  assert.equal(d.deposit_pence, 50000);
  assert.equal(d.balance_due_date, '2026-08-24');
  assert.equal(d.status, 'open');
});

test('the single supplement and the extras become options', () => {
  const names = mapped.options.map((o) => o.name);
  assert.deepEqual(names, [
    'Single supplement',
    'Balloon safari over the Mara plains',
    'Mombasa water sports (jet-ski, snorkel or scuba)',
  ]);
  assert.equal(mapped.options[0]?.price_pence, 45000);
  assert.equal(mapped.options[1]?.price_pence, 42000);
});

test('a zero-priced extra carries null, never zero', () => {
  // Water sports are priced locally. Zero must not become "free".
  const watersports = mapped.options[2]!;
  assert.equal(watersports.price_pence, null);
  assert.equal(mapped.trip.content.extras?.[1]?.pricePence, null);
});

test('priceOrNull treats zero and rubbish alike', () => {
  assert.equal(priceOrNull(0), null);
  assert.equal(priceOrNull(-5), null);
  assert.equal(priceOrNull(''), null);
  assert.equal(priceOrNull(null), null);
  assert.equal(priceOrNull('42000'), 42000);
  assert.equal(priceOrNull(42000), 42000);
});

test('the trip design block is dropped: branding lives on the operator', () => {
  assert.ok(!('design' in mapped.trip.content));
  assert.ok(!('enquiry' in mapped.trip.content));
});

test('an empty config does not throw and invents nothing', () => {
  const empty = mapWidgetConfig({}, 'tgw_nothing');
  assert.equal(empty.departures.length, 0);
  assert.equal(empty.options.length, 0);
  assert.deepEqual(empty.trip.content, {});
  assert.equal(empty.trip.summary, null);
});

test('a Group Trip config maps as kind group', () => {
  const groupTrip = mapWidgetConfig(
    { trip: { title: 'Yoga Retreat', startDate: '2027-05-01', endDate: '2027-05-08', capacity: 12 } },
    'tgw_group',
  );
  assert.equal(groupTrip.trip.kind, 'group');
  assert.equal(groupTrip.departures.length, 1);
});

test('backwards or missing dates produce no departure rather than a bad one', () => {
  const backwards = mapWidgetConfig(
    { tour: { title: 'X', startDate: '2027-05-08', endDate: '2027-05-01' } },
    'tgw_x',
  );
  assert.equal(backwards.departures.length, 0);

  const undated = mapWidgetConfig({ tour: { title: 'X' } }, 'tgw_y');
  assert.equal(undated.departures.length, 0);
});
