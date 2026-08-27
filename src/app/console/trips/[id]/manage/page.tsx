// =============================================================================
//  /console/trips/[id]/manage — the operator's Manage Trip dashboard
// =============================================================================
//  One trip's whole booking picture: the money across it, every booking, and
//  every participant. Traveller PII reaches the browser only here, behind the
//  session and scoped to the operator's own trip.
// =============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { ensureOperator, getTripManage, type TripBooking } from '@/lib/repo';
import { participantRows, shortRange } from '@/lib/participants';
import { tripsDbConfigured } from '@/lib/supabase';
import { format as money } from '@/lib/money';
import { safeImageUrl } from '@/lib/url';
import { SignInPrompt, NoOperator, DbMissing } from '../../../states';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full',
  cancelled: 'Cancelled', expired: 'Expired',
};

type Tab = 'bookings' | 'participants';

export default async function ManageTripPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab: Tab = tabRaw === 'participants' ? 'participants' : 'bookings';

  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const data = await getTripManage(id, operator.id);
  if (!data) notFound();

  const { trip, money: m, counts, bookings } = data;
  const hero = safeImageUrl(trip.hero_image_url);
  const base = `/console/trips/${trip.id}/manage`;

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings">Bookings</a>
      </nav>

      <p className="c-sub" style={{ marginBottom: 4 }}>
        <Link href={`/console/trips/${trip.id}`}>← Edit trip</Link>
      </p>

      {/* --- header: the trip, the money, the actions --- */}
      <div className="mt-head">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="mt-thumb" src={hero} alt="" />
        )}
        <div className="mt-head-main">
          <h1>{trip.title}</h1>
          <p className="c-sub" style={{ margin: '2px 0 0' }}>
            <span className={`c-pill c-pill--${trip.status}`}>{trip.status}</span>{' '}
            {counts.bookings} {counts.bookings === 1 ? 'booking' : 'bookings'} · {counts.heads} {counts.heads === 1 ? 'traveller' : 'travellers'}
          </p>
          <div className="c-actions" style={{ marginTop: 12 }}>
            <a className="c-btn" href={`/trip/preview/${trip.id}`} target="_blank" rel="noreferrer">Preview</a>
            <a className="c-btn" href={`/console/trips/${trip.id}`}>Edit</a>
          </div>
        </div>
        <dl className="mt-money">
          <div><dt>Booked</dt><dd className="c-money">{money(m.total_pence, m.currency) ?? '—'}</dd></div>
          <div><dt>Collected</dt><dd className="c-money">{money(m.collected_pence, m.currency) ?? '—'}</dd></div>
          <div><dt>Outstanding</dt><dd className="c-money mt-out">{money(m.outstanding_pence, m.currency) ?? '—'}</dd></div>
        </dl>
      </div>

      {/* --- tabs --- */}
      <nav className="mt-tabs">
        <a href={base} aria-current={tab === 'bookings' ? 'page' : undefined}>
          Bookings <span className="mt-count">{counts.bookings}</span>
        </a>
        <a href={`${base}?tab=participants`} aria-current={tab === 'participants' ? 'page' : undefined}>
          Participants <span className="mt-count">{counts.participants}</span>
        </a>
        <span className="mt-soon" title="Coming soon">Waitlist</span>
        <span className="mt-soon" title="Coming soon">Messages</span>
        <span className="mt-soon" title="Coming soon">Promote</span>
      </nav>

      {tab === 'bookings' ? (
        <BookingsTab bookings={bookings} currency={m.currency} />
      ) : (
        <ParticipantsTab bookings={bookings} tripId={trip.id} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function BookingsTab({ bookings, currency }: { bookings: TripBooking[]; currency: string }) {
  if (bookings.length === 0) {
    return <p className="c-empty">No bookings on this trip yet. They appear here the moment a traveller reserves a place.</p>;
  }
  return (
    <div className="c-scroll">
      <table className="c-table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Lead traveller</th>
            <th scope="col">Dates</th>
            <th scope="col">Room</th>
            <th scope="col" className="c-num">Party</th>
            <th scope="col">Status</th>
            <th scope="col" className="c-num">Total</th>
            <th scope="col" className="c-num">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const faded = b.status === 'cancelled' || b.status === 'expired';
            return (
              <tr key={b.id} style={faded ? { opacity: 0.55 } : undefined}>
                <td className="c-mono"><a href={`/console/bookings/${b.id}`}>{b.reference ?? '—'}</a></td>
                <td>{b.traveller_name ?? '—'}</td>
                <td className="c-when">{b.starts_on ? shortRange(b.starts_on, b.ends_on) : '—'}</td>
                <td>{b.package_name ?? '—'}</td>
                <td className="c-num">{b.party_size}</td>
                <td><span className={`c-pill c-pill--bk-${b.status}`}>{STATUS_LABEL[b.status] ?? b.status}</span></td>
                <td className="c-num c-money">{money(b.total_pence, currency) ?? '—'}</td>
                <td className="c-num c-money">{money(b.balance_pence, currency) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ParticipantsTab({ bookings, tripId }: { bookings: TripBooking[]; tripId: string }) {
  const rows = participantRows(bookings);
  return (
    <>
      <div className="c-actions" style={{ justifyContent: 'flex-end', marginTop: 0, marginBottom: 12 }}>
        <a className="c-btn" href={`/console/trips/${tripId}/participants.csv`}>Export CSV</a>
      </div>
      {rows.length === 0 ? (
        <p className="c-empty">No named participants yet. Names arrive as travellers complete their bookings.</p>
      ) : (
        <div className="c-scroll">
          <table className="c-table">
            <thead>
              <tr>
                <th scope="col">Traveller</th>
                <th scope="col">Booked by</th>
                <th scope="col">Room</th>
                <th scope="col">Dates</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}{p.isLead && <span className="c-tag">Lead</span>}</td>
                  <td>{p.buyer}</td>
                  <td>{p.room ?? '—'}</td>
                  <td className="c-when">{p.dates}</td>
                  <td><span className={`c-pill c-pill--bk-${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

