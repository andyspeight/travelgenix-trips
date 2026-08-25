import './console.css';
import { getSession } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="c-shell">
      <header className="c-bar">
        <a className="c-brand" href="/console" style={{ textDecoration: 'none', color: 'inherit' }}>
          Travelgenix Trips
        </a>
        {session && <span className="c-who">{session.clientName || session.email}</span>}
      </header>
      {children}
    </div>
  );
}
