// =============================================================================
//  lib/repo.ts
// =============================================================================
//
//  Every read and write the console makes. Ownership is enforced HERE, in the
//  query, not by the caller remembering to check.
//
//  The pattern that matters: a write is always filtered by operator_id as well
//  as by id. So a forged trip id belonging to another operator patches zero
//  rows and returns null, rather than succeeding because the caller forgot a
//  guard. Fails closed by construction.
//
//  The service role bypasses RLS, which is exactly why this file has to be
//  careful. Nothing else in the app talks to the database directly.
//
// =============================================================================

import 'server-only';
import { sbRequest, sbInsert, sbUpdate } from './supabase.ts';
import { slugify } from './validate.ts';
import type { TripInput, DepartureInput } from './validate.ts';
import type { Operator, Trip, Departure, TripStatus } from './types.ts';
import type { Session } from './auth.ts';

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
//  Operators
// ---------------------------------------------------------------------------

/**
 * Find the operator for a signed-in session, creating one on first visit.
 *
 * Keyed on the CLIENT record, never the user's email: a trip belongs to the
 * business, not to whoever happened to set it up. Two staff at the same agency
 * must land on the same operator.
 */
export async function ensureOperator(session: Session): Promise<Operator | null> {
  if (!session.clientRecordId) return null;

  const existing = await sbRequest<Operator[]>(
    `gt_operators?client_record_id=eq.${encodeURIComponent(session.clientRecordId)}&select=*&limit=1`,
  );
  if (existing?.[0]) return existing[0];

  const name = session.clientName || session.email || 'Operator';
  const slug = await uniqueOperatorSlug(slugify(name) || 'operator');

  const created = await sbInsert<Operator>('gt_operators', {
    client_record_id: session.clientRecordId,
    name,
    slug,
    contact_email: session.email || '',
  });
  return created[0] ?? null;
}

async function uniqueOperatorSlug(base: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const clash = await sbRequest<Array<{ id: string }>>(
      `gt_operators?slug=eq.${encodeURIComponent(candidate)}&select=id&limit=1`,
    );
    if (!clash?.length) return candidate;
  }
  // 50 collisions on one name is not a real situation, but returning something
  // unique beats throwing at the end of a sign-in.
  return `${base}-${Date.now().toString(36)}`;
}

export async function getOperatorBySlug(slug: string): Promise<Operator | null> {
  const rows = await sbRequest<Operator[]>(
    `gt_operators?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
  );
  return rows?.[0] ?? null;
}

// ---------------------------------------------------------------------------
//  Trips
// ---------------------------------------------------------------------------

export async function listTrips(operatorId: string): Promise<Trip[]> {
  return (
    (await sbRequest<Trip[]>(
      `gt_trips?operator_id=eq.${operatorId}&status=neq.archived&select=*&order=created_at.desc`,
    )) ?? []
  );
}

/** Null when the trip does not exist OR belongs to someone else. Deliberately
 *  indistinguishable: a caller must not be able to probe for other operators'
 *  trip ids by watching which error comes back. */
export async function getTripOwned(tripId: string, operatorId: string): Promise<Trip | null> {
  if (!isUuid(tripId)) return null;
  const rows = await sbRequest<Trip[]>(
    `gt_trips?id=eq.${tripId}&operator_id=eq.${operatorId}&select=*&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function createTrip(operatorId: string, input: TripInput): Promise<Trip | null> {
  const slug = await uniqueTripSlug(operatorId, input.slug);
  const rows = await sbInsert<Trip>('gt_trips', { ...input, slug, operator_id: operatorId });
  return rows[0] ?? null;
}

export async function updateTrip(
  tripId: string,
  operatorId: string,
  input: TripInput,
): Promise<Trip | null> {
  if (!isUuid(tripId)) return null;

  // Re-check the slug only when it actually changed, so saving an unchanged
  // form does not quietly rename the trip to my-trip-2.
  const current = await getTripOwned(tripId, operatorId);
  if (!current) return null;

  const slug =
    input.slug === current.slug ? current.slug : await uniqueTripSlug(operatorId, input.slug, tripId);

  const rows = await sbUpdate<Trip>(
    'gt_trips',
    `id=eq.${tripId}&operator_id=eq.${operatorId}`,
    { ...input, slug, updated_at: nowIso() },
  );
  return rows[0] ?? null;
}

export async function setTripStatus(
  tripId: string,
  operatorId: string,
  status: TripStatus,
): Promise<Trip | null> {
  if (!isUuid(tripId)) return null;
  const rows = await sbUpdate<Trip>(
    'gt_trips',
    `id=eq.${tripId}&operator_id=eq.${operatorId}`,
    { status, updated_at: nowIso() },
  );
  return rows[0] ?? null;
}

async function uniqueTripSlug(operatorId: string, base: string, exceptId?: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const clash = await sbRequest<Array<{ id: string }>>(
      `gt_trips?operator_id=eq.${operatorId}&slug=eq.${encodeURIComponent(candidate)}&select=id&limit=1`,
    );
    const taken = clash?.[0] && clash[0].id !== exceptId;
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** The public read. Published trips only, so an unfinished draft is never
 *  reachable by guessing its URL. */
export async function getPublishedTrip(
  operatorSlug: string,
  tripSlug: string,
): Promise<{ operator: Operator; trip: Trip } | null> {
  const operator = await getOperatorBySlug(operatorSlug);
  if (!operator) return null;

  const rows = await sbRequest<Trip[]>(
    `gt_trips?operator_id=eq.${operator.id}&slug=eq.${encodeURIComponent(tripSlug)}` +
      `&status=eq.published&select=*&limit=1`,
  );
  const trip = rows?.[0];
  return trip ? { operator, trip } : null;
}

// ---------------------------------------------------------------------------
//  Departures
// ---------------------------------------------------------------------------

export async function listDepartures(tripId: string): Promise<Departure[]> {
  if (!isUuid(tripId)) return [];
  return (
    (await sbRequest<Departure[]>(
      `gt_departures?trip_id=eq.${tripId}&select=*&order=starts_on.asc`,
    )) ?? []
  );
}

export async function listOpenDepartures(tripId: string): Promise<Departure[]> {
  if (!isUuid(tripId)) return [];
  return (
    (await sbRequest<Departure[]>(
      `gt_departures?trip_id=eq.${tripId}&status=eq.open&select=*&order=starts_on.asc`,
    )) ?? []
  );
}

export async function createDeparture(
  tripId: string,
  operatorId: string,
  input: DepartureInput,
): Promise<Departure | null> {
  // Ownership is checked on the TRIP, because a departure has no operator of
  // its own. Without this, a valid departure payload with someone else's trip
  // id would attach to their trip.
  if (!(await getTripOwned(tripId, operatorId))) return null;

  const rows = await sbInsert<Departure>('gt_departures', { ...input, trip_id: tripId });
  return rows[0] ?? null;
}

export async function updateDeparture(
  departureId: string,
  tripId: string,
  operatorId: string,
  input: DepartureInput,
): Promise<Departure | null> {
  if (!isUuid(departureId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;

  const rows = await sbUpdate<Departure>(
    'gt_departures',
    `id=eq.${departureId}&trip_id=eq.${tripId}`,
    { ...input, updated_at: nowIso() },
  );
  return rows[0] ?? null;
}

/**
 * Cancel rather than delete when a departure has bookings against it. Deleting
 * would cascade nothing (bookings only reference it), but it would orphan real
 * travellers' bookings from their dates, which is worse than a tidy list.
 */
export async function removeDeparture(
  departureId: string,
  tripId: string,
  operatorId: string,
): Promise<'deleted' | 'cancelled' | null> {
  if (!isUuid(departureId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;

  const booked = await sbRequest<Array<{ id: string }>>(
    `gt_bookings?departure_id=eq.${departureId}&status=in.(pending,deposit_paid,paid)&select=id&limit=1`,
  );

  if (booked?.length) {
    await sbUpdate('gt_departures', `id=eq.${departureId}&trip_id=eq.${tripId}`, {
      status: 'cancelled',
      updated_at: nowIso(),
    });
    return 'cancelled';
  }

  await sbRequest(`gt_departures?id=eq.${departureId}&trip_id=eq.${tripId}`, { method: 'DELETE' });
  return 'deleted';
}

// ---------------------------------------------------------------------------
//  Bookings — the read side (the console). Ownership is on operator_id, and
//  traveller PII only ever leaves through these operator-gated reads.
// ---------------------------------------------------------------------------

export interface BookingRow {
  id: string;
  reference: string | null;
  status: string;
  party_size: number;
  total_pence: number | null;
  deposit_pence: number | null;
  balance_pence: number | null;
  currency: string;
  departure_id: string | null;
  hold_expires_at: string | null;
  created_at: string;
  traveller_name: string | null;
  traveller_email: string | null;
}

export interface BookingWithTravellers extends BookingRow {
  travellers: Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; is_lead: boolean }>;
}

/** The operator's bookings, newest first, scoped to them. Never another
 *  operator's, because the filter is on operator_id and the id is theirs. */
export async function listBookings(operatorId: string, limit = 100): Promise<BookingRow[]> {
  return (
    (await sbRequest<BookingRow[]>(
      `gt_bookings?operator_id=eq.${operatorId}&select=*&order=created_at.desc&limit=${limit}`,
    )) ?? []
  );
}

/** The manifest for one departure: who is coming, party sizes, status. Gated
 *  on the departure belonging to this operator, so a guessed departure id
 *  returns null rather than someone else's travellers. */
export async function getDepartureManifest(
  departureId: string,
  operatorId: string,
): Promise<{ bookings: BookingWithTravellers[] } | null> {
  if (!isUuid(departureId)) return null;

  // Confirm the departure is this operator's, via its trip. One join, so a
  // forged departure id from another operator cannot reach their travellers.
  const owned = await sbRequest<Array<{ id: string }>>(
    `gt_departures?id=eq.${departureId}&select=id,gt_trips!inner(operator_id)` +
      `&gt_trips.operator_id=eq.${operatorId}&limit=1`,
  ).catch(() => null);
  if (!owned?.length) return null;

  const rows =
    (await sbRequest<BookingWithTravellers[]>(
      `gt_bookings?departure_id=eq.${departureId}&operator_id=eq.${operatorId}` +
        `&select=*,travellers:gt_travellers(id,full_name,email,phone,is_lead)` +
        `&order=created_at.asc`,
    ).catch(() => null)) ?? [];

  return { bookings: rows };
}

/** Look up one booking the operator owns, with its full party. Used by the
 *  console booking detail and, later, refunds and amendments. */
export async function getBookingOwned(
  bookingId: string,
  operatorId: string,
): Promise<BookingWithTravellers | null> {
  if (!isUuid(bookingId)) return null;
  const rows = await sbRequest<BookingWithTravellers[]>(
    `gt_bookings?id=eq.${bookingId}&operator_id=eq.${operatorId}` +
      `&select=*,travellers:gt_travellers(id,full_name,email,phone,is_lead)&limit=1`,
  ).catch(() => null);
  return rows?.[0] ?? null;
}


// ---------------------------------------------------------------------------

/** PostgREST will happily accept a malformed uuid and error at the database.
 *  Checking here turns that into a clean null instead of a 400 mid-render. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}
