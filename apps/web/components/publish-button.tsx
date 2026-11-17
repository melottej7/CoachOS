'use client';

import { useRouter } from 'next/navigation';
import { ErrorSummary } from './feedback-banners';
import { useIntent } from './use-intent';

interface Props {
  wid: string;
  aid: string;
  sid: string;
  revision: number;
  label: string;
}

/** Publication explicite d’une révision précise. Désactivé pendant l’envoi (double clic). */
export function PublishButton({ wid, aid, sid, revision, label }: Props) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ items: { id: string; revision: number }[] }>();

  async function publish() {
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/publications`, {
      changes: [{ id: sid, revision }],
    });
    if (done) {
      router.replace(`/coach/${wid}/athletes/${aid}/workouts/${sid}?notice=published`);
      router.refresh();
    }
  }

  return (
    <div className="stack">
      <ErrorSummary error={error} onRetry={() => void publish()} retryLabel="Réessayer la publication" />
      {error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA' ? (
        <p>
          <button type="button" className="link-btn" onClick={() => router.refresh()}>Recharger la séance</button>
        </p>
      ) : null}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => void publish()} disabled={pending} aria-disabled={pending}>
          {pending ? 'Publication…' : label}
        </button>
      </div>
    </div>
  );
}
