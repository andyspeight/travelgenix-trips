'use client';

// =============================================================================
//  The Messages tab — broadcast to a trip's travellers, with reusable templates.
//  Compose once, pick who it reaches, see the count before sending, and save any
//  message as a template (the thing WeTravel's own users ask for). Sending goes
//  through the notify seam: it composes and records now and delivers the moment
//  an email key is configured.
// =============================================================================

import { useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendBroadcastAction, saveTemplateAction, deleteTemplateAction } from '../../../actions';
import { EMPTY_STATE } from '@/lib/action-state';
import type { MessageTemplate, TripMessage } from '@/lib/types';

interface Segment { id: string; label: string; count: number }

function Send({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="c-btn c-btn--primary" disabled={pending || count === 0}>
      {pending ? 'Sending...' : `Send to ${count} ${count === 1 ? 'person' : 'people'}`}
    </button>
  );
}

export function MessagesTab({
  tripId, segments, templates, messages,
}: {
  tripId: string; segments: Segment[]; templates: MessageTemplate[]; messages: TripMessage[];
}) {
  const [state, action] = useActionState(sendBroadcastAction, EMPTY_STATE);
  const [segment, setSegment] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateName, setTemplateName] = useState('');

  const count = segments.find((s) => s.id === segment)?.count ?? 0;
  const e = state.errors;

  function loadTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body); }
  }

  return (
    <div className="msg-grid">
      <div>
        <form action={action} noValidate>
          <input type="hidden" name="id" value={tripId} />

          {state.message && <p className={`c-note ${state.ok ? 'c-note--ok' : 'c-note--bad'}`}>{state.message}</p>}

          {templates.length > 0 && (
            <label className="c-field">
              <span>Start from a template</span>
              <select defaultValue="" onChange={(ev) => { loadTemplate(ev.target.value); ev.target.value = ''; }}>
                <option value="" disabled>Choose a template...</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}

          <label className="c-field">
            <span>Send to</span>
            <select name="segment" value={segment} onChange={(ev) => setSegment(ev.target.value)}>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.count})</option>)}
            </select>
          </label>

          <label className={`c-field${e.subject ? ' c-field--bad' : ''}`}>
            <span>Subject</span>
            <input name="subject" value={subject} onChange={(ev) => setSubject(ev.target.value)} maxLength={200} />
            {e.subject && <p className="c-err">{e.subject}</p>}
          </label>

          <label className={`c-field${e.body ? ' c-field--bad' : ''}`}>
            <span>Message</span>
            <textarea name="body" value={body} rows={9} onChange={(ev) => setBody(ev.target.value)} maxLength={10000} />
            {e.body && <p className="c-err">{e.body}</p>}
          </label>

          <div className="c-actions">
            <Send count={count} />
          </div>
        </form>

        {/* Save-as-template sits OUTSIDE the compose form (no nested forms); it
            reads the current subject and body through hidden inputs. */}
        <form action={saveTemplateAction} className="msg-save">
          <input type="hidden" name="trip_id" value={tripId} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="body" value={body} />
          <input name="name" placeholder="Template name" value={templateName} onChange={(ev) => setTemplateName(ev.target.value)} maxLength={120} />
          <button type="submit" className="c-btn" disabled={!templateName.trim() || !subject.trim() || !body.trim()}>Save as template</button>
        </form>
      </div>

      <aside className="msg-side">
        {templates.length > 0 && (
          <div className="msg-block">
            <h3>Templates</h3>
            <ul className="msg-templates">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" className="msg-tmpl-use" onClick={() => { setSubject(t.subject); setBody(t.body); }}>{t.name}</button>
                  <form action={deleteTemplateAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="trip_id" value={tripId} />
                    <button type="submit" className="c-btn c-btn--quiet" aria-label={`Delete ${t.name}`}>×</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="msg-block">
          <h3>Sent</h3>
          {messages.length === 0 ? (
            <p className="c-empty" style={{ padding: '8px 0' }}>Nothing sent yet.</p>
          ) : (
            <ul className="msg-sent">
              {messages.map((mgs) => (
                <li key={mgs.id}>
                  <strong>{mgs.subject}</strong>
                  <span>{mgs.recipient_count} {mgs.recipient_count === 1 ? 'recipient' : 'recipients'} · {formatWhen(mgs.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}
