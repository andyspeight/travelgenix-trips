'use server';

// The public "book a demo" form. Stores every request so nothing is lost even
// when the email seam is off, then best-effort notifies our own inbox. A hidden
// honeypot field defeats the simplest bots without a captcha. Never throws.

import { validateLead } from '@/lib/validate';
import { createLead } from '@/lib/repo';
import { sendEmail } from '@/lib/notify';
import { fail, type ActionState } from '@/lib/action-state';

const LEADS_INBOX = process.env.TRIPS_LEADS_EMAIL || '';

const BAND_LABEL: Record<string, string> = {
  'under-75k': 'Under £75k a year',
  '75k-400k': '£75k to £400k a year',
  'over-400k': 'Over £400k a year',
  'not-sure': 'Not sure yet',
};

export async function submitDemoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // Honeypot: a real person never fills the hidden "website" field. Pretend
  // success so a bot gets no signal, but store nothing.
  if (String(form.get('website') || '').trim() !== '') {
    return { ok: true, errors: {}, message: 'Thanks. We will be in touch shortly.' };
  }

  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') raw[k] = v;

  const { ok, errors, value } = validateLead(raw);
  if (!ok) return fail(errors, 'Please check the highlighted fields.');

  const lead = await createLead({ ...value, source: 'website' });
  if (!lead) return fail({}, 'Something went wrong sending that. Please try again, or email us directly.');

  // Best-effort internal notice. Never blocks or fails the submission.
  if (LEADS_INBOX) {
    const lines = [
      `New demo request from the Trips website.`,
      ``,
      `  Name     ${value.name}`,
      value.company ? `  Company  ${value.company}` : '',
      `  Email    ${value.email}`,
      value.phone ? `  Phone    ${value.phone}` : '',
      value.volume_band ? `  Volume   ${BAND_LABEL[value.volume_band] ?? value.volume_band}` : '',
      value.message ? `\n  Message\n  ${value.message}` : '',
    ].filter((l) => l !== '');
    await sendEmail({ to: LEADS_INBOX, subject: `Demo request: ${value.name}${value.company ? ` (${value.company})` : ''}`, body: lines.join('\n') });
  }

  return { ok: true, errors: {}, message: 'Thanks. We will be in touch shortly to set up your demo.' };
}
