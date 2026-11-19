import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { profileAnswers, readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { listAssignedAthletes } from '@/server/repo/coach';
import { isUuid } from '@/server/repo/context';
import { BilanFlow } from '@/components/bilan-flow';

export const metadata = { title: 'Bilan en entretien' };

/**
 * CE-B-05 (D-054) : le coach remplit le même bilan pendant ou après l’appel. Il part des réponses de l’élève
 * (bilan envoyé, sinon son brouillon) ; les réponses qu’il change sont marquées « entretien ».
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
    <>
      <Link className="back" href={`${back}#bilan`}>← Fiche de {athlete.displayName}</Link>
      <div className="kicker">{athlete.displayName} · entretien</div>
      <h1>Bilan avec {first}</h1>
      <p className="sub">
        {profile ? `Tu pars du bilan envoyé par ${first}.` : draft ? `Tu pars des réponses déjà données par ${first}.` : `${first} n’a encore rien rempli : pose les questions pendant l’appel.`}
        {' '}Les réponses que tu changes seront marquées « entretien », et le bilan sera confirmé. Aucune question sur la santé.
      </p>
      <div className="card" style={{ marginTop: 18 }}><div className="card-body">
        <BilanFlow wid={wid} mode="coach" aid={aid} firstName={first} expectedRevision={profile?.revision ?? null}
          initial={profile ? profileAnswers(profile) : draft?.answers ?? {}} startAt={profile ? 'recap' : 'sport'} after={`${back}?notice=bilan#bilan`} />
      </div></div>
    </>
  );
}
