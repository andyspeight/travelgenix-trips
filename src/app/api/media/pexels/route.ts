// GET /api/media/pexels?q=...&kind=image|video&page=1
// Thin, operator-gated proxy to the Pexels search API. The API key stays on the
// server. Returns normalised results the picker renders; importing is a
// separate, server-resolved step so the client never supplies a file URL.

import { requireOperator } from '@/lib/auth';
import { searchPexels, pexelsConfigured, type MediaKind } from '@/lib/pexels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const ctx = await requireOperator();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!pexelsConfigured()) {
    return Response.json({ error: 'pexels_unconfigured', message: 'Stock search is not switched on. Add a PEXELS_API_KEY.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').slice(0, 100);
  const kind: MediaKind = searchParams.get('kind') === 'video' ? 'video' : 'image';
  const page = Math.max(1, Math.min(50, Number.parseInt(searchParams.get('page') || '1', 10) || 1));

  try {
    const { results, hasMore } = await searchPexels(q, kind, page);
    return Response.json({ results, hasMore, page });
  } catch {
    return Response.json({ error: 'search_failed', message: 'Stock search is unavailable right now.' }, { status: 502 });
  }
}
