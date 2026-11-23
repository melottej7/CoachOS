import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatShortDate, formatWeekday, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio } from '@/server/repo/portfolio';
import { Pill, initials } from '@/components/ui';

export const metadata = { title: 'À préparer' };

const short = (d: string) => `${formatWeekday(d).toLowerCase()} ${formatShortDate(d).replace(/\.$/, '')}`;

/** Élèves dont le programme est à préparer : aucune séance publiée sur les 7 prochains jours. */
export default async function ToPlan({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const { roster } = await portfolio(actor.userId, wid, ctx.workspace.timeZone);
  const base = `/coach/${wid}`;
  const todo = roster.filter((a) => a.state === 'active' && !a.upcoming7);
  const later = roster.filter((a) => a.state === 'active' && a.upcoming7 > 0).sort((a, b) => (a.nextWorkout ?? '').localeCompare(b.nextWorkout ?? ''));
  const invited = roster.filter((a) => a.state === 'invited');
  return (
    <>
      <div className="head"><div><div className="kicker">Séances</div><h1>À préparer</h1>
        <p className="sub">Les élèves sans séance publiée sur les 7 prochains jours, d’abord.</p></div></div>
      <section className="card" aria-labelledby="todo-plan">
        <div className="card-head"><h2 id="todo-plan">Programme à préparer</h2><span className="muted">{todo.length} élève{todo.length > 1 ? 's' : ''}</span></div>
        {todo.length ? todo.map((a) => (
          <div className="row" key={a.id}>
            <span className="avatar" aria-hidden="true">{initials(a.name)}</span>
            <div className="row-text">
              <h3><Link href={`${base}/athletes/${a.id}`}>{a.name}</Link> <Pill tone="attn">Rien de publié sur 7 jours</Pill></h3>
              <p>{a.sport ? SPORT_LABELS[a.sport] : 'Sport non renseigné'}{a.teams.length ? ` · ${a.teams.map((t) => t.name).join(', ')}` : ''}{a.nextWorkout ? ` · prochaine séance ${short(a.nextWorkout)}` : ' · aucune séance à venir'}</p>
            </div>
            <span className="actions">
              <Link className="btn" href={`${base}/library?pour=${a.id}`}>Depuis la bibliothèque</Link>
              <Link className="btn primary" href={`${base}/calendar?athlete=${a.id}`}>Préparer</Link>
            </span>
          </div>
        )) : <p className="empty">Tout le monde a des séances publiées pour les 7 prochains jours. 👏</p>}
      </section>
      {later.length ? (
        <section className="card" aria-labelledby="ok-plan">
          <div className="card-head"><h2 id="ok-plan">Programme en place</h2></div>
          {later.map((a) => (
            <div className="row" key={a.id}>
              <span className="avatar" aria-hidden="true">{initials(a.name)}</span>
              <div className="row-text"><h3><Link href={`${base}/athletes/${a.id}`}>{a.name}</Link></h3>
                <p>{a.upcoming7} séance{a.upcoming7 > 1 ? 's' : ''} publiée{a.upcoming7 > 1 ? 's' : ''} sur 7 jours{a.nextWorkout ? ` · prochaine ${short(a.nextWorkout)}` : ''}</p></div>
              <Link className="btn" href={`${base}/calendar?athlete=${a.id}`}>Voir la semaine</Link>
            </div>
          ))}
        </section>
      ) : null}
      {invited.length ? <p className="muted">{invited.length} élève{invited.length > 1 ? 's' : ''} invité{invited.length > 1 ? 's' : ''}, pas encore connecté{invited.length > 1 ? 's' : ''} : tu peux déjà préparer leurs séances.</p> : null}
    </>
  );
}
