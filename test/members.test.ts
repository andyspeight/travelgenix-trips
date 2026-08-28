// Team-role resolution is an authorisation boundary, so the tests go after the
// edges: the contact is always owner, an empty team means everyone is owner, a
// configured team makes strangers read-only, and case never matters.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOperatorRole, canEdit, canManageTeam, validateMember, emailKey,
} from '../src/lib/members.ts';
import type { OperatorRole } from '../src/lib/types.ts';

const m = (email: string, role: OperatorRole) => ({ email, role });

test('the contact is always owner, whatever the member list says', () => {
  assert.equal(resolveOperatorRole('boss@agency.com', 'boss@agency.com', []), 'owner');
  // Even a row trying to demote the contact cannot: the contact wins.
  assert.equal(resolveOperatorRole('boss@agency.com', 'BOSS@agency.com', [m('boss@agency.com', 'viewer')]), 'owner');
});

test('an empty team means everyone under the client is owner (no lockout)', () => {
  assert.equal(resolveOperatorRole('boss@agency.com', 'someone-else@agency.com', []), 'owner');
});

test('a configured team gives listed people their role', () => {
  const members = [m('manager@agency.com', 'manager'), m('reader@agency.com', 'viewer')];
  assert.equal(resolveOperatorRole('boss@agency.com', 'manager@agency.com', members), 'manager');
  assert.equal(resolveOperatorRole('boss@agency.com', 'reader@agency.com', members), 'viewer');
});

test('a configured team makes an unlisted person read-only, not shut out', () => {
  const members = [m('manager@agency.com', 'manager')];
  assert.equal(resolveOperatorRole('boss@agency.com', 'stranger@agency.com', members), 'viewer');
});

test('email comparison ignores case and surrounding space', () => {
  const members = [m('Manager@Agency.com', 'manager')];
  assert.equal(resolveOperatorRole('boss@agency.com', '  manager@agency.com  ', members), 'manager');
  assert.equal(emailKey('  Foo@Bar.COM '), 'foo@bar.com');
});

test('canEdit and canManageTeam draw the right lines', () => {
  assert.equal(canEdit('owner'), true);
  assert.equal(canEdit('manager'), true);
  assert.equal(canEdit('viewer'), false);
  assert.equal(canManageTeam('owner'), true);
  assert.equal(canManageTeam('manager'), false);
  assert.equal(canManageTeam('viewer'), false);
});

test('validateMember needs a real email and defaults an unknown role to viewer', () => {
  assert.ok(!validateMember({ email: 'nope', role: 'manager' }).ok);
  assert.ok(!validateMember({ email: '', role: 'manager' }).ok);
  const r = validateMember({ email: 'New@Person.com', role: 'nonsense' });
  assert.equal(r.ok, true);
  assert.equal(r.value.email, 'new@person.com', 'email is normalised to lowercase');
  assert.equal(r.value.role, 'viewer');
});

test('validateMember keeps a valid role', () => {
  assert.equal(validateMember({ email: 'a@b.com', role: 'manager' }).value.role, 'manager');
  assert.equal(validateMember({ email: 'a@b.com', role: 'owner' }).value.role, 'owner');
});
