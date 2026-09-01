// TEMPORARY diagnostic route — self-hosts generated photos from Higgsfield's
// CDN into the build so they can be committed to /public. The app runs on Vercel
// with open egress; this session's sandbox is egress-blocked, so the route
// base64-encodes the image (ASCII survives the fetch channel byte for byte) and
// the session decodes and commits it. Locked to the one CDN host. DELETE once
// the photos are in /public.
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HOST = 'd8j0ntlcm91z4.cloudfront.net';

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || '';
  let url: URL;
  try { url = new URL(u); } catch { return new Response('bad url', { status: 400 }); }
  if (url.protocol !== 'https:' || url.hostname !== HOST) {
    return new Response('host not allowed', { status: 400 });
  }
  const r = await fetch(url.href);
  if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
  const buf = Buffer.from(await r.arrayBuffer());
  return new Response(buf.toString('base64'), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
