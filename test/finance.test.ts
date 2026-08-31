// The bookings ledger is money leaving for the operator's accounts, so the
// collected / outstanding rules must match the on-screen figures exactly, and
// the CSV must quote and format correctly for an accounting import.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingCollected, bookingOutstanding, poundsAmount, bookingsCsv, type BookingFinanceRow,
} from '../src/lib/finance.ts';

test('collected follows the payment state', () => {
  assert.equal(bookingCollected('paid', 370000, 50000), 370000);
  assert.equal(bookingCollected('deposit_paid', 370000, 50000), 50000);
  assert.equal(bookingCollected('pending', 370000, 50000), 0);
  assert.equal(bookingCollected('cancelled', 370000, 50000), 0);
  assert.equal(bookingCollected('expired', 370000, 50000), 0);
});

test('outstanding is what is still owed, and nothing on a dead booking', () => {
  assert.equal(bookingOutstanding('paid', 370000, 50000), 0);
  assert.equal(bookingOutstanding('deposit_paid', 370000, 50000), 320000);
  assert.equal(bookingOutstanding('pending', 370000, 50000), 370000);
  assert.equal(bookingOutstanding('cancelled', 370000, 50000), 0);
  assert.equal(bookingOutstanding('expired', 370000, 50000), 0);
});

test('poundsAmount is a plain two-decimal string', () => {
  assert.equal(poundsAmount(370000), '3700.00');
  assert.equal(poundsAmount(12345), '123.45');
  assert.equal(poundsAmount(0), '0.00');
});

const row = (over: Partial<BookingFinanceRow> = {}): BookingFinanceRow => ({
  reference: 'TGT-AAAA-1111', trip: 'Kenya Safari', buyer: 'Ada Lovelace', email: 'ada@example.com',
  dates: '24 Oct to 3 Nov 2026', party: 2, room: 'Twin', promo: '', status: 'deposit_paid',
  currency: 'gbp', total_pence: 740000, deposit_pence: 100000, booked_on: '2026-08-01', ...over,
});

test('the CSV has a header and reconciling amounts', () => {
  const csv = bookingsCsv([row()]);
  const lines = csv.split('\r\n');
  assert.match(lines[0]!, /^Reference,Trip,.*,Collected,Outstanding,Booked on$/);
  // total 7400, deposit 1000, collected 1000, outstanding 6400
  assert.ok(lines[1]!.includes(',7400.00,1000.00,1000.00,6400.00,2026-08-01'));
  assert.ok(lines[1]!.startsWith('TGT-AAAA-1111,Kenya Safari,Ada Lovelace,'));
});

test('a field with a comma is quoted, and currency is upper-cased', () => {
  const csv = bookingsCsv([row({ trip: 'Kenya, the Mara & the coast', currency: 'eur' })]);
  assert.ok(csv.includes('"Kenya, the Mara & the coast"'));
  assert.ok(csv.includes(',EUR,'));
});

test('an empty ledger is just the header', () => {
  assert.equal(bookingsCsv([]).split('\r\n').length, 1);
});
