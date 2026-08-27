// =============================================================================
//  lib/auth.ts
// =============================================================================
//
//  One identity for the whole estate. Trips does NOT issue its own login: it
//  asks tg-widgets who is signed in, over the existing cookie SSO.
//
//  THE CONSTRAINT THAT DECIDES OUR DOMAIN. The session cookie is `tg_session`
//  and it is set on `.travelify.io` for cross-subdomain SSO. So this app must be
//  served from a *.travelify.io host (trips.travelify.io) or the browser will
//  simply not send it and every visitor looks signed out. That is not a branding
//  preference, it is why the domain choice is what it is. An operator custom
//  domain therefore only ever serves PUBLIC trip pages, never the console.
//
//  Never set a manual Authorization header here. tg-widgets prefers a Bearer
//  token over the cookie, and a stale token silently outranking the live session
//  is exactly the act-as bug fixed on 2 Aug 2026. Forward the cookie, nothing
//  else.
//
// =============================================================================

import 'server-only';
import { cookies, headers } from 'next/headers';

const TG_ORIGIN = (process.env.TG_WIDGETS_ORIGIN || 'https://tg-widgets.vercel.app').replace(/\/+$/, '');
const SESSION_COOKIE = 'tg_session';

export interface Session {
  userRecordId: string;
  email: string;
  role: string;
  clientRecordId: string | null;
  clientName: string;
  plan: string;
  /** True for the review escape hatch (see getSession). Never set on a
   *  production *.travelify.io host. */
  preview?: boolean;
}

// -----------------------------------------------------------------------------
//  PREVIEW MODE — a review escape hatch, structurally safe.
//
//  The console cannot authenticate on a *.vercel.app host, because the
//  tg_session sign-in cookie is scoped to .travelify.io and the browser never
//  sends it anywhere else. Until trips.travelify.io exists, that leaves the team
//  unable to review the console at all.
//
//  So on a NON-production host only, getSession returns a preview session that
//  acts as the first operator. It is safe because:
//    - It NEVER applies on a *.travelify.io host. There, real sign-in always
//      runs, so preview cannot reach the production console. This is structural,
//      not a flag that could be left on.
//    - The only non-production host that serves this app is the *.vercel.app
//      deployment, which Vercel Authentication already restricts to the
//      Travelgenix team. Preview therefore never widens who can reach it.
//
//  The ONE thing not to do while this exists: turn OFF Vercel deployment
//  protection on the .vercel.app URLs. Remove this whole block at go-live once
//  trips.travelify.io is live. Tracked in the handover.
// -----------------------------------------------------------------------------

function isPreviewHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase().split(':')[0] ?? '';
  // Any real Travelgenix domain gets real auth, no exceptions.
  if (h === 'travelify.io' || h.endsWith('.travelify.io')) return false;
  return h.endsWith('.vercel.app') || h === 'localhost' || h === '127.0.0.1';
}

interface MeResponse {
  user?: { recordId?: string; email?: string; role?: string };
  client?: { recordId?: string; clientName?: string; plan?: string };
}

/**
 * Who is signed in, or null. Never throws: an unreachable auth service reads as
 * signed out, which fails closed.
 */
export async function getSession(): Promise<Session | null> {
  const host = (await headers()).get('host');
  if (isPreviewHost(host)) {
    return {
      userRecordId: 'preview',
      email: 'preview@travelgenix',
      role: 'admin',
      clientRecordId: null,
      clientName: 'Preview',
      plan: '',
      preview: true,
    };
  }

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${TG_ORIGIN}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const body = (await res.json()) as MeResponse;
    if (!body?.user?.recordId) return null;

    return {
      userRecordId: body.user.recordId,
      email: body.user.email || '',
      role: body.user.role || '',
      clientRecordId: body.client?.recordId || null,
      clientName: body.client?.clientName || '',
      plan: body.client?.plan || '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The operator the signed-in user acts for, or null.
 *
 * A trip belongs to an OPERATOR, and an operator is keyed to the client record,
 * never to the email of whoever happened to build it. That is the ownership bug
 * fixed across 65 widgets on 2 Aug 2026 and it must not come back here.
 */
export async function getOperatorId(session: Session | null): Promise<string | null> {
  if (!session) return null;

  const { sbRequest } = await import('./supabase');

  if (session.preview) {
    const rows = await sbRequest<Array<{ id: string }>>(
      'gt_operators?select=id&order=created_at.asc&limit=1',
    ).catch(() => null);
    return rows?.[0]?.id ?? null;
  }

  if (!session.clientRecordId) return null;
  const rows = await sbRequest<Array<{ id: string }>>(
    `gt_operators?client_record_id=eq.${encodeURIComponent(session.clientRecordId)}&select=id&limit=1`,
  ).catch(() => null);

  return rows?.[0]?.id ?? null;
}

/** Fails closed: no session, or a session with no operator, owns nothing. */
export async function requireOperator(): Promise<{ session: Session; operatorId: string } | null> {
  const session = await getSession();
  if (!session) return null;
  const operatorId = await getOperatorId(session);
  if (!operatorId) return null;
  return { session, operatorId };
}
