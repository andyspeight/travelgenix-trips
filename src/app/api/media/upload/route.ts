// =============================================================================
//  POST /api/media/upload — issue a client upload token for Vercel Blob
// =============================================================================
//  The browser uploads the file DIRECTLY to Blob (so a large video never goes
//  through our 4.5MB serverless body limit). This route only authorises the
//  upload and constrains it: the operator must be resolved from the session,
//  and only images and video within a size cap are allowed.
//
//  The definitive DB record is written by the client posting to /api/media
//  after the upload resolves (onUploadCompleted is unreliable behind Vercel
//  deployment protection), but we also record here best-effort. The
//  gt_media unique(operator_id,url) index makes the double write idempotent.
// =============================================================================

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireOperator } from '@/lib/auth';
import { recordMedia } from '@/lib/repo';

export const runtime = 'nodejs';

const ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
];
const MAX_BYTES = 200 * 1024 * 1024; // 200MB, generous for a short trip video

export async function POST(request: Request): Promise<Response> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'media_storage_unconfigured', message: 'Connect a Vercel Blob store to enable uploads.' },
      { status: 503 },
    );
  }

  const ctx = await requireOperator();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ operatorId: ctx.operatorId }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const { operatorId } = JSON.parse(tokenPayload || '{}');
          if (operatorId) {
            const kind = (blob.contentType || '').startsWith('video') ? 'video' : 'image';
            await recordMedia(operatorId, { url: blob.url, kind, content_type: blob.contentType });
          }
        } catch {
          // The client's own POST to /api/media is the reliable record path.
        }
      },
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload failed';
    return Response.json({ error: 'upload_failed', message }, { status: 400 });
  }
}
