import type { ReactNode } from 'react';
import { Card, Cluster, Heading, Icon, LinkButton, Stack, Text } from '@/design';
import s from './home.module.css';

export interface FirstStepsState { athletes: number; teams: number; published: boolean; joined: boolean; reviewed: boolean }

/**
 * D-169 : les quatre premiers pas d’un nouveau coach, de l’inscription au premier retour traité, chacun avec son action.
 * La carte disparaît d’elle-même quand le quatrième est fait : aucun réglage à retenir.
 */
export function FirstSteps({ base, state }: { base: string; state: FirstStepsState }) {
  const steps: { done: boolean; title: string; text: string; actions: ReactNode }[] = [
    {
      done: state.athletes > 0, title: 'Ajouter tes élèves',
      text: 'Colle ta liste depuis Google Docs ou un tableur, avec leurs groupes, ou ajoute-les un par un.',
      actions: <><LinkButton data-tour-end href={`${base}/athletes/import`} size="sm" variant="primary" icon="users">Coller ma liste</LinkButton><LinkButton data-tour-end href={`${base}/athletes/new`} size="sm" icon="plus">Un élève</LinkButton></>,
    },
    {
      done: state.published, title: 'Publier une première séance',
      text: state.teams ? 'Une séance pour tout un groupe, ou la semaine d’un élève : rien n’est visible avant « Publier ».' : 'Prépare la semaine d’un élève, puis publie : rien n’est visible avant.',
      actions: <>
        {state.teams ? <LinkButton data-tour-end href={`${base}/group-sessions`} size="sm" variant="primary" icon="users">Séance de groupe</LinkButton> : null}
        <LinkButton data-tour-end href={`${base}/calendar`} size="sm" variant={state.teams ? 'secondary' : 'primary'} icon="calendar">Semaine d’un élève</LinkButton>
      </>,
    },
    {
      done: state.joined, title: 'Envoyer les invitations',
      text: 'Chaque élève reçoit son lien par SMS, WhatsApp ou e-mail et trouve ses séances sur son téléphone.',
      actions: <LinkButton data-tour-end href={`${base}/athletes?status=invited`} size="sm" icon="send">Élèves à inviter</LinkButton>,
    },
    {
      done: state.reviewed, title: 'Traiter un premier retour',
      text: 'Quand un élève dit ce qu’il a réalisé, son retour arrive dans ta Boîte de réception : lis, réponds si besoin, marque-le traité.',
      actions: <LinkButton data-tour-end href={`${base}/review`} size="sm" icon="inbox">Retours</LinkButton>,
    },
  ];
  const next = steps.findIndex((x) => !x.done);
  const done = steps.filter((x) => x.done).length;
  return (
    <Card as="section" pad={5} aria-labelledby="first-steps-title" data-tour="first-steps">
      <Stack gap={4}>
        <Cluster between gap={2}>
          <Heading level={2} size={4} id="first-steps-title">Premiers pas</Heading>
          <Text size="sm" muted>{done} sur {steps.length}</Text>
        </Cluster>
        <ol className={s.steps}>
          {steps.map((x, k) => (
            <li key={x.title} className={s.step} data-done={x.done ? '' : undefined} aria-current={k === next ? 'step' : undefined}>
              <span className={s.stepMark} aria-hidden="true">{x.done ? <Icon name="check" size={14} /> : k + 1}</span>
              <Stack gap={2} className={s.stepBody}>
                <Text strong>{x.title}{x.done ? <span className="visually-hidden"> (fait)</span> : null}</Text>
                {k === next ? <><Text size="sm" muted>{x.text}</Text><Cluster gap={2}>{x.actions}</Cluster></> : null}
              </Stack>
            </li>
          ))}
        </ol>
      </Stack>
    </Card>
  );
}
