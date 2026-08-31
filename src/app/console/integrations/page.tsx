// =============================================================================
//  /console/integrations — webhooks and API keys
// =============================================================================
//  WeTravel-parity gap 10. An operator wires Trips into their own systems two
//  ways: outbound WEBHOOKS push a signed event on each booking change, and API
//  KEYS let a partner system pull bookings and push trips in through the v1 API.
//  Owner-only, like the team: connecting the account to the outside world is an
//  account-level decision, not a per-trip one.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listWebhooks, listApiKeys, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canManageTeam } from '@/lib/members';
import { redactSecret } from '@/lib/webhooks';
import { tripsDbConfigured } from '@/lib/supabase';
import { SignInPrompt, NoOperator, DbMissing } from '../states';
import { WebhooksManager, type WebhookRow } from './webhooks-manager';
import { ApiKeysManager, type ApiKeyRow } from './api-keys-manager';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const members = await listOperatorMembers(operator.id);
  const myRole = session.preview ? 'owner' : resolveOperatorRole(operator.contact_email, session.email, members);
  const canManage = canManageTeam(myRole);

  const webhookRows: WebhookRow[] = canManage
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

  const keyRows: ApiKeyRow[] = canManage
    ? (await listApiKeys(operator.id)).map((k) => ({
        id: k.id,
        key_prefix: k.key_prefix,
        name: k.name,
        last_used_at: k.last_used_at,
        revoked_at: k.revoked_at,
        created_at: k.created_at,
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
        <a href="/console/branding">Branding</a>
      </nav>

      <h1>Integrations</h1>
      <p className="c-sub">
        Connect {operator.name} to your own systems. Webhooks push a signed event the moment a booking changes;
        API keys let your systems read bookings and push trips in through the API.
      </p>

      {!canManage ? (
        <p className="c-note c-note--calm">Only an owner can manage integrations.</p>
      ) : (
        <>
          <h2>Webhooks</h2>
          <p className="c-sub" style={{ marginTop: '-6px' }}>
            Register an https endpoint and Trips will POST a signed event whenever a booking is created or its status
            changes. Every delivery carries an <code className="c-mono">x-tg-signature</code> header you verify with the
            endpoint’s secret.
          </p>
          <WebhooksManager initial={webhookRows} />

          <h2 style={{ marginTop: 32 }}>API keys</h2>
          <p className="c-sub" style={{ marginTop: '-6px' }}>
            Use a key as a <code className="c-mono">Authorization: Bearer</code> token against the API at
            {' '}<code className="c-mono">/api/v1</code>: <code className="c-mono">GET /api/v1/bookings</code> lists your
            bookings, <code className="c-mono">GET /api/v1/bookings/&#123;reference&#125;</code> reads one, and
            {' '}<code className="c-mono">POST /api/v1/trips</code> creates a draft trip. Keys act for {operator.name} only.
          </p>
          <ApiKeysManager initial={keyRows} />
        </>
      )}
    </>
  );
}
