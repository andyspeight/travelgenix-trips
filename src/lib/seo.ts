// =============================================================================
//  lib/seo.ts — operator-branded metadata for public pages
// =============================================================================
//  The browser tab, the favicon and a shared-link preview are the last places a
//  white-label platform gives itself away. This builds Metadata that names the
//  OPERATOR, not Travelgenix: the title carries their name, the favicon is their
//  logo where they have one, and Open Graph uses their name as the site. Pages
//  that do not pass a logo simply get no icon (the browser default), never a
//  Travelgenix mark.
// =============================================================================

import type { Metadata } from 'next';
import { safeImageUrl } from './url.ts';

export interface OperatorMetaInput {
  title: string;
  description?: string | null;
  operatorName: string;
  logoUrl?: string | null;
  /** A large preview image (e.g. the trip hero) for social cards. */
  image?: string | null;
}

export function operatorMetadata(input: OperatorMetaInput): Metadata {
  const logo = safeImageUrl(input.logoUrl);
  const image = safeImageUrl(input.image);
  const description = input.description || undefined;

  return {
    title: input.title,
    description,
    // The favicon is the operator's logo where there is one; otherwise nothing,
    // so the tab never shows a Travelgenix icon.
    icons: logo ? { icon: logo } : undefined,
    openGraph: {
      title: input.title,
      description,
      siteName: input.operatorName,
      images: image ? [image] : undefined,
    },
  };
}
