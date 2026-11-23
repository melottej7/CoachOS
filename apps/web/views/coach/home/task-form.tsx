'use client';

import type { FormEvent } from 'react';
import { formatEstimate, PRIORITY_LABELS, TASK_KIND_LABELS, TASK_KINDS, TASK_RECURRENCES, TASK_RECURRENCE_LABELS, type TaskKind } from '@coachos/domain';
import { Button, Cluster, Disclosure, Field, Grid, Input, Select, Stack, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { useAction } from './use-action';

export const ESTIMATES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

const IDS = { title: 'task-title', kind: 'task-kind', athleteId: 'task-athlete', teamId: 'task-team', dueOn: 'task-due', priority: 'task-priority', recurrence: 'task-recurrence', slotOn: 'task-slot-on', slotTime: 'task-slot-time', estimateMin: 'task-estimate', notes: 'task-notes' };
const LABELS = { title: 'Quoi faire ?', kind: 'Type', athleteId: 'Élève', teamId: 'Groupe', dueOn: 'Échéance', priority: 'Priorité', recurrence: 'Répéter', slotOn: 'Jour du créneau', slotTime: 'Heure du créneau', estimateMin: 'Durée estimée', notes: 'Notes' };

/** Nouvelle tâche (CE-H-01, D-059, D-065) : quoi, pour qui, pour quand, à quelle priorité, et quand je m’y mets. */
export function TaskForm({ wid, athletes, teams, athleteId, today, onDone, onCancel }: {
  wid: string; athletes: { id: string; name: string }[]; teams: { id: string; name: string }[]; athleteId?: string; today: string; onDone: () => void; onCancel: () => void;
}) {
  const { act, pending, error } = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const ok = await act('POST', `/api/v1/workspaces/${wid}/tasks`, {
      title: f.get('title'), kind: f.get('kind'), athleteId: f.get('athleteId') || null, teamId: f.get('teamId') || null,
      dueOn: f.get('dueOn') || null, priority: Number(f.get('priority')), notes: f.get('notes') || null,
      recurrence: f.get('recurrence') || null,
      slotOn: f.get('slotOn') || null, slotTime: f.get('slotOn') ? f.get('slotTime') || null : null,
      estimateMin: f.get('estimateMin') ? Number(f.get('estimateMin')) : null,
    });
    if (ok) { form.reset(); onDone(); }
  }
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={4}>
        <ErrorSummary error={error} labels={LABELS} ids={IDS} />
        <Field id={IDS.title} label={LABELS.title}>
          <Input id={IDS.title} name="title" maxLength={200} required placeholder="Ex. Appeler Emma pour préparer son bloc de décembre" />
        </Field>
        <Grid min={180} gap={4}>
          <Field id={IDS.kind} label={LABELS.kind}>
            <Select id={IDS.kind} name="kind" defaultValue="other">{TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k as TaskKind]}</option>)}</Select>
          </Field>
          <Field id={IDS.athleteId} label={LABELS.athleteId} hint="Facultatif">
            <Select id={IDS.athleteId} name="athleteId" defaultValue={athleteId ?? ''} aria-describedby={`${IDS.athleteId}-hint`}>
              <option value="">Aucun</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          {teams.length ? (
            <Field id={IDS.teamId} label={LABELS.teamId} hint="Facultatif">
              <Select id={IDS.teamId} name="teamId" defaultValue="" aria-describedby={`${IDS.teamId}-hint`}>
                <option value="">Aucun</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          ) : null}
        </Grid>
        <Grid min={180} gap={4}>
          <Field id={IDS.dueOn} label={LABELS.dueOn} hint="Facultatif">
            <Input id={IDS.dueOn} name="dueOn" type="date" defaultValue={today} hasHint />
          </Field>
          <Field id={IDS.priority} label={LABELS.priority}>
            <Select id={IDS.priority} name="priority" defaultValue="1">{([0, 1, 2, 3] as const).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</Select>
          </Field>
          <Field id={IDS.recurrence} label={LABELS.recurrence} hint="À la fin, la suivante est créée">
            <Select id={IDS.recurrence} name="recurrence" defaultValue="" aria-describedby={`${IDS.recurrence}-hint`}>
              <option value="">Jamais</option>{TASK_RECURRENCES.map((r) => <option key={r} value={r}>{TASK_RECURRENCE_LABELS[r]}</option>)}
            </Select>
          </Field>
        </Grid>
        <Disclosure summary="Quand je m’y mets (facultatif, distinct de l’échéance)">
          <Grid min={160} gap={4}>
            <Field id={IDS.slotOn} label="Jour"><Input id={IDS.slotOn} name="slotOn" type="date" /></Field>
            <Field id={IDS.slotTime} label="Heure"><Input id={IDS.slotTime} name="slotTime" type="time" step={300} /></Field>
            <Field id={IDS.estimateMin} label={LABELS.estimateMin}>
              <Select id={IDS.estimateMin} name="estimateMin" defaultValue=""><option value="">—</option>{ESTIMATES.map((m) => <option key={m} value={m}>{formatEstimate(m)}</option>)}</Select>
            </Field>
          </Grid>
        </Disclosure>
        <Field id={IDS.notes} label={LABELS.notes} hint="Facultatif">
          <Textarea id={IDS.notes} name="notes" maxLength={2000} hasHint />
        </Field>
        <Cluster gap={2}>
          <Button type="submit" variant="primary" loading={pending}>Ajouter la tâche</Button>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        </Cluster>
      </Stack>
    </form>
  );
}
