// =============================================================================
//  /console/trips/[id] — edit a trip, and manage its departures
// =============================================================================

import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ensureOperator, getTripOwned, listDepartures } from '@/lib/repo';
import { format as money } from '@/lib/money';
import { TripForm, DepartureForm } from '../../forms';
import { ContentEditor } from '../../content-editor';
import { SignInPrompt, NoOperator } from '../../states';
import { setTripStatusAction, removeDepartureAction } from '../../actions';
import type { Departure } from '@/lib/types';

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
