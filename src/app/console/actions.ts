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
import { headers } from 'next/headers';
import { requireOperator } from '@/lib/auth';
import { validateTrip, validateDeparture, validatePackage, validateOption, validatePromo, isValidTripStatus } from '@/lib/validate';
import { sanitiseTripContent } from '@/lib/content';
import { sanitiseFormSchema, sanitiseWaiverInput, validateRegistration } from '@/lib/registration';
import { normaliseReference } from '@/lib/booking';
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
  saveForm,
  saveWaiver,
  getRegistrationContext,
  writeRegistration,
  createPackage,
  updatePackage,
  removePackage,
  createOption,
  updateOption,
  removeOption,
  bulkSetBookingStatus,
  setWaitlistStatus,
  sendTripBroadcast,
  parseSegment,
  saveMessageTemplate,
  deleteMessageTemplate,
  savePromoCode,
  removePromoCode,
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
//  Packages — room types and occupancy tiers (phase 5).
// ---------------------------------------------------------------------------

export async function savePackageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const raw = fields(form);
  const tripId = String(raw.trip_id || '');
  const packageId = String(raw.id || '');

  const { ok, errors, value } = validatePackage(raw);
  if (!ok) return fail(errors, 'Check the highlighted fields.');

  const saved = packageId
    ? await updatePackage(packageId, tripId, ctx.operatorId, value)
    : await createPackage(tripId, ctx.operatorId, value);

  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: packageId ? 'Saved.' : 'Package added.' };
}

export async function removePackageAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const tripId = String(form.get('trip_id') || '');
  const packageId = String(form.get('id') || '');

  // A package with bookings against it is kept, not deleted, so the record of
  // what a traveller booked survives. The console reflects that it stayed.
  await removePackage(packageId, tripId, ctx.operatorId);
  revalidatePath(`/console/trips/${tripId}`);
}

// ---------------------------------------------------------------------------
//  Options — priced add-ons and extras (phase 5).
// ---------------------------------------------------------------------------

export async function saveOptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const raw = fields(form);
  const tripId = String(raw.trip_id || '');
  const optionId = String(raw.id || '');

  const { ok, errors, value } = validateOption(raw);
  if (!ok) return fail(errors, 'Check the highlighted fields.');

  const saved = optionId
    ? await updateOption(optionId, tripId, ctx.operatorId, value)
    : await createOption(tripId, ctx.operatorId, value);

  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: optionId ? 'Saved.' : 'Extra added.' };
}

export async function removeOptionAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const tripId = String(form.get('trip_id') || '');
  const optionId = String(form.get('id') || '');

  // Bookings keep their own snapshot of the extras they chose, so removing an
  // option here never erases what a traveller booked.
  await removeOption(optionId, tripId, ctx.operatorId);
  revalidatePath(`/console/trips/${tripId}`);
}

// ---------------------------------------------------------------------------
//  Manage Trip — bulk booking status (offline payment reconciliation).
//  Called directly from the client table with plain args, not FormData.
// ---------------------------------------------------------------------------

export async function bulkSetBookingStatusAction(
  tripId: string,
  ids: string[],
  status: string,
): Promise<{ ok: boolean; updated: number }> {
  const ctx = await requireOperator();
  if (!ctx) return { ok: false, updated: 0 };

  const list = Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  const updated = await bulkSetBookingStatus(tripId, ctx.operatorId, list, String(status));

  revalidatePath(`/console/trips/${tripId}/manage`);
  revalidatePath('/console/bookings');
  return { ok: updated > 0, updated };
}

export async function setWaitlistStatusAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const id = String(form.get('id') || '');
  const tripId = String(form.get('trip_id') || '');
  const status = String(form.get('status') || '');

  await setWaitlistStatus(id, tripId, ctx.operatorId, status);
  revalidatePath(`/console/trips/${tripId}/manage`);
}

// ---------------------------------------------------------------------------
//  Messaging — broadcast to a trip, and reusable templates.
// ---------------------------------------------------------------------------

export async function sendBroadcastAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const tripId = String(form.get('id') || '');
  const subject = String(form.get('subject') || '').trim().slice(0, 200);
  const body = String(form.get('body') || '').trim().slice(0, 10000);
  const segment = parseSegment(String(form.get('segment') || 'all'));

  const errors: Record<string, string> = {};
  if (!subject) errors.subject = 'Give the message a subject.';
  if (!body) errors.body = 'Write the message.';
  if (Object.keys(errors).length) return fail(errors, 'Check the highlighted fields.');

  const res = await sendTripBroadcast(tripId, ctx.operatorId, { subject, body, segment });
  if (!res) return fail({}, 'That trip could not be found.');
  if (res.total === 0) return fail({}, 'No one matches that group, so nothing was sent.');

  revalidatePath(`/console/trips/${tripId}/manage`);
  return { ok: true, errors: {}, message: `Sent to ${res.sent} of ${res.total} ${res.total === 1 ? 'person' : 'people'}.` };
}

export async function saveTemplateAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  const name = String(form.get('name') || '').trim().slice(0, 120);
  const subject = String(form.get('subject') || '').trim().slice(0, 200);
  const body = String(form.get('body') || '').trim().slice(0, 10000);
  if (!name || !subject || !body) return;

  await saveMessageTemplate(ctx.operatorId, { name, subject, body });
  revalidatePath(`/console/trips/${String(form.get('trip_id') || '')}/manage`);
}

export async function deleteTemplateAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  await deleteMessageTemplate(String(form.get('id') || ''), ctx.operatorId);
  revalidatePath(`/console/trips/${String(form.get('trip_id') || '')}/manage`);
}

// ---------------------------------------------------------------------------
//  Promo codes.
// ---------------------------------------------------------------------------

export async function savePromoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const raw = fields(form);
  const tripId = String(raw.id || '');
  const { ok, errors, value } = validatePromo(raw);
  if (!ok) return fail(errors, 'Check the highlighted fields.');

  const res = await savePromoCode(tripId, ctx.operatorId, value);
  if (!res.ok) return fail({}, res.error || 'The code could not be saved.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: 'Code saved.' };
}

export async function removePromoAction(form: FormData): Promise<void> {
  const ctx = await requireOperator();
  if (!ctx) return;

  await removePromoCode(String(form.get('id') || ''), ctx.operatorId);
  revalidatePath(`/console/trips/${String(form.get('trip_id') || '')}`);
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

// ---------------------------------------------------------------------------
//  Phase 4 authoring — the custom registration form and the waiver.
// ---------------------------------------------------------------------------

export async function saveFormAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const tripId = String(form.get('id') || '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get('schema') || '[]'));
  } catch {
    return fail({}, 'The form could not be read. Please try again.');
  }

  // The sanitiser is the authority: it keeps keys stable and unique and drops
  // anything malformed before it can reach a traveller.
  const schema = sanitiseFormSchema(parsed);
  const saved = await saveForm(tripId, ctx.operatorId, schema);
  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: schema.length ? 'Questions saved.' : 'Form cleared.' };
}

export async function saveWaiverAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireOperator();
  if (!ctx) return fail({}, 'Your session has expired. Sign in again.');

  const tripId = String(form.get('id') || '');

  // An empty body means "no waiver", which sanitiseWaiverInput returns as null.
  const input = sanitiseWaiverInput({
    title: form.get('title'),
    body: form.get('body'),
    is_mandatory: form.get('is_mandatory') === 'on',
  });

  const saved = await saveWaiver(tripId, ctx.operatorId, input);
  if (!saved) return fail({}, 'That trip could not be found.');

  revalidatePath(`/console/trips/${tripId}`);
  return { ok: true, errors: {}, message: input ? 'Agreement saved.' : 'Agreement removed.' };
}

// ---------------------------------------------------------------------------
//  Phase 4 registration — traveller-facing, gated on the booking REFERENCE.
//  This is the one console action with no operator session: whoever holds the
//  reference may complete that booking, exactly as they can view it. Every id
//  the payload carries is re-resolved against the booking inside the repo.
// ---------------------------------------------------------------------------

export async function submitRegistrationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ref = normaliseReference(String(form.get('reference') || ''));
  if (!ref) return fail({}, 'We could not find that booking.');

  const ctx = await getRegistrationContext(ref);
  if (!ctx) return fail({}, 'We could not find that booking.');

  // A place that is no longer held cannot be registered against.
  if (ctx.booking.status === 'expired' || ctx.booking.status === 'cancelled') {
    return fail({}, 'This booking is no longer active, so it cannot be completed.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(form.get('payload') || '{}'));
  } catch {
    return fail({}, 'Your details could not be read. Please try again.');
  }

  const { ok, errors, value } = validateRegistration(
    ctx.form?.schema ?? [],
    ctx.waiver,
    ctx.booking.party_size,
    payload,
  );
  if (!ok) return fail(errors, 'Please check the highlighted details.');

  // Signature provenance. NOTE: per-IP rate limiting on this public action is
  // the documented phase-2 follow-up and still wants a shared store.
  const h = await headers();
  const rawIp = (h.get('x-forwarded-for') || '').split(',')[0]?.trim() || '';
  // Only a well-formed address reaches the inet column; junk becomes null rather
  // than failing the whole registration insert.
  const ip = /^[0-9a-fA-F:.]{3,45}$/.test(rawIp) && /[.:]/.test(rawIp) ? rawIp : null;
  const userAgent = h.get('user-agent');

  const written = await writeRegistration(ctx, value, { ip, userAgent });
  if (!written) return fail({}, 'Something went wrong saving your details. Please try again.');

  revalidatePath(`/booked/${ctx.booking.reference}`);
  redirect(`/booked/${ctx.booking.reference}?registered=1`);
}
