import {
  deltaText, formatClock, formatKm, formatShortDate, SPORT_LABELS, STAT_DEFINITIONS, type PeriodDelta, type StatsSummary,
} from '@coachos/domain';
import { Cluster, DataTable, Disclosure, EmptyState, Eyebrow, Heading, KpiGrid, Meter, SegmentedLinks, Stack, Text, WeekBars, type KpiItem } from '@/design';
import s from './stats-panel.module.css';

// Panneau de statistiques (CE-S-01 à 04, CE-E-03, D-037), refonte Chrono (D-134) ; commun à l’élève et, plus tard, au coach.

const hours = (x: number) => (x ? formatClock(Math.round(x / 60) * 60) : '0 min');
const day = (d: string) => formatShortDate(d).replace(/\.$/, '');

function delta(value: number | null | undefined, unit: 'pts' | 'pct' | 'rpe', weeks: number): KpiItem['delta'] {
  const t = deltaText(value ?? null, unit);
  if (!t) return undefined;
  return { dir: t === 'stable' ? 'flat' : (value ?? 0) > 0 ? 'up' : 'down', text: `${t[0]!.toUpperCase()}${t.slice(1)} par rapport aux ${weeks} semaines d’avant` };
}

export function StatsPanel({ s: st, weeks, periodHref, you, delta: d }: { s: StatsSummary; weeks: number; periodHref: (w: number) => string; you: boolean; delta?: PeriodDelta }) {
  const any = st.weeks.some((w) => w.planned);
  return (
    <Stack gap={5}>
      <Cluster between gap={3}>
        <Heading level={2} size={4}>{you ? 'Tes entraînements' : 'Entraînements'}</Heading>
        <SegmentedLinks label="Période" items={[4, 8, 12].map((n) => ({ href: periodHref(n), label: `${n} sem.`, current: n === weeks }))} />
      </Cluster>
      <KpiGrid items={[
        { label: 'Régularité', value: st.completion === null ? '—' : `${st.completion} %`, meter: st.completion ?? 0,
          sub: `${st.done} séance${st.done > 1 ? 's' : ''} faite${st.done > 1 ? 's' : ''} sur ${st.due}${st.noFeedback ? ` · ${st.noFeedback} sans retour` : ''}`, delta: delta(d?.completionPts, 'pts', weeks) },
        { label: 'Volume réalisé', value: hours(st.doneSeconds), sub: `sur ${hours(st.plannedSeconds)} prévues`, delta: delta(d?.volumePct, 'pct', weeks) },
        { label: 'Distance', value: st.doneMeters ? formatKm(st.doneMeters) : '—', sub: st.plannedMeters ? `sur ${formatKm(st.plannedMeters)} prévus` : 'déclarée dans les retours', delta: delta(d?.distancePct, 'pct', weeks) },
        { label: 'Effort ressenti', value: st.avgRpe === null ? '—' : `${String(st.avgRpe).replace('.', ',')}/10`, sub: 'moyenne des retours', delta: delta(d?.rpeDiff, 'rpe', weeks) },
        { label: 'Série', value: `${st.streakWeeks} sem.`, sub: st.streakWeeks ? `${you ? 'tu t’entraînes' : 's’entraîne'} chaque semaine` : 'à relancer' },
        { label: 'Charge', value: st.load ? st.load.toLocaleString('fr-BE') : '—', sub: st.loadSessions ? `points sur ${st.loadSessions} séance${st.loadSessions > 1 ? 's' : ''} avec effort noté` : 'effort à noter dans les retours', delta: delta(d?.loadPct, 'pct', weeks) },
      ]} />

      {st.bySport.length > 1 ? (
        <Stack gap={2}>
          <Eyebrow>Volume réalisé par sport</Eyebrow>
          <ul className={s.sports}>
            {st.bySport.map((x) => (
              <li key={x.sport} className={s.sport}>
                <span>{SPORT_LABELS[x.sport]}</span>
                <Meter value={x.share} />
                <Text as="span" size="sm" tabular strong>{x.share} %</Text>
              </li>
            ))}
          </ul>
        </Stack>
      ) : null}

      {any ? (
        <Stack gap={5}>
          <WeekBars title={`Volume par semaine sur ${weeks} semaines : prévu et réalisé`} legend={{ track: 'Prévu', fill: 'Réalisé' }}
            bars={st.weeks.map((w) => ({
              key: w.monday, label: day(w.monday), track: Math.round(w.plannedSeconds / 60), fill: Math.round(w.doneSeconds / 60),
              detail: `Semaine du ${day(w.monday)} : ${hours(w.doneSeconds)} réalisées sur ${hours(w.plannedSeconds)} prévues · ${w.done} séance${w.done > 1 ? 's' : ''} faite${w.done > 1 ? 's' : ''} sur ${w.planned}`,
            }))} />
          {st.load ? (
            <WeekBars unit="points" title={`Charge d’entraînement par semaine sur ${weeks} semaines`} legend={{ fill: 'Charge (minutes × effort)' }}
              bars={st.weeks.map((w) => ({
                key: `load-${w.monday}`, label: day(w.monday), track: 0, fill: w.load,
                detail: `Semaine du ${day(w.monday)} : charge ${w.load.toLocaleString('fr-BE')}${w.avgRpe !== null ? ` · effort moyen ${String(w.avgRpe).replace('.', ',')}/10` : ''}`,
              }))} />
          ) : null}
          <Disclosure summary="Voir le tableau">
            <DataTable caption={`Détail par semaine sur ${weeks} semaines`} head={['Semaine du', 'Faites', 'Réalisé', 'Prévu', 'Distance', 'Charge']}
              rows={st.weeks.map((w) => ({ key: w.monday, cells: [day(w.monday), `${w.done} / ${w.planned}`, hours(w.doneSeconds), hours(w.plannedSeconds), w.doneMeters ? formatKm(w.doneMeters) : '—', w.load ? w.load.toLocaleString('fr-BE') : '—'] }))} />
          </Disclosure>
        </Stack>
      ) : <EmptyState icon="chart" title="Rien à mesurer sur cette période">Aucune séance publiée sur ces {weeks} semaines.</EmptyState>}

      <Disclosure summary="Comment sont calculés ces chiffres ?">
        <dl className={s.defs}>{STAT_DEFINITIONS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </Disclosure>
    </Stack>
  );
}
