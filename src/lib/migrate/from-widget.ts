// =============================================================================
//  lib/migrate/from-widget.ts
// =============================================================================
//
//  Maps a saved tg-widgets Escorted Tour or Group Trip config into the platform
//  schema. Used once per trip to move a live embed off Airtable and onto its own
//  record, keeping the tgw_ id on the trip so the old embed keeps answering.
//
//  Pure and dependency-light on purpose: the mapping is the risky part, so it is
//  tested against the real saved configs rather than trusted.
//
//  Rules it must not break:
//    - A zero price means "not priced yet", so it becomes null rather than 0.
//    - Nothing is invented. A field the config does not carry stays absent.
//    - The tour's own design block is DROPPED: branding belongs to the operator
//      record now, not to each trip.
//
// =============================================================================

import { slugify } from '../validate.ts';
import type {
  TripContent, TripDay, TripExtra, TripFact, TripGlanceRow, TripSection,
} from '../types.ts';

/** The saved config, as loosely as it really arrives. */
export interface WidgetTourConfig {
  tour?: Record<string, unknown>;
  trip?: Record<string, unknown>;
  glance?: unknown;
  highlights?: unknown;
  days?: unknown;
  extras?: unknown;
  included?: unknown;
  excluded?: unknown;
  sections?: unknown;
  gallery?: unknown;
}

export interface MappedTrip {
  title: string;
  slug: string;
  summary: string | null;
  kind: 'group' | 'tour';
  location: string | null;
  currency: string;
  hero_image_url: string | null;
  legacy_widget_id: string;
  content: TripContent;
}

export interface MappedDeparture {
  starts_on: string;
  ends_on: string;
  capacity: number;
  price_pence: number | null;
  deposit_pence: number | null;
  balance_due_date: string | null;
  status: 'open';
}

export interface MappedOption {
  name: string;
  description: string | null;
  price_pence: number | null;
  per: 'traveller' | 'booking';
  sort_order: number;
}

export interface Mapped {
  trip: MappedTrip;
  departures: MappedDeparture[];
  options: MappedOption[];
}

// --- small readers, tolerant of a config that is missing a field entirely ---

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strList = (v: unknown): string[] => arr(v).map(str).filter(Boolean);

/** Zero is "not priced yet", so it becomes null and never renders as free. */
export function priceOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const isoDate = (v: unknown): string | null => {
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

function facts(v: unknown): TripFact[] {
  return arr(v)
    .map((f) => {
      const o = f as Record<string, unknown>;
      return { label: str(o?.label), value: str(o?.value) };
    })
    .filter((f) => f.label && f.value);
}

function extras(v: unknown): TripExtra[] {
  return arr(v)
    .map((e) => {
      const o = e as Record<string, unknown>;
      const out: TripExtra = { name: str(o?.name), pricePence: priceOrNull(o?.pricePence) };
      if (str(o?.note)) out.note = str(o.note);
      if (o?.recommended === true) out.recommended = true;
      return out;
    })
    .filter((e) => e.name);
}

function days(v: unknown): TripDay[] {
  return arr(v)
    .map((d) => {
      const o = d as Record<string, unknown>;
      const day: TripDay = { title: str(o?.title) };
      if (str(o?.label)) day.label = str(o.label);
      if (str(o?.date)) day.date = str(o.date);
      if (str(o?.body)) day.body = str(o.body);
      const imgs = strList(o?.images);
      if (imgs.length) day.images = imgs;
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
      const row: TripGlanceRow = { day: str(o?.day) };
      if (str(o?.date)) row.date = str(o.date);
      if (str(o?.destination)) row.destination = str(o.destination);
      if (str(o?.accommodation)) row.accommodation = str(o.accommodation);
      return row;
    })
    .filter((g) => g.day);
}

function sections(v: unknown): TripSection[] {
  const out: TripSection[] = [];
  for (const raw of arr(v)) {
    const o = raw as Record<string, unknown>;
    const heading = str(o?.heading);
    if (!heading) continue;

    if (str(o?.type) === 'columns') {
      const cols = arr(o?.columns)
        .map((c) => {
          const co = c as Record<string, unknown>;
          return { heading: str(co?.heading), items: strList(co?.items) };
        })
        .filter((c) => c.heading && c.items.length);
      if (cols.length) out.push({ type: 'columns', heading, columns: cols });
      continue;
    }

    const body = str(o?.body);
    if (!body) continue;

    if (str(o?.type) === 'feature') {
      const img = str(o?.image);
      out.push(img ? { type: 'feature', heading, body, image: img } : { type: 'feature', heading, body });
    } else {
      out.push({ type: 'text', heading, body });
    }
  }
  return out;
}

/** Drops empty keys so the stored jsonb says what the trip actually has. */
function compact(content: TripContent): TripContent {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(content)) {
    if (v == null) continue;
    if (typeof v === 'string' && !v) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as TripContent;
}

// ---------------------------------------------------------------------------

export function mapWidgetConfig(config: WidgetTourConfig, widgetId: string): Mapped {
  // An Escorted Tour nests under `tour`, a Group Trip under `trip`.
  const isTour = Boolean(config.tour);
  const head = (config.tour ?? config.trip ?? {}) as Record<string, unknown>;

  const title = str(head.title) || 'Untitled trip';

  const content = compact({
    overview: str(head.overview) || undefined,
    durationText: str(head.durationText) || undefined,
    priceNote: str(head.priceNote) || undefined,
    highlights: strList(config.highlights),
    glance: glance(config.glance),
    days: days(config.days),
    included: strList(config.included),
    excluded: strList(config.excluded),
    extras: extras(config.extras),
    sections: sections(config.sections),
    gallery: strList(config.gallery),
  });

  const trip: MappedTrip = {
    title,
    slug: slugify(title),
    // The subtitle is the one-line pitch, which is what summary is for.
    summary: str(head.subtitle) || str(head.description) || null,
    kind: isTour ? 'tour' : 'group',
    location: str(head.location) || null,
    currency: (str(head.currency) || 'gbp').toLowerCase(),
    hero_image_url: str(head.heroImage) || null,
    legacy_widget_id: widgetId,
    content,
  };

  // One saved config carries exactly one set of dates, so one departure.
  // Further dates are added in the console rather than invented here.
  const starts = isoDate(head.startDate);
  const ends = isoDate(head.endDate);
  const departures: MappedDeparture[] =
    starts && ends && ends >= starts
      ? [{
          starts_on: starts,
          ends_on: ends,
          capacity: Math.max(0, Number.parseInt(String(head.capacity ?? 0), 10) || 0),
          price_pence: priceOrNull(head.pricePerPersonPence ?? head.pricePence),
          deposit_pence: priceOrNull(head.depositPence),
          balance_due_date: isoDate(head.balanceDueDate),
          status: 'open',
        }]
      : [];

  // Trip-wide extras become options. A single supplement is an option too: it
  // is a per-traveller charge, not a room type.
  const options: MappedOption[] = [];
  const single = priceOrNull(head.singleSupplementPence);
  if (single) {
    options.push({
      name: 'Single supplement',
      description: null,
      price_pence: single,
      per: 'traveller',
      sort_order: 0,
    });
  }
  for (const [i, e] of extras(config.extras).entries()) {
    options.push({
      name: e.name,
      description: e.note ?? null,
      price_pence: e.pricePence ?? null,
      per: 'traveller',
      sort_order: i + 1,
    });
  }

  return { trip, departures, options };
}
