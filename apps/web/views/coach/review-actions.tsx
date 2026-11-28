'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QUICK_REPLIES } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { useIntent } from '@/components/use-intent';
import { Button, Cluster, Input, Kbd, Stack, Text } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { useAction } from '@/views/coach/use-action';
import s from '@/views/coach/review/review.module.css';

/** Marque la version courante du retour comme traitée et clôt le cas. Aucun message envoyé (X11). */
export function MarkReviewed({ wid, aid, sid, expectedRevision, after }: { wid: string; aid: string; sid: string; expectedRevision: number; after: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ reviewedAt: string }>();
  async function review() {
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback/review`, { expectedRevision });
    if (done) { router.replace(after); router.refresh(); }
  }
  const stale = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  return (
    <Stack gap={3}>
      <ErrorSummary error={error} onRetry={() => void review()} />
      {stale ? <Cluster><Button variant="ghost" onClick={() => router.refresh()}>Afficher la nouvelle version du retour</Button></Cluster> : null}
      <Cluster><Button id="mark-reviewed" variant="primary" icon="check" loading={pending} onClick={() => void review()}>Marquer comme traité</Button></Cluster>
    </Stack>
  );
}

/** D-082 : reporter un retour ; il quitte la file et y revient seul à la date choisie (7 h, heure du coach). */
export function SnoozeReview({ wid, rid, choices, after }: { wid: string; rid: string; choices: { label: string; at: string }[]; after: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  return (
    <Stack gap={2}>
      <Cluster gap={2}>
        <Text size="sm" muted>Pas maintenant ? Reporter à</Text>
        {choices.map((c) => (
          <Button key={c.label} size="sm" variant="ghost" disabled={pending}
            onClick={async () => { if (await run('PATCH', `/api/v1/workspaces/${wid}/reviews/${rid}`, { state: 'snoozed', snoozeUntil: c.at })) router.push(after); }}>
            {c.label}
          </Button>
        ))}
      </Cluster>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
    </Stack>
  );
}

/** Remettre tout de suite dans la file un retour reporté. */
export function RequeueReview({ wid, rid }: { wid: string; rid: string }) {
  const { act, pending, error } = useAction();
  return (
    <>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => void act('PATCH', `/api/v1/workspaces/${wid}/reviews/${rid}`, { state: 'open' })}>Remettre maintenant</Button>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </>
  );
}

/**
 * Répondre en un geste : phrases toutes faites ou texte libre ; le message part seulement quand on clique.
 * D-202 : depuis un retour à traiter (`review`), répondre le marque aussi traité et passe au suivant : répondre, c’est traiter.
 */
export function QuickReply({ wid, athleteId, first, workoutId, review }: {
  wid: string; athleteId: string; first: string; workoutId?: string;
  review?: { sid: string; expectedRevision: number; after: string };
}) {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(body: string) {
    if (!body.trim() || busy) return;
    setBusy(true); setError(null);
    const c = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/athletes/${athleteId}/conversations`, {}, newKey());
    const r = c.ok ? await mutate('POST', `/api/v1/workspaces/${wid}/conversations/${c.data.id}/messages`, { body, workoutId: workoutId ?? null }, newKey()) : null;
    if (!r?.ok) { setBusy(false); setError('Envoi impossible. Ton texte est gardé : réessaie.'); return; }
    setSent(body); setText('');
    if (review) {
      const done = await mutate('POST', `/api/v1/workspaces/${wid}/athletes/${athleteId}/workouts/${review.sid}/feedback/review`, { expectedRevision: review.expectedRevision }, newKey());
      if (done.ok) { router.replace(review.after); router.refresh(); return; }
      setError('Message envoyé. Le retour a changé entre-temps : relis-le, puis marque-le traité.');
      router.refresh();
    }
    setBusy(false);
  }
  return (
    <Stack gap={3}>
      <Text size="sm" muted>{review
        ? <>Répondre à {first} en un geste : le message part quand tu cliques, et le retour est marqué traité.</>
        : <>Répondre à {first} en un geste : le message part seulement quand tu cliques.</>}</Text>
      <Cluster gap={2} className={s.quick}>
        {QUICK_REPLIES.map((q) => <Button key={q} size="sm" disabled={busy} onClick={() => void send(q)}>{q}</Button>)}
      </Cluster>
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <Cluster gap={2} nowrap>
          <label className="ds-visually-hidden" htmlFor="qr-text">Ta réponse à {first}</label>
          <Input id="qr-text" maxLength={2000} placeholder="Ou écris ta réponse…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="primary" icon="send" loading={busy} disabled={!text.trim()}>Envoyer</Button>
        </Cluster>
      </form>
      {sent ? <Text size="sm" tone="success" role="status">Envoyé à {first} : « {sent} ». <Link href={`/coach/${wid}/messages/${athleteId}`}>Voir la conversation</Link></Text> : null}
      {error ? <Text size="sm" tone="danger" role="alert">{error}</Text> : null}
    </Stack>
  );
}

/**
 * D-090 : résultat d’un test vu par le coach. Deux gestes explicites, le coach décide : l’ajouter aux résultats
 * de référence et/ou mettre à jour la VMA (zones et allures).
 */
export function TestResultActions({ wid, aid, sport, name, meters, seconds, doneOn, vmaKmh, currentVma }: {
  wid: string; aid: string; sport: string; name: string; meters: number; seconds: number; doneOn: string; vmaKmh: number | null; currentVma: number | null;
}) {
  const router = useRouter();
  const perf = useIntent<unknown>();
  const vma = useIntent<unknown>();
  const [saved, setSaved] = useState<{ perf?: boolean; vma?: boolean }>({});
  const vmaText = (v: number) => `${String(v).replace('.', ',')} km/h`;
  const err = perf.error ?? vma.error;
  return (
    <Stack gap={2}>
      <Cluster gap={2}>
        <Button size="sm" icon={saved.perf ? 'check' : 'plus'} loading={perf.pending} disabled={saved.perf}
          onClick={async () => { if (await perf.run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/performances`, { sport, kind: 'test', name, distanceM: meters, durationS: seconds, doneOn })) { setSaved((x) => ({ ...x, perf: true })); router.refresh(); } }}>
          {saved.perf ? 'Ajouté aux résultats de référence' : 'Ajouter aux résultats de référence'}
        </Button>
        {vmaKmh && vmaKmh !== currentVma ? (
          <Button size="sm" variant="primary" icon={saved.vma ? 'check' : undefined} loading={vma.pending} disabled={saved.vma}
            onClick={async () => { if (await vma.run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh })) { setSaved((x) => ({ ...x, vma: true })); router.refresh(); } }}>
            {saved.vma ? `VMA mise à ${vmaText(vmaKmh)}` : `Mettre la VMA à ${vmaText(vmaKmh)}`}
          </Button>
        ) : null}
      </Cluster>
      {err ? <Text size="sm" tone="danger" role="alert">{err.kind === 'error' ? err.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </Stack>
  );
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * Boîte de réception au clavier (docs/18_REFONTE.md §2.2). File : J et K parcourent les retours, Entrée ouvre.
 * Détail : T marque traité, R va à la réponse, J ouvre le retour suivant. Jamais pendant une saisie.
 */
export function ReviewKeys({ mode }: { mode: 'queue' | 'detail' }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (mode === 'queue' && (k === 'j' || k === 'k')) {
        const rows = [...document.querySelectorAll<HTMLAnchorElement>('[data-review-row]')];
        if (!rows.length) return;
        const at = rows.indexOf(document.activeElement as HTMLAnchorElement);
        const next = at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (k === 'j' ? 1 : -1)));
        rows[next]!.focus();
        e.preventDefault();
      }
      if (mode === 'detail') {
        if (k === 't') { const b = document.getElementById('mark-reviewed'); if (b instanceof HTMLButtonElement && !b.disabled) { b.click(); e.preventDefault(); } }
        if (k === 'r') { document.getElementById('qr-text')?.focus(); e.preventDefault(); }
        if (k === 'j') { const a = document.getElementById('next-review'); if (a instanceof HTMLAnchorElement) { a.click(); e.preventDefault(); } }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode]);
  return (
    <Text size="sm" muted className="ds-keys">
      {mode === 'queue'
        ? <>Au clavier : <Kbd>J</Kbd> <Kbd>K</Kbd> pour parcourir, <Kbd>Entrée</Kbd> pour ouvrir.</>
        : <>Au clavier : <Kbd>T</Kbd> traité, <Kbd>R</Kbd> répondre, <Kbd>J</Kbd> retour suivant.</>}
    </Text>
  );
}
