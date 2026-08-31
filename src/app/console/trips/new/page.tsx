import { getSession } from '@/lib/auth';
import { ensureOperator } from '@/lib/repo';
import { TripForm } from '../../forms';
import { ImportPanel } from './import-panel';
import { SignInPrompt, NoOperator } from '../../states';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const session = await getSession();
  if (!session) return <SignInPrompt />;
  if (!(await ensureOperator(session))) return <NoOperator />;

  return (
    <>
      <h1>New trip</h1>
      <p className="c-sub">
        The basics now, the dates next. Nothing is public until you publish it. Already have a
        brochure? Import it and start from a draft.
      </p>

      <ImportPanel />

      <h2 style={{ fontSize: '1rem', marginTop: 28 }}>Or start from scratch</h2>
      <TripForm />
    </>
  );
}
