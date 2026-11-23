import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { profileAnswers, readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { listAssignedAthletes } from '@/server/repo/coach';
import { isUuid } from '@/server/repo/context';
import { Cluster, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { BilanFlow } from '@/views/bilan-flow';

export const metadata = { title: 'Bilan en entretien' };

/**
 * CE-B-05 (D-054), refonte Chrono (D-151) : le coach remplit le même bilan pendant ou après l’appel, une question par écran.
 * Il part des réponses de l’élève (bilan envoyé, sinon son brouillon) ; les réponses qu’il change sont marquées « entretien ».
 */
export default async function CoachBilan({ params }: { params: Promise<{ wid: string; aid: string }> }) {
  const { wid, aid } = await params;
  if (!isUuid(aid)) notFound();
  const actor = await requireActor();
  const athlete = (await listAssignedAthletes(actor.userId, wid)).find((a) => a.id === aid && a.state === 'active');
  if (!athlete) notFound();
  const profile = await readAthleteProfile(actor.userId, wid, aid);
  const draft = profile ? null : await readBilanDraft(actor.userId, wid, aid);
  const first = athlete.displayName.split(' ')[0] ?? athlete.displayName;
  const back = `/coach/${wid}/athletes/${aid}`;
  return (
    <Stack gap={5} className="ds-narrow">
      <Cluster><LinkButton href={`${back}?onglet=bilan`} variant="ghost" size="sm" icon="chevronLeft">Fiche de {first}</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">{athlete.displayName} · entretien</Eyebrow>
        <Heading level={1} size={1}>Bilan avec {first}</Heading>
        <Text muted>
          {profile ? `Tu pars du bilan envoyé par ${first}.` : draft ? `Tu pars des réponses déjà données par ${first}.` : `${first} n’a encore rien rempli : pose les questions pendant l’appel.`}
          {' '}Les réponses que tu changes seront marquées « entretien », et le bilan sera confirmé. Aucune question sur la santé.
        </Text>
      </Stack>
      <BilanFlow wid={wid} mode="coach" aid={aid} firstName={first} expectedRevision={profile?.revision ?? null}
        initial={profile ? profileAnswers(profile) : draft?.answers ?? {}} startAt={profile ? 'recap' : 'sport'} after={`${back}?onglet=bilan&notice=bilan`} />
    </Stack>
  );
}
