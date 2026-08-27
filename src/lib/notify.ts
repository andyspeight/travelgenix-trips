// =============================================================================
//  lib/notify.ts
// =============================================================================
//
//  Booking notifications: the traveller's confirmation and the operator's
//  heads-up. This is a SEAM. A real provider (the estate uses SendGrid and
//  Brevo) drops into `transport` below; until then the default transport logs
//  and returns ok, so the booking journey is complete end to end and the wiring
//  point is a single obvious function rather than scattered fetch calls.
//
//  Notification is ALWAYS best-effort and NEVER blocks a booking. A held place
//  is real whether or not the email sent; a failed send is logged and swallowed
//  so a flaky mail provider can never cost a traveller their seat. The operator
//  can always see the booking in the console regardless.
//
// =============================================================================

import 'server-only';
import { format as money } from './money.ts';

export interface EmailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  /** Plain text. Real HTML templating is a provider-time concern, not a hold
   *  -time one; the confirmation content is deliberately simple and correct. */
  body: string;
}

export type EmailTransport = (msg: EmailMessage) => Promise<{ ok: boolean; detail: string }>;

/** The default: log and succeed. Visible in the Vercel function logs, so an
 *  operator testing a booking can confirm the message was composed correctly
 *  before a provider is wired. */
const logTransport: EmailTransport = async (msg) => {
  console.log('[notify] would send', JSON.stringify({ to: msg.to, subject: msg.subject }));
  return { ok: true, detail: 'logged (no provider configured)' };
};

// When a provider is wired, replace this with the real transport. Everything
// else in the file stays exactly as it is.
const transport: EmailTransport = logTransport;

export function emailProviderConfigured(): boolean {
  return transport !== logTransport;
}

export interface BookingEmailContext {
  reference: string;
  tripTitle: string;
  operatorName: string;
  operatorReplyTo?: string | null;
  startsOn: string;
  endsOn: string;
  partySize: number;
  leadName: string;
  leadEmail: string;
  currency: string;
  totalPence: number | null;
  depositPence: number | null;
  holdExpiresAt: string | null;
}

/**
 * Confirm a held booking to the traveller. Warm, plain, UK English, no em
 * dashes, per the brand voice. States plainly that the place is HELD, not yet
 * paid, because pretending otherwise is how a traveller loses a seat they
 * thought was theirs.
 */
export async function sendTravellerConfirmation(ctx: BookingEmailContext): Promise<{ ok: boolean; detail: string }> {
  const dates = `${humanDate(ctx.startsOn)} to ${humanDate(ctx.endsOn)}`;
  const deposit = money(ctx.depositPence, ctx.currency);
  const total = money(ctx.totalPence, ctx.currency);

  const lines = [
    `Hi ${firstName(ctx.leadName)},`,
    ``,
    `Thank you for booking ${ctx.tripTitle} with ${ctx.operatorName}.`,
    ``,
    `Your reference is ${ctx.reference}. Keep it handy, it is how we find your booking.`,
    ``,
    `  Trip       ${ctx.tripTitle}`,
    `  Dates      ${dates}`,
    `  Travelling ${ctx.partySize} ${ctx.partySize === 1 ? 'person' : 'people'}`,
    total ? `  Total      ${total}` : ``,
    deposit ? `  Deposit    ${deposit} to secure your place` : ``,
    ``,
    ctx.holdExpiresAt
      ? `We are holding your place until ${humanDateTime(ctx.holdExpiresAt)}. ${ctx.operatorName} will be in touch to take payment and confirm.`
      : `${ctx.operatorName} will be in touch shortly to confirm your booking and arrange payment.`,
    ``,
    `See you soon,`,
    ctx.operatorName,
  ].filter((l) => l !== null);

  return safeSend({
    to: ctx.leadEmail,
    replyTo: ctx.operatorReplyTo ?? undefined,
    subject: `Your booking with ${ctx.operatorName}, reference ${ctx.reference}`,
    body: lines.join('\n'),
  });
}

/** Tell the operator a place has just been taken, so they can act even before
 *  they next open the console. */
export async function sendOperatorNotice(ctx: BookingEmailContext, operatorEmail: string): Promise<{ ok: boolean; detail: string }> {
  const dates = `${humanDate(ctx.startsOn)} to ${humanDate(ctx.endsOn)}`;
  const body = [
    `New booking on ${ctx.tripTitle}.`,
    ``,
    `  Reference  ${ctx.reference}`,
    `  Lead       ${ctx.leadName} (${ctx.leadEmail})`,
    `  Dates      ${dates}`,
    `  Party      ${ctx.partySize}`,
    ``,
    `It is in your console now.`,
  ].join('\n');

  return safeSend({
    to: operatorEmail,
    subject: `New booking: ${ctx.tripTitle}, ${ctx.reference}`,
    body,
  });
}

/** Never throws. A notification failure is logged and swallowed. */
async function safeSend(msg: EmailMessage): Promise<{ ok: boolean; detail: string }> {
  try {
    return await transport(msg);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'send failed';
    console.error('[notify] send failed, swallowed', detail);
    return { ok: false, detail };
  }
}

function firstName(full: string): string {
  return String(full ?? '').trim().split(/\s+/)[0] || 'there';
}

function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function humanDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}
