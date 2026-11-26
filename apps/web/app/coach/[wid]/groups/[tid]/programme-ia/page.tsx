import { notFound } from 'next/navigation';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { aiEnabled } from '@/server/ai/settings';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamWeek } from '@/server/repo/group-sessions';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { AiProgramDraft } from '@/views/coach/program/ai-program-draft';

export const metadata = { title: 'Programme avec l’IA' };

/** IA-3 (D-191) · « Préparer un programme avec l’IA » pour un groupe : un brouillon par membre, rien publié. */
export default async function TeamAiProgram({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const today = todayIn(ctx.workspace.timeZone);
  const w = await teamWeek(actor.userId, wid, tid, weekStart(today), addDays(weekStart(today), 6));
  if (!w || !(await aiEnabled(actor.userId, wid))) notFound();
  const base = `/coach/${wid}`;
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Cluster><LinkButton href={`${base}/groups/${tid}/week`} variant="ghost" size="sm" icon="chevronLeft">Groupe · {w.name}</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">Groupe · {w.name} · {w.members.length} élève{w.members.length > 1 ? 's' : ''}</Eyebrow>
        <Heading level={1} size={1}>Programme avec l’IA</Heading>
        <Text muted>L’IA lit les niveaux, les repères et les charges des membres, la bibliothèque et les machines, sans aucun nom. Tu relis et corriges ; « Enregistrer en brouillon » crée une séance de groupe par date, un brouillon par élève, sans rien publier.</Text>
      </Stack>
      <AiProgramDraft wid={wid} target={{ kind: 'team', id: tid }} targetLabel={`le groupe ${w.name}`} defaultMonday={addDays(weekStart(today), 7)} calendarHref={`${base}/groups/${tid}/week`} />
    </Stack>
  );
}
