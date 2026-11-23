import { notFound } from 'next/navigation';
import {
  addDays, daysUntil, equivalents, formatDuration2, formatLongDate, loadProgress, PERFORMANCE_KIND_LABELS, SPORT_LABELS, todayIn, weekStart,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { athleteStats, strengthHistory } from '@/server/repo/stats';
import { readPerformances } from '@/server/commands/performances';
import { Card, Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { StatsPanel } from '@/views/stats/stats-panel';
import { LoadProgress } from '@/views/stats/load-progress';
import s from './progress.module.css';

export const metadata = { title: 'Progression' };

const km = (m: number) => (m < 1000 ? `${m} m` : `${String(Math.round(m / 100) / 10).replace('.', ',')} km`);

/** CE-E-03 · Progression (refonte Chrono, D-134) : objectif, régularité et volumes, charges, résultats de référence. */
export default async function Progress({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { wid } = await params;
  const { periode } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const aid = ctx.athlete.id;
  const today = todayIn(ctx.athlete.timeZone);
  const weeks = [4, 8, 12].includes(Number(periode)) ? Number(periode) : 8;
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const to = addDays(weekStart(today), 6);
  const [data, history, results] = await Promise.all([
    athleteStats(actor.userId, wid, aid, from, to, today),
    strengthHistory(actor.userId, wid, aid),
    readPerformances(actor.userId, wid, aid),
  ]);
  if (!data) notFound();
  const loads = loadProgress(history);
  const { goal } = data;
  const left = goal?.targetDate ? daysUntil(today, goal.targetDate) : null;

  return (
    <Stack gap={8}>
      <Stack gap={1}>
        <Eyebrow tone="coach">Progression</Eyebrow>
        <Heading level={1} size={1}>Ta progression</Heading>
      </Stack>

      {goal ? (
        <Card tinted pad={5} as="section" aria-label="Ton objectif">
          <div className={s.goal}>
            <Stack gap={1}>
              <Eyebrow tone="coach">Ton objectif · {SPORT_LABELS[goal.sport]}</Eyebrow>
              <Heading level={2} size={3}>{goal.title}</Heading>
              <Text size="sm" muted>
                {left === null ? 'Pas encore de date fixée.' : `${formatLongDate(goal.targetDate!)}${left > 7 ? ` · encore ${Math.floor(left / 7)} semaine${Math.floor(left / 7) > 1 ? 's' : ''}` : ''}`}
              </Text>
            </Stack>
            {left !== null ? <p className={s.count}>{left > 0 ? `J-${left}` : left === 0 ? 'Jour J' : 'Passé'}</p> : null}
          </div>
        </Card>
      ) : (
        <Card pad={5} as="section" aria-label="Ton objectif">
          <Cluster between gap={3}>
            <Stack gap={1}>
              <Heading level={2} size={4}>Pas encore d’objectif</Heading>
              <Text size="sm" muted>Fixe-le avec ton coach : tout ton programme s’organise autour.</Text>
            </Stack>
            <LinkButton href={`/athlete/${wid}/messages/coach`} icon="chat">En parler</LinkButton>
          </Cluster>
        </Card>
      )}

      <StatsPanel s={data.summary} delta={data.delta} weeks={weeks} periodHref={(n) => `/athlete/${wid}/progress?periode=${n}`} you />

      {loads.length ? (
        <Stack as="section" gap={3} aria-labelledby="mes-charges">
          <Stack gap={1}>
            <Heading level={2} size={4} id="mes-charges">Tes charges</Heading>
            <Text size="sm" muted>D’après tes retours de renforcement.</Text>
          </Stack>
          <LoadProgress series={loads} you />
        </Stack>
      ) : null}

      {results.length ? (
        <Stack as="section" gap={3} aria-labelledby="mes-resultats">
          <Heading level={2} size={4} id="mes-resultats">Tes résultats de référence</Heading>
          <ul className={s.results}>
            {results.map((r) => {
              const eq = equivalents(r);
              return (
                <li key={r.id} className={s.result}>
                  <span className={s.resultText}>
                    <strong>{r.name ?? PERFORMANCE_KIND_LABELS[r.kind]}</strong>
                    <Text as="span" size="sm" muted>{km(r.distanceM)} · {formatLongDate(r.doneOn).toLowerCase()}</Text>
                    {eq.length ? <Text as="span" size="sm" muted>Équivalences : {eq.map((e) => `${e.label} ${formatDuration2(e.seconds)}`).join(' · ')}</Text> : null}
                  </span>
                  <span className={s.time}>{formatDuration2(r.durationS)}</span>
                </li>
              );
            })}
          </ul>
        </Stack>
      ) : null}
    </Stack>
  );
}
