import { Heading, Stack, Text } from '@/design';
import { HelpCenter } from '@/views/help/help-center';

export const metadata = { title: 'Aide' };

/** D-194 · Aide de l’élève : installer l’app, suivre sa séance, le son, son retour, son coach, ses données. */
export default async function AthleteHelp({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ q?: string }> }) {
  const { wid } = await params;
  const { q } = await searchParams;
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Heading level={1} size={1}>Aide</Heading>
        <Text muted>Une question sur l’app ? La réponse est sans doute ici. Pour ton entraînement, écris à ton coach.</Text>
      </Stack>
      <HelpCenter audience="athlete" base={`/athlete/${wid}`} initial={(q ?? '').slice(0, 80)} />
    </Stack>
  );
}
