// =============================================================================
//  GET /api/v1/trips/{id}/reviews
// =============================================================================
//  The public read the reviews embed points at: APPROVED reviews for a published
//  trip, newest first, plus the star roll-up. No pending or hidden reviews, no
//  booking ids, no reviewer email. CORS-open like the other v1 reads. Fails calm
//  to an empty list.
// =============================================================================

import { sbRequest, tripsDbConfigured } from '@/lib/supabase';
import { getApprovedReviews, isUuid } from '@/lib/repo';
import type { Trip } from '@/lib/types';

export const revalidate = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!tripsDbConfigured()) return json({ error: 'not_found' }, 404);

  // Resolve to a real PUBLISHED trip (uuid or legacy widget id), so reviews are
  // only served for a trip that is itself public.
  const filter = isUuid(id) ? `id=eq.${id}` : `legacy_widget_id=eq.${encodeURIComponent(id)}`;
  const trips = await sbRequest<Trip[]>(
    `gt_trips?${filter}&status=eq.published&select=id&limit=1`,
  ).catch(() => null);
  const trip = trips?.[0];
  if (!trip) return json({ error: 'not_found' }, 404);

  const { summary, reviews } = await getApprovedReviews(trip.id, 50);
  return json({ summary, reviews }, 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { ...CORS, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
