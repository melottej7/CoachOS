'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  describeTotals, detectShiftedZones, IMPORT_EXAMPLE, IMPORT_ROLE_LABELS, LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, previewImport, SPORT_LABELS, SPORTS,
  structureTotals, type LibraryCategory, type Sport,
} from '@coachos/domain';
import { ZoneScale } from './program-import';
import { useIntent } from './use-intent';

// D-079 : import de la base du coach. Lecture et vérification dans le navigateur, aperçu ligne par ligne,
// puis ajout des seules séances cochées. Un titre déjà dans la bibliothèque n’est jamais écrasé.

/** Texte d’un fichier : UTF-8, sinon Windows-1252 (CSV d’Excel en français). */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

export function LibraryImport({ wid, existing }: { wid: string; existing: string[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ added: number; skipped: number }>();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport>('running');
  const [zones, setZones] = useState<'auto' | 'coachos' | 'shifted'>('auto');
  const [off, setOff] = useState<Set<number>>(new Set());
  const [cats, setCats] = useState<Map<number, LibraryCategory>>(new Map());
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);

  const detected = detectShiftedZones(text);
  const shifted = zones === 'auto' ? detected : zones === 'shifted';
  const preview = useMemo(() => (text.trim() ? previewImport(text, { defaultSport: sport, existing, shiftedZones: shifted }) : null), [text, sport, existing, shifted]);
  const usable = preview?.rows.filter((r) => r.workout && r.duplicate === null) ?? [];
  const chosen = usable.filter((r) => !off.has(r.line));
  const reset = () => { setOff(new Set()); setCats(new Map()); setDone(null); };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-body stack">
          <div className="form-row imp-src">
            <label className="field"><span>Fichier CSV ou texte</span>
              <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={async (e) => {
                const f = e.target.files?.[0];
                setFileError(null);
                if (!f) return;
                if (/\.(xlsx|xls|numbers|ods)$/i.test(f.name)) { setFileError('Ce fichier est un classeur : enregistre-le d’abord au format CSV (Fichier › Exporter ou Enregistrer sous › CSV), ou copie les cellules et colle-les ci-dessous.'); return; }
                if (f.size > 1_000_000) { setFileError('Fichier trop lourd (1 Mo au plus) : coupe-le en plusieurs imports.'); return; }
                setFileName(f.name); setText(await readText(f)); reset();
              }} /></label>
            <label className="field"><span>Sport quand la ligne n’en dit rien</span>
              <select value={sport} onChange={(e) => { setSport(e.target.value as Sport); reset(); }}>
                {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select></label>
            <ZoneScale value={zones} detected={detected} onChange={(v) => { setZones(v); reset(); }} />
          </div>
          {fileError ? <p className="field-error" role="alert">{fileError}</p> : null}
          <label className="field"><span>Ou colle tes séances{fileName ? ` (lu : ${fileName})` : ''}</span>
            <textarea className="imp-text" rows={8} value={text} spellCheck={false} placeholder={'Titre : séance, une par ligne. Par exemple :\nVMA courte : 20\' Z1 + 10×(30" Z6 + R30") + 10\' Z1\nSortie longue : 1h30 Z2'}
              onChange={(e) => { setText(e.target.value); setFileName(null); reset(); }} /></label>
          <div className="actions">
            <button type="button" className="btn small ghost" onClick={() => { setText(IMPORT_EXAMPLE); setFileName(null); reset(); }}>Voir un exemple</button>
            {text ? <button type="button" className="btn small ghost" onClick={() => { setText(''); setFileName(null); reset(); }}>Effacer</button> : null}
            <span className="muted">Colonnes reconnues : titre, sport, catégorie, séance (notation texte de l’éditeur), consignes, durée, distance. Une séance écrite librement est gardée dans les consignes.</span>
          </div>
        </div>
      </section>

      {preview ? (
        <section className="card" aria-labelledby="imp-prev">
          <div className="card-head"><h2 id="imp-prev">Aperçu</h2>
            <span className="muted">{preview.format === 'table' ? `Tableau · ${preview.rows.length} ligne${preview.rows.length > 1 ? 's' : ''}` : `${preview.rows.length} ligne${preview.rows.length > 1 ? 's' : ''}`}</span></div>
          <div className="card-body stack">
            {preview.errors.map((e) => <p key={e} className="banner warn">{e}</p>)}
            {preview.format === 'table' ? (
              <p className="muted">Colonnes : {preview.columns.map((c, i) => <span key={i} className={`imp-col${c.role ? '' : ' ignored'}`}>{c.header || '(sans nom)'} → {c.role ? IMPORT_ROLE_LABELS[c.role] : 'ignorée'}</span>)}</p>
            ) : null}
            {preview.rows.length ? (
              <ul className="plain imp-list">
                {preview.rows.map((r) => {
                  const ok = r.workout && r.duplicate === null;
                  const cat = cats.get(r.line) ?? r.category;
                  const totals = r.workout?.intervals.length ? describeTotals(structureTotals(r.workout.intervals)) : r.minutes ? `${r.minutes} min` : null;
                  return (
                    <li key={r.line} className={`imp-row${ok ? '' : ' bad'}${ok && off.has(r.line) ? ' off' : ''}`}>
                      {ok ? <input type="checkbox" checked={!off.has(r.line)} aria-label={`Importer « ${r.title} »`}
                        onChange={() => setOff((s) => { const x = new Set(s); if (x.has(r.line)) x.delete(r.line); else x.add(r.line); return x; })} />
                        : <span className="imp-mark" aria-hidden="true">{r.duplicate ? '=' : '!'}</span>}
                      <span className="imp-main">
                        <span><span className="muted">L{r.line}</span> <strong>{r.title || '(sans titre)'}</strong>
                          {r.workout ? <span className="muted"> · {SPORT_LABELS[r.workout.sport]}{totals ? ` · ${totals}` : ''}{r.workout.intervals.length ? '' : ' · texte libre'}</span> : null}</span>
                        {r.errors.map((e) => <span key={e} className="field-error">{e}</span>)}
                        {r.duplicate ? <span className="muted">{r.duplicate === 'library' ? 'Déjà dans ta bibliothèque : gardée telle quelle.' : 'Même titre plus haut dans le fichier : ignorée.'}</span> : null}
                      </span>
                      {ok ? (
                        <select className="imp-cat" value={cat} aria-label={`Catégorie de « ${r.title} »`}
                          onChange={(e) => setCats((m) => new Map(m).set(r.line, e.target.value as LibraryCategory))}>
                          {LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{LIBRARY_CATEGORY_LABELS[c]}{c === r.category && r.categoryGuessed && !cats.has(r.line) ? ' (devinée)' : ''}</option>)}
                        </select>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {done ? (
              <p className="banner ok" role="status">{done.added} séance{done.added > 1 ? 's' : ''} ajoutée{done.added > 1 ? 's' : ''} à ta bibliothèque{done.skipped ? ` · ${done.skipped} déjà présente${done.skipped > 1 ? 's' : ''}, gardée${done.skipped > 1 ? 's' : ''} telle${done.skipped > 1 ? 's' : ''} quelle${done.skipped > 1 ? 's' : ''}` : ''}.</p>
            ) : null}
            {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
            <div className="actions">
              <button type="button" className="btn primary" disabled={pending || !chosen.length || Boolean(done)}
                onClick={async () => {
                  const r = await run('POST', `/api/v1/workspaces/${wid}/templates/import`, { items: chosen.map((x) => ({ category: cats.get(x.line) ?? x.category, workout: x.workout })) });
                  if (r) { setDone(r); router.refresh(); }
                }}>
                {pending ? 'Import…' : `Importer ${chosen.length} séance${chosen.length > 1 ? 's' : ''}`}
              </button>
              {done ? <a className="btn" href={`/coach/${wid}/library`}>Voir ma bibliothèque</a> : null}
              <span className="muted">{preview.rows.length - usable.length ? `${preview.rows.length - usable.length} ligne${preview.rows.length - usable.length > 1 ? 's' : ''} non importable${preview.rows.length - usable.length > 1 ? 's' : ''} (voir le détail).` : 'Toutes les lignes sont lisibles.'}</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
