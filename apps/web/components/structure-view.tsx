import {
  describeIntensity, describeMeasure, exerciseHasVideo, formatClock, roundEstimate, formatKm, personalTarget, PHASE_LABELS, sessionProfile, SPORT_LABELS, stepEstimate, structureTotals,
  type Block, type References, type Sport, type Step,
} from '@coachos/domain';
import { SessionChart } from './session-chart';
import { ExerciseVideo } from './exercise-video';

/** D-096 : ce que l’élève voit d’un exercice de la bibliothèque (consignes et vidéo du coach). */
export interface ExerciseInfo { id: string; name: string; instructions: string | null; videoUrl: string | null; clipId: string | null; starterKey?: string | null; useBaseVideo?: boolean }
type Ctx = { sport: Sport; refs?: References; wid?: string; exercises?: Record<string, ExerciseInfo> };

/**
 * Lecture d’une séance structurée (D-023, D-029), pour l’athlète comme pour le coach :
 * une carte par étape, répétitions encadrées, zone écrite en toutes lettres (jamais la couleur seule),
 * allure et estimation quand la VMA est connue. Le texte reste lisible sans feuille de style.
 */
export function StructureView({ blocks, sport, refs, wid, exercises }: { blocks: Block[]; sport: Sport; refs?: References; wid?: string; exercises?: Record<string, ExerciseInfo> }) {
  if (!blocks.length) return null;
  const t = structureTotals(blocks, { sport, refs });
  return (
    <div className="sv" data-tour="structure">
      <p className="sv-total">
        <strong>Déroulé</strong>
        {t.seconds ? <>{' · '}<span>{t.unknownTime ? 'au moins ' : t.estimated ? 'environ ' : ''}<strong>{formatClock(roundEstimate(t))}</strong></span></> : null}
        {t.totalMeters ? <>{' · '}<span>{t.unknownDistance ? 'au moins ' : t.distanceEstimated ? 'environ ' : ''}<strong>{formatKm(t.totalMeters)}</strong></span></> : null}
      </p>
      <SessionChart bars={sessionProfile(blocks, sport, refs)} />
      <BlockRows blocks={blocks} c={{ sport, refs, wid, exercises }} />
      {t.unknownDistance && !refs?.vmaKmh && (sport === 'running' || sport === 'trail') ? (
        <p className="muted sv-foot">Distance estimée seulement pour les blocs avec une allure : la VMA n’est pas encore renseignée.</p>
      ) : null}
    </div>
  );
}

function StepRow({ s, c }: { s: Step; c: Ctx }) {
  const { sport, refs } = c;
  const ex = s.exercise?.id ? c.exercises?.[s.exercise.id] : undefined;
  const target = describeIntensity(s.intensity);
  const est = stepEstimate(s, sport, refs);
  const zone = s.intensity.kind === 'zone' ? s.intensity.zone : null;
  // Cible propre à l’élève juste derrière la zone : « Z2 · 6:09 à 5:43 /km », « Z3 · 175 à 205 W », « Z4 · 1:50 à 1:45 /100 m » (D-055).
  const zonePace = personalTarget(s, sport, refs);
  const extra = [
    est.meters ? `environ ${formatKm(est.meters)}` : null,
    est.seconds ? `environ ${formatClock(est.seconds)}` : null,
    s.cadence ? `cadence ${s.cadence.min}${s.cadence.max ? `–${s.cadence.max}` : ''}` : null,
  ].filter(Boolean);
  return (
    <li className={`sv-step phase-${s.phase}${zone ? ` z${zone}` : ''}`}>
      <span className="sv-head">
        <span className="sv-phase">{s.exercise ? <strong className="sv-ex-name">{s.exercise.name}</strong> : PHASE_LABELS[s.phase]}{s.sport && s.sport !== sport ? ` · ${SPORT_LABELS[s.sport]}` : ''}</span>
        {' '}
        <span className="sv-main">{describeMeasure(s.measure)}</span>
      </span>
      {target ? <>{' · '}<span className="sv-target">{zone ? <span className="zone-dot" aria-hidden="true" /> : null}{target}{zonePace ? <span className="sv-pace">{' · '}{zonePace}</span> : null}</span></> : null}
      {extra.length ? <span className="sv-extra"> {extra.join(' · ')}</span> : null}
      {s.note ? <span className="sv-note"> — {s.note}</span> : null}
      {ex && c.wid && (ex.instructions || exerciseHasVideo(ex)) ? (
        <details className="sv-ex">
          <summary>{exerciseHasVideo(ex) ? '▶ Voir comment faire' : 'Comment faire'}</summary>
          {ex.instructions ? <p className="sv-ex-text">{ex.instructions}</p> : null}
          <ExerciseVideo wid={c.wid} exercise={ex} />
        </details>
      ) : null}
    </li>
  );
}

function BlockRows({ blocks, c }: { blocks: Block[]; c: Ctx }) {
  return (
    <ol className="sv-list">
      {blocks.map((b, k) =>
        b.type === 'step' ? (
          <StepRow key={k} s={b} c={c} />
        ) : (
          <li key={k} className="sv-repeat">
            <p className="sv-times"><span className="sv-badge">{b.times} ×</span> {c.sport === 'strength' ? `${b.times} séries` : `Répéter ${b.times} fois`}</p>
            <BlockRows blocks={b.steps} c={c} />
          </li>
        ),
      )}
    </ol>
  );
}
