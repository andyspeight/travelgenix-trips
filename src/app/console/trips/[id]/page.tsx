// =============================================================================
//  /console/trips/[id] — edit a trip, and manage its departures
// =============================================================================

import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ensureOperator, getTripOwned, listDepartures, getFormForTrip, getWaiverForTrip, getPackagesForTrip, getOptionsForTrip, listPromoCodes, describePromo, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canEdit } from '@/lib/members';
import { format as money } from '@/lib/money';
import { TripForm, DepartureForm, PackageForm, OptionForm, PromoForm } from '../../forms';
import { ContentEditor } from '../../content-editor';
import { RegistrationEditor } from '../../registration-editor';
import { SignInPrompt, NoOperator } from '../../states';
import { setTripStatusAction, removeDepartureAction, removePackageAction, removeOptionAction, removePromoAction } from '../../actions';
import type { Departure, Package } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return <SignInPrompt />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  // Returns null for "does not exist" AND for "belongs to someone else", so a
  // guessed id cannot be used to probe another operator's trips.
  const trip = await getTripOwned(id, operator.id);
  if (!trip) notFound();

  const departures = await listDepartures(trip.id);
  const openCount = departures.filter((d) => d.status === 'open').length;
  const publicUrl = `/trip/${operator.slug}/${trip.slug}`;

  const [regForm, waiver, packages, options, promos, members] = await Promise.all([
    getFormForTrip(trip.id, operator.id),
    getWaiverForTrip(trip.id, operator.id),
    getPackagesForTrip(trip.id, operator.id),
    getOptionsForTrip(trip.id, operator.id),
    listPromoCodes(trip.id, operator.id),
    listOperatorMembers(operator.id),
  ]);
  const mayEdit = session.preview ? true : canEdit(resolveOperatorRole(operator.contact_email, session.email, members));

  return (
    <>
      <h1>{trip.title}</h1>
      <p className="c-sub">
        <span className={`c-pill c-pill--${trip.status}`}>{trip.status}</span>{' '}
        {trip.status === 'published' ? (
          <>
            Live at <a href={publicUrl}>{publicUrl}</a>
          </>
        ) : (
          <>Not visible to anyone yet.</>
        )}
      </p>

      {!mayEdit && (
        <p className="c-note c-note--calm">
          You have view-only access. You can see everything on this trip, but changes will not save.
          Ask an owner if you need edit access.
        </p>
      )}

      {trip.status === 'draft' && openCount === 0 && (
        <p className="c-note c-note--calm">
          Add at least one departure before publishing. A trip page with no dates on it has
          nothing to sell.
        </p>
      )}

      <div className="c-actions" style={{ marginTop: 0 }}>
        <a className="c-btn" href={`/trip/preview/${trip.id}`} target="_blank" rel="noreferrer">
          Preview
        </a>
        <a className="c-btn" href={`/console/trips/${trip.id}/manage`}>Manage bookings</a>
        {/* display:contents lets the form's button sit in the same flex row. */}
        <form action={setTripStatusAction} style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={trip.id} />
          {trip.status === 'published' ? (
            <>
              <input type="hidden" name="status" value="draft" />
              <button className="c-btn" type="submit">Unpublish</button>
            </>
          ) : (
            <>
              <input type="hidden" name="status" value="published" />
              <button className="c-btn c-btn--primary" type="submit" disabled={openCount === 0}>
                Publish
              </button>
            </>
          )}
        </form>
      </div>

      <h2>Details</h2>
      <TripForm trip={trip} />

      <h2>Itinerary and content</h2>
      <p className="c-sub" style={{ marginTop: '-6px' }}>
        Everything the public page shows beyond the basics: highlights, the day by
        day, what is included, extras and the gallery.
      </p>
      <ContentEditor tripId={trip.id} content={trip.content ?? {}} />

      <h2>Registration</h2>
      <p className="c-sub" style={{ marginTop: '-6px' }}>
        What each traveller gives you after they book: their details, any custom questions,
        and the agreement they sign.
      </p>
      <RegistrationEditor tripId={trip.id} form={regForm} waiver={waiver} />

      <h2>Departures</h2>
      {departures.length === 0 ? (
        <p className="c-empty">No dates yet. Add the first one below.</p>
      ) : (
        <ul className="c-list">
          {departures.map((d) => (
            <DepartureRow key={d.id} departure={d} tripId={trip.id} currency={trip.currency} />
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: '1rem' }}>Add a departure</h2>
      <DepartureForm tripId={trip.id} />

      <h2>Packages</h2>
      <p className="c-sub" style={{ marginTop: '-6px' }}>
        Room types and options a traveller picks when they book, each with its own
        price, photo and link. A package with its own price sets what that traveller pays.
      </p>
      {packages.length === 0 ? (
        <p className="c-empty">No packages yet. Without any, a booking uses the departure price.</p>
      ) : (
        packages.map((p) => (
          <div key={p.id} className="ce-section">
            <PackageForm tripId={trip.id} pkg={p} />
            <form action={removePackageAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="id" value={p.id} />
              <button className="c-btn c-btn--quiet" type="submit">Remove this package</button>
            </form>
          </div>
        ))
      )}

      <h2 style={{ fontSize: '1rem' }}>Add a package</h2>
      <PackageForm tripId={trip.id} />

      <h2>Optional extras</h2>
      <p className="c-sub" style={{ marginTop: '-6px' }}>
        Priced add-ons a traveller can choose at checkout: a transfer, an excursion,
        a meal plan. Charge each once per booking or once per traveller. Mark one
        required to add it to every booking.
      </p>
      {options.length === 0 ? (
        <p className="c-empty">No extras yet. A trip sells fine without them.</p>
      ) : (
        options.map((o) => (
          <div key={o.id} className="ce-section">
            <OptionForm tripId={trip.id} option={o} />
            <form action={removeOptionAction} style={{ marginTop: 8 }}>
              <input type="hidden" name="trip_id" value={trip.id} />
              <input type="hidden" name="id" value={o.id} />
              <button className="c-btn c-btn--quiet" type="submit">Remove this extra</button>
            </form>
          </div>
        ))
      )}

      <h2 style={{ fontSize: '1rem' }}>Add an extra</h2>
      <OptionForm tripId={trip.id} />

      <h2>Promo codes</h2>
      <p className="c-sub" style={{ marginTop: '-6px' }}>
        Discount and early-bird codes a traveller types at checkout. Percent or amount off,
        optionally date-limited or capped.
      </p>
      {promos.length === 0 ? (
        <p className="c-empty">No codes yet.</p>
      ) : (
        <ul className="c-list">
          {promos.map((p) => (
            <li key={p.id}>
              <span className="c-name c-mono">{p.code}</span>
              <span className="c-meta">
                {describePromo(p, trip.currency)}
                {!p.is_active && ' · inactive'}
                {(p.starts_on || p.ends_on) && ` · ${p.starts_on ?? '…'} to ${p.ends_on ?? '…'}`}
                {` · used ${p.redeemed}${p.max_redemptions ? ` of ${p.max_redemptions}` : ''}`}
              </span>
              <span className="c-right">
                <form action={removePromoAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="trip_id" value={trip.id} />
                  <button className="c-btn c-btn--quiet" type="submit">Remove</button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: '1rem' }}>Add a code</h2>
      <PromoForm tripId={trip.id} />
    </>
  );
}

function DepartureRow({
  departure, tripId, currency,
}: {
  departure: Departure; tripId: string; currency: string;
}) {
  // A zero price is unpriced, not free.
  const price = money(departure.price_pence, currency);

  return (
    <li>
      <span className="c-name">
        {formatDate(departure.starts_on)} to {formatDate(departure.ends_on)}
      </span>
      <span className={`c-pill c-pill--${departure.status}`}>
        {departure.status === 'open' ? 'on sale' : departure.status}
      </span>
      <span className="c-meta c-money">
        {price ?? 'Price on request'} · {departure.capacity || 'no'} places
      </span>
      <span className="c-right">
        <form action={removeDepartureAction}>
          <input type="hidden" name="trip_id" value={tripId} />
          <input type="hidden" name="id" value={departure.id} />
          <button className="c-btn c-btn--quiet" type="submit">Remove</button>
        </form>
      </span>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
