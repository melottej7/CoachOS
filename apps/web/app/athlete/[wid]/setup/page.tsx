import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readAthleteProfile } from '@/server/commands/athlete-profile';
import { readMe } from '@/server/commands/profile';
import { athleteContext } from '@/server/repo/context';
import { Notice } from '@/components/ui';
import { AthleteOnboarding } from '@/components/athlete-onboarding';

export const metadata = { title: 'Profil' };

/** X07 / X45 : questionnaire en trois étapes à l’arrivée, puis profil complet sur une page. */
export default async function AthleteSetup({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string; notice?: string }> }) {
  const { wid } = await params;
  const { first, notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const me = (await readMe(actor.userId)) ?? { displayName: actor.displayName, locale: 'fr' as const };
  const profile = await readAthleteProfile(actor.userId, wid, ctx.athlete.id);
  const wizard = Boolean(first);
  return (
    <>
      <Notice message={notice === 'saved' ? 'Profil enregistré.' : null} />
      <div className="kicker">{ctx.workspace.name}</div>
      <h1>{wizard ? 'Faisons connaissance' : 'Profil'}</h1>
      {!wizard ? (
        <p className="sub">Ton compte, ta pratique et tes objectifs. <Link href={`/athlete/${wid}/coach`}>Voir la présentation de ton coach</Link> · <Link href={`/athlete/${wid}/welcome`}>Revoir le guide</Link></p>
      ) : null}
      <div className="card" style={{ marginTop: 18 }}><div className="card-body">
        <AthleteOnboarding
          wid={wid}
          coachSpace={ctx.workspace.name}
          zones={Intl.supportedValuesOf('timeZone')}
          mode={wizard ? 'wizard' : 'single'}
          after={wizard ? `/athlete/${wid}/today?notice=joined` : `/athlete/${wid}/setup?notice=saved`}
          initial={{
            displayName: me.displayName,
            locale: me.locale,
            timeZone: ctx.athlete.timeZone,
            profile: profile
              ? {
                  sport: profile.sport, level: profile.level, experience: profile.experience, weeklySessions: profile.weeklySessions,
                  weeklyHours: profile.weeklyHours, availableDays: profile.availableDays, mainGoal: profile.mainGoal,
                  nextEventName: profile.nextEventName, nextEventDate: profile.nextEventDate,
                }
              : null,
          }}
        />
      </div></div>
    </>
  );
}
