import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatShortDate, formatWeekday, SPORT_LABELS, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio } from '@/server/repo/portfolio';
import { Avatar, Badge, Cluster, EmptyState, Heading, LinkButton, Stack, Text } from '@/design';
import s from '@/views/coach/calendar/calendar.module.css';

export const metadata = { title: 'À préparer' };

const short = (d: string) => `${formatWeekday(d).toLowerCase()} ${formatShortDate(d).replace(/\.$/, '')}`;

/** Élèves dont le programme est à préparer : aucune séance publiée sur les 7 prochains jours (refonte Chrono, D-146). */
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
  const today = todayIn(ctx.workspace.timeZone);
  // D-202 : la séance du jour seule, puis rien : on le dit tel quel.
  const next = (d: string) => (d === today ? 'séance aujourd’hui, rien ensuite' : `prochaine séance ${short(d)}`);
  return (
    <Stack gap={8}>
      <Stack gap={1}>
        <Heading level={1} size={1}>À préparer</Heading>
        <Text muted>Les élèves sans séance publiée sur les 7 jours qui suivent aujourd’hui, d’abord.</Text>
      </Stack>
      <Stack as="section" gap={3} aria-labelledby="todo-plan">
        <Cluster gap={2}><Heading level={2} size={4} id="todo-plan">Programme à préparer</Heading>{todo.length ? <Badge tone="signal">{todo.length} élève{todo.length > 1 ? 's' : ''}</Badge> : null}</Cluster>
        {todo.length ? (
          <ul className={s.rows}>
            {todo.map((a) => (
              <li key={a.id}>
                <Avatar name={a.name} size={40} />
                <span className={s.rowText}>
                  <Link className={s.rowTitle} href={`${base}/athletes/${a.id}`}>{a.name}</Link>
                  <span className={s.rowMeta}>{a.sport ? SPORT_LABELS[a.sport] : 'Sport non renseigné'}{a.teams.length ? ` · ${a.teams.map((t) => t.name).join(', ')}` : ''}{a.nextWorkout ? ` · ${next(a.nextWorkout)}` : ' · aucune séance à venir'}</span>
                </span>
                <Cluster gap={2}>
                  <LinkButton href={`${base}/library?pour=${a.id}`} size="sm">Depuis la bibliothèque</LinkButton>
                  <LinkButton href={`${base}/calendar?athlete=${a.id}`} size="sm" variant="primary">Préparer</LinkButton>
                </Cluster>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="check" title="Tout le monde est prêt">Chaque élève a des séances publiées pour les 7 prochains jours.</EmptyState>}
      </Stack>
      {later.length ? (
        <Stack as="section" gap={3} aria-labelledby="ok-plan">
          <Heading level={2} size={4} id="ok-plan">Programme en place</Heading>
          <ul className={s.rows}>
            {later.map((a) => (
              <li key={a.id}>
                <Avatar name={a.name} size={40} />
                <span className={s.rowText}>
                  <Link className={s.rowTitle} href={`${base}/athletes/${a.id}`}>{a.name}</Link>
                  <span className={s.rowMeta}>{a.upcoming7} séance{a.upcoming7 > 1 ? 's' : ''} publiée{a.upcoming7 > 1 ? 's' : ''} sur 7 jours{a.nextWorkout ? ` · prochaine ${short(a.nextWorkout)}` : ''}</span>
                </span>
                <LinkButton href={`${base}/calendar?athlete=${a.id}`} size="sm">Voir la semaine</LinkButton>
              </li>
            ))}
          </ul>
        </Stack>
      ) : null}
      {invited.length ? <Text size="sm" muted>{invited.length} élève{invited.length > 1 ? 's' : ''} invité{invited.length > 1 ? 's' : ''}, pas encore connecté{invited.length > 1 ? 's' : ''} : tu peux déjà préparer leurs séances.</Text> : null}
    </Stack>
  );
}
