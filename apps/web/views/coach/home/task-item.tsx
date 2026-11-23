'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { addDays, formatEstimate, type AutoRule } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import {
  AnchorButton, Badge, Button, Cluster, Field, Input, LinkButton, MenuItem, Popover, Select, Stack, Text, type Tone,
} from '@/design';
import { AppointmentForm } from './appointment-form';
import { ESTIMATES } from './task-form';
import { useAction } from '@/views/coach/use-action';
import s from './home.module.css';

export interface TaskView {
  key: string; source: 'manual' | 'auto'; id: string | null; rule: AutoRule | null; ref: string; revision: number | null; link: string | null;
  athlete: { id: string; name: string; timeZone?: string } | null; athleteHref: string | null; team: string | null;
  title: string; reason: string; meta: string[]; priority: number; priorityLabel: string; recurrence: string | null; notes: string | null;
  slot: { slotOn: string | null; slotTime: string | null; estimateMin: number | null };
}

const PRIORITY_TONE: Record<number, Tone | null> = { 0: null, 1: null, 2: 'warning', 3: 'danger' };

/** Une ligne « À faire » : quoi, pourquoi, pour quand, et l’action qui la fait avancer (CE-H-01, D-065, refonte D-144). */
export function TaskItem({ wid, task: t, today, timeZone }: { wid: string; task: TaskView; today: string; timeZone: string }) {
  const { act, pending, error } = useAction();
  const [callOpen, setCallOpen] = useState(false);
  const call = t.rule === 'onboarding_call' && t.athlete?.timeZone ? t.athlete.timeZone : null;
  const patch = (body: Record<string, unknown>) => act('PATCH', `/api/v1/workspaces/${wid}/tasks/${t.id}`, { expectedRevision: t.revision, ...body });
  const snooze = (days: number) => act('PUT', `/api/v1/workspaces/${wid}/auto-tasks/${t.ref}`, { rule: t.rule, until: addDays(today, days) });
  const tone = PRIORITY_TONE[t.priority] ?? null;
  const open = t.link && !call
    ? (t.link.startsWith('#') ? <AnchorButton href={t.link} size="sm" variant="primary">Y aller</AnchorButton> : <LinkButton href={t.link} size="sm" variant={t.rule === 'profile_missing' ? 'secondary' : 'primary'}>Ouvrir</LinkButton>)
    : null;

  return (
    <li className={s.task} data-prio={t.priority}>
      <div className={s.taskMain}>
        <p className={s.taskTitle}>
          {t.title}
          {t.athlete ? <> · {t.athleteHref ? <Link href={t.athleteHref}>{t.athlete.name}</Link> : t.athlete.name}</> : null}
          {t.team ? ` · ${t.team}` : ''}
        </p>
        <p className={s.taskWhy}>{t.reason}</p>
        <Cluster gap={2} className={s.taskMeta}>
          <span>{t.meta.join(' · ')}</span>
          {t.recurrence ? <Badge>{t.recurrence}</Badge> : null}
          {tone ? <Badge tone={tone}>{t.priorityLabel}</Badge> : null}
          {t.source === 'auto' ? <Badge tone="info">Suivi automatique</Badge> : null}
        </Cluster>
        {t.notes ? <Text size="sm" muted prose>{t.notes}</Text> : null}
      </div>
      <Cluster gap={2} className={s.taskActions}>
        {t.rule === 'profile_missing' && t.athlete ? <RelaunchQuestionnaire wid={wid} athlete={t.athlete} today={today} /> : null}
        {call && t.athlete ? <Button size="sm" variant="primary" icon="calendar" aria-expanded={callOpen} onClick={() => setCallOpen((v) => !v)}>Planifier l’appel</Button> : null}
        {open}
        {t.source === 'manual' && t.id ? (
          <>
            <SlotPopover wid={wid} id={t.id} revision={t.revision} slot={t.slot} today={today} />
            <Button size="sm" icon="check" loading={pending} onClick={() => void patch({ status: 'done' })}>Terminé</Button>
            <Popover iconOnly icon="more" label={`Plus d’actions : ${t.title}`}>
              {(close) => (
                <>
                  <MenuItem onClick={() => { close(); void patch({ status: 'in_progress' }); }}>En cours</MenuItem>
                  <MenuItem onClick={() => { close(); void patch({ status: 'waiting' }); }}>En attente</MenuItem>
                  <MenuItem onClick={() => { close(); void patch({ dueOn: addDays(today, 1), status: 'postponed' }); }}>Reporter à demain</MenuItem>
                  <MenuItem onClick={() => { close(); void patch({ dueOn: addDays(today, 7), status: 'postponed' }); }}>Reporter d’une semaine</MenuItem>
                  <MenuItem tone="danger" onClick={() => { close(); void patch({ status: 'canceled' }); }}>Annuler la tâche</MenuItem>
                </>
              )}
            </Popover>
          </>
        ) : t.source === 'auto' ? (
          <Popover label={`Plus tard : ${t.title}`} text="Plus tard" icon="clock">
            {(close) => (
              <>
                <MenuItem onClick={() => { close(); void snooze(1); }}>Demain</MenuItem>
                <MenuItem onClick={() => { close(); void snooze(3); }}>Dans 3 jours</MenuItem>
                <MenuItem onClick={() => { close(); void snooze(7); }}>Dans une semaine</MenuItem>
                {t.rule === 'onboarding_call' ? <MenuItem onClick={() => { close(); void snooze(3650); }}>Pas besoin d’appel</MenuItem> : null}
              </>
            )}
          </Popover>
        ) : null}
      </Cluster>
      {error ? <Text size="sm" tone="danger" role="alert" className={s.taskError}>{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
      {callOpen && call && t.athlete ? (
        <div className={s.taskPanel}>
          <AppointmentForm wid={wid} idPrefix={`call-${t.athlete.id}`} athletes={[{ id: t.athlete.id, name: t.athlete.name, timeZone: call }]} athleteId={t.athlete.id}
            timeZone={call ?? timeZone} today={today} defaultTitle={`Appel de bienvenue avec ${t.athlete.name.split(' ')[0]}`}
            onDone={() => setCallOpen(false)} onCancel={() => setCallOpen(false)} />
        </div>
      ) : null}
    </li>
  );
}

/** D-065 : le créneau de travail d’une tâche (jour, heure facultative) et sa durée estimée. */
function SlotPopover({ wid, id, revision, slot, today }: { wid: string; id: string; revision: number | null; slot: TaskView['slot']; today: string }) {
  const { act, pending } = useAction();
  const fid = (k: string) => `slot-${id}-${k}`;
  return (
    <Popover label="Planifier un créneau de travail" text={slot.slotOn ? 'Créneau' : 'Planifier'} icon="clock">
      {(close) => (
        <form onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const on = (f.get('slotOn') as string) || null;
          const ok = await act('PATCH', `/api/v1/workspaces/${wid}/tasks/${id}`, {
            expectedRevision: revision, slotOn: on, slotTime: on ? (f.get('slotTime') as string) || null : null,
            estimateMin: f.get('estimateMin') ? Number(f.get('estimateMin')) : null,
          });
          if (ok) close();
        }}>
          <Stack gap={3} className={s.slotForm}>
            <Field id={fid('on')} label="Jour"><Input id={fid('on')} name="slotOn" type="date" defaultValue={slot.slotOn ?? today} /></Field>
            <Field id={fid('time')} label="Heure" hint="Facultatif"><Input id={fid('time')} name="slotTime" type="time" step={300} defaultValue={slot.slotTime ?? ''} hasHint /></Field>
            <Field id={fid('est')} label="Durée estimée">
              <Select id={fid('est')} name="estimateMin" defaultValue={slot.estimateMin ?? ''}><option value="">—</option>{ESTIMATES.map((m) => <option key={m} value={m}>{formatEstimate(m)}</option>)}</Select>
            </Field>
            <Cluster gap={2}>
              <Button type="submit" size="sm" variant="primary" loading={pending}>Enregistrer</Button>
              {slot.slotOn ? <Button size="sm" variant="ghost" disabled={pending}
                onClick={() => void act('PATCH', `/api/v1/workspaces/${wid}/tasks/${id}`, { expectedRevision: revision, slotOn: null }).then((ok) => ok && close())}>Retirer le créneau</Button> : null}
            </Cluster>
          </Stack>
        </form>
      )}
    </Popover>
  );
}

/**
 * Relance du questionnaire (profil sportif) : message explicite du coach dans la conversation, avec le lien
 * vers le questionnaire, puis le suivi est mis de côté 3 jours pour ne pas relancer en boucle.
 */
function RelaunchQuestionnaire({ wid, athlete, today }: { wid: string; athlete: { id: string; name: string }; today: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const first = athlete.name.split(' ')[0] ?? athlete.name;
  async function send() {
    setState('sending');
    const open = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/athletes/${athlete.id}/conversations`, {}, newKey());
    if (!open.ok) { setState('error'); return; }
    const body = `Bonjour ${first} ! Peux-tu remplir ton profil sportif ? Deux minutes suffisent, et ça m’aide à adapter tes séances : ${window.location.origin}/athlete/${wid}/setup`;
    const sent = await mutate('POST', `/api/v1/workspaces/${wid}/conversations/${open.data.id}/messages`, { body }, newKey());
    if (!sent.ok) { setState('error'); return; }
    await mutate('PUT', `/api/v1/workspaces/${wid}/auto-tasks/${athlete.id}`, { rule: 'profile_missing', until: addDays(today, 3) }, newKey());
    setState('sent');
    router.refresh();
  }
  if (state === 'sent') return <Text size="sm" tone="success" role="status">Relance envoyée à {first}.</Text>;
  return (
    <>
      <Button size="sm" variant="primary" icon="send" loading={state === 'sending'} onClick={() => void send()}
        title={`Envoie à ${first} un message avec le lien du questionnaire`}>Relancer {first}</Button>
      {state === 'error' ? <Text size="sm" tone="danger" role="alert">Envoi impossible. Réessaie.</Text> : null}
    </>
  );
}
