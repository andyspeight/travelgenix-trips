'use client';

// The Integrations screen's interactive parts: add an endpoint (with the signing
// secret shown once), turn endpoints on and off, remove them, and send a test
// event to prove a receiver works. Server actions do the writing; this only
// holds the transient UI state — the just-minted secret and the last test result
// per endpoint.

import { useActionState, useState, useTransition } from 'react';
// useTransition drives the per-row "Send test" pending state.
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { addWebhookAction, toggleWebhookAction, removeWebhookAction, sendTestWebhookAction } from '../actions';

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  last_status: number | null;
  last_at: string | null;
  secretRedacted: string;
}

const EVENT_LABEL: Record<string, string> = {
  'booking.created': 'Booking created',
  'booking.updated': 'Booking updated',
};

function describeEvents(events: string[]): string {
  if (events.length === 0) return 'All events';
  return events.map((e) => EVENT_LABEL[e] ?? e).join(', ');
}

function healthLabel(status: number | null): { text: string; cls: string } {
  if (status == null) return { text: 'Not yet called', cls: 'c-pill--draft' };
  if (status >= 200 && status < 300) return { text: `OK (${status})`, cls: 'c-pill--published' };
  if (status === 0) return { text: 'No response', cls: 'c-pill--cancelled' };
  return { text: `Error ${status}`, cls: 'c-pill--cancelled' };
}

function AddForm() {
  const [state, action] = useActionState<ActionState, FormData>(addWebhookAction, EMPTY_STATE);
  const newSecret = state.ok && state.message.startsWith('secret:') ? state.message.slice('secret:'.length) : '';

  return (
    <form action={action} noValidate>
      {state.message && !state.ok && <p className="c-note c-note--bad">{state.message}</p>}

      {newSecret && (
        <div className="c-note c-note--ok" role="status">
          <strong>Endpoint saved.</strong> Copy your signing secret now — it is shown only this once. Use it to
          verify the <code className="c-mono">x-tg-signature</code> header on each delivery.
          <div className="c-mono" style={{ marginTop: 8, wordBreak: 'break-all', fontWeight: 600 }}>{newSecret}</div>
        </div>
      )}

      <div className="c-field">
        <label htmlFor="wh-url">Endpoint URL</label>
        <input id="wh-url" name="url" type="url" inputMode="url" placeholder="https://hooks.yoursystem.com/travelgenix" required />
        {state.errors.url && <span className="c-err">{state.errors.url}</span>}
        <span className="c-hint">Must be https. We POST a signed JSON body here on each event.</span>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: '4px 0 12px' }}>
        <legend className="c-hint" style={{ padding: 0 }}>Send which events</legend>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 16 }}>
          <input type="checkbox" name="events" value="booking.created" defaultChecked /> Booking created
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" name="events" value="booking.updated" defaultChecked /> Booking updated
        </label>
      </fieldset>

      <div className="c-actions">
        <button className="c-btn c-btn--primary" type="submit">Add endpoint</button>
      </div>
    </form>
  );
}

function Row({ w }: { w: WebhookRow }) {
  const [isPending, start] = useTransition();
  const [testResult, setTestResult] = useState<string>('');
  const health = healthLabel(w.last_status);

  function runTest() {
    setTestResult('');
    start(async () => {
      const r = await sendTestWebhookAction(w.id);
      setTestResult(r.ok ? `Test delivered (${r.status}).` : r.status ? `Endpoint replied ${r.status}.` : 'No response from endpoint.');
    });
  }

  return (
    <li>
      <span className="c-name" style={{ wordBreak: 'break-all' }}>{w.url}</span>
      <span className={`c-pill ${w.active ? 'c-pill--published' : 'c-pill--draft'}`}>{w.active ? 'Active' : 'Paused'}</span>
      <span className={`c-pill ${health.cls}`}>{health.text}</span>
      <span className="c-meta">
        {describeEvents(w.events)} · secret <code className="c-mono">{w.secretRedacted}</code>
        {testResult && <> · {testResult}</>}
      </span>
      <span className="c-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="c-btn c-btn--quiet" type="button" onClick={runTest} disabled={isPending}>
          {isPending ? 'Sending…' : 'Send test'}
        </button>
        <form action={toggleWebhookAction}>
          <input type="hidden" name="id" value={w.id} />
          <input type="hidden" name="active" value={(!w.active).toString()} />
          <button className="c-btn c-btn--quiet" type="submit">{w.active ? 'Pause' : 'Resume'}</button>
        </form>
        <form action={removeWebhookAction}>
          <input type="hidden" name="id" value={w.id} />
          <button className="c-btn c-btn--quiet" type="submit">Remove</button>
        </form>
      </span>
    </li>
  );
}

export function WebhooksManager({ initial }: { initial: WebhookRow[] }) {
  return (
    <>
      {initial.length > 0 ? (
        <ul className="c-list">{initial.map((w) => <Row key={w.id} w={w} />)}</ul>
      ) : (
        <p className="c-empty">No endpoints yet. Add one below to start receiving booking events in your own systems.</p>
      )}

      <h2 style={{ fontSize: '1rem' }}>Add an endpoint</h2>
      <AddForm />
    </>
  );
}
