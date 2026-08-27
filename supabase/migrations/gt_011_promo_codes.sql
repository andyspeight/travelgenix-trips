-- =============================================================================
--  gt_011_promo_codes.sql · discount / early-bird codes
-- =============================================================================
--  A code discounts a booking's total. Operator-scoped, optionally tied to one
--  trip (null = all this operator's trips) and to a date window and a
--  redemption cap. The code is unique per operator, case-insensitively. RLS on.
-- =============================================================================

create table if not exists public.gt_promo_codes (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  trip_id uuid references public.gt_trips(id) on delete cascade,
  code text not null,
  kind text not null default 'percent' check (kind in ('percent','amount')),
  value integer not null check (value >= 0),
  per text not null default 'booking' check (per in ('booking','person')),
  starts_on date,
  ends_on date,
  max_redemptions integer,
  redeemed integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists gt_promo_codes_code on public.gt_promo_codes (operator_id, upper(code));
alter table public.gt_promo_codes enable row level security;

-- The code a booking used, for the record and the redemption count.
alter table public.gt_bookings add column if not exists promo_code_id uuid references public.gt_promo_codes(id);
