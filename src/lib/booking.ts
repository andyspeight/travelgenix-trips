// =============================================================================
//  lib/booking.ts
// =============================================================================
//
//  The pure parts of the booking journey: the traveller-facing reference, and
//  validation of what the booking form sends. Kept dependency-light so the
//  rules are tested without a database, exactly like validate.ts and money.ts.
//
//  The atomic hold that actually reserves the capacity lives elsewhere (a
//  Postgres function), because it cannot be done correctly in application code
//  over a REST layer. This module is everything AROUND that hold.
//
// =============================================================================

import type { FieldErrors } from './action-state.ts';

// ---------------------------------------------------------------------------
//  The booking reference
// ---------------------------------------------------------------------------
//
//  A traveller quotes this on the phone and types it into the Luna app, so it
//  is built to be READ ALOUD and TYPED: no characters that sound or look alike.
//  0/O, 1/I/L, 5/S, 2/Z are all out. Grouped in fours for the same reason a
//  card number is.
//
//  It must be unique across every operator (the gt_bookings.reference unique
//  index enforces that), so the caller retries on the rare collision.

const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXY346789'; // 27 chars, no look/sound-alikes
const REF_PREFIX = 'TGT';
const REF_GROUPS = 2;
const REF_GROUP_LEN = 4;

/**
 * Build a reference from a byte source. Injectable so the format is tested
 * deterministically; the default draws from crypto.
 *
 * @param randomBytes returns n cryptographically-random bytes
 */
export function makeReference(randomBytes: (n: number) => Uint8Array): string {
  const needed = REF_GROUPS * REF_GROUP_LEN;
  const bytes = randomBytes(needed);

  let out = '';
  for (let i = 0; i < needed; i++) {
    // Modulo bias across 27 into 256 is negligible for a human reference; the
    // uniqueness guarantee is the DB index, not the entropy.
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }

  const groups: string[] = [];
  for (let i = 0; i < REF_GROUPS; i++) {
    groups.push(out.slice(i * REF_GROUP_LEN, (i + 1) * REF_GROUP_LEN));
  }
  return `${REF_PREFIX}-${groups.join('-')}`;
}

/** Cryptographic reference for real use. */
export function newReference(): string {
  return makeReference((n) => {
    const b = new Uint8Array(n);
    globalThis.crypto.getRandomValues(b);
    return b;
  });
}

const REF_RE = new RegExp(
  `^${REF_PREFIX}-[${ALPHABET}]{${REF_GROUP_LEN}}(-[${ALPHABET}]{${REF_GROUP_LEN}}){${REF_GROUPS - 1}}$`,
);

/** True for a well-formed reference. Used to reject junk before a DB lookup. */
export function isReference(value: string): boolean {
  return REF_RE.test(String(value ?? '').trim().toUpperCase());
}

/** Normalise what a traveller typed: uppercase, and re-hyphenate if they
 *  dropped the dashes. Returns null if it is not a reference at all. */
export function normaliseReference(input: string): string | null {
  const raw = String(input ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith(REF_PREFIX) ? raw.slice(REF_PREFIX.length) : raw;
  if (body.length !== REF_GROUPS * REF_GROUP_LEN) return null;

  const groups: string[] = [];
  for (let i = 0; i < REF_GROUPS; i++) {
    groups.push(body.slice(i * REF_GROUP_LEN, (i + 1) * REF_GROUP_LEN));
  }
  const candidate = `${REF_PREFIX}-${groups.join('-')}`;
  return isReference(candidate) ? candidate : null;
}

// ---------------------------------------------------------------------------
//  Booking form validation
// ---------------------------------------------------------------------------

export const MAX_PARTY = 20; // matches the gt_bookings.party_size check

export interface TravellerInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  is_lead: boolean;
}

export interface BookingInput {
  departure_id: string;
  party_size: number;
  travellers: TravellerInput[];
  /** The chosen package (room type), or null. The database function verifies it
   *  belongs to the trip and prices off it; here we only shape it. */
  package_id: string | null;
}

/** A pragmatic email check: exactly one @, something either side, a dot in the
 *  domain. Deliberately not RFC 5322 — the confirmation email is the real test,
 *  and an over-strict regex rejects valid addresses more often than it helps. */
export function looksLikeEmail(value: string): boolean {
  const s = String(value ?? '').trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && s.length <= 254;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Validate the booking form. The lead traveller is required in full because
 * they are who we email and hold the booking for. The rest of the party are
 * named for the operator's manifest, but only a name is required of them, and
 * only if the traveller chose to enter them.
 *
 * party_size is the number of PLACES, which is what capacity is counted in. It
 * is authoritative over the length of the travellers array: someone can book 4
 * places and only name 2 people so far.
 */
export function validateBooking(raw: Record<string, unknown>): {
  ok: boolean;
  errors: FieldErrors;
  value: BookingInput;
} {
  const errors: FieldErrors = {};

  const departure_id = text(raw.departure_id);
  if (!isUuid(departure_id)) errors.departure_id = 'Choose a departure date.';

  // A package is optional here; only a well-formed id survives, and the database
  // function is the authority on whether it belongs to the trip.
  const packageRaw = text(raw.package_id);
  const package_id = isUuid(packageRaw) ? packageRaw : null;

  const partyRaw = text(raw.party_size) || '1';
  const party_size = Number.parseInt(partyRaw, 10);
  if (!Number.isFinite(party_size) || party_size < 1) {
    errors.party_size = 'How many people are travelling?';
  } else if (party_size > MAX_PARTY) {
    errors.party_size = `For parties over ${MAX_PARTY}, contact the operator directly.`;
  }

  // The lead traveller.
  const leadName = text(raw.lead_name);
  const leadEmail = text(raw.lead_email);
  const leadPhone = text(raw.lead_phone);

  if (!leadName) errors.lead_name = 'We need a name for the booking.';
  else if (leadName.length > 120) errors.lead_name = 'That name is too long.';

  if (!leadEmail) errors.lead_email = 'We need an email to send the confirmation to.';
  else if (!looksLikeEmail(leadEmail)) errors.lead_email = 'That email does not look right.';

  if (leadPhone && leadPhone.length > 40) errors.lead_phone = 'That phone number is too long.';

  // Additional travellers arrive as parallel arrays traveller_name[]. A blank
  // name means "not entered yet" and is dropped, not an error.
  const travellers: TravellerInput[] = [{
    full_name: leadName,
    email: leadEmail || null,
    phone: leadPhone || null,
    is_lead: true,
  }];

  const names = Array.isArray(raw['traveller_name'])
    ? (raw['traveller_name'] as unknown[])
    : raw['traveller_name'] != null
      ? [raw['traveller_name']]
      : [];

  for (const n of names) {
    const nm = text(n);
    if (nm) travellers.push({ full_name: nm, email: null, phone: null, is_lead: false });
    if (nm.length > 120) errors.traveller_name = 'One of the names is too long.';
  }

  // A named party larger than the places booked is a mistake worth catching.
  if (Number.isFinite(party_size) && travellers.length > party_size) {
    errors.party_size = 'You have named more travellers than the places you are booking.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      departure_id,
      party_size: Number.isFinite(party_size) && party_size >= 1 ? party_size : 1,
      travellers,
      package_id,
    },
  };
}

/** Local copy so this module stays free of the repo layer. Same shape as
 *  repo.isUuid; duplicated deliberately to keep this file pure and importable
 *  by tests without pulling in server-only code. */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}
