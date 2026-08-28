// =============================================================================
//  /console/bookings/[id] — one booking, and everyone on it
// =============================================================================
//  The operator's people-picture for a booking they own: each traveller's
//  details, their answers to the custom questions, and who has signed the
//  waiver. Traveller PII reaches the browser only here, behind the session and
//  scoped to the operator's own bookings.
// =============================================================================

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { ensureOperator, getBookingDetail } from '@/lib/repo';
import { tripsDbConfigured } from '@/lib/supabase';
import { format as money } from '@/lib/money';
import { SignInPrompt, NoOperator, DbMissing } from '../../states';
import type { RegField } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Held', deposit_paid: 'Deposit paid', paid: 'Paid in full',
  cancelled: 'Cancelled', expired: 'Expired',
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const detail = await getBookingDetail(id, operator.id);
  if (!detail) notFound();

  const { booking, form, waiver, responses, signatures, trip, packageName, selectedOptions, documents, registrationComplete } = detail;

  // Field key -> label, so an answer reads as a question rather than a code.
  const labels = new Map<string, RegField>((form?.schema ?? []).map((f) => [f.key, f]));
  const answersFor = (travellerId: string | null): Record<string, string> =>
    responses.find((r) => r.traveller_id === travellerId)?.answers ?? {};
  const signatureFor = (travellerId: string) => signatures.find((s) => s.traveller_id === travellerId);
  const documentsFor = (travellerId: string | null) => documents.filter((d) => d.traveller_id === travellerId);

  const perTravellerFields = (form?.schema ?? []).filter((f) => f.scope === 'traveller');
  const perBookingFields = (form?.schema ?? []).filter((f) => f.scope === 'booking');
  const bookingAnswers = answersFor(null);
  const bookingDocs = documentsFor(null);

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings" aria-current="page">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team">Team</a>
      </nav>

      <p className="c-sub" style={{ marginBottom: 4 }}>
        <Link href="/console/bookings">← All bookings</Link>
      </p>

      <h1 style={{ marginBottom: 6 }}>
        <span className="c-mono">{booking.reference ?? '—'}</span>
      </h1>
      <p className="c-sub">
        <span className={`c-pill c-pill--bk-${booking.status}`}>{STATUS_LABEL[booking.status] ?? booking.status}</span>{' '}
        {trip ? `${trip.title} · ` : ''}{booking.party_size} {booking.party_size === 1 ? 'traveller' : 'travellers'}
        {packageName ? ` · ${packageName}` : ''}
      </p>

      <p className={`c-note ${registrationComplete ? 'c-note--ok' : 'c-note--calm'}`}>
        {registrationComplete
          ? 'Registration complete. Every traveller is named, every required question answered' + (waiver?.is_mandatory ? ', and the agreement signed by all.' : '.')
          : 'Registration in progress. Some details are still outstanding' + (waiver?.is_mandatory ? ', including one or more signatures.' : '.')}
      </p>

      {(booking.total_pence || booking.balance_pence) && (
        <dl className="c-facts">
          {booking.total_pence != null && <div><dt>Total</dt><dd className="c-money">{money(booking.total_pence, booking.currency) ?? '—'}</dd></div>}
          {booking.balance_pence != null && <div><dt>Outstanding</dt><dd className="c-money">{money(booking.balance_pence, booking.currency) ?? '—'}</dd></div>}
        </dl>
      )}

      {selectedOptions.length > 0 && (
        <dl className="c-facts">
          {selectedOptions.map((o) => (
            <div key={o.option_id}>
              <dt>{o.name}{o.quantity > 1 ? ` ×${o.quantity}` : ''}</dt>
              <dd className="c-money">{money(o.amount_pence, booking.currency) ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      <h2>Travellers</h2>
      {booking.travellers.length === 0 ? (
        <p className="c-empty">No traveller details yet. They are added when the traveller completes their booking.</p>
      ) : (
        <ul className="c-people">
          {booking.travellers.map((t) => {
            const sig = signatureFor(t.id);
            const ans = answersFor(t.id);
            return (
              <li key={t.id} className="c-person">
                <div className="c-person-head">
                  <span className="c-name">
                    {t.full_name || <em className="c-faint">Unnamed</em>}
                    {t.is_lead && <span className="c-tag">Lead</span>}
                  </span>
                  {waiver && (
                    <span className={`c-sig ${sig ? 'c-sig--yes' : 'c-sig--no'}`}>
                      {sig ? `Signed ${formatDateTime(sig.signed_at)}` : 'Not signed'}
                    </span>
                  )}
                </div>

                <dl className="c-person-facts">
                  {t.email && <div><dt>Email</dt><dd>{t.email}</dd></div>}
                  {t.phone && <div><dt>Phone</dt><dd>{t.phone}</dd></div>}
                  {t.date_of_birth && <div><dt>Date of birth</dt><dd>{humanDate(t.date_of_birth)}</dd></div>}
                  {perTravellerFields.filter((f) => f.type !== 'document').map((f) => ans[f.key] != null && ans[f.key] !== '' && (
                    <div key={f.key}><dt>{labels.get(f.key)?.label ?? f.key}</dt><dd>{ans[f.key]}</dd></div>
                  ))}
                  {documentsFor(t.id).map((d) => (
                    <div key={d.id}>
                      <dt>{labels.get(d.field_key)?.label ?? 'Document'}</dt>
                      <dd><a href={`/api/console/document/${d.id}`} target="_blank" rel="noreferrer">{d.file_name}</a></dd>
                    </div>
                  ))}
                  {sig && <div><dt>Signed as</dt><dd>{sig.signed_name} <span className="c-faint">(v{sig.version})</span></dd></div>}
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      {perBookingFields.some((f) => f.type !== 'document') && (
        <>
          <h2>Booking answers</h2>
          {Object.keys(bookingAnswers).length === 0 ? (
            <p className="c-empty">Not answered yet.</p>
          ) : (
            <dl className="c-facts">
              {perBookingFields.filter((f) => f.type !== 'document').map((f) => bookingAnswers[f.key] != null && bookingAnswers[f.key] !== '' && (
                <div key={f.key}><dt>{f.label}</dt><dd>{bookingAnswers[f.key]}</dd></div>
              ))}
            </dl>
          )}
        </>
      )}

      {bookingDocs.length > 0 && (
        <>
          <h2>Booking documents</h2>
          <dl className="c-facts">
            {bookingDocs.map((d) => (
              <div key={d.id}>
                <dt>{labels.get(d.field_key)?.label ?? 'Document'}</dt>
                <dd><a href={`/api/console/document/${d.id}`} target="_blank" rel="noreferrer">{d.file_name}</a></dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </>
  );
}

function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
