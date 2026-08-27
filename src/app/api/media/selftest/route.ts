// TEMPORARY diagnostic. Does a server-side write to Vercel Blob and reports the
// result, so we can tell a bad token/store (server put fails) from a browser
// upload problem (server put works, client hangs). GET so it can be fetched
// past Vercel Authentication. Remove once media uploads are confirmed working.

import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!hasToken) return Response.json({ hasToken, ok: false, detail: 'BLOB_READ_WRITE_TOKEN absent' });

  try {
    const blob = await put('trips-selftest.txt', `ok ${Date.now()}`, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'text/plain',
    });
    return Response.json({ hasToken, ok: true, url: blob.url });
  } catch (err) {
    return Response.json({
      hasToken,
      ok: false,
      detail: err instanceof Error ? `${err.name}: ${err.message}` : 'put failed',
    });
  }
}
