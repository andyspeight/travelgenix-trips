// =============================================================================
//  /console/bookings — who has booked
// =============================================================================
//  The operator's manifest across every trip. Traveller PII reaches the browser
//  ONLY here, behind the session, scoped to the operator's own bookings.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listBookings, type BookingRow } from '@/lib/repo';
import { tripsDbConfigured } from '@/lib/supabase';
import { format as money } from '@/lib/money';
import { SignInPrompt, NoOperator, DbMissing } from '../states';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  pending: 'Held',
  deposit_paid: 'Deposit paid',
  paid: 'Paid in full',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const bookings = await listBookings(operator.id);
  const live = bookings.filter((b) => b.status === 'deposit_paid' || b.status === 'paid' || b.status === 'pending');
  const heads = live.reduce((n, b) => n + (b.party_size || 0), 0);

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings" aria-current="page">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team">Team</a>
        <a href="/console/integrations">Integrations</a>
        <a href="/console/branding">Branding</a>
      </nav>

      <h1>Bookings</h1>
      <p className="c-sub">
        {live.length === 0
          ? 'No live bookings yet.'
          : `${live.length} live ${live.length === 1 ? 'booking' : 'bookings'}, ${heads} ${heads === 1 ? 'traveller' : 'travellers'} across ${operator.name}.`}
      </p>

      {bookings.length === 0 ? (
        <p className="c-empty">
          Bookings appear here the moment a traveller reserves a place on one of your trips.
        </p>
      ) : (
        <div className="c-scroll">
          <table className="c-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Lead traveller</th>
                <th scope="col">Party</th>
                <th scope="col">Details</th>
                <th scope="col">Status</th>
                <th scope="col" className="c-num">Total</th>
                <th scope="col" className="c-num">Outstanding</th>
                <th scope="col">Booked</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => <BookingRowView key={b.id} b={b} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BookingRowView({ b }: { b: BookingRow }) {
  const total = money(b.total_pence, b.currency);
  const outstanding = money(b.balance_pence, b.currency);
  const faded = b.status === 'cancelled' || b.status === 'expired';
  const named = b.travellers_named ?? 0;
  const allNamed = named >= b.party_size;

  return (
    <tr style={faded ? { opacity: 0.55 } : undefined}>
      <td className="c-mono">
        <a href={`/console/bookings/${b.id}`}>{b.reference ?? '—'}</a>
      </td>
      <td>
        {b.traveller_name ?? '—'}
        {b.traveller_email && <span className="c-sub-inline">{b.traveller_email}</span>}
      </td>
      <td className="c-num">{b.party_size}</td>
      <td className={allNamed ? undefined : 'c-faint'}>{named} of {b.party_size}</td>
      <td><span className={`c-pill c-pill--bk-${b.status}`}>{LABEL[b.status] ?? b.status}</span></td>
      <td className="c-num c-money">{total ?? '—'}</td>
      <td className="c-num c-money">{outstanding ?? (b.status === 'paid' ? '—' : total ? '—' : '')}</td>
      <td className="c-when">{formatDateTime(b.created_at)}</td>
    </tr>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
