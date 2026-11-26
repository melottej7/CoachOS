'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { describeBlock, DICTATION_MAX_CHARS, parseNotation, type Block, type Sport } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Button, Cluster, Icon, Stack, Text } from '@/design';
import { cx } from '@/design/cx';
import s from './builder.module.css';

/**
 * IA-1 (D-189) · « Dicter ou écrire avec l’IA » : le coach écrit ou dicte sa séance en langage courant (micro du clavier
 * du téléphone, ou bouton micro quand le navigateur sait reconnaître la voix) ; l’IA propose la séance dans la notation
 * de CoachOS ; le coach corrige le texte, voit l’aperçu et l’insère. Rien n’est publié : la séance reste un brouillon.
 */

interface Answer {
  suggestionId: string; source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; notation: string;
  lines: { text: string; error: string | null }[]; exercises: { name: string; where: 'library' | 'machine' | 'unknown' }[]; note: string;
}

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> ; resultIndex: number }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const recognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const WHERE: Record<Answer['exercises'][number]['where'], { tone: 'success' | 'info' | 'warning'; label: string }> = {
  library: { tone: 'success', label: 'dans ta bibliothèque' },
  machine: { tone: 'info', label: 'machine : ajoute-la depuis « Machines » pour sa fiche' },
  unknown: { tone: 'warning', label: 'inconnu : sans fiche ni vidéo' },
};

export function AiDictation({ wid, sport, athleteId, hasBlocks, onApply }: {
  wid: string; sport: Sport; athleteId: string | null; hasBlocks: boolean; onApply: (blocks: Block[], mode: 'replace' | 'append') => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState('');
  const [done, setDone] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const { run, pending, error } = useIntent<Answer>();

  useEffect(() => { setCanListen(Boolean(recognitionCtor())); return () => rec.current?.stop(); }, []);

  function listen() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'fr-BE'; r.interimResults = false; r.continuous = true;
    r.onresult = (e) => {
      let said = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) said += e.results[i]![0]!.transcript;
      if (said.trim()) setText((t) => `${t}${t && !/\s$/.test(t) ? ' ' : ''}${said.trim()}`.slice(0, DICTATION_MAX_CHARS));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  async function propose() {
    rec.current?.stop();
    setDone(false);
    const r = await run('POST', `/api/v1/workspaces/${wid}/ai-dictation`, { text, sport, athleteId });
    if (r) { setAnswer(r); setDraft(r.notation); }
  }

  const parsed = parseNotation(draft, sport);
  const ready = !!draft.trim() && !parsed.errors.length && parsed.blocks.length > 0;
  const unread = answer?.lines.filter((l) => l.error) ?? [];
  const insert = (mode: 'replace' | 'append') => {
    onApply(parsed.blocks, mode);
    setAnswer(null); setDraft(''); setText(''); setDone(true);
  };

  return (
    <details className={s.qn} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className={s.qnSummary}><Icon name="mic" size={16} />Dicter ou écrire avec l’IA</summary>
      <Stack gap={3} className={s.qnBody}>
        <Text size="sm" muted>
          Dis ta séance comme à un collègue : {sport === 'strength' ? '« échauffement 10 minutes vélo, puis presse 4 séries de 10 à 60 kilos, 2 minutes de repos, gainage 3 fois 45 secondes »' : '« 15 minutes tranquille, puis 3 fois 8 minutes à 90 % de VMA, récup 2 minutes »'}.
          L’IA l’écrit en texte de séance ; tu relis, tu corriges, puis tu l’insères. Rien n’est publié. Sur téléphone, le micro du clavier suffit.
        </Text>
        <label htmlFor={`${id}-in`} className={s.label}>Ta séance, en langage courant</label>
        <textarea id={`${id}-in`} className={cx(s.control, s.qnText, s.aiInput)} rows={4} maxLength={DICTATION_MAX_CHARS} value={text}
          onChange={(e) => setText(e.target.value)} placeholder={sport === 'strength' ? 'presse 4 séries de 10 à 60 kilos, 2 minutes de repos…' : '3 fois 8 minutes à 90 % de VMA, récup 2 minutes…'} />
        <Cluster gap={2}>
          <Button variant="primary" icon="bolt" loading={pending} disabled={text.trim().length < 3} onClick={() => void propose()}>Proposer la séance</Button>
          {canListen ? <Button icon="mic" aria-pressed={listening} onClick={listen}>{listening ? 'Arrêter la dictée' : 'Dicter'}</Button> : null}
          <Text as="span" size="sm" muted>{text.length} / {DICTATION_MAX_CHARS}</Text>
        </Cluster>
        {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? (error.fields?.[0]?.rule ?? error.message) : 'Pas de connexion : réessaie.'}</Text> : null}
        {done ? <Text size="sm" tone="success" role="status"><Icon name="check" size={14} /> Inséré dans la séance. Elle reste un brouillon tant que tu ne la publies pas.</Text> : null}

        {answer ? (
          <Stack gap={3} aria-live="polite">
            <Cluster gap={2}>
              <Text strong>Proposition</Text>
              <Badge tone={answer.source === 'claude' ? 'coach' : 'neutral'}>{answer.source === 'claude' ? 'Claude' : 'IA simulée'}</Badge>
            </Cluster>
            {answer.note ? <Text size="sm">{answer.note}</Text> : null}
            {unread.length ? (
              <Stack gap={1}>
                <Text size="sm" strong>À reprendre à la main (non inséré) :</Text>
                <ul className={s.qnErrors}>{unread.map((l, k) => <li key={k}>« {l.text} » · {l.error}</li>)}</ul>
              </Stack>
            ) : null}
            {answer.status === 'ready' || draft ? (
              <>
                <label htmlFor={`${id}-draft`} className={s.label}>Texte de la séance (modifiable)</label>
                <textarea id={`${id}-draft`} className={cx(s.control, s.qnText)} rows={Math.min(6, Math.max(3, Math.ceil(draft.length / 55)))} spellCheck={false} autoCapitalize="off"
                  value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={parsed.errors.length ? true : undefined} />
                {parsed.errors.length ? (
                  <ul className={s.qnErrors}>{parsed.errors.slice(0, 4).map((e, k) => <li key={k}>{e.message}</li>)}</ul>
                ) : ready ? (
                  <Stack gap={1} className={s.qnOk}>
                    <Text size="sm" tone="success"><Icon name="check" size={14} /> {parsed.blocks.length} bloc{parsed.blocks.length > 1 ? 's' : ''} compris</Text>
                    <ol className={s.preview}>{parsed.blocks.map((b, k) => <li key={k}>{describeBlock(b, sport)}</li>)}</ol>
                  </Stack>
                ) : null}
                {answer.exercises.length ? (
                  <ul className={s.preview} aria-label="Exercices nommés">
                    {answer.exercises.map((x) => <li key={x.name}>{x.name} · <Badge tone={WHERE[x.where].tone}>{WHERE[x.where].label}</Badge></li>)}
                  </ul>
                ) : null}
                <Cluster gap={2}>
                  <Button variant="primary" icon="check" disabled={!ready} onClick={() => insert(hasBlocks ? 'append' : 'replace')}>{hasBlocks ? 'Insérer à la fin de la séance' : 'Insérer dans la séance'}</Button>
                  {hasBlocks ? <Button disabled={!ready} onClick={() => insert('replace')}>Remplacer la séance</Button> : null}
                  <Button variant="ghost" onClick={() => { setAnswer(null); setDraft(''); }}>Écarter</Button>
                </Cluster>
              </>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </details>
  );
}
