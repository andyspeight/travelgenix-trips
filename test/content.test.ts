// The content editor's payload is operator input that becomes a public page,
// so the sanitiser is a security control. Tested at the edges.

import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitiseTripContent, penceToInput } from '../src/lib/content.ts';

test('a full content payload round-trips, prices converted to pence', () => {
  const c = sanitiseTripContent({
    overview: 'Nine nights in the Mara.',
    durationText: '11 days / 10 nights',
    highlights: ['Night game drive', '', '  Sundowner  '],
    days: [{
      title: 'Nairobi to Ol Pejeta', label: 'Day 2', body: 'Depart...',
      facts: [{ label: 'Meals', value: 'All' }, { label: '', value: 'x' }],
      optionalActivities: [{ name: 'Rhino visit', pricePence: '100' }],
      images: ['https://images.unsplash.com/photo-1.jpg', 'javascript:alert(1)'],
    }],
    included: ['Transfers', 'Guide'],
    extras: [{ name: 'Balloon', pricePence: '420', recommended: true, note: 'Sunrise' },
             { name: 'Water sports', pricePence: '0' }],
    gallery: ['https://images.unsplash.com/g1.jpg', 'http://insecure/g2.jpg'],
  });

  assert.equal(c.highlights?.length, 2, 'blanks dropped, trimmed');
  assert.equal(c.days?.[0]?.facts?.length, 1, 'incomplete fact dropped');
  assert.equal(c.days?.[0]?.optionalActivities?.[0]?.pricePence, 10000, '£100 -> 10000p');
  assert.equal(c.days?.[0]?.images?.length, 1, 'javascript: image rejected');
  assert.equal(c.extras?.[0]?.pricePence, 42000);
  assert.equal(c.extras?.[0]?.recommended, true);
  assert.equal(c.extras?.[1]?.pricePence, null, 'zero price is unpriced, not 0');
  assert.equal(c.gallery?.length, 1, 'http image rejected, https kept');
});

test('empty content is an empty object, no stray keys', () => {
  const c = sanitiseTripContent({ highlights: [], days: [], overview: '   ' });
  assert.deepEqual(c, {});
});

test('non-object input does not throw', () => {
  assert.deepEqual(sanitiseTripContent(null), {});
  assert.deepEqual(sanitiseTripContent('nonsense'), {});
  assert.deepEqual(sanitiseTripContent(42), {});
});

test('a hostile image URL never survives anywhere it can appear', () => {
  const c = sanitiseTripContent({
    gallery: ['data:text/html,<script>', 'https://evil.example/x.jpg'],
    days: [{ title: 'D', images: ['vbscript:x'] }],
    sections: [{ type: 'feature', heading: 'H', body: 'B', image: 'javascript:1' }],
  });
  assert.equal(c.gallery?.length ?? 0, 0, 'evil.example not on the allowlist');
  assert.equal(c.days?.[0]?.images ?? undefined, undefined);
  // feature keeps heading+body but drops the bad image
  const feat = c.sections?.[0];
  assert.equal(feat?.type, 'feature');
  if (feat?.type === 'feature') assert.ok(!('image' in feat) || !feat.image);
});

test('the three section shapes are preserved and validated', () => {
  const c = sanitiseTripContent({
    sections: [
      { type: 'columns', heading: 'Pack', columns: [{ heading: 'Clothes', items: ['Hat', ''] }, { heading: 'Empty', items: [] }] },
      { type: 'text', heading: 'Visa', body: 'eTA needed.' },
      { type: 'text', heading: 'No body' }, // dropped
    ],
  });
  assert.equal(c.sections?.length, 2);
  const cols = c.sections?.[0];
  assert.equal(cols?.type, 'columns');
  if (cols?.type === 'columns') {
    assert.equal(cols.columns.length, 1, 'empty column dropped');
    assert.equal(cols.columns[0]!.items.length, 1, 'blank item dropped');
  }
});

test('long text is clamped, not rejected', () => {
  const big = 'x'.repeat(9000);
  const c = sanitiseTripContent({ overview: big });
  assert.ok((c.overview?.length ?? 0) <= 4000);
});

test('penceToInput turns stored pence into a pounds string', () => {
  assert.equal(penceToInput(42000), '420');
  assert.equal(penceToInput(0), '');
  assert.equal(penceToInput(null), '');
  assert.equal(penceToInput(129950), '1299.5');
});
