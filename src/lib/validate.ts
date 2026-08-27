// =============================================================================
//  lib/validate.ts
// =============================================================================
//
//  Input validation for everything the console writes. Pure and dependency-free
//  on purpose, so the rules are unit-tested without a database or a browser.
//
//  The server is the authority. Every action re-validates here even though the
//  form also constrains the input, because a form is a convenience and a POST
//  body is whatever the caller felt like sending.
//
// =============================================================================

import { toPence } from './money.ts';
import { looksLikeEmail } from './booking.ts';

import type { FieldErrors } from './action-state.ts';
export type { FieldErrors };

export interface Validated<T> {
  ok: boolean;
  errors: FieldErrors;
  value: T;
}

const TRIP_KINDS = ['group', 'tour'] as const;
const TRIP_STATUSES = ['draft', 'published', 'archived'] as const;
const DEPARTURE_STATUSES = ['open', 'closed', 'cancelled'] as const;
const CURRENCIES = ['gbp', 'eur', 'usd'] as const;

/**
 * A URL-safe slug. Deliberately conservative: lowercase, ASCII, hyphens, no
 * leading or trailing hyphen. A slug ends up in a public URL and in an operator
 * embed, so it should be boring.
 */
export function slugify(input: string): string {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents, keep the letter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');              // slice may have left a trailing hyphen
}

/** Reserved words that would collide with our own routes. */
const RESERVED_SLUGS = new Set(['api', 'console', 'trip', 'admin', 'new', 'edit', '_next']);

export function isUsableSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 60 && !RESERVED_SLUGS.has(slug);
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

// ---------------------------------------------------------------------------
//  Trips
// ---------------------------------------------------------------------------

export interface TripInput {
  title: string;
  slug: string;
  summary: string | null;
  kind: (typeof TRIP_KINDS)[number];
  location: string | null;
  currency: string;
  hero_image_url: string | null;
}

export function validateTrip(raw: Record<string, unknown>): Validated<TripInput> {
  const errors: FieldErrors = {};

  const title = text(raw.title);
  if (!title) errors.title = 'Give the trip a title.';
  else if (title.length > 160) errors.title = 'Keep the title under 160 characters.';

  // An empty slug field means "derive it from the title", which is what an
  // operator expects. Only complain when what we derive is unusable.
  const slug = slugify(text(raw.slug) || title);
  if (!isUsableSlug(slug)) {
    errors.slug = slug
      ? `"${slug}" cannot be used as a web address. Try something else.`
      : 'This title has no letters or numbers to build a web address from.';
  }

  const kind = text(raw.kind) as TripInput['kind'];
  if (!TRIP_KINDS.includes(kind)) errors.kind = 'Choose a trip type.';

  const currency = text(raw.currency).toLowerCase() || 'gbp';
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    errors.currency = 'Choose a currency.';
  }

  const summary = text(raw.summary);
  if (summary.length > 600) errors.summary = 'Keep the summary under 600 characters.';

  const hero = text(raw.hero_image_url);
  if (hero && !isSafeHttpUrl(hero)) errors.hero_image_url = 'That must be an https image address.';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      slug,
      summary: summary || null,
      kind,
      location: text(raw.location) || null,
      currency,
      hero_image_url: hero || null,
    },
  };
}

export function isValidTripStatus(s: string): s is (typeof TRIP_STATUSES)[number] {
  return TRIP_STATUSES.includes(s as (typeof TRIP_STATUSES)[number]);
}

/**
 * Only https, and only a real host. A hero image URL is rendered into a page,
 * so javascript: and data: must never survive validation.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && Boolean(u.hostname) && u.hostname.includes('.');
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
//  Departures
// ---------------------------------------------------------------------------

export interface DepartureInput {
  starts_on: string;
  ends_on: string;
  capacity: number;
  price_pence: number | null;
  deposit_pence: number | null;
  balance_due_date: string | null;
  status: (typeof DEPARTURE_STATUSES)[number];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, so 2026-02-31 is rejected rather than rolled forward. */
export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateDeparture(raw: Record<string, unknown>): Validated<DepartureInput> {
  const errors: FieldErrors = {};

  const starts = text(raw.starts_on);
  const ends = text(raw.ends_on);
  if (!isRealDate(starts)) errors.starts_on = 'Give a start date.';
  if (!isRealDate(ends)) errors.ends_on = 'Give an end date.';
  if (!errors.starts_on && !errors.ends_on && ends < starts) {
    errors.ends_on = 'The end date cannot be before the start date.';
  }

  const capacityRaw = text(raw.capacity) || '0';
  const capacity = Number.parseInt(capacityRaw, 10);
  if (!Number.isFinite(capacity) || capacity < 0) {
    errors.capacity = 'Capacity must be zero or more.';
  } else if (capacity > 10000) {
    errors.capacity = 'That capacity looks wrong. Check it.';
  }

  // toPence returns null for anything unparseable, which is what we want: an
  // empty price field means "not priced yet", not zero.
  const price = raw.price_pence === '' || raw.price_pence == null ? null : toPence(raw.price_pence as string);
  if (raw.price_pence && price === null) errors.price_pence = 'That price is not a number.';

  const deposit = raw.deposit_pence === '' || raw.deposit_pence == null ? null : toPence(raw.deposit_pence as string);
  if (raw.deposit_pence && deposit === null) errors.deposit_pence = 'That deposit is not a number.';

  // A per-person ceiling so total = price x party can never overflow the int4
  // pence column (max ~£21m). £500k a head is far beyond any real trip.
  const PRICE_CEILING = 50_000_000; // £500,000 in pence
  if (price !== null && price > PRICE_CEILING) errors.price_pence = 'That price looks too high. Check it.';
  if (deposit !== null && deposit > PRICE_CEILING) errors.deposit_pence = 'That deposit looks too high. Check it.';

  if (price !== null && deposit !== null && price > 0 && deposit > price) {
    errors.deposit_pence = 'The deposit cannot be more than the price.';
  }

  const balanceDue = text(raw.balance_due_date);
  if (balanceDue && !isRealDate(balanceDue)) {
    errors.balance_due_date = 'That balance date is not a real date.';
  } else if (balanceDue && !errors.starts_on && balanceDue > starts) {
    errors.balance_due_date = 'The balance is due before the trip departs, not after.';
  }

  const status = (text(raw.status) || 'open') as DepartureInput['status'];
  if (!DEPARTURE_STATUSES.includes(status)) errors.status = 'Choose a status.';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      starts_on: starts,
      ends_on: ends,
      capacity: Number.isFinite(capacity) && capacity >= 0 ? capacity : 0,
      price_pence: price,
      deposit_pence: deposit,
      balance_due_date: balanceDue || null,
      status,
    },
  };
}

// ---------------------------------------------------------------------------
//  Packages — room types and occupancy tiers (phase 5)
// ---------------------------------------------------------------------------

export interface PackageInput {
  name: string;
  description: string | null;
  price_pence: number | null;
  occupancy: number;
  capacity: number | null;
  image_url: string | null;
  info_url: string | null;
  sort_order: number;
}

// ---------------------------------------------------------------------------
//  Waitlist — a would-be traveller's details when a trip is full (public input)
// ---------------------------------------------------------------------------

export interface WaitlistInput {
  trip_id: string;
  departure_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  party_size: number;
  note: string | null;
}

function isUuidStr(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function validateWaitlist(raw: Record<string, unknown>): Validated<WaitlistInput> {
  const errors: FieldErrors = {};

  const trip_id = text(raw.trip_id);
  if (!isUuidStr(trip_id)) errors.trip_id = 'This trip could not be identified.';

  const departureRaw = text(raw.departure_id);
  const departure_id = isUuidStr(departureRaw) ? departureRaw : null;

  const full_name = text(raw.full_name);
  if (!full_name) errors.full_name = 'We need a name.';
  else if (full_name.length > 120) errors.full_name = 'That name is too long.';

  const email = text(raw.email);
  if (!email) errors.email = 'We need an email to let you know when a place opens.';
  else if (!looksLikeEmail(email)) errors.email = 'That email does not look right.';

  const phone = text(raw.phone);
  if (phone.length > 40) errors.phone = 'That phone number is too long.';

  const partyRaw = text(raw.party_size) || '1';
  const party_size = Number.parseInt(partyRaw, 10);
  if (!Number.isFinite(party_size) || party_size < 1) errors.party_size = 'How many places would you like?';
  else if (party_size > 20) errors.party_size = 'For a large group, contact the operator directly.';

  const note = text(raw.note).slice(0, 1000);

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      trip_id, departure_id, full_name, email,
      phone: phone || null,
      party_size: Number.isFinite(party_size) && party_size >= 1 ? party_size : 1,
      note: note || null,
    },
  };
}

export function validatePackage(raw: Record<string, unknown>): Validated<PackageInput> {
  const errors: FieldErrors = {};

  const name = text(raw.name);
  if (!name) errors.name = 'Give the package a name.';
  else if (name.length > 160) errors.name = 'Keep the name under 160 characters.';

  const description = text(raw.description);
  if (description.length > 2000) errors.description = 'Keep the description shorter.';

  // A price is per person, and the same "blank means price on request, never
  // zero" rule as a departure. The same per-person ceiling keeps total = price x
  // party inside the int4 pence column.
  const PRICE_CEILING = 50_000_000; // £500,000 in pence
  const price = raw.price_pence === '' || raw.price_pence == null ? null : toPence(raw.price_pence as string);
  if (raw.price_pence && price === null) errors.price_pence = 'That price is not a number.';
  if (price !== null && price > PRICE_CEILING) errors.price_pence = 'That price looks too high. Check it.';

  const occRaw = text(raw.occupancy) || '1';
  const occupancy = Number.parseInt(occRaw, 10);
  if (!Number.isFinite(occupancy) || occupancy < 1) errors.occupancy = 'Occupancy is one or more.';
  else if (occupancy > 20) errors.occupancy = 'That occupancy looks wrong. Check it.';

  // Capacity is optional (blank = no cap). It is not enforced by the hold yet;
  // stored for the allocation slice to come.
  const capacity = raw.capacity === '' || raw.capacity == null ? null : Number.parseInt(text(raw.capacity), 10);
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) errors.capacity = 'Capacity is zero or more, or blank.';
  else if (capacity !== null && capacity > 10000) errors.capacity = 'That capacity looks wrong. Check it.';

  const image = text(raw.image_url);
  if (image && !isSafeHttpUrl(image)) errors.image_url = 'That must be an https image address.';

  const info = text(raw.info_url);
  if (info && !isSafeHttpUrl(info)) errors.info_url = 'That link must be an https web address.';

  const sortRaw = text(raw.sort_order) || '0';
  const sort = Number.parseInt(sortRaw, 10);

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      description: description || null,
      price_pence: price,
      occupancy: Number.isFinite(occupancy) && occupancy >= 1 ? occupancy : 1,
      capacity: capacity !== null && Number.isFinite(capacity) && capacity >= 0 ? capacity : null,
      image_url: image || null,
      info_url: info || null,
      sort_order: Number.isFinite(sort) ? sort : 0,
    },
  };
}
