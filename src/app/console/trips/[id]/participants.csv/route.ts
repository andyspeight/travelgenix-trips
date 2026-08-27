// =============================================================================
//  GET /console/trips/{id}/participants.csv
// =============================================================================
//  The Manage Trip participants list as a download. Operator-gated exactly like
//  the screen it mirrors: no session or a forged trip id gets nothing. The rows
//  come from the same helper the screen uses, so the export always matches.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, getTripManage } from '@/lib/repo';
import { participantsCsv } from '@/lib/participants';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!tripsDbConfigured()) return new Response('Not found', { status: 404 });

  const session = await getSession();
  if (!session) return new Response('Not authorised', { status: 401 });

  const operator = await ensureOperator(session);
  if (!operator) return new Response('Not authorised', { status: 403 });

  const data = await getTripManage(id, operator.id);
  if (!data) return new Response('Not found', { status: 404 });

  const csv = participantsCsv(data.bookings);
  const name = `participants-${data.trip.slug || 'trip'}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
