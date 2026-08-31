// =============================================================================
//  lib/reviews.ts — the pure parts of reviews
// =============================================================================
//  Kept free of the database so the roll-up maths is unit-tested, like money.ts
//  and members.ts. The average is what a star rating shows, so it is rounded to
//  one decimal place and clamped into 0..5.
// =============================================================================

import type { ReviewSummary } from './types.ts';

/** Average (to 1 dp) and count of a set of 1..5 ratings. Junk values are dropped
 *  rather than skewing the average; an empty set is a clean zero. */
export function summariseRatings(ratings: readonly number[]): ReviewSummary {
  const clean = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  if (clean.length === 0) return { average: 0, count: 0 };
  const sum = clean.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / clean.length) * 10) / 10;
  return { average, count: clean.length };
}

/** Whole, half and empty star counts for an average, for drawing a star row.
 *  Rounds to the nearest half star. */
export function starParts(average: number): { full: number; half: boolean; empty: number } {
  const a = Math.max(0, Math.min(5, Number.isFinite(average) ? average : 0));
  const halves = Math.round(a * 2); // 0..10
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  const empty = 5 - full - (half ? 1 : 0);
  return { full, half, empty };
}
