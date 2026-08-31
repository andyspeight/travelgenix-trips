// =============================================================================
//  /console/branding — how the public pages look
// =============================================================================
//  WeTravel-parity gap 9 (white-label), the branding slice. The operator's logo,
//  colour and font already dress every public page (trip, booking, registration,
//  review, confirmation) — those come from the client's brand record. The one
//  control that lives here is the white-label toggle: whether the small
//  "Powered by Travelgenix Trips" credit shows in the footer. Owner-only, like
//  the team and integrations: it is an account-level decision.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canManageTeam } from '@/lib/members';
import { readableOn } from '@/lib/colour';
import { operatorFont } from '@/lib/fonts';
import { BrandMast, PoweredBy } from '@/lib/brand-ui';
import { tripsDbConfigured } from '@/lib/supabase';
import { SignInPrompt, NoOperator, DbMissing } from '../states';
import { setPoweredByAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function BrandingPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const members = await listOperatorMembers(operator.id);
  const myRole = session.preview ? 'owner' : resolveOperatorRole(operator.contact_email, session.email, members);
  const canManage = canManageTeam(myRole);

  const accent = readableOn(operator.brand?.primaryColour, '#ffffff', '#0e6e5c');
  const font = operatorFont(operator.brand?.fontFamily);
  const hasLogo = Boolean(operator.brand?.logoUrl);

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team">Team</a>
        <a href="/console/integrations">Integrations</a>
        <a href="/console/branding" aria-current="page">Branding</a>
      </nav>

      <h1>Branding</h1>
      <p className="c-sub">
        Every page a traveller sees — the trip, the booking form, registration, the review and the
        confirmation — is dressed in {operator.name}’s logo, colour and font, so the whole journey feels
        like your own site. {hasLogo ? 'Your logo is set.' : 'Add a logo to your brand and it will show here as the masthead.'}
      </p>

      {font.href && <link rel="stylesheet" href={font.href} />}
      <div
        className="t-page"
        style={{ ['--op-accent' as string]: accent, ['--op-font' as string]: font.stack, border: '1px solid var(--c-line, #e3e7ea)', borderRadius: 12, overflow: 'hidden' }}
      >
        <BrandMast name={operator.name} logoUrl={operator.brand?.logoUrl} />
        <div style={{ padding: '20px 24px 8px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--op-muted)' }}>Preview</p>
          <p style={{ margin: '4px 0 0', fontWeight: 600, color: 'var(--op-accent)' }}>This is how your public pages are headed.</p>
        </div>
        <PoweredBy hidden={operator.hide_powered_by} />
      </div>

      {!canManage ? (
        <p className="c-note c-note--calm" style={{ marginTop: 20 }}>Only an owner can change the white-label setting.</p>
      ) : (
        <form action={setPoweredByAction} style={{ marginTop: 20 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="show" defaultChecked={!operator.hide_powered_by} style={{ marginTop: 3 }} />
            <span>
              <span style={{ fontWeight: 600 }}>Show a small “Powered by Travelgenix Trips” credit in the footer</span>
              <span className="c-hint" style={{ display: 'block', marginTop: 2 }}>
                Turn this off to remove every Travelgenix mark from your public pages. Custom domains are a separate step.
              </span>
            </span>
          </label>
          <div className="c-actions">
            <button className="c-btn c-btn--primary" type="submit">Save</button>
          </div>
        </form>
      )}
    </>
  );
}
