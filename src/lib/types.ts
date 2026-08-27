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

/** Whether an add-on is charged once for the whole booking (a private transfer)
 *  or once for each traveller on it (an excursion, a meal plan). */
export type OptionPer = 'traveller' | 'booking';

/** A priced extra a traveller can add at checkout. `is_required` ones are always
 *  charged; the rest are opt-in. Capacity exists on the row but is not enforced
 *  by the hold yet, so it is not offered in the authoring UI. */
export interface TripOption {
  id: string;
  trip_id: string;
  name: string;
  description: string | null;
  price_pence: number | null;
  per: OptionPer;
  is_required: boolean;
  capacity: number | null;
  sort_order: number;
}

/** What the hold snapshots onto a booking's selected_options: the extras chosen,
 *  frozen at their price and name so a later edit never rewrites the record. */
export interface SelectedOption {
  option_id: string;
  name: string;
  per: OptionPer;
  unit_pence: number;
  quantity: number;
  amount_pence: number;
}

// ---------------------------------------------------------------------------
//  Phase 4 — the people. Travellers, custom registration forms, and waivers.
// ---------------------------------------------------------------------------

export interface Traveller {
  id: string;
  booking_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  is_lead: boolean;
  package_id: string | null;
}

/** The question types an operator can put on a registration form. Deliberately
 *  a small, practical set: every one maps to a native input and a clean way to
 *  validate it. */
export type RegFieldType =
  | 'short_text' | 'long_text' | 'email' | 'phone'
  | 'date' | 'number' | 'select' | 'checkbox';

/** Whether a question is asked once for the whole booking (an emergency contact)
 *  or once per traveller (a dietary requirement). */
export type RegScope = 'traveller' | 'booking';

export interface RegField {
  /** Stable across edits: answers are stored under this key, so it must not
   *  change when a label is reworded. Minted when the field is added. */
  key: string;
  label: string;
  type: RegFieldType;
  scope: RegScope;
  required: boolean;
  help?: string;
  /** For 'select' only. */
  options?: string[];
}

/** One custom form per trip. `schema` is the ordered list of questions. */
export interface FormRow {
  id: string;
  trip_id: string;
  name: string;
  schema: RegField[];
}

/** A waiver an operator writes, versioned. A signature points at the exact text
 *  it signed through the version and a hash, so a later edit never rewrites what
 *  someone already agreed to. */
export interface Waiver {
  id: string;
  operator_id: string;
  trip_id: string | null;
  title: string;
  body: string;
  version: number;
  is_mandatory: boolean;
}

export interface Signature {
  id: string;
  waiver_id: string;
  booking_id: string;
  traveller_id: string | null;
  signed_name: string;
  signed_at: string;
  body_sha256: string;
}

export type PromoKind = 'percent' | 'amount';
export type PromoPer = 'booking' | 'person';

export interface PromoCode {
  id: string;
  operator_id: string;
  trip_id: string | null;
  code: string;
  kind: PromoKind;
  value: number;
  per: PromoPer;
  starts_on: string | null;
  ends_on: string | null;
  max_redemptions: number | null;
  redeemed: number;
  is_active: boolean;
}

export interface MessageTemplate {
  id: string;
  operator_id: string;
  name: string;
  subject: string;
  body: string;
}

export interface TripMessage {
  id: string;
  subject: string;
  body: string;
  segment: { status?: string; room?: string };
  recipient_count: number;
  created_at: string;
}

export type WaitlistStatus = 'waiting' | 'invited' | 'converted' | 'removed';

export interface WaitlistEntry {
  id: string;
  trip_id: string;
  departure_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  party_size: number;
  note: string | null;
  status: WaitlistStatus;
  created_at: string;
}
