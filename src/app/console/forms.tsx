'use client';

// Client forms for the console. They exist so a failed save can show which
// field was wrong, in place, without losing what the operator typed.

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTripAction, saveDepartureAction, savePackageAction, saveOptionAction, savePromoAction } from './actions';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import type { Trip, Departure, Package, TripOption } from '@/lib/types';
import { MediaField } from './media-picker';

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
  const [hero, setHero] = useState(trip?.hero_image_url ?? '');
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

      <div className={`c-field${e.hero_image_url ? ' c-field--bad' : ''}`}>
        <span>Hero image or video</span>
        <input type="hidden" name="hero_image_url" value={hero} />
        <MediaField value={hero} onChange={setHero} accept="both" />
        {e.hero_image_url && <p className="c-err">{e.hero_image_url}</p>}
      </div>

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

// ---------------------------------------------------------------------------

export function PackageForm({ tripId, pkg }: { tripId: string; pkg?: Package }) {
  const [state, action] = useActionState(savePackageAction, EMPTY_STATE);
  const [image, setImage] = useState(pkg?.image_url ?? '');
  const e = state.errors;

  return (
    <form action={action} noValidate>
      <Notice state={state} />
      <input type="hidden" name="trip_id" value={tripId} />
      {pkg && <input type="hidden" name="id" value={pkg.id} />}

      <div className="c-row">
        <Field name="name" label="Name" error={e.name}>
          <input id="name" name="name" defaultValue={pkg?.name ?? ''} placeholder="Twin share" maxLength={160} required />
        </Field>
        <Field name="occupancy" label="Sleeps" hint="People sharing." error={e.occupancy}>
          <input id="occupancy" name="occupancy" type="number" min={1} defaultValue={pkg?.occupancy ?? 1} />
        </Field>
      </div>

      <div className="c-row">
        <Field
          name="price_pence"
          label="Price per person"
          hint="Blank inherits the departure price."
          error={e.price_pence}
        >
          <input id="price_pence" name="price_pence" inputMode="decimal" defaultValue={pounds(pkg?.price_pence)} />
        </Field>
        <Field name="capacity" label="How many available" hint="Blank for no limit." error={e.capacity}>
          <input id="capacity" name="capacity" type="number" min={0} defaultValue={pkg?.capacity ?? ''} />
        </Field>
      </div>

      <Field name="description" label="Description" error={e.description}>
        <textarea id="description" name="description" defaultValue={pkg?.description ?? ''} maxLength={2000} />
      </Field>

      <div className={`c-field${e.image_url ? ' c-field--bad' : ''}`}>
        <span>Photo</span>
        <input type="hidden" name="image_url" value={image} />
        <MediaField value={image} onChange={setImage} accept="image" />
        {e.image_url && <p className="c-err">{e.image_url}</p>}
      </div>

      <div className="c-row">
        <Field name="info_url" label="More info link" hint="An https link travellers can open." error={e.info_url}>
          <input id="info_url" name="info_url" defaultValue={pkg?.info_url ?? ''} placeholder="https://..." />
        </Field>
        <Field name="sort_order" label="Order" hint="Lower shows first." error={e.sort_order}>
          <input id="sort_order" name="sort_order" type="number" defaultValue={pkg?.sort_order ?? 0} />
        </Field>
      </div>

      <div className="c-actions">
        <Submit label={pkg ? 'Save package' : 'Add package'} busy="Saving..." />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function OptionForm({ tripId, option }: { tripId: string; option?: TripOption }) {
  const [state, action] = useActionState(saveOptionAction, EMPTY_STATE);
  const e = state.errors;

  return (
    <form action={action} noValidate>
      <Notice state={state} />
      <input type="hidden" name="trip_id" value={tripId} />
      {option && <input type="hidden" name="id" value={option.id} />}

      <div className="c-row">
        <Field name="name" label="Name" error={e.name}>
          <input id="name" name="name" defaultValue={option?.name ?? ''} placeholder="Airport transfer" maxLength={160} required />
        </Field>
        <Field name="price_pence" label="Price" hint="Blank means no charge." error={e.price_pence}>
          <input id="price_pence" name="price_pence" inputMode="decimal" defaultValue={pounds(option?.price_pence)} />
        </Field>
        <Field name="per" label="Charged" error={e.per}>
          <select id="per" name="per" defaultValue={option?.per ?? 'traveller'}>
            <option value="traveller">Per traveller</option>
            <option value="booking">Per booking</option>
          </select>
        </Field>
      </div>

      <Field name="description" label="Description" error={e.description}>
        <textarea id="description" name="description" defaultValue={option?.description ?? ''} maxLength={2000} />
      </Field>

      <label className="ce-check">
        <input type="checkbox" name="is_required" defaultChecked={option?.is_required ?? false} />
        {' '}Everyone must take this, so it is added to every booking
      </label>

      <Field name="sort_order" label="Order" hint="Lower shows first." error={e.sort_order}>
        <input id="sort_order" name="sort_order" type="number" defaultValue={option?.sort_order ?? 0} />
      </Field>

      <div className="c-actions">
        <Submit label={option ? 'Save extra' : 'Add extra'} busy="Saving..." />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function PromoForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(savePromoAction, EMPTY_STATE);
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const e = state.errors;

  return (
    <form action={action} noValidate>
      <Notice state={state} />
      <input type="hidden" name="id" value={tripId} />

      <div className="c-row">
        <Field name="code" label="Code" hint="Letters and numbers." error={e.code}>
          <input id="code" name="code" placeholder="EARLYBIRD" style={{ textTransform: 'uppercase' }} />
        </Field>
        <Field name="kind" label="Type" error={e.kind}>
          <select id="kind" name="kind" value={kind} onChange={(ev) => setKind(ev.target.value as 'percent' | 'amount')}>
            <option value="percent">Percent off</option>
            <option value="amount">Amount off</option>
          </select>
        </Field>
        <Field name="value" label={kind === 'percent' ? 'Percent' : 'Amount off'} error={e.value}>
          <input id="value" name="value" inputMode="decimal" placeholder={kind === 'percent' ? '10' : '50'} />
        </Field>
      </div>

      {kind === 'amount' && (
        <Field name="per" label="Apply the amount" error={e.per}>
          <select id="per" name="per" defaultValue="booking">
            <option value="booking">Once per booking</option>
            <option value="person">Per person</option>
          </select>
        </Field>
      )}

      <div className="c-row">
        <Field name="starts_on" label="Valid from" hint="Optional." error={e.starts_on}>
          <input id="starts_on" name="starts_on" type="date" />
        </Field>
        <Field name="ends_on" label="Valid until" hint="Optional." error={e.ends_on}>
          <input id="ends_on" name="ends_on" type="date" />
        </Field>
        <Field name="max_redemptions" label="Max uses" hint="Blank for no limit." error={e.max_redemptions}>
          <input id="max_redemptions" name="max_redemptions" type="number" min={1} />
        </Field>
      </div>

      <div className="c-actions">
        <Submit label="Add code" busy="Saving..." />
      </div>
    </form>
  );
}
