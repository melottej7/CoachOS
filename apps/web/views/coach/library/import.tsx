'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  describeTotals, detectShiftedZones, IMPORT_EXAMPLE, IMPORT_ROLE_LABELS, LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, previewImport, previewProgramImport,
  SPORT_LABELS, SPORTS, structureTotals, toNotation, WEEK_TEMPLATE_MAX_WEEKS, WEEKDAY_SHORT, type LibraryCategory, type Sport,
} from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { AnchorButton, Banner, Button, Card, ChoiceGroup, Cluster, Field, Grid, Heading, Input, Select, Stack, Text, Textarea } from '@/design';
import { cx } from '@/design/cx';
import s from './library.module.css';

// D-079 (séances) et D-085 (programme entier), refonte Chrono (D-154) : lecture et vérification dans le navigateur, aperçu
// ligne par ligne ou semaine par semaine, puis enregistrement des seules séances cochées. Rien n’est écrasé ni donné à un élève.

type Zones = 'auto' | 'coachos' | 'shifted';
const pl = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const errText = (e: ReturnType<typeof useIntent>['error']) => (e ? (e.kind === 'error' ? (e.fields[0]?.rule ?? e.message) : 'Connexion perdue. Réessaie.') : null);

/** Texte d’un fichier : UTF-8, sinon Windows-1252 (CSV d’Excel en français). */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

/** D-087 : échelle des zones du texte collé. Les documents du coach comptent souvent un cran plus bas que CoachOS. */
export function ZoneScale({ id, value, detected, onChange }: { id: string; value: Zones; detected: boolean; onChange: (v: Zones) => void }) {
  return (
    <Field id={id} label="Zones du texte">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as Zones)}>
        <option value="auto">Détecter ({detected ? 'tes documents' : 'CoachOS'})</option>
        <option value="shifted">Tes documents : Z1-2 endurance, Z3 seuil, Z4 allure 5 km, Z5 VMA</option>
        <option value="coachos">CoachOS : Z2 endurance, Z4 seuil, Z5 allure 5 km, Z6 VMA</option>
      </Select>
    </Field>
  );
}

function SportDefault({ id, value, onChange, label }: { id: string; value: Sport; onChange: (v: Sport) => void; label: string }) {
  return (
    <Field id={id} label={label}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as Sport)}>{SPORTS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select>
    </Field>
  );
}

/** Une case « importer cette ligne ». */
function Tick({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return <input type="checkbox" className={s.tick} checked={on} aria-label={label} onChange={onToggle} />;
}
const toggle = (set: Set<number>, line: number) => { const x = new Set(set); if (x.has(line)) x.delete(line); else x.add(line); return x; };

export function LibraryImport({ wid, existing }: { wid: string; existing: string[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ added: number; skipped: number }>();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sport, setSport] = useState<Sport>('running');
  const [zones, setZones] = useState<Zones>('auto');
  const [off, setOff] = useState<Set<number>>(new Set());
  const [cats, setCats] = useState<Map<number, LibraryCategory>>(new Map());
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);

  const detected = detectShiftedZones(text);
  const shifted = zones === 'auto' ? detected : zones === 'shifted';
  const preview = useMemo(() => (text.trim() ? previewImport(text, { defaultSport: sport, existing, shiftedZones: shifted }) : null), [text, sport, existing, shifted]);
  const usable = preview?.rows.filter((r) => r.workout && r.duplicate === null) ?? [];
  const chosen = usable.filter((r) => !off.has(r.line));
  const reset = () => { setOff(new Set()); setCats(new Map()); setDone(null); };
  const unusable = (preview?.rows.length ?? 0) - usable.length;

  return (
    <Stack gap={6}>
      <Card pad={5}>
        <Stack gap={4}>
          <Grid min={220} gap={4}>
            <Stack gap={1}>
              <Text as="span" strong id="imp-file-label">Fichier CSV ou texte</Text>
              <Cluster gap={2}>
                <Button icon="upload" onClick={() => fileRef.current?.click()} aria-describedby={fileError ? 'imp-file-name imp-file-hint imp-file-error' : 'imp-file-name imp-file-hint'}>Choisir un fichier</Button>
                <Text as="span" size="sm" muted id="imp-file-name">{fileName ?? 'Aucun fichier choisi'}</Text>
              </Cluster>
              <input ref={fileRef} type="file" className="ds-visually-hidden" tabIndex={-1} aria-hidden="true" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                setFileError(null);
                if (!f) return;
                if (/\.(xlsx|xls|numbers|ods)$/i.test(f.name)) { setFileError('Ce fichier est un classeur : enregistre-le d’abord au format CSV (Fichier › Exporter ou Enregistrer sous › CSV), ou copie les cellules et colle-les ci-dessous.'); return; }
                if (f.size > 1_000_000) { setFileError('Fichier trop lourd (1 Mo au plus) : coupe-le en plusieurs imports.'); return; }
                setFileName(f.name); setText(await readText(f)); reset();
              }} />
              <Text as="span" size="sm" muted id="imp-file-hint">Enregistré depuis Excel, Numbers ou Google Sheets</Text>
              {fileError ? <Text as="span" size="sm" tone="danger" id="imp-file-error" role="alert">{fileError}</Text> : null}
            </Stack>
            <SportDefault id="imp-sport" label="Sport quand la ligne n’en dit rien" value={sport} onChange={(v) => { setSport(v); reset(); }} />
            <ZoneScale id="imp-zones" value={zones} detected={detected} onChange={(v) => { setZones(v); reset(); }} />
          </Grid>
          <Field id="imp-text" label={`Ou colle tes séances${fileName ? ` (lu : ${fileName})` : ''}`} hint="Une par ligne « Titre : séance », ou des cellules copiées d’un tableur">
            <Textarea id="imp-text" className={s.mono} rows={8} value={text} spellCheck={false} hasHint
              placeholder={'VMA courte : 20\' Z1 + 10×(30" Z6 + R30") + 10\' Z1\nSortie longue : 1h30 Z2'}
              onChange={(e) => { setText(e.target.value); setFileName(null); reset(); }} />
          </Field>
          <Cluster gap={2}>
            <Button size="sm" variant="ghost" onClick={() => { setText(IMPORT_EXAMPLE); setFileName(null); reset(); }}>Voir un exemple</Button>
            {text ? <Button size="sm" variant="ghost" onClick={() => { setText(''); setFileName(null); reset(); }}>Effacer</Button> : null}
          </Cluster>
          <Text size="sm" muted>Colonnes reconnues : titre, sport, catégorie, séance (notation texte de l’éditeur), consignes, durée, distance. Une séance écrite librement est gardée dans les consignes.</Text>
        </Stack>
      </Card>

      {preview ? (
        <Stack as="section" gap={3} aria-labelledby="imp-prev">
          <Cluster between gap={2}>
            <Heading level={2} size={4} id="imp-prev">Aperçu</Heading>
            <Text size="sm" muted>{preview.format === 'table' ? `Tableau · ${pl(preview.rows.length, 'ligne')}` : pl(preview.rows.length, 'ligne')}</Text>
          </Cluster>
          {preview.errors.map((e) => <Banner key={e} tone="warning">{e}</Banner>)}
          {preview.format === 'table' ? (
            <div className={s.cols} aria-label="Colonnes lues">
              {preview.columns.map((c, i) => <span key={i} className={cx(s.col, !c.role && s.colOff)}>{c.header || '(sans nom)'} → {c.role ? IMPORT_ROLE_LABELS[c.role] : 'ignorée'}</span>)}
            </div>
          ) : null}
          {preview.rows.length ? (
            <ul className={s.imp}>
              {preview.rows.map((r) => {
                const ok = Boolean(r.workout) && r.duplicate === null;
                const cat = cats.get(r.line) ?? r.category;
                const totals = r.workout?.intervals.length ? describeTotals(structureTotals(r.workout.intervals)) : r.minutes ? `${r.minutes} min` : null;
                return (
                  <li key={r.line} className={cx(s.impRow, !ok && s.impBad)} data-off={ok && off.has(r.line) ? '' : undefined}>
                    {ok ? <Tick on={!off.has(r.line)} label={`Importer « ${r.title} »`} onToggle={() => setOff((x) => toggle(x, r.line))} />
                      : <span className={s.mark} aria-hidden="true">{r.duplicate ? '=' : '!'}</span>}
                    <span className={s.impMain}>
                      <span><Text as="span" size="sm" muted>L{r.line}</Text> <strong>{r.title || '(sans titre)'}</strong></span>
                      {r.workout ? <Text as="span" size="sm" muted>{SPORT_LABELS[r.workout.sport]}{totals ? ` · ${totals}` : ''}{r.workout.intervals.length ? '' : ' · texte libre'}</Text> : null}
                      {r.errors.map((e) => <span key={e} className={s.err}>{e}</span>)}
                      {r.duplicate ? <Text as="span" size="sm" muted>{r.duplicate === 'library' ? 'Déjà dans ta bibliothèque : gardée telle quelle.' : 'Même titre plus haut dans le fichier : ignorée.'}</Text> : null}
                    </span>
                    {ok ? (
                      <Select value={cat} aria-label={`Catégorie de « ${r.title} »`} onChange={(e) => setCats((m) => new Map(m).set(r.line, e.target.value as LibraryCategory))}>
                        {LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{LIBRARY_CATEGORY_LABELS[c]}{c === r.category && r.categoryGuessed && !cats.has(r.line) ? ' (devinée)' : ''}</option>)}
                      </Select>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {done ? (
            <Banner tone="success" title={`${pl(done.added, 'séance')} ajoutée${done.added > 1 ? 's' : ''} à ta bibliothèque`}
              action={<AnchorButton href={`/coach/${wid}/library`} size="sm">Voir ma bibliothèque</AnchorButton>}>
              {done.skipped ? `${pl(done.skipped, 'déjà présente')}, gardée${done.skipped > 1 ? 's' : ''} telle${done.skipped > 1 ? 's' : ''} quelle${done.skipped > 1 ? 's' : ''}.` : null}
            </Banner>
          ) : null}
          {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
          <Cluster gap={3}>
            <Button variant="primary" icon="upload" loading={pending} disabled={!chosen.length || Boolean(done)}
              onClick={async () => {
                const r = await run('POST', `/api/v1/workspaces/${wid}/templates/import`, { items: chosen.map((x) => ({ category: cats.get(x.line) ?? x.category, workout: x.workout })) });
                if (r) { setDone(r); router.refresh(); }
              }}>
              {`Importer ${pl(chosen.length, 'séance')}`}
            </Button>
            <Text as="span" size="sm" muted>{unusable ? `${pl(unusable, 'ligne')} non importable${unusable > 1 ? 's' : ''} (voir le détail).` : 'Toutes les lignes sont lisibles.'}</Text>
          </Cluster>
        </Stack>
      ) : null}
    </Stack>
  );
}

const PROGRAM_EXAMPLE = [
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
  const [zones, setZones] = useState<Zones>('auto');
  const [pick, setPick] = useState(0);
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<Map<number, number>>(new Map());
  const [done, setDone] = useState<{ sessions: number; weeks: number } | null>(null);

  const detected = detectShiftedZones(text);
  const shifted = zones === 'auto' ? detected : zones === 'shifted';
  const preview = useMemo(() => (text.trim() ? previewProgramImport(text, { defaultSport: sport, shiftedZones: shifted }) : null), [text, sport, shifted]);
  const program = preview?.programs[Math.min(pick, (preview?.programs.length ?? 1) - 1)] ?? null;
  const reset = () => { setOff(new Set()); setDays(new Map()); setTitle(null); setNotes(null); setDone(null); };
  const first = program ? Math.min(...program.weeks.map((w) => w.number)) : 1;
  const span = program ? Math.max(...program.weeks.map((w) => w.number)) - first + 1 : 0;
  const chosen = program ? program.weeks.flatMap((w) => w.sessions.filter((x) => !off.has(x.line)).map((x) => ({ w, s: x }))) : [];
  const name = (title ?? program?.title ?? '').trim();

  return (
    <Stack gap={6}>
      <Card pad={5}>
        <Stack gap={4}>
          <Field id="pimp-text" label="Colle ton programme (Google Docs, Word, notes…)" hint="Chaque semaine commence par « S1 », « Semaine 2 »… puis une séance par ligne">
            <Textarea id="pimp-text" className={s.mono} rows={10} value={text} spellCheck={false} hasHint
              placeholder={'S1\nFooting 30\' Z1-2\nFractionné : 15\' Z1 + 8×(200m Z5 + R200m) + 10\' Z1\nSortie longue 50\''}
              onChange={(e) => { setText(e.target.value); setPick(0); reset(); }} />
          </Field>
          <Grid min={220} gap={4}>
            <SportDefault id="pimp-sport" label="Sport quand la séance n’en dit rien" value={sport} onChange={(v) => { setSport(v); reset(); }} />
            <ZoneScale id="pimp-zones" value={zones} detected={detected} onChange={(v) => { setZones(v); reset(); }} />
          </Grid>
          <Cluster gap={2}>
            <Button size="sm" variant="ghost" onClick={() => { setText(PROGRAM_EXAMPLE); setPick(0); reset(); }}>Voir un exemple</Button>
            {text ? <Button size="sm" variant="ghost" onClick={() => { setText(''); reset(); }}>Effacer</Button> : null}
          </Cluster>
          <Text size="sm" muted>Lu comme tu l’écris : « Footing 45&apos; Z1-2 », « 3*(2km 4&apos;40 + 400m Z1) », « 6x800m à 4:30/km (récup 1&apos;30) », course/marche, pyramides. Les jours écrits (« Mar · », « Dimanche ») sont gardés ; sinon les séances suivent l’ordre du document, la dernière le dimanche. Le texte autour d’une séance devient ses consignes.</Text>
        </Stack>
      </Card>

      {preview ? (
        <Stack as="section" gap={4} aria-labelledby="pimp-prev">
          <Cluster between gap={2}>
            <Heading level={2} size={4} id="pimp-prev">Aperçu</Heading>
            {program ? <Text size="sm" muted>{pl(program.weeks.length, 'semaine')} · {pl(program.sessions, 'séance')}</Text> : null}
          </Cluster>
          {preview.errors.map((e) => <Banner key={e} tone="warning">{e}</Banner>)}
          {preview.programs.length > 1 ? (
            <ChoiceGroup legend={`${preview.programs.length} programmes dans ce texte : lequel importer ?`} name="pimp-pick" columns={1}
              value={String(pick)} onChange={(v) => { setPick(Number(v)); reset(); }}
              options={preview.programs.map((p, i) => ({ value: String(i), label: p.title, hint: `${pl(p.weeks.length, 'semaine')} · ${pl(p.sessions, 'séance')}` }))} />
          ) : null}
          {program ? (
            <>
              {program.errors.map((e) => <Banner key={e} tone="warning">{e}</Banner>)}
              <Field id="pimp-title" label="Nom du programme type">
                <Input id="pimp-title" value={title ?? program.title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field id="pimp-notes" label="Consignes générales" hint="Objectif, repères, règles… ajoutées à la première séance quand tu appliques le programme à un élève">
                <Textarea id="pimp-notes" rows={4} maxLength={4000} value={notes ?? program.notes ?? ''} onChange={(e) => setNotes(e.target.value)} hasHint />
              </Field>
              <div className={s.weeks}>
                {program.weeks.map((w) => (
                  <Stack as="section" key={w.line} gap={2} aria-label={`Semaine ${w.number - first + 1}`}>
                    <Heading level={3} size={4}>S{w.number - first + 1} <Text as="span" muted>{w.label.replace(/^(?:s|semaine)\s*\d+\s*[·:—–-]?\s*/i, '')}</Text></Heading>
                    {w.sessions.length ? (
                      <ul className={s.imp}>
                        {w.sessions.map((x) => {
                          const isOff = off.has(x.line);
                          const day = days.get(x.line) ?? x.day;
                          return (
                            <li key={x.line} className={s.impRow} data-off={isOff ? '' : undefined}>
                              <Tick on={!isOff} label={`Importer « ${x.title} »`} onToggle={() => setOff((y) => toggle(y, x.line))} />
                              <span className={s.impMain}>
                                <span><Text as="span" size="sm" muted>L{x.line}</Text> <strong>{x.title}</strong>{x.minutes ? <Text as="span" size="sm" muted> · {x.minutes} min</Text> : null}</span>
                                <span className={s.mono}>{x.blocks.length ? toNotation(x.blocks, x.sport) : 'Sans structure : titre et consignes seulement'}{x.sport !== sport ? ` · ${SPORT_LABELS[x.sport]}` : ''}</span>
                                {x.instructions ? <Text as="span" size="sm" muted>{x.instructions.length > 160 ? `${x.instructions.slice(0, 157)}…` : x.instructions}</Text> : null}
                              </span>
                              <Select value={day} aria-label={`Jour de « ${x.title} »`} onChange={(e) => setDays((m) => new Map(m).set(x.line, Number(e.target.value)))}>
                                {WEEKDAY_SHORT.map((d, i) => <option key={d} value={i + 1}>{d}{i + 1 === x.day && !x.dayGiven && !days.has(x.line) ? ' (proposé)' : ''}</option>)}
                              </Select>
                            </li>
                          );
                        })}
                      </ul>
                    ) : <Text size="sm" muted>Aucune séance lue cette semaine.</Text>}
                  </Stack>
                ))}
              </div>
              {span > WEEK_TEMPLATE_MAX_WEEKS ? <Banner tone="warning">Un programme type tient sur {WEEK_TEMPLATE_MAX_WEEKS} semaines au plus : celui-ci en couvre {span}. Coupe-le en deux imports.</Banner> : null}
              {done ? (
                <Banner tone="success" title={`Programme type enregistré : ${pl(done.weeks, 'semaine')}, ${pl(done.sessions, 'séance')}`}
                  action={<AnchorButton href={`/coach/${wid}/library#semaines`} size="sm">Voir mes semaines types</AnchorButton>}>
                  Pour le donner à un élève : depuis sa semaine dans le calendrier, « Appliquer une semaine type » (brouillons, rien n’est publié).
                </Banner>
              ) : null}
              {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
              <Cluster gap={3}>
                <Button variant="primary" icon="check" loading={pending} disabled={!chosen.length || !name || span > WEEK_TEMPLATE_MAX_WEEKS || Boolean(done)}
                  onClick={async () => {
                    const r = await run('POST', `/api/v1/workspaces/${wid}/templates/import-program`, {
                      title: name, weeks: span, notes: (notes ?? program.notes ?? '').trim() || null,
                      days: chosen.map(({ w, s: x }) => ({
                        offset: (w.number - first) * 7 + (days.get(x.line) ?? x.day) - 1,
                        workout: { sport: x.sport, title: x.title, instructions: x.instructions, durationSeconds: null, distanceM: null, intervals: x.blocks },
                      })),
                    });
                    if (r) { setDone(r); router.refresh(); }
                  }}>
                  Enregistrer le programme type
                </Button>
                <Text as="span" size="sm" muted>{pl(chosen.length, 'séance cochée', 'séances cochées')}</Text>
              </Cluster>
            </>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
