-- =============================================================================
--  gt_004_hold_fixes.sql · corrections to gt_hold_places from the review
-- =============================================================================
--
--  Four fixes an adversarial review confirmed against the live code:
--
--   1. DEPOSIT SCALING. total_pence scaled by party_size but deposit_pence did
--      not, so a group's deposit was understated by a factor of the party size.
--      deposit_pence is per-person (the editor labels it beside "Price per
--      person" and validation caps it against the per-person price), so it must
--      scale too. Null-safe: an unpriced departure has no deposit basis.
--
--   2. PUBLISH KILL SWITCH. The hold did not check the trip is published, so
--      unpublishing could not stop an in-progress abuse run. It now requires
--      the trip to be published and returns not_found otherwise (not leaking
--      that an unpublished trip exists).
--
--   3. PER-EMAIL HOLD CAP. A naive infra-free brake on hold-spam griefing: one
--      email may hold at most 6 unexpired pending places on a departure. This
--      does NOT replace per-IP rate limiting (which needs a shared store and is
--      a documented follow-up); it stops the trivial and accidental cases.
--
--   4. OVERFLOW GUARD. total is computed in bigint so the multiplication cannot
--      overflow int4 before the column store; departure price is separately
--      bounded at save time (validate.ts) so the stored value fits int4.
--
--  Safe to re-run: CREATE OR REPLACE.
-- =============================================================================

create or replace function public.gt_hold_places(
  p_departure_id uuid,
  p_party_size   integer,
  p_reference    text,
  p_lead_name    text,
  p_lead_email   text,
  p_lead_phone   text   default null,
  p_travellers   jsonb  default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_capacity    integer;
  v_status      text;
  v_trip_status text;
  v_hold_min    integer;
  v_price       integer;
  v_deposit     integer;
  v_operator    uuid;
  v_currency    text;
  v_client      text;
  v_stripe      text;
  v_taken       integer;
  v_remaining   integer;
  v_email_holds integer;
  v_now         timestamptz := now();
  v_expires     timestamptz;
  v_id          uuid;
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
           t.operator_id, t.currency, t.status, o.client_record_id, o.stripe_account_id
      into v_capacity, v_status, v_hold_min, v_price, v_deposit,
           v_operator, v_currency, v_trip_status, v_client, v_stripe
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
  -- Publish kill switch: an unpublished trip is not bookable, and we do not
  -- reveal that it exists.
  if v_trip_status <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'departure_closed');
  end if;

  -- Per-email brake on hold-spam. Counts this email's own live pending holds on
  -- this departure. A real traveller never approaches 6; a naive griefer using
  -- one address is stopped. Case-insensitive on the email.
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

  v_expires := v_now + make_interval(mins => v_hold_min);

  begin
    insert into public.gt_bookings (
      operator_id, departure_id, party_size, status, hold_expires_at, reference,
      total_pence, deposit_pence, currency, traveller_name, traveller_email,
      client_record_id, stripe_account_id
    ) values (
      v_operator, p_departure_id, p_party_size, 'pending', v_expires, p_reference,
      -- Computed in bigint so the multiply cannot overflow int4 mid-expression;
      -- price is bounded at save time so the stored value fits the int4 column.
      case when v_price is null then null else (v_price::bigint * p_party_size) end,
      -- Deposit scales by party the same way the total does, and is null when
      -- there is no price basis for it.
      case when v_deposit is null or v_price is null then null
           else least(v_deposit::bigint * p_party_size, v_price::bigint * p_party_size) end,
      coalesce(v_currency, 'gbp'), p_lead_name, p_lead_email,
      v_client, v_stripe
    )
    returning id into v_id;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'reason', 'reference_taken');
  end;

  insert into public.gt_travellers (booking_id, full_name, email, phone, is_lead)
  select v_id,
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

revoke all     on function public.gt_hold_places(uuid,integer,text,text,text,text,jsonb) from public;
grant  execute on function public.gt_hold_places(uuid,integer,text,text,text,text,jsonb) to service_role;
