// =============================================================================
//  GET /api/v1/bookings — the authenticated bookings list
// =============================================================================
//  A partner system pulls the operator's bookings programmatically: the pull
//  complement to the webhooks (push) and the CSV (manual). Authenticated with an
//  operator API key as a Bearer token; returns only that operator's bookings.
//  Server-to-server, so no CORS and no cookies. The money reconciles with the
//  Reports screen, the CSV and the webhooks because they all share finance.ts.
// =============================================================================

import { authenticateApiKey, apiJson, apiUnauthorised } from '@/lib/api-auth';
import { listOperatorBookingsForExport } from '@/lib/repo';
import { bookingJson } from '@/lib/finance';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (!tripsDbConfigured()) return apiJson({ error: 'not_found' }, 404);

  const operatorId = await authenticateApiKey(req);
  if (!operatorId) return apiUnauthorised();

  const rows = await listOperatorBookingsForExport(operatorId);
  return apiJson({ object: 'list', count: rows.length, data: rows.map(bookingJson) });
}
