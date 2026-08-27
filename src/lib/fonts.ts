// =============================================================================
//  lib/fonts.ts
// =============================================================================
//
//  An operator names their typeface in their brand record. Global Travel
//  Solution asked for DM Sans and we were rendering system sans, which throws
//  away the most recognisable half of a brand.
//
//  It cannot be trusted straight through. The name ends up in a stylesheet URL
//  and in a CSS font-family, so an operator typing
//  `Foo"); @import url(evil.css); x:("` must not be able to do anything with
//  it. An allowlist is the only safe answer: unknown names fall back rather
//  than being escaped and hoped for.
//
//  Google Fonts is the one external host the pages may load from, which is
//  also the only host our published-artifact CSP admits, so the two agree.
//
// =============================================================================

export interface OperatorFont {
  /** Ready to drop into CSS font-family. Always ends in a real fallback. */
  stack: string;
  /** The stylesheet to load, or null when we are using system fonts. */
  href: string | null;
  /** What we actually resolved to, for display and tests. */
  name: string;
}

const SYSTEM_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SYSTEM_SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", serif';

/** Faces an operator may choose. Anything else falls back to system sans. */
const ALLOWED: Record<string, 'sans' | 'serif'> = {
  'DM Sans': 'sans',
  'Inter': 'sans',
  'Manrope': 'sans',
  'Work Sans': 'sans',
  'Source Sans 3': 'sans',
  'Lato': 'sans',
  'Montserrat': 'sans',
  'Poppins': 'sans',
  'Raleway': 'sans',
  'Karla': 'sans',
  'Rubik': 'sans',
  'Nunito Sans': 'sans',
  'Open Sans': 'sans',
  'Barlow': 'sans',
  'Outfit': 'sans',
  'Plus Jakarta Sans': 'sans',
  'Archivo': 'sans',
  'Figtree': 'sans',
  'Playfair Display': 'serif',
  'Lora': 'serif',
  'Merriweather': 'serif',
  'Libre Baskerville': 'serif',
  'Cormorant Garamond': 'serif',
  'EB Garamond': 'serif',
  'Fraunces': 'serif',
  'Source Serif 4': 'serif',
};

// Match on a normalised key so "dm sans" and "DM  Sans" both resolve.
const LOOKUP = new Map(
  Object.keys(ALLOWED).map((name) => [name.toLowerCase().replace(/\s+/g, ' '), name]),
);

/**
 * Resolve an operator's requested typeface to something safe to render.
 * Unknown, absent or hostile input returns the system stack and loads nothing.
 */
export function operatorFont(requested: string | null | undefined): OperatorFont {
  const key = String(requested ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const name = LOOKUP.get(key);

  if (!name) return { stack: SYSTEM_SANS, href: null, name: 'system' };

  const fallback = ALLOWED[name] === 'serif' ? SYSTEM_SERIF : SYSTEM_SANS;

  // The name came from the allowlist, not from the caller, so this cannot be
  // used to reach anything other than a Google Fonts family.
  const family = name.replace(/ /g, '+');
  return {
    stack: `"${name}", ${fallback}`,
    href: `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`,
    name,
  };
}
