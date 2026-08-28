// =============================================================================
//  GET /api/console/document/[id] — operator views one document
// =============================================================================
//  Operator-gated. Resolves the operator from the session, checks the document
//  belongs to them, then mints a short-lived signed URL and redirects to it. The
//  operator's browser follows the redirect and fetches the file straight from
//  storage; the link it lands on expires in seconds and is never stored, so it
//  cannot be shared or leak. A guessed id belonging to another operator returns
//  404, never the file.
// =============================================================================

import { requireOperator } from '@/lib/auth';
import { getDocumentForOperator } from '@/lib/repo';
import { signedDocumentUrl, storageConfigured } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!storageConfigured()) return Response.json({ error: 'storage_unconfigured' }, { status: 503 });

  const ctx = await requireOperator();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const doc = await getDocumentForOperator(id, ctx.operatorId);
  if (!doc) return Response.json({ error: 'not_found' }, { status: 404 });

  const url = await signedDocumentUrl(doc.file_path, 90);
  if (!url) return Response.json({ error: 'unavailable' }, { status: 502 });

  // 302, not a cached redirect: each view mints a fresh short-lived URL.
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  });
}
