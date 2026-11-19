import Link from 'next/link';
import { formatClock, formatKm, formatShortDate, formatWeekday, RESULT_STATE_LABELS } from '@coachos/domain';
import type { HistoryRow } from '@/server/repo/stats';

// D-052 : historique séance par séance, prévu et réalisé côte à côte (fiche élève du coach).

const dur = (s: number | null) => (s ? formatClock(Math.round(s / 60) * 60) : '—');

export function HistoryTable({ rows, href, weeks }: { rows: HistoryRow[]; href: (workoutId: string) => string; weeks: number }) {
  if (!rows.length) return <p className="empty">Aucune séance publiée passée sur les {weeks} dernières semaines.</p>;
  return (
    <details className="stats-table history" open={rows.length <= 8}>
      <summary>Séance par séance ({rows.length})</summary>
      <div className="table-scroll">
        <table>
          <caption className="visually-hidden">Séances publiées passées, la plus récente d’abord : prévu et réalisé</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Séance</th><th scope="col">Prévu</th><th scope="col">Réalisé</th><th scope="col">Effort</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.workoutId}>
                <th scope="row">{formatWeekday(r.localDate).slice(0, 3)} {formatShortDate(r.localDate)}</th>
                <td><Link href={href(r.workoutId)}>{r.title}</Link></td>
                <td>{r.canceled ? 'Annulée' : [dur(r.plannedSeconds), r.plannedMeters ? formatKm(r.plannedMeters) : null].filter(Boolean).join(' · ')}</td>
                <td>{r.canceled ? '—' : r.state ? [RESULT_STATE_LABELS[r.state], r.doneSeconds ? dur(r.doneSeconds) : null, r.doneMeters ? formatKm(r.doneMeters) : null].filter(Boolean).join(' · ') : 'Pas de retour'}</td>
                <td>{r.rpe === null ? '—' : `${r.rpe}/10`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
