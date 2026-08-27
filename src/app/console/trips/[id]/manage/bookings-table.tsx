'use client';

// =============================================================================
//  The Manage Trip bookings table — filter, choose columns, sort, and act in
//  bulk. All filtering/sorting/column choice is client-side over the bookings
//  the server already loaded (a trip's set is bounded); bulk status changes go
//  through a server action, then the page re-fetches.
//
//  The bulk actions are the offline-payment equivalent of WeTravel's: an
//  operator who takes a bank transfer marks the booking paid here. Real online
//  payment will flip the same statuses through Stripe later.
// =============================================================================

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkSetBookingStatusAction } from '../../../actions';
import { format as money } from '@/lib/money';
import { shortRange } from '@/lib/participants';
import type { TripBooking } from '@/lib/repo';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full',
  cancelled: 'Cancelled', expired: 'Expired',
};

// Optional columns the operator can show or hide; the always-on ones are not
// listed here. Persisted per browser.
const OPTIONAL_COLS = [
  { key: 'email', label: 'Email', on: false },
  { key: 'dates', label: 'Dates', on: true },
  { key: 'room', label: 'Room', on: true },
  { key: 'party', label: 'Party', on: true },
  { key: 'booked', label: 'Booked on', on: true },
] as const;
type OptCol = (typeof OPTIONAL_COLS)[number]['key'];
const COLS_KEY = 'tgtrips.manage.cols.v1';

function defaultCols(): Record<OptCol, boolean> {
  const out = {} as Record<OptCol, boolean>;
  for (const c of OPTIONAL_COLS) out[c.key] = c.on;
  return out;
}
function loadCols(): Record<OptCol, boolean> {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) return { ...defaultCols(), ...(JSON.parse(raw) as Record<OptCol, boolean>) };
  } catch { /* private mode etc. */ }
  return defaultCols();
}

type SortKey = 'reference' | 'lead' | 'email' | 'dates' | 'party' | 'status' | 'total' | 'outstanding' | 'booked';

function outstandingPence(b: TripBooking): number | null {
  if (b.status === 'cancelled' || b.status === 'expired') return null;
  const t = b.total_pence ?? 0;
  if (b.status === 'paid') return 0;
  if (b.status === 'deposit_paid') return Math.max(0, t - (b.deposit_pence ?? 0));
  return t;
}

export function BookingsTable({
  bookings, tripId, currency,
}: {
  bookings: TripBooking[]; tripId: string; currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [statusFilter, setStatusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'booked', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cols, setCols] = useState<Record<OptCol, boolean>>(defaultCols);

  // Load the saved column choice after mount. Server and first client render use
  // the defaults (so no hydration mismatch); this then applies the saved choice.
  useEffect(() => { setCols(loadCols()); }, []);

  const rooms = useMemo(() => {
    const s = new Set<string>();
    for (const b of bookings) if (b.package_name) s.add(b.package_name);
    return [...s].sort();
  }, [bookings]);

  const rows = useMemo(() => {
    let out = bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (roomFilter === 'none' && b.package_name) return false;
      if (roomFilter !== 'all' && roomFilter !== 'none' && b.package_name !== roomFilter) return false;
      return true;
    });
    const k = sort.key, d = sort.dir;
    out = [...out].sort((a, b) => cmp(a, b, k) * d);
    return out;
  }, [bookings, statusFilter, roomFilter, sort]);

  const allVisibleSelected = rows.length > 0 && rows.every((b) => selected.has(b.id));
  const someSelected = selected.size > 0;

  function setCol(key: OptCol, on: boolean) {
    setCols((prev) => {
      const next = { ...prev, [key]: on };
      try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(rows.map((b) => b.id)));
  }

  function applyBulk(status: string, label: string) {
    if (!someSelected) return;
    if (status === 'cancelled' && !window.confirm(`Cancel ${selected.size} booking${selected.size === 1 ? '' : 's'}? This frees their places.`)) return;
    const ids = [...selected];
    startTransition(async () => {
      await bulkSetBookingStatusAction(tripId, ids, status);
      setSelected(new Set());
      router.refresh();
    });
  }

  const SortH = ({ k, children, num }: { k: SortKey; children: React.ReactNode; num?: boolean }) => (
    <th scope="col" className={num ? 'c-num' : undefined}>
      <button type="button" className="mt-sort" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {children}{sort.key === k && <span aria-hidden="true">{sort.dir === 1 ? ' ▲' : ' ▼'}</span>}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mt-toolbar">
        <label className="mt-filter">
          <span>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Held</option>
            <option value="deposit_paid">Deposit paid</option>
            <option value="paid">Paid in full</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        {rooms.length > 0 && (
          <label className="mt-filter">
            <span>Room</span>
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="all">All</option>
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="none">No room</option>
            </select>
          </label>
        )}
        <details className="mt-cols">
          <summary className="c-btn">Columns</summary>
          <div className="mt-cols-menu">
            {OPTIONAL_COLS.map((c) => (
              <label key={c.key}>
                <input type="checkbox" checked={cols[c.key]} onChange={(e) => setCol(c.key, e.target.checked)} /> {c.label}
              </label>
            ))}
          </div>
        </details>
        <span className="mt-count-note" style={{ marginLeft: 'auto' }}>{rows.length} of {bookings.length}</span>
      </div>

      {someSelected && (
        <div className="mt-bulk" role="region" aria-label="Bulk actions">
          <strong>{selected.size} selected</strong>
          <button type="button" className="c-btn" disabled={pending} onClick={() => applyBulk('deposit_paid', 'deposit paid')}>Mark deposit paid</button>
          <button type="button" className="c-btn" disabled={pending} onClick={() => applyBulk('paid', 'paid')}>Mark paid in full</button>
          <button type="button" className="c-btn c-btn--quiet" disabled={pending} onClick={() => applyBulk('cancelled', 'cancelled')}>Cancel</button>
          <button type="button" className="c-btn c-btn--quiet" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="c-empty">No bookings match. Clear the filters to see them all.</p>
      ) : (
        <div className="c-scroll">
          <table className="c-table">
            <thead>
              <tr>
                <th scope="col" className="mt-check">
                  <input type="checkbox" checked={allVisibleSelected} aria-label="Select all"
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allVisibleSelected; }}
                    onChange={toggleAll} />
                </th>
                <SortH k="reference">Reference</SortH>
                <SortH k="lead">Lead traveller</SortH>
                {cols.email && <SortH k="email">Email</SortH>}
                {cols.dates && <SortH k="dates">Dates</SortH>}
                {cols.room && <th scope="col">Room</th>}
                {cols.party && <SortH k="party" num>Party</SortH>}
                <SortH k="status">Status</SortH>
                <SortH k="total" num>Total</SortH>
                <SortH k="outstanding" num>Outstanding</SortH>
                {cols.booked && <SortH k="booked">Booked on</SortH>}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const faded = b.status === 'cancelled' || b.status === 'expired';
                const out = outstandingPence(b);
                const sel = selected.has(b.id);
                return (
                  <tr key={b.id} style={faded ? { opacity: 0.55 } : undefined} className={sel ? 'mt-row-sel' : undefined}>
                    <td className="mt-check">
                      <input type="checkbox" checked={sel} aria-label={`Select ${b.reference ?? 'booking'}`} onChange={() => toggle(b.id)} />
                    </td>
                    <td className="c-mono"><a href={`/console/bookings/${b.id}`}>{b.reference ?? '—'}</a></td>
                    <td>{b.traveller_name ?? '—'}</td>
                    {cols.email && <td>{b.traveller_email ?? '—'}</td>}
                    {cols.dates && <td className="c-when">{b.starts_on ? shortRange(b.starts_on, b.ends_on) : '—'}</td>}
                    {cols.room && <td>{b.package_name ?? '—'}</td>}
                    {cols.party && <td className="c-num">{b.party_size}</td>}
                    <td><span className={`c-pill c-pill--bk-${b.status}`}>{STATUS_LABEL[b.status] ?? b.status}</span></td>
                    <td className="c-num c-money">{money(b.total_pence, currency) ?? '—'}</td>
                    <td className="c-num c-money">{out === 0 ? '—' : money(out, currency) ?? '—'}</td>
                    {cols.booked && <td className="c-when">{formatDate(b.created_at)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function cmp(a: TripBooking, b: TripBooking, k: SortKey): number {
  switch (k) {
    case 'reference': return (a.reference ?? '').localeCompare(b.reference ?? '');
    case 'lead': return (a.traveller_name ?? '').localeCompare(b.traveller_name ?? '');
    case 'email': return (a.traveller_email ?? '').localeCompare(b.traveller_email ?? '');
    case 'dates': return (a.starts_on ?? '').localeCompare(b.starts_on ?? '');
    case 'party': return (a.party_size ?? 0) - (b.party_size ?? 0);
    case 'status': return (a.status ?? '').localeCompare(b.status ?? '');
    case 'total': return (a.total_pence ?? 0) - (b.total_pence ?? 0);
    case 'outstanding': return (outstandingPence(a) ?? -1) - (outstandingPence(b) ?? -1);
    case 'booked': return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    default: return 0;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}
