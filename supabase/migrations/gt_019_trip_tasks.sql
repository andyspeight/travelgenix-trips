-- =============================================================================
--  gt_019_trip_tasks.sql · participant task checklists
-- =============================================================================
--  WeTravel-parity gap 8. An operator authors a checklist of to-dos on a trip
--  ("book your travel insurance", "send us your flight details", each with an
--  optional due date). Each booking sees the list on its confirmation hub and
--  ticks items off; the operator sees how far each booking has got.
--
--  Deliberately per-BOOKING, not per-traveller: the things a whole party manages
--  together. Per-traveller obligations (details, forms, waivers, documents)
--  already live in the registration + documents engine, which this does not
--  duplicate. Self-certified, like WeTravel's participant tasks.
--
--  RLS on, no policies, service-role only. The one-done-row-per-(task,booking)
--  rule is the unique index; ticking is idempotent.
-- =============================================================================

create table if not exists public.gt_trip_tasks (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  trip_id     uuid not null references public.gt_trips(id)     on delete cascade,
  label       text not null,
  detail      text,
  due_date    date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.gt_trip_tasks is
  'Operator-authored per-booking to-do checklist for a trip. Travellers tick items off on their confirmation hub.';

create index if not exists gt_trip_tasks_trip_idx on public.gt_trip_tasks (trip_id, sort_order);

create table if not exists public.gt_task_done (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.gt_trip_tasks(id) on delete cascade,
  booking_id uuid not null references public.gt_bookings(id)   on delete cascade,
  done_at    timestamptz not null default now()
);

comment on table public.gt_task_done is
  'A row means a booking has completed a task. Absence means outstanding.';

-- One done-row per (task, booking); ticking twice is a no-op, not a duplicate.
create unique index if not exists gt_task_done_uniq on public.gt_task_done (task_id, booking_id);
create index if not exists gt_task_done_booking_idx on public.gt_task_done (booking_id);

alter table public.gt_trip_tasks enable row level security;
alter table public.gt_task_done  enable row level security;
