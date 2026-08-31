// =============================================================================
//  POST /api/import — draft a trip from a pasted brochure
// =============================================================================
//  Operator-gated (editor). The operator pastes a brochure or itinerary; the
//  model extracts it into a trip, and we create a DRAFT (never published, always
//  editable) for the operator to review. Nothing is auto-published, and every
//  field is run back through sanitiseTripContent / validateTrip in draftFromImport
//  before it touches the database.
//
//  A SEAM like Stripe and email: it needs ANTHROPIC_API_KEY. Without it the route
//  says so plainly rather than failing obscurely.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { requireEditor } from '@/lib/auth';
import { createTrip, updateTripContent } from '@/lib/repo';
import { tripsDbConfigured } from '@/lib/supabase';
import {
  IMPORT_SYSTEM, buildImportUserMessage, clampBrochure, draftFromImport, parseModelJson,
} from '@/lib/import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // a full itinerary extraction takes a moment

function importConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await requireEditor();
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!tripsDbConfigured()) return Response.json({ error: 'db_unavailable' }, { status: 503 });
  if (!importConfigured()) {
    return Response.json(
      { error: 'ai_not_configured', message: 'AI import is not switched on yet. Add an Anthropic API key to enable it.' },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? '').trim();
  if (text.length < 120) {
    return Response.json({ error: 'too_short', message: 'Paste a fuller itinerary so there is something to work from.' }, { status: 400 });
  }

  // Extract. The SDK reads ANTHROPIC_API_KEY from the environment; a bounded
  // timeout keeps a slow call from holding the function open.
  let raw: unknown;
  try {
    const client = new Anthropic({ timeout: 110_000 });
    const resp = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: IMPORT_SYSTEM,
      messages: [{ role: 'user', content: buildImportUserMessage(clampBrochure(text)) }],
    });
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    raw = parseModelJson(textBlock?.text ?? '');
    if (raw == null) {
      return Response.json({ error: 'unreadable', message: 'The AI could not structure that text. Try a clearer itinerary.' }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status === 401) {
      return Response.json({ error: 'ai_not_configured', message: 'The Anthropic API key is missing or invalid.' }, { status: 503 });
    }
    const timedOut = err instanceof Error && /timeout|timed out/i.test(err.message);
    return Response.json(
      { error: 'ai_failed', message: timedOut ? 'The import took too long. Try a shorter itinerary.' : 'The import did not complete. Please try again.' },
      { status: 502 },
    );
  }

  // Coerce to a safe draft. A non-trip document is refused here.
  const draft = draftFromImport(raw);
  if (!draft.ok) return Response.json({ error: 'not_a_trip', message: draft.error }, { status: 400 });

  const trip = await createTrip(ctx.operatorId, draft.trip);
  if (!trip) return Response.json({ error: 'create_failed', message: 'The draft could not be created.' }, { status: 500 });
  await updateTripContent(trip.id, ctx.operatorId, draft.content);

  return Response.json({ ok: true, tripId: trip.id });
}
