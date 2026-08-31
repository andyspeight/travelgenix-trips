// =============================================================================
//  POST /api/v1/trips — create a draft trip, authenticated
// =============================================================================
//  The write half of the API. A partner system pushes a trip in from their own
//  inventory. Authenticated with an operator API key; the trip is created for
//  THAT operator and always as a DRAFT — the API can never publish, so nothing
//  goes live to travellers without a human publishing it in the console.
//
//  The body runs through the SAME validateTrip the console editor uses, so a
//  malformed or hostile field is rejected or sanitised exactly as it would be on
//  screen; the API is not a back door around validation.
// =============================================================================

import { authenticateApiKey, apiJson, apiUnauthorised } from '@/lib/api-auth';
import { createTrip } from '@/lib/repo';
import { validateTrip } from '@/lib/validate';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  if (!tripsDbConfigured()) return apiJson({ error: 'not_found' }, 404);

  const operatorId = await authenticateApiKey(req);
  if (!operatorId) return apiUnauthorised();

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return apiJson({ error: 'invalid_body', message: 'Send a JSON object.' }, 400);
  }

  const { ok, errors, value } = validateTrip(body);
  if (!ok) return apiJson({ error: 'invalid', fields: errors }, 422);

  const created = await createTrip(operatorId, value);
  if (!created) return apiJson({ error: 'create_failed', message: 'The trip could not be created.' }, 500);

  return apiJson(
    {
      object: 'trip',
      id: created.id,
      slug: created.slug,
      status: created.status,
      title: created.title,
      kind: created.kind,
      currency: created.currency,
    },
    201,
  );
}
