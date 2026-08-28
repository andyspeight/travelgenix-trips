// =============================================================================
//  POST /api/register/document — a traveller uploads a document
// =============================================================================
//  Public, exactly like /register: the caller holds only a booking reference,
//  which is the bearer token. The file goes THROUGH this route (it never gets a
//  direct handle on the private bucket), is checked against the same size and
//  mime limits the bucket enforces, and is recorded against the booking, the
//  field and — for a per-traveller field — the traveller it belongs to. A forged
//  reference or a field that is not a document field can attach nothing, because
//  getDocumentTarget refuses it.
// =============================================================================

import { getDocumentTarget, recordDocument } from '@/lib/repo';
import { normaliseReference } from '@/lib/booking';
import {
  uploadDocument, safeObjectSegment, storageConfigured,
  MAX_DOC_BYTES, ALLOWED_DOC_TYPES, DOCS_BUCKET,
} from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  if (!storageConfigured()) {
    return Response.json({ error: 'storage_unconfigured' }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: 'bad_request' }, { status: 400 });

  const file = form.get('file');
  const reference = normaliseReference(String(form.get('reference') ?? ''));
  const fieldKey = String(form.get('field_key') ?? '');
  const travellerRaw = String(form.get('traveller_id') ?? '');
  const travellerId = /^[0-9a-f-]{36}$/i.test(travellerRaw) ? travellerRaw : null;

  if (!reference) return Response.json({ error: 'bad_reference' }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });

  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED_DOC_TYPES.has(contentType)) {
    return Response.json({ error: 'bad_type', message: 'Please upload a photo or a PDF.' }, { status: 415 });
  }
  if (file.size <= 0 || file.size > MAX_DOC_BYTES) {
    return Response.json({ error: 'too_large', message: 'That file is over the 5 MB limit.' }, { status: 413 });
  }

  // Authorise BEFORE touching storage: reference is live, field is a real
  // document field, traveller (if per-traveller) belongs to the booking.
  const target = await getDocumentTarget(reference, fieldKey, travellerId);
  if (!target) return Response.json({ error: 'not_allowed' }, { status: 403 });

  const ext = (file.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '').toLowerCase();
  const base = safeObjectSegment(file.name.replace(/\.[^.]*$/, '') || 'document');
  const who = target.travellerId ?? 'booking';
  const unique = globalThis.crypto.randomUUID();
  const path = `${target.operatorId}/${target.bookingId}/${who}/${target.fieldKey}/${unique}-${base}${ext}`;

  try {
    const bytes = await file.arrayBuffer();
    await uploadDocument(path, bytes, contentType);
  } catch {
    return Response.json({ error: 'upload_failed', message: 'The upload did not complete. Please try again.' }, { status: 502 });
  }

  const doc = await recordDocument({
    target,
    filePath: path,
    fileName: safeObjectSegment(file.name) || 'document',
    contentType,
    sizeBytes: file.size,
  });
  if (!doc) return Response.json({ error: 'record_failed' }, { status: 500 });

  return Response.json({
    ok: true,
    document: { id: doc.id, field_key: doc.field_key, traveller_id: doc.traveller_id, file_name: doc.file_name },
    bucket: DOCS_BUCKET,
  });
}
