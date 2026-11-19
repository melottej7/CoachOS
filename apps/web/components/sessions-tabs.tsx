import Link from 'next/link';

/** Sous-onglets de « Séances » : semaine d’un élève, bibliothèque, séances de groupe, programmes à préparer. */
export function SessionsTabs({ wid, current, toPlan }: { wid: string; current: 'week' | 'library' | 'to-plan' | 'groups'; toPlan: number }) {
  const base = `/coach/${wid}`;
  return (
    <nav className="seg-tabs sessions-tabs" aria-label="Séances" data-tour="sessions-tabs">
      <Link href={`${base}/calendar`} aria-current={current === 'week' ? 'page' : undefined}>Semaine</Link>
      <Link href={`${base}/library`} aria-current={current === 'library' ? 'page' : undefined}>Bibliothèque</Link>
      <Link href={`${base}/group-sessions`} aria-current={current === 'groups' ? 'page' : undefined}>Groupes</Link>
      <Link href={`${base}/to-plan`} aria-current={current === 'to-plan' ? 'page' : undefined}>
        À préparer {toPlan ? <span className="count" aria-label={`${toPlan} élève${toPlan > 1 ? 's' : ''}`}>{toPlan}</span> : null}
      </Link>
    </nav>
  );
}

/** Élèves actifs sans séance publiée sur les 7 prochains jours. */
export function toPlanCount(roster: { state: string; upcoming7: number }[]): number {
  return roster.filter((a) => a.state === 'active' && !a.upcoming7).length;
}
