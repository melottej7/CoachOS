import { formatClock, formatShortDate, PROGRAM_PHASE_LABELS, type ProgramPhase } from '@coachos/domain';

const h = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);

/**
 * D-101 · Le programme en un coup d’œil : une barre de volume par semaine, couleur et nom de la phase (jamais la
 * couleur seule : les phases sont aussi écrites sous le graphique), la course au bout. Chaque barre mène à sa semaine.
 */
export function ProgramChart({ weeks, eventDate, eventLabel }: {
  weeks: { index: number; monday: string; phase: ProgramPhase; minutes: number; longMinutes: number | null }[];
  eventDate: string; eventLabel: string;
}) {
  const max = Math.max(...weeks.map((w) => w.minutes), 1);
  // Phases consécutives, écrites en toutes lettres sous les barres.
  const spans: { phase: ProgramPhase; from: number; to: number }[] = [];
  for (const w of weeks) {
    const last = spans.at(-1);
    if (last && last.phase === w.phase) last.to = w.index; else spans.push({ phase: w.phase, from: w.index, to: w.index });
  }
  return (
    <figure className="pc" aria-labelledby="pc-cap">
      <figcaption id="pc-cap" className="visually-hidden">Volume d’entraînement par semaine, de la semaine 1 à la course</figcaption>
      <div className="pc-plot" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr)) auto` }}>
        {weeks.map((w) => (
          <a key={w.index} href={`#semaine-${w.index}`} className={`pc-col ${w.phase}`}
            aria-label={`Semaine ${w.index}, ${PROGRAM_PHASE_LABELS[w.phase].toLowerCase()} : ${h(w.minutes)}${w.longMinutes ? `, séance longue ${h(w.longMinutes)}` : ''}`}>
            <span className="pc-val" aria-hidden="true">{h(w.minutes)}</span>
            <span className="pc-bar" style={{ height: `${Math.max(6, Math.round((w.minutes / max) * 100))}%` }} aria-hidden="true" />
            <span className="pc-wk" aria-hidden="true">S{w.index}</span>
          </a>
        ))}
        <span className="pc-race" aria-label={`Course : ${eventLabel}, ${formatShortDate(eventDate)}`}>
          <span className="pc-flag" aria-hidden="true">🏁</span>
          <span className="pc-wk" aria-hidden="true">{formatShortDate(eventDate)}</span>
        </span>
      </div>
      <ul className="plain pc-legend">
        {spans.map((s) => (
          <li key={`${s.phase}-${s.from}`} className={s.phase}>
            <span className="pc-swatch" aria-hidden="true" /> {PROGRAM_PHASE_LABELS[s.phase]} <span className="muted">{s.from === s.to ? `S${s.from}` : `S${s.from}–S${s.to}`}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
