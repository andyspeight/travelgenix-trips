// An operator's brand colour is chosen against their letterhead, not our page.
// These tests are about the case that actually shipped broken: navy on black.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHex, toHex, contrast, readableOn } from '../src/lib/colour.ts';

const WHITE = '#ffffff';
const NEAR_BLACK = '#0e1817';
const GTS_NAVY = '#1B2B5B';   // Global Travel Solution's real brand colour

test('hex parsing handles both lengths and rejects everything else', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('#1B2B5B'), { r: 27, g: 43, b: 91 });
  assert.equal(parseHex('red'), null);
  assert.equal(parseHex('#12345'), null);
  assert.equal(parseHex('rgb(0,0,0)'), null);
  assert.equal(parseHex(''), null);
  assert.equal(parseHex(null), null);
});

test('round-trips through hex', () => {
  assert.equal(toHex({ r: 27, g: 43, b: 91 }), '#1b2b5b');
});

test('contrast matches the known WCAG anchors', () => {
  const w = parseHex('#ffffff')!;
  const b = parseHex('#000000')!;
  assert.equal(Math.round(contrast(w, b)), 21);
  assert.equal(Math.round(contrast(w, w)), 1);
  // Order must not matter.
  assert.equal(contrast(w, b), contrast(b, w));
});

test('THE BUG: navy is unreadable on a dark ground', () => {
  const navy = parseHex(GTS_NAVY)!;
  const dark = parseHex(NEAR_BLACK)!;
  assert.ok(contrast(navy, dark) < 4.5, 'this is the failure we are fixing');
});

test('and readableOn lifts it until it passes', () => {
  const fixed = readableOn(GTS_NAVY, NEAR_BLACK, '#5fc0a5');
  assert.ok(contrast(parseHex(fixed)!, parseHex(NEAR_BLACK)!) >= 4.5);
  assert.notEqual(fixed, GTS_NAVY.toLowerCase());
});

test('a colour that already passes is returned untouched', () => {
  // Navy on white is fine, so nobody's brand gets restyled for no reason.
  assert.equal(readableOn(GTS_NAVY, WHITE, '#0e6e5c'), '#1b2b5b');
});

test('it darkens against a light ground rather than lightening', () => {
  const paleYellow = '#ffe680';
  const fixed = readableOn(paleYellow, WHITE, '#0e6e5c');
  assert.ok(contrast(parseHex(fixed)!, parseHex(WHITE)!) >= 4.5);
  // Darker than it started.
  assert.ok(parseHex(fixed)!.r <= parseHex(paleYellow)!.r);
});

test('the adjusted colour keeps the operator hue rather than becoming ours', () => {
  const fixed = parseHex(readableOn(GTS_NAVY, NEAR_BLACK, '#5fc0a5'))!;
  // Navy: blue dominates. That must still be true after the lift.
  assert.ok(fixed.b > fixed.r, 'still blue');
  assert.ok(fixed.b > fixed.g, 'still blue');
});

test('rubbish falls back to our own accent', () => {
  assert.equal(readableOn('not a colour', WHITE, '#0e6e5c'), '#0e6e5c');
  assert.equal(readableOn(undefined, WHITE, '#0e6e5c'), '#0e6e5c');
  assert.equal(readableOn('javascript:alert(1)', WHITE, '#0e6e5c'), '#0e6e5c');
});

test('a hopeless colour falls back rather than shipping grey on grey', () => {
  const midGrey = '#767676';
  assert.equal(readableOn(midGrey, '#808080', '#0e6e5c'), '#0e6e5c');
});
