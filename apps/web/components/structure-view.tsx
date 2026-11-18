import {
  describeIntensity, describeMeasure, formatClock, formatKm, formatPace, PHASE_LABELS, SPORT_LABELS, stepEstimate, structureTotals,
  type Block, type References, type Sport, type Step,
} from '@coachos/domain';

/**
 * Lecture d’une séance structurée (D-023, D-029), pour l’athlète comme pour le coach :
 * une carte par étape, répétitions encadrées, zone écrite en toutes lettres (jamais la couleur seule),
 * allure et estimation quand la VMA est connue. Le texte reste lisible sans feuille de style.
 */
export function StructureView({ blocks, sport, refs }: { blocks: Block[]; sport: Sport; refs?: References }) {
  if (!blocks.length) return null;
  const t = structureTotals(blocks, { sport, refs });
  return (
    <div className="sv" data-tour="structure">
      <p className="sv-total">
        <strong>Déroulé</strong>
        {t.seconds ? <>{' · '}<span>{t.unknownTime ? 'au moins ' : t.estimated ? 'environ ' : ''}<strong>{formatClock(t.seconds)}</strong></span></> : null}
        {t.totalMeters ? <>{' · '}<span>{t.unknownDistance ? 'au moins ' : t.distanceEstimated ? 'environ ' : ''}<strong>{formatKm(t.totalMeters)}</strong></span></> : null}
      </p>
      <BlockRows blocks={blocks} sport={sport} refs={refs} />
      {t.unknownDistance && !refs?.vmaKmh && (sport === 'running' || sport === 'trail') ? (
        <p className="muted sv-foot">Distance estimée seulement pour les blocs avec une allure : la VMA n’est pas encore renseignée.</p>
      ) : null}
    </div>
  );
}

function StepRow({ s, sport, refs }: { s: Step; sport: Sport; refs?: References }) {
  const target = describeIntensity(s.intensity);
  const est = stepEstimate(s, sport, refs);
  const zone = s.intensity.kind === 'zone' ? s.intensity.zone : null;
  // Allure propre à l’élève juste derrière la zone : « Z2 (endurance fondamentale) · 6:09 à 5:43 /km ».
  const zonePace = est.pace && zone ? (est.pace[0] === est.pace[1] ? formatPace(est.pace[0]) : `${formatPace(est.pace[0]).replace(' /km', '')} à ${formatPace(est.pace[1])}`) : null;
  const extra = [
    est.meters ? `environ ${formatKm(est.meters)}` : null,
    est.seconds ? `environ ${formatClock(est.seconds)}` : null,
    s.cadence ? `cadence ${s.cadence.min}${s.cadence.max ? `–${s.cadence.max}` : ''}` : null,
  ].filter(Boolean);
  return (
    <li className={`sv-step phase-${s.phase}${zone ? ` z${zone}` : ''}`}>
      <span className="sv-head">
        <span className="sv-phase">{PHASE_LABELS[s.phase]}{s.sport && s.sport !== sport ? ` · ${SPORT_LABELS[s.sport]}` : ''}</span>
        {' '}
        <span className="sv-main">{describeMeasure(s.measure)}</span>
      </span>
      {target ? <>{' · '}<span className="sv-target">{zone ? <span className="zone-dot" aria-hidden="true" /> : null}{target}{zonePace ? <span className="sv-pace">{' · '}{zonePace}</span> : null}</span></> : null}
      {extra.length ? <span className="sv-extra"> {extra.join(' · ')}</span> : null}
      {s.note ? <span className="sv-note"> — {s.note}</span> : null}
    </li>
  );
}

function BlockRows({ blocks, sport, refs }: { blocks: Block[]; sport: Sport; refs?: References }) {
  return (
    <ol className="sv-list">
      {blocks.map((b, k) =>
        b.type === 'step' ? (
          <StepRow key={k} s={b} sport={sport} refs={refs} />
        ) : (
          <li key={k} className="sv-repeat">
            <p className="sv-times"><span className="sv-badge">{b.times} ×</span> Répéter {b.times} fois</p>
            <BlockRows blocks={b.steps} sport={sport} refs={refs} />
          </li>
        ),
      )}
    </ol>
  );
}
