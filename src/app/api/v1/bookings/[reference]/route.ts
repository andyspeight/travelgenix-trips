// =============================================================================
//  GET /api/v1/bookings/{reference} — one booking, authenticated
// =============================================================================
//  The single-booking read for a partner system that holds a reference (e.g.
//  from a webhook it received). Authenticated with an operator API key; scoped
//  to the operator, so a reference that is not theirs returns 404, never another
//  operator's booking.
// =============================================================================

import { authenticateApiKey, apiJson, apiUnauthorised } from '@/lib/api-auth';
import { getApiBookingByReference } from '@/lib/repo';
import { bookingJson } from '@/lib/finance';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }): Promise<Response> {
  if (!tripsDbConfigured()) return apiJson({ error: 'not_found' }, 404);

  const operatorId = await authenticateApiKey(req);
  if (!operatorId) return apiUnauthorised();

  const { reference } = await params;
  const row = await getApiBookingByReference(operatorId, reference);
  if (!row) return apiJson({ error: 'not_found' }, 404);

  return apiJson(bookingJson(row));
}
