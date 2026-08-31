// The review roll-up drives a public star rating, so the edges matter: junk
// ratings must not skew the average, and the star split must round to halves.

import test from 'node:test';
import assert from 'node:assert/strict';
import { summariseRatings, starParts } from '../src/lib/reviews.ts';

test('summariseRatings averages to one decimal place', () => {
  const s = summariseRatings([5, 4, 4]);
  assert.equal(s.count, 3);
  assert.equal(s.average, 4.3); // 13/3 = 4.33 -> 4.3
});

test('summariseRatings ignores out-of-range and non-finite ratings', () => {
  const s = summariseRatings([5, 0, 6, Number.NaN, 3]);
  assert.equal(s.count, 2); // only 5 and 3 count
  assert.equal(s.average, 4);
});

test('an empty set is a clean zero, not NaN', () => {
  assert.deepEqual(summariseRatings([]), { average: 0, count: 0 });
});

test('starParts rounds to the nearest half star', () => {
  assert.deepEqual(starParts(4.3), { full: 4, half: true, empty: 0 });  // 8.6 -> 9 halves = 4 + half
  assert.deepEqual(starParts(4.8), { full: 5, half: false, empty: 0 }); // 9.6 -> 10 halves = 5
  assert.deepEqual(starParts(2.2), { full: 2, half: false, empty: 3 }); // 4.4 -> 4 halves = 2
  assert.deepEqual(starParts(5), { full: 5, half: false, empty: 0 });
  assert.deepEqual(starParts(0), { full: 0, half: false, empty: 5 });
  assert.deepEqual(starParts(2.5), { full: 2, half: true, empty: 2 });  // 5 halves = 2 + half
});

test('starParts clamps out-of-range values', () => {
  assert.deepEqual(starParts(9), { full: 5, half: false, empty: 0 });
  assert.deepEqual(starParts(-1), { full: 0, half: false, empty: 5 });
});
