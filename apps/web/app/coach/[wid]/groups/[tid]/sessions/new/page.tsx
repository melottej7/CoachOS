import { notFound } from 'next/navigation';
import { addDays, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamRecipients } from '@/server/repo/group-sessions';
import { readTemplate } from '@/server/repo/library';
import { listExercises } from '@/server/repo/exercises';
import { Cluster, EmptyState, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { GroupSessionForm } from '@/views/coach/group/group-session-form';

export const metadata = { title: 'Séance pour un groupe' };

/** CE-G2-01, refonte Chrono (D-148) : préparer une séance pour un groupe (base commune, destinataires exacts). */
export default async function NewGroupSession({ params, searchParams }: { params: Promise<{ wid: string; tid: string }>; searchParams: Promise<{ modele?: string; date?: string }> }) {
  const { wid, tid } = await params;
  const { modele, date } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const [team, tpl, exercises] = await Promise.all([
    teamRecipients(actor.userId, wid, tid),
    modele && isUuid(modele) ? readTemplate(actor.userId, wid, modele) : Promise.resolve(null),
    listExercises(actor.userId, wid),
  ]);
  if (!team) notFound();
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : addDays(todayIn(ctx.workspace.timeZone), 1);
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={`/coach/${wid}/group-sessions`} variant="ghost" size="sm" icon="chevronLeft">Séances de groupe</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">Groupe · {team.name}</Eyebrow>
        <Heading level={1} size={1}>Séance pour le groupe</Heading>
        <Text muted>{tpl ? `À partir de « ${tpl.workout.title} ». ` : ''}Un brouillon par élève : tu pourras adapter chaque séance avant de publier.</Text>
      </Stack>
      {team.members.length ? (
        <GroupSessionForm modules={ctx.modules} exercises={exercises.map((x) => ({ id: x.id, name: x.name }))} wid={wid} teamId={tid} teamName={team.name}
          members={team.members.map((m) => ({ id: m.id, name: m.name, state: m.state }))} date={day} initial={tpl?.workout} />
      ) : <EmptyState icon="users" title="Aucun élève suivi dans ce groupe" action={<LinkButton href={`/coach/${wid}/athletes?team=${tid}`} variant="primary">Ajouter des élèves</LinkButton>} />}
    </Stack>
  );
}
