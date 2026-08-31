// =============================================================================
//  lib/api-auth.ts — authenticate the v1 data API
// =============================================================================
//  The gate for the authenticated endpoints. A request presents an operator key
//  as `Authorization: Bearer tgk_live_...`; this resolves it to the owning
//  operator id, or nothing. Server-to-server, so there is no CORS here and no
//  cookies: the key is the whole identity.
//
//  Fails closed at every step — no header, wrong scheme, wrong shape, unknown or
//  revoked key all resolve to null, and the caller answers 401 the same way.
// =============================================================================

import 'server-only';
import { parseBearer, looksLikeApiKey } from './apikeys.ts';
import { findOperatorIdByApiKey } from './repo.ts';

/** Resolve a request's bearer key to an operator id, or null. */
export async function authenticateApiKey(req: Request): Promise<string | null> {
  const token = parseBearer(req.headers.get('authorization'));
  if (!looksLikeApiKey(token)) return null;
  return findOperatorIdByApiKey(token);
}

/** A JSON response with no-store, the default for authenticated data. */
export function apiJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** The one 401 every authenticated endpoint gives, with the scheme hint. */
export function apiUnauthorised(): Response {
  return new Response(JSON.stringify({ error: 'unauthorised', message: 'Provide a valid API key as a Bearer token.' }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'www-authenticate': 'Bearer realm="Travelgenix Trips API"',
    },
  });
}
