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

// Where the traveller-facing pages live, for links inside emails. The custom
// domain by default; overridable for other hosts.
const PUBLIC_ORIGIN = (process.env.TRIPS_PUBLIC_ORIGIN || 'https://trips.travelify.io').replace(/\/+$/, '');

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

// Brevo transactional email, activated by env. The estate already uses Brevo, so
// this is the same account. From address and sender name come from env; nothing
// is hard-coded. When BREVO_API_KEY is absent this whole thing is skipped and
// the log transport runs, so the flow is complete without a key (the same seam
// pattern as Stripe). Reply-to carries the operator's own address when present.
const BREVO_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = process.env.TRIPS_EMAIL_FROM || '';
const FROM_NAME = process.env.TRIPS_EMAIL_FROM_NAME || 'Travelgenix Trips';

const brevoTransport: EmailTransport = async (msg) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: msg.to }],
        replyTo: msg.replyTo ? { email: msg.replyTo } : undefined,
        subject: msg.subject,
        textContent: msg.body,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, detail: `brevo ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true, detail: 'sent via brevo' };
  } finally {
    clearTimeout(timer);
  }
};

// The real transport is used only when a key AND a from address are configured;
// otherwise the log transport keeps the flow whole.
const transport: EmailTransport = BREVO_KEY && FROM_EMAIL ? brevoTransport : logTransport;

export function emailProviderConfigured(): boolean {
  return transport !== logTransport;
}

/** Send one email. Never throws (safeSend swallows), so a broadcast loop cannot
 *  be broken by one bad address. Returns per-message success for a sent count. */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; detail: string }> {
  return safeSend(msg);
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
    `Add your travellers' details and complete your booking here:`,
    `${PUBLIC_ORIGIN}/register/${ctx.reference}`,
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

/** A gentle nudge to a traveller who booked but has not finished their details.
 *  Sent at most once, by the scheduled reminder. */
export async function sendRegistrationReminder(ctx: BookingEmailContext): Promise<{ ok: boolean; detail: string }> {
  const body = [
    `Hi ${firstName(ctx.leadName)},`,
    ``,
    `A quick reminder about your booking of ${ctx.tripTitle} with ${ctx.operatorName}.`,
    ``,
    `Please add each traveller's details and complete anything ${ctx.operatorName} needs:`,
    `${PUBLIC_ORIGIN}/register/${ctx.reference}`,
    ``,
    `Your reference is ${ctx.reference}.`,
    ``,
    `Thanks,`,
    ctx.operatorName,
  ].join('\n');

  return safeSend({
    to: ctx.leadEmail,
    replyTo: ctx.operatorReplyTo ?? undefined,
    subject: `A quick reminder about your ${ctx.tripTitle} booking`,
    body,
  });
}

/** A one-time come-back email to a traveller whose hold lapsed without them
 *  completing. Warm and low-pressure: their places are no longer held, but the
 *  trip is a click away. Links straight back to the booking form. */
export async function sendAbandonedRecovery(
  ctx: BookingEmailContext,
  links: { operatorSlug: string; tripSlug: string },
): Promise<{ ok: boolean; detail: string }> {
  const bookLink = links.operatorSlug && links.tripSlug
    ? `${PUBLIC_ORIGIN}/book/${links.operatorSlug}/${links.tripSlug}`
    : PUBLIC_ORIGIN;

  const body = [
    `Hi ${firstName(ctx.leadName)},`,
    ``,
    `You started booking ${ctx.tripTitle} with ${ctx.operatorName} but did not finish, so your places are no longer being held.`,
    ``,
    `If you would still like to travel, you can pick up where you left off here:`,
    bookLink,
    ``,
    `Places can go quickly, so it is worth booking soon. If you have any questions, just reply to this email.`,
    ``,
    `Hope to see you on the trip,`,
    ctx.operatorName,
  ].join('\n');

  return safeSend({
    to: ctx.leadEmail,
    replyTo: ctx.operatorReplyTo ?? undefined,
    subject: `Still thinking about ${ctx.tripTitle}?`,
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
