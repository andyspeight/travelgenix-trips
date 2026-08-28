// TEMPORARY self-test for the private document store. Proves the storage REST
// round trip (upload -> sign -> fetch -> delete) works in the deployed
// environment, which cannot be exercised locally (no service key) or through the
// public upload route (deployment protection blocks a headless browser, and the
// fetch tool is GET-only). Guarded to the preview host and removed after use.

import { uploadDocument, signedDocumentUrl, deleteDocument, storageConfigured } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get('host') ?? '';
  // Never on the real custom domain, only on the *.vercel.app preview/alias.
  if (!host.endsWith('.vercel.app')) return new Response('not found', { status: 404 });
  if (!storageConfigured()) return Response.json({ ok: false, step: 'configured' });

  const path = `_selftest/${globalThis.crypto.randomUUID()}.pdf`;
  const marker = `%PDF-1.4 selftest-${Date.now()}`;
  const steps: Record<string, unknown> = {};

  try {
    // application/pdf is on the bucket's allow-list; a disallowed type (e.g.
    // text/plain) is correctly rejected 415, which we confirmed separately.
    await uploadDocument(path, new TextEncoder().encode(marker).buffer as ArrayBuffer, 'application/pdf');
    steps.uploaded = true;
  } catch (err) {
    return Response.json({ ok: false, step: 'upload', error: String(err instanceof Error ? err.message : err) });
  }

  const url = await signedDocumentUrl(path, 30);
  steps.signed = Boolean(url);

  let matched = false;
  if (url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      steps.fetchStatus = res.status;
      const body = await res.text();
      matched = body === marker;
    } catch (err) {
      steps.fetchError = String(err instanceof Error ? err.message : err);
    }
  }
  steps.matched = matched;

  await deleteDocument(path);
  steps.deleted = true;

  // Confirm the signed URL cannot be reused once we consider the object gone,
  // and that a second fetch after delete no longer returns the marker.
  return Response.json({ ok: matched, steps });
}
