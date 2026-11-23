import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { bilanCompletion, deriveBilan } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { profileAnswers, readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { readMe } from '@/server/commands/profile';
import { listMyPrivacyRequests } from '@/server/commands/privacy';
import { athleteContext } from '@/server/repo/context';
import { BilanFlow } from '@/components/bilan-flow';
import {
  Avatar, Badge, Banner, Button, Card, Cluster, Eyebrow, Heading, LinkButton, Stack, Text, ThemeChoiceGroup, type ThemeChoice,
} from '@/design';
import { ProfileForm } from '@/views/athlete/profile-form';
import { PrivacyPanel } from '@/views/privacy-panel';

export const metadata = { title: 'Profil' };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: tz }).format(new Date(iso));

/**
 * X07 / X45 et bilan d’arrivée (D-054), refonte Chrono (D-136) : à l’arrivée, ou tant que le bilan n’est pas envoyé,
 * une question par écran (reprise du brouillon) ; ensuite, le Profil : bilan, apparence, informations, données.
 */
export default async function AthleteSetup({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string; notice?: string; bilan?: string }> }) {
  const { wid } = await params;
  const { first, notice, bilan } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const aid = ctx.athlete.id;
  const [me, profile, draft, requests, jar] = await Promise.all([
    readMe(actor.userId),
    readAthleteProfile(actor.userId, wid, aid),
    readBilanDraft(actor.userId, wid, aid),
    listMyPrivacyRequests(actor.userId, wid),
    cookies(),
  ]);
  const account = me ?? { displayName: actor.displayName, locale: 'fr' as const };
  const wizard = Boolean(first);
  const firstName = ctx.athlete.displayName.split(' ')[0] ?? ctx.athlete.displayName;
  const base = `/athlete/${wid}`;

  if (wizard || !profile || bilan === '1') {
    const initial = draft?.answers ?? (profile ? profileAnswers(profile) : {});
    const startAt = draft ? draft.step : profile ? 'recap' : 'sport';
    const c = bilanCompletion(deriveBilan(initial));
    return (
      <Stack gap={5}>
        {profile ? <Cluster><LinkButton href={`${base}/setup`} variant="ghost" size="sm" icon="chevronLeft">Profil, sans rien changer</LinkButton></Cluster> : null}
        <Stack gap={1}>
          <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
          <Heading level={1} size={1}>{wizard ? 'Faisons connaissance' : profile ? 'Mon bilan' : 'Ton bilan'}</Heading>
          <Text muted>
            {draft && !wizard ? `Tu reprends là où tu t’étais arrêté·e (${c.answered} réponse${c.answered > 1 ? 's' : ''} sur ${c.total}). ` : ''}
            Quelques questions pour que ton coach prépare un programme qui te ressemble. Aucune question sur ta santé.
          </Text>
        </Stack>
        <Card pad={5}>
          <BilanFlow wid={wid} mode="athlete" firstName={firstName} initial={initial} startAt={startAt}
            after={wizard ? `${base}/today?notice=joined&tour=start` : `${base}/setup?notice=bilan`} />
        </Card>
      </Stack>
    );
  }

  const theme = (['light', 'dark'].includes(jar.get('coachos_theme')?.value ?? '') ? jar.get('coachos_theme')!.value : 'system') as ThemeChoice;

  return (
    <Stack gap={8}>
      {notice === 'saved' ? <Banner tone="success" title="Profil enregistré" /> : notice === 'bilan' ? <Banner tone="success" title="Bilan envoyé à ton coach" /> : null}
      <Cluster gap={4} nowrap>
        <Avatar name={ctx.athlete.displayName} size={64} />
        <Stack gap={1}>
          <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
          <Heading level={1} size={2}>{ctx.athlete.displayName}</Heading>
        </Stack>
      </Cluster>
      <Cluster gap={2}>
        <LinkButton href={`${base}/coach`} icon="user" size="sm">Présentation de ton coach</LinkButton>
        <LinkButton href={`${base}/notifications`} icon="bell" size="sm">Notifications</LinkButton>
        <LinkButton href={`${base}/today?tour=start`} icon="info" size="sm" variant="ghost">Revoir la visite guidée</LinkButton>
      </Cluster>

      <Card as="section" pad={5} aria-labelledby="bilan-state">
        <Stack gap={3}>
          <Cluster between gap={2}>
            <Heading level={2} size={4} id="bilan-state">Mon bilan</Heading>
            {profile.status === 'confirmed' ? <Badge tone="success" dot>Confirmé</Badge> : <Badge tone="warning" dot>Envoyé</Badge>}
          </Cluster>
          <Text size="sm" muted>
            {profile.status === 'confirmed'
              ? `Ton coach l’a confirmé${profile.confirmedAt ? ` le ${fmt(profile.confirmedAt, ctx.athlete.timeZone)}` : ''}.`
              : 'Ton coach va le relire et le confirmer.'}
          </Text>
          <Cluster><LinkButton href={`${base}/setup?bilan=1`} icon="edit">Mettre à jour mon bilan</LinkButton></Cluster>
        </Stack>
      </Card>

      <Stack as="section" gap={3} aria-labelledby="affichage">
        <Heading level={2} size={4} id="affichage">Apparence</Heading>
        <ThemeChoiceGroup initial={theme} hideLegend />
        <Text size="sm" muted>« Automatique » suit le réglage de ton téléphone. Les couleurs de ton coach restent les mêmes.</Text>
      </Stack>

      <Stack as="section" gap={4} aria-labelledby="mes-infos">
        <Heading level={2} size={4} id="mes-infos">Mes informations</Heading>
        <ProfileForm wid={wid} coachSpace={ctx.workspace.name} zones={Intl.supportedValuesOf('timeZone')} after={`${base}/setup?notice=saved`}
          initial={{
            displayName: account.displayName,
            locale: account.locale,
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
          }} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="mes-donnees" id="donnees">
        <Heading level={2} size={4} id="mes-donnees">Mes données</Heading>
        <PrivacyPanel wid={wid} requests={requests} />
      </Stack>

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="secondary" icon="logout" block>Se déconnecter</Button>
      </form>
    </Stack>
  );
}
