-- =============================================================================
--  gt_016_operator_members.sql · team roles within an operator
-- =============================================================================
--  P1: team permissions. Identity still lives in tg-widgets SSO (Trips issues no
--  login of its own), so this is AUTHORISATION, not authentication: which people
--  under an operator may do what inside the Trips console.
--
--  A member is an email and a role scoped to one operator. Roles:
--    owner    full control, including managing the team
--    manager  edit trips, departures, packages, options, promos, messaging and
--             booking status; cannot manage the team
--    viewer   read-only
--
--  Safe rollout, enforced in lib/members.ts, not here: until an operator adds any
--  member, everyone under its client keeps full (owner) access, so nothing locks
--  out on deploy. The operator's own contact_email is always owner and can never
--  be demoted or removed, so a team can never lock itself out. Once members
--  exist, a signed-in user who is neither the contact nor a listed member is
--  read-only rather than shut out.
-- =============================================================================

create table if not exists public.gt_operator_members (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.gt_operators(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('owner','manager','viewer')),
  invited_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.gt_operator_members is
  'Team roles within an operator (owner/manager/viewer). Authorisation only; identity is tg-widgets SSO. See lib/members.ts for the resolution rules.';

-- One role per email per operator, case-insensitive (emails are compared lower).
create unique index if not exists gt_operator_members_uniq
  on public.gt_operator_members (operator_id, lower(email));

alter table public.gt_operator_members enable row level security;
