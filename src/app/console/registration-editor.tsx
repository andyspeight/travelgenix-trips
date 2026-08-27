'use client';

// =============================================================================
//  The registration editor — custom questions and the waiver
// =============================================================================
//  Two independent forms an operator fills in on a trip:
//
//    FormBuilder  the custom questions travellers answer at registration. Held
//                 in React state and submitted as one JSON schema; the server
//                 sanitiser (lib/registration.ts) is the authority that cleans
//                 it and keeps each key stable so stored answers still match.
//    WaiverEditor the agreement each traveller signs. Plain fields; an empty
//                 body removes it. Versioning happens server-side once signed.
//
//  They sit as siblings on the trip editor page, each its own <form>, exactly
//  like the details / content / departure forms already there.
// =============================================================================

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveFormAction, saveWaiverAction } from './actions';
import { EMPTY_STATE } from '@/lib/action-state';
import { FIELD_TYPES, nextFieldKey } from '@/lib/registration';
import type { RegField, RegFieldType, RegScope, FormRow, Waiver } from '@/lib/types';

// --- edit model: RegField with options as one-per-line text -----------------

interface EditField {
  key: string; label: string; type: RegFieldType; scope: RegScope;
  required: boolean; help: string; optionsText: string;
}

function fromSchema(schema: RegField[]): EditField[] {
  return schema.map((f) => ({
    key: f.key, label: f.label, type: f.type, scope: f.scope,
    required: f.required, help: f.help ?? '', optionsText: (f.options ?? []).join('\n'),
  }));
}

function toWire(fields: EditField[]): unknown {
  return fields.map((f) => ({
    key: f.key, label: f.label, type: f.type, scope: f.scope, required: f.required,
    help: f.help,
    options: f.type === 'select' ? f.optionsText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
  }));
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="c-btn c-btn--primary" disabled={pending}>{pending ? 'Saving...' : label}</button>;
}

// ---------------------------------------------------------------------------

function FormBuilder({ tripId, schema }: { tripId: string; schema: RegField[] }) {
  const [state, action] = useActionState(saveFormAction, EMPTY_STATE);
  const [fields, setFields] = useState<EditField[]>(() => fromSchema(schema));

  const set = (i: number, patch: Partial<EditField>) =>
    setFields((prev) => prev.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const del = (i: number) => setFields((prev) => prev.filter((_, k) => k !== i));
  const add = () =>
    setFields((prev) => [
      ...prev,
      { key: nextFieldKey(prev.map((f) => f.key)), label: '', type: 'short_text', scope: 'traveller', required: false, help: '', optionsText: '' },
    ]);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="schema" value={JSON.stringify(toWire(fields))} />

      {state.message && <p className={`c-note ${state.ok ? 'c-note--ok' : 'c-note--bad'}`}>{state.message}</p>}

      <p className="c-hint" style={{ marginTop: 0 }}>
        The questions each traveller answers when they complete their booking. Ask once per
        traveller (a dietary need) or once for the whole booking (an emergency contact).
      </p>

      {fields.length === 0 && (
        <p className="c-empty" style={{ marginBottom: 14 }}>No questions yet. Travellers will just give their names.</p>
      )}

      {fields.map((f, i) => (
        <div key={f.key} className="ce-section">
          <div className="ce-grid2">
            <input value={f.label} placeholder="Question, e.g. Dietary requirements"
              onChange={(e) => set(i, { label: e.target.value })} />
            <div className="ce-row">
              <select value={f.type} onChange={(e) => set(i, { type: e.target.value as RegFieldType })} aria-label="Answer type">
                {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
              <button type="button" className="c-btn c-btn--quiet" onClick={() => del(i)} aria-label="Remove question">×</button>
            </div>
          </div>

          <div className="ce-grid2">
            <select value={f.scope} onChange={(e) => set(i, { scope: e.target.value as RegScope })} aria-label="Ask per">
              <option value="traveller">Ask each traveller</option>
              <option value="booking">Ask once per booking</option>
            </select>
            <label className="ce-check">
              <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required
            </label>
          </div>

          <input value={f.help} placeholder="Help text (optional)" onChange={(e) => set(i, { help: e.target.value })} />

          {f.type === 'select' && (
            <textarea value={f.optionsText} rows={3} placeholder="One option per line"
              onChange={(e) => set(i, { optionsText: e.target.value })} />
          )}
        </div>
      ))}

      <div className="c-actions">
        <button type="button" className="c-btn ce-add" onClick={add}>Add question</button>
        <SaveButton label="Save questions" />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function WaiverEditor({ tripId, waiver }: { tripId: string; waiver: Waiver | null }) {
  const [state, action] = useActionState(saveWaiverAction, EMPTY_STATE);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="id" value={tripId} />

      {state.message && <p className={`c-note ${state.ok ? 'c-note--ok' : 'c-note--bad'}`}>{state.message}</p>}

      <p className="c-hint" style={{ marginTop: 0 }}>
        The agreement each traveller signs. Leave it empty for no waiver. Once someone has
        signed, editing the text keeps their signature on the old version.
      </p>

      <label className="c-field"><span>Title</span>
        <input name="title" defaultValue={waiver?.title ?? ''} placeholder="Booking agreement" />
      </label>

      <label className="c-field"><span>Agreement text</span>
        <textarea name="body" rows={8} defaultValue={waiver?.body ?? ''}
          placeholder="The terms travellers agree to. Leave a blank line between paragraphs." />
      </label>

      <label className="ce-check">
        <input type="checkbox" name="is_mandatory" defaultChecked={waiver ? waiver.is_mandatory : true} />
        {' '}Travellers must sign this before their booking is complete
      </label>

      {waiver && <p className="c-hint">Current version: {waiver.version}.</p>}

      <div className="c-actions"><SaveButton label="Save agreement" /></div>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function RegistrationEditor({ tripId, form, waiver }: { tripId: string; form: FormRow | null; waiver: Waiver | null }) {
  return (
    <>
      <div className="ce-block">
        <div className="ce-block-head"><span>Custom questions</span></div>
        <FormBuilder tripId={tripId} schema={form?.schema ?? []} />
      </div>

      <div className="ce-block">
        <div className="ce-block-head"><span>Waiver</span></div>
        <WaiverEditor tripId={tripId} waiver={waiver} />
      </div>
    </>
  );
}
