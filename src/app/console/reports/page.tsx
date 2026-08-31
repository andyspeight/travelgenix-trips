// =============================================================================
//  /console/reports — money across every trip
// =============================================================================
//  The operator's whole book in one place: what is booked, what has been
//  collected, and what is outstanding, per trip and in total. A read-only
//  cross-trip view; per-trip detail lives on each Manage Trip screen.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, getOperatorReport } from '@/lib/repo';
import { tripsDbConfigured } from '@/lib/supabase';
import { format as money } from '@/lib/money';
import { SignInPrompt, NoOperator, DbMissing } from '../states';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const report = await getOperatorReport(operator.id);
  const c = report.currency;

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings">Bookings</a>
        <a href="/console/reports" aria-current="page">Reports</a>
        <a href="/console/team">Team</a>
      </nav>

      <h1>Reports</h1>
      <p className="c-sub">
        Money across everything {operator.name} has on sale.
        {report.mixedCurrency && ' Trips span more than one currency, so totals are indicative.'}
      </p>

      <dl className="c-stats">
        <div><dt>Booked</dt><dd className="c-money">{money(report.totals.booked_pence, c) ?? '—'}</dd></div>
        <div><dt>Collected</dt><dd className="c-money">{money(report.totals.collected_pence, c) ?? '—'}</dd></div>
        <div><dt>Outstanding</dt><dd className="c-money c-stat-accent">{money(report.totals.outstanding_pence, c) ?? '—'}</dd></div>
        <div><dt>Bookings</dt><dd>{report.totals.bookings}</dd></div>
        <div><dt>Travellers</dt><dd>{report.totals.heads}</dd></div>
      </dl>

      <div className="c-actions" style={{ marginTop: 0 }}>
        <a className="c-btn" href="/console/bookings.csv">Download bookings (CSV)</a>
        <span className="c-hint">A finance ledger of every booking, for your accounts or QuickBooks and Xero.</span>
      </div>

      <h2 style={{ fontSize: '1rem' }}>By trip</h2>
      {report.rows.length === 0 ? (
        <p className="c-empty">No live bookings yet. This fills in as travellers book.</p>
      ) : (
        <div className="c-scroll">
          <table className="c-table">
            <thead>
              <tr>
                <th scope="col">Trip</th>
                <th scope="col" className="c-num">Bookings</th>
                <th scope="col" className="c-num">Travellers</th>
                <th scope="col" className="c-num">Booked</th>
                <th scope="col" className="c-num">Collected</th>
                <th scope="col" className="c-num">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.trip_id}>
                  <td><a href={`/console/trips/${r.trip_id}/manage`}>{r.title}</a></td>
                  <td className="c-num">{r.bookings}</td>
                  <td className="c-num">{r.heads}</td>
                  <td className="c-num c-money">{money(r.booked_pence, r.currency) ?? '—'}</td>
                  <td className="c-num c-money">{money(r.collected_pence, r.currency) ?? '—'}</td>
                  <td className="c-num c-money">{money(r.outstanding_pence, r.currency) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
