// The signature is the whole security story of the webhook: a receiver trusts a
// payload only if signBody and verifyBody are exact inverses and a forgery
// fails. The envelope must be stable and its money must reconcile with finance.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signBody, verifyBody, genSecret, redactSecret, isWebhookEvent,
  buildBookingEvent, WEBHOOK_EVENTS, type BookingEventData,
} from '../src/lib/webhooks.ts';

const SECRET = 'whsec_test_0123456789abcdef';
const BODY = JSON.stringify({ id: 'evt_1', type: 'booking.created' });
const TS = '1788000000';

test('signing is deterministic and verifies', () => {
  const sig = signBody(SECRET, TS, BODY);
  assert.equal(sig, signBody(SECRET, TS, BODY)); // stable
  assert.match(sig, /^[0-9a-f]{64}$/); // hex sha-256
  assert.ok(verifyBody(SECRET, TS, BODY, sig));
});

test('a tampered body, timestamp, secret or signature fails to verify', () => {
  const sig = signBody(SECRET, TS, BODY);
  assert.equal(verifyBody(SECRET, TS, BODY + ' ', sig), false);
  assert.equal(verifyBody(SECRET, '1788000001', BODY, sig), false);
  assert.equal(verifyBody('whsec_other', TS, BODY, sig), false);
  assert.equal(verifyBody(SECRET, TS, BODY, sig.slice(0, -1) + '0'), false);
  assert.equal(verifyBody(SECRET, TS, BODY, 'nonsense'), false); // wrong length, no throw
});

test('secrets are fresh, prefixed, and redact to a recognisable stub', () => {
  const a = genSecret();
  const b = genSecret();
  assert.notEqual(a, b);
  assert.match(a, /^whsec_[0-9a-f]{48}$/);
  const r = redactSecret(a);
  assert.ok(r.startsWith('whsec_'));
  assert.ok(r.endsWith(a.slice(-4)));
  assert.ok(!r.includes(a.slice(10, 20))); // the middle is hidden
});

test('event type guard admits only the known set', () => {
  for (const e of WEBHOOK_EVENTS) assert.ok(isWebhookEvent(e));
  assert.equal(isWebhookEvent('booking.deleted'), false);
  assert.equal(isWebhookEvent(42), false);
});

const data = (over: Partial<BookingEventData> = {}): BookingEventData => ({
  reference: 'TGT-AAAA-1111', status: 'deposit_paid', trip: 'Kenya Safari', operator: 'Acme Tours',
  party_size: 2, currency: 'gbp', total_pence: 740000, deposit_pence: 100000,
  starts_on: '2026-10-24', ends_on: '2026-11-03', lead_name: 'Ada', lead_email: 'ada@example.com',
  package: 'Twin', promo: null, ...over,
});

test('the envelope is stable and its money reconciles with finance', () => {
  const ev = buildBookingEvent('booking.created', data(), { id: 'evt_x', now: new Date('2026-08-31T00:00:00Z') });
  assert.equal(ev.id, 'evt_x');
  assert.equal(ev.type, 'booking.created');
  assert.equal(ev.created_at, '2026-08-31T00:00:00.000Z');
  // deposit_paid: collected = deposit, outstanding = total - deposit
  assert.equal(ev.data.collected_pence, 100000);
  assert.equal(ev.data.outstanding_pence, 640000);
  assert.equal(ev.data.reference, 'TGT-AAAA-1111');
});

test('a paid booking owes nothing; null money is treated as zero', () => {
  const paid = buildBookingEvent('booking.updated', data({ status: 'paid' }));
  assert.equal(paid.data.collected_pence, 740000);
  assert.equal(paid.data.outstanding_pence, 0);
  const bare = buildBookingEvent('booking.created', data({ status: 'pending', total_pence: null, deposit_pence: null }));
  assert.equal(bare.data.collected_pence, 0);
  assert.equal(bare.data.outstanding_pence, 0);
});

test('a signed envelope round-trips end to end', () => {
  const ev = buildBookingEvent('booking.created', data());
  const body = JSON.stringify(ev);
  const sig = signBody(SECRET, TS, body);
  assert.ok(verifyBody(SECRET, TS, body, sig));
});
