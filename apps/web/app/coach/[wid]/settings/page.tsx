import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { formatUsd } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { coachContext } from '@/server/repo/context';
import { autoRuleSettings } from '@/server/repo/portfolio';
import { aiMonth, aiSource } from '@/server/commands/ai';
import { aiModel } from '@/server/ai/client';
import { aiEnabled } from '@/server/ai/settings';
import { AiSwitch } from '@/views/coach/settings/ai-switch';
import { readRelanceTemplates } from '@/server/commands/relance-templates';
import { listMyPrivacyRequests } from '@/server/commands/privacy';
import { Badge, Banner, Card, Cluster, DensityChoiceGroup, Eyebrow, Heading, Meter, ModeChoiceGroup, SectionTabs, Stack, Text, ThemeChoiceGroup } from '@/design';
import { CoachDetails, CoachIdentity } from '@/views/coach-profile';
import { SpaceForm } from '@/views/coach/settings/space-form';
import { AutoRulesForm, RelanceTemplates } from '@/views/coach/settings/follow-ups';
import { PrivacyPanel } from '@/views/privacy-panel';
import { readWorkspaceOffer } from '@/server/commands/workspace-offer';
import { OfferPanel } from '@/views/coach/settings/offer-panel';

export const metadata = { title: 'Paramètres' };

type Tab = 'espace' | 'suivis' | 'relances' | 'apparence' | 'ia' | 'abonnement' | 'donnees';
const TABS: { k: Tab; label: string; owner?: boolean }[] = [
  { k: 'espace', label: 'Présentation' },
  { k: 'suivis', label: 'Suivis' },
  { k: 'relances', label: 'Relances' },
  { k: 'apparence', label: 'Apparence' },
  { k: 'ia', label: 'IA', owner: true },
  { k: 'abonnement', label: 'Abonnement', owner: true },
  { k: 'donnees', label: 'Mes données' },
];

/** Titre de l’onglet pour les lecteurs d’écran (l’onglet le montre déjà) et sa phrase d’explication. */
function Intro({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <h2 className="ds-visually-hidden">{title}</h2>
      {children ? <Text muted>{children}</Text> : null}
    </>
  );
}

/**
 * X32, refonte Chrono (D-155) : Paramètres de l’espace, en onglets. Présentation (nom de l’espace compris, D-022), suivis
 * automatiques (D-045), modèles de relance (D-104), apparence de cet appareil (D-128), IA du mois (D-081, propriétaire),
 * abonnement (D-175, propriétaire), mes données (D-115). Juste après la création de l’espace (first=1) : l’assistant en quatre étapes, seul à l’écran.
 */
export default async function Settings({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string; notice?: string; onglet?: string; abonnement?: string }> }) {
  const { wid } = await params;
  const { first, notice, onglet, abonnement } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const owner = ctx.role === 'owner';
  const wizard = owner && Boolean(first);
  const tab: Tab = TABS.some((t) => t.k === onglet && (!t.owner || owner)) ? (onglet as Tab) : 'espace';
  const base = `/coach/${wid}/settings`;
  const ws = await readWorkspacePublic(actor.userId, wid);
  if (!ws) notFound();
  const p = ws.profile;

  if (wizard) {
    return (
      <Stack gap={6} className="ds-narrow-wide">
        <Stack gap={1}>
          <Eyebrow tone="coach">{ws.name}</Eyebrow>
          <Heading level={1} size={1}>Personnalise ton espace</Heading>
          <Text muted>Quatre étapes rapides pour te présenter à tes élèves. Tu peux tout passer et y revenir plus tard dans Paramètres.</Text>
        </Stack>
        <SpaceForm wid={wid} mode="wizard" after={`/coach/${wid}/planning?tour=start`} initial={spaceInitial(ws)} />
      </Stack>
    );
  }

  const jar = await cookies();
  const theme = jar.get('coachos_theme')?.value;
  const density = jar.get('coachos_density')?.value;
  const simple = jar.get('coachos_mode')?.value === 'simple';
  // Lectures de l’onglet ouvert seulement.
  const [rules, mine, requests, ai, offer, aiOn] = await Promise.all([
    tab === 'suivis' ? autoRuleSettings(actor.userId, wid) : null,
    tab === 'relances' ? readRelanceTemplates(actor.userId, wid) : null,
    tab === 'donnees' ? listMyPrivacyRequests(actor.userId, wid) : null,
    tab === 'ia' && owner ? aiMonth(actor.userId, wid) : null,
    tab === 'abonnement' && owner ? readWorkspaceOffer(actor.userId, wid) : null,
    tab === 'ia' && owner ? aiEnabled(actor.userId, wid) : null,
  ]);
  const pct = ai ? (ai.budgetMicros ? Math.min(100, Math.round((ai.spentMicros / ai.budgetMicros) * 100)) : 100) : 0;

  return (
    <Stack gap={6}>
      {notice === 'saved' ? <Banner tone="success" title="Présentation enregistrée">Tes élèves la voient dans « Ton coach ».</Banner> : null}
      <Stack gap={1}>
        <Eyebrow>{ws.name}</Eyebrow>
        <Heading level={1} size={1}>Paramètres</Heading>
      </Stack>
      <SectionTabs label="Paramètres" items={TABS.filter((t) => !t.owner || owner).map((t) => ({ href: t.k === 'espace' ? base : `${base}?onglet=${t.k}`, label: t.label, current: tab === t.k }))} />

      <div className="ds-narrow-wide">
        {tab === 'espace' ? (
          owner ? (
            <Stack gap={4}>
              <Intro title="Présentation de l’espace">Ce que voient tes élèves et les personnes que tu invites.</Intro>
              <SpaceForm wid={wid} mode="single" after={`${base}?notice=saved`} initial={spaceInitial(ws)} />
            </Stack>
          ) : (
            <Stack gap={5}>
              <Intro title="Présentation de l’espace">Seul le propriétaire de l’espace peut la modifier.</Intro>
              <Card pad={5}><Stack gap={6}><CoachIdentity data={ws} level={2} /><CoachDetails data={ws} empty={<Text muted>Le propriétaire n’a pas encore rédigé de présentation.</Text>} /></Stack></Card>
            </Stack>
          )
        ) : null}

        {tab === 'suivis' && rules ? (
          <Stack gap={4}>
            <Intro title="Suivis automatiques">Ce qui apparaît tout seul dans ton Accueil, et quand. Décoche ce qui ne te sert pas ; pour un seul élève, utilise plutôt « Plus tard » sur la tâche. Réglage personnel.</Intro>
            <AutoRulesForm wid={wid} initial={rules} />
          </Stack>
        ) : null}

        {tab === 'relances' && mine ? (
          <Stack gap={4}>
            <Intro title="Mes relances" />
            <RelanceTemplates wid={wid} mine={mine} />
          </Stack>
        ) : null}

        {tab === 'apparence' ? (
          <Stack gap={5}>
            <Intro title="Apparence">Réglage de cet appareil seulement : ton téléphone et ton ordinateur gardent chacun le leur.</Intro>
            <Card pad={5}><ModeChoiceGroup initial={simple ? 'simple' : 'full'} /></Card>
            <Card pad={5}><ThemeChoiceGroup initial={theme === 'light' || theme === 'dark' ? theme : 'system'} /></Card>
            <Card pad={5}>
              <Stack gap={2}>
                <DensityChoiceGroup initial={density === 'compact' ? 'compact' : 'comfortable'} />
                <Text size="sm" muted>Compacte : des lignes plus serrées pour voir plus d’élèves et de retours à la fois.</Text>
              </Stack>
            </Card>
          </Stack>
        ) : null}

        {tab === 'ia' && ai ? (
          <Stack gap={4}>
            <Intro title="IA ce mois-ci" />
            <Cluster gap={2}>
              <Text strong>Ce mois-ci</Text>
              {!aiOn ? <Badge tone="neutral">IA éteinte</Badge> : <Badge tone={aiSource() === 'claude' ? 'coach' : 'neutral'}>{aiSource() === 'claude' ? 'Claude actif' : 'IA simulée, aucun coût'}</Badge>}
            </Cluster>
            <Card pad={5}>
              <Stack gap={3}>
                <Text><strong>{ai.calls}</strong> proposition{ai.calls > 1 ? 's' : ''} « Ajuster avec l’IA »{ai.claudeCalls !== ai.calls ? ` (dont ${ai.claudeCalls} par Claude)` : ''} · coût réel <strong>{formatUsd(ai.spentMicros)}</strong> sur un budget de {formatUsd(ai.budgetMicros)}.</Text>
                <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Part du budget IA utilisée"><Meter value={pct} tone={pct >= 90 ? 'signal' : 'coach'} /></div>
                <Text size="sm" muted>Arrivé au budget, l’IA s’arrête jusqu’au mois suivant ; tout reste faisable à la main. Le budget se règle sur le serveur (COACHOS_AI_MONTHLY_BUDGET_USD). Les coûts viennent des jetons facturés par Anthropic à chaque appel.</Text>
              </Stack>
            </Card>
            <Card pad={5}>
              <Stack gap={4}>
                <AiSwitch wid={wid} initial={aiOn !== false} />
                <Stack gap={1}>
                  <Text size="sm"><strong>Modèle</strong> · {aiSource() === 'claude' ? <code>{aiModel()}</code> : 'aucun (IA simulée : réponses toutes faites, rien ne sort de CoachOS)'}</Text>
                  <Text size="sm" muted>Fournisseur : Anthropic (Claude). Seuls des faits d’entraînement partent, sans nom ni prénom ; jamais de données Strava, de santé, de notes privées ni de messages. Rien n’est publié ni envoyé sans ton geste. Le modèle se règle sur le serveur (COACHOS_AI_MODEL).</Text>
                </Stack>
              </Stack>
            </Card>
          </Stack>
        ) : null}

        {tab === 'abonnement' && offer ? (
          <Stack gap={4}>
            <Intro title="Abonnement" />
            <OfferPanel view={offer} timeZone={ctx.workspace.timeZone} wid={wid} notice={abonnement} />
          </Stack>
        ) : null}

        {tab === 'donnees' && requests ? (
          <Stack gap={4}>
            <Intro title="Mes données" />
            <PrivacyPanel wid={wid} role="coach" owner={owner} requests={requests} />
          </Stack>
        ) : null}
      </div>
    </Stack>
  );
}

function spaceInitial(ws: NonNullable<Awaited<ReturnType<typeof readWorkspacePublic>>>) {
  const p = ws.profile;
  return {
    name: ws.name, coachName: ws.coachName, logoVersion: ws.logoVersion,
    tagline: p?.tagline ?? '', bio: p?.bio ?? '', approach: p?.approach ?? '',
    experienceYears: p?.experienceYears === null || p?.experienceYears === undefined ? '' : String(p.experienceYears),
    certifications: p?.certifications ?? [], sports: p?.sports ?? [], audiences: p?.audiences ?? [], goals: p?.goals ?? [],
    city: p?.city ?? '', languages: p?.languages ?? [], websiteUrl: p?.websiteUrl ?? '', socialUrl: p?.socialUrl ?? '',
    contactEmail: p?.contactEmail ?? '', accent: p?.accent ?? 'emerald',
  };
}
