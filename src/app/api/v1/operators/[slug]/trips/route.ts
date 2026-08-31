// =============================================================================
//  GET /api/v1/operators/{slug}/trips
// =============================================================================
//
//  The public list an operator's GRID embed points at: every PUBLISHED trip for
//  one operator, with counts-only availability, in the same per-trip shape as
//  GET /api/v1/trips/{id}. No traveller data, no draft content, no operator
//  contact details. CORS is open, exactly like the single-trip read.
//
//  Bounded to a sane number of trips so a grid embed can never pull an operator's
//  whole history in one request. Fails calm: a database error returns an empty
//  list rather than a 500.
// =============================================================================

import { sbRequest, tripsDbConfigured } from '@/lib/supabase';
import { listOpenDepartures } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import type { Trip, Operator, OperatorBrand } from '@/lib/types';

export const revalidate = 60;

const MAX_TRIPS = 24;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!tripsDbConfigured()) return json({ error: 'not_found' }, 404);

  const operators = await sbRequest<Operator[]>(
    `gt_operators?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,brand&limit=1`,
  ).catch(() => null);
  const operator = operators?.[0];
  if (!operator) return json({ error: 'not_found' }, 404);

  const trips =
    (await sbRequest<Trip[]>(
      `gt_trips?operator_id=eq.${operator.id}&status=eq.published&select=*` +
        `&order=created_at.desc&limit=${MAX_TRIPS}`,
    ).catch(() => null)) ?? [];

  // Availability per trip, bounded above. N small, and the whole response is
  // cached for a minute, so the per-trip queries are cheap in practice.
  const items = await Promise.all(
    trips.map(async (trip) => {
      const departures = await listOpenDepartures(trip.id);
      const availability = await availabilityByDeparture(departures);
      return {
        trip: {
          id: trip.id,
          slug: trip.slug,
          title: trip.title,
          summary: trip.summary,
          kind: trip.kind,
          location: trip.location,
          currency: trip.currency,
          heroImageUrl: trip.hero_image_url,
          content: trip.content,
        },
        departures: departures.map((d) => {
          const seats = availability.get(d.id);
          return {
            id: d.id,
            startsOn: d.starts_on,
            endsOn: d.ends_on,
            pricePence: d.price_pence,
            depositPence: d.deposit_pence,
            balanceDueDate: d.balance_due_date,
            capacity: seats?.capacity ?? d.capacity,
            remaining: seats?.remaining ?? null,
            soldOut: seats?.soldOut ?? false,
          };
        }),
      };
    }),
  );

  return json({
    operator: { name: operator.name, slug: operator.slug, brand: publicBrand(operator.brand) },
    trips: items,
  }, 200);
}

/** Only the brand fields a public embed needs. Never replyTo or anything added
 *  to the brand blob later. */
function publicBrand(brand: OperatorBrand | undefined | null) {
  if (!brand) return null;
  return {
    logoUrl: brand.logoUrl ?? null,
    primaryColour: brand.primaryColour ?? null,
    accentColour: brand.accentColour ?? null,
    fontFamily: brand.fontFamily ?? null,
  };
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { ...CORS, 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
