import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, formatShortDate, formatWeekday, isLocalDate, RESULT_STATE_LABELS, todayIn, weekStart, type ResultState } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamWeek, type TeamWeekItem } from '@/server/repo/group-sessions';

export const metadata = { title: 'Semaine du groupe' };

const day = (d: string) => formatShortDate(d).replace(/\.$/, '');

function Cell({ it, href }: { it: TeamWeekItem; href: string }) {
  const tag = it.canceled ? 'Annulée'
    : it.result ? RESULT_STATE_LABELS[it.result as ResultState]
    : it.status === 'draft' ? 'Brouillon' : it.status === 'changed' ? 'Modifiée, non republiée' : 'Publiée';
  const tone = it.canceled || it.status !== 'published' ? 'attn' : it.result === 'completed' ? 'ok' : it.result === 'missed' ? 'miss' : '';
  return (
    <Link href={href} className={`tw-item ${tone}`}>
      <span className="tw-title">{it.groupSessionId ? '👥 ' : ''}{it.title}</span>
      <span className="tw-tag">{tag}</span>
    </Link>
  );
}

/** CE-G2-03 : la semaine d’un groupe avec l’état de chaque élève. */
export default async function TeamWeek({ params, searchParams }: { params: Promise<{ wid: string; tid: string }>; searchParams: Promise<{ semaine?: string }> }) {
  const { wid, tid } = await params;
  const { semaine } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const today = todayIn(ctx.workspace.timeZone);
  const monday = weekStart(semaine && isLocalDate(semaine) ? semaine : today);
  const days = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
  const w = await teamWeek(actor.userId, wid, tid, monday, days[6]!);
  if (!w) notFound();
  const base = `/coach/${wid}`;
  const here = `${base}/groups/${tid}/week`;
  const published = w.items.filter((i) => i.status === 'published' && !i.canceled).length;
  const drafts = w.items.filter((i) => i.status !== 'published').length;
  const without = w.members.filter((m) => !w.items.some((i) => i.athleteId === m.id && !i.canceled));
  return (
    <>
      <Link className="back" href={`${base}/group-sessions`}>← Séances de groupe</Link>
      <div className="head">
        <div><div className="kicker">Groupe · {w.name}</div><h1>Semaine du {day(monday)}</h1>
          <p className="sub">{published} séance{published > 1 ? 's' : ''} publiée{published > 1 ? 's' : ''} · {drafts} brouillon{drafts > 1 ? 's' : ''} ou modification{drafts > 1 ? 's' : ''} à publier{without.length ? ` · sans séance : ${without.map((m) => m.name.split(' ')[0]).join(', ')}` : ''}</p></div>
        <span className="actions">
          <Link className="btn small" href={`${here}?semaine=${addDays(monday, -7)}`} aria-label="Semaine précédente">‹ Précédente</Link>
          {monday !== weekStart(today) ? <Link className="btn small" href={here}>Cette semaine</Link> : null}
          <Link className="btn small" href={`${here}?semaine=${addDays(monday, 7)}`} aria-label="Semaine suivante">Suivante ›</Link>
          <Link className="btn small primary" href={`${base}/groups/${tid}/sessions/new?date=${days.find((d) => d >= today) ?? monday}`}>📅 Séance pour le groupe</Link>
        </span>
      </div>
      {w.members.length ? (
        <div className="tw-frame">
          <table className="tw">
            <caption className="visually-hidden">Séances du groupe {w.name}, semaine du {day(monday)}, par élève et par jour</caption>
            <thead>
              <tr><th scope="col">Élève</th>{days.map((d) => <th key={d} scope="col" className={d === today ? 'today' : undefined}>{formatWeekday(d).slice(0, 3)} {day(d)}</th>)}</tr>
            </thead>
            <tbody>
              {w.members.map((m) => (
                <tr key={m.id}>
                  <th scope="row"><Link href={`${base}/athletes/${m.id}`}>{m.name}</Link>{m.state === 'invited' ? <span className="muted"> · invité·e</span> : null}</th>
                  {days.map((d) => {
                    const list = w.items.filter((i) => i.athleteId === m.id && i.localDate === d);
                    return (
                      <td key={d} className={d === today ? 'today' : undefined}>
                        {list.map((it) => <Cell key={it.id} it={it} href={it.groupSessionId && it.status !== 'published' ? `${base}/groups/${tid}/sessions/${it.groupSessionId}` : `${base}/athletes/${m.id}/workouts/${it.id}`} />)}
                        {!list.length ? <span className="tw-empty" aria-label="Aucune séance">·</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty">Ce groupe n’a pas encore d’élève que tu suis.</p>}
      <p className="muted foot-note">👥 = séance créée pour le groupe. Un brouillon de groupe ouvre la séance de groupe pour l’adapter ou la publier.</p>
    </>
  );
}
