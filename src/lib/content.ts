// =============================================================================
//  lib/content.ts — sanitising and shaping a trip's rich content
// =============================================================================
//
//  The console content editor sends the whole TripContent as one JSON payload.
//  It is operator input that becomes a PUBLIC page, so the server never trusts
//  it: this sanitiser is the authority. It clamps text, validates every image
//  URL through safeImageUrl, converts prices from the pounds an operator types
//  into integer pence, and drops anything empty so the stored jsonb says what
//  the trip actually has.
//
//  Pure and dependency-light so the rules are tested without a browser.
// =============================================================================

import { safeImageUrl } from './url.ts';
import { toPence } from './money.ts';
import type {
  TripContent, TripDay, TripExtra, TripFact, TripGlanceRow, TripSection,
} from './types.ts';

const MAX = { line: 200, body: 4000, summary: 600, name: 200 };

const str = (v: unknown, cap = MAX.line): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, cap);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown, cap = MAX.line): string[] =>
  arr(v).map((x) => str(x, cap)).filter(Boolean);
const bool = (v: unknown): boolean => v === true || v === 'true' || v === 'on';

/** Prices arrive from the editor as the pounds the operator typed. Zero or
 *  unparseable becomes null ("not priced"), never 0. */
function priceFromInput(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const pence = typeof v === 'number' ? Math.round(v) : toPence(String(v));
  return pence && pence > 0 ? pence : null;
}

function images(v: unknown): string[] {
  // Only https images from trusted hosts survive.
  return arr(v).map((x) => safeImageUrl(typeof x === 'string' ? x : '')).filter((x): x is string => !!x);
}

function facts(v: unknown): TripFact[] {
  return arr(v)
    .map((f) => {
      const o = f as Record<string, unknown>;
      return { label: str(o?.label, 80), value: str(o?.value, 200) };
    })
    .filter((f) => f.label && f.value);
}

function extras(v: unknown): TripExtra[] {
  return arr(v)
    .map((e) => {
      const o = e as Record<string, unknown>;
      const out: TripExtra = { name: str(o?.name, MAX.name), pricePence: priceFromInput(o?.pricePence) };
      const note = str(o?.note, MAX.body);
      if (note) out.note = note;
      if (bool(o?.recommended)) out.recommended = true;
      return out;
    })
    .filter((e) => e.name);
}

function days(v: unknown): TripDay[] {
  return arr(v)
    .map((d) => {
      const o = d as Record<string, unknown>;
      const day: TripDay = { title: str(o?.title, MAX.name) };
      const label = str(o?.label, 40);
      const date = str(o?.date, 40);
      const body = str(o?.body, MAX.body);
      if (label) day.label = label;
      if (date) day.date = date;
      if (body) day.body = body;
      const im = images(o?.images);
      if (im.length) day.images = im;
      const f = facts(o?.facts);
      if (f.length) day.facts = f;
      const opt = extras(o?.optionalActivities);
      if (opt.length) day.optionalActivities = opt;
      return day;
    })
    .filter((d) => d.title);
}

function glance(v: unknown): TripGlanceRow[] {
  return arr(v)
    .map((g) => {
      const o = g as Record<string, unknown>;
      const row: TripGlanceRow = { day: str(o?.day, 40) };
      const date = str(o?.date, 40);
      const destination = str(o?.destination, 120);
      const accommodation = str(o?.accommodation, 200);
      if (date) row.date = date;
      if (destination) row.destination = destination;
      if (accommodation) row.accommodation = accommodation;
      return row;
    })
    .filter((g) => g.day);
}

function sections(v: unknown): TripSection[] {
  const out: TripSection[] = [];
  for (const raw of arr(v)) {
    const o = raw as Record<string, unknown>;
    const heading = str(o?.heading, MAX.name);
    if (!heading) continue;
    const type = str(o?.type, 20);

    if (type === 'columns') {
      const cols = arr(o?.columns)
        .map((c) => {
          const co = c as Record<string, unknown>;
          return { heading: str(co?.heading, 120), items: strList(co?.items) };
        })
        .filter((c) => c.heading && c.items.length);
      if (cols.length) out.push({ type: 'columns', heading, columns: cols });
      continue;
    }

    const body = str(o?.body, MAX.body);
    if (!body) continue;
    if (type === 'feature') {
      const img = safeImageUrl(str(o?.image, 500));
      out.push(img ? { type: 'feature', heading, body, image: img } : { type: 'feature', heading, body });
    } else {
      out.push({ type: 'text', heading, body });
    }
  }
  return out;
}

/** Drop empty keys so the stored content says only what the trip has. */
function compact(c: TripContent): TripContent {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v == null) continue;
    if (typeof v === 'string' && !v) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as TripContent;
}

/** The authority. Takes the editor's raw payload, returns clean TripContent. */
export function sanitiseTripContent(raw: unknown): TripContent {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return compact({
    overview: str(o.overview, MAX.body) || undefined,
    durationText: str(o.durationText, 80) || undefined,
    priceNote: str(o.priceNote, MAX.body) || undefined,
    highlights: strList(o.highlights),
    glance: glance(o.glance),
    days: days(o.days),
    // Only store a non-default layout, so an untouched trip stays clean.
    itineraryLayout: o.itineraryLayout === 'timeline' ? 'timeline' : undefined,
    included: strList(o.included),
    excluded: strList(o.excluded),
    extras: extras(o.extras),
    sections: sections(o.sections),
    gallery: images(o.gallery),
  });
}

/** Pence back to a plain pounds string for the editor inputs. */
export function penceToInput(pence: number | null | undefined): string {
  return typeof pence === 'number' && pence > 0 ? String(pence / 100) : '';
}
