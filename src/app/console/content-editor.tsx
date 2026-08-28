'use client';

// =============================================================================
//  The rich trip-content editor
// =============================================================================
//  Edits everything the public page renders beyond the basics: overview,
//  highlights, the at-a-glance table, the day-by-day itinerary (with facts,
//  photos and optional activities), included/excluded, priced extras, the
//  practical sections and the gallery.
//
//  The whole tree is held in React state and submitted as ONE JSON payload;
//  the server sanitiser (lib/content.ts) is the authority that cleans it. Prices
//  are edited in pounds and converted server-side.
// =============================================================================

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTripContentAction } from './actions';
import { EMPTY_STATE } from '@/lib/action-state';
import { penceToInput } from '@/lib/content';
import { MediaField, MediaListField } from './media-picker';
import type { TripContent, ItineraryLayout } from '@/lib/types';

// --- edit model: TripContent with prices as pound strings ------------------

interface EditDay { label: string; date: string; title: string; body: string; facts: { label: string; value: string }[]; images: string[]; activities: { name: string; price: string }[] }
interface EditSection { type: 'text' | 'feature' | 'columns'; heading: string; body: string; image: string; columns: { heading: string; items: string[] }[] }
interface EditModel {
  overview: string; durationText: string; priceNote: string;
  highlights: string[];
  glance: { day: string; date: string; destination: string; accommodation: string }[];
  days: EditDay[];
  itineraryLayout: ItineraryLayout;
  included: string[]; excluded: string[];
  extras: { name: string; price: string; note: string; recommended: boolean }[];
  sections: EditSection[];
  gallery: string[];
}

function fromContent(c: TripContent): EditModel {
  return {
    overview: c.overview ?? '',
    durationText: c.durationText ?? '',
    priceNote: c.priceNote ?? '',
    highlights: c.highlights ?? [],
    glance: (c.glance ?? []).map((g) => ({ day: g.day, date: g.date ?? '', destination: g.destination ?? '', accommodation: g.accommodation ?? '' })),
    days: (c.days ?? []).map((d) => ({
      label: d.label ?? '', date: d.date ?? '', title: d.title, body: d.body ?? '',
      facts: (d.facts ?? []).map((f) => ({ label: f.label, value: f.value })),
      images: d.images ?? [],
      activities: (d.optionalActivities ?? []).map((a) => ({ name: a.name, price: penceToInput(a.pricePence) })),
    })),
    itineraryLayout: c.itineraryLayout === 'timeline' ? 'timeline' : 'days',
    included: c.included ?? [],
    excluded: c.excluded ?? [],
    extras: (c.extras ?? []).map((e) => ({ name: e.name, price: penceToInput(e.pricePence), note: e.note ?? '', recommended: !!e.recommended })),
    sections: (c.sections ?? []).map((s): EditSection => s.type === 'columns'
      ? { type: 'columns', heading: s.heading, body: '', image: '', columns: s.columns.map((c2) => ({ heading: c2.heading, items: c2.items })) }
      : { type: s.type, heading: s.heading, body: s.body, image: s.type === 'feature' ? (s.image ?? '') : '', columns: [] }),
    gallery: c.gallery ?? [],
  };
}

function toWire(m: EditModel): unknown {
  return {
    overview: m.overview, durationText: m.durationText, priceNote: m.priceNote,
    highlights: m.highlights,
    glance: m.glance,
    days: m.days.map((d) => ({
      label: d.label, date: d.date, title: d.title, body: d.body,
      facts: d.facts, images: d.images,
      optionalActivities: d.activities.map((a) => ({ name: a.name, pricePence: a.price })),
    })),
    itineraryLayout: m.itineraryLayout,
    included: m.included, excluded: m.excluded,
    extras: m.extras.map((e) => ({ name: e.name, pricePence: e.price, note: e.note, recommended: e.recommended })),
    sections: m.sections.map((s) => s.type === 'columns'
      ? { type: 'columns', heading: s.heading, columns: s.columns }
      : { type: s.type, heading: s.heading, body: s.body, image: s.image }),
    gallery: m.gallery,
  };
}

function Save() {
  const { pending } = useFormStatus();
  return <button type="submit" className="c-btn c-btn--primary" disabled={pending}>{pending ? 'Saving...' : 'Save content'}</button>;
}

// --- small building blocks --------------------------------------------------

function StringList({ label, hint, value, onChange, textarea }: { label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; textarea?: boolean }) {
  const set = (i: number, v: string) => onChange(value.map((x, k) => (k === i ? v : x)));
  const add = () => onChange([...value, '']);
  const del = (i: number) => onChange(value.filter((_, k) => k !== i));
  return (
    <div className="ce-block">
      <div className="ce-block-head"><span>{label}</span></div>
      {hint && <p className="c-hint" style={{ marginTop: 0 }}>{hint}</p>}
      {value.map((v, i) => (
        <div key={i} className="ce-row">
          {textarea
            ? <textarea value={v} onChange={(e) => set(i, e.target.value)} rows={2} />
            : <input value={v} onChange={(e) => set(i, e.target.value)} />}
          <button type="button" className="c-btn c-btn--quiet" onClick={() => del(i)} aria-label="Remove">×</button>
        </div>
      ))}
      <button type="button" className="c-btn ce-add" onClick={add}>Add</button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ContentEditor({ tripId, content }: { tripId: string; content: TripContent }) {
  const [state, action] = useActionState(saveTripContentAction, EMPTY_STATE);
  const [m, setM] = useState<EditModel>(() => fromContent(content));

  const patch = (p: Partial<EditModel>) => setM((prev) => ({ ...prev, ...p }));

  // Day helpers
  const setDay = (i: number, d: Partial<EditDay>) => patch({ days: m.days.map((x, k) => (k === i ? { ...x, ...d } : x)) });
  const addDay = () => patch({ days: [...m.days, { label: '', date: '', title: '', body: '', facts: [], images: [], activities: [] }] });
  const delDay = (i: number) => patch({ days: m.days.filter((_, k) => k !== i) });

  // Extra helpers
  const setExtra = (i: number, e: Partial<EditModel['extras'][number]>) => patch({ extras: m.extras.map((x, k) => (k === i ? { ...x, ...e } : x)) });

  return (
    <form action={action} noValidate>
      <input type="hidden" name="id" value={tripId} />
      <input type="hidden" name="content" value={JSON.stringify(toWire(m))} />

      {state.message && <p className={`c-note ${state.ok ? 'c-note--ok' : 'c-note--bad'}`}>{state.message}</p>}

      <label className="c-field"><span>Overview</span>
        <textarea value={m.overview} rows={3} onChange={(e) => patch({ overview: e.target.value })} />
      </label>
      <div className="c-row">
        <label className="c-field"><span>Duration</span>
          <input value={m.durationText} placeholder="11 days / 10 nights" onChange={(e) => patch({ durationText: e.target.value })} />
        </label>
        <label className="c-field"><span>Price note</span>
          <input value={m.priceNote} placeholder="Per person sharing." onChange={(e) => patch({ priceNote: e.target.value })} />
        </label>
      </div>

      <StringList label="Highlights" value={m.highlights} onChange={(v) => patch({ highlights: v })} />

      {/* At a glance */}
      <div className="ce-block">
        <div className="ce-block-head"><span>At a glance</span></div>
        {m.glance.map((g, i) => (
          <div key={i} className="ce-grid4">
            <input value={g.day} placeholder="Day 1" onChange={(e) => patch({ glance: m.glance.map((x, k) => k === i ? { ...x, day: e.target.value } : x) })} />
            <input value={g.date} placeholder="24 Oct" onChange={(e) => patch({ glance: m.glance.map((x, k) => k === i ? { ...x, date: e.target.value } : x) })} />
            <input value={g.destination} placeholder="Nairobi" onChange={(e) => patch({ glance: m.glance.map((x, k) => k === i ? { ...x, destination: e.target.value } : x) })} />
            <div className="ce-row">
              <input value={g.accommodation} placeholder="Hotel" onChange={(e) => patch({ glance: m.glance.map((x, k) => k === i ? { ...x, accommodation: e.target.value } : x) })} />
              <button type="button" className="c-btn c-btn--quiet" onClick={() => patch({ glance: m.glance.filter((_, k) => k !== i) })} aria-label="Remove">×</button>
            </div>
          </div>
        ))}
        <button type="button" className="c-btn ce-add" onClick={() => patch({ glance: [...m.glance, { day: '', date: '', destination: '', accommodation: '' }] })}>Add row</button>
      </div>

      {/* Day by day */}
      <div className="ce-block">
        <div className="ce-block-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>Day by day</span>
          <label className="ce-layout" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="c-hint" style={{ margin: 0 }}>Layout</span>
            <select value={m.itineraryLayout} onChange={(e) => patch({ itineraryLayout: e.target.value as ItineraryLayout })} aria-label="Itinerary layout">
              <option value="days">Stacked days</option>
              <option value="timeline">Timeline</option>
            </select>
          </label>
        </div>
        {m.days.map((d, i) => (
          <div key={i} className="ce-day">
            <div className="ce-day-top">
              <input className="ce-day-label" value={d.label} placeholder="Day 1" onChange={(e) => setDay(i, { label: e.target.value })} />
              <input className="ce-day-date" value={d.date} placeholder="24 Oct" onChange={(e) => setDay(i, { date: e.target.value })} />
              <button type="button" className="c-btn c-btn--quiet" onClick={() => delDay(i)}>Remove day</button>
            </div>
            <input className="ce-day-title" value={d.title} placeholder="Day title" onChange={(e) => setDay(i, { title: e.target.value })} />
            <textarea value={d.body} rows={3} placeholder="What happens on this day" onChange={(e) => setDay(i, { body: e.target.value })} />

            <div className="ce-sub">
              <span className="ce-sub-label">Facts</span>
              {d.facts.map((f, k) => (
                <div key={k} className="ce-grid2">
                  <input value={f.label} placeholder="Accommodation" onChange={(e) => setDay(i, { facts: d.facts.map((x, j) => j === k ? { ...x, label: e.target.value } : x) })} />
                  <div className="ce-row">
                    <input value={f.value} placeholder="Serena Lodge" onChange={(e) => setDay(i, { facts: d.facts.map((x, j) => j === k ? { ...x, value: e.target.value } : x) })} />
                    <button type="button" className="c-btn c-btn--quiet" onClick={() => setDay(i, { facts: d.facts.filter((_, j) => j !== k) })} aria-label="Remove">×</button>
                  </div>
                </div>
              ))}
              <button type="button" className="c-btn ce-add" onClick={() => setDay(i, { facts: [...d.facts, { label: '', value: '' }] })}>Add fact</button>
            </div>

            <div className="ce-sub">
              <span className="ce-sub-label">Photos</span>
              <MediaListField values={d.images} onChange={(v) => setDay(i, { images: v })} accept="image" />
            </div>

            <div className="ce-sub">
              <span className="ce-sub-label">Optional activities</span>
              {d.activities.map((a, k) => (
                <div key={k} className="ce-grid2">
                  <input value={a.name} placeholder="Balloon safari" onChange={(e) => setDay(i, { activities: d.activities.map((x, j) => j === k ? { ...x, name: e.target.value } : x) })} />
                  <div className="ce-row">
                    <input value={a.price} inputMode="decimal" placeholder="Price pp" onChange={(e) => setDay(i, { activities: d.activities.map((x, j) => j === k ? { ...x, price: e.target.value } : x) })} />
                    <button type="button" className="c-btn c-btn--quiet" onClick={() => setDay(i, { activities: d.activities.filter((_, j) => j !== k) })} aria-label="Remove">×</button>
                  </div>
                </div>
              ))}
              <button type="button" className="c-btn ce-add" onClick={() => setDay(i, { activities: [...d.activities, { name: '', price: '' }] })}>Add activity</button>
            </div>
          </div>
        ))}
        <button type="button" className="c-btn ce-add" onClick={addDay}>Add day</button>
      </div>

      <div className="c-row">
        <StringList label="What is included" value={m.included} onChange={(v) => patch({ included: v })} />
        <StringList label="What is not included" value={m.excluded} onChange={(v) => patch({ excluded: v })} />
      </div>

      {/* Extras */}
      <div className="ce-block">
        <div className="ce-block-head"><span>Optional extras</span></div>
        {m.extras.map((e, i) => (
          <div key={i} className="ce-extra">
            <div className="ce-grid2">
              <input value={e.name} placeholder="Balloon safari" onChange={(ev) => setExtra(i, { name: ev.target.value })} />
              <div className="ce-row">
                <input value={e.price} inputMode="decimal" placeholder="Price pp" onChange={(ev) => setExtra(i, { price: ev.target.value })} />
                <button type="button" className="c-btn c-btn--quiet" onClick={() => patch({ extras: m.extras.filter((_, k) => k !== i) })} aria-label="Remove">×</button>
              </div>
            </div>
            <input value={e.note} placeholder="Short note (optional)" onChange={(ev) => setExtra(i, { note: ev.target.value })} />
            <label className="ce-check"><input type="checkbox" checked={e.recommended} onChange={(ev) => setExtra(i, { recommended: ev.target.checked })} /> Recommended</label>
          </div>
        ))}
        <button type="button" className="c-btn ce-add" onClick={() => patch({ extras: [...m.extras, { name: '', price: '', note: '', recommended: false }] })}>Add extra</button>
      </div>

      {/* Practical sections */}
      <div className="ce-block">
        <div className="ce-block-head"><span>Practical sections</span></div>
        <p className="c-hint" style={{ marginTop: 0 }}>Visa notes, packing lists, the vehicle, anything good to know.</p>
        {m.sections.map((s, i) => (
          <div key={i} className="ce-section">
            <div className="ce-grid2">
              <input value={s.heading} placeholder="Section heading" onChange={(e) => patch({ sections: m.sections.map((x, k) => k === i ? { ...x, heading: e.target.value } : x) })} />
              <div className="ce-row">
                <select value={s.type} onChange={(e) => patch({ sections: m.sections.map((x, k) => k === i ? { ...x, type: e.target.value as EditSection['type'] } : x) })}>
                  <option value="text">Text</option>
                  <option value="feature">Text with image</option>
                  <option value="columns">Two columns of bullets</option>
                </select>
                <button type="button" className="c-btn c-btn--quiet" onClick={() => patch({ sections: m.sections.filter((_, k) => k !== i) })} aria-label="Remove">×</button>
              </div>
            </div>
            {s.type === 'columns' ? (
              <div className="ce-cols">
                {[0, 1].map((ci) => {
                  const col = s.columns[ci] ?? { heading: '', items: [] };
                  const setCol = (c: { heading: string; items: string[] }) => {
                    const cols = [s.columns[0] ?? { heading: '', items: [] }, s.columns[1] ?? { heading: '', items: [] }];
                    cols[ci] = c;
                    patch({ sections: m.sections.map((x, k) => k === i ? { ...x, columns: cols } : x) });
                  };
                  return (
                    <div key={ci}>
                      <input value={col.heading} placeholder={`Column ${ci + 1} heading`} onChange={(e) => setCol({ ...col, heading: e.target.value })} />
                      <textarea value={col.items.join('\n')} rows={4} placeholder="One item per line" onChange={(e) => setCol({ ...col, items: e.target.value.split('\n') })} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <textarea value={s.body} rows={4} placeholder="Section text. Leave a blank line between paragraphs." onChange={(e) => patch({ sections: m.sections.map((x, k) => k === i ? { ...x, body: e.target.value } : x) })} />
                {s.type === 'feature' && (
                  <MediaField value={s.image} accept="image" label="Section image"
                    onChange={(url) => patch({ sections: m.sections.map((x, k) => k === i ? { ...x, image: url } : x) })} />
                )}
              </>
            )}
          </div>
        ))}
        <button type="button" className="c-btn ce-add" onClick={() => patch({ sections: [...m.sections, { type: 'text', heading: '', body: '', image: '', columns: [] }] })}>Add section</button>
      </div>

      <div className="ce-block">
        <div className="ce-block-head"><span>Gallery</span></div>
        <p className="c-hint" style={{ marginTop: 0 }}>Images and video. The first item leads the gallery.</p>
        <MediaListField values={m.gallery} onChange={(v) => patch({ gallery: v })} accept="both" />
      </div>

      <div className="c-actions"><Save /></div>
    </form>
  );
}
