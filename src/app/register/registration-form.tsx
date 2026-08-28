'use client';

// =============================================================================
//  The traveller registration form
// =============================================================================
//  Completes a booking: every traveller's details, the operator's custom
//  questions, and — where the waiver is mandatory — a signature from each
//  traveller. That last part is the gate WeTravel is missing.
//
//  Controlled inputs throughout, for the same reason as the booking form: React
//  19 resets an uncontrolled form after an action, which would wipe everything
//  a traveller typed on a validation error. The whole thing is submitted as one
//  JSON payload; lib/registration.ts is the authority that validates it.
// =============================================================================

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitRegistrationAction } from '../console/actions';
import { EMPTY_STATE } from '@/lib/action-state';
import type { RegField } from '@/lib/types';

export interface SlotPrefill {
  id: string | null;
  full_name: string; email: string; phone: string; date_of_birth: string;
  answers: Record<string, string>;
  signed: boolean; signed_name: string;
}

export interface DocPrefill {
  id: string;
  traveller_id: string | null;
  field_key: string;
  file_name: string;
}

// Files the bucket accepts, mirrored for a friendly client-side reject before a
// doomed upload. The server and the bucket are the real authority.
const DOC_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const DOC_MAX_BYTES = 5 * 1024 * 1024;

/**
 * One document upload. Uploads immediately on choosing a file, out of band from
 * the main form: the file never rides the registration JSON payload. Shows what
 * is already there and offers a replace. A per-traveller document needs a saved
 * traveller, so an unnamed slot is told to save first.
 */
function DocumentField({
  reference, field, travellerId, initialName,
}: {
  reference: string; field: RegField; travellerId: string | null; initialName: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState<string | null>(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTraveller = field.scope === 'traveller' && !travellerId;

  async function onPick(file: File) {
    setError(null);
    if (file.size > DOC_MAX_BYTES) { setError('That file is over the 5 MB limit.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('reference', reference);
      fd.append('field_key', field.key);
      if (travellerId) fd.append('traveller_id', travellerId);
      const res = await fetch('/api/register/document', { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError((body && body.message) || 'The upload did not work. Please try again.');
      } else {
        setName(body.document?.file_name ?? file.name);
      }
    } catch {
      setError('The upload did not work. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="bk-field reg-doc">
      <span>{field.label}{field.required && <em className="reg-req"> *</em>}</span>
      {field.help && <span className="bk-hint" style={{ margin: 0 }}>{field.help}</span>}

      {needsTraveller ? (
        <p className="reg-doc-hint">Add this traveller’s name and save first, then come back to upload their document.</p>
      ) : (
        <>
          {name && <p className="reg-doc-have">✓ {name} uploaded</p>}
          <div className="reg-doc-row">
            <button type="button" className="bk-promo-apply" disabled={busy}
              onClick={() => inputRef.current?.click()}>
              {busy ? 'Uploading...' : name ? 'Replace' : 'Upload'}
            </button>
            <span className="bk-hint" style={{ margin: 0 }}>Photo or PDF, up to 5 MB.</span>
          </div>
          <input ref={inputRef} type="file" accept={DOC_ACCEPT} hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); }} />
        </>
      )}
      {error && <p className="bk-err">{error}</p>}
    </div>
  );
}

interface WaiverView { title: string; body: string; is_mandatory: boolean; version: number }

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="bk-cta" disabled={pending}>{pending ? 'Saving...' : label}</button>;
}

/** One custom question, rendered by its type. */
function Field({
  field, value, onChange, error, id,
}: {
  field: RegField; value: string; onChange: (v: string) => void; error?: string; id: string;
}) {
  const common = { id, name: id, 'aria-invalid': error ? true : undefined };

  if (field.type === 'checkbox') {
    return (
      <label className="reg-check">
        <input type="checkbox" checked={value === 'on'} onChange={(e) => onChange(e.target.checked ? 'on' : '')} />
        <span>{field.label}{field.required && <em className="reg-req"> *</em>}</span>
        {error && <p className="bk-err">{error}</p>}
      </label>
    );
  }

  return (
    <label className={`bk-field${error ? ' bk-bad' : ''}`}>
      <span>{field.label}{field.required && <em className="reg-req"> *</em>}</span>
      {field.help && <span className="bk-hint" style={{ margin: 0 }}>{field.help}</span>}
      {field.type === 'long_text' ? (
        <textarea {...common} value={value} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'select' ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose...</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <p className="bk-err">{error}</p>}
    </label>
  );
}

function Paragraphs({ body }: { body: string }) {
  return <>{body.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</>;
}

export function RegistrationForm({
  reference, partySize, slots: initialSlots, schema, waiver, bookingAnswers: initialBooking, documents = [],
}: {
  reference: string;
  partySize: number;
  slots: SlotPrefill[];
  schema: RegField[];
  waiver: WaiverView | null;
  bookingAnswers: Record<string, string>;
  documents?: DocPrefill[];
}) {
  const [state, action] = useActionState(submitRegistrationAction, EMPTY_STATE);

  // Look up an already-uploaded document by traveller (or booking) and field.
  const docName = (travellerId: string | null, fieldKey: string): string | null =>
    documents.find((d) => d.traveller_id === travellerId && d.field_key === fieldKey)?.file_name ?? null;

  const [slots, setSlots] = useState<SlotPrefill[]>(() =>
    Array.from({ length: partySize }, (_, i) => initialSlots[i] ?? {
      id: null, full_name: '', email: '', phone: '', date_of_birth: '', answers: {}, signed: false, signed_name: '',
    }),
  );
  const [booking, setBooking] = useState<Record<string, string>>(() => ({ ...initialBooking }));

  const e = state.errors;
  const perTraveller = schema.filter((f) => f.scope === 'traveller');
  const perBooking = schema.filter((f) => f.scope === 'booking');

  const setSlot = (i: number, patch: Partial<SlotPrefill>) =>
    setSlots((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const setAnswer = (i: number, key: string, v: string) =>
    setSlots((prev) => prev.map((s, k) => (k === i ? { ...s, answers: { ...s.answers, [key]: v } } : s)));

  const payload = JSON.stringify({ travellers: slots, booking_answers: booking });

  return (
    <form action={action} noValidate className="bk-form">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="payload" value={payload} />

      {state.message && !state.ok && <p className="bk-alert" role="alert">{state.message}</p>}

      {slots.map((s, i) => (
        <div key={i} className="bk-section">
          <h2>{i === 0 ? 'Lead traveller' : `Traveller ${i + 1}`}</h2>

          <label className={`bk-field${e[`t${i}.full_name`] ? ' bk-bad' : ''}`}>
            <span>Full name<em className="reg-req"> *</em></span>
            <input value={s.full_name} autoComplete="off" onChange={(ev) => setSlot(i, { full_name: ev.target.value })} />
            {e[`t${i}.full_name`] && <p className="bk-err">{e[`t${i}.full_name`]}</p>}
          </label>

          <div className="bk-row">
            <label className={`bk-field${e[`t${i}.email`] ? ' bk-bad' : ''}`}>
              <span>Email <em>(optional)</em></span>
              <input type="email" value={s.email} onChange={(ev) => setSlot(i, { email: ev.target.value })} />
              {e[`t${i}.email`] && <p className="bk-err">{e[`t${i}.email`]}</p>}
            </label>
            <label className="bk-field">
              <span>Phone <em>(optional)</em></span>
              <input type="tel" value={s.phone} onChange={(ev) => setSlot(i, { phone: ev.target.value })} />
            </label>
          </div>

          <label className={`bk-field${e[`t${i}.date_of_birth`] ? ' bk-bad' : ''}`}>
            <span>Date of birth <em>(optional)</em></span>
            <input type="date" value={s.date_of_birth} onChange={(ev) => setSlot(i, { date_of_birth: ev.target.value })} />
            {e[`t${i}.date_of_birth`] && <p className="bk-err">{e[`t${i}.date_of_birth`]}</p>}
          </label>

          {perTraveller.map((f) => (
            f.type === 'document' ? (
              <DocumentField key={f.key} reference={reference} field={f}
                travellerId={s.id} initialName={docName(s.id, f.key)} />
            ) : (
              <Field key={f.key} field={f} id={`t${i}_${f.key}`}
                value={s.answers[f.key] ?? ''} onChange={(v) => setAnswer(i, f.key, v)}
                error={e[`t${i}.${f.key}`]} />
            )
          ))}
        </div>
      ))}

      {perBooking.length > 0 && (
        <div className="bk-section">
          <h2>About your booking</h2>
          {perBooking.map((f) => (
            f.type === 'document' ? (
              <DocumentField key={f.key} reference={reference} field={f}
                travellerId={null} initialName={docName(null, f.key)} />
            ) : (
              <Field key={f.key} field={f} id={`b_${f.key}`}
                value={booking[f.key] ?? ''} onChange={(v) => setBooking((prev) => ({ ...prev, [f.key]: v }))}
                error={e[`booking.${f.key}`]} />
            )
          ))}
        </div>
      )}

      {waiver && (
        <div className="bk-section">
          <h2>{waiver.title}{waiver.is_mandatory && <em className="reg-req"> *</em>}</h2>
          <div className="reg-waiver"><Paragraphs body={waiver.body} /></div>
          <p className="bk-hint" style={{ margin: 0 }}>
            {waiver.is_mandatory
              ? 'Each traveller must agree before the booking is complete.'
              : 'Agreement is optional for this trip.'}
          </p>
          {slots.map((s, i) => (
            <div key={i} className={`reg-sign${e[`t${i}.waiver`] ? ' bk-bad' : ''}`}>
              <label className="reg-check">
                <input type="checkbox" checked={s.signed}
                  onChange={(ev) => setSlot(i, { signed: ev.target.checked, signed_name: ev.target.checked && !s.signed_name ? s.full_name : s.signed_name })} />
                <span>I, <strong>{s.full_name || `traveller ${i + 1}`}</strong>, agree to the above.</span>
              </label>
              {s.signed && (
                <input className="reg-sign-name" value={s.signed_name} placeholder="Type your full name to sign"
                  onChange={(ev) => setSlot(i, { signed_name: ev.target.value })} />
              )}
              {e[`t${i}.waiver`] && <p className="bk-err">{e[`t${i}.waiver`]}</p>}
            </div>
          ))}
        </div>
      )}

      <Submit label="Complete registration" />
      <p className="bk-note">Your details go straight to the operator. You can come back and update them any time with your reference.</p>
    </form>
  );
}
