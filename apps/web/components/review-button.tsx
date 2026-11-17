'use client';

import { useRouter } from 'next/navigation';
import { ErrorSummary } from './feedback-banners';
import { useIntent } from './use-intent';

/** Marque la version courante du retour comme traitée et clôt le cas. Aucun message envoyé. */
export function MarkReviewedButton({ wid, aid, sid, expectedRevision, after }: { wid: string; aid: string; sid: string; expectedRevision: number; after: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ reviewedAt: string }>();

  async function review() {
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback/review`, { expectedRevision });
    if (done) {
      router.replace(after);
      router.refresh();
    }
  }

  const stale = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  return (
    <div className="stack">
      <ErrorSummary error={error} onRetry={() => void review()} />
      {stale ? <button type="button" className="link-btn" onClick={() => router.refresh()}>Afficher la nouvelle version du retour</button> : null}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => void review()} disabled={pending} aria-disabled={pending}>
          {pending ? 'Enregistrement…' : 'Marquer comme traité'}
        </button>
      </div>
    </div>
  );
}
