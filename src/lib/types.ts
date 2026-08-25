// =============================================================================
//  lib/types.ts — row shapes for the gt_002 schema
// =============================================================================
//  Hand-written for now. Once the migration is applied these can be generated
//  from the live database instead, and generated should win over hand-written.
// =============================================================================

export type PlanBand = 'trial' | 'start' | 'grow' | 'scale' | 'enterprise';
export type TripKind = 'group' | 'tour';
export type TripStatus = 'draft' | 'published' | 'archived';
export type DepartureStatus = 'open' | 'closed' | 'cancelled';
export type BookingStatus = 'pending' | 'deposit_paid' | 'paid' | 'cancelled' | 'expired';
export type PaymentKind = 'deposit' | 'balance' | 'instalment';

export interface Operator {
  id: string;
  client_record_id: string | null;
  name: string;
  slug: string;
  contact_email: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  brand: OperatorBrand;
  plan_band: PlanBand;
  custom_domain: string | null;
}

export interface OperatorBrand {
  logoUrl?: string;
  primaryColour?: string;
  accentColour?: string;
  fontFamily?: string;
  replyTo?: string;
}

export interface Trip {
  id: string;
  operator_id: string;
  slug: string;
  title: string;
  summary: string | null;
  kind: TripKind;
  status: TripStatus;
  hero_image_url: string | null;
  location: string | null;
  currency: string;
  content: TripContent;
  legacy_widget_id: string | null;
}

/**
 * The long-form body of a trip.
 *
 * Widened on 25 Aug 2026 when the Kenya tour was migrated across and the first
 * draft turned out to drop real content: the itinerary-at-a-glance table, the
 * priced extras, the per-day optional activities and the free-form practical
 * sections (packing list, visa notes, the vehicle). Every field here exists
 * because a real tour carried it, not because it seemed likely.
 */
export interface TripContent {
  overview?: string;
  durationText?: string;
  priceNote?: string;
  highlights?: string[];
  /** The itinerary-at-a-glance table: one row per day. */
  glance?: TripGlanceRow[];
  days?: TripDay[];
  included?: string[];
  excluded?: string[];
  /** Trip-wide priced extras. A zero price means "not priced", not free. */
  extras?: TripExtra[];
  /** Free-form practical sections: packing list, visas, the vehicle. */
  sections?: TripSection[];
  gallery?: string[];
}

export interface TripGlanceRow {
  day: string;
  date?: string;
  destination?: string;
  accommodation?: string;
}

export interface TripDay {
  label?: string;
  date?: string;
  title: string;
  body?: string;
  images?: string[];
  /** Accommodation, meals, driving time, altitude. Ordered, so an array of
   *  pairs rather than an object: a Record loses the author's ordering. */
  facts?: TripFact[];
  optionalActivities?: TripExtra[];
}

export interface TripFact {
  label: string;
  value: string;
}

export interface TripExtra {
  name: string;
  pricePence?: number | null;
  note?: string;
  recommended?: boolean;
}

/** Three shapes cover everything the Tour Builder emits today. */
export type TripSection =
  | { type: 'text'; heading: string; body: string }
  | { type: 'feature'; heading: string; body: string; image?: string }
  | { type: 'columns'; heading: string; columns: Array<{ heading: string; items: string[] }> };

export interface Departure {
  id: string;
  trip_id: string;
  starts_on: string;
  ends_on: string;
  capacity: number;
  price_pence: number | null;
  deposit_pence: number | null;
  balance_due_date: string | null;
  hold_minutes: number;
  status: DepartureStatus;
}

export interface Package {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  price_pence: number | null;
  occupancy: number;
  capacity: number | null;
  image_url: string | null;
  info_url: string | null;
  sort_order: number;
}
