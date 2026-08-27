// =============================================================================
//  GET /api/health
// =============================================================================
//
//  Liveness, plus a truthful statement about what is actually wired.
//
//  It distinguishes the three states that all look identical from the outside
//  and have completely different fixes:
//
//    absent   the variable is not in the environment at all. Either it was
//             never saved, or the deployment predates it: Vercel snapshots
//             environment variables at deploy time, so editing one does NOT
//             affect a build that already exists. Redeploy.
//    empty    the name exists but the value is an empty string. Someone
//             created the key and never pasted the value.
//    present  a non-empty value arrived.
//
//  It NEVER reveals a value, a fragment of one, or a length. For the database
//  it goes one step further and actually talks to it, because a present key can
//  still be the wrong key: the anon key looks identical from here and fails
//  every query, silently, thanks to RLS.
//
// =============================================================================

export const dynamic = 'force-dynamic';

type VarState = 'absent' | 'empty' | 'present';

function state(name: string): VarState {
  const raw = process.env[name];
  if (raw === undefined) return 'absent';
  if (raw.trim() === '') return 'empty';
  return 'present';
}

/** Proves the credentials actually work, without revealing them. */
async function probeDatabase(): Promise<{ reachable: boolean; detail: string }> {
  const url = (process.env.TRIPS_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.TRIPS_SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return { reachable: false, detail: 'not configured' };

  // Shape check first: a common paste error is the dashboard URL rather than
  // the API URL, which is present, non-empty and completely wrong.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return { reachable: false, detail: 'TRIPS_SUPABASE_URL is not a https://<ref>.supabase.co address' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    // Count-only, zero rows returned. Cheapest possible authenticated read.
    const res = await fetch(`${url}/rest/v1/gt_operators?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
      cache: 'no-store',
    });

    if (res.ok) return { reachable: true, detail: 'ok' };
    if (res.status === 401 || res.status === 403) {
      return { reachable: false, detail: `rejected (${res.status}) — likely the anon key, not the service_role key` };
    }
    return { reachable: false, detail: `http ${res.status}` };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { reachable: false, detail: aborted ? 'timed out' : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const vars = {
    TRIPS_SUPABASE_URL: state('TRIPS_SUPABASE_URL'),
    TRIPS_SUPABASE_SERVICE_ROLE_KEY: state('TRIPS_SUPABASE_SERVICE_ROLE_KEY'),
    TG_WIDGETS_ORIGIN: state('TG_WIDGETS_ORIGIN'),
    STRIPE_SECRET_KEY: state('STRIPE_SECRET_KEY'),
    STRIPE_CONNECT_WEBHOOK_SECRET: state('STRIPE_CONNECT_WEBHOOK_SECRET'),
  };

  const database = await probeDatabase();

  // One shape of failure at a time. Five separate mistakes is never the
  // explanation; a single systemic cause always is.
  const states = Object.values(vars);
  const allAbsent = states.every((v) => v === 'absent');
  const allEmpty = states.every((v) => v === 'empty');

  const diagnosis = database.reachable
    ? 'Wired correctly.'
    : allAbsent
      ? 'Every variable is absent. Vercel snapshots environment variables at deploy time, so a deployment built before they were saved cannot see them. Redeploy from the Deployments tab.'
      : allEmpty
        ? 'Every variable exists but is empty. Vercel\'s import screen reads .env.example and pre-fills the NAMES along with its blank values, so deploying straight from import creates named variables with nothing in them. Redeploying cannot help: edit each value in Settings, then redeploy.'
        : 'Mixed. See vars for which are set and database.detail for why the connection fails.';

  return Response.json({
    ok: true,
    service: 'travelgenix-trips',
    phase: 1,
    // Vercel tells the running function which environment it is in. If this is
    // undefined, System Environment Variables are switched off for the project,
    // which is itself worth knowing.
    vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'unknown',
    vars,
    database,
    diagnosis,
  });
}
