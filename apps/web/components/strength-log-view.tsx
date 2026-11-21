import { compareSet, entryVerdict, setText, type PlannedEntry, type StrengthEntry } from '@coachos/domain';

/**
 * D-096 (M4) · Séries et charges réalisées, comparées au prévu (coach et élève). Le sens se lit dans le texte
 * (« en moins », « en plus »), jamais par la couleur seule.
 */
export function StrengthLogView({ plan, log }: { plan: PlannedEntry[]; log: StrengthEntry[] }) {
  if (!log.length) return null;
  const byKey = new Map(plan.map((p) => [p.exerciseId ?? `nom:${p.name.toLowerCase()}`, p]));
  return (
    <div className="slv">
      <h3>Séries et charges</h3>
      <ul className="plain slv-list">
        {log.map((e, i) => {
          const p = byKey.get(e.exerciseId ?? `nom:${e.name.toLowerCase()}`) ?? plan[i];
          const v = entryVerdict(p, e);
          const flags = [v.less ? `${v.less} série${v.less > 1 ? 's' : ''} en moins` : null, v.missing ? `${v.missing} série${v.missing > 1 ? 's' : ''} non faite${v.missing > 1 ? 's' : ''}` : null, v.more ? `${v.more} au-dessus du prévu` : null].filter(Boolean);
          return (
            <li key={i} className="slv-ex">
              <p className="slv-name"><strong>{e.name}</strong>{flags.length ? <span className={`pill${v.less || v.missing ? ' attn' : ''}`}>{flags.join(' · ')}</span> : <span className="pill">comme prévu</span>}</p>
              <p className="slv-sets">
                {e.sets.map((s, j) => {
                  const c = s.reps === 0 ? 'less' : compareSet(p?.sets[j], s);
                  return <span key={j} className={`slv-set ${c}`}>{s.reps === 0 ? 'non faite' : setText(s)}{c === 'less' && s.reps !== 0 ? ' ▾' : c === 'more' ? ' ▴' : ''}</span>;
                })}
              </p>
              {p ? <p className="muted slv-plan">Prévu : {p.sets.map(setText).join(' · ')}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
