import {
  describeIntensity, describeMeasure, describeTotals, PHASE_LABELS, SPORT_LABELS, structureTotals,
  type Block, type Sport,
} from '@coachos/domain';

/**
 * Lecture d’une séance structurée (D-023), pour l’athlète comme pour le coach :
 * un bloc par ligne, phase en toutes lettres (jamais la couleur seule), répétitions encadrées.
 */
export function StructureView({ blocks, sport }: { blocks: Block[]; sport: Sport }) {
  if (!blocks.length) return null;
  const totals = structureTotals(blocks);
  return (
    <div className="sv" data-tour="structure">
      <p className="sv-total"><strong>Déroulé</strong> · {describeTotals(totals)}</p>
      <BlockRows blocks={blocks} sport={sport} />
    </div>
  );
}

function BlockRows({ blocks, sport }: { blocks: Block[]; sport: Sport }) {
  return (
    <ol className="sv-list">
      {blocks.map((b, k) =>
        b.type === 'step' ? (
          <li key={k} className={`sv-step phase-${b.phase}`}>
            <span className="sv-phase">{PHASE_LABELS[b.phase]}{b.sport && b.sport !== sport ? ` · ${SPORT_LABELS[b.sport]}` : ''}</span>
            <span className="sv-main">{describeMeasure(b.measure)}</span>
            {describeIntensity(b.intensity) ? <span className="sv-target">{describeIntensity(b.intensity)}</span> : null}
            {b.cadence ? <span className="sv-target">cadence {b.cadence.min}{b.cadence.max ? `–${b.cadence.max}` : ''}</span> : null}
            {b.note ? <span className="sv-note">{b.note}</span> : null}
          </li>
        ) : (
          <li key={k} className="sv-repeat">
            <span className="sv-times">{b.times} ×</span>
            <BlockRows blocks={b.steps} sport={sport} />
          </li>
        ),
      )}
    </ol>
  );
}
