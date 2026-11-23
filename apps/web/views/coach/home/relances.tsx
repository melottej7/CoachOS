'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ADHERENCE_LABELS, RELANCE_LABELS, type AdherenceStatus, type RelanceKind } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Button, Card, Cluster, Disclosure, Field, Heading, Stack, Text, Textarea, type Tone } from '@/design';
import s from './home.module.css';

export interface RelanceItem {
  athleteId: string; name: string; first: string; status: AdherenceStatus; reason: string; relance: RelanceKind | null;
  draft: string | null; waitingSince: string | null; workoutId: string | null;
}

const STATUS_TONE: Record<AdherenceStatus, Tone> = { silent: 'danger', at_risk: 'warning', watch: 'info', on_track: 'success', no_plan: 'neutral' };

/**
 * D-103 · Relances du jour, refonte Chrono (D-144) : qui contacter, pourquoi, et un message déjà rédigé que le coach
 * relit, modifie et envoie lui-même dans la conversation de l’élève. Une relance envoyée passe « en attente de réponse ».
 */
export function Relances({ wid, items }: { wid: string; items: RelanceItem[] }) {
  const todo = items.filter((i) => i.relance && i.relance !== 'bravo' && !i.waitingSince);
  const waiting = items.filter((i) => i.relance && i.relance !== 'bravo' && i.waitingSince);
  const bravo = items.filter((i) => i.relance === 'bravo' && !i.waitingSince);
  return (
    <Card as="section" pad={5} aria-labelledby="relances-title">
      <Stack gap={4}>
        <Stack gap={1}>
          <Cluster gap={2}>
            <Heading level={2} size={4} id="relances-title">Relances</Heading>
            {todo.length ? <Badge tone="signal">{todo.length} à faire</Badge> : null}
          </Cluster>
          <Text size="sm" muted>Message prêt : tu le relis, tu l’ajustes et tu l’envoies. <Link href={`/coach/${wid}/settings#relances`}>Mes modèles</Link></Text>
        </Stack>
        {todo.length ? (
          <ul className={s.relances}>{todo.map((i) => <RelanceRow key={i.athleteId} wid={wid} item={i} />)}</ul>
        ) : (
          <Text muted>{!items.length ? 'Pas encore d’élève actif.' : waiting.length ? 'Rien d’autre à relancer aujourd’hui.' : 'Personne à relancer aujourd’hui : tout le monde donne des nouvelles.'}</Text>
        )}
        {waiting.length ? (
          <Text size="sm" muted>
            En attente de réponse : {waiting.map((i, k) => <span key={i.athleteId}>{k ? ', ' : ''}<Link href={`/coach/${wid}/messages/${i.athleteId}`}>{i.first}</Link></span>)} (relancé{waiting.length > 1 ? 's' : ''} ces 3 derniers jours).
          </Text>
        ) : null}
        {bravo.length ? (
          <Disclosure summary={`Encourager (${bravo.length}) · toutes leurs séances faites ces 7 derniers jours`}>
            <ul className={s.relances}>{bravo.map((i) => <RelanceRow key={i.athleteId} wid={wid} item={i} />)}</ul>
          </Disclosure>
        ) : null}
      </Stack>
    </Card>
  );
}

function RelanceRow({ wid, item }: { wid: string; item: RelanceItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.draft ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);
  const fid = `relance-${item.athleteId}`;

  async function send() {
    if (!text.trim()) return;
    setState('sending'); setError(null);
    const c = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/athletes/${item.athleteId}/conversations`, {}, newKey());
    if (!c.ok) { setState('idle'); setError('Connexion perdue. Ton message est gardé : réessaie.'); return; }
    const r = await mutate('POST', `/api/v1/workspaces/${wid}/conversations/${c.data.id}/messages`, { body: text.trim(), workoutId: item.relance === 'no_feedback' || item.relance === 'missed' ? item.workoutId : null }, key);
    if (!r.ok) { setState('idle'); setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Ton message est gardé : réessaie.'); return; }
    setState('sent');
    router.refresh();
  }

  return (
    <li className={s.relance}>
      <Cluster gap={2}>
        <Link className={s.relanceName} href={`/coach/${wid}/athletes/${item.athleteId}`}>{item.name}</Link>
        <Badge tone={STATUS_TONE[item.status]} dot>{ADHERENCE_LABELS[item.status]}</Badge>
      </Cluster>
      <Text size="sm" muted>{item.reason}</Text>
      {state === 'sent' ? (
        <Text size="sm" tone="success" role="status">Envoyé à {item.first}. <Link href={`/coach/${wid}/messages/${item.athleteId}`}>Voir la conversation</Link></Text>
      ) : open ? (
        <Stack gap={3}>
          <Field id={fid} label={`Message à ${item.first}`} error={error}>
            <Textarea id={fid} rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} invalid={!!error} />
          </Field>
          <Cluster gap={2}>
            <Button variant="primary" icon="send" loading={state === 'sending'} disabled={!text.trim()} onClick={() => void send()}>Envoyer à {item.first}</Button>
            <Button variant="ghost" onClick={() => { setOpen(false); setText(item.draft ?? ''); setError(null); }}>Annuler</Button>
          </Cluster>
        </Stack>
      ) : (
        <Cluster><Button size="sm" icon="edit" onClick={() => setOpen(true)}>{item.relance ? RELANCE_LABELS[item.relance] : 'Écrire'} : préparer le message</Button></Cluster>
      )}
    </li>
  );
}
