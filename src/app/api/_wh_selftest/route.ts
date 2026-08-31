// TEMPORARY preview-only self-test — proves the whole webhook contract on the
// real serverless runtime: node:crypto signs, the signed headers and body
// survive an HTTP POST, and a receiver recomputing the signature over the
// received timestamp+body matches. Removed after verification. 404 off preview.

import { signBody, buildBookingEvent, SIGNATURE_HEADER, TIMESTAMP_HEADER, EVENT_HEADER } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const host = req.headers.get('host') || '';
  if (!host.endsWith('.vercel.app')) return new Response('Not found', { status: 404 });

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;
  const secret = 'whsec_selftest_0123456789abcdef';

  const envelope = buildBookingEvent('booking.created', {
    reference: 'TGT-TEST-0000', status: 'deposit_paid', trip: 'Sample trip', operator: 'Test operator',
    party_size: 2, currency: 'gbp', total_pence: 100000, deposit_pence: 20000,
    starts_on: null, ends_on: null, lead_name: 'Test traveller', lead_email: 'test@example.com',
    package: null, promo: null,
  });
  const body = JSON.stringify(envelope);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = signBody(secret, ts, body);

  const res = await fetch(`${origin}/api/_wh_echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [EVENT_HEADER]: 'booking.created', [TIMESTAMP_HEADER]: ts, [SIGNATURE_HEADER]: sig },
    body,
  });
  const echoed = await res.json() as { sig: string; ts: string; body: string; event: string };
  const recomputed = signBody(secret, echoed.ts, echoed.body);

  return Response.json({
    echoStatus: res.status,
    transportIntact: echoed.sig === sig,          // signature header survived
    bodyIntact: echoed.body === body,             // body survived byte-for-byte
    signatureVerifies: recomputed === echoed.sig, // a receiver can independently verify
    eventType: echoed.body ? JSON.parse(echoed.body).type : null,
    collectedPence: echoed.body ? JSON.parse(echoed.body).data.collected_pence : null,
    outstandingPence: echoed.body ? JSON.parse(echoed.body).data.outstanding_pence : null,
  });
}
