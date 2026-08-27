// The reference is read aloud on the phone and typed into an app, and the
// booking form is the last gate before real traveller PII enters the system.
// Both are tested for the awkward cases, not the happy path.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeReference, isReference, normaliseReference, looksLikeEmail, validateBooking, MAX_PARTY,
} from '../src/lib/booking.ts';

// A deterministic byte source: 0,1,2,3,... so the output is predictable.
const seq = (n: number) => Uint8Array.from(Array.from({ length: n }, (_, i) => i));

test('a reference has the quotable shape', () => {
  const ref = makeReference(seq);
  assert.match(ref, /^TGT-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.ok(isReference(ref));
});

test('the alphabet excludes look-alike and sound-alike characters', () => {
  // Build a reference from every byte value and confirm no banned char appears.
  const big = makeReference((n) => Uint8Array.from(Array.from({ length: n }, (_, i) => i * 9)));
  for (const banned of ['0', 'O', '1', 'I', 'L', 'S', '5', '2', 'Z']) {
    assert.ok(!big.includes(banned), `reference must not contain ${banned}`);
  }
});

test('isReference rejects junk and near-misses', () => {
  assert.equal(isReference('TGT-ABCD-EFGH'), true);
  assert.equal(isReference('tgt-abcd-efgh'), true, 'case-insensitive');
  assert.equal(isReference('TGT-ABC-EFGH'), false, 'wrong group length');
  assert.equal(isReference('TGT-ABCD'), false, 'missing a group');
  assert.equal(isReference('XXX-ABCD-EFGH'), false, 'wrong prefix');
  assert.equal(isReference('TGT-AB0D-EFGH'), false, 'contains a banned 0');
  assert.equal(isReference(''), false);
});

test('normaliseReference fixes what a human types', () => {
  assert.equal(normaliseReference('tgt abcd efgh'), 'TGT-ABCD-EFGH');
  assert.equal(normaliseReference('TGTABCDEFGH'), 'TGT-ABCD-EFGH', 'no dashes');
  assert.equal(normaliseReference('  ABCD-EFGH '), 'TGT-ABCD-EFGH', 'no prefix');
  assert.equal(normaliseReference('nonsense'), null);
  assert.equal(normaliseReference('TGT-AB0D-EFGH'), null, 'banned char is not repaired');
});

test('email check accepts the ordinary and rejects the broken', () => {
  for (const good of ['a@b.co', 'andy.speight@agendas.group', 'x+tag@sub.domain.io']) {
    assert.ok(looksLikeEmail(good), good);
  }
  for (const bad of ['', 'no-at', 'a@b', 'a@@b.co', 'a b@c.co', 'a@b .co']) {
    assert.ok(!looksLikeEmail(bad), bad);
  }
});

const DEP = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const good = { departure_id: DEP, party_size: '2', lead_name: 'Priya Chauhan', lead_email: 'priya@example.com', lead_phone: '07700 900123' };

test('a good booking validates and carries a lead traveller', () => {
  const r = validateBooking(good);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.party_size, 2);
  assert.equal(r.value.travellers.length, 1);
  assert.equal(r.value.travellers[0]!.is_lead, true);
  assert.equal(r.value.travellers[0]!.full_name, 'Priya Chauhan');
});

test('a departure must be chosen, and it must be a real id', () => {
  assert.equal(validateBooking({ ...good, departure_id: '' }).ok, false);
  assert.equal(validateBooking({ ...good, departure_id: 'not-a-uuid' }).ok, false);
});

test('the lead name and email are required', () => {
  assert.ok(validateBooking({ ...good, lead_name: '  ' }).errors.lead_name);
  assert.ok(validateBooking({ ...good, lead_email: '' }).errors.lead_email);
  assert.ok(validateBooking({ ...good, lead_email: 'broken' }).errors.lead_email);
});

test('phone is optional', () => {
  const r = validateBooking({ ...good, lead_phone: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.travellers[0]!.phone, null);
});

test('party size is bounded at both ends', () => {
  assert.ok(validateBooking({ ...good, party_size: '0' }).errors.party_size);
  assert.ok(validateBooking({ ...good, party_size: String(MAX_PARTY + 1) }).errors.party_size);
  assert.equal(validateBooking({ ...good, party_size: String(MAX_PARTY) }).ok, true);
});

test('a blank party size defaults to one place', () => {
  const r = validateBooking({ ...good, party_size: '' });
  assert.equal(r.value.party_size, 1);
});

test('additional travellers are collected, blanks dropped', () => {
  const r = validateBooking({
    ...good, party_size: '3',
    traveller_name: ['Sanjay Chauhan', '', 'Meera Chauhan'],
  });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  // lead + two named, the blank dropped
  assert.equal(r.value.travellers.length, 3);
  assert.equal(r.value.travellers[1]!.full_name, 'Sanjay Chauhan');
  assert.equal(r.value.travellers[2]!.full_name, 'Meera Chauhan');
  assert.ok(r.value.travellers.slice(1).every((t) => !t.is_lead));
});

test('naming more people than places booked is caught', () => {
  const r = validateBooking({
    ...good, party_size: '2',
    traveller_name: ['A Name', 'B Name', 'C Name'], // 3 named + lead = 4 > 2
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.party_size);
});

test('a single additional traveller (not an array) is handled', () => {
  const r = validateBooking({ ...good, party_size: '2', traveller_name: 'Solo Name' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.travellers.length, 2);
});

test('a well-formed package id passes through; junk and absence become null', () => {
  const pkg = '3d9923ed-5a68-4da7-a0a7-fc1f5d131669';
  assert.equal(validateBooking({ ...good, package_id: pkg }).value.package_id, pkg);
  assert.equal(validateBooking({ ...good, package_id: 'not-a-uuid' }).value.package_id, null);
  assert.equal(validateBooking(good).value.package_id, null, 'absent means null');
});

const OPT_A = '11111111-1111-4111-8111-111111111111';
const OPT_B = '22222222-2222-4222-8222-222222222222';

test('chosen add-on ids are kept, junk dropped, order preserved', () => {
  const r = validateBooking({ ...good, option_id: [OPT_A, 'not-a-uuid', OPT_B] });
  assert.deepEqual(r.value.option_ids, [OPT_A, OPT_B]);
});

test('a single add-on (not an array) is handled, and absence is an empty list', () => {
  assert.deepEqual(validateBooking({ ...good, option_id: OPT_A }).value.option_ids, [OPT_A]);
  assert.deepEqual(validateBooking(good).value.option_ids, []);
});

test('duplicate add-on ids are collapsed', () => {
  const r = validateBooking({ ...good, option_id: [OPT_A, OPT_A, OPT_B] });
  assert.deepEqual(r.value.option_ids, [OPT_A, OPT_B]);
});
