import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { Banner, Card, Cluster, EmptyState, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { AthleteForm } from '@/views/coach/roster/invitation';

export const metadata = { title: 'Ajouter un élève' };

/** X13, refonte Chrono (D-150) : identité, fuseau et invitation (lien à copier ou e-mail, D-149). */
export default async function NewAthlete({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string }> }) {
  const { wid } = await params;
  const { first } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const back = <Cluster><LinkButton href={`/coach/${wid}/athletes`} variant="ghost" size="sm" icon="chevronLeft">Élèves</LinkButton></Cluster>;
  if (ctx.role !== 'owner') {
    return <Stack gap={6}>{back}<EmptyState icon="users" title="Réservé au propriétaire">Seul le propriétaire de l’espace peut ajouter des élèves.</EmptyState></Stack>;
  }
  return (
    <Stack gap={6} className="ds-narrow">
      {back}
      {first ? <Banner tone="success" title={`Ton espace « ${ctx.workspace.name} » est prêt`}>Ajoute ton premier élève.</Banner> : null}
      <Stack gap={1}>
        <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
        <Heading level={1} size={1}>Ajouter un élève</Heading>
        <Text muted>Son nom et son fuseau suffisent pour préparer ses séances. Avec son adresse, il ou elle reçoit un lien personnel, valable 7 jours, pour rejoindre ton espace.</Text>
      </Stack>
      <Banner tone="info" title="Tu as déjà ta liste d’élèves ?">
        Colle-la depuis Google Docs ou un tableur : fiches, groupes et liens d’invitation créés en une fois.{' '}
        <a href={`/coach/${wid}/athletes/import`}>Ajouter plusieurs élèves</a>
      </Banner>
      <Card pad={5} data-tour="athlete-form">
        <AthleteForm wid={wid} zones={Intl.supportedValuesOf('timeZone')} defaultZone={ctx.workspace.timeZone} />
      </Card>
    </Stack>
  );
}
