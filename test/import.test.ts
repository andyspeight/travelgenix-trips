// AI import feeds model output straight toward the database, so the coercion is
// the safety boundary: a non-trip document is refused, and every field is run
// through the same sanitiser the editor uses.

import test from 'node:test';
import assert from 'node:assert/strict';
import { draftFromImport, parseModelJson, clampBrochure, MAX_BROCHURE_CHARS } from '../src/lib/import.ts';

const GOOD = {
  trip: { title: 'Kenya Safari', summary: 'Big cats and the coast.', location: 'Kenya', currency: 'gbp', durationText: '11 days', priceNote: 'Per person sharing.' },
  highlights: ['Dawn in the Mara', 'The Rift Valley'],
  glance: [{ day: 'Day 1', date: '24 Oct', destination: 'Nairobi', accommodation: 'Serena' }],
  days: [{ label: 'Day 1', date: '24 Oct', title: 'Arrive', body: 'Met and transferred.', facts: [{ label: 'Meals', value: 'Dinner' }] }],
  extras: [{ name: 'Balloon safari', pricePence: 42000, note: '', recommended: true }],
  included: ['All game drives'],
  excluded: ['International flights'],
  sections: [{ type: 'text', heading: 'Visa', body: 'Get an eTA.' }],
};

test('a good extraction becomes a safe trip draft', () => {
  const d = draftFromImport(GOOD);
  assert.equal(d.ok, true);
  if (!d.ok) return;
  assert.equal(d.trip.title, 'Kenya Safari');
  assert.equal(d.trip.slug, 'kenya-safari');
  assert.equal(d.trip.kind, 'tour');
  assert.equal(d.trip.currency, 'gbp');
  assert.equal(d.content.durationText, '11 days');
  assert.equal(d.content.days?.length, 1);
  assert.equal(d.content.highlights?.length, 2);
  assert.equal(d.content.extras?.[0]?.name, 'Balloon safari');
});

test('a model {error} is surfaced, not turned into a trip', () => {
  const d = draftFromImport({ error: 'This does not look like a trip itinerary.' });
  assert.equal(d.ok, false);
  if (d.ok) return;
  assert.match(d.error, /trip itinerary/);
});

test('a document with no title is refused', () => {
  assert.equal(draftFromImport({ trip: { summary: 'no title here' } }).ok, false);
  assert.equal(draftFromImport({}).ok, false);
  assert.equal(draftFromImport(null).ok, false);
});

test('the coercion sanitises: a hostile image never survives', () => {
  const d = draftFromImport({
    ...GOOD,
    days: [{ title: 'Day 1', body: 'ok', images: ['javascript:alert(1)', 'https://images.unsplash.com/x.jpg'] }],
  });
  assert.equal(d.ok, true);
  if (!d.ok) return;
  // sanitiseTripContent drops the hostile URL and keeps only the safe one.
  const imgs = d.content.days?.[0]?.images ?? [];
  assert.ok(!imgs.some((u) => u.startsWith('javascript:')));
});

test('parseModelJson tolerates fences and surrounding prose', () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Here you go: {"a":2} hope that helps'), { a: 2 });
  assert.equal(parseModelJson('no json at all'), null);
  assert.equal(parseModelJson('{not valid'), null);
});

test('clampBrochure bounds a runaway input', () => {
  const huge = 'x'.repeat(MAX_BROCHURE_CHARS + 5000);
  assert.equal(clampBrochure(huge).length, MAX_BROCHURE_CHARS);
});
