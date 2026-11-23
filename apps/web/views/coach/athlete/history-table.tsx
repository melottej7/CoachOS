import Link from 'next/link';
import { formatClock, formatKm, formatShortDate, formatWeekday, RESULT_STATE_LABELS } from '@coachos/domain';
import type { HistoryRow } from '@/server/repo/stats';
import { DataTable, Disclosure, Text } from '@/design';

// D-052, refonte Chrono (D-151) : historique séance par séance, prévu et réalisé côte à côte (fiche élève du coach).

const dur = (x: number | null) => (x ? formatClock(Math.round(x / 60) * 60) : '—');

export function HistoryTable({ rows, href, weeks }: { rows: HistoryRow[]; href: (workoutId: string) => string; weeks: number }) {
  if (!rows.length) return <Text muted>Aucune séance publiée passée sur les {weeks} dernières semaines.</Text>;
  return (
    <Disclosure summary={`Séance par séance (${rows.length})`} open={rows.length <= 8}>
      <DataTable caption="Séances publiées passées, la plus récente d’abord : prévu et réalisé" head={['Date', 'Séance', 'Prévu', 'Réalisé', 'Effort']}
        rows={rows.map((r) => ({
          key: r.workoutId,
          cells: [
            `${formatWeekday(r.localDate).slice(0, 3)} ${formatShortDate(r.localDate)}`,
            <Link key="l" href={href(r.workoutId)}>{r.title}</Link>,
            r.canceled ? 'Annulée' : [dur(r.plannedSeconds), r.plannedMeters ? formatKm(r.plannedMeters) : null].filter(Boolean).join(' · '),
            r.canceled ? '—' : r.state ? [RESULT_STATE_LABELS[r.state], r.doneSeconds ? dur(r.doneSeconds) : null, r.doneMeters ? formatKm(r.doneMeters) : null].filter(Boolean).join(' · ') : 'Pas de retour',
            r.rpe === null ? '—' : `${r.rpe}/10`,
          ],
        }))} />
    </Disclosure>
  );
}
