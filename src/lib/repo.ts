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
import { sbRequest, sbInsert, sbUpdate, SupabaseError } from './supabase.ts';
import { slugify } from './validate.ts';
import { format as fmtMoney } from './money.ts';
import type { TripInput, DepartureInput, PackageInput, WaitlistInput, PromoInput, OptionInput } from './validate.ts';
import { newReference } from './booking.ts';
import { holdPlaces, type HoldRequest, type HoldOutcome, type HeldBooking, type RpcResult } from './hold.ts';
import { sha256Hex, isRegistrationComplete, type WaiverInput, type ValidatedRegistration } from './registration.ts';
import { sendEmail } from './notify.ts';
import type { Operator, OperatorBrand, Trip, Departure, TripStatus, Traveller, FormRow, Waiver, RegField, Package, WaitlistEntry, MessageTemplate, TripMessage, PromoCode, TripOption, SelectedOption, TripDocument } from './types.ts';
import { deleteDocument } from './storage.ts';
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
  // Preview review mode acts as the first operator, so the console shows real
  // content without a real sign-in. Only reachable on a non-production host.
  if (session.preview) {
    const rows = await sbRequest<Operator[]>('gt_operators?select=*&order=created_at.asc&limit=1');
    return rows?.[0] ?? null;
  }
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

/** By id, for callers (registration, the manifest) that only have the id and
 *  need the operator's brand. */
export async function getOperatorById(id: string): Promise<Operator | null> {
  if (!isUuid(id)) return null;
  const rows = await sbRequest<Operator[]>(`gt_operators?id=eq.${id}&select=*&limit=1`).catch(() => null);
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

export async function updateTripContent(
  tripId: string,
  operatorId: string,
  content: unknown,
): Promise<Trip | null> {
  if (!isUuid(tripId)) return null;
  const rows = await sbUpdate<Trip>(
    'gt_trips',
    `id=eq.${tripId}&operator_id=eq.${operatorId}`,
    { content, updated_at: nowIso() },
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
//  Packages — room types and occupancy tiers (phase 5). Public to read (they
//  are shown on the trip page and the booking form); operator-gated to write.
// ---------------------------------------------------------------------------

export async function listPackages(tripId: string): Promise<Package[]> {
  if (!isUuid(tripId)) return [];
  return (
    (await sbRequest<Package[]>(
      `gt_packages?trip_id=eq.${tripId}&select=*&order=sort_order.asc,created_at.asc`,
    )) ?? []
  );
}

/** Operator-gated list for the editor: empty for a trip that is not theirs. */
export async function getPackagesForTrip(tripId: string, operatorId: string): Promise<Package[]> {
  if (!(await getTripOwned(tripId, operatorId))) return [];
  return listPackages(tripId);
}

export async function createPackage(
  tripId: string,
  operatorId: string,
  input: PackageInput,
): Promise<Package | null> {
  if (!(await getTripOwned(tripId, operatorId))) return null;
  const rows = await sbInsert<Package>('gt_packages', { ...input, trip_id: tripId });
  return rows[0] ?? null;
}

export async function updatePackage(
  packageId: string,
  tripId: string,
  operatorId: string,
  input: PackageInput,
): Promise<Package | null> {
  if (!isUuid(packageId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;
  const rows = await sbUpdate<Package>(
    'gt_packages',
    `id=eq.${packageId}&trip_id=eq.${tripId}`,
    { ...input, updated_at: nowIso() },
  );
  return rows[0] ?? null;
}

/**
 * Remove a package. If any booking chose it, we do NOT delete: that would erase
 * the record of what a real traveller booked. It is refused as 'in_use' so the
 * operator can see why. Only an unused package is actually deleted.
 */
export async function removePackage(
  packageId: string,
  tripId: string,
  operatorId: string,
): Promise<'deleted' | 'in_use' | null> {
  if (!isUuid(packageId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;

  const used = await sbRequest<Array<{ id: string }>>(
    `gt_bookings?package_id=eq.${packageId}&select=id&limit=1`,
  ).catch(() => null);
  if (used?.length) return 'in_use';

  await sbRequest(`gt_packages?id=eq.${packageId}&trip_id=eq.${tripId}`, { method: 'DELETE' });
  return 'deleted';
}

// ---------------------------------------------------------------------------
//  Options — priced add-ons and extras (phase 5). Public to read (they show on
//  the booking form); operator-gated to write. A booking records the extras it
//  chose as a self-contained jsonb snapshot, so an option can be deleted without
//  erasing the record of what a traveller booked.
// ---------------------------------------------------------------------------

export async function listOptions(tripId: string): Promise<TripOption[]> {
  if (!isUuid(tripId)) return [];
  return (
    (await sbRequest<TripOption[]>(
      `gt_options?trip_id=eq.${tripId}&select=*&order=sort_order.asc,created_at.asc`,
    )) ?? []
  );
}

/** Operator-gated list for the editor: empty for a trip that is not theirs. */
export async function getOptionsForTrip(tripId: string, operatorId: string): Promise<TripOption[]> {
  if (!(await getTripOwned(tripId, operatorId))) return [];
  return listOptions(tripId);
}

export async function createOption(
  tripId: string,
  operatorId: string,
  input: OptionInput,
): Promise<TripOption | null> {
  if (!(await getTripOwned(tripId, operatorId))) return null;
  const rows = await sbInsert<TripOption>('gt_options', { ...input, trip_id: tripId });
  return rows[0] ?? null;
}

export async function updateOption(
  optionId: string,
  tripId: string,
  operatorId: string,
  input: OptionInput,
): Promise<TripOption | null> {
  if (!isUuid(optionId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;
  const rows = await sbUpdate<TripOption>(
    'gt_options',
    `id=eq.${optionId}&trip_id=eq.${tripId}`,
    { ...input, updated_at: nowIso() },
  );
  return rows[0] ?? null;
}

/** Remove an option. Bookings keep their own snapshot of what they chose, so an
 *  option can be deleted outright without losing that record. */
export async function removeOption(
  optionId: string,
  tripId: string,
  operatorId: string,
): Promise<'deleted' | null> {
  if (!isUuid(optionId)) return null;
  if (!(await getTripOwned(tripId, operatorId))) return null;
  await sbRequest(`gt_options?id=eq.${optionId}&trip_id=eq.${tripId}`, { method: 'DELETE' });
  return 'deleted';
}

// ---------------------------------------------------------------------------
//  Documents — passport / ID / insurance in the private bucket (P1). The write
//  path is reachable by a traveller holding the booking reference (the same
//  bearer token as /register); the read path is operator-gated. The file itself
//  lives in storage.ts; these are only the database rows and the ownership
//  checks that decide who may attach or read one.
// ---------------------------------------------------------------------------

/** What a document upload resolves to once the reference, field and traveller
 *  are checked. Null from getDocumentTarget means "not allowed", so a forged
 *  reference or a field that is not a document field can attach nothing. */
export interface DocumentTarget {
  bookingId: string;
  operatorId: string;
  tripId: string;
  travellerId: string | null;
  fieldKey: string;
}

/**
 * Resolve and authorise a document upload. The reference must name a live
 * booking, the field must be a real 'document' field on that trip's form, and a
 * per-traveller document must name a traveller who actually belongs to the
 * booking. A booking-wide document field takes no traveller.
 */
export async function getDocumentTarget(
  reference: string,
  fieldKey: string,
  travellerId: string | null,
): Promise<DocumentTarget | null> {
  const ref = String(reference || '');
  const key = String(fieldKey || '').replace(/[^a-z0-9_]/gi, '').slice(0, 24);
  if (!ref || !key) return null;

  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_bookings?reference=eq.${encodeURIComponent(ref)}` +
      `&select=id,status,operator_id,departure:gt_departures(trip:gt_trips(id))&limit=1`,
  ).catch(() => null);
  const r = rows?.[0];
  if (!r) return null;

  const status = String(r.status);
  if (status === 'expired' || status === 'cancelled') return null;

  const operatorId = (r.operator_id as string) ?? '';
  const dep = (r.departure ?? {}) as Record<string, unknown>;
  const trip = (dep.trip ?? {}) as Record<string, unknown>;
  const tripId = String(trip.id ?? '');
  if (!isUuid(operatorId) || !isUuid(tripId)) return null;

  const form = await formByTrip(tripId);
  const field = form?.schema.find((f) => f.key === key && f.type === 'document');
  if (!field) return null;

  let resolvedTraveller: string | null = null;
  if (field.scope === 'traveller') {
    // A per-traveller document needs a traveller who belongs to THIS booking.
    if (!isUuid(travellerId ?? '')) return null;
    const owned = await sbRequest<Array<{ id: string }>>(
      `gt_travellers?id=eq.${travellerId}&booking_id=eq.${r.id}&select=id&limit=1`,
    ).catch(() => null);
    if (!owned?.length) return null;
    resolvedTraveller = String(travellerId);
  }

  return {
    bookingId: String(r.id),
    operatorId,
    tripId,
    travellerId: resolvedTraveller,
    fieldKey: key,
  };
}

/**
 * Record an uploaded document, replacing any earlier one for the same field and
 * traveller so a re-upload supersedes rather than piling up. The superseded
 * file is removed from storage best-effort; a stray object in a private bucket
 * is inert.
 */
export async function recordDocument(input: {
  target: DocumentTarget;
  filePath: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
}): Promise<TripDocument | null> {
  const { target } = input;

  const travellerFilter = target.travellerId
    ? `traveller_id=eq.${target.travellerId}`
    : 'traveller_id=is.null';
  const prior = await sbRequest<TripDocument[]>(
    `gt_documents?booking_id=eq.${target.bookingId}&field_key=eq.${encodeURIComponent(target.fieldKey)}&${travellerFilter}&select=*`,
  ).catch(() => null);

  const rows = await sbInsert<TripDocument>('gt_documents', {
    operator_id: target.operatorId,
    booking_id: target.bookingId,
    trip_id: target.tripId,
    traveller_id: target.travellerId,
    field_key: target.fieldKey,
    file_path: input.filePath,
    file_name: input.fileName,
    content_type: input.contentType,
    size_bytes: input.sizeBytes,
  });
  const saved = rows[0] ?? null;
  if (!saved) return null;

  // Only now that the new row is in, drop the old ones and their objects.
  for (const p of prior ?? []) {
    if (p.id === saved.id) continue;
    await sbRequest(`gt_documents?id=eq.${p.id}`, { method: 'DELETE' }).catch(() => null);
    if (p.file_path && p.file_path !== saved.file_path) await deleteDocument(p.file_path);
  }
  return saved;
}

/** Every document on a booking, for completeness, the operator view, and the
 *  register page's "already uploaded" state. */
export async function listDocumentsForBooking(bookingId: string): Promise<TripDocument[]> {
  if (!isUuid(bookingId)) return [];
  return (
    (await sbRequest<TripDocument[]>(
      `gt_documents?booking_id=eq.${bookingId}&select=*&order=uploaded_at.desc`,
    ).catch(() => null)) ?? []
  );
}

/** One document, only if it belongs to this operator. The signed-URL view route
 *  gates on this, so a guessed id cannot read another operator's document. */
export async function getDocumentForOperator(documentId: string, operatorId: string): Promise<TripDocument | null> {
  if (!isUuid(documentId)) return null;
  const rows = await sbRequest<TripDocument[]>(
    `gt_documents?id=eq.${documentId}&operator_id=eq.${operatorId}&select=*&limit=1`,
  ).catch(() => null);
  return rows?.[0] ?? null;
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
  package_id: string | null;
  hold_expires_at: string | null;
  created_at: string;
  traveller_name: string | null;
  traveller_email: string | null;
  /** How many traveller rows carry a name, for a cheap "3 of 4 added" signal on
   *  the list. Full registration completeness is computed on the detail page. */
  travellers_named?: number;
}

export interface BookingWithTravellers extends BookingRow {
  travellers: Array<{ id: string; full_name: string | null; email: string | null; phone: string | null; date_of_birth: string | null; is_lead: boolean }>;
}

/** The operator's bookings, newest first, scoped to them. Never another
 *  operator's, because the filter is on operator_id and the id is theirs. */
export async function listBookings(operatorId: string, limit = 100): Promise<BookingRow[]> {
  // One query: embed just the traveller names (not the rest of the PII) so the
  // list can show "3 of 4 added" without a query per row.
  const rows = (await sbRequest<Array<BookingRow & { travellers?: Array<{ full_name: string | null }> }>>(
    `gt_bookings?operator_id=eq.${operatorId}` +
      `&select=*,travellers:gt_travellers(full_name)` +
      `&order=created_at.desc&limit=${limit}`,
  )) ?? [];
  return rows.map(({ travellers, ...r }) => ({
    ...r,
    travellers_named: (travellers ?? []).filter((t) => (t.full_name ?? '').trim()).length,
  }));
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
        `&select=*,travellers:gt_travellers(id,full_name,email,phone,date_of_birth,is_lead)` +
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
      `&select=*,travellers:gt_travellers(id,full_name,email,phone,date_of_birth,is_lead)&limit=1`,
  ).catch(() => null);
  return rows?.[0] ?? null;
}


// ---------------------------------------------------------------------------
//  Taking a hold — the write path. The atomic decision is the gt_hold_places
//  Postgres function; this wires the real transports into the tested caller.
// ---------------------------------------------------------------------------

/** Reserve places on a departure, atomically. Never oversells: the database
 *  function is the authority, this only orchestrates retries and the
 *  ambiguous-failure probe. */
export async function takeHold(req: HoldRequest): Promise<HoldOutcome> {
  return holdPlaces(
    {
      callRpc: async (args) => {
        // PostgREST returns a returns-jsonb function's value directly.
        const out = await sbRequest<RpcResult>('rpc/gt_hold_places', { method: 'POST', body: args });
        return (out ?? { ok: false, reason: 'error' }) as RpcResult;
      },
      probeByReference: async (reference) => {
        // Deliberately NOT wrapped in .catch: hold.ts must distinguish a probe
        // that found no row (safe to retry) from a probe that FAILED (unknown,
        // must not retry the insert). A throw here means 'unknown'.
        const rows = await sbRequest<Array<{ id: string; reference: string; hold_expires_at: string | null }>>(
          `gt_bookings?reference=eq.${encodeURIComponent(reference)}&select=id,reference,hold_expires_at&limit=1`,
        );
        const r = rows?.[0];
        return r ? { id: r.id, reference: r.reference, holdExpiresAt: r.hold_expires_at, remaining: null } : null;
      },
      mintReference: newReference,
      sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
      jitter: () => Math.random(),
    },
    req,
  );
}

/** A traveller's own confirmation, looked up by the reference they hold. Bearer
 *  -token style: whoever has the reference can see the booking, exactly as a
 *  confirmation link works. Returns only what a confirmation needs, joined to
 *  the trip and operator for display. Never lists the whole party. */
export interface Confirmation {
  reference: string;
  status: string;
  party_size: number;
  total_pence: number | null;
  deposit_pence: number | null;
  currency: string;
  hold_expires_at: string | null;
  traveller_name: string | null;
  traveller_email: string | null;
  trip_title: string;
  operator_name: string;
  starts_on: string | null;
  ends_on: string | null;
  package_name: string | null;
  promo_code: string | null;
  selected_options: SelectedOption[];
}

export async function getConfirmation(reference: string): Promise<Confirmation | null> {
  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_bookings?reference=eq.${encodeURIComponent(reference)}` +
      `&select=reference,status,party_size,total_pence,deposit_pence,currency,hold_expires_at,` +
      `traveller_name,traveller_email,selected_options,package:gt_packages(name),promo:gt_promo_codes(code),` +
      `departure:gt_departures(starts_on,ends_on,trip:gt_trips(title,operator:gt_operators(name)))&limit=1`,
  ).catch(() => null);

  const r = rows?.[0];
  if (!r) return null;

  const dep = (r.departure ?? {}) as Record<string, unknown>;
  const trip = (dep.trip ?? {}) as Record<string, unknown>;
  const op = (trip.operator ?? {}) as Record<string, unknown>;
  const pkg = (r.package ?? null) as Record<string, unknown> | null;
  const promo = (r.promo ?? null) as Record<string, unknown> | null;

  return {
    reference: String(r.reference),
    status: String(r.status),
    party_size: Number(r.party_size),
    total_pence: (r.total_pence as number) ?? null,
    deposit_pence: (r.deposit_pence as number) ?? null,
    currency: String(r.currency ?? 'gbp'),
    hold_expires_at: (r.hold_expires_at as string) ?? null,
    traveller_name: (r.traveller_name as string) ?? null,
    traveller_email: (r.traveller_email as string) ?? null,
    trip_title: String(trip.title ?? 'your trip'),
    operator_name: String(op.name ?? 'the operator'),
    starts_on: (dep.starts_on as string) ?? null,
    ends_on: (dep.ends_on as string) ?? null,
    package_name: pkg?.name ? String(pkg.name) : null,
    promo_code: promo?.code ? String(promo.code) : null,
    selected_options: asSelectedOptions(r.selected_options),
  };
}

/** Coerce the booking's selected_options jsonb into typed rows, defensively:
 *  a legacy booking has '[]', and a hand-edited row must never crash a render. */
function asSelectedOptions(raw: unknown): SelectedOption[] {
  if (!Array.isArray(raw)) return [];
  const out: SelectedOption[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : '';
    const amount = Number(o.amount_pence);
    if (!name || !Number.isFinite(amount)) continue;
    out.push({
      option_id: typeof o.option_id === 'string' ? o.option_id : '',
      name,
      per: o.per === 'booking' ? 'booking' : 'traveller',
      unit_pence: Number.isFinite(Number(o.unit_pence)) ? Number(o.unit_pence) : 0,
      quantity: Number.isFinite(Number(o.quantity)) ? Number(o.quantity) : 1,
      amount_pence: amount,
    });
  }
  return out;
}


// ---------------------------------------------------------------------------
//  Phase 4 — the people. Custom forms, waivers, and traveller registration.
//
//  Two trust models meet here. The operator-facing reads/writes are gated on
//  operator_id through the owning trip, exactly like the rest of this file. The
//  traveller-facing registration is gated on the booking REFERENCE instead: it
//  is the same bearer token the confirmation page uses, and every id the browser
//  sends is re-resolved against the booking the reference names, never trusted.
// ---------------------------------------------------------------------------

/** One custom form per trip. Read without an ownership check because callers on
 *  both sides (the operator editor, and registration via the booking) have
 *  already established their right to the trip. */
async function formByTrip(tripId: string): Promise<FormRow | null> {
  if (!isUuid(tripId)) return null;
  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_forms?trip_id=eq.${tripId}&select=id,trip_id,name,schema&order=created_at.asc&limit=1`,
  ).catch(() => null);
  const r = rows?.[0];
  if (!r) return null;
  return {
    id: String(r.id), trip_id: String(r.trip_id), name: String(r.name ?? 'Registration'),
    schema: Array.isArray(r.schema) ? (r.schema as RegField[]) : [],
  };
}

/** The current (highest-version) waiver for a trip, or null. */
async function waiverByTrip(tripId: string): Promise<Waiver | null> {
  if (!isUuid(tripId)) return null;
  const rows = await sbRequest<Waiver[]>(
    `gt_waivers?trip_id=eq.${tripId}&select=*&order=version.desc&limit=1`,
  ).catch(() => null);
  return rows?.[0] ?? null;
}

/** Operator-gated reads for the trip editor. */
export async function getFormForTrip(tripId: string, operatorId: string): Promise<FormRow | null> {
  if (!(await getTripOwned(tripId, operatorId))) return null;
  return formByTrip(tripId);
}

export async function getWaiverForTrip(tripId: string, operatorId: string): Promise<Waiver | null> {
  if (!(await getTripOwned(tripId, operatorId))) return null;
  return waiverByTrip(tripId);
}

/** Save the trip's custom form. An empty schema removes the form. Ownership is
 *  on the trip, so a forged trip id writes nothing. */
export async function saveForm(tripId: string, operatorId: string, schema: RegField[]): Promise<boolean> {
  if (!(await getTripOwned(tripId, operatorId))) return false;
  const existing = await formByTrip(tripId);

  if (schema.length === 0) {
    if (existing) await sbRequest(`gt_forms?id=eq.${existing.id}`, { method: 'DELETE' });
    return true;
  }

  if (existing) {
    await sbUpdate('gt_forms', `id=eq.${existing.id}`, { schema, updated_at: nowIso() });
  } else {
    await sbInsert('gt_forms', { trip_id: tripId, name: 'Registration', schema });
  }
  return true;
}

async function waiverSignatureCount(waiverId: string): Promise<number> {
  const rows = await sbRequest<Array<{ id: string }>>(
    `gt_signatures?waiver_id=eq.${waiverId}&select=id&limit=1`,
  ).catch(() => null);
  return rows?.length ?? 0;
}

/**
 * Save the trip's waiver. Versioning protects what people signed:
 *   - no waiver yet          -> create version 1
 *   - body unchanged         -> patch title / mandatory on the current row
 *   - body changed, unsigned -> edit the current row in place (no version churn
 *                               while it is still being written)
 *   - body changed, signed   -> a NEW version, so the signed text is never
 *                               rewritten under a signature
 * An empty body removes an UNSIGNED waiver; a signed one cannot be un-said, so
 * it is left in place.
 */
export async function saveWaiver(
  tripId: string,
  operatorId: string,
  input: WaiverInput | null,
): Promise<boolean> {
  if (!(await getTripOwned(tripId, operatorId))) return false;
  const current = await waiverByTrip(tripId);

  if (!input) {
    if (current && (await waiverSignatureCount(current.id)) === 0) {
      await sbRequest(`gt_waivers?id=eq.${current.id}`, { method: 'DELETE' });
    }
    return true;
  }

  if (!current) {
    await sbInsert('gt_waivers', {
      operator_id: operatorId, trip_id: tripId,
      title: input.title, body: input.body, version: 1, is_mandatory: input.is_mandatory,
    });
    return true;
  }

  const bodyChanged = current.body !== input.body;
  if (bodyChanged && (await waiverSignatureCount(current.id)) > 0) {
    await sbInsert('gt_waivers', {
      operator_id: operatorId, trip_id: tripId,
      title: input.title, body: input.body, version: current.version + 1, is_mandatory: input.is_mandatory,
    });
  } else {
    await sbUpdate('gt_waivers', `id=eq.${current.id}`, {
      title: input.title, body: input.body, is_mandatory: input.is_mandatory,
    });
  }
  return true;
}

// --- traveller-facing registration, gated on the booking reference ----------

export interface RegistrationContext {
  booking: {
    id: string; reference: string; status: string; party_size: number; currency: string;
    operator_id: string | null; trip_id: string;
    trip_title: string; operator_name: string;
    starts_on: string | null; ends_on: string | null;
  };
  travellers: Traveller[];
  form: FormRow | null;
  waiver: Waiver | null;
  /** Prefill and completion inputs, as plain arrays for the client boundary. */
  responses: Array<{ traveller_id: string | null; answers: Record<string, string> }>;
  signatures: Array<{ traveller_id: string | null }>;
  /** Documents already uploaded, so the form shows "uploaded" and offers a
   *  replace rather than pretending nothing is there. */
  documents: Array<{ id: string; traveller_id: string | null; field_key: string; file_name: string }>;
}

/** Everything the registration page (and the operator manifest) needs, resolved
 *  from a booking reference. Never lists another booking: every follow-up query
 *  is scoped to the one booking the reference names. */
export async function getRegistrationContext(reference: string): Promise<RegistrationContext | null> {
  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_bookings?reference=eq.${encodeURIComponent(reference)}` +
      `&select=id,reference,status,party_size,currency,operator_id,` +
      `departure:gt_departures(starts_on,ends_on,trip:gt_trips(id,title,operator:gt_operators(name)))&limit=1`,
  ).catch(() => null);

  const r = rows?.[0];
  if (!r) return null;

  const dep = (r.departure ?? {}) as Record<string, unknown>;
  const trip = (dep.trip ?? {}) as Record<string, unknown>;
  const op = (trip.operator ?? {}) as Record<string, unknown>;
  const tripId = String(trip.id ?? '');
  if (!isUuid(tripId)) return null;

  const bookingId = String(r.id);
  const [travellers, form, waiver] = await Promise.all([
    sbRequest<Traveller[]>(
      `gt_travellers?booking_id=eq.${bookingId}&select=*&order=is_lead.desc,created_at.asc`,
    ).catch(() => null),
    formByTrip(tripId),
    waiverByTrip(tripId),
  ]);

  const responses = form
    ? (await sbRequest<Array<{ traveller_id: string | null; answers: Record<string, string> }>>(
        `gt_form_responses?booking_id=eq.${bookingId}&form_id=eq.${form.id}&select=traveller_id,answers`,
      ).catch(() => null)) ?? []
    : [];

  const signatures = waiver
    ? (await sbRequest<Array<{ traveller_id: string | null }>>(
        `gt_signatures?booking_id=eq.${bookingId}&waiver_id=eq.${waiver.id}&select=traveller_id`,
      ).catch(() => null)) ?? []
    : [];

  // Only fetch documents when the form actually asks for one, so a trip with no
  // document fields does no extra work.
  const hasDocFields = (form?.schema ?? []).some((f) => f.type === 'document');
  const docs = hasDocFields ? await listDocumentsForBooking(bookingId) : [];

  return {
    booking: {
      id: bookingId,
      reference: String(r.reference),
      status: String(r.status),
      party_size: Number(r.party_size),
      currency: String(r.currency ?? 'gbp'),
      operator_id: (r.operator_id as string) ?? null,
      trip_id: tripId,
      trip_title: String(trip.title ?? 'your trip'),
      operator_name: String(op.name ?? 'the operator'),
      starts_on: (dep.starts_on as string) ?? null,
      ends_on: (dep.ends_on as string) ?? null,
    },
    travellers: travellers ?? [],
    form,
    waiver,
    responses,
    signatures,
    documents: docs.map((d) => ({ id: d.id, traveller_id: d.traveller_id, field_key: d.field_key, file_name: d.file_name })),
  };
}

/** Persist a validated registration. Every write is scoped to this booking, and
 *  a traveller id the browser sent is only reused if it already belongs here;
 *  anything else becomes a fresh row rather than reaching another booking. */
export async function writeRegistration(
  ctx: RegistrationContext,
  value: ValidatedRegistration,
  meta: { ip: string | null; userAgent: string | null },
): Promise<boolean> {
  const bookingId = ctx.booking.id;
  const ownedIds = new Set(ctx.travellers.map((t) => t.id));

  // 1. Upsert one traveller row per slot, collecting the id of each in order.
  const slotIds: string[] = [];
  for (const t of value.travellers) {
    const patch = {
      full_name: t.full_name,
      email: t.email,
      phone: t.phone,
      date_of_birth: t.date_of_birth,
      updated_at: nowIso(),
    };
    if (t.id && ownedIds.has(t.id)) {
      await sbUpdate('gt_travellers', `id=eq.${t.id}&booking_id=eq.${bookingId}`, patch);
      slotIds.push(t.id);
    } else {
      const created = await sbInsert<{ id: string }>('gt_travellers', {
        booking_id: bookingId, is_lead: false, ...patch,
      });
      const id = created[0]?.id;
      if (!id) return false;
      slotIds.push(id);
    }
  }

  // 2. Replace this booking's answers for the trip's form (full rewrite, so a
  //    removed answer does not linger).
  if (ctx.form) {
    await sbRequest(`gt_form_responses?booking_id=eq.${bookingId}&form_id=eq.${ctx.form.id}`, { method: 'DELETE' });
    const inserts: Array<Record<string, unknown>> = [];
    value.travellers.forEach((t, i) => {
      if (Object.keys(t.answers).length) {
        inserts.push({ form_id: ctx.form!.id, booking_id: bookingId, traveller_id: slotIds[i], answers: t.answers, submitted_at: nowIso() });
      }
    });
    if (Object.keys(value.booking_answers).length) {
      inserts.push({ form_id: ctx.form.id, booking_id: bookingId, traveller_id: null, answers: value.booking_answers, submitted_at: nowIso() });
    }
    if (inserts.length) await sbInsert('gt_form_responses', inserts);
  }

  // 3. Replace signatures on the current waiver version. body_sha256 is computed
  //    HERE from the stored text, so a signature always pins what we actually
  //    showed, never what the browser claimed.
  if (ctx.waiver) {
    const sha = await sha256Hex(ctx.waiver.body);
    await sbRequest(`gt_signatures?booking_id=eq.${bookingId}&waiver_id=eq.${ctx.waiver.id}`, { method: 'DELETE' });
    const sigs: Array<Record<string, unknown>> = [];
    value.travellers.forEach((t, i) => {
      if (t.signed_name) {
        sigs.push({
          waiver_id: ctx.waiver!.id, booking_id: bookingId, traveller_id: slotIds[i],
          signed_name: t.signed_name, body_sha256: sha,
          ip: meta.ip, user_agent: meta.userAgent,
        });
      }
    });
    if (sigs.length) await sbInsert('gt_signatures', sigs);
  }

  return true;
}

// --- operator manifest: one booking, everything about its people ------------

export interface BookingDetail {
  booking: BookingWithTravellers;
  form: FormRow | null;
  waiver: Waiver | null;
  responses: Array<{ traveller_id: string | null; answers: Record<string, string> }>;
  signatures: Array<{ traveller_id: string | null; signed_name: string; signed_at: string; version: number }>;
  trip: { id: string; title: string } | null;
  packageName: string | null;
  selectedOptions: SelectedOption[];
  documents: TripDocument[];
  registrationComplete: boolean;
}

/** The full people-picture for one booking the operator owns. */
export async function getBookingDetail(bookingId: string, operatorId: string): Promise<BookingDetail | null> {
  const booking = await getBookingOwned(bookingId, operatorId);
  if (!booking) return null;

  // The trip via the departure, so form and waiver can be found.
  let trip: { id: string; title: string } | null = null;
  if (booking.departure_id) {
    const rows = await sbRequest<Array<{ trip: { id: string; title: string } }>>(
      `gt_departures?id=eq.${booking.departure_id}&select=trip:gt_trips(id,title)&limit=1`,
    ).catch(() => null);
    const t = rows?.[0]?.trip;
    if (t) trip = { id: String(t.id), title: String(t.title) };
  }

  const form = trip ? await formByTrip(trip.id) : null;
  const waiver = trip ? await waiverByTrip(trip.id) : null;

  let packageName: string | null = null;
  if (booking.package_id) {
    const pk = await sbRequest<Array<{ name: string }>>(
      `gt_packages?id=eq.${booking.package_id}&select=name&limit=1`,
    ).catch(() => null);
    if (pk?.[0]?.name) packageName = String(pk[0].name);
  }

  const responses = form
    ? (await sbRequest<Array<{ traveller_id: string | null; answers: Record<string, string> }>>(
        `gt_form_responses?booking_id=eq.${bookingId}&form_id=eq.${form.id}&select=traveller_id,answers`,
      ).catch(() => null)) ?? []
    : [];

  const signatures = waiver
    ? (await sbRequest<Array<{ traveller_id: string | null; signed_name: string; signed_at: string }>>(
        `gt_signatures?booking_id=eq.${bookingId}&waiver_id=eq.${waiver.id}&select=traveller_id,signed_name,signed_at`,
      ).catch(() => null)) ?? []
    : [];

  const documents = await listDocumentsForBooking(bookingId);

  const travellerAnswers = new Map<string, Set<string>>();
  let bookingAnswers = new Set<string>();
  for (const r of responses) {
    const keys = new Set(Object.keys(r.answers ?? {}));
    if (r.traveller_id) travellerAnswers.set(r.traveller_id, keys);
    else bookingAnswers = keys;
  }
  // A present document satisfies its required document field exactly like an
  // answered question, so its field key joins the answered set for that scope.
  for (const d of documents) {
    if (d.traveller_id) {
      const set = travellerAnswers.get(d.traveller_id) ?? new Set<string>();
      set.add(d.field_key);
      travellerAnswers.set(d.traveller_id, set);
    } else {
      bookingAnswers.add(d.field_key);
    }
  }
  const signedTravellerIds = new Set(signatures.map((s) => s.traveller_id).filter((x): x is string => !!x));

  const registrationComplete = isRegistrationComplete({
    partySize: booking.party_size,
    schema: form?.schema ?? [],
    waiver: waiver ? { id: waiver.id, version: waiver.version, is_mandatory: waiver.is_mandatory } : null,
    travellers: booking.travellers.map((t) => ({ id: t.id, full_name: t.full_name })),
    travellerAnswers,
    bookingAnswers,
    signedTravellerIds,
  });

  return {
    booking, form, waiver, responses,
    signatures: signatures.map((s) => ({ ...s, version: waiver?.version ?? 1 })),
    trip, packageName,
    selectedOptions: asSelectedOptions((booking as unknown as Record<string, unknown>).selected_options),
    documents,
    registrationComplete,
  };
}

// ---------------------------------------------------------------------------
//  Manage Trip — one trip's whole booking picture for the operator. Money
//  summary, every booking, and every participant across them. Operator-gated on
//  the trip, so a forged trip id returns null rather than another operator's
//  bookings.
// ---------------------------------------------------------------------------

export interface TripBooking extends BookingWithTravellers {
  package_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
}

export interface TripManage {
  trip: { id: string; title: string; slug: string; status: string; currency: string; hero_image_url: string | null };
  money: { total_pence: number; collected_pence: number; outstanding_pence: number; currency: string };
  counts: { bookings: number; participants: number; heads: number };
  bookings: TripBooking[];
}

/** The counting statuses for a live booking: a hold that has not expired, plus
 *  anything paid. A cancelled or expired booking is money that did not happen. */
const LIVE_STATUSES = new Set(['pending', 'deposit_paid', 'paid']);

export async function getTripManage(tripId: string, operatorId: string): Promise<TripManage | null> {
  const trip = await getTripOwned(tripId, operatorId);
  if (!trip) return null;

  const rows =
    (await sbRequest<Array<Record<string, unknown>>>(
      `gt_bookings?operator_id=eq.${operatorId}` +
        `&select=*,departure:gt_departures!inner(starts_on,ends_on,trip_id),` +
        `package:gt_packages(name),` +
        `travellers:gt_travellers(id,full_name,email,phone,date_of_birth,is_lead)` +
        `&departure.trip_id=eq.${tripId}&order=created_at.desc`,
    ).catch(() => null)) ?? [];

  const bookings: TripBooking[] = rows.map((r) => {
    const dep = (r.departure ?? {}) as Record<string, unknown>;
    const pkg = (r.package ?? null) as Record<string, unknown> | null;
    return {
      ...(r as unknown as BookingWithTravellers),
      package_name: pkg?.name ? String(pkg.name) : null,
      starts_on: (dep.starts_on as string) ?? null,
      ends_on: (dep.ends_on as string) ?? null,
    };
  });

  let total = 0, collected = 0, participants = 0, heads = 0, liveBookings = 0;
  for (const b of bookings) {
    if (!LIVE_STATUSES.has(b.status)) continue;
    liveBookings += 1;
    heads += b.party_size || 0;
    participants += (b.travellers || []).filter((t) => (t.full_name ?? '').trim()).length;
    const t = b.total_pence ?? 0;
    total += t;
    // Deposit collected once deposit_paid; the full total once paid.
    collected += b.status === 'paid' ? t : b.status === 'deposit_paid' ? (b.deposit_pence ?? 0) : 0;
  }

  return {
    trip: {
      id: trip.id, title: trip.title, slug: trip.slug, status: trip.status,
      currency: trip.currency, hero_image_url: trip.hero_image_url,
    },
    money: { total_pence: total, collected_pence: collected, outstanding_pence: Math.max(0, total - collected), currency: trip.currency },
    counts: { bookings: liveBookings, participants, heads },
    bookings,
  };
}

// ---------------------------------------------------------------------------
//  Promo codes. Operator authoring, and a public validity check for the book
//  form. Applying the discount is the hold RPC's job (gt_012), which re-checks
//  everything here, so this is a preview, never the authority.
// ---------------------------------------------------------------------------

/** A human line for a code, e.g. "10% off" or "£20 off per person". */
export function describePromo(p: { kind: string; value: number; per: string }, currency = 'gbp'): string {
  if (p.kind === 'percent') return `${p.value}% off`;
  const amt = fmtMoney(p.value, currency) ?? `${(p.value / 100).toFixed(0)}`;
  return `${amt} off${p.per === 'person' ? ' per person' : ''}`;
}

/** Is a code valid for this trip right now? Mirrors the RPC's checks so the form
 *  preview and the actual application agree. */
export async function checkPromoCode(tripId: string, code: string): Promise<{ valid: boolean; describe?: string }> {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!isUuid(tripId) || !clean) return { valid: false };

  const trip = await sbRequest<Array<{ operator_id: string }>>(
    `gt_trips?id=eq.${tripId}&status=eq.published&select=operator_id&limit=1`,
  ).catch(() => null);
  const operatorId = trip?.[0]?.operator_id;
  if (!operatorId) return { valid: false };

  const rows = await sbRequest<PromoCode[]>(
    `gt_promo_codes?operator_id=eq.${operatorId}&code=eq.${encodeURIComponent(clean)}&select=*&limit=1`,
  ).catch(() => null);
  const p = rows?.[0];
  const today = new Date().toISOString().slice(0, 10);
  if (!p || !p.is_active) return { valid: false };
  if (p.trip_id && p.trip_id !== tripId) return { valid: false };
  if (p.starts_on && p.starts_on > today) return { valid: false };
  if (p.ends_on && p.ends_on < today) return { valid: false };
  if (p.max_redemptions != null && p.redeemed >= p.max_redemptions) return { valid: false };
  return { valid: true, describe: describePromo(p) };
}

export async function listPromoCodes(tripId: string, operatorId: string): Promise<PromoCode[]> {
  if (!(await getTripOwned(tripId, operatorId))) return [];
  return (
    (await sbRequest<PromoCode[]>(
      `gt_promo_codes?operator_id=eq.${operatorId}&trip_id=eq.${tripId}&select=*&order=created_at.desc`,
    ).catch(() => null)) ?? []
  );
}

export async function savePromoCode(
  tripId: string, operatorId: string, input: PromoInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getTripOwned(tripId, operatorId))) return { ok: false, error: 'That trip could not be found.' };
  try {
    await sbInsert('gt_promo_codes', { operator_id: operatorId, trip_id: tripId, ...input });
    return { ok: true };
  } catch (err) {
    // The unique (operator, code) index rejects a duplicate.
    const dup = err instanceof SupabaseError && err.statusCode === 409;
    return { ok: false, error: dup ? 'You already have a code with that name.' : 'The code could not be saved.' };
  }
}

/** Remove a code. One that has been redeemed is deactivated rather than deleted,
 *  so a booking that used it keeps its record; an unused one is deleted. */
export async function removePromoCode(id: string, operatorId: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const rows = await sbRequest<PromoCode[]>(
    `gt_promo_codes?id=eq.${id}&operator_id=eq.${operatorId}&select=redeemed&limit=1`,
  ).catch(() => null);
  const p = rows?.[0];
  if (!p) return false;
  if (p.redeemed > 0) {
    await sbUpdate('gt_promo_codes', `id=eq.${id}&operator_id=eq.${operatorId}`, { is_active: false, updated_at: nowIso() });
  } else {
    await sbRequest(`gt_promo_codes?id=eq.${id}&operator_id=eq.${operatorId}`, { method: 'DELETE' });
  }
  return true;
}

// ---------------------------------------------------------------------------
//  Automated emails — the operator's contact for a booking, and the pool of
//  bookings due a one-time registration reminder.
// ---------------------------------------------------------------------------

/** The operator's own contact for a booking, for the new-booking notice. Gated
 *  by the booking id, which the caller has just created. */
export async function getBookingOperatorContact(bookingId: string): Promise<{ email: string; replyTo: string | null; name: string } | null> {
  if (!isUuid(bookingId)) return null;
  const rows = await sbRequest<Array<{ operator: { contact_email: string; name: string; brand: OperatorBrand | null } }>>(
    `gt_bookings?id=eq.${bookingId}&select=operator:gt_operators(contact_email,name,brand)&limit=1`,
  ).catch(() => null);
  const op = rows?.[0]?.operator;
  if (!op?.contact_email) return null;
  return { email: op.contact_email, replyTo: op.brand?.replyTo ?? null, name: op.name };
}

export interface ReminderBooking {
  id: string;
  reference: string;
  party_size: number;
  total_pence: number | null;
  deposit_pence: number | null;
  currency: string;
  traveller_name: string | null;
  traveller_email: string | null;
  starts_on: string | null;
  ends_on: string | null;
  trip_title: string;
  operator_name: string;
  operator_reply_to: string | null;
}

/** Bookings that booked but may not have finished, due a one-time nudge: still
 *  live, 2 to 14 days old, and never reminded. Bounded so a run is quick. */
export async function findBookingsToRemind(limit = 50): Promise<ReminderBooking[]> {
  const now = Date.now();
  const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();

  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_bookings?status=in.(pending,deposit_paid)&reminder_sent_at=is.null` +
      `&created_at=lte.${twoDaysAgo}&created_at=gte.${fourteenDaysAgo}` +
      `&traveller_email=not.is.null` +
      `&select=id,reference,party_size,total_pence,deposit_pence,currency,traveller_name,traveller_email,` +
      `departure:gt_departures(starts_on,ends_on,trip:gt_trips(title,operator:gt_operators(name,brand)))` +
      `&order=created_at.asc&limit=${limit}`,
  ).catch(() => null);

  return (rows ?? []).map((r) => {
    const dep = (r.departure ?? {}) as Record<string, unknown>;
    const trip = (dep.trip ?? {}) as Record<string, unknown>;
    const op = (trip.operator ?? {}) as Record<string, unknown>;
    const brand = (op.brand ?? null) as OperatorBrand | null;
    return {
      id: String(r.id),
      reference: String(r.reference),
      party_size: Number(r.party_size),
      total_pence: (r.total_pence as number) ?? null,
      deposit_pence: (r.deposit_pence as number) ?? null,
      currency: String(r.currency ?? 'gbp'),
      traveller_name: (r.traveller_name as string) ?? null,
      traveller_email: (r.traveller_email as string) ?? null,
      starts_on: (dep.starts_on as string) ?? null,
      ends_on: (dep.ends_on as string) ?? null,
      trip_title: String(trip.title ?? 'your trip'),
      operator_name: String(op.name ?? 'the operator'),
      operator_reply_to: brand?.replyTo ?? null,
    };
  });
}

export async function markBookingReminded(bookingId: string): Promise<void> {
  if (!isUuid(bookingId)) return;
  await sbUpdate('gt_bookings', `id=eq.${bookingId}`, { reminder_sent_at: nowIso() }).catch(() => []);
}

// ---------------------------------------------------------------------------
//  Messaging — broadcast to a trip's travellers, and reusable templates. All
//  operator-gated. Sending goes through the notify seam, so it composes and
//  records now and actually delivers the moment an email key is configured.
// ---------------------------------------------------------------------------

export async function listMessageTemplates(operatorId: string): Promise<MessageTemplate[]> {
  return (
    (await sbRequest<MessageTemplate[]>(
      `gt_message_templates?operator_id=eq.${operatorId}&select=*&order=created_at.desc`,
    ).catch(() => null)) ?? []
  );
}

export async function saveMessageTemplate(
  operatorId: string,
  input: { name: string; subject: string; body: string },
): Promise<MessageTemplate | null> {
  const rows = await sbInsert<MessageTemplate>('gt_message_templates', { operator_id: operatorId, ...input });
  return rows[0] ?? null;
}

export async function deleteMessageTemplate(id: string, operatorId: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  await sbRequest(`gt_message_templates?id=eq.${id}&operator_id=eq.${operatorId}`, { method: 'DELETE' });
  return true;
}

export async function listTripMessages(tripId: string, operatorId: string): Promise<TripMessage[]> {
  if (!(await getTripOwned(tripId, operatorId))) return [];
  return (
    (await sbRequest<TripMessage[]>(
      `gt_messages?trip_id=eq.${tripId}&operator_id=eq.${operatorId}&select=id,subject,body,segment,recipient_count,created_at&order=created_at.desc&limit=50`,
    ).catch(() => null)) ?? []
  );
}

export interface Recipient { email: string; name: string }

/** The unique traveller emails on a trip that match a segment. Lead and named
 *  travellers both count; a cancelled or expired booking never does. */
function recipientsFrom(bookings: TripBooking[], segment: { status?: string; room?: string }): Recipient[] {
  const byEmail = new Map<string, Recipient>();
  for (const b of bookings) {
    if (!LIVE_STATUSES.has(b.status)) continue;
    if (segment.status && b.status !== segment.status) continue;
    if (segment.room && (b.package_name ?? '') !== segment.room) continue;
    const lead = { email: b.traveller_email ?? '', name: b.traveller_name ?? '' };
    for (const r of [lead, ...(b.travellers || []).map((t) => ({ email: t.email ?? '', name: t.full_name ?? '' }))]) {
      const email = r.email.trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, { email, name: r.name });
    }
  }
  return [...byEmail.values()];
}

/** How many people a segment would reach, without sending. Powers the preview. */
export async function countRecipients(
  tripId: string, operatorId: string, segment: { status?: string; room?: string },
): Promise<number> {
  const data = await getTripManage(tripId, operatorId);
  if (!data) return 0;
  return recipientsFrom(data.bookings, segment).length;
}

/** Send a broadcast and record it. Sends are best-effort and parallel; one bad
 *  address never breaks the run. Capped so a serverless invocation cannot run
 *  away. Returns how many were attempted and how many the provider accepted. */
export async function sendTripBroadcast(
  tripId: string,
  operatorId: string,
  input: { subject: string; body: string; segment: { status?: string; room?: string } },
): Promise<{ ok: boolean; total: number; sent: number } | null> {
  const data = await getTripManage(tripId, operatorId);
  if (!data) return null;

  const operator = await getOperatorById(operatorId);
  const replyTo = operator?.brand?.replyTo || operator?.contact_email || undefined;

  const recipients = recipientsFrom(data.bookings, input.segment).slice(0, 500);
  const results = await Promise.allSettled(
    recipients.map((r) => sendEmail({ to: r.email, replyTo, subject: input.subject, body: input.body })),
  );
  const sent = results.filter((x) => x.status === 'fulfilled' && x.value.ok).length;

  await sbInsert('gt_messages', {
    operator_id: operatorId, trip_id: tripId,
    subject: input.subject, body: input.body, segment: input.segment,
    recipient_count: recipients.length,
  });

  return { ok: true, total: recipients.length, sent };
}

const SEG_STATUS_LABEL: Record<string, string> = { pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full' };

/** The segment options offered in the compose box, each with a live recipient
 *  count, so the operator sees who a message will reach before sending. */
export function broadcastSegments(bookings: TripBooking[]): Array<{ id: string; label: string; count: number }> {
  const opts = [{ id: 'all', label: 'Everyone on this trip', count: recipientsFrom(bookings, {}).length }];
  for (const st of ['pending', 'deposit_paid', 'paid']) {
    const count = recipientsFrom(bookings, { status: st }).length;
    if (count) opts.push({ id: `status:${st}`, label: SEG_STATUS_LABEL[st] ?? st, count });
  }
  const rooms = new Set(
    bookings.filter((b) => LIVE_STATUSES.has(b.status) && b.package_name).map((b) => b.package_name as string),
  );
  for (const room of rooms) {
    const count = recipientsFrom(bookings, { room }).length;
    if (count) opts.push({ id: `room:${room}`, label: `Room · ${room}`, count });
  }
  return opts;
}

/** Decode a segment id from the compose box into a filter. */
export function parseSegment(id: string): { status?: string; room?: string } {
  if (id.startsWith('status:')) return { status: id.slice(7) };
  if (id.startsWith('room:')) return { room: id.slice(5) };
  return {};
}

// ---------------------------------------------------------------------------
//  Waitlist. Public insert (verified against a real published trip), operator-
//  gated read and status changes. A full trip captures interest instead of
//  turning it away.
// ---------------------------------------------------------------------------

const WAITLIST_STATUSES = new Set(['waiting', 'invited', 'converted', 'removed']);

/** Join a waitlist. The trip must exist and be published, resolved server-side,
 *  so a forged trip id or a draft cannot be waitlisted against. */
export async function joinWaitlist(input: WaitlistInput): Promise<boolean> {
  if (!isUuid(input.trip_id)) return false;
  const trip = await sbRequest<Array<{ id: string; operator_id: string }>>(
    `gt_trips?id=eq.${input.trip_id}&status=eq.published&select=id,operator_id&limit=1`,
  ).catch(() => null);
  if (!trip?.length) return false;

  // A departure_id, if given, must belong to this trip, or it is dropped.
  let departureId: string | null = null;
  if (input.departure_id && isUuid(input.departure_id)) {
    const dep = await sbRequest<Array<{ id: string }>>(
      `gt_departures?id=eq.${input.departure_id}&trip_id=eq.${input.trip_id}&select=id&limit=1`,
    ).catch(() => null);
    if (dep?.length) departureId = input.departure_id;
  }

  const rows = await sbInsert<{ id: string }>('gt_waitlist', {
    trip_id: input.trip_id, departure_id: departureId,
    full_name: input.full_name, email: input.email, phone: input.phone,
    party_size: input.party_size, note: input.note,
  });
  return rows.length > 0;
}

export async function listWaitlist(tripId: string, operatorId: string): Promise<WaitlistEntry[]> {
  if (!(await getTripOwned(tripId, operatorId))) return [];
  return (
    (await sbRequest<WaitlistEntry[]>(
      `gt_waitlist?trip_id=eq.${tripId}&status=neq.removed&select=*&order=created_at.desc`,
    ).catch(() => null)) ?? []
  );
}

export async function countWaitlist(tripId: string, operatorId: string): Promise<number> {
  if (!(await getTripOwned(tripId, operatorId))) return 0;
  const rows = await sbRequest<WaitlistEntry[]>(
    `gt_waitlist?trip_id=eq.${tripId}&status=neq.removed&select=id`,
  ).catch(() => null);
  return rows?.length ?? 0;
}

export async function setWaitlistStatus(
  entryId: string,
  tripId: string,
  operatorId: string,
  status: string,
): Promise<boolean> {
  if (!isUuid(entryId) || !WAITLIST_STATUSES.has(status)) return false;
  if (!(await getTripOwned(tripId, operatorId))) return false;
  const rows = await sbUpdate('gt_waitlist', `id=eq.${entryId}&trip_id=eq.${tripId}`, { status, updated_at: nowIso() });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
//  Reporting — money across ALL of an operator's trips (cross-trip dashboard).
// ---------------------------------------------------------------------------

export interface ReportRow {
  trip_id: string;
  title: string;
  currency: string;
  bookings: number;
  heads: number;
  booked_pence: number;
  collected_pence: number;
  outstanding_pence: number;
}

export interface OperatorReport {
  rows: ReportRow[];
  totals: { bookings: number; heads: number; booked_pence: number; collected_pence: number; outstanding_pence: number };
  currency: string;
  mixedCurrency: boolean;
}

export async function getOperatorReport(operatorId: string): Promise<OperatorReport> {
  const rows = await sbRequest<Array<Record<string, unknown>>>(
    `gt_bookings?operator_id=eq.${operatorId}` +
      `&select=status,total_pence,deposit_pence,currency,party_size,` +
      `departure:gt_departures!inner(trip:gt_trips(id,title))`,
  ).catch(() => null);

  const byTrip = new Map<string, ReportRow>();
  const currencies = new Set<string>();

  for (const r of rows ?? []) {
    if (!LIVE_STATUSES.has(String(r.status))) continue;
    const dep = (r.departure ?? {}) as Record<string, unknown>;
    const trip = (dep.trip ?? {}) as Record<string, unknown>;
    const tid = String(trip.id ?? '');
    if (!tid) continue;
    const currency = String(r.currency ?? 'gbp');
    currencies.add(currency);

    let row = byTrip.get(tid);
    if (!row) {
      row = { trip_id: tid, title: String(trip.title ?? 'Trip'), currency, bookings: 0, heads: 0, booked_pence: 0, collected_pence: 0, outstanding_pence: 0 };
      byTrip.set(tid, row);
    }
    const total = (r.total_pence as number) ?? 0;
    const deposit = (r.deposit_pence as number) ?? 0;
    const status = String(r.status);
    const collected = status === 'paid' ? total : status === 'deposit_paid' ? deposit : 0;
    row.bookings += 1;
    row.heads += (r.party_size as number) ?? 0;
    row.booked_pence += total;
    row.collected_pence += collected;
    row.outstanding_pence += Math.max(0, total - collected);
  }

  const rowsArr = [...byTrip.values()].sort((a, b) => b.booked_pence - a.booked_pence);
  const totals = rowsArr.reduce(
    (t, r) => ({
      bookings: t.bookings + r.bookings, heads: t.heads + r.heads,
      booked_pence: t.booked_pence + r.booked_pence,
      collected_pence: t.collected_pence + r.collected_pence,
      outstanding_pence: t.outstanding_pence + r.outstanding_pence,
    }),
    { bookings: 0, heads: 0, booked_pence: 0, collected_pence: 0, outstanding_pence: 0 },
  );

  return {
    rows: rowsArr, totals,
    currency: [...currencies][0] ?? 'gbp',
    mixedCurrency: currencies.size > 1,
  };
}

/** The statuses an operator may set by hand from the Manage table. These are the
 *  offline-payment equivalents of WeTravel's bulk actions (bank transfer taken →
 *  mark paid); real online payment will flip these through Stripe later. */
export const MANUAL_BOOKING_STATUSES = new Set(['deposit_paid', 'paid', 'cancelled']);

/**
 * Set a status on several of a trip's bookings at once. Scoped THREE ways so a
 * forged id cannot reach another booking: operator_id (ownership), the trip's
 * own departures, and the id list. None of these statuses can oversell — they
 * only keep or reduce the taken count — so no hold RPC is involved. Returns how
 * many rows changed.
 */
export async function bulkSetBookingStatus(
  tripId: string,
  operatorId: string,
  ids: string[],
  status: string,
): Promise<number> {
  if (!MANUAL_BOOKING_STATUSES.has(status)) return 0;
  if (!(await getTripOwned(tripId, operatorId))) return 0;

  const clean = ids.filter((id) => isUuid(id)).slice(0, 500);
  if (clean.length === 0) return 0;

  // The trip's departures, so the update cannot touch this operator's OTHER
  // trips even if an id from one were slipped in.
  const deps = await sbRequest<Array<{ id: string }>>(
    `gt_departures?trip_id=eq.${tripId}&select=id`,
  ).catch(() => null);
  const depIds = (deps ?? []).map((d) => d.id);
  if (depIds.length === 0) return 0;

  const rows = await sbUpdate<{ id: string }>(
    'gt_bookings',
    `id=in.(${clean.join(',')})&operator_id=eq.${operatorId}&departure_id=in.(${depIds.join(',')})`,
    { status, updated_at: nowIso() },
  );
  return rows.length;
}


// ---------------------------------------------------------------------------
//  Media library. Per operator. The bytes are in Vercel Blob; these rows are
//  the index over them. Everything is operator-scoped.
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string;
  operator_id: string;
  url: string;
  kind: 'image' | 'video';
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  source: 'upload' | 'pexels';
  credit: string | null;
  credit_url: string | null;
  created_at: string;
}

export async function listMedia(operatorId: string, limit = 200): Promise<MediaItem[]> {
  return (
    (await sbRequest<MediaItem[]>(
      `gt_media?operator_id=eq.${operatorId}&select=*&order=created_at.desc&limit=${limit}`,
    )) ?? []
  );
}

/** Record an uploaded blob. Idempotent on (operator_id, url) so a double POST
 *  from a flaky client cannot create two rows for one file. */
export async function recordMedia(
  operatorId: string,
  item: {
    url: string; kind: 'image' | 'video';
    filename?: string | null; content_type?: string | null; size_bytes?: number | null;
    source?: 'upload' | 'pexels'; credit?: string | null; credit_url?: string | null;
  },
): Promise<MediaItem | null> {
  const rows = await sbRequest<MediaItem[]>('gt_media?on_conflict=operator_id,url', {
    method: 'POST',
    body: {
      operator_id: operatorId,
      url: item.url,
      kind: item.kind,
      filename: item.filename ?? null,
      content_type: item.content_type ?? null,
      size_bytes: item.size_bytes ?? null,
      source: item.source ?? 'upload',
      credit: item.credit ?? null,
      credit_url: item.credit_url ?? null,
    },
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  }).catch(() => null);
  return rows?.[0] ?? null;
}

/** Remove one media row this operator owns. The blob itself is deleted by the
 *  API route; this drops the index entry. */
export async function deleteMediaOwned(mediaId: string, operatorId: string): Promise<MediaItem | null> {
  if (!isUuid(mediaId)) return null;
  const rows = await sbRequest<MediaItem[]>(
    `gt_media?id=eq.${mediaId}&operator_id=eq.${operatorId}&select=*`,
    { method: 'DELETE', headers: { Prefer: 'return=representation' } },
  ).catch(() => null);
  return rows?.[0] ?? null;
}


// ---------------------------------------------------------------------------

/** PostgREST will happily accept a malformed uuid and error at the database.
 *  Checking here turns that into a clean null instead of a 400 mid-render. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}
