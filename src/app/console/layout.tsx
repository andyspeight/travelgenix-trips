import './console.css';
import { getSession } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="c-shell">
      {session?.preview && (
        <div className="c-preview" role="status">
          Preview mode. You are reviewing as {' '}
          <strong>the first operator</strong>, not signed in. This never applies on
          the live trips.travelify.io domain.
        </div>
      )}
      <header className="c-bar">
        <a className="c-brand" href="/console" style={{ textDecoration: 'none', color: 'inherit' }}>
          Travelgenix Trips
        </a>
        {session && <span className="c-who">{session.preview ? 'Preview' : (session.clientName || session.email)}</span>}
      </header>
      {children}
    </div>
  );
}
