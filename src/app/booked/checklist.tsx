'use client';

// =============================================================================
//  The traveller's checklist, on the confirmation hub
// =============================================================================
//  The operator's per-booking to-dos. The traveller ticks them off here; the
//  tick is saved through a reference-gated action, so a booking can only ever
//  change its own checklist. Optimistic: the box flips at once and rolls back if
//  the save fails.
// =============================================================================

import { useState, useTransition } from 'react';
import { setTaskDoneAction } from '../book/actions';
import type { ChecklistItem } from '@/lib/types';

export function Checklist({ reference, items }: { reference: string; items: ChecklistItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((t) => [t.id, t.done])),
  );
  const [, start] = useTransition();

  const doneCount = items.filter((t) => done[t.id]).length;

  function toggle(id: string) {
    const next = !done[id];
    setDone((d) => ({ ...d, [id]: next })); // optimistic
    start(async () => {
      const res = await setTaskDoneAction(reference, id, next);
      if (!res.ok) setDone((d) => ({ ...d, [id]: !next })); // roll back on failure
    });
  }

  return (
    <div className="bk-check">
      <div className="bk-check-head">
        <h2>Your checklist</h2>
        <span className="bk-check-prog">{doneCount} of {items.length} done</span>
      </div>
      <ul className="bk-check-list">
        {items.map((t) => {
          const isDone = !!done[t.id];
          const overdue = !isDone && t.due_date ? t.due_date < today() : false;
          return (
            <li key={t.id} className={`bk-check-item${isDone ? ' is-done' : ''}`}>
              <label>
                <input type="checkbox" checked={isDone} onChange={() => toggle(t.id)} />
                <span className="bk-check-main">
                  <span className="bk-check-label">{t.label}</span>
                  {t.detail && <span className="bk-check-detail">{t.detail}</span>}
                  {t.due_date && (
                    <span className={`bk-check-due${overdue ? ' is-overdue' : ''}`}>
                      {overdue ? 'Was due ' : 'Due by '}{humanDate(t.due_date)}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
