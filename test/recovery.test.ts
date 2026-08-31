// Who gets the come-back email is an outbound-messaging decision, so the edges
// matter: never chase a completed, cancelled, already-nudged, unreachable, still
// -live, or ancient booking.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isAbandoned, type RecoveryCandidate } from '../src/lib/recovery.ts';

const NOW = new Date('2026-09-01T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

function base(): RecoveryCandidate {
  return {
    status: 'pending',
    holdExpiresAt: hoursAgo(2),     // lapsed 2 hours ago
    recoverySentAt: null,
    travellerEmail: 'someone@example.com',
    createdAt: daysAgo(3),
  };
}

test('a pending, lapsed, recent, reachable, un-nudged booking is abandoned', () => {
  assert.equal(isAbandoned(base(), NOW), true);
});

test('a completed or cancelled booking is never chased', () => {
  for (const status of ['deposit_paid', 'paid', 'cancelled', 'expired']) {
    assert.equal(isAbandoned({ ...base(), status }, NOW), false, status);
  }
});

test('an already-recovered booking is not chased again', () => {
  assert.equal(isAbandoned({ ...base(), recoverySentAt: hoursAgo(1) }, NOW), false);
});

test('no email means no way to reach them, so no nudge', () => {
  assert.equal(isAbandoned({ ...base(), travellerEmail: null }, NOW), false);
});

test('a hold that has not lapsed yet is still live, not abandoned', () => {
  const future = new Date(NOW.getTime() + 3600000).toISOString();
  assert.equal(isAbandoned({ ...base(), holdExpiresAt: future }, NOW), false);
  assert.equal(isAbandoned({ ...base(), holdExpiresAt: null }, NOW), false);
});

test('a booking older than the window has passed the moment', () => {
  assert.equal(isAbandoned({ ...base(), createdAt: daysAgo(31) }, NOW), false);
  assert.equal(isAbandoned({ ...base(), createdAt: daysAgo(29) }, NOW), true);
});
