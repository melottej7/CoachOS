'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LEVEL_LABELS, LEVELS, SPORT_LABELS, SPORTS, type Level, type Sport, type WeekReview } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Banner, Button, Card, Cluster, Field, Grid, IconButton, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { useAction } from '@/views/coach/use-action';
import s from './fiche.module.css';

const errText = (e: ReturnType<typeof useIntent>['error']) => (e ? (e.kind === 'error' ? e.fields[0]?.rule ?? e.message : 'Connexion perdue. Réessaie.') : null);

/** Groupes de l’élève (lot G) : retirer d’un groupe, ajouter à un autre. */
export function TeamMembership({ wid, aid, teams, all }: { wid: string; aid: string; teams: { id: string; name: string }[]; all: { id: string; name: string }[] }) {
  const { act, pending, error } = useAction();
  const others = all.filter((t) => !teams.some((m) => m.id === t.id));
  return (
    <Stack gap={2}>
      <Cluster gap={2} role="group" aria-label="Groupes de l’élève">
        {teams.map((t) => (
          <span key={t.id} className={s.chip}>
            <Badge tone="coach">{t.name}</Badge>
            <IconButton icon="close" size="sm" label={`Retirer du groupe ${t.name}`} disabled={pending} onClick={() => void act('DELETE', `/api/v1/workspaces/${wid}/teams/${t.id}/athletes/${aid}`)} />
          </span>
        ))}
        {!teams.length && !others.length ? <Text size="sm" muted>Aucun groupe dans ton espace pour l’instant.</Text> : null}
      </Cluster>
      {others.length ? (
        <Select value="" aria-label="Ajouter à un groupe" disabled={pending} className={s.auto}
          onChange={(e) => { if (e.target.value) void act('PUT', `/api/v1/workspaces/${wid}/teams/${e.target.value}/athletes/${aid}`); }}>
          <option value="">Ajouter à un groupe…</option>
          {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      ) : null}
      {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
    </Stack>
  );
}

/** Niveau confirmé par le coach, sport par sport (le déclaré de l’élève est rappelé à côté). */
export function LevelConfirm({ wid, aid, sport, declared, confirmed, first }: { wid: string; aid: string; sport: Sport; declared: Level | null; confirmed: Level | null; first: string }) {
  const { act, pending, error } = useAction();
  const [level, setLevel] = useState<Level>(confirmed ?? declared ?? 'intermediate');
  const id = `level-${sport}`;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void act('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/levels`, { sport, level }); }}>
      <Stack gap={2}>
        <Field id={id} label={SPORT_LABELS[sport]} hint={`${confirmed ? `Confirmé : ${LEVEL_LABELS[confirmed].label}.` : 'Pas encore confirmé.'}${declared ? ` Déclaré par ${first} : ${LEVEL_LABELS[declared].label}.` : ''}`}>
          <Cluster gap={2} nowrap>
            <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-describedby={`${id}-hint`}>
              {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l].label}</option>)}
            </Select>
            <Button type="submit" size="sm" variant={confirmed ? 'secondary' : 'primary'} loading={pending}>{confirmed ? 'Mettre à jour' : 'Confirmer'}</Button>
          </Cluster>
        </Field>
        {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
      </Stack>
    </form>
  );
}

/** Ajouter un objectif (visible par l’élève). */
export function GoalForm({ wid, aid, sport }: { wid: string; aid: string; sport: Sport | null }) {
  const { act, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <Cluster><Button size="sm" icon="plus" onClick={() => setOpen(true)}>Ajouter un objectif</Button></Cluster>;
  return (
    <Card pad={4}>
      <form onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const ok = await act('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals`, { title: f.get('title'), sport: f.get('sport'), targetDate: f.get('targetDate') || null });
        if (ok) { form.reset(); setOpen(false); }
      }}>
        <Stack gap={4}>
          <ErrorSummary error={error} labels={{ title: 'Objectif', targetDate: 'Échéance' }} ids={{ title: 'goal-title', targetDate: 'goal-date' }} />
          <Field id="goal-title" label="Objectif"><Input id="goal-title" name="title" maxLength={200} required placeholder="Ex. Semi-marathon en moins de 1 h 45" /></Field>
          <Grid min={180} gap={4}>
            <Field id="goal-sport" label="Sport"><Select id="goal-sport" name="sport" defaultValue={sport ?? 'running'}>{SPORTS.map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}</Select></Field>
            <Field id="goal-date" label="Échéance" hint="Facultatif"><Input id="goal-date" name="targetDate" type="date" hasHint /></Field>
          </Grid>
          <Cluster gap={2}>
            <Button type="submit" size="sm" variant="primary" loading={pending}>Ajouter l’objectif</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          </Cluster>
        </Stack>
      </form>
    </Card>
  );
}

/** Note privée du coach (jamais vue par l’élève). */
export function NoteForm({ wid, aid }: { wid: string; aid: string }) {
  const { act, pending, error } = useAction();
  const [body, setBody] = useState('');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await act('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/notes`, { body })) setBody(''); }}>
      <Stack gap={3}>
        <Field id="note-body" label="Nouvelle note" hint="Visible par toi seul·e, jamais par l’élève">
          <Textarea id="note-body" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ex. Préfère les séances le matin, revient d’une pause de deux mois." hasHint />
        </Field>
        <Cluster><Button type="submit" size="sm" variant="primary" loading={pending} disabled={!body.trim()}>Enregistrer la note</Button></Cluster>
        {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
      </Stack>
    </form>
  );
}

/** Compte rendu d’un rendez-vous (et rendez-vous marqué fait). */
export function AppointmentReport({ wid, id, revision, report }: { wid: string; id: string; revision: number; report: string | null }) {
  const { act, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(report ?? '');
  if (!open) return <Button size="sm" icon="edit" onClick={() => setOpen(true)}>{report ? 'Modifier le compte rendu' : 'Faire le compte rendu'}</Button>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await act('PATCH', `/api/v1/workspaces/${wid}/appointments/${id}`, { expectedRevision: revision, status: 'done', report: text })) setOpen(false); }}>
      <Stack gap={3}>
        <Field id={`rep-${id}`} label="Compte rendu"><Textarea id={`rep-${id}`} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <Cluster gap={2}>
          <Button type="submit" size="sm" variant="primary" loading={pending}>Enregistrer et marquer fait</Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
        </Cluster>
        {errText(error) ? <Text size="sm" tone="danger" role="alert">{errText(error)}</Text> : null}
      </Stack>
    </form>
  );
}

/** D-073 : résumé de la semaine, sans IA. « Poser la question » la met dans la conversation : rien n’est envoyé seul. */
export function WeekReviewCard({ review, wid, aid, first, title }: { review: WeekReview; wid: string; aid: string; first: string; title: string }) {
  return (
    <Stack gap={3}>
      <Text size="sm" muted>{title}</Text>
      <Stack as="ul" gap={1}>{review.facts.map((f, i) => <li key={i}><Text>{f}</Text></li>)}</Stack>
      {review.question ? (
        <Banner tone="coach" title="Question à poser" action={(
          <Button size="sm" icon="chat" onClick={() => {
            try { sessionStorage.setItem(`coachos:draft:${aid}`, review.question ?? ''); } catch { /* commodité seulement */ }
            window.location.href = `/coach/${wid}/messages/${aid}`;
          }}>Poser la question à {first}</Button>
        )}>{review.question}</Banner>
      ) : null}
    </Stack>
  );
}

/**
 * D-115 · Effacement définitif du dossier d’un élève par le propriétaire. Confirmation en tapant le prénom :
 * séances, retours, échanges, bilan, et le compte s’il n’est lié à aucun autre espace.
 */
export function EraseAthlete({ wid, aid, name, requested }: { wid: string; aid: string; name: string; requested: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ erased: boolean; accountDeleted: boolean }>();
  const [open, setOpen] = useState(requested);
  const [typed, setTyped] = useState('');
  const first = name.split(' ')[0] ?? name;
  const ok = typed.trim().toLocaleLowerCase('fr') === first.toLocaleLowerCase('fr');
  async function erase() {
    if (!ok) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/erase`, {});
    if (r) router.push(`/coach/${wid}/athletes?notice=${r.accountDeleted ? 'erased-account' : 'erased'}`);
  }
  if (!open) return <Cluster><Button variant="ghost" icon="trash" onClick={() => setOpen(true)}>Effacer les données de {first}…</Button></Cluster>;
  return (
    <Stack gap={4}>
      <ErrorSummary error={error} onRetry={() => void erase()} />
      <Banner tone="danger" title="Effacement définitif">Cette action supprime tout le dossier de {name} : séances, retours, échanges, bilan, rendez-vous, notes. Elle ne peut pas être annulée.</Banner>
      <Field id="erase-confirm" label={`Pour confirmer, écris le prénom « ${first} »`}>
        <Input id="erase-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <Cluster gap={2}>
        <Button variant="danger" icon="trash" loading={pending} disabled={!ok} onClick={() => void erase()}>Effacer les données de {first}</Button>
        <Button variant="ghost" disabled={pending} onClick={() => { setOpen(false); setTyped(''); }}>Annuler</Button>
      </Cluster>
    </Stack>
  );
}
