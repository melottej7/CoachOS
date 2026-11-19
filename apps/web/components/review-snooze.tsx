'use client';

import { useRouter } from 'next/navigation';
import { useIntent } from './use-intent';

// D-082 : reporter un retour. Il quitte la file et y revient seul à la date choisie (7 h, heure du coach).

export function ReviewSnooze({ wid, rid, choices, after }: { wid: string; rid: string; choices: { label: string; at: string }[]; after: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  return (
    <div className="review-snooze">
      <span className="muted">Pas maintenant ? Reporter à</span>
      {choices.map((c) => (
        <button key={c.label} type="button" className="btn small ghost" disabled={pending}
          onClick={async () => { if (await run('PATCH', `/api/v1/workspaces/${wid}/reviews/${rid}`, { state: 'snoozed', snoozeUntil: c.at })) router.push(after); }}>
          {c.label}
        </button>
      ))}
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</span> : null}
    </div>
  );
}
