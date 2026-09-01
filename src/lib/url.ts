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
  // Our own first-party asset origins (the /photos we host), so seed content and
  // operators can use images we serve. Production alias plus the Vercel host.
  'trips.travelify.io',
  'travelgenix-trips.vercel.app',
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

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** True when a (already host-validated) media URL points at a video, by
 *  extension. Blob URLs keep the original extension, so this is reliable. */
export function isVideoUrl(value: string | null | undefined): boolean {
  const s = String(value ?? '');
  try {
    const u = new URL(s);
    return VIDEO_EXT.test(u.pathname);
  } catch {
    return VIDEO_EXT.test(s);
  }
}

/** Same host rule as safeImageUrl (the Blob store and the seed stock hosts),
 *  but does not care whether it is image or video. Used wherever a stored media
 *  URL is rendered; the caller picks img vs video with isVideoUrl. */
export function safeMediaUrl(value: string | null | undefined): string | null {
  return safeImageUrl(value); // host allowlist is identical; extension is not filtered
}
