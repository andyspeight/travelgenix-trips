// =============================================================================
//  GET /console/bookings.csv
// =============================================================================
//  Every booking the operator owns as a finance ledger, for import into
//  accounting software (QuickBooks, Xero) or a spreadsheet. Operator-gated: no
//  session, or a session with no operator, gets nothing. The collected /
//  outstanding maths matches the Reports and Manage screens, so it reconciles.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listOperatorBookingsForExport } from '@/lib/repo';
import { bookingsCsv } from '@/lib/finance';
import { tripsDbConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!tripsDbConfigured()) return new Response('Not found', { status: 404 });

  const session = await getSession();
  if (!session) return new Response('Not authorised', { status: 401 });

  const operator = await ensureOperator(session);
  if (!operator) return new Response('Not authorised', { status: 403 });

  const rows = await listOperatorBookingsForExport(operator.id);
  const csv = bookingsCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `bookings-${operator.slug || 'operator'}-${stamp}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}
