'use client';

import { useId, useState } from 'react';
import { describeTotals, parseNotation, structureTotals, toNotation, type Block, type References, type Sport } from '@coachos/domain';

// CE-B-09 (D-041) : écrire la séance comme sur papier ; aperçu et erreurs au fil de la saisie.

export function QuickNotation({ sport, blocks, refs, onApply }: {
  sport: Sport; blocks: Block[]; refs?: References; onApply: (blocks: Block[], mode: 'replace' | 'append') => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const parsed = parseNotation(text, sport);
  const ready = !!text.trim() && !parsed.errors.length && parsed.blocks.length > 0;
  return (
    <details className="qn" open={open} onToggle={(e) => {
      const o = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(o);
      if (o && !text.trim()) setText(toNotation(blocks, sport));
    }}>
      <summary className="btn">✍️ Saisie rapide en texte</summary>
      <div className="qn-body">
        <label htmlFor={`${id}-t`} className="qn-label">Écris la séance comme sur papier</label>
        <textarea id={`${id}-t`} className="input qn-text" rows={2} spellCheck={false} autoCapitalize="off" autoComplete="off"
          placeholder="15' Z1 + 8×(400m Z5 + R200m) + 10' Z1" value={text} onChange={(e) => setText(e.target.value)}
          aria-describedby={`${id}-help ${id}-out`} aria-invalid={parsed.errors.length ? true : undefined} />
        <p id={`${id}-help`} className="qn-help">
          Durées <code>15&apos;</code> <code>1&apos;30</code> <code>45&quot;</code> <code>1h30</code> · distances <code>400m</code> <code>10km</code> ·
          zones <code>Z1</code>…<code>Z7</code> · allure <code>@4&apos;30/km</code> · <code>RPE7</code> <code>95%FTP</code> <code>150bpm</code> ·
          répétitions <code>8×(…)</code> · <code>R200m</code> = récupération · multisport <code>vélo 1h Z2 + course 20&apos; Z3</code>
        </p>
        <div id={`${id}-out`} aria-live="polite">
          {parsed.errors.length ? (
            <ul className="qn-errors">{parsed.errors.slice(0, 4).map((e, k) => <li key={k}>{e.message}</li>)}</ul>
          ) : ready ? (
            <p className="qn-ok">✓ {parsed.blocks.length} bloc{parsed.blocks.length > 1 ? 's' : ''} · {describeTotals(structureTotals(parsed.blocks, { sport, refs }))}</p>
          ) : null}
        </div>
        <div className="actions">
          <button type="button" className="btn primary" disabled={!ready} onClick={() => { onApply(parsed.blocks, 'replace'); setText(''); setOpen(false); }}>Remplacer le déroulé</button>
          {blocks.length ? <button type="button" className="btn" disabled={!ready} onClick={() => { onApply(parsed.blocks, 'append'); setText(''); setOpen(false); }}>Ajouter à la fin</button> : null}
        </div>
      </div>
    </details>
  );
}
