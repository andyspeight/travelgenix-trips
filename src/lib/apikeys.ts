// =============================================================================
//  lib/apikeys.ts — operator API keys (the authenticated data API)
// =============================================================================
//  The pure core of API-key auth. A key is a bearer token an operator sends as
//  `Authorization: Bearer tgk_live_...` to read their bookings and create draft
//  trips. Two rules make this safe and are unit-tested without a database:
//
//    * we store only the SHA-256 HASH of a key, never the key itself, so a leak
//      of the database does not leak usable keys. hashApiKey is what we persist
//      and what we look up by.
//    * the key is high-entropy random and shown to the operator exactly once at
//      creation; keyPrefix keeps just enough in clear to tell keys apart.
//
//  Runs on the Node serverless runtime, so node:crypto keeps hashing synchronous
//  and dependency-free.
// =============================================================================

import { createHash, randomBytes } from 'node:crypto';

/** Every key starts with this, so a leaked string is recognisably a Trips key
 *  (and a secret scanner can spot one). `live` leaves room for a `test` variant. */
export const API_KEY_PREFIX = 'tgk_live_';

/** A fresh key: the prefix plus 24 random bytes of hex (192 bits of entropy). */
export function mintApiKey(): string {
  return API_KEY_PREFIX + randomBytes(24).toString('hex');
}

/** What we store and authenticate by. Never reversible to the key. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** The visible stub kept in clear for a list view: the prefix plus 6 characters,
 *  e.g. "tgk_live_a1b2c3". Enough to recognise, useless to authenticate with. */
export function keyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + 6);
}

/** A cheap shape check before we bother hashing and hitting the database. */
export function looksLikeApiKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(API_KEY_PREFIX) && key.length >= API_KEY_PREFIX.length + 32;
}

/** Pull the token out of an `Authorization: Bearer <token>` header, or null. The
 *  scheme match is case-insensitive; the token itself is returned untouched. */
export function parseBearer(header: string | null | undefined): string | null {
  if (typeof header !== 'string') return null;
  const m = header.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return m ? m[1]! : null;
}
