'use server';

// =============================================================================
//  Review action — public, reference-gated
// =============================================================================
//  A review can only be left by someone holding a booking reference (the same
//  bearer token as /register and /booked), so a review is verified: it came from
//  a real booking. The review lands as PENDING and is not shown anywhere public
//  until the operator approves it.
//
//  Like book/actions.ts, this 'use server' module exports ONLY async functions;
//  the state shape lives in lib/action-state.ts so it survives the client
//  boundary.
// =============================================================================

import { validateReview } from '@/lib/validate';
import { submitReview } from '@/lib/repo';
import { fail, type ActionState } from '@/lib/action-state';

export async function submitReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;

  const reference = String(raw.reference || '');
  const { ok, errors, value } = validateReview(raw);
  if (!ok) return fail(errors, 'Please check the highlighted fields.');

  const result = await submitReview(reference, value);
  if (result === 'not_allowed') return fail({}, 'We could not find that booking, so this review cannot be left.');
  if (result === 'exists') {
    return { ok: true, errors: {}, message: 'You have already reviewed this trip. Thank you.' };
  }

  return {
    ok: true,
    errors: {},
    message: 'Thank you. Your review has been sent to the operator and will appear once approved.',
  };
}
