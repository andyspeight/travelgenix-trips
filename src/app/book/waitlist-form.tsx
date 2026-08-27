'use client';

// The waitlist form, shown on the book page when every departure is full. Same
// controlled-input pattern as the booking form, and it confirms in place rather
// than redirecting.

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { joinWaitlistAction } from './actions';
import { EMPTY_STATE } from '@/lib/action-state';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="bk-cta" disabled={pending}>{pending ? 'Adding you...' : 'Join the waitlist'}</button>;
}

export function WaitlistForm({ tripId, operatorName }: { tripId: string; operatorName: string }) {
  const [state, action] = useActionState(joinWaitlistAction, EMPTY_STATE);
  const [f, setF] = useState({ full_name: '', email: '', phone: '', party_size: '1', note: '' });
  const e = state.errors;

  if (state.ok && state.message) {
    return (
      <div className="bk-soldout" role="status">
        <p style={{ margin: 0 }}>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="bk-form">
      <p className="bk-soldout" style={{ margin: 0 }}>
        Every departure of this trip is full right now. Leave your details and {operatorName} will
        let you know the moment a place opens.
      </p>

      <input type="hidden" name="trip_id" value={tripId} />
      {state.message && !state.ok && <p className="bk-alert" role="alert">{state.message}</p>}

      <label className={`bk-field${e.full_name ? ' bk-bad' : ''}`}>
        <span>Full name</span>
        <input name="full_name" autoComplete="name" value={f.full_name} onChange={(ev) => setF((s) => ({ ...s, full_name: ev.target.value }))} />
        {e.full_name && <p className="bk-err">{e.full_name}</p>}
      </label>

      <div className="bk-row">
        <label className={`bk-field${e.email ? ' bk-bad' : ''}`}>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" value={f.email} onChange={(ev) => setF((s) => ({ ...s, email: ev.target.value }))} />
          {e.email && <p className="bk-err">{e.email}</p>}
        </label>
        <label className={`bk-field${e.phone ? ' bk-bad' : ''}`}>
          <span>Phone <em>(optional)</em></span>
          <input name="phone" type="tel" autoComplete="tel" value={f.phone} onChange={(ev) => setF((s) => ({ ...s, phone: ev.target.value }))} />
          {e.phone && <p className="bk-err">{e.phone}</p>}
        </label>
      </div>

      <label className={`bk-field${e.party_size ? ' bk-bad' : ''}`}>
        <span>How many places?</span>
        <input name="party_size" type="number" min={1} max={20} value={f.party_size} onChange={(ev) => setF((s) => ({ ...s, party_size: ev.target.value }))} />
        {e.party_size && <p className="bk-err">{e.party_size}</p>}
      </label>

      <label className="bk-field">
        <span>Anything to add <em>(optional)</em></span>
        <textarea name="note" rows={2} value={f.note} onChange={(ev) => setF((s) => ({ ...s, note: ev.target.value }))} />
      </label>

      <Submit />
    </form>
  );
}
