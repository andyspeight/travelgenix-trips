'use client';

// =============================================================================
//  The review form
// =============================================================================
//  A star rating, an optional title, and the review. Controlled inputs so a
//  validation error never wipes what the traveller wrote, exactly like the
//  booking and registration forms. Submitted to submitReviewAction, which is
//  reference-gated on the server.
// =============================================================================

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitReviewAction } from './actions';
import { EMPTY_STATE } from '@/lib/action-state';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" className="bk-cta" disabled={pending}>{pending ? 'Sending...' : 'Send review'}</button>;
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="rv-stars" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`rv-star${n <= shown ? ' rv-star--on' : ''}`}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z"
              fill={n <= shown ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({ reference, defaultName }: { reference: string; defaultName: string }) {
  const [state, action] = useActionState(submitReviewAction, EMPTY_STATE);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const e = state.errors;

  if (state.ok && state.message) {
    return (
      <div className="bk-reg-done">
        <p>{state.message}</p>
        <a className="bk-cta bk-cta--ghost" href={`/booked/${reference}`}>Back to your booking</a>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="bk-form">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="rating" value={rating || ''} />
      {state.message && !state.ok && <p className="bk-alert" role="alert">{state.message}</p>}

      <div className={`bk-field${e.rating ? ' bk-bad' : ''}`}>
        <span>Your rating</span>
        <Stars value={rating} onChange={setRating} />
        {e.rating && <p className="bk-err">{e.rating}</p>}
      </div>

      <label className={`bk-field${e.reviewer_name ? ' bk-bad' : ''}`}>
        <span>Your name</span>
        <input name="reviewer_name" autoComplete="name" value={name} onChange={(ev) => setName(ev.target.value)} />
        {e.reviewer_name && <p className="bk-err">{e.reviewer_name}</p>}
      </label>

      <label className="bk-field">
        <span>Headline <em>(optional)</em></span>
        <input name="title" value={title} maxLength={160} placeholder="A trip of a lifetime" onChange={(ev) => setTitle(ev.target.value)} />
      </label>

      <label className={`bk-field${e.body ? ' bk-bad' : ''}`}>
        <span>Your review</span>
        <textarea name="body" rows={5} value={body} maxLength={2000}
          placeholder="What did you enjoy? What would you tell a friend thinking of booking?"
          onChange={(ev) => setBody(ev.target.value)} />
        {e.body && <p className="bk-err">{e.body}</p>}
      </label>

      <Submit />
      <p className="bk-note">Your review is checked before it appears. Be honest and kind.</p>
    </form>
  );
}
