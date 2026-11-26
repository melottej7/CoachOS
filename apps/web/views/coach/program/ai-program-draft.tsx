'use client';

import { useState } from 'react';
import { AI_PROGRAM_MAX_WEEKS, describeBlock, formatShortDate, formatWeekday, parseNotation, SPORT_LABELS, type Sport } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Banner, Button, Card, Cluster, Field, Input, LinkButton, Stack, Text, Textarea } from '@/design';
import s from '@/views/coach/workout/builder.module.css';

/**
 * IA-3 (D-191) · « Préparer un programme avec l’IA ». Le coach écrit sa demande ; l’IA rend un brouillon semaine par
 * semaine (intention, séances en notation) avec ce qu’elle a lu ; le coach corrige chaque séance, puis « Enregistrer en
 * brouillon » : rien n’est publié, la publication reste la commande habituelle.
 */

type Session = { date: string; day: number; sport: Sport; title: string; notation: string; lines: { text: string; error: string | null }[]; minutes: number; ok: boolean };
interface Answer {
  suggestionId: string; source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; intention: string; note: string;
  program: { weeks: { number: number; monday: string; intention: string; minutes: number; sessions: Session[] }[]; risks: { level: string; text: string }[]; ok: boolean };
  read: { name: string; ok: boolean }[];
}

const READ_LABELS: Record<string, string> = {
  listerExercices: 'la bibliothèque et les machines', lireGroupe: 'le groupe', lireEleve: 'le profil et les repères', lireChargesRecentes: 'les charges réalisées',
  lireSeancesBibliotheque: 'tes séances de bibliothèque', lireSeancesPrevues: 'les séances déjà prévues',
};

export function AiProgramDraft({ wid, target, targetLabel, defaultMonday, calendarHref }: {
  wid: string; target: { kind: 'athlete' | 'team'; id: string }; targetLabel: string; defaultMonday: string; calendarHref: string;
}) {
  const [text, setText] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [monday, setMonday] = useState(defaultMonday);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const ask = useIntent<Answer>();
  const save = useIntent<{ created: number }>();

  const key = (w: number, i: number) => `${w}-${i}`;
  const notationOf = (w: number, i: number, x: Session) => edits[key(w, i)] ?? x.notation;
  const all = answer?.program.weeks.flatMap((w) => w.sessions.map((x, i) => ({ w: w.number, i, x, notation: notationOf(w.number, i, x) }))) ?? [];
  const errors = all.filter((a) => { const r = parseNotation(a.notation, a.x.sport); return !a.notation.trim() || r.errors.length > 0 || !r.blocks.length; });
  const blocked = answer?.program.risks.some((r) => r.level === 'block') ?? false;

  async function propose() {
    setSaved(null);
    const r = await ask.run('POST', `/api/v1/workspaces/${wid}/ai-program`, { text, weeks, startMonday: monday, target });
    if (r) { setAnswer(r); setEdits({}); }
  }
  async function keep() {
    if (!answer) return;
    const r = await save.run('POST', `/api/v1/workspaces/${wid}/ai-program/save`, {
      suggestionId: answer.suggestionId, sessions: all.map((a) => ({ date: a.x.date, sport: a.x.sport, title: a.x.title, notation: a.notation })),
    });
    if (r) { setSaved(r.created); setAnswer(null); }
  }

  return (
    <Stack gap={5}>
      <Card pad={5}>
        <Stack gap={4}>
          <Field id="aip-text" label={`Ta demande pour ${targetLabel}`} hint="Ex. « 8 semaines de force, 3 séances par semaine, salle Basic-Fit, priorité au dos »">
            <Textarea id="aip-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} hasHint />
          </Field>
          <Cluster gap={4}>
            <Field id="aip-weeks" label="Semaines">
              <Input id="aip-weeks" type="number" inputMode="numeric" min={1} max={AI_PROGRAM_MAX_WEEKS} value={weeks}
                onChange={(e) => setWeeks(Math.max(1, Math.min(AI_PROGRAM_MAX_WEEKS, Math.round(Number(e.target.value) || 1))))} />
            </Field>
            <Field id="aip-monday" label="Premier lundi">
              <Input id="aip-monday" type="date" step={7} value={monday} onChange={(e) => setMonday(e.target.value)} />
            </Field>
          </Cluster>
          <Cluster gap={3}>
            <Button variant="primary" icon="bolt" loading={ask.pending} disabled={text.trim().length < 3} onClick={() => void propose()}>Préparer le programme</Button>
            {ask.pending ? <Text as="span" size="sm" muted role="status">L’IA lit les données et rédige ; jusqu’à deux minutes.</Text> : null}
          </Cluster>
          {ask.error ? <Text size="sm" tone="danger" role="alert">{ask.error.kind === 'error' ? (ask.error.fields?.[0]?.rule ?? ask.error.message) : 'Pas de connexion : réessaie.'}</Text> : null}
        </Stack>
      </Card>

      {saved !== null ? (
        <Banner tone="success" title={`${saved} séance${saved > 1 ? 's' : ''} enregistrée${saved > 1 ? 's' : ''} en brouillon`}>
          Rien n’est publié. <LinkButton href={calendarHref} size="sm" variant="ghost" icon="calendar">Voir le calendrier</LinkButton>
        </Banner>
      ) : null}

      {answer ? (
        <Stack gap={4} aria-live="polite">
          <Cluster gap={2}>
            <Text strong>Brouillon de programme</Text>
            <Badge tone={answer.source === 'claude' ? 'coach' : 'neutral'}>{answer.source === 'claude' ? 'Claude' : 'IA simulée'}</Badge>
          </Cluster>
          {answer.intention ? <Text>{answer.intention}</Text> : null}
          {answer.note ? <Text size="sm">{answer.note}</Text> : null}
          {answer.read.length ? <Text size="sm" muted>L’IA a lu : {[...new Set(answer.read.filter((r) => r.ok).map((r) => READ_LABELS[r.name] ?? r.name))].join(', ')}.</Text> : null}
          {answer.program.risks.length ? (
            <ul className={s.qnErrors} aria-label="Points à vérifier">{answer.program.risks.map((r, k) => <li key={k}>{r.text}</li>)}</ul>
          ) : null}
          {answer.program.weeks.map((w) => (
            <Card key={w.number} pad={4}>
              <Stack gap={3}>
                <Stack gap={1}>
                  <Text strong>Semaine {w.number} · {formatShortDate(w.monday)} · {w.minutes} min</Text>
                  {w.intention ? <Text size="sm" muted>{w.intention}</Text> : null}
                </Stack>
                {w.sessions.map((x, i) => {
                  const value = notationOf(w.number, i, x);
                  const r = parseNotation(value, x.sport);
                  const id = `aip-${w.number}-${i}`;
                  return (
                    <Stack key={i} gap={1}>
                      <label htmlFor={id} className={s.label}>{formatWeekday(x.date)} {formatShortDate(x.date)} · {x.title} · {SPORT_LABELS[x.sport]}</label>
                      <textarea id={id} className={`${s.control} ${s.qnText}`} rows={Math.min(5, Math.max(2, Math.ceil(value.length / 55)))} spellCheck={false} autoCapitalize="off"
                        value={value} onChange={(e) => setEdits((m) => ({ ...m, [key(w.number, i)]: e.target.value }))} aria-invalid={r.errors.length || !value.trim() ? true : undefined} />
                      {x.lines.filter((l) => l.error).map((l, k) => <Text key={k} size="sm" tone="danger">Non lu : « {l.text} »</Text>)}
                      {r.errors.length ? <Text size="sm" tone="danger">{r.errors[0]!.message}</Text>
                        : value.trim() ? <Text size="sm" muted>{r.blocks.map((b) => describeBlock(b, x.sport)).join(' · ')}</Text> : <Text size="sm" tone="danger">Séance vide</Text>}
                    </Stack>
                  );
                })}
              </Stack>
            </Card>
          ))}
          {answer.status === 'ready' && all.length ? (
            <Cluster gap={3}>
              <Button variant="primary" icon="check" loading={save.pending} disabled={errors.length > 0 || blocked} onClick={() => void keep()}>Enregistrer en brouillon ({all.length} séance{all.length > 1 ? 's' : ''})</Button>
              <Button variant="ghost" onClick={() => setAnswer(null)}>Écarter</Button>
              {errors.length ? <Text as="span" size="sm" tone="danger">{errors.length} séance{errors.length > 1 ? 's' : ''} à corriger avant d’enregistrer.</Text> : blocked ? <Text as="span" size="sm" tone="danger">Corrige les points bloquants (demande un autre programme).</Text> : null}
            </Cluster>
          ) : null}
          {save.error ? <Text size="sm" tone="danger" role="alert">{save.error.kind === 'error' ? (save.error.fields?.[0]?.rule ?? save.error.message) : 'Pas de connexion : réessaie.'}</Text> : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
