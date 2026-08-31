// TEMPORARY preview-only self-test — verifies the authenticated v1 API on the
// real serverless runtime, then removed. Mints a key, exercises the endpoints
// with and without it, then cleans up the key and any created draft. 404 off
// vercel.app so it can never run on a custom production domain.

import { sbRequest } from '@/lib/supabase';
import { createApiKey } from '@/lib/repo';
import { mintApiKey } from '@/lib/apikeys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const host = req.headers.get('host') || '';
  if (!host.endsWith('.vercel.app')) return new Response('Not found', { status: 404 });

  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${host}`;

  // 401 without a key.
  const noKey = await fetch(`${origin}/api/v1/bookings`);

  // A real operator to act as, and a fresh key stored for it.
  const ops = await sbRequest<Array<{ id: string }>>('gt_operators?select=id&limit=1').catch(() => null);
  const operatorId = ops?.[0]?.id;
  if (!operatorId) return Response.json({ error: 'no operator to test with' });

  const key = mintApiKey();
  const saved = await createApiKey(operatorId, key, 'selftest');
  const auth = { authorization: `Bearer ${key}` };

  // Authenticated list.
  const listed = await fetch(`${origin}/api/v1/bookings`, { headers: auth });
  const listJson = await listed.json() as { count: number; data: Array<{ reference: string }> };

  // One booking, if the operator has any.
  let single: unknown = null;
  if (listJson.count > 0) {
    const ref = listJson.data[0]!.reference;
    const one = await fetch(`${origin}/api/v1/bookings/${encodeURIComponent(ref)}`, { headers: auth });
    const oneJson = await one.json() as { reference?: string };
    single = { status: one.status, matches: oneJson.reference === ref };
  }

  // Authenticated create — must land as a draft.
  const created = await fetch(`${origin}/api/v1/trips`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ title: `API selftest ${Date.now()}`, kind: 'group', currency: 'gbp', summary: 'temp' }),
  });
  const createdJson = await created.json() as { id?: string; slug?: string; status?: string };

  // Reject a bad body even with a good key.
  const badBody = await fetch(`${origin}/api/v1/trips`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'group' }),
  });

  // 401 on the write without a key.
  const postNoKey = await fetch(`${origin}/api/v1/trips`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });

  // Clean up everything this test created.
  if (createdJson.id) await sbRequest(`gt_trips?id=eq.${createdJson.id}`, { method: 'DELETE' }).catch(() => null);
  if (saved?.id) await sbRequest(`gt_api_keys?id=eq.${saved.id}`, { method: 'DELETE' }).catch(() => null);

  return Response.json({
    noKeyStatus: noKey.status,           // expect 401
    authedListStatus: listed.status,     // expect 200
    bookingCount: listJson.count,
    single,                              // { status: 200, matches: true } if any bookings
    createStatus: created.status,        // expect 201
    createdStatus: createdJson.status,   // expect "draft"
    createdSlug: createdJson.slug,
    badBodyStatus: badBody.status,       // expect 422
    postNoKeyStatus: postNoKey.status,   // expect 401
  });
}
