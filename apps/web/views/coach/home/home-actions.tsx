'use client';

import { useState } from 'react';
import { Button, Card, Cluster, Heading, Stack } from '@/design';
import { AppointmentForm } from './appointment-form';
import { TaskForm } from './task-form';

/** « + Tâche » et « + Rendez-vous » : le formulaire s’ouvre sous les boutons, sans quitter l’Accueil. */
export function HomeActions({ wid, athletes, teams, today, timeZone }: {
  wid: string; athletes: { id: string; name: string; timeZone: string }[]; teams: { id: string; name: string }[]; today: string; timeZone: string;
}) {
  const [open, setOpen] = useState<'task' | 'appointment' | null>(null);
  const toggle = (k: 'task' | 'appointment') => setOpen((v) => (v === k ? null : k));
  return (
    <Stack gap={4}>
      <Cluster gap={2} data-tour="planning-add">
        <Button icon="plus" aria-expanded={open === 'task'} onClick={() => toggle('task')}>Tâche</Button>
        <Button icon="plus" aria-expanded={open === 'appointment'} onClick={() => toggle('appointment')} disabled={!athletes.length}>Rendez-vous</Button>
      </Cluster>
      {open ? (
        <Card pad={5}>
          <Stack gap={4}>
            <Heading level={2} size={4}>{open === 'task' ? 'Nouvelle tâche' : 'Nouveau rendez-vous'}</Heading>
            {open === 'task'
              ? <TaskForm wid={wid} athletes={athletes} teams={teams} today={today} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />
              : <AppointmentForm wid={wid} athletes={athletes} timeZone={timeZone} today={today} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
