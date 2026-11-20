'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { detectShiftedZones, previewProgramImport, SPORT_LABELS, SPORTS, toNotation, WEEK_TEMPLATE_MAX_WEEKS, WEEKDAY_SHORT, type Sport } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-085 : un ancien programme (copié depuis Google Docs ou Word) devient un programme type de la bibliothèque.
// Aperçu semaine par semaine : séances cochées, jour modifiable, consignes gardées. Rien n’est appliqué à un élève.

const EXAMPLE = [
  'Programme 10 km – 4 semaines',
  'S1 · Réveil',
  "Séance 1 : 10' marche + 8×(1' course + R1'30)",
  'Rester facile sur la minute de course.',
  "Séance 2 : Footing 30' Z1-2",
  "Séance 3 : Sortie longue 40' Z1-2",
  'S2 · Premier rythme',
  "Mar · Footing 30' Z1-2",
  "Jeu · Fractionné : 15' Z1 + 8×(200m Z5 + R200m) + 10' Z1. La dernière aussi rapide que la première.",
  "Dim · Sortie longue 50' Z1-2",
].join('\n');

export function ProgramImport({ wid }: { wid: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string; sessions: number; weeks: number }>();
  const [text, setText] = useState('');
  const [sport, setSport] = useState<Sport>('running');
  const [zones, setZones] = useState<'auto' | 'coachos' | 'shifted'>('auto');
  const [pick, setPick] = useState(0);
  const [title, setTitle] = useState<string | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<Map<number, number>>(new Map());
  const [done, setDone] = useState<{ sessions: number; weeks: number } | null>(null);

  const detected = detectShiftedZones(text);
  const shifted = zones === 'auto' ? detected : zones === 'shifted';
  const preview = useMemo(() => (text.trim() ? previewProgramImport(text, { defaultSport: sport, shiftedZones: shifted }) : null), [text, sport, shifted]);
  const program = preview?.programs[Math.min(pick, (preview?.programs.length ?? 1) - 1)] ?? null;
  const reset = () => { setOff(new Set()); setDays(new Map()); setTitle(null); setDone(null); };
  const first = program ? Math.min(...program.weeks.map((w) => w.number)) : 1;
  const span = program ? Math.max(...program.weeks.map((w) => w.number)) - first + 1 : 0;
  const chosen = program ? program.weeks.flatMap((w) => w.sessions.filter((s) => !off.has(s.line)).map((s) => ({ w, s }))) : [];
  const name = (title ?? program?.title ?? '').trim();

  return (
    <div className="stack">
      <section className="card">
        <div className="card-body stack">
          <label className="field"><span>Colle ton programme (Google Docs, Word, notes…)</span>
            <textarea className="imp-text" rows={10} value={text} spellCheck={false}
              placeholder={'Chaque semaine commence par « S1 », « Semaine 2 »… puis une séance par ligne :\nS1\nFooting 30\' Z1-2\nFractionné : 15\' Z1 + 8×(200m Z5 + R200m) + 10\' Z1\nSortie longue 50\''}
              onChange={(e) => { setText(e.target.value); setPick(0); reset(); }} /></label>
          <div className="form-row imp-src">
            <label className="field"><span>Sport quand la séance n’en dit rien</span>
              <select value={sport} onChange={(e) => { setSport(e.target.value as Sport); reset(); }}>
                {SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select></label>
            <ZoneScale value={zones} detected={detected} onChange={(v) => { setZones(v); reset(); }} />
            <div className="actions">
              <button type="button" className="btn small ghost" onClick={() => { setText(EXAMPLE); setPick(0); reset(); }}>Voir un exemple</button>
              {text ? <button type="button" className="btn small ghost" onClick={() => { setText(''); reset(); }}>Effacer</button> : null}
            </div>
          </div>
          <p className="muted">Lu comme tu l’écris : « Footing 45' Z1-2 », « 3*(2km 4'40 + 400m Z1) », « 6x800m à 4:30/km (récup 1'30) », course/marche, pyramides. Les jours écrits (« Mar · », « Dimanche ») sont gardés ; sinon les séances suivent l’ordre du document, la dernière le dimanche. Le texte autour d’une séance devient ses consignes.</p>
        </div>
      </section>

      {preview ? (
        <section className="card" aria-labelledby="pimp-prev">
          <div className="card-head"><h2 id="pimp-prev">Aperçu</h2>
            {program ? <span className="muted">{program.weeks.length} semaine{program.weeks.length > 1 ? 's' : ''} · {program.sessions} séance{program.sessions > 1 ? 's' : ''}</span> : null}</div>
          <div className="card-body stack">
            {preview.errors.map((e) => <p key={e} className="banner warn">{e}</p>)}
            {preview.programs.length > 1 ? (
              <fieldset className="pimp-pick"><legend>{preview.programs.length} programmes dans ce texte : lequel importer ?</legend>
                {preview.programs.map((p, i) => (
                  <label key={p.line} className="check"><input type="radio" name="pimp-pick" checked={i === pick} onChange={() => { setPick(i); reset(); }} />
                    <span>{p.title} <span className="muted">· {p.weeks.length} sem. · {p.sessions} séances</span></span></label>
                ))}
              </fieldset>
            ) : null}
            {program ? (
              <>
                {program.errors.map((e) => <p key={e} className="banner warn">{e}</p>)}
                <label className="field"><span>Nom du programme type</span>
                  <input value={title ?? program.title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
                <div className="pimp-weeks">
                  {program.weeks.map((w) => (
                    <div key={w.line} className="pimp-week">
                      <h3>S{w.number - first + 1} <span className="muted">{w.label.replace(/^(?:s|semaine)\s*\d+\s*[·:—–-]?\s*/i, '')}</span></h3>
                      {w.sessions.length ? (
                        <ul className="plain imp-list">
                          {w.sessions.map((s) => {
                            const isOff = off.has(s.line);
                            const day = days.get(s.line) ?? s.day;
                            return (
                              <li key={s.line} className={`imp-row${isOff ? ' off' : ''}`}>
                                <input type="checkbox" checked={!isOff} aria-label={`Importer « ${s.title} »`}
                                  onChange={() => setOff((x) => { const y = new Set(x); if (y.has(s.line)) y.delete(s.line); else y.add(s.line); return y; })} />
                                <span className="imp-main">
                                  <span><span className="muted">L{s.line}</span> <strong>{s.title}</strong>{s.minutes ? <span className="muted"> · {s.minutes} min</span> : null}</span>
                                  <span className="pimp-notation">{s.blocks.length ? toNotation(s.blocks, s.sport) : 'Sans structure : titre et consignes seulement'}{s.sport !== sport ? ` · ${SPORT_LABELS[s.sport]}` : ''}</span>
                                  {s.instructions ? <span className="muted pimp-notes">{s.instructions.length > 160 ? `${s.instructions.slice(0, 157)}…` : s.instructions}</span> : null}
                                </span>
                                <select className="imp-cat" value={day} aria-label={`Jour de « ${s.title} »`}
                                  onChange={(e) => setDays((m) => new Map(m).set(s.line, Number(e.target.value)))}>
                                  {WEEKDAY_SHORT.map((d, i) => <option key={d} value={i + 1}>{d}{i + 1 === s.day && !s.dayGiven && !days.has(s.line) ? ' (proposé)' : ''}</option>)}
                                </select>
                              </li>
                            );
                          })}
                        </ul>
                      ) : <p className="muted">Aucune séance lue cette semaine.</p>}
                    </div>
                  ))}
                </div>
                {done ? (
                  <p className="banner ok" role="status">Programme type enregistré : {done.weeks} semaine{done.weeks > 1 ? 's' : ''}, {done.sessions} séance{done.sessions > 1 ? 's' : ''}. Pour le donner à un élève : Bibliothèque › Semaines types › Appliquer (brouillons, rien n’est publié).</p>
                ) : null}
                {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
                <div className="actions">
                  <button type="button" className="btn primary" disabled={pending || !chosen.length || !name || span > WEEK_TEMPLATE_MAX_WEEKS || Boolean(done)}
                    onClick={async () => {
                      const r = await run('POST', `/api/v1/workspaces/${wid}/templates/import-program`, {
                        title: name, weeks: span,
                        days: chosen.map(({ w, s }) => ({
                          offset: (w.number - first) * 7 + (days.get(s.line) ?? s.day) - 1,
                          workout: { sport: s.sport, title: s.title, instructions: s.instructions, durationSeconds: null, distanceM: null, intervals: s.blocks },
                        })),
                      });
                      if (r) { setDone(r); router.refresh(); }
                    }}>
                    {pending ? 'Enregistrement…' : `Enregistrer comme programme type (${chosen.length} séance${chosen.length > 1 ? 's' : ''})`}
                  </button>
                  {done ? <a className="btn" href={`/coach/${wid}/library#weeks-title`}>Voir mes semaines types</a> : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** D-087 : échelle des zones du texte collé. Tes documents comptent un cran plus bas que CoachOS. */
export function ZoneScale({ value, detected, onChange }: { value: 'auto' | 'coachos' | 'shifted'; detected: boolean; onChange: (v: 'auto' | 'coachos' | 'shifted') => void }) {
  return (
    <label className="field"><span>Zones du texte</span>
      <select value={value} onChange={(e) => onChange(e.target.value as 'auto' | 'coachos' | 'shifted')}>
        <option value="auto">Détecter ({detected ? 'tes documents' : 'CoachOS'})</option>
        <option value="shifted">Tes documents : Z1-2 endurance, Z3 seuil, Z4 allure 5 km, Z5 VMA</option>
        <option value="coachos">CoachOS : Z2 endurance, Z4 seuil, Z5 allure 5 km, Z6 VMA</option>
      </select></label>
  );
}
