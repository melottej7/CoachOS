import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio } from '@/server/repo/portfolio';
import { Card, Cluster, EmptyState, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { RosterImport } from '@/views/coach/roster/roster-import';

export const metadata = { title: 'Ajouter plusieurs élèves' };

/** D-169 : coller sa liste d’élèves (Google Docs, tableur), relire l’aperçu, créer fiches, groupes et liens en une fois. */
export default async function ImportAthletes({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const back = <Cluster><LinkButton href={`/coach/${wid}/athletes`} variant="ghost" size="sm" icon="chevronLeft">Élèves</LinkButton></Cluster>;
  if (ctx.role !== 'owner') {
    return <Stack gap={6}>{back}<EmptyState icon="users" title="Réservé au propriétaire">Seul le propriétaire de l’espace peut ajouter des élèves.</EmptyState></Stack>;
  }
  const { roster, teams } = await portfolio(actor.userId, wid, ctx.workspace.timeZone);
  return (
    <Stack gap={6} className="ds-narrow">
      {back}
      <Stack gap={1}>
        <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
        <Heading level={1} size={1}>Ajouter plusieurs élèves</Heading>
        <Text muted>Colle ta liste telle qu’elle est : CoachOS crée les fiches, les groupes et un lien d’invitation pour chaque adresse. Tu relis avant de valider.</Text>
      </Stack>
      <Card pad={5}>
        <RosterImport wid={wid} zones={Intl.supportedValuesOf('timeZone')} defaultZone={ctx.workspace.timeZone}
          existing={roster.map((a) => a.name)} teams={teams.filter((t) => !t.archived).map((t) => t.name)} />
      </Card>
    </Stack>
  );
}
