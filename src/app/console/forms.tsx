'use client';

// Client forms for the console. They exist so a failed save can show which
// field was wrong, in place, without losing what the operator typed.

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTripAction, saveDepartureAction } from './actions';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import type { Trip, Departure } from '@/lib/types';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="c-btn c-btn--primary" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

function Field({
  name, label, hint, error, children,
}: {
  name: string; label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <label className={`c-field${error ? ' c-field--bad' : ''}`} htmlFor={name}>
      <span>
        {label}
        {hint && <span className="c-hint">{hint}</span>}
      </span>
      {children}
      {error && <p className="c-err">{error}</p>}
    </label>
  );
}

function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`c-note ${state.ok ? 'c-note--ok' : 'c-note--bad'}`}>{state.message}</p>;
}

// ---------------------------------------------------------------------------

export function TripForm({ trip }: { trip?: Trip }) {
  const [state, action] = useActionState(saveTripAction, EMPTY_STATE);
  const e = state.errors;

  return (
    <form action={action} noValidate>
      <Notice state={state} />
      {trip && <input type="hidden" name="id" value={trip.id} />}

      <Field name="title" label="Title" error={e.title}>
        <input id="title" name="title" defaultValue={trip?.title ?? ''} maxLength={160} required />
      </Field>

      <Field
        name="slug"
        label="Web address"
        hint="Leave blank to build one from the title."
        error={e.slug}
      >
        <input id="slug" name="slug" defaultValue={trip?.slug ?? ''} placeholder="kenya-safari" />
      </Field>

      <div className="c-row">
        <Field name="kind" label="Type" error={e.kind}>
          <select id="kind" name="kind" defaultValue={trip?.kind ?? 'group'}>
            <option value="group">Group trip</option>
            <option value="tour">Escorted tour</option>
          </select>
        </Field>

        <Field name="currency" label="Currency" error={e.currency}>
          <select id="currency" name="currency" defaultValue={trip?.currency ?? 'gbp'}>
            <option value="gbp">GBP</option>
            <option value="eur">EUR</option>
            <option value="usd">USD</option>
          </select>
        </Field>

        <Field name="location" label="Where" error={e.location}>
          <input id="location" name="location" defaultValue={trip?.location ?? ''} placeholder="Kenya" />
        </Field>
      </div>

      <Field name="summary" label="Summary" hint="One or two sentences." error={e.summary}>
        <textarea id="summary" name="summary" defaultValue={trip?.summary ?? ''} maxLength={600} />
      </Field>

      <Field
        name="hero_image_url"
        label="Hero image"
        hint="An https address. Uploads arrive in a later phase."
        error={e.hero_image_url}
      >
        <input
          id="hero_image_url"
          name="hero_image_url"
          type="url"
          defaultValue={trip?.hero_image_url ?? ''}
          placeholder="https://..."
        />
      </Field>

      <div className="c-actions">
        <Submit label={trip ? 'Save changes' : 'Create trip'} busy="Saving..." />
        <a className="c-btn" href="/console">Cancel</a>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** Pence back into a plain number for the input, or blank when unpriced. */
function pounds(pence: number | null | undefined): string {
  return typeof pence === 'number' && pence > 0 ? (pence / 100).toString() : '';
}

export function DepartureForm({ tripId, departure }: { tripId: string; departure?: Departure }) {
  const [state, action] = useActionState(saveDepartureAction, EMPTY_STATE);
  const e = state.errors;

  return (
    <form action={action} noValidate>
      <Notice state={state} />
      <input type="hidden" name="trip_id" value={tripId} />
      {departure && <input type="hidden" name="id" value={departure.id} />}

      <div className="c-row">
        <Field name="starts_on" label="Departs" error={e.starts_on}>
          <input id="starts_on" name="starts_on" type="date" defaultValue={departure?.starts_on ?? ''} required />
        </Field>
        <Field name="ends_on" label="Returns" error={e.ends_on}>
          <input id="ends_on" name="ends_on" type="date" defaultValue={departure?.ends_on ?? ''} required />
        </Field>
        <Field name="capacity" label="Places" error={e.capacity}>
          <input id="capacity" name="capacity" type="number" min={0} defaultValue={departure?.capacity ?? 0} />
        </Field>
      </div>

      <div className="c-row">
        <Field
          name="price_pence"
          label="Price per person"
          hint="Leave blank for price on request."
          error={e.price_pence}
        >
          <input id="price_pence" name="price_pence" inputMode="decimal" defaultValue={pounds(departure?.price_pence)} />
        </Field>
        <Field name="deposit_pence" label="Deposit" hint="Leave blank for none." error={e.deposit_pence}>
          <input id="deposit_pence" name="deposit_pence" inputMode="decimal" defaultValue={pounds(departure?.deposit_pence)} />
        </Field>
        <Field name="balance_due_date" label="Balance due" error={e.balance_due_date}>
          <input id="balance_due_date" name="balance_due_date" type="date" defaultValue={departure?.balance_due_date ?? ''} />
        </Field>
      </div>

      <Field name="status" label="Status" error={e.status}>
        <select id="status" name="status" defaultValue={departure?.status ?? 'open'}>
          <option value="open">On sale</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>

      <div className="c-actions">
        <Submit label={departure ? 'Save departure' : 'Add departure'} busy="Saving..." />
      </div>
    </form>
  );
}
