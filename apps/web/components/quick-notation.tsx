'use client';

import { useId, useState } from 'react';
import { describeBlock, describeTotals, parseNotation, structureTotals, toNotation, type Block, type References, type Sport } from '@coachos/domain';

// CE-B-09 (D-041) : écrire la séance comme sur papier ; aperçu et erreurs au fil de la saisie.
// D-094 : le principe est expliqué (texte → blocs), l’aperçu montre chaque bloc compris et l’aide donne des exemples.

/** D-096 : exemples de musculation. */
const STRENGTH_EXAMPLES: [write: string, means: string][] = [
  ['10 squats', '10 répétitions de squat (l’exercice de ta bibliothèque, avec sa vidéo)'],
  ['10 squat goblet 16kg', 'avec une charge de 16 kg'],
  ["4×(10 pompes + repos 1'30)", '4 séries de 10 pompes, 1 min 30 de repos entre les séries'],
  ['30" planche', '30 secondes de planche'],
  ["3×(12 fentes arrière + 30\" planche + repos 1')", 'un circuit de 3 tours'],
  ['« Garde le dos droit »', 'une consigne pour l’exercice juste avant'],
  ["8' RPE3", '8 minutes d’échauffement, effort 3 sur 10'],
];

const EXAMPLES: [write: string, means: string][] = [
  ["15' Z1", '15 minutes en zone 1'],
  ['2km @4\'30/km', '2 km à 4\'30 par kilomètre'],
  ['10×(400m Z6 + R200m)', '10 fois : 400 m en zone 6, puis 200 m de récupération'],
  ['3×(10\' Z4 + R2\')', '3 fois : 10 minutes en zone 4, puis 2 minutes de récupération'],
  ['« Reste détendu »', 'une consigne pour l’étape juste avant'],
  ['+', 'passe à l’étape suivante'],
  ["vélo 1h Z2 + course 20' Z3", 'un enchaînement de deux sports'],
];

/** Consignes « … » écrites dans un bloc (et ses répétitions), pour montrer qu’elles sont gardées. */
const notesOf = (b: Block): string[] => (b.type === 'step' ? (b.note ? [b.note] : []) : b.steps.flatMap(notesOf));

export function QuickNotation({ sport, blocks, refs, onApply }: {
  sport: Sport; blocks: Block[]; refs?: References; onApply: (blocks: Block[], mode: 'replace' | 'append') => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const parsed = parseNotation(text, sport);
  const ready = !!text.trim() && !parsed.errors.length && parsed.blocks.length > 0;
  const rows = Math.min(6, Math.max(3, Math.ceil(text.length / 55)));
  return (
    <details className="qn" open={open} onToggle={(e) => {
      const o = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(o);
      if (o && !text.trim()) setText(toNotation(blocks, sport));
    }}>
      <summary className="btn">✍️ Écrire la séance en texte</summary>
      <div className="qn-body">
        <p className="qn-intro">
          Plus rapide que les boutons : écris toute la séance d’un coup, comme dans tes programmes. CoachOS la découpe en blocs et te montre ce qu’il a compris avant que tu l’appliques.
          {blocks.length ? ' Le texte reprend la séance actuelle : modifie-le ou efface-le.' : ''}
        </p>
        <label htmlFor={`${id}-t`} className="qn-label">Ta séance en texte</label>
        <textarea id={`${id}-t`} className="input qn-text" rows={rows} spellCheck={false} autoCapitalize="off" autoComplete="off"
          placeholder={sport === 'strength' ? "8' RPE3 + 4×(10 squats 20kg + repos 1'30) + 3×(30\" planche + repos 30\")" : "15' Z1 + 8×(400m Z6 + R200m) + 10' Z1"} value={text} onChange={(e) => setText(e.target.value)}
          aria-describedby={`${id}-out`} aria-invalid={parsed.errors.length ? true : undefined} />
        <details className="qn-how">
          <summary>Comment l’écrire ?</summary>
          <table className="qn-table">
            <thead><tr><th scope="col">Tu écris</th><th scope="col">Ça donne</th></tr></thead>
            <tbody>{(sport === 'strength' ? STRENGTH_EXAMPLES : EXAMPLES).map(([w, m]) => <tr key={w}><td><code>{w}</code></td><td>{m}</td></tr>)}</tbody>
          </table>
          {sport === 'strength' ? <p className="qn-help">Le nom écrit après le nombre de répétitions désigne l’exercice ; s’il existe dans ta bibliothèque, l’élève voit sa vidéo.</p> : null}
          <p className="qn-help">Aussi : <code>45&quot;</code> secondes, <code>1h30</code>, <code>RPE7</code>, <code>95%FTP</code>, <code>150bpm</code>. <code>x</code> ou <code>*</code> valent <code>×</code>.</p>
        </details>
        <div id={`${id}-out`} aria-live="polite">
          {parsed.errors.length ? (
            <ul className="qn-errors">{parsed.errors.slice(0, 4).map((e, k) => <li key={k}>{e.message}</li>)}</ul>
          ) : ready ? (
            <div className="qn-ok">
              <p>✓ CoachOS a compris {parsed.blocks.length} bloc{parsed.blocks.length > 1 ? 's' : ''} · {describeTotals(structureTotals(parsed.blocks, { sport, refs }))}</p>
              <ol className="qn-blocks">{parsed.blocks.map((b, k) => <li key={k}>{describeBlock(b, sport)}{notesOf(b).map((n) => <span key={n} className="qn-note"> « {n} »</span>)}</li>)}</ol>
            </div>
          ) : null}
        </div>
        <div className="actions">
          <button type="button" className="btn primary" disabled={!ready} onClick={() => { onApply(parsed.blocks, 'replace'); setText(''); setOpen(false); }}>
            {blocks.length ? 'Remplacer la séance par ces blocs' : 'Créer ces blocs'}
          </button>
          {blocks.length ? <button type="button" className="btn" disabled={!ready} onClick={() => { onApply(parsed.blocks, 'append'); setText(''); setOpen(false); }}>Ajouter ces blocs à la fin</button> : null}
        </div>
      </div>
    </details>
  );
}
