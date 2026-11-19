import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, daysUntil, formatLongDate, SPORT_LABELS, todayIn, weekStart, equivalents, formatDuration2, PERFORMANCE_KIND_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { athleteStats } from '@/server/repo/stats';
import { StatsPanel } from '@/components/stats-panel';
import { readPerformances } from '@/server/commands/performances';

export const metadata = { title: 'Progression' };

/** CE-E-03 : objectif, régularité et volumes de l’élève, sur les séances publiées par son coach. */
export default async function Progress({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { wid } = await params;
  const { periode } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.athlete.timeZone);
  const weeks = [4, 8, 12].includes(Number(periode)) ? Number(periode) : 8;
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const to = addDays(weekStart(today), 6);
  const data = await athleteStats(actor.userId, wid, ctx.athlete.id, from, to, today);
  if (!data) notFound();
  const { summary: s, goal } = data;
  const results = await readPerformances(actor.userId, wid, ctx.athlete.id);
  const left = goal?.targetDate ? daysUntil(today, goal.targetDate) : null;
  return (
    <>
      <div className="kicker">Progression</div>
      <h1>Ta progression</h1>
      {goal ? (
        <section className="goal-card" aria-label="Ton objectif">
          <p className="muted">Ton objectif · {SPORT_LABELS[goal.sport]}</p>
          <p><strong>{goal.title}</strong></p>
          {left !== null ? (
            <>
              <p className="goal-count">{left > 0 ? `J-${left}` : left === 0 ? 'C’est aujourd’hui !' : 'Échéance passée'}</p>
              <p className="muted">{formatLongDate(goal.targetDate!)}{left > 7 ? ` · encore ${Math.floor(left / 7)} semaine${Math.floor(left / 7) > 1 ? 's' : ''}` : ''}</p>
            </>
          ) : <p className="muted">Pas encore de date fixée.</p>}
        </section>
      ) : (
        <p className="muted">Pas encore d’objectif fixé avec ton coach. <Link href={`/athlete/${wid}/messages/coach`}>Parlez-en ensemble</Link>.</p>
      )}
      <section className="card" aria-label="Tes entraînements">
        <StatsPanel s={s} delta={data.delta} weeks={weeks} periodHref={(n) => `/athlete/${wid}/progress?periode=${n}`} you />
      </section>
      {results.length ? (
        <section className="card" aria-labelledby="mes-resultats" style={{ marginTop: 16 }}>
          <div className="card-head"><h2 id="mes-resultats">Tes résultats de référence</h2></div>
          <ul className="plain perf-list card-body">
            {results.map((r) => {
              const eq = equivalents(r);
              return (
                <li key={r.id} className="perf">
                  <span className="perf-head"><strong>{r.name ?? PERFORMANCE_KIND_LABELS[r.kind]}</strong><span className="muted"> · {formatLongDate(r.doneOn).toLowerCase()}</span></span>
                  <span>{r.distanceM < 1000 ? `${r.distanceM} m` : `${String(Math.round(r.distanceM / 100) / 10).replace('.', ',')} km`} en <strong>{formatDuration2(r.durationS)}</strong></span>
                  {eq.length ? <span className="muted perf-eq">Équivalences : {eq.map((e) => `${e.label} ${formatDuration2(e.seconds)}`).join(' · ')}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
