// =============================================================================
//  lib/colour.ts
// =============================================================================
//
//  An operator's brand colour is author-supplied and chosen against THEIR
//  letterhead, not against our page. Global Travel Solution's navy (#1B2B5B)
//  is handsome on white and effectively invisible on a dark ground, which is
//  exactly what happened the first time a real operator's trip page rendered
//  for a viewer whose OS was in dark mode.
//
//  So a brand colour is never used raw. It is validated against the surface it
//  will sit on and nudged until it is readable, keeping its hue so it still
//  reads as the operator's colour rather than being replaced by ours.
//
//  WCAG AA for normal text is 4.5:1. Prices and labels are the things this
//  guards, and they are text people need to read, so 4.5 it is.
//
// =============================================================================

export interface Rgb { r: number; g: number; b: number }

/** #abc and #aabbcc only. Anything else is not a colour we will render. */
export function parseHex(value: string | null | undefined): Rgb | null {
  const s = String(value ?? '').trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;

  const hex = m[1]!;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 to 21. Order of arguments does not matter. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix toward white or black by a fraction, which preserves hue far better
 *  than scaling channels does. */
function mix(colour: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: colour.r + (target.r - colour.r) * amount,
    g: colour.g + (target.g - colour.g) * amount,
    b: colour.b + (target.b - colour.b) * amount,
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * The operator's colour, adjusted just enough to be readable on `background`.
 *
 * Lightens against a dark ground and darkens against a light one, in small
 * steps, stopping the moment it passes. A colour that already passes is
 * returned untouched, which is the common case and the one that matters: we
 * are correcting a failure, not restyling everybody's brand.
 *
 * Falls back to `fallback` when the input is not a usable hex, so an operator
 * typing nonsense into a colour field cannot produce unreadable text.
 */
export function readableOn(
  brand: string | null | undefined,
  background: string,
  fallback: string,
  minRatio = 4.5,
): string {
  const colour = parseHex(brand);
  const bg = parseHex(background);
  if (!colour || !bg) return fallback;

  if (contrast(colour, bg) >= minRatio) return toHex(colour);

  // Move away from the background: lighten on dark, darken on light.
  const target = luminance(bg) < 0.5 ? WHITE : BLACK;

  for (let step = 1; step <= 20; step++) {
    const candidate = mix(colour, target, step / 20);
    if (contrast(candidate, bg) >= minRatio) return toHex(candidate);
  }

  // Nothing in the operator's hue can pass, which happens for a mid-grey on a
  // mid-grey. Ours is guaranteed to work.
  return fallback;
}
