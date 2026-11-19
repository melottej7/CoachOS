import Link from 'next/link';
import { formatClock, formatKm, formatShortDate, STAT_DEFINITIONS, type StatsSummary } from '@coachos/domain';
import { WeeklyChart } from './weekly-chart';

// Panneau de statistiques (CE-S-01 à 04, CE-E-03, D-037), commun à l’élève et au coach.

const hours = (s: number) => (s ? formatClock(Math.round(s / 60) * 60) : '0 min');
const day = (d: string) => formatShortDate(d).replace(/\.$/, '');

export function StatsPanel({ s, weeks, periodHref, you }: { s: StatsSummary; weeks: number; periodHref: (w: number) => string; you: boolean }) {
  const bars = s.weeks.map((w) => ({
    key: w.monday,
    label: day(w.monday),
    plannedMin: Math.round(w.plannedSeconds / 60),
    doneMin: Math.round(w.doneSeconds / 60),
    detail: `Semaine du ${day(w.monday)} : ${hours(w.doneSeconds)} réalisées sur ${hours(w.plannedSeconds)} prévues · ${w.done} séance${w.done > 1 ? 's' : ''} faite${w.done > 1 ? 's' : ''} sur ${w.planned}`,
  }));
  return (
    <div className="stats">
      <nav className="seg-tabs small" aria-label="Période">
        {[4, 8, 12].map((n) => <Link key={n} href={periodHref(n)} aria-current={n === weeks ? 'page' : undefined}>{n} semaines</Link>)}
      </nav>
      <div className="kpis">
        <div className="kpi">
          <p className="kpi-label">Régularité</p>
          <p className="kpi-value">{s.completion === null ? '—' : `${s.completion} %`}</p>
          <div className="meter" aria-hidden="true"><span style={{ width: `${s.completion ?? 0}%` }} /></div>
          <p className="kpi-sub">{s.done} séance{s.done > 1 ? 's' : ''} faite{s.done > 1 ? 's' : ''} sur {s.due}{s.noFeedback ? ` · ${s.noFeedback} sans retour` : ''}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Volume réalisé</p>
          <p className="kpi-value">{hours(s.doneSeconds)}</p>
          <p className="kpi-sub">sur {hours(s.plannedSeconds)} prévues</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Distance</p>
          <p className="kpi-value">{s.doneMeters ? formatKm(s.doneMeters) : '—'}</p>
          <p className="kpi-sub">{s.plannedMeters ? `sur ${formatKm(s.plannedMeters)} prévus` : 'déclarée dans les retours'}</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Effort ressenti</p>
          <p className="kpi-value">{s.avgRpe === null ? '—' : `${String(s.avgRpe).replace('.', ',')}/10`}</p>
          <p className="kpi-sub">moyenne des retours</p>
        </div>
        <div className="kpi">
          <p className="kpi-label">Série</p>
          <p className="kpi-value">{s.streakWeeks} sem.</p>
          <p className="kpi-sub">{s.streakWeeks ? `${you ? 'tu t’entraînes' : 's’entraîne'} chaque semaine` : 'à relancer'}</p>
        </div>
      </div>
      {s.weeks.some((w) => w.planned) ? (
        <>
          <WeeklyChart bars={bars} title={`Volume par semaine sur ${weeks} semaines : prévu et réalisé`} />
          <details className="stats-table">
            <summary>Voir le tableau</summary>
            <table>
              <thead><tr><th scope="col">Semaine du</th><th scope="col">Séances faites</th><th scope="col">Réalisé</th><th scope="col">Prévu</th><th scope="col">Distance</th></tr></thead>
              <tbody>
                {s.weeks.map((w) => (
                  <tr key={w.monday}><th scope="row">{day(w.monday)}</th><td>{w.done} / {w.planned}</td><td>{hours(w.doneSeconds)}</td><td>{hours(w.plannedSeconds)}</td><td>{w.doneMeters ? formatKm(w.doneMeters) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : <p className="empty">Aucune séance publiée sur cette période.</p>}
      <details className="stats-defs">
        <summary>Comment sont calculés ces chiffres ?</summary>
        <dl>{STAT_DEFINITIONS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </details>
    </div>
  );
}
