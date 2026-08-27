// =============================================================================
//  lib/url.ts — validating operator-supplied URLs before they hit the page
// =============================================================================
//
//  An operator's logo, hero image, day photos, gallery and section images are
//  all untrusted operator input that end up in an <img src>. Colour and font
//  are already validated (colour.ts, fonts.ts); image URLs were not. A
//  javascript: or data: URL in an <img src> is not itself script-executing in a
//  modern browser, but an unvalidated URL can still exfiltrate a viewer's IP to
//  an arbitrary host, and a non-image URL is simply broken. So every operator
//  URL is held to the same bar: https only, a real host, and (for the images we
//  serve) the blob store the app already trusts, with a small allowlist for the
//  stock photography the migrated tours still use.
//
// =============================================================================

// Hosts we are willing to load an operator image from. The blob store is where
// uploads live; the rest are the stock hosts the seed/migrated content uses and
// can be removed once every trip carries its own uploaded imagery.
const IMAGE_HOST_SUFFIXES = [
  '.public.blob.vercel-storage.com',
  'images.unsplash.com',
  'picsum.photos',
];

/**
 * Return the URL if it is a safe https image address, else null. Callers render
 * the null case as no image rather than a broken or hostile one.
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const ok = IMAGE_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix,
    );
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}
