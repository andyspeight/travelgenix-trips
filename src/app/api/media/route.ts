// =============================================================================
//  /api/media — the operator's media library
// =============================================================================
//    GET    list the operator's media
//    POST   record an uploaded blob (the reliable path after a client upload)
//    DELETE remove one item, blob and index row
//  All operator-gated. The URL recorded must live on a trusted host.
// =============================================================================

import { del } from '@vercel/blob';
import { requireOperator, requireEditor } from '@/lib/auth';
import { listMedia, recordMedia, deleteMediaOwned } from '@/lib/repo';
import { safeMediaUrl, isVideoUrl } from '@/lib/url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const ctx = await requireOperator();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return Response.json({ media: await listMedia(ctx.operatorId) });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireEditor();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { url?: string; filename?: string; contentType?: string; size?: number }
    | null;

  const url = safeMediaUrl(body?.url);
  if (!url) return Response.json({ error: 'bad_url' }, { status: 400 });

  const kind = isVideoUrl(url) || (body?.contentType || '').startsWith('video') ? 'video' : 'image';
  const item = await recordMedia(ctx.operatorId, {
    url,
    kind,
    filename: body?.filename ?? null,
    content_type: body?.contentType ?? null,
    size_bytes: typeof body?.size === 'number' ? body.size : null,
  });
  if (!item) return Response.json({ error: 'record_failed' }, { status: 500 });
  return Response.json({ item });
}

export async function DELETE(request: Request): Promise<Response> {
  const ctx = await requireEditor();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return Response.json({ error: 'no_id' }, { status: 400 });

  // Drop the index row first (this is the ownership check); only then delete the
  // blob. A blob without a row is harmless; a row without a blob is not.
  const removed = await deleteMediaOwned(body.id, ctx.operatorId);
  if (!removed) return Response.json({ error: 'not_found' }, { status: 404 });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await del(removed.url).catch(() => { /* best effort */ });
  }
  return Response.json({ ok: true });
}
