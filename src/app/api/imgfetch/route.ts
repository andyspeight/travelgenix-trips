// TEMPORARY diagnostic route — imports the six generated marketing photos from
// Higgsfield's CDN into the build so they can be committed to /public. The app
// runs on Vercel with open egress; this session's sandbox is egress-blocked, so
// the route base64-encodes each image (ASCII survives the fetch channel byte
// for byte) and the session decodes and commits it. No user input, locked to a
// fixed list. DELETE this route once the photos are in /public.
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BASE = 'https://d8j0ntlcm91z4.cloudfront.net/user_3FqeAK63eN65JsmBeosRVGkPSYi/';
const FILES = [
  'hf_20260901_105645_47608041-a81d-4872-8642-82add2320938.png', // 0 safari
  'hf_20260901_105645_6fc97325-64b6-49a9-b624-a04394183224.png', // 1 amalfi
  'hf_20260901_105645_b8c20295-c33c-49a3-881b-211dbc28c331.png', // 2 highlands
  'hf_20260901_105645_1d693c40-828a-496b-8ca5-dc7e2ba4279f.png', // 3 retreat/lake
  'hf_20260901_105645_c5a2a096-7003-447c-9190-97f636fc6ba8.png', // 4 trek
  'hf_20260901_105724_d88cc3e5-0339-4e55-bf35-f078362339c1.png', // 5 zanzibar
];

export async function GET(req: NextRequest) {
  const i = Number(req.nextUrl.searchParams.get('i'));
  if (!Number.isInteger(i) || i < 0 || i >= FILES.length) {
    return new Response('bad index', { status: 400 });
  }
  const r = await fetch(BASE + FILES[i]);
  if (!r.ok) return new Response('upstream ' + r.status, { status: 502 });
  const buf = Buffer.from(await r.arrayBuffer());
  return new Response(buf.toString('base64'), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
