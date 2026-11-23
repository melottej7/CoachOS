'use client';

import { useState } from 'react';
import { Button, Card, Cluster, Heading, Stack } from '@/design';
import { AppointmentForm } from './appointment-form';
import { TaskForm } from './task-form';

/** « + Tâche » et « + Rendez-vous » : le formulaire s’ouvre sous les boutons, sans quitter l’Accueil. */
export function HomeActions({ wid, athletes, teams, today, timeZone, athleteId, labels = { task: 'Tâche', appointment: 'Rendez-vous' } }: {
  wid: string; athletes: { id: string; name: string; timeZone: string }[]; teams: { id: string; name: string }[]; today: string; timeZone: string;
  /** Fiche d’un élève : la tâche et le rendez-vous sont pour lui. */
  athleteId?: string; labels?: { task: string; appointment: string };
}) {
  const [open, setOpen] = useState<'task' | 'appointment' | null>(null);
  const toggle = (k: 'task' | 'appointment') => setOpen((v) => (v === k ? null : k));
  return (
    <Stack gap={4}>
      <Cluster gap={2} data-tour="planning-add">
        <Button icon="plus" aria-expanded={open === 'task'} onClick={() => toggle('task')}>{labels.task}</Button>
        <Button icon="calendar" aria-expanded={open === 'appointment'} onClick={() => toggle('appointment')} disabled={!athletes.length}>{labels.appointment}</Button>
      </Cluster>
      {open ? (
        <Card pad={5}>
          <Stack gap={4}>
            <Heading level={2} size={4}>{open === 'task' ? 'Nouvelle tâche' : 'Nouveau rendez-vous'}</Heading>
            {open === 'task'
              ? <TaskForm wid={wid} athletes={athletes} teams={teams} athleteId={athleteId} today={today} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />
              : <AppointmentForm wid={wid} athletes={athletes} athleteId={athleteId} timeZone={timeZone} today={today} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
