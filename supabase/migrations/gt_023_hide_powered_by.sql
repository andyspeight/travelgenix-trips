-- =============================================================================
--  gt_023_hide_powered_by.sql · the white-label toggle
-- =============================================================================
--  WeTravel-parity gap 9 (white-label), the branding slice. Every public page a
--  traveller sees already renders in the operator's brand; this adds the one
--  thing that still gave the platform away — a small "Powered by Travelgenix
--  Trips" credit in the footer — and lets an operator turn it off.
--
--  Default false: the credit shows. Setting it true is the white-label perk:
--  the operator's public pages then carry no Travelgenix mark at all. DNS-level
--  custom domains are a separate, later piece; this is the visible half.
-- =============================================================================

alter table public.gt_operators add column if not exists hide_powered_by boolean not null default false;

comment on column public.gt_operators.hide_powered_by is
  'White-label toggle: when true, public pages omit the "Powered by Travelgenix Trips" footer credit.';
