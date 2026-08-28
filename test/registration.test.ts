// The registration layer is operator + traveller input that drives a mandatory
// legal gate, so every rule is a control. Tested at the edges.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitiseFormSchema, sanitiseWaiverInput, nextFieldKey, sha256Hex,
  validateRegistration, isRegistrationComplete,
} from '../src/lib/registration.ts';
import type { RegField } from '../src/lib/types.ts';

// --- form schema ------------------------------------------------------------

test('sanitiseFormSchema keeps sane fields, mints missing keys, drops junk', () => {
  const s = sanitiseFormSchema([
    { label: 'Dietary needs', type: 'long_text', scope: 'traveller', required: true },
    { label: '', type: 'short_text' },                                   // no label -> dropped
    { key: 'q1', label: 'Emergency contact', type: 'phone', scope: 'booking' }, // key collides with minted q1
    { label: 'T-shirt size', type: 'select', options: ['S', 'M', '', 'L'] },
    { label: 'Broken choose', type: 'select', options: [] },             // select, no options -> dropped
  ]);

  assert.equal(s.length, 3, 'two junk fields dropped');
  assert.equal(s[0]?.key, 'q1');
  assert.equal(s[0]?.required, true);
  assert.equal(s[1]?.scope, 'booking');
  assert.notEqual(s[1]?.key, s[0]?.key, 'colliding key re-minted, stays unique');
  assert.deepEqual(s[2]?.options, ['S', 'M', 'L'], 'blank option dropped');
});

test('sanitiseFormSchema preserves an existing stable key when unique', () => {
  const s = sanitiseFormSchema([{ key: 'q7', label: 'Passport number', type: 'short_text', scope: 'traveller' }]);
  assert.equal(s[0]?.key, 'q7', 'a valid unique key is kept, so stored answers still match');
});

test('nextFieldKey returns the first free q-slot', () => {
  assert.equal(nextFieldKey([]), 'q1');
  assert.equal(nextFieldKey(['q1', 'q2', 'q4']), 'q3');
});

// --- waiver -----------------------------------------------------------------

test('sanitiseWaiverInput: no body means remove, defaults otherwise', () => {
  assert.equal(sanitiseWaiverInput({ title: 'x', body: '  ' }), null);
  const w = sanitiseWaiverInput({ body: 'You travel at your own risk.' });
  assert.equal(w?.title, 'Booking agreement', 'a title is defaulted');
  assert.equal(w?.is_mandatory, true, 'mandatory by default');
  assert.equal(sanitiseWaiverInput({ body: 'x', is_mandatory: false })?.is_mandatory, false);
});

test('sha256Hex matches the known vector for "abc"', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// --- registration submission ------------------------------------------------

const SCHEMA: RegField[] = [
  { key: 'q1', label: 'Dietary', type: 'short_text', scope: 'traveller', required: true },
  { key: 'q2', label: 'Shirt', type: 'select', scope: 'traveller', required: false, options: ['S', 'M'] },
  { key: 'q3', label: 'Emergency contact', type: 'phone', scope: 'booking', required: true },
  { key: 'q4', label: 'I agree to the terms', type: 'checkbox', scope: 'booking', required: true },
];
const WAIVER = { is_mandatory: true };

type Sub = {
  travellers: Array<{
    id: string | null; full_name: string; email?: string; phone?: string;
    date_of_birth?: string; answers: Record<string, string>; signed: boolean; signed_name: string;
  }>;
  booking_answers: Record<string, string>;
};

function goodSubmission(): Sub {
  return {
    travellers: [
      { id: null, full_name: 'Ada Lovelace', email: 'ada@example.com', date_of_birth: '1990-12-10', answers: { q1: 'None', q2: 'M' }, signed: true, signed_name: 'Ada Lovelace' },
      { id: null, full_name: 'Alan Turing', answers: { q1: 'Vegetarian' }, signed: true, signed_name: 'Alan Turing' },
    ],
    booking_answers: { q3: '07700 900123', q4: 'on' },
  };
}

test('a complete submission validates and cleans', () => {
  const r = validateRegistration(SCHEMA, WAIVER, 2, goodSubmission());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.travellers.length, 2);
  assert.equal(r.value.travellers[0]?.answers.q2, 'M');
  assert.equal(r.value.travellers[0]?.signed_name, 'Ada Lovelace');
  assert.equal(r.value.booking_answers.q4, 'Yes', 'ticked box normalises to Yes');
});

test('party_size is authoritative: an unnamed second slot fails', () => {
  const sub = goodSubmission();
  sub.travellers = [sub.travellers[0]!]; // only one slot for a party of two
  const r = validateRegistration(SCHEMA, WAIVER, 2, sub);
  assert.equal(r.ok, false);
  assert.ok(r.errors['t1.full_name'], 'the missing second traveller is flagged');
});

test('a mandatory waiver is a gate: unsigned fails', () => {
  const sub = goodSubmission();
  sub.travellers[1]!.signed = false;
  const r = validateRegistration(SCHEMA, WAIVER, 2, sub);
  assert.equal(r.ok, false);
  assert.ok(r.errors['t1.waiver']);
});

test('a required question and a required tick box are enforced', () => {
  const sub = goodSubmission();
  sub.travellers[0]!.answers = {};        // drop required q1
  sub.booking_answers = { q3: '07700 900123' }; // drop required q4 tick
  const r = validateRegistration(SCHEMA, WAIVER, 2, sub);
  assert.equal(r.ok, false);
  assert.ok(r.errors['t0.q1'], 'required per-traveller question flagged');
  assert.ok(r.errors['booking.q4'], 'unticked required box flagged');
});

test('a bad select option and a bad email are rejected', () => {
  const sub = goodSubmission();
  sub.travellers[0]!.answers.q2 = 'XL';         // not an option
  sub.travellers[0]!.email = 'not-an-email';
  const r = validateRegistration(SCHEMA, WAIVER, 2, sub);
  assert.equal(r.ok, false);
  assert.ok(r.errors['t0.q2']);
  assert.ok(r.errors['t0.email']);
});

test('with no mandatory waiver, signatures are optional', () => {
  const sub = goodSubmission();
  sub.travellers.forEach((t) => { t.signed = false; t.signed_name = ''; });
  const r = validateRegistration(SCHEMA, null, 2, sub);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

// --- completion -------------------------------------------------------------

test('isRegistrationComplete needs names, required answers and signatures', () => {
  const base = {
    partySize: 2,
    schema: SCHEMA,
    waiver: { id: 'w', version: 1, is_mandatory: true },
    travellers: [{ id: 'a', full_name: 'Ada' }, { id: 'b', full_name: 'Alan' }],
    travellerAnswers: new Map([['a', new Set(['q1'])], ['b', new Set(['q1'])]]),
    bookingAnswers: new Set(['q3', 'q4']),
    signedTravellerIds: new Set(['a', 'b']),
  };
  assert.equal(isRegistrationComplete(base), true);

  assert.equal(isRegistrationComplete({ ...base, signedTravellerIds: new Set(['a']) }), false, 'one unsigned');
  assert.equal(isRegistrationComplete({ ...base, bookingAnswers: new Set(['q3']) }), false, 'missing booking answer');
  assert.equal(isRegistrationComplete({ ...base, travellers: [{ id: 'a', full_name: 'Ada' }, { id: 'b', full_name: '' }] }), false, 'a place unnamed');
  assert.equal(isRegistrationComplete({ ...base, travellerAnswers: new Map([['a', new Set(['q1'])], ['b', new Set()]]) }), false, 'a required answer missing');
});

// --- document fields --------------------------------------------------------

test('sanitiseFormSchema keeps a document field and drops its junk options', () => {
  const s = sanitiseFormSchema([
    { key: 'q1', label: 'Passport', type: 'document', scope: 'traveller', required: true, options: ['ignored'] },
  ]);
  assert.equal(s.length, 1);
  assert.equal(s[0]?.type, 'document');
  assert.equal(s[0]?.required, true);
  assert.equal(s[0]?.options, undefined, 'a document has no options');
});

test('a required document field does not fail form validation (uploaded out of band)', () => {
  const schema: RegField[] = [
    { key: 'q1', label: 'Passport', type: 'document', scope: 'traveller', required: true },
    { key: 'q2', label: 'Group insurance', type: 'document', scope: 'booking', required: true },
  ];
  // No file in the payload, yet validation passes: documents are not answers.
  const sub = {
    travellers: [{ id: null, full_name: 'Ada Lovelace', answers: {}, signed: false, signed_name: '' }],
    booking_answers: {},
  };
  const r = validateRegistration(schema, null, 1, sub);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.travellers[0]?.answers.q1, undefined, 'no phantom answer stored for a document');
});

test('a required document gates completeness once folded into the answered set', () => {
  const schema: RegField[] = [
    { key: 'q1', label: 'Passport', type: 'document', scope: 'traveller', required: true },
    { key: 'q2', label: 'Insurance', type: 'document', scope: 'booking', required: true },
  ];
  const base = {
    partySize: 1,
    schema,
    waiver: null,
    travellers: [{ id: 'a', full_name: 'Ada' }],
    travellerAnswers: new Map<string, Set<string>>([['a', new Set(['q1'])]]),
    bookingAnswers: new Set(['q2']),
    signedTravellerIds: new Set<string>(),
  };
  assert.equal(isRegistrationComplete(base), true, 'both documents present');
  assert.equal(isRegistrationComplete({ ...base, travellerAnswers: new Map([['a', new Set<string>()]]) }), false, 'traveller passport missing');
  assert.equal(isRegistrationComplete({ ...base, bookingAnswers: new Set<string>() }), false, 'booking insurance missing');
});
