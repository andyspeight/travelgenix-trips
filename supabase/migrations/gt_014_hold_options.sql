-- =============================================================================
--  gt_014_hold_options.sql · billable add-ons, and a promo-redemption fix
-- =============================================================================
--  Two changes, one rewrite (the hold is only ever changed as a whole).
--
--  1. selected_options. A booking now records the priced extras chosen at
--     checkout as a jsonb snapshot (name, per, unit price, quantity, amount) so
--     the record survives the operator later editing or deleting the option.
--     The 10th arg p_option_ids carries the traveller's choices; the hold also
--     folds in every REQUIRED option whether or not the client sent it. Add-ons
--     are added AFTER any promo discount, because a code that takes money off
--     the trip should not also take it off the airport transfer.
--
--  2. Promo ordering fix. gt_012/013 incremented gt_promo_codes.redeemed the
--     moment a code matched, BEFORE the capacity and package-allocation checks.
--     A hold that then failed on sold_out or package_full burned a redemption.
--     The increment now happens only after the booking row is inserted, under
--     the same departure lock, so a failed hold never spends a code.
--
--  Signature grows to 10 args (create-or-replace keeps the grant). Everything
--  the earlier migrations verified still holds: departure row FOR UPDATE, counts
--  under READ COMMITTED, cannot oversell, per-package cap returns 'package_full'.
-- =============================================================================

-- The chosen extras, snapshotted at booking time so the record does not change
-- under the operator's feet. Default '[]' means every existing booking reads as
-- "no add-ons", and the hold overwrites it with the real selection.
alter table public.gt_bookings
  add column if not exists selected_options jsonb not null default '[]'::jsonb;

comment on column public.gt_bookings.selected_options is
  'Priced add-ons chosen at checkout, snapshotted: [{option_id,name,per,unit_pence,quantity,amount_pence}].';

create or replace function public.gt_hold_places(
  p_departure_id uuid,
  p_party_size   integer,
  p_reference    text,
  p_lead_name    text,
  p_lead_email   text,
  p_lead_phone   text   default null,
  p_travellers   jsonb  default '[]'::jsonb,
  p_package_id   uuid   default null,
  p_promo_code   text   default null,
  p_option_ids   uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_capacity     integer;
  v_status       text;
  v_trip_status  text;
  v_trip_id      uuid;
  v_hold_min     integer;
  v_price        integer;
  v_deposit      integer;
  v_pkg_price    integer;
  v_pkg_cap      integer;
  v_pkg_taken    integer;
  v_total        bigint;
  v_addons       bigint  := 0;
  v_options_json jsonb   := '[]'::jsonb;
  v_promo_id     uuid;
  v_promo_kind   text;
  v_promo_value  integer;
  v_promo_per    text;
  v_operator     uuid;
  v_currency     text;
  v_client       text;
  v_stripe       text;
  v_taken        integer;
  v_remaining    integer;
  v_email_holds  integer;
  v_now          timestamptz := now();
  v_expires      timestamptz;
  v_id           uuid;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'gt_hold_places requires READ COMMITTED (got %)',
      current_setting('transaction_isolation') using errcode = 'assert_failure';
  end if;

  set local lock_timeout = '3s';
  set local statement_timeout = '4s';

  if p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_reference is null or p_reference = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  begin
    select d.capacity, d.status, d.hold_minutes, d.price_pence, d.deposit_pence,
           t.id, t.operator_id, t.currency, t.status, o.client_record_id, o.stripe_account_id
      into v_capacity, v_status, v_hold_min, v_price, v_deposit,
           v_trip_id, v_operator, v_currency, v_trip_status, v_client, v_stripe
    from public.gt_departures d
    join public.gt_trips t     on t.id = d.trip_id
    join public.gt_operators o on o.id = t.operator_id
    where d.id = p_departure_id
    for update of d;
  exception
    when lock_not_available then
      return jsonb_build_object('ok', false, 'reason', 'busy');
  end;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_trip_status <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'departure_closed');
  end if;

  -- Package (room option). A package price, when set, is what the traveller pays.
  if p_package_id is not null then
    select price_pence, capacity into v_pkg_price, v_pkg_cap
    from public.gt_packages
    where id = p_package_id and trip_id = v_trip_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    if v_pkg_price is not null then
      v_price := v_pkg_price;
    end if;
  end if;

  -- Base fare, before any discount. Null stays null: an unpriced trip is an
  -- enquiry, and neither a promo nor an add-on turns it into a priced booking.
  v_total := case when v_price is null then null else v_price::bigint * p_party_size end;

  -- Per-email hold ceiling.
  if p_lead_email is not null and p_lead_email <> '' then
    select count(*) into v_email_holds
    from public.gt_bookings
    where departure_id = p_departure_id
      and status = 'pending'
      and (hold_expires_at is null or hold_expires_at > v_now)
      and lower(traveller_email) = lower(p_lead_email);
    if v_email_holds >= 6 then
      return jsonb_build_object('ok', false, 'reason', 'too_many_holds');
    end if;
  end if;

  -- Departure capacity.
  select coalesce(sum(party_size), 0)
    into v_taken
  from public.gt_bookings
  where departure_id = p_departure_id
    and party_size > 0
    and (
      status in ('deposit_paid', 'paid')
      or (status = 'pending' and (hold_expires_at is null or hold_expires_at > v_now))
    );

  v_remaining := v_capacity - v_taken;

  if v_remaining <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'sold_out',
      'capacity', v_capacity, 'taken', v_taken, 'remaining', 0);
  end if;
  if v_remaining < p_party_size then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_capacity',
      'capacity', v_capacity, 'taken', v_taken, 'remaining', v_remaining);
  end if;

  -- Per-package allocation. Same departure-row lock, so no oversell.
  if p_package_id is not null and v_pkg_cap is not null then
    select coalesce(sum(party_size), 0) into v_pkg_taken
    from public.gt_bookings
    where departure_id = p_departure_id and package_id = p_package_id and party_size > 0
      and (
        status in ('deposit_paid', 'paid')
        or (status = 'pending' and (hold_expires_at is null or hold_expires_at > v_now))
      );
    if v_pkg_taken + p_party_size > v_pkg_cap then
      return jsonb_build_object('ok', false, 'reason', 'package_full',
        'capacity', v_pkg_cap, 'taken', v_pkg_taken, 'remaining', greatest(v_pkg_cap - v_pkg_taken, 0));
    end if;
  end if;

  -- Promo. Matched and priced here, but NOT counted until the booking is in:
  -- a hold that fails past this point must never spend a redemption.
  if p_promo_code is not null and btrim(p_promo_code) <> '' and v_total is not null then
    select id, kind, value, per
      into v_promo_id, v_promo_kind, v_promo_value, v_promo_per
    from public.gt_promo_codes
    where operator_id = v_operator
      and upper(code) = upper(btrim(p_promo_code))
      and is_active
      and (trip_id is null or trip_id = v_trip_id)
      and (starts_on is null or starts_on <= current_date)
      and (ends_on is null or ends_on >= current_date)
      and (max_redemptions is null or redeemed < max_redemptions)
    limit 1;

    if found then
      if v_promo_kind = 'percent' then
        v_total := (v_total * (100 - least(v_promo_value, 100))) / 100;
      elsif v_promo_per = 'person' then
        v_total := v_total - (v_promo_value::bigint * p_party_size);
      else
        v_total := v_total - v_promo_value;
      end if;
      if v_total < 0 then v_total := 0; end if;
    else
      v_promo_id := null;
    end if;
  end if;

  -- Priced add-ons. Every required option, plus any the traveller chose. Charged
  -- once per booking or once per traveller. Added on top of the discounted fare.
  if v_total is not null then
    select
      coalesce(sum(case when per = 'booking' then price_pence
                        else price_pence::bigint * p_party_size end), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'option_id',    id,
        'name',         name,
        'per',          per,
        'unit_pence',   price_pence,
        'quantity',     case when per = 'booking' then 1 else p_party_size end,
        'amount_pence', case when per = 'booking' then price_pence
                             else price_pence::bigint * p_party_size end
      ) order by sort_order, created_at), '[]'::jsonb)
    into v_addons, v_options_json
    from public.gt_options
    where trip_id = v_trip_id
      and price_pence is not null
      and (is_required or id = any(p_option_ids));

    v_total := v_total + coalesce(v_addons, 0);
  end if;

  v_expires := v_now + make_interval(mins => v_hold_min);

  begin
    insert into public.gt_bookings (
      operator_id, departure_id, package_id, promo_code_id, party_size, status, hold_expires_at, reference,
      total_pence, deposit_pence, currency, traveller_name, traveller_email,
      client_record_id, stripe_account_id, selected_options
    ) values (
      v_operator, p_departure_id, p_package_id, v_promo_id, p_party_size, 'pending', v_expires, p_reference,
      v_total,
      case when v_deposit is null or v_total is null then null
           else least(v_deposit::bigint * p_party_size, v_total) end,
      coalesce(v_currency, 'gbp'), p_lead_name, p_lead_email,
      v_client, v_stripe, v_options_json
    )
    returning id into v_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'reason', 'reference_taken');
  end;

  -- The hold is in. Now, and only now, count the promo redemption.
  if v_promo_id is not null then
    update public.gt_promo_codes set redeemed = redeemed + 1, updated_at = now() where id = v_promo_id;
  end if;

  insert into public.gt_travellers (booking_id, package_id, full_name, email, phone, is_lead)
  select v_id,
         p_package_id,
         nullif(x->>'full_name', ''),
         nullif(x->>'email', ''),
         nullif(x->>'phone', ''),
         coalesce((x->>'is_lead')::boolean, false)
  from jsonb_array_elements(coalesce(p_travellers, '[]'::jsonb)) as x;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'reference', p_reference,
    'hold_expires_at', v_expires,
    'capacity', v_capacity,
    'remaining', v_remaining - p_party_size
  );
end;
$$;
