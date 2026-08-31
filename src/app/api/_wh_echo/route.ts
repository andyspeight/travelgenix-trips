// TEMPORARY preview-only echo receiver — verifies live webhook delivery, then
// removed. Reflects the signature headers and raw body it received so the
// self-test can prove the signed payload survives transport. 404 anywhere but a
// *.vercel.app preview host so it can never respond in production.

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const host = req.headers.get('host') || '';
  if (!host.endsWith('.vercel.app')) return new Response('Not found', { status: 404 });

  const body = await req.text();
  return Response.json({
    sig: req.headers.get('x-tg-signature'),
    ts: req.headers.get('x-tg-timestamp'),
    event: req.headers.get('x-tg-event'),
    contentType: req.headers.get('content-type'),
    userAgent: req.headers.get('user-agent'),
    body,
  });
}
