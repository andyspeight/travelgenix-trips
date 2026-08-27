'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createBookingAction, EMPTY_BOOKING_STATE } from './actions';
import { MAX_PARTY } from '@/lib/booking';
import type { Departure } from '@/lib/types';

function money(pence: number | null | undefined, currency: string): string | null {
  if (typeof pence !== 'number' || pence <= 0) return null;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol', minimumFractionDigits: pence % 100 ? 2 : 0 }).format(pence / 100);
  } catch { return `${(pence / 100).toFixed(0)}`; }
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bk-cta" disabled={pending}>
      {pending ? 'Holding your place...' : 'Reserve places'}
    </button>
  );
}

export function BookingForm({
  departures, currency, initialDeparture,
}: {
  departures: Departure[]; currency: string; initialDeparture?: string;
}) {
  const [state, action] = useActionState(createBookingAction, EMPTY_BOOKING_STATE);
  const [party, setParty] = useState(1);
  const e = state.errors;

  const cap = Math.max(1, Math.min(MAX_PARTY, party));
  const extra = Array.from({ length: Math.max(0, cap - 1) });

  return (
    <form action={action} noValidate className="bk-form">
      {state.message && !state.ok && <p className="bk-alert" role="alert">{state.message}</p>}

      <fieldset className="bk-field">
        <legend>Choose a departure</legend>
        {e.departure_id && <p className="bk-err">{e.departure_id}</p>}
        <div className="bk-dates">
          {departures.map((d, i) => {
            const price = money(d.price_pence, currency);
            return (
              <label key={d.id} className="bk-date">
                <input type="radio" name="departure_id" value={d.id} defaultChecked={initialDeparture ? d.id === initialDeparture : i === 0} required />
                <span className="bk-date-when">{formatRange(d.starts_on, d.ends_on)}</span>
                <span className="bk-date-price">{price ?? 'On request'}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="bk-field">
        <span>How many people?</span>
        <input
          type="number" name="party_size" min={1} max={MAX_PARTY} value={cap}
          onChange={(ev) => setParty(Number.parseInt(ev.target.value, 10) || 1)}
        />
        {e.party_size && <p className="bk-err">{e.party_size}</p>}
      </label>

      <div className="bk-section">
        <h2>Lead traveller</h2>
        <p className="bk-hint">This is who we send the confirmation to.</p>

        <label className={`bk-field${e.lead_name ? ' bk-bad' : ''}`}>
          <span>Full name</span>
          <input name="lead_name" autoComplete="name" required />
          {e.lead_name && <p className="bk-err">{e.lead_name}</p>}
        </label>

        <div className="bk-row">
          <label className={`bk-field${e.lead_email ? ' bk-bad' : ''}`}>
            <span>Email</span>
            <input name="lead_email" type="email" autoComplete="email" required />
            {e.lead_email && <p className="bk-err">{e.lead_email}</p>}
          </label>
          <label className={`bk-field${e.lead_phone ? ' bk-bad' : ''}`}>
            <span>Phone <em>(optional)</em></span>
            <input name="lead_phone" type="tel" autoComplete="tel" />
            {e.lead_phone && <p className="bk-err">{e.lead_phone}</p>}
          </label>
        </div>
      </div>

      {extra.length > 0 && (
        <div className="bk-section">
          <h2>Other travellers</h2>
          <p className="bk-hint">Names help the operator prepare. You can add them later if you do not have them yet.</p>
          {extra.map((_, i) => (
            <label key={i} className="bk-field">
              <span>Traveller {i + 2}</span>
              <input name="traveller_name" autoComplete="off" placeholder="Full name" />
            </label>
          ))}
          {e.traveller_name && <p className="bk-err">{e.traveller_name}</p>}
        </div>
      )}

      <Submit />
      <p className="bk-note">
        We will hold your places while the operator confirms and takes payment.
        No card is charged now.
      </p>
    </form>
  );
}

function formatRange(startIso: string, endIso: string): string {
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  const o: Intl.DateTimeFormatOptions = { timeZone: 'UTC', day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('en-GB', o)} to ${e.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`;
}
