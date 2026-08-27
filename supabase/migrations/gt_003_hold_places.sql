-- =============================================================================
--  gt_003_hold_places.sql · atomic "hold N places on a departure"
-- =============================================================================
--
--  One transaction, one POST /rpc round trip. Serialises on the real
--  gt_departures row under READ COMMITTED, then counts taken places in a
--  SEPARATE statement (so the count's snapshot postdates a prior holder's
--  commit and sees their hold), then inserts. This is the design a four-way
--  panel converged on; the concurrency argument is in the comments inline.
--
--  Corrected against the LIVE schema before applying. gt_001 (not in the repo)
--  left five columns NOT NULL with no default that a platform hold does not
--  populate: widget_id, client_record_id, stripe_account_id, total_pence and
--  deposit_pence. The last two collide directly with the "a null price means
--  unpriced, never zero" rule. A departure-linked booking is not a widget
--  booking, and its pricing is nullable exactly like gt_departures, so those
--  constraints are dropped here. Guarded, so re-running is a no-op.
--
--  Safe to re-run.
-- =============================================================================

-- (0) Prerequisite: relax the widget-era NOT NULLs that do not apply to a
--     platform booking. Each guarded so it only fires once.
do $$
declare
  col text;
begin
  foreach col in array array[
    'widget_id', 'client_record_id', 'stripe_account_id', 'total_pence', 'deposit_pence'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'gt_bookings'
        and column_name = col and is_nullable = 'NO'
    ) then
      execute format('alter table public.gt_bookings alter column %I drop not null', col);
    end if;
  end loop;
end $$;

create or replace function public.gt_hold_places(
  p_departure_id uuid,
  p_party_size   integer,
  p_reference    text,          -- caller-minted via booking.ts newReference() (TGT-XXXX-XXXX)
  p_lead_name    text,
  p_lead_email   text,
  p_lead_phone   text   default null,
  p_travellers   jsonb  default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker                         -- sole caller is service_role, which already
                                         -- BYPASSRLS; DEFINER would add a run-as-owner
                                         -- surface for zero benefit.
set search_path = pg_catalog, public      -- table names cannot be hijacked
as $$
declare
  v_capacity  integer;
  v_status    text;
  v_hold_min  integer;
  v_price     integer;
  v_deposit   integer;
  v_operator  uuid;
  v_currency  text;
  v_client    text;
  v_stripe    text;
  v_taken     integer;
  v_remaining integer;
  v_now       timestamptz := now();       -- one instant, reused for count boundary and expiry
  v_expires   timestamptz;
  v_id        uuid;
begin
  -- (0) TRIPWIRE. Correctness holds ONLY under READ COMMITTED: the count is a
  --     separate statement after the lock, so its snapshot must postdate the
  --     prior holder's commit. REPEATABLE READ / SERIALIZABLE pin one snapshot
  --     at the FOR UPDATE and the fresh count silently misses the concurrent
  --     insert -> oversell. Fail loud rather than oversell quietly.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'gt_hold_places requires READ COMMITTED (got %)',
      current_setting('transaction_isolation') using errcode = 'assert_failure';
  end if;

  -- Bound the worst case so a slow holder cannot pile pooled connections behind
  -- it. lock_timeout (3s) fires before statement_timeout (4s) and before the
  -- client's 4000ms AbortController.
  set local lock_timeout = '3s';
  set local statement_timeout = '4s';

  if p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_reference is null or p_reference = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- (1) THE GATE. Lock ONLY the one departure row (for update of d). Everything
  --     that decides the outcome comes from the departure and the owning trip
  --     and operator, DERIVED here, never trusted from the caller. A concurrent
  --     hold on the SAME departure blocks here; different departures never
  --     contend. A raw gt_bookings insert that bypasses this RPC still takes FOR
  --     KEY SHARE on this row via its FK, which conflicts with our FOR UPDATE,
  --     so an in-flight hold at least blocks it.
  begin
    select d.capacity, d.status, d.hold_minutes, d.price_pence, d.deposit_pence,
           t.operator_id, t.currency, o.client_record_id, o.stripe_account_id
      into v_capacity, v_status, v_hold_min, v_price, v_deposit,
           v_operator, v_currency, v_client, v_stripe
    from public.gt_departures d
    join public.gt_trips t     on t.id = d.trip_id
    join public.gt_operators o on o.id = t.operator_id
    where d.id = p_departure_id
    for update of d;
  exception
    when lock_not_available then
      -- Gate jammed past lock_timeout. Push the queue to client-side retry
      -- rather than surfacing a raw 55P03 as a 500.
      return jsonb_build_object('ok', false, 'reason', 'busy');
  end;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'departure_closed');
  end if;

  -- (2) FRESH COUNT. A NEW statement, so under READ COMMITTED it snapshots AFTER
  --     the lock was granted -> after any prior holder committed -> their pending
  --     row IS visible. Predicate mirrors capacity.ts computeSpotsTaken EXACTLY:
  --     deposit_paid/paid always; pending only while hold_expires_at IS NULL
  --     (fresh) or > now(); party_size > 0 mirrors the size<=0 skip. cancelled
  --     and expired never match, so never count.
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

  -- capacity 0 ("not configured") yields remaining 0 -> sold_out. Deliberately
  -- STRICTER than the summarise() display; the hold never oversells.
  if v_remaining <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'sold_out',
      'capacity', v_capacity, 'taken', v_taken, 'remaining', 0);
  end if;
  if v_remaining < p_party_size then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_capacity',
      'capacity', v_capacity, 'taken', v_taken, 'remaining', v_remaining);
  end if;

  -- (3) TAKE THE PLACES. Money derived server-side in integer pence; a NULL
  --     departure price stays NULL ("unpriced"), never coerced to 0 (the columns
  --     are now nullable, see the prerequisite). client_record_id and
  --     stripe_account_id are carried from the operator for continuity with the
  --     widget-era rows, and are simply NULL when the operator has neither.
  v_expires := v_now + make_interval(mins => v_hold_min);

  begin
    insert into public.gt_bookings (
      operator_id, departure_id, party_size, status, hold_expires_at, reference,
      total_pence, deposit_pence, currency, traveller_name, traveller_email,
      client_record_id, stripe_account_id
    ) values (
      v_operator, p_departure_id, p_party_size, 'pending', v_expires, p_reference,
      case when v_price is null then null else v_price * p_party_size end,
      v_deposit, coalesce(v_currency, 'gbp'), p_lead_name, p_lead_email,
      v_client, v_stripe
    )
    returning id into v_id;
  exception
    when unique_violation then
      -- The gt_bookings_reference_key partial index collided (rare). Nothing was
      -- oversold: no row exists. Signal so the caller mints a fresh reference and
      -- retries, keeping the tested booking.ts format authoritative.
      return jsonb_build_object('ok', false, 'reason', 'reference_taken');
  end;

  -- The party, same transaction: a half-held booking can never exist. Does not
  -- affect capacity (counted in party_size, authoritative over array length). A
  -- malformed party (two is_lead) trips gt_travellers_one_lead and rolls the
  -- WHOLE hold back atomically.
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

-- Only the service role may call it. Functions are EXECUTE-able by PUBLIC by
-- default; revoke that AND grant explicitly (service_role is not a superuser, so
-- revoking without granting would lock out the only caller).
revoke all     on function public.gt_hold_places(uuid,integer,text,text,text,text,jsonb) from public;
grant  execute on function public.gt_hold_places(uuid,integer,text,text,text,text,jsonb) to service_role;
