// The hold caller is the correctness-critical glue: it must never double-insert
// on an ambiguous failure, must retry the right things and give up on the
// wrong ones. Tested with a scripted RPC transport, no database.

import test from 'node:test';
import assert from 'node:assert/strict';
import { holdPlaces, holdMessage, type HoldDeps, type RpcResult, type HeldBooking } from '../src/lib/hold.ts';

const REQ = {
  departure_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  party_size: 2,
  lead_name: 'Priya Chauhan',
  lead_email: 'priya@example.com',
  lead_phone: null,
  travellers: [{ full_name: 'Priya Chauhan', email: 'priya@example.com', phone: null, is_lead: true }],
};

// Build deps from a queue of scripted RPC results (or a function of the call).
function deps(script: Array<RpcResult | Error> | ((call: { p_reference: string }, i: number) => RpcResult | Error), opts: {
  probe?: (ref: string) => HeldBooking | null;
} = {}): { deps: HoldDeps; refs: string[]; sleeps: number[]; calls: number } {
  const refs: string[] = [];
  const sleeps: number[] = [];
  let i = 0;
  let refCounter = 0;
  const state = { calls: 0 };

  const d: HoldDeps = {
    callRpc: async (args) => {
      state.calls++;
      const step = Array.isArray(script) ? script[i] : script(args, i);
      i++;
      if (step instanceof Error) throw step;
      return step!;
    },
    probeByReference: async (ref) => {
      if (opts.probe) return opts.probe(ref); // may throw to simulate an 'unknown' probe
      return null;
    },
    mintReference: () => { refCounter++; const r = `TGT-REF${refCounter}-0000`; refs.push(r); return r; },
    sleep: async (ms) => { sleeps.push(ms); },
    jitter: () => 0.5,
  };
  return { deps: d, refs, sleeps, get calls() { return state.calls; } } as never;
}

test('a clean hold returns the booking', async () => {
  const { deps: d } = deps([{ ok: true, id: 'bk-1', reference: 'TGT-REF1-0000', hold_expires_at: '2027-01-01T00:00:00Z', remaining: 5 }]);
  const out = await holdPlaces(d, REQ);
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.booking.id, 'bk-1');
    assert.equal(out.booking.remaining, 5);
  }
});

test('sold_out is terminal, no retry', async () => {
  const h = deps([{ ok: false, reason: 'sold_out' }]);
  const out = await holdPlaces(h.deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'sold_out' });
  assert.equal(h.calls, 1);
});

test('insufficient_capacity carries the remaining count', async () => {
  const out = await holdPlaces(deps([{ ok: false, reason: 'insufficient_capacity', remaining: 3 }]).deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'insufficient_capacity', remaining: 3 });
});

test('busy retries with backoff, then gives up as busy', async () => {
  const h = deps([
    { ok: false, reason: 'busy' },
    { ok: false, reason: 'busy' },
    { ok: false, reason: 'busy' },
    { ok: false, reason: 'busy' }, // 4th busy exceeds the 3 retries
  ]);
  const out = await holdPlaces(h.deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'busy' });
  assert.equal(h.sleeps.length, 3, 'backed off before each of 3 retries');
  assert.ok(h.sleeps[1]! > h.sleeps[0]!, 'backoff grows');
});

test('busy that then succeeds returns the booking', async () => {
  const h = deps([
    { ok: false, reason: 'busy' },
    { ok: true, id: 'bk-2', reference: 'x', remaining: 1 },
  ]);
  const out = await holdPlaces(h.deps, REQ);
  assert.equal(out.ok, true);
  assert.equal(h.sleeps.length, 1);
});

test('reference_taken mints a FRESH reference and retries', async () => {
  const seen: string[] = [];
  const d: HoldDeps = {
    callRpc: async (a) => { seen.push(a.p_reference); return seen.length < 3 ? { ok: false, reason: 'reference_taken' } : { ok: true, id: 'bk-3' }; },
    probeByReference: async () => null,
    mintReference: (() => { let n = 0; return () => `TGT-R${++n}-0000`; })(),
    sleep: async () => {},
    jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.equal(out.ok, true);
  assert.equal(seen.length, 3);
  assert.equal(new Set(seen).size, 3, 'each attempt used a different reference');
});

test('reference_taken forever gives up as error, bounded', async () => {
  const h = deps(Array.from({ length: 8 }, () => ({ ok: false, reason: 'reference_taken' as const })));
  const out = await holdPlaces(h.deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'error' });
  assert.ok(h.calls <= 7, `bounded, got ${h.calls} calls`);
});

test('AMBIGUOUS failure: probe finds the row, treat as success, no double-insert', async () => {
  let calls = 0;
  const committed: HeldBooking = { id: 'bk-committed', reference: 'TGT-R1-0000', holdExpiresAt: null, remaining: 4 };
  const d: HoldDeps = {
    // First call throws AFTER (as far as we know) maybe committing.
    callRpc: async () => { calls++; throw new Error('socket hang up'); },
    probeByReference: async () => committed, // the row is there
    mintReference: () => 'TGT-R1-0000',
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.booking.id, 'bk-committed');
  assert.equal(calls, 1, 'did NOT call the RPC again after finding the committed row');
});

test('AMBIGUOUS failure: probe finds nothing, retry the SAME reference once', async () => {
  const seen: string[] = [];
  let calls = 0;
  const d: HoldDeps = {
    callRpc: async (a) => {
      seen.push(a.p_reference); calls++;
      if (calls === 1) throw new Error('timeout');
      return { ok: true, id: 'bk-4' };
    },
    probeByReference: async () => null, // nothing committed, safe to retry
    mintReference: () => 'TGT-SAME-0000',
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.equal(out.ok, true);
  assert.equal(seen[0], seen[1], 'retried with the SAME reference, not a new one');
});

test('AMBIGUOUS failure twice with nothing committed gives up as error', async () => {
  const d: HoldDeps = {
    callRpc: async () => { throw new Error('down'); },
    probeByReference: async () => null,
    mintReference: () => 'TGT-R-0000',
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.deepEqual(out, { ok: false, reason: 'error' });
});

test('an unknown reason is not retried', async () => {
  const h = deps([{ ok: false, reason: 'some_future_reason' }]);
  const out = await holdPlaces(h.deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'error' });
  assert.equal(h.calls, 1);
});

test('reference_taken whose row is OUR OWN (ambiguous retry committed) returns it, no new booking', async () => {
  // The exact interleaving the review found: first call commits then loses its
  // response; probe cannot see it (returns null once); retry hits the unique
  // index -> reference_taken; the row IS ours and must be returned, not re-minted.
  const committed: HeldBooking = { id: 'bk-B1', reference: 'TGT-SAME-0000', holdExpiresAt: null, remaining: 2 };
  let probeCalls = 0;
  let calls = 0;
  const d: HoldDeps = {
    callRpc: async () => {
      calls++;
      if (calls === 1) throw new Error('response lost after commit');
      return { ok: false, reason: 'reference_taken' }; // retry hits our own committed row
    },
    probeByReference: async () => {
      probeCalls++;
      // First probe (ambiguous path) misses; second probe (reference_taken path) finds it.
      return probeCalls >= 2 ? committed : null;
    },
    mintReference: (() => { let n = 0; return () => (n++ === 0 ? 'TGT-SAME-0000' : 'TGT-NEW-0000'); })(),
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.equal(out.ok, true, 'the committed booking is returned');
  if (out.ok) assert.equal(out.booking.id, 'bk-B1', 'the ORIGINAL booking, not a duplicate');
});

test('reference_taken with an UNKNOWN probe (probe throws) does NOT mint-and-reinsert', async () => {
  let calls = 0;
  const d: HoldDeps = {
    callRpc: async () => { calls++; return { ok: false, reason: 'reference_taken' }; },
    probeByReference: async () => { throw new Error('probe failed'); },
    mintReference: () => 'TGT-R-0000',
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.deepEqual(out, { ok: false, reason: 'error' }, 'gives up rather than risk a double-insert');
  assert.equal(calls, 1, 'did not re-insert with a fresh reference');
});

test('ambiguous failure with an UNKNOWN probe does NOT retry the RPC', async () => {
  let calls = 0;
  const d: HoldDeps = {
    callRpc: async () => { calls++; throw new Error('down'); },
    probeByReference: async () => { throw new Error('also down'); },
    mintReference: () => 'TGT-R-0000',
    sleep: async () => {}, jitter: () => 0,
  };
  const out = await holdPlaces(d, REQ);
  assert.deepEqual(out, { ok: false, reason: 'error' });
  assert.equal(calls, 1, 'never retried the insert when the outcome could not be confirmed');
});

test('every reason has a human message', () => {
  for (const r of ['sold_out', 'insufficient_capacity', 'departure_closed', 'not_found', 'invalid', 'busy', 'too_many_holds', 'package_full', 'error'] as const) {
    const m = holdMessage(r, 2);
    assert.ok(m.length > 10 && !m.includes('undefined'), r);
  }
});

test('package_full is terminal, no retry', async () => {
  const h = deps([{ ok: false, reason: 'package_full' }]);
  const out = await holdPlaces(h.deps, REQ);
  assert.deepEqual(out, { ok: false, reason: 'package_full' });
  assert.equal(h.calls, 1);
});

test('package, promo and add-ons are passed through to the RPC', async () => {
  let seen: Record<string, unknown> | null = null;
  const d: HoldDeps = {
    callRpc: async (args) => { seen = args; return { ok: true, id: 'bk-9', reference: args.p_reference }; },
    probeByReference: async () => null,
    mintReference: () => 'TGT-REF1-0000',
    sleep: async () => {},
    jitter: () => 0.5,
  };
  const out = await holdPlaces(d, {
    ...REQ,
    package_id: '3d9923ed-5a68-4da7-a0a7-fc1f5d131669',
    promo_code: 'EARLYBIRD',
    option_ids: ['11111111-1111-4111-8111-111111111111'],
  });
  assert.equal(out.ok, true);
  assert.equal(seen!.p_package_id, '3d9923ed-5a68-4da7-a0a7-fc1f5d131669');
  assert.equal(seen!.p_promo_code, 'EARLYBIRD');
  assert.deepEqual(seen!.p_option_ids, ['11111111-1111-4111-8111-111111111111']);
});

test('absent package, promo and add-ons become null / empty at the RPC boundary', async () => {
  let seen: Record<string, unknown> | null = null;
  const d: HoldDeps = {
    callRpc: async (args) => { seen = args; return { ok: true, id: 'bk-10', reference: args.p_reference }; },
    probeByReference: async () => null,
    mintReference: () => 'TGT-REF1-0000',
    sleep: async () => {},
    jitter: () => 0.5,
  };
  await holdPlaces(d, REQ);
  assert.equal(seen!.p_package_id, null);
  assert.equal(seen!.p_promo_code, null);
  assert.deepEqual(seen!.p_option_ids, []);
});
