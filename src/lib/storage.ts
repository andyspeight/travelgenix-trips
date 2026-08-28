// =============================================================================
//  lib/storage.ts — the private document store
// =============================================================================
//
//  Server-only access to Supabase Storage, for traveller documents that must
//  never be public (passport, ID, insurance). The browser never touches the
//  bucket: a file is uploaded THROUGH a serverless route with the service role,
//  and read back only through a short-lived signed URL minted here behind an
//  ownership check. There is no durable public link to any document.
//
//  Deliberately the same "raw fetch, service key, no client dependency" shape as
//  lib/supabase.ts. The bucket (private, size- and mime-capped) is provisioned
//  by gt_015.
//
//    Env: TRIPS_SUPABASE_URL, TRIPS_SUPABASE_SERVICE_ROLE_KEY (shared with the DB)
//
// =============================================================================

import 'server-only';

const SUPABASE_URL = (process.env.TRIPS_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.TRIPS_SUPABASE_SERVICE_ROLE_KEY || '';

export const DOCS_BUCKET = 'traveller-docs';

/** 5 MB, matching the bucket's own file_size_limit. Enforced here too so an
 *  oversized upload is refused before it ever reaches storage. */
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Mime types the bucket accepts. Kept in step with gt_015's allowed_mime_types
 *  so the app's answer and storage's answer never disagree. */
export const ALLOWED_DOC_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
]);

export function storageConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

export class StorageError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'StorageError';
    this.statusCode = statusCode;
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...(extra || {}),
  };
}

/** Object paths are built by the app, but a defensive clamp keeps them boring:
 *  no traversal, no leading slash, a bounded set of characters. */
export function safeObjectSegment(input: string): string {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'file';
}

/**
 * Upload bytes to the private bucket, replacing anything already at the path.
 * Returns nothing on success, throws StorageError otherwise.
 */
export async function uploadDocument(path: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
  if (!storageConfigured()) throw new StorageError('Storage not configured', 500);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOCS_BUCKET}/${path}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': '3600' }),
      body: bytes,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new StorageError(`Storage upload ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mint a signed URL to read one object, valid for `expiresIn` seconds. Short by
 * default: a link an operator opens now, not one that could be shared or leak.
 */
export async function signedDocumentUrl(path: string, expiresIn = 90): Promise<string | null> {
  if (!storageConfigured()) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${DOCS_BUCKET}/${path}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { signedURL?: string };
    if (!body.signedURL) return null;
    // signedURL is a path beginning with /object/sign/...; make it absolute.
    return `${SUPABASE_URL}/storage/v1${body.signedURL}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Remove one object. Best-effort: a failure to delete the file must not block
 *  removing its database row, and an orphan object in a private bucket is inert. */
export async function deleteDocument(path: string): Promise<void> {
  if (!storageConfigured()) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${DOCS_BUCKET}/${path}`, {
      method: 'DELETE',
      headers: headers(),
      signal: ctrl.signal,
    });
  } catch {
    // swallowed on purpose
  } finally {
    clearTimeout(timer);
  }
}
