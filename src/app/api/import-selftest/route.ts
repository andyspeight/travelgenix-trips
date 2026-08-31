// TEMPORARY self-test for AI brochure import. Runs a canned itinerary through
// the real extraction path (Anthropic call + draftFromImport) and returns a
// summary, so the whole pipeline can be verified in the deployed environment
// without a POST (the fetch tool is GET-only). Creates NO trip. Guarded to the
// preview host and removed after use.

import Anthropic from '@anthropic-ai/sdk';
import { IMPORT_SYSTEM, buildImportUserMessage, draftFromImport, parseModelJson } from '@/lib/import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CANNED = `Discover Morocco: a 5 day journey from Marrakech to the Atlas Mountains.
Day 1: Arrive in Marrakech, transfer to your riad, evening in the medina.
Day 2: Explore the souks and the Bahia Palace with a local guide.
Day 3: Drive into the High Atlas, lunch in a Berber village, overnight in a mountain kasbah.
Day 4: Guided walk to a waterfall, then return to Marrakech.
Day 5: Free morning, then your departure transfer to the airport.
Included: 4 nights accommodation, breakfast daily, airport transfers, an English-speaking guide.
Not included: international flights, lunches and dinners, travel insurance.`;

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get('host') ?? '';
  if (!host.endsWith('.vercel.app')) return new Response('not found', { status: 404 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ configured: false });

  try {
    const client = new Anthropic({ timeout: 110_000 });
    const resp = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: IMPORT_SYSTEM,
      messages: [{ role: 'user', content: buildImportUserMessage(CANNED) }],
    });
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const raw = parseModelJson(textBlock?.text ?? '');
    const draft = draftFromImport(raw);
    if (!draft.ok) return Response.json({ configured: true, ok: false, error: draft.error });
    return Response.json({
      configured: true,
      ok: true,
      title: draft.trip.title,
      location: draft.trip.location,
      days: draft.content.days?.length ?? 0,
      included: draft.content.included?.length ?? 0,
      excluded: draft.content.excluded?.length ?? 0,
      model: resp.model,
    });
  } catch (err) {
    return Response.json({ configured: true, ok: false, error: String(err instanceof Error ? err.message : err) });
  }
}
