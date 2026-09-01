'use client';

import { useActionState } from 'react';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { submitDemoAction } from '../actions';

export function DemoForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitDemoAction, EMPTY_STATE);
  const e = state.errors;

  if (state.ok && state.message) {
    return (
      <div className="m-form-card">
        <div className="m-note m-note--ok" role="status" style={{ marginBottom: 0 }}>
          <strong>Thanks.</strong> {state.message.replace(/^Thanks\.?\s*/i, '')}
        </div>
      </div>
    );
  }

  return (
    <form className="m-form-card" action={action} noValidate>
      {state.message && !state.ok && <p className="m-note m-note--bad" role="alert">{state.message}</p>}

      {/* honeypot — visually hidden, off the tab order */}
      <div className="m-hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="m-field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" autoComplete="name" required />
        {e.name && <span className="m-err">{e.name}</span>}
      </div>

      <div className="m-field">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" autoComplete="organization" />
      </div>

      <div className="m-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        {e.email && <span className="m-err">{e.email}</span>}
      </div>

      <div className="m-field">
        <label htmlFor="phone">Phone (optional)</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" />
      </div>

      <div className="m-field">
        <label htmlFor="volume_band">Rough annual booking volume</label>
        <select id="volume_band" name="volume_band" defaultValue="">
          <option value="">Prefer not to say</option>
          <option value="under-75k">Under £75k</option>
          <option value="75k-400k">£75k to £400k</option>
          <option value="over-400k">Over £400k</option>
          <option value="not-sure">Not sure yet</option>
        </select>
      </div>

      <div className="m-field">
        <label htmlFor="message">Anything you would like us to know? (optional)</label>
        <textarea id="message" name="message" rows={3} />
      </div>

      <button className="m-btn m-btn--primary m-btn--lg" type="submit" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'Sending…' : 'Request a demo'}
      </button>
    </form>
  );
}
