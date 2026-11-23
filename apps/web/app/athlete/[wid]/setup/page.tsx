import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bilanCompletion, deriveBilan } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { profileAnswers, readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { readMe } from '@/server/commands/profile';
import { listMyPrivacyRequests } from '@/server/commands/privacy';
import { athleteContext } from '@/server/repo/context';
import { Notice, Pill, SignOutButton } from '@/components/ui';
import { AthleteOnboarding } from '@/components/athlete-onboarding';
import { BilanFlow } from '@/components/bilan-flow';
import { PrivacyPanel } from '@/components/privacy-panel';

export const metadata = { title: 'Profil' };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: tz }).format(new Date(iso));

/**
 * X07 / X45 et bilan d’arrivée (D-054) : à l’arrivée, ou tant que le bilan n’est pas envoyé, une question par écran
 * (reprise du brouillon) ; ensuite, page Profil avec l’état du bilan et « Refaire mon bilan ».
 */
export default async function AthleteSetup({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string; notice?: string; bilan?: string }> }) {
  const { wid } = await params;
  const { first, notice, bilan } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const me = (await readMe(actor.userId)) ?? { displayName: actor.displayName, locale: 'fr' as const };
  const profile = await readAthleteProfile(actor.userId, wid, ctx.athlete.id);
  const draft = await readBilanDraft(actor.userId, wid, ctx.athlete.id);
  const requests = await listMyPrivacyRequests(actor.userId, wid);
  const wizard = Boolean(first);
  const firstName = ctx.athlete.displayName.split(' ')[0] ?? ctx.athlete.displayName;

  if (wizard || !profile || bilan === '1') {
    const initial = draft?.answers ?? (profile ? profileAnswers(profile) : {});
    const startAt = draft ? draft.step : profile ? 'recap' : 'sport';
    const c = bilanCompletion(deriveBilan(initial));
    return (
      <>
        <div className="kicker">{ctx.workspace.name}</div>
        <h1>{wizard ? 'Faisons connaissance' : profile ? 'Mon bilan' : 'Ton bilan'}</h1>
        <p className="sub">
          {draft && !wizard ? `Tu reprends là où tu t’étais arrêté·e (${c.answered} réponse${c.answered > 1 ? 's' : ''} sur ${c.total}). ` : ''}
          Quelques questions pour que ton coach prépare un programme qui te ressemble. Aucune question sur ta santé.
        </p>
        <div className="card" style={{ marginTop: 18 }}><div className="card-body">
          <BilanFlow wid={wid} mode="athlete" firstName={firstName} initial={initial} startAt={startAt}
            after={wizard ? `/athlete/${wid}/today?notice=joined&tour=start` : `/athlete/${wid}/setup?notice=bilan`} />
        </div></div>
        {profile ? <p style={{ marginTop: 12 }}><Link href={`/athlete/${wid}/setup`}>← Revenir au profil sans rien changer</Link></p> : null}
      </>
    );
  }

  return (
    <>
      <Notice message={notice === 'saved' ? 'Profil enregistré.' : notice === 'bilan' ? 'Bilan envoyé à ton coach.' : null} />
      <div className="kicker">{ctx.workspace.name}</div>
      <h1>Profil</h1>
      <p className="sub">Ton compte, ta pratique et tes objectifs. <Link href={`/athlete/${wid}/coach`}>Voir la présentation de ton coach</Link> · <Link href={`/athlete/${wid}/today?tour=start`}>Revoir la visite guidée</Link></p>
      <section className="card bilan-state" style={{ marginTop: 18 }} aria-labelledby="bilan-state">
        <div className="card-body">
          <h2 id="bilan-state">Mon bilan</h2>
          <p>
            {profile.status === 'confirmed'
              ? <><Pill tone="neutral">Confirmé</Pill> Ton coach l’a confirmé{profile.confirmedAt ? ` le ${fmt(profile.confirmedAt, ctx.athlete.timeZone)}` : ''}.</>
              : <><Pill tone="attn">Envoyé</Pill> Ton coach va le relire et le confirmer.</>}
          </p>
          <Link className="btn" href={`/athlete/${wid}/setup?bilan=1`}>Mettre à jour mon bilan</Link>
        </div>
      </section>
      <div className="card" style={{ marginTop: 18 }}><div className="card-body">
        <AthleteOnboarding
          wid={wid}
          coachSpace={ctx.workspace.name}
          zones={Intl.supportedValuesOf('timeZone')}
          mode="single"
          after={`/athlete/${wid}/setup?notice=saved`}
          initial={{
            displayName: me.displayName,
            locale: me.locale,
            timeZone: ctx.athlete.timeZone,
            profile: {
              sport: profile.sport, level: profile.level, experience: profile.experience, weeklySessions: profile.weeklySessions,
              weeklyHours: profile.weeklyHours, availableDays: profile.availableDays, mainGoal: profile.mainGoal,
              nextEventName: profile.nextEventName, nextEventDate: profile.nextEventDate,
              bilan: {
                practiceStatus: profile.practiceStatus, breakLength: profile.breakLength, resumedSince: profile.resumedSince, longestRecent: profile.longestRecent,
                weekdayMinutes: profile.weekdayMinutes, preferredTime: profile.preferredTime, longDay: profile.longDay, equipment: profile.equipment,
                practicalConstraints: profile.practicalConstraints,
              },
            },
          }}
        />
      </div></div>
      <PrivacyPanel wid={wid} role="athlete" requests={requests} />
      <div className="mobile-only" style={{ marginTop: 18 }}><SignOutButton className="btn" /></div>
    </>
  );
}
