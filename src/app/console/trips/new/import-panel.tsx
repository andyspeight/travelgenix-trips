'use client';

// =============================================================================
//  Import from a brochure
// =============================================================================
//  The operator pastes an itinerary or brochure; the server drafts a trip with
//  AI and hands back the new draft's id, and we go straight to its editor for
//  review. Nothing is published; the draft is theirs to edit or delete. If AI
//  import is not switched on, the panel says so instead of failing obscurely.
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ImportPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      try {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.tripId) {
          router.push(`/console/trips/${body.tripId}`);
          return;
        }
        setError((body && body.message) || 'The import did not work. Please try again.');
      } catch {
        setError('The import did not work. Please try again.');
      }
    });
  }

  if (!open) {
    return (
      <div className="c-import-cta">
        <button type="button" className="c-btn" onClick={() => setOpen(true)}>
          Import from a brochure
        </button>
        <span className="c-hint">Paste an itinerary and let AI draft the trip for you.</span>
      </div>
    );
  }

  return (
    <div className="ce-section c-import">
      <p className="c-hint" style={{ marginTop: 0 }}>
        Paste the brochure or itinerary text below. The AI drafts the title, the day by day and the
        details for you to review. It extracts what is there and never invents prices or dates.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Paste the full itinerary here..."
        disabled={pending}
      />
      {error && <p className="c-err">{error}</p>}
      <div className="c-actions">
        <button type="button" className="c-btn c-btn--primary" onClick={submit} disabled={pending || text.trim().length < 120}>
          {pending ? 'Drafting your trip...' : 'Draft with AI'}
        </button>
        <button type="button" className="c-btn c-btn--quiet" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {pending && <p className="c-hint">This can take up to a minute for a long itinerary.</p>}
    </div>
  );
}
