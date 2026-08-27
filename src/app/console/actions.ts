'use server';

// =============================================================================
//  Console server actions
// =============================================================================
//
//  Every action does the same three things in the same order, and none of them
//  are optional:
//
//    1. Resolve the operator from the session. No session, or a session with no
//       operator, owns nothing.
//    2. Re-validate the input. The form is a convenience; a POST body is
//       whatever the caller felt like sending.
//    3. Write through repo.ts, which filters on operator_id as well as id, so
//       a forged id patches zero rows.
//
// =============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOperator } from '@/lib/auth';
import { validateTrip, validateDeparture, isValidTripStatus } from '@/lib/validate';
import { sanitiseTripContent } from '@/lib/content';
import { fail, type ActionState } from '@/lib/action-state';
import {
  createTrip,
  updateTrip,
  setTripStatus,
  createDeparture,
  updateDeparture,
  removeDeparture,
  getTripOwned,
  listOpenDepartures,
  updateTripContent,
} from '@/lib/repo';

/** Turns FormData into a plain object the validators can read. */
function fields(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

// ---------------------------------------------------------------------------

export async function saveTripAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const raw = fields(form);
  const { ok, errors, value } = validateTrip(raw);
  if (!ok) return fail(errors, 'Check the highlighted fields.');

  const tripId = typeof raw.id === 'string' ? raw.id : '';

  if (tripId) {
    const saved = await updateTrip(tripId, ctx.operatorId, value);
    if (!saved) return fail({}, 'That trip could not be found.');
    revalidatePath('/console');
    revalidatePath(`/console/trips/${tripId}`);
    return { ok: true, errors: {}, message: 'Saved.' };
  }

  const created = await createTrip(ctx.operatorId, value);
  if (!created) return fail({}, 'The trip could not be created. Try again.');

  revalidatePath('/console');
  // redirect throws by design, so it goes last and outside any try.
  redirect(`/console/trips/${created.id}`);
}

// ---------------------------------------------------------------------------

export async function setTripStatusAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const tripId = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  if (!isValidTripStatus(status)) return;

  // Publishing puts a page on the public internet, so it needs something on it.
  // A trip with no open departure has nothing to sell and reads as broken.
  //
  // The console disables the button in that case, but the button is a courtesy:
  // this is the rule, and it is enforced here because a POST body is whatever
  // the caller felt like sending.
  if (status === 'published') {
    const trip = await getTripOwned(tripId, ctx.operatorId);
    if (!trip) return;

    const open = await listOpenDepartures(tripId);
    if (open.length === 0) return;
  }

  await setTripStatus(tripId, ctx.operatorId, status);
  revalidatePath('/console');
  revalidatePath(`/console/trips/${tripId}`);
}

// ---------------------------------------------------------------------------

export async function saveDepartureAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const raw = fields(form);
  const tripId = String(raw.trip_id || '');
  const departureId = String(raw.id || '');

  const { ok, errors, value } = validateDeparture(raw);
  if (!ok) return fail(errors, 'Check the highlighted fields.');

  const saved = departureId
    ? await updateDeparture(departureId, tripId, ctx.operatorId, value)
    : await createDeparture(tripId, ctx.operatorId, value);

  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: departureId ? 'Saved.' : 'Departure added.' };
}

// ---------------------------------------------------------------------------

export async function removeDepartureAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const tripId = String(form.get('trip_id') || '');
  const departureId = String(form.get('id') || '');

  await removeDeparture(departureId, tripId, ctx.operatorId);
  revalidatePath(`/console/trips/${tripId}`);
}

// ---------------------------------------------------------------------------

export async function saveTripContentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const tripId = String(form.get('id') || '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get('content') || '{}'));
  } catch {
    return fail({}, 'The content could not be read. Please try again.');
  }

  // The sanitiser is the authority: it clamps text, validates image URLs and
  // converts prices, so nothing an operator types reaches the public page raw.
  const content = sanitiseTripContent(parsed);

  const saved = await updateTripContent(tripId, ctx.operatorId, content);
  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  // The public trip page revalidates on its own 60s cycle, so the change shows
  // there within a minute without needing its operator+slug path here.
  return { ok: true, errors: {}, message: 'Content saved.' };
}
