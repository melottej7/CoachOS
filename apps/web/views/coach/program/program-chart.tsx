import { formatClock, formatShortDate, PROGRAM_PHASE_LABELS, type ProgramPhase } from '@coachos/domain';
import s from './program.module.css';

const h = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);

/**
 * D-101, refonte Chrono (D-157) · Le programme en un coup d’œil : une barre de volume par semaine, à la couleur de sa phase,
 * phases écrites sous le graphique (jamais la couleur seule), la course au bout. Chaque barre mène à sa semaine.
 */
export function ProgramChart({ weeks, eventDate, eventLabel }: {
  weeks: { index: number; monday: string; phase: ProgramPhase; minutes: number; longMinutes: number | null }[];
  eventDate: string; eventLabel: string;
}) {
  const max = Math.max(...weeks.map((w) => w.minutes), 1);
  const spans: { phase: ProgramPhase; from: number; to: number }[] = [];
  for (const w of weeks) {
    const last = spans.at(-1);
    if (last && last.phase === w.phase) last.to = w.index; else spans.push({ phase: w.phase, from: w.index, to: w.index });
  }
  // Légende : chaque phase une seule fois, avec toutes ses semaines (dans l’ordre d’apparition).
  const legend = [...spans.reduce((m, x) => m.set(x.phase, [...(m.get(x.phase) ?? []), x]), new Map<ProgramPhase, typeof spans>())];
  // Sur téléphone, une étiquette de semaine sur quatre reste visible (la première, puis toutes les quatre).
  const keep = (i: number) => i === 1 || i % 4 === 0 || i === weeks.length;
  return (
    <figure className={s.chart} aria-labelledby="pc-cap">
      <figcaption id="pc-cap" className="ds-visually-hidden">Volume d’entraînement par semaine, de la semaine 1 à la course</figcaption>
      <div className={s.plot} style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr)) auto` }}>
        {weeks.map((w) => (
          <a key={w.index} href={`#semaine-${w.index}`} className={`${s.col} ${s[w.phase]}`} title={`S${w.index} · ${PROGRAM_PHASE_LABELS[w.phase]} · ${h(w.minutes)}`}
            aria-label={`Semaine ${w.index}, ${PROGRAM_PHASE_LABELS[w.phase].toLowerCase()} : ${h(w.minutes)}${w.longMinutes ? `, séance longue ${h(w.longMinutes)}` : ''}`}>
            <span className={s.val} aria-hidden="true">{h(w.minutes)}</span>
            <span className={s.bar} style={{ height: `${Math.max(6, Math.round((w.minutes / max) * 100))}%` }} aria-hidden="true" />
            <span className={`${s.wk} ${keep(w.index) ? s.wkKeep : ''}`} aria-hidden="true">S{w.index}</span>
          </a>
        ))}
        <span className={s.finish} aria-label={`Course : ${eventLabel}, ${formatShortDate(eventDate)}`}>
          <span className={s.flag} aria-hidden="true" />
          <span className={`${s.wk} ${s.wkKeep}`} aria-hidden="true">{formatShortDate(eventDate)}</span>
        </span>
      </div>
      <ul className={s.legend}>
        {legend.map(([phase, list]) => (
          <li key={phase} className={s[phase]}>
            <span className={s.swatch} aria-hidden="true" />{PROGRAM_PHASE_LABELS[phase]} <span className={s.muted}>{list.map((x) => (x.from === x.to ? `S${x.from}` : `S${x.from}–S${x.to}`)).join(', ')}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
