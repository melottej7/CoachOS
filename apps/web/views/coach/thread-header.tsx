'use client';

import { useState } from 'react';
import { Button, Card, Heading, LinkButton, Stack } from '@/design';
import { ChatHeader } from '@/views/messaging/chat-header';
import { AppointmentForm } from '@/views/coach/home/appointment-form';

/** En-tête de la conversation avec un élève : planifier un rendez-vous sur place, ouvrir sa fiche (D-145). */
export function CoachThreadHeader({ wid, back, athlete, subtitle, timeZone, today }: {
  wid: string; back: string; athlete: { id: string; name: string; timeZone: string }; subtitle: string; timeZone: string; today: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Stack gap={4}>
      <ChatHeader back={back} backLabel="Toutes les discussions" name={athlete.name} people subtitle={subtitle}
        actions={<>
          <Button size="sm" icon="calendar" aria-expanded={open} title="Planifier un rendez-vous" onClick={() => setOpen((v) => !v)}><span className="ds-hide-narrow">Planifier</span></Button>
          <LinkButton size="sm" icon="user" title={`Fiche de ${athlete.name}`} href={`/coach/${wid}/athletes/${athlete.id}`}><span className="ds-hide-narrow">Fiche</span></LinkButton>
        </>} />
      {open ? (
        <Card pad={5}>
          <Stack gap={4}>
            <Heading level={2} size={4}>Rendez-vous avec {athlete.name.split(' ')[0]}</Heading>
            <AppointmentForm wid={wid} idPrefix="thread-ap" athletes={[athlete]} athleteId={athlete.id} timeZone={timeZone} today={today}
              onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
