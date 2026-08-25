import { getSession } from '@/lib/auth';
import { ensureOperator } from '@/lib/repo';
import { TripForm } from '../../forms';
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
        The basics now, the dates next. Nothing is public until you publish it.
      </p>
      <TripForm />
    </>
  );
}
