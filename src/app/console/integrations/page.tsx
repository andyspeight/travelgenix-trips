// =============================================================================
//  /console/integrations — outbound webhooks
// =============================================================================
//  WeTravel-parity gap 10. An operator wires Trips into their own systems: on a
//  new booking or a status change, Trips POSTs a signed JSON event to each
//  endpoint they register here. The same primitive a future Zapier app consumes.
//  Owner-only, like the team: connecting the account to the outside world is an
//  account-level decision, not a per-trip one.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listWebhooks, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canManageTeam } from '@/lib/members';
import { redactSecret } from '@/lib/webhooks';
import { tripsDbConfigured } from '@/lib/supabase';
import { SignInPrompt, NoOperator, DbMissing } from '../states';
import { WebhooksManager, type WebhookRow } from './webhooks-manager';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const myRole = session.preview ? 'owner' : resolveOperatorRole(operator.contact_email, session.email, await import('@/lib/repo').then((m) => m.listOperatorMembers(operator.id)));
  const canManage = canManageTeam(myRole);

  const rows: WebhookRow[] = canManage
    ? (await listWebhooks(operator.id)).map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
        last_status: w.last_status,
        last_at: w.last_at,
        secretRedacted: redactSecret(w.secret),
      }))
    : [];

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team">Team</a>
        <a href="/console/integrations" aria-current="page">Integrations</a>
      </nav>

      <h1>Integrations</h1>
      <p className="c-sub">
        Send {operator.name}’s bookings into your own systems in real time. Register an https endpoint and
        Trips will POST a signed event whenever a booking is created or its status changes. Every delivery
        carries an <code className="c-mono">x-tg-signature</code> header you verify with the endpoint’s secret.
      </p>

      {!canManage ? (
        <p className="c-note c-note--calm">Only an owner can manage integrations.</p>
      ) : (
        <WebhooksManager initial={rows} />
      )}
    </>
  );
}
