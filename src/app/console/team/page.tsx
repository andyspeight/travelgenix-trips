// =============================================================================
//  /console/team — who can do what
// =============================================================================
//  Team roles for one operator. Identity is tg-widgets SSO; this screen only
//  sets AUTHORISATION: owner, manager or viewer. Owner-only to manage. The
//  operator's own contact is always owner and shown as fixed, so a team can
//  never lock itself out.
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canManageTeam, ROLES } from '@/lib/members';
import { tripsDbConfigured } from '@/lib/supabase';
import { SignInPrompt, NoOperator, DbMissing } from '../states';
import { MemberForm } from '../forms';
import { setMemberRoleAction, removeMemberAction } from '../actions';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', viewer: 'Viewer' };

export default async function TeamPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const members = await listOperatorMembers(operator.id);
  const myRole = session.preview ? 'owner' : resolveOperatorRole(operator.contact_email, session.email, members);
  const canManage = canManageTeam(myRole);

  return (
    <>
      <nav className="c-tabs">
        <a href="/console">Trips</a>
        <a href="/console/bookings">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team" aria-current="page">Team</a>
      </nav>

      <h1>Team</h1>
      <p className="c-sub">
        Who can work on {operator.name} in this console, and what they can do. Owners manage the
        team and everything below it, managers edit trips and bookings, viewers can look but not change.
      </p>

      {!canManage && (
        <p className="c-note c-note--calm">
          You have {(ROLE_LABEL[myRole] ?? myRole).toLowerCase()} access. Only an owner can change the team.
        </p>
      )}

      <h2>People</h2>
      <ul className="c-list">
        <li>
          <span className="c-name">{operator.contact_email || 'The account owner'}</span>
          <span className="c-pill c-pill--published">Owner</span>
          <span className="c-meta">The account contact, always an owner.</span>
        </li>
        {members.map((m) => (
          <li key={m.id}>
            <span className="c-name">{m.email}</span>
            {canManage ? (
              <>
                <span className="c-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <form action={setMemberRoleAction} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="hidden" name="id" value={m.id} />
                    <select name="role" defaultValue={m.role} aria-label={`Role for ${m.email}`}>
                      {ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
                    </select>
                    <button className="c-btn c-btn--quiet" type="submit">Save</button>
                  </form>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="c-btn c-btn--quiet" type="submit">Remove</button>
                  </form>
                </span>
              </>
            ) : (
              <span className="c-pill c-pill--draft">{ROLE_LABEL[m.role] ?? m.role}</span>
            )}
          </li>
        ))}
      </ul>

      {members.length === 0 && (
        <p className="c-empty">
          No teammates yet. While the team is empty, everyone on {operator.name}’s account has full access.
          Add someone to start setting roles.
        </p>
      )}

      {canManage && (
        <>
          <h2 style={{ fontSize: '1rem' }}>Add a teammate</h2>
          <p className="c-sub" style={{ marginTop: '-6px' }}>
            Use the email they sign in with. Adding the first teammate turns roles on: from then on,
            anyone not listed here is view-only.
          </p>
          <MemberForm />
        </>
      )}
    </>
  );
}
