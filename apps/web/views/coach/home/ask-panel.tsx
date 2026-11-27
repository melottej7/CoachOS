'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SPORT_LABELS, formatShortDate, type Sport } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Button, Card, Cluster, LinkButton, Stack, Text, Textarea } from '@/design';

/**
 * IA-4 (D-192) · « Demander » : une question ou un brouillon. Réponse courte, chaque fait relié à sa page ; brouillons
 * de réponse, de séance et de tâche, que le coach envoie, ouvre ou crée lui-même. Rien n’est envoyé ni publié ici.
 */

interface Answer {
  source: 'simulation' | 'claude'; status: 'ready' | 'insufficient'; answer: string;
  facts: { text: string; href: string | null }[];
  replies: { athleteId: string; name: string; text: string; href: string }[];
  sessions: { name: string; date: string; sport: Sport; title: string; notation: string; unread: string[]; href: string }[];
  tasks: { title: string; athleteId: string | null; dueOn: string | null }[];
}

const EXAMPLES = ['Qui n’a pas fait ses séances cette semaine ?', 'Résume la semaine dernière', 'Prépare une réponse au dernier retour'];

export function AskPanel({ wid, initial = '', compact = false }: { wid: string; initial?: string; compact?: boolean }) {
  const [text, setText] = useState(initial);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [created, setCreated] = useState<Set<number>>(new Set());
  const ask = useIntent<Answer & { suggestionId: string }>();
  const task = useIntent<{ id: string }>();

  async function go(q = text) {
    setText(q);
    const r = await ask.run('POST', `/api/v1/workspaces/${wid}/ai-assistant`, { text: q });
    if (r) { setAnswer(r); setCopied(null); setCreated(new Set()); }
  }

  return (
    <Card pad={compact ? 4 : 5}>
      <Stack gap={3}>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim().length >= 3) void go(); }}>
          <Stack gap={2}>
            <label htmlFor="ask-text"><Text strong>Demander à l’IA</Text></label>
            <Textarea id="ask-text" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Qui n’a pas fait ses séances cette semaine ?" />
            <Cluster gap={2}>
              <Button type="submit" size="sm" variant="primary" icon="bolt" loading={ask.pending} disabled={text.trim().length < 3}>Demander</Button>
              {!answer ? EXAMPLES.map((x) => <Button key={x} size="sm" variant="ghost" onClick={() => void go(x)}>{x}</Button>) : null}
            </Cluster>
          </Stack>
        </form>
        {ask.error ? <Text size="sm" tone="danger" role="alert">{ask.error.kind === 'error' ? (ask.error.fields?.[0]?.rule ?? ask.error.message) : 'Pas de connexion : réessaie.'}</Text> : null}
        {answer ? (
          <Stack gap={3} aria-live="polite">
            <Cluster gap={2}>
              <Badge tone={answer.source === 'claude' ? 'coach' : 'neutral'}>{answer.source === 'claude' ? 'Claude' : 'IA simulée'}</Badge>
              {answer.status === 'insufficient' ? <Badge tone="warning">Données insuffisantes</Badge> : null}
            </Cluster>
            <Text>{answer.answer}</Text>
            {answer.facts.length ? (
              <ul style={{ margin: 0, paddingLeft: '1.2em' }} aria-label="Sources">
                {answer.facts.map((f, k) => <li key={k}><Text as="span" size="sm">{f.href ? <Link href={f.href}>{f.text}</Link> : f.text}</Text></li>)}
              </ul>
            ) : null}
            {answer.replies.map((r, k) => (
              <Card key={`r${k}`} pad={3}>
                <Stack gap={2}>
                  <Text size="sm" strong>Brouillon de réponse à {r.name} · à relire, rien n’est envoyé</Text>
                  <Text size="sm">{r.text}</Text>
                  <Cluster gap={2}>
                    <Button size="sm" icon="copy" onClick={() => { void navigator.clipboard?.writeText(r.text); setCopied(k); }}>{copied === k ? 'Copié' : 'Copier'}</Button>
                    <LinkButton size="sm" href={r.href} icon="chat">Ouvrir la conversation</LinkButton>
                  </Cluster>
                </Stack>
              </Card>
            ))}
            {answer.sessions.map((x, k) => (
              <Card key={`s${k}`} pad={3}>
                <Stack gap={2}>
                  <Text size="sm" strong>Brouillon de séance pour {x.name} · {formatShortDate(x.date)} · {SPORT_LABELS[x.sport]}</Text>
                  <Text size="sm"><code>{x.notation || '—'}</code></Text>
                  {x.unread.length ? <Text size="sm" tone="danger">Non lu : {x.unread.join(' · ')}</Text> : null}
                  <Cluster><LinkButton size="sm" href={x.href} icon="edit">Ouvrir dans l’éditeur</LinkButton></Cluster>
                </Stack>
              </Card>
            ))}
            {answer.tasks.map((t, k) => (
              <Card key={`t${k}`} pad={3}>
                <Cluster between gap={2}>
                  <Text size="sm"><strong>Tâche proposée</strong> · {t.title}{t.dueOn ? ` · pour le ${formatShortDate(t.dueOn)}` : ''}</Text>
                  <Button size="sm" disabled={created.has(k)} loading={task.pending} onClick={async () => {
                    const r = await task.run('POST', `/api/v1/workspaces/${wid}/tasks`, { title: t.title, kind: 'other', athleteId: t.athleteId, dueOn: t.dueOn });
                    if (r) setCreated((c) => new Set(c).add(k));
                  }}>{created.has(k) ? 'Tâche créée' : 'Créer la tâche'}</Button>
                </Cluster>
              </Card>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
