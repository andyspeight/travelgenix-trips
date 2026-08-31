// =============================================================================
//  lib/finance.ts — the bookings ledger export
// =============================================================================
//  A finance-focused CSV of an operator's bookings, for import into accounting
//  software or their own records. Pure, so the money rules and the CSV shaping
//  are unit-tested without a database. The collected / outstanding model matches
//  the Manage Trip and Reports screens exactly, so the ledger reconciles with
//  what the operator sees on screen.
// =============================================================================

import { csvField } from './participants.ts';

/** Statuses that represent real, countable money on the books. */
const LIVE = new Set(['pending', 'deposit_paid', 'paid']);

/** What has actually been collected on a booking: the full total once paid, the
 *  deposit once the deposit is paid, nothing while only held or if it fell away. */
export function bookingCollected(status: string, totalPence: number, depositPence: number): number {
  if (status === 'paid') return totalPence;
  if (status === 'deposit_paid') return depositPence;
  return 0;
}

/** What is still owed. Nothing is owed on a cancelled or expired booking. */
export function bookingOutstanding(status: string, totalPence: number, depositPence: number): number {
  if (!LIVE.has(status)) return 0;
  return Math.max(0, totalPence - bookingCollected(status, totalPence, depositPence));
}

export interface BookingFinanceRow {
  reference: string;
  trip: string;
  buyer: string;
  email: string;
  dates: string;
  party: number;
  room: string;
  promo: string;
  status: string;
  currency: string;
  total_pence: number;
  deposit_pence: number;
  booked_on: string; // YYYY-MM-DD
}

/** Pence to a plain decimal string an accounting import understands: 370000 -> "3700.00". */
export function poundsAmount(pence: number): string {
  return (Math.round(pence) / 100).toFixed(2);
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full',
  cancelled: 'Cancelled', expired: 'Expired',
};

/** The ledger. One row per booking, amounts as plain decimals plus a currency
 *  column, so it drops into QuickBooks, Xero or a spreadsheet. RFC 4180 quoting
 *  via csvField, CRLF line endings. */
export function bookingsCsv(rows: BookingFinanceRow[]): string {
  const header = [
    'Reference', 'Trip', 'Booked by', 'Email', 'Dates', 'Travellers', 'Room', 'Promo',
    'Status', 'Currency', 'Total', 'Deposit', 'Collected', 'Outstanding', 'Booked on',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    const collected = bookingCollected(r.status, r.total_pence, r.deposit_pence);
    const outstanding = bookingOutstanding(r.status, r.total_pence, r.deposit_pence);
    lines.push([
      csvField(r.reference),
      csvField(r.trip),
      csvField(r.buyer),
      csvField(r.email),
      csvField(r.dates),
      String(r.party),
      csvField(r.room),
      csvField(r.promo),
      csvField(STATUS_LABEL[r.status] ?? r.status),
      csvField(r.currency.toUpperCase()),
      poundsAmount(r.total_pence),
      poundsAmount(r.deposit_pence),
      poundsAmount(collected),
      poundsAmount(outstanding),
      csvField(r.booked_on),
    ].join(','));
  }
  return lines.join('\r\n');
}
