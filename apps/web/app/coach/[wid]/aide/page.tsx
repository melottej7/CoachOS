import { Cluster, Heading, LinkButton, Stack, Text } from '@/design';
import { HelpCenter } from '@/views/help/help-center';

export const metadata = { title: 'Aide' };

/** D-194 · Centre d’aide du coach : recherche, articles par thème, visite guidée à revoir. */
export default async function CoachHelp({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ q?: string }> }) {
  const { wid } = await params;
  const { q } = await searchParams;
  const base = `/coach/${wid}`;
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Heading level={1} size={1}>Aide</Heading>
        <Text muted>Comment faire, en quelques lignes, avec un lien vers la bonne page.</Text>
        <Cluster gap={2}><LinkButton href={`${base}/planning?tour=start`} variant="ghost" size="sm" icon="info">Revoir la visite guidée</LinkButton></Cluster>
      </Stack>
      <HelpCenter audience="coach" base={base} initial={(q ?? '').slice(0, 80)} />
    </Stack>
  );
}
