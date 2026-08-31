// =============================================================================
//  lib/email-template.ts — the branded HTML email shell
// =============================================================================
//  Every notification a traveller gets is dressed in the operator's brand, not
//  ours: their logo (or name) in the header, their accent colour, and — unless
//  they have gone white-label — a small Travelgenix credit in the footer. Pure
//  and email-client-safe: table layout, inline styles only, no external CSS or
//  script, everything user-supplied escaped. Unit-tested without a mail
//  provider. The plain-text body is kept alongside as the fallback.
// =============================================================================

/** HTML-escape a string for safe interpolation into an email body. */
export function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A 6-digit hex colour, or the fallback. Never lets an unvalidated colour into
 *  a style attribute. */
export function safeHex(value: string | null | undefined, fallback = '#0e6e5c'): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

/** Only an https image URL is allowed as a logo (it renders in an email client). */
function safeLogo(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.includes('.') ? value : null;
  } catch {
    return null;
  }
}

export interface EmailBrand {
  operatorName: string;
  logoUrl?: string | null;
  accent?: string | null;
  hidePoweredBy?: boolean;
}

/** A paragraph of body text (escaped). */
export function emailP(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#2b3138">${esc(text)}</p>`;
}

/** A label/value facts block, like the booking summary. */
export function emailFacts(rows: Array<[string, string]>): string {
  const trs = rows
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#7a828b;white-space:nowrap;vertical-align:top">${esc(label)}</td>` +
        `<td style="padding:6px 0;font-size:14px;color:#2b3138;font-weight:600">${esc(value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border-collapse:collapse">${trs}</table>`;
}

/** A single call-to-action button in the operator's accent colour. */
export function emailButton(label: string, url: string, accent: string): string {
  const a = safeHex(accent);
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="border-radius:8px;background:${a}">` +
    `<a href="${esc(url)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${esc(label)}</a>` +
    `</td></tr></table>`
  );
}

/** Wrap composed body HTML in the branded shell. previewText is the inbox
 *  preheader; contentHtml is already-escaped HTML from the helpers above. */
export function renderBrandedEmail(brand: EmailBrand, opts: { previewText: string; contentHtml: string }): string {
  const accent = safeHex(brand.accent);
  const logo = safeLogo(brand.logoUrl);
  const name = esc(brand.operatorName || 'Your trip');

  const header = logo
    ? `<img src="${esc(logo)}" alt="${name}" height="34" style="height:34px;width:auto;display:block" />`
    : `<span style="font-size:17px;font-weight:700;color:${accent}">${name}</span>`;

  const footer = brand.hidePoweredBy
    ? ''
    : `<tr><td style="padding:18px 32px 28px;text-align:center;border-top:1px solid #ececef">` +
      `<a href="https://trips.travelify.io" style="font-size:12px;color:#9aa0a6;text-decoration:none">Powered by Travelgenix Trips</a></td></tr>`;

  return (
    `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>` +
    `<body style="margin:0;padding:0;background:#f4f5f7">` +
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.previewText)}</span>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7eaed">` +
    `<tr><td style="padding:22px 32px;border-bottom:1px solid #ececef">${header}</td></tr>` +
    `<tr><td style="padding:26px 32px 8px">${opts.contentHtml}</td></tr>` +
    footer +
    `</table></td></tr></table></body></html>`
  );
}
