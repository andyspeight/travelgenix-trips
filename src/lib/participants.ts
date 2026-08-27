// =============================================================================
//  lib/participants.ts — flatten a trip's bookings into a participant list
// =============================================================================
//  Shared by the Manage Trip screen and the CSV export, so what an operator
//  sees and what they download are the same rows. Pure; no database.
// =============================================================================

import type { TripBooking } from './repo.ts';

export interface ParticipantRow {
  name: string;
  isLead: boolean;
  buyer: string;
  room: string | null;
  dates: string;
  status: string;
}

/** One row per named traveller across the trip's live bookings. */
export function participantRows(bookings: TripBooking[]): ParticipantRow[] {
  const out: ParticipantRow[] = [];
  for (const b of bookings) {
    if (b.status === 'cancelled' || b.status === 'expired') continue;
    const dates = b.starts_on ? shortRange(b.starts_on, b.ends_on) : '';
    for (const t of b.travellers || []) {
      const name = (t.full_name ?? '').trim();
      if (!name) continue;
      out.push({
        name, isLead: !!t.is_lead, buyer: b.traveller_name ?? '',
        room: b.package_name, dates, status: b.status,
      });
    }
  }
  return out;
}

export function shortRange(a: string, b: string | null): string {
  try {
    const s = new Date(`${a}T00:00:00Z`);
    const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'short' };
    if (!b) return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
    const e = new Date(`${b}T00:00:00Z`);
    return `${s.toLocaleDateString('en-GB', opts)} to ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  } catch { return ''; }
}

/** RFC 4180 field: quote when it contains a comma, quote or newline. */
export function csvField(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full',
  cancelled: 'Cancelled', expired: 'Expired',
};

export function participantsCsv(bookings: TripBooking[]): string {
  const header = ['Traveller', 'Lead', 'Booked by', 'Room', 'Dates', 'Status'];
  const lines = [header.join(',')];
  for (const p of participantRows(bookings)) {
    lines.push([
      csvField(p.name),
      p.isLead ? 'yes' : '',
      csvField(p.buyer),
      csvField(p.room ?? ''),
      csvField(p.dates),
      csvField(STATUS_LABEL[p.status] ?? p.status),
    ].join(','));
  }
  return lines.join('\r\n');
}
