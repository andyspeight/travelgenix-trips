'use client';

// The API keys half of the Integrations screen: mint a key (shown once), see the
// keys you have (by their visible prefix and last use), and revoke one. The key
// itself never comes back from the server after creation — only its prefix — so
// the one-time copy box is the operator's only chance to save it.

import { useActionState } from 'react';
import { EMPTY_STATE, type ActionState } from '@/lib/action-state';
import { createApiKeyAction, revokeApiKeyAction } from '../actions';

export interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function when(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'never' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AddForm() {
  const [state, action] = useActionState<ActionState, FormData>(createApiKeyAction, EMPTY_STATE);
  const newKey = state.ok && state.message.startsWith('key:') ? state.message.slice('key:'.length) : '';

  return (
    <form action={action} noValidate>
      {state.message && !state.ok && <p className="c-note c-note--bad">{state.message}</p>}

      {newKey && (
        <div className="c-note c-note--ok" role="status">
          <strong>Key created.</strong> Copy it now — it is shown only this once and cannot be recovered. Send it as
          <code className="c-mono"> Authorization: Bearer …</code> on your API requests.
          <div className="c-mono" style={{ marginTop: 8, wordBreak: 'break-all', fontWeight: 600 }}>{newKey}</div>
        </div>
      )}

      <div className="c-field">
        <label htmlFor="key-name">Key name (optional)</label>
        <input id="key-name" name="name" type="text" maxLength={80} placeholder="e.g. Zapier, our CRM sync" />
        <span className="c-hint">A label to tell your keys apart. It never appears in requests.</span>
      </div>

      <div className="c-actions">
        <button className="c-btn c-btn--primary" type="submit">Create API key</button>
      </div>
    </form>
  );
}

function Row({ k }: { k: ApiKeyRow }) {
  const revoked = Boolean(k.revoked_at);
  return (
    <li>
      <span className="c-name"><code className="c-mono">{k.key_prefix}…</code></span>
      {k.name && <span className="c-meta">{k.name}</span>}
      {revoked
        ? <span className="c-pill c-pill--cancelled">Revoked</span>
        : <span className="c-pill c-pill--published">Active</span>}
      <span className="c-meta">last used {when(k.last_used_at)} · created {when(k.created_at)}</span>
      {!revoked && (
        <span className="c-right">
          <form action={revokeApiKeyAction}>
            <input type="hidden" name="id" value={k.id} />
            <button className="c-btn c-btn--quiet" type="submit">Revoke</button>
          </form>
        </span>
      )}
    </li>
  );
}

export function ApiKeysManager({ initial }: { initial: ApiKeyRow[] }) {
  return (
    <>
      {initial.length > 0 ? (
        <ul className="c-list">{initial.map((k) => <Row key={k.id} k={k} />)}</ul>
      ) : (
        <p className="c-empty">No API keys yet. Create one below to read your bookings or push trips in from your own systems.</p>
      )}

      <h2 style={{ fontSize: '1rem' }}>Create an API key</h2>
      <AddForm />
    </>
  );
}
