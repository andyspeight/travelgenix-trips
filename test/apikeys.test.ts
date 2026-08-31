// An API key is a bearer credential, so minting must be unpredictable, the
// stored hash must be a stable one-way function, and the header parser must not
// accept a malformed Authorization line.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mintApiKey, hashApiKey, keyPrefix, looksLikeApiKey, parseBearer, API_KEY_PREFIX,
} from '../src/lib/apikeys.ts';

test('minted keys are prefixed, high-entropy and unique', () => {
  const a = mintApiKey();
  const b = mintApiKey();
  assert.notEqual(a, b);
  assert.ok(a.startsWith(API_KEY_PREFIX));
  assert.match(a, /^tgk_live_[0-9a-f]{48}$/);
});

test('hashing is deterministic, hex, and one-way', () => {
  const key = mintApiKey();
  assert.equal(hashApiKey(key), hashApiKey(key));
  assert.match(hashApiKey(key), /^[0-9a-f]{64}$/);
  assert.notEqual(hashApiKey(key), key); // the stored value is not the key
  assert.notEqual(hashApiKey('a'), hashApiKey('b'));
});

test('the prefix stub is short and non-authenticating', () => {
  const key = mintApiKey();
  const p = keyPrefix(key);
  assert.equal(p.length, API_KEY_PREFIX.length + 6);
  assert.ok(key.startsWith(p));
  assert.ok(p.length < key.length);
});

test('shape guard admits real keys and rejects junk', () => {
  assert.ok(looksLikeApiKey(mintApiKey()));
  assert.equal(looksLikeApiKey('tgk_live_short'), false);
  assert.equal(looksLikeApiKey('sk_live_' + 'a'.repeat(48)), false);
  assert.equal(looksLikeApiKey(42), false);
  assert.equal(looksLikeApiKey(null), false);
});

test('bearer parsing is case-insensitive and strict', () => {
  const key = mintApiKey();
  assert.equal(parseBearer(`Bearer ${key}`), key);
  assert.equal(parseBearer(`bearer ${key}`), key);
  assert.equal(parseBearer(`  Bearer   ${key}  `), key);
  assert.equal(parseBearer(key), null); // no scheme
  assert.equal(parseBearer('Basic abc123'), null); // wrong scheme
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(''), null);
});
