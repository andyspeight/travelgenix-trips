// The three states the console can be in before it can show anything. Kept
// together so every entry point tells the same story in the same words.

export function SignInPrompt() {
  return (
    <>
      <h1>Sign in to continue</h1>
      <p className="c-sub">
        Trips uses your existing Travelgenix sign-in. There is no separate account here.
      </p>
      <a className="c-btn c-btn--primary" href="https://id.travelify.io/signin">
        Sign in
      </a>
    </>
  );
}

export function NoOperator() {
  return (
    <>
      <h1>Almost there</h1>
      <p className="c-note c-note--calm">
        You are signed in, but your sign-in is not attached to a company yet, so there is nothing
        to hang trips on. Ask us to link your account and this page will fill itself in.
      </p>
    </>
  );
}

export function DbMissing() {
  return (
    <>
      <h1>Not configured</h1>
      <p className="c-note c-note--bad">
        The Trips database is not wired up. Set TRIPS_SUPABASE_URL and
        TRIPS_SUPABASE_SERVICE_ROLE_KEY, then reload.
      </p>
    </>
  );
}
