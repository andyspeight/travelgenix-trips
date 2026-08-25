// =============================================================================
//  lib/availability.ts
// =============================================================================
//
//  Counts only, for a whole page of departures in ONE query rather than one per
//  departure. A trip with twenty dates costs a single read.
//
//  Fails calm: on any error it returns an empty map, so the page renders with
//  no places-left line rather than a wrong number or an error. That is the same
//  behaviour /api/trip-availability has always had.
//
// =============================================================================

import 'server-only';
import { sbRequest } from './supabase.ts';
import { summarise, COUNTING_STATUSES, type CountableBooking, type Availability } from './capacity.ts';
import type { Departure } from './types.ts';

export async function availabilityByDeparture(
  departures: Departure[],
): Promise<Map<string, Availability>> {
  const out = new Map<string, Availability>();
  if (departures.length === 0) return out;

  const ids = departures.map((d) => d.id).join(',');
  const statuses = COUNTING_STATUSES.join(',');

  const rows = await sbRequest<Array<CountableBooking & { departure_id: string }>>(
    `gt_bookings?departure_id=in.(${ids})&status=in.(${statuses})` +
      `&select=departure_id,party_size,status,hold_expires_at`,
  ).catch(() => null);

  if (!rows) return out;

  const grouped = new Map<string, CountableBooking[]>();
  for (const row of rows) {
    const list = grouped.get(row.departure_id);
    if (list) list.push(row);
    else grouped.set(row.departure_id, [row]);
  }

  const now = Date.now();
  for (const d of departures) {
    out.set(d.id, summarise(d.capacity, grouped.get(d.id) ?? [], now));
  }
  return out;
}
