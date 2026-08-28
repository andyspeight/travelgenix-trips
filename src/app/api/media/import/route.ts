// POST /api/media/import  { id, kind }
// Imports a chosen Pexels asset INTO the operator's own Blob library, so we own
// the file, serve it from our CDN, and it appears alongside their uploads. The
// server resolves the canonical file URL and credit from the id (the client
// never supplies a URL), streams it into Blob, and records it.

import { put } from '@vercel/blob';
import { requireEditor } from '@/lib/auth';
import { recordMedia } from '@/lib/repo';
import { resolvePexelsImport, isPexelsFileUrl, pexelsConfigured, type MediaKind } from '@/lib/pexels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a video stream can take a moment

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireEditor();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: 'media_storage_unconfigured' }, { status: 503 });
  }
  if (!pexelsConfigured()) {
    return Response.json({ error: 'pexels_unconfigured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string; kind?: string } | null;
  const id = String(body?.id ?? '');
  const kind: MediaKind = body?.kind === 'video' ? 'video' : 'image';

  const item = await resolvePexelsImport(id, kind).catch(() => null);
  if (!item) return Response.json({ error: 'not_found' }, { status: 404 });

  // Defence in depth: only ever stream a Pexels-hosted file.
  if (!isPexelsFileUrl(item.url)) return Response.json({ error: 'bad_source' }, { status: 400 });

  try {
    const res = await fetch(item.url, { cache: 'no-store' });
    if (!res.ok || !res.body) return Response.json({ error: 'fetch_failed' }, { status: 502 });

    const blob = await put(item.filename, res.body, {
      access: 'public',
      addRandomSuffix: true,
      contentType: item.contentType,
    });

    const size = Number.parseInt(res.headers.get('content-length') || '', 10);
    const media = await recordMedia(ctx.operatorId, {
      url: blob.url,
      kind: item.kind,
      filename: item.filename,
      content_type: item.contentType,
      size_bytes: Number.isFinite(size) ? size : null,
      source: 'pexels',
      credit: item.credit,
      credit_url: item.creditUrl,
    });
    if (!media) return Response.json({ error: 'record_failed' }, { status: 500 });
    return Response.json({ item: media });
  } catch {
    return Response.json({ error: 'import_failed' }, { status: 502 });
  }
}
