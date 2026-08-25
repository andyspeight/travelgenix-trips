// =============================================================================
//  GET /api/v1/trips/{id}
// =============================================================================
//
//  The public read the embeddable widgets point at, replacing the Airtable
//  widget-config fetch. Accepts either the trip's uuid or its legacy tgw_ widget
//  id, so an embed already on a customer's site keeps working while phase 1
//  migrates it.
//
//  PUBLISHED TRIPS ONLY, and counts only. No traveller data, no draft content,
//  no operator contact details. CORS is open because this is read-only public
//  information served to customer sites, exactly like the widget config it
//  replaces.
//
//  Fails calm: a database error returns the trip without availability rather
//  than a 500, because a missing places-left line is better than a broken embed.
//
// =============================================================================

import { sbRequest, tripsDbConfigured } from '@/lib/supabase';
import { listOpenDepartures, isUuid } from '@/lib/repo';
import { availabilityByDeparture } from '@/lib/availability';
import type { Trip, Operator } from '@/lib/types';

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

  // A uuid is looked up by id; anything else is treated as a legacy widget id.
  const filter = isUuid(id)
    ? `id=eq.${id}`
    : `legacy_widget_id=eq.${encodeURIComponent(id)}`;

  const trips = await sbRequest<Trip[]>(
    `gt_trips?${filter}&status=eq.published&select=*&limit=1`,
  ).catch(() => null);

  const trip = trips?.[0];
  if (!trip) return json({ error: 'not_found' }, 404);

  const operators = await sbRequest<Operator[]>(
    `gt_operators?id=eq.${trip.operator_id}&select=id,name,slug,brand&limit=1`,
  ).catch(() => null);
  const operator = operators?.[0];

  const departures = await listOpenDepartures(trip.id);
  const availability = await availabilityByDeparture(departures);

  return json({
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
    // Name and branding only. Never the contact email, never the Stripe account.
    operator: operator
      ? { name: operator.name, slug: operator.slug, brand: operator.brand }
      : null,
    departures: departures.map((d) => {
      const seats = availability.get(d.id);
      return {
        id: d.id,
        startsOn: d.starts_on,
        endsOn: d.ends_on,
        pricePence: d.price_pence,
        depositPence: d.deposit_pence,
        balanceDueDate: d.balance_due_date,
        // Counts only. capacity and remaining, never who booked.
        capacity: seats?.capacity ?? d.capacity,
        remaining: seats?.remaining ?? null,
        soldOut: seats?.soldOut ?? false,
      };
    }),
  }, 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      ...CORS,
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
