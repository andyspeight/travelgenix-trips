-- =============================================================================
--  gt_018_reviews.sql · verified trip reviews
-- =============================================================================
--  WeTravel-parity gap 7. A review is left by someone who actually booked: the
--  public collection page is reachable only with a booking reference (the same
--  bearer token as /register and /booked), and the review is tied to that
--  booking, so "verified" means what it says. One review per booking.
--
--  Reviews are public-facing, so they are NOT shown until an operator approves
--  them (status pending -> approved / hidden). operator_id and trip_id are
--  denormalised for the scoped moderation and public reads.
--
--  RLS on, no policies, service-role only, like every table. Moderation and the
--  one-review-per-booking rule are enforced in the app and by the unique index.
-- =============================================================================

create table if not exists public.gt_reviews (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references public.gt_operators(id) on delete cascade,
  trip_id       uuid not null references public.gt_trips(id)     on delete cascade,
  -- The booking this review came from. Null only if the booking is later removed;
  -- the review (and its moderation state) survives.
  booking_id    uuid references public.gt_bookings(id) on delete set null,

  reviewer_name text not null,
  rating        integer not null check (rating between 1 and 5),
  title         text,
  body          text not null,
  status        text not null default 'pending' check (status in ('pending','approved','hidden')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.gt_reviews is
  'Verified trip reviews: collected reference-gated (only real bookers), operator-moderated, shown publicly only when approved.';

-- One review per booking. Partial so a null booking_id (a rescued review whose
-- booking was deleted) never collides.
create unique index if not exists gt_reviews_booking_uniq
  on public.gt_reviews (booking_id) where booking_id is not null;

create index if not exists gt_reviews_trip_idx on public.gt_reviews (trip_id, status);
create index if not exists gt_reviews_operator_idx on public.gt_reviews (operator_id);

alter table public.gt_reviews enable row level security;
