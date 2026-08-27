// =============================================================================
//  lib/registration.ts — the people layer, the pure parts
// =============================================================================
//
//  Phase 4. Three jobs, all kept free of the database so the rules are tested
//  without one, exactly like booking.ts and content.ts:
//
//    1. Sanitise a custom FORM SCHEMA an operator builds. It is operator input
//       that will be shown to travellers, so the server never trusts it: this
//       clamps every label, keeps keys stable and unique, and drops junk.
//    2. Validate a traveller's REGISTRATION submission against that schema and
//       the trip's waiver, including the mandatory-waiver gate that is one of
//       WeTravel's named gaps.
//    3. Decide from stored data whether a booking's registration is COMPLETE,
//       so the operator manifest can show it without a flag that could go stale.
//
//  Answers are stored under RegField.key, which is why a key must never change
//  when a label is reworded.
// =============================================================================

import { looksLikeEmail } from './booking.ts';
import type { FieldErrors } from './action-state.ts';
import type {
  RegField, RegFieldType, RegScope, Waiver,
} from './types.ts';

// ---------------------------------------------------------------------------
//  Field types the builder offers. The label is what the operator picks from.
// ---------------------------------------------------------------------------

export const FIELD_TYPES: ReadonlyArray<{ type: RegFieldType; label: string; hasOptions?: boolean }> = [
  { type: 'short_text', label: 'Short text' },
  { type: 'long_text', label: 'Long text' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'date', label: 'Date' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Choose one', hasOptions: true },
  { type: 'checkbox', label: 'Tick box' },
];

const VALID_TYPES = new Set<RegFieldType>(FIELD_TYPES.map((f) => f.type));

const MAX = { label: 160, help: 300, option: 120, options: 20, fields: 40, answer: 2000, name: 120, phone: 40 };

const str = (v: unknown, cap: number): string => (typeof v === 'string' ? v : '').trim().slice(0, cap);
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 'on' || v === 'yes' || v === 'Yes';

// ---------------------------------------------------------------------------
//  Field keys — stable, unique, minted without leaking anything guessable.
// ---------------------------------------------------------------------------

/** The next free `q<n>` key not already used. Deterministic, so the editor and
 *  the sanitiser agree and a test can assert it. */
export function nextFieldKey(used: Iterable<string>): string {
  const set = new Set(used);
  for (let n = 1; n <= MAX.fields + 1; n++) {
    const k = `q${n}`;
    if (!set.has(k)) return k;
  }
  return `q${MAX.fields + 2}`;
}

// ---------------------------------------------------------------------------
//  1. Sanitise a form schema
// ---------------------------------------------------------------------------

function sanitiseField(raw: unknown, used: Set<string>): RegField | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const label = str(o.label, MAX.label);
  if (!label) return null; // a question with no label is not a question

  const type: RegFieldType = VALID_TYPES.has(o.type as RegFieldType)
    ? (o.type as RegFieldType)
    : 'short_text';
  const scope: RegScope = o.scope === 'booking' ? 'booking' : 'traveller';

  // Keep a provided key if it is sane and unused; otherwise mint a fresh one.
  let key = str(o.key, 24).replace(/[^a-z0-9_]/gi, '');
  if (!key || used.has(key)) key = nextFieldKey(used);
  used.add(key);

  const field: RegField = { key, label, type, scope, required: bool(o.required) };

  const help = str(o.help, MAX.help);
  if (help) field.help = help;

  if (type === 'select') {
    const options = (Array.isArray(o.options) ? o.options : [])
      .map((x) => str(x, MAX.option))
      .filter(Boolean)
      .slice(0, MAX.options);
    // A choose-one with nothing to choose is broken, so it is dropped entirely.
    if (options.length === 0) return null;
    field.options = options;
  }

  return field;
}

/** The authority over a form an operator built. */
export function sanitiseFormSchema(raw: unknown): RegField[] {
  const list = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  const out: RegField[] = [];
  for (const item of list.slice(0, MAX.fields)) {
    const f = sanitiseField(item, used);
    if (f) out.push(f);
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Waiver input
// ---------------------------------------------------------------------------

export interface WaiverInput { title: string; body: string; is_mandatory: boolean }

/** Clean an operator's waiver. Returns null when there is nothing to save (no
 *  body), which the caller treats as "remove the waiver". */
export function sanitiseWaiverInput(raw: unknown): WaiverInput | null {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const body = str(o.body, 20000);
  if (!body) return null;
  const title = str(o.title, 200) || 'Booking agreement';
  return { title, body, is_mandatory: o.is_mandatory === undefined ? true : bool(o.is_mandatory) };
}

// ---------------------------------------------------------------------------
//  A SHA-256 of the exact waiver text, so a signature pins what was signed.
// ---------------------------------------------------------------------------

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
//  2. Validate a registration submission
// ---------------------------------------------------------------------------

export interface RegTravellerInput {
  id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  answers: Record<string, string>;
  signed: boolean;
  signed_name: string;
}

export interface RegistrationInput {
  travellers: RegTravellerInput[];
  booking_answers: Record<string, string>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Validate and clean ONE answer against its field. Returns the cleaned string
 *  to store, or an error sentence. An empty optional answer is cleaned to ''. */
function cleanAnswer(field: RegField, raw: unknown): { value: string } | { error: string } {
  const v = str(raw, MAX.answer);

  if (!v) {
    return field.required ? { error: 'This is required.' } : { value: '' };
  }

  switch (field.type) {
    case 'email':
      return looksLikeEmail(v) ? { value: v } : { error: 'That email does not look right.' };
    case 'phone':
      return v.length <= MAX.phone ? { value: v } : { error: 'That is too long.' };
    case 'date':
      return isIsoDate(v) ? { value: v } : { error: 'Use a real date.' };
    case 'number':
      return Number.isFinite(Number(v)) ? { value: String(Number(v)) } : { error: 'Numbers only.' };
    case 'select':
      return field.options?.includes(v) ? { value: v } : { error: 'Choose one of the options.' };
    case 'checkbox':
      // A required tick box must be ticked (an "I agree" line).
      return bool(v) ? { value: 'Yes' } : field.required ? { error: 'Please tick to continue.' } : { value: 'No' };
    default:
      return { value: v };
  }
}

function cleanAnswers(fields: RegField[], scope: RegScope, raw: Record<string, unknown>, prefix: string, errors: FieldErrors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.scope !== scope) continue;
    const res = cleanAnswer(f, raw?.[f.key]);
    if ('error' in res) errors[`${prefix}${f.key}`] = res.error;
    else if (res.value) out[f.key] = res.value;
  }
  return out;
}

export interface ValidatedRegistration {
  travellers: Array<{
    id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    answers: Record<string, string>;
    signed_name: string | null;
  }>;
  booking_answers: Record<string, string>;
}

/**
 * Validate a whole registration. `partySize` is authoritative: exactly that many
 * traveller slots are expected, every one named. A mandatory waiver requires a
 * signature from every traveller — that is the gate.
 */
export function validateRegistration(
  schema: RegField[],
  waiver: Pick<Waiver, 'is_mandatory'> | null,
  partySize: number,
  raw: unknown,
): { ok: boolean; errors: FieldErrors; value: ValidatedRegistration } {
  const errors: FieldErrors = {};
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const slots = Array.isArray(o.travellers) ? (o.travellers as Record<string, unknown>[]) : [];

  const mandatory = !!waiver?.is_mandatory;
  const travellers: ValidatedRegistration['travellers'] = [];

  for (let i = 0; i < partySize; i++) {
    const t = (slots[i] ?? {}) as Record<string, unknown>;
    const full_name = str(t.full_name, MAX.name);
    if (!full_name) errors[`t${i}.full_name`] = 'We need this traveller’s name.';

    const email = str(t.email, 254);
    if (email && !looksLikeEmail(email)) errors[`t${i}.email`] = 'That email does not look right.';

    const phone = str(t.phone, MAX.phone);

    const dob = str(t.date_of_birth, 10);
    if (dob && !isIsoDate(dob)) errors[`t${i}.date_of_birth`] = 'Use a real date.';

    const answers = cleanAnswers(schema, 'traveller', (t.answers ?? {}) as Record<string, unknown>, `t${i}.`, errors);

    let signed_name: string | null = null;
    if (mandatory) {
      const signed = bool(t.signed);
      const sn = str(t.signed_name, MAX.name);
      if (!signed || !sn) errors[`t${i}.waiver`] = 'Please read and sign the agreement.';
      else signed_name = sn;
    } else {
      const sn = str(t.signed_name, MAX.name);
      if (bool(t.signed) && sn) signed_name = sn;
    }

    const id = str(t.id, 40);
    travellers.push({
      id: /^[0-9a-f-]{36}$/i.test(id) ? id : null,
      full_name, email: email || null, phone: phone || null,
      date_of_birth: dob && isIsoDate(dob) ? dob : null,
      answers, signed_name,
    });
  }

  const booking_answers = cleanAnswers(schema, 'booking', (o.booking_answers ?? {}) as Record<string, unknown>, 'booking.', errors);

  return { ok: Object.keys(errors).length === 0, errors, value: { travellers, booking_answers } };
}

// ---------------------------------------------------------------------------
//  3. Is a booking's registration complete? Read from stored rows.
// ---------------------------------------------------------------------------

export interface CompletionInput {
  partySize: number;
  schema: RegField[];
  waiver: Pick<Waiver, 'id' | 'version' | 'is_mandatory'> | null;
  travellers: Array<{ id: string; full_name: string | null }>;
  /** Per-traveller answers: traveller id -> answered field keys. */
  travellerAnswers: Map<string, Set<string>>;
  /** Answered booking-level field keys. */
  bookingAnswers: Set<string>;
  /** Traveller ids that carry a valid signature on the CURRENT waiver version. */
  signedTravellerIds: Set<string>;
}

/** True only when every place is named, every required question is answered, and
 *  — if the waiver is mandatory — every traveller has signed the current
 *  version. Anything short of that is "in progress", never silently "done". */
export function isRegistrationComplete(input: CompletionInput): boolean {
  const named = input.travellers.filter((t) => (t.full_name ?? '').trim());
  if (named.length < input.partySize) return false;

  const reqTraveller = input.schema.filter((f) => f.scope === 'traveller' && f.required).map((f) => f.key);
  const reqBooking = input.schema.filter((f) => f.scope === 'booking' && f.required).map((f) => f.key);

  for (const key of reqBooking) {
    if (!input.bookingAnswers.has(key)) return false;
  }

  for (const t of named) {
    const answered = input.travellerAnswers.get(t.id) ?? new Set<string>();
    for (const key of reqTraveller) if (!answered.has(key)) return false;
    if (input.waiver?.is_mandatory && !input.signedTravellerIds.has(t.id)) return false;
  }

  return true;
}
