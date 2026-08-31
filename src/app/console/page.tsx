// =============================================================================
//  /console — the trips list
// =============================================================================

import { getSession } from '@/lib/auth';
import { ensureOperator, listTrips, listOperatorMembers } from '@/lib/repo';
import { resolveOperatorRole, canEdit } from '@/lib/members';
import { tripsDbConfigured } from '@/lib/supabase';
import { SignInPrompt, NoOperator, DbMissing } from './states';

export const dynamic = 'force-dynamic';

export default async function ConsolePage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!tripsDbConfigured()) return <DbMissing />;

  // First visit for this agency creates their operator record. Keyed on the
  // client, so a colleague signing in lands on the same one.
  const operator = await ensureOperator(session);
  if (!operator) return <NoOperator />;

  const [trips, members] = await Promise.all([listTrips(operator.id), listOperatorMembers(operator.id)]);
  const role = session.preview ? 'owner' : resolveOperatorRole(operator.contact_email, session.email, members);
  const mayEdit = canEdit(role);

  return (
    <>
      <nav className="c-tabs">
        <a href="/console" aria-current="page">Trips</a>
        <a href="/console/bookings">Bookings</a>
        <a href="/console/reports">Reports</a>
        <a href="/console/team">Team</a>
        <a href="/console/integrations">Integrations</a>
      </nav>

      <h1>Trips</h1>
      <p className="c-sub">
        Everything {operator.name} has on sale, and everything still in draft.
      </p>

      {!mayEdit && (
        <p className="c-note c-note--calm">You have view-only access, so you can see trips and bookings but not change them.</p>
      )}

      {mayEdit && (
        <div className="c-actions" style={{ marginTop: 0, marginBottom: 26 }}>
          <a className="c-btn c-btn--primary" href="/console/trips/new">New trip</a>
        </div>
      )}

      {trips.length === 0 ? (
        <p className="c-empty">
          No trips yet. Create the first one and it appears here as a draft until you publish it.
        </p>
      ) : (
        <ul className="c-list">
          {trips.map((t) => (
            <li key={t.id}>
              <span className="c-name">
                <a href={`/console/trips/${t.id}`} style={{ color: 'inherit' }}>{t.title}</a>
              </span>
              <span className={`c-pill c-pill--${t.status}`}>{t.status}</span>
              <span className="c-meta">
                {t.kind === 'tour' ? 'Escorted tour' : 'Group trip'}
                {t.location ? ` · ${t.location}` : ''}
              </span>
              <span className="c-right">
                {t.status === 'published' ? (
                  <a className="c-btn" href={`/trip/${operator.slug}/${t.slug}`} target="_blank" rel="noreferrer">
                    View page
                  </a>
                ) : (
                  <a className="c-btn" href={`/trip/preview/${t.id}`} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                )}
                <a className="c-btn" href={`/console/trips/${t.id}/manage`}>Manage</a>
                <a className="c-btn" href={`/console/trips/${t.id}`}>Edit</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
