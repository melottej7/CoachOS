import { notFound } from 'next/navigation';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { aiEnabled } from '@/server/ai/settings';
import { coachContext, isUuid } from '@/server/repo/context';
import { athleteFile } from '@/server/repo/portfolio';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { AiProgramDraft } from '@/views/coach/program/ai-program-draft';

export const metadata = { title: 'Programme avec l’IA' };

/** IA-3 (D-191) · « Préparer un programme avec l’IA » pour un élève : brouillon relu, enregistré sans publier. */
export default async function AthleteAiProgram({ params }: { params: Promise<{ wid: string; aid: string }> }) {
  const { wid, aid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(aid)) notFound();
  const a = (await athleteFile(actor.userId, wid, aid, ctx.workspace.timeZone)).entry;
  if (!a || !(await aiEnabled(actor.userId, wid))) notFound();
  const base = `/coach/${wid}`;
  const first = a.name.split(' ')[0] ?? a.name;
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={`${base}/athletes/${aid}`} variant="ghost" size="sm" icon="chevronLeft">{a.name}</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">Élève · {a.name}</Eyebrow>
        <Heading level={1} size={1}>Programme avec l’IA</Heading>
        <Text muted>L’IA lit le profil, les repères, les charges réalisées, la bibliothèque et les séances déjà prévues de {first}, sans son nom. Tu relis et corriges chaque séance ; « Enregistrer en brouillon » ne publie rien.</Text>
      </Stack>
      <AiProgramDraft wid={wid} target={{ kind: 'athlete', id: aid }} targetLabel={first} defaultMonday={addDays(weekStart(todayIn(a.timeZone)), 7)} calendarHref={`${base}/calendar?athlete=${aid}`} />
    </Stack>
  );
}
