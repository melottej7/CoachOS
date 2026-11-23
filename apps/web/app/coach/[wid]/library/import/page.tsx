import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listLibrary } from '@/server/repo/library';
import { Cluster, Heading, LinkButton, SegmentedLinks, Stack, Text } from '@/design';
import { LibraryImport, ProgramImport } from '@/views/coach/library/import';

export const metadata = { title: 'Importer' };

/**
 * D-079 (CE-B-06, CE-B-07) : la base du coach entre dans sa bibliothèque, après aperçu ligne par ligne.
 * D-085 : un ancien programme entier devient un programme type (semaines), après aperçu semaine par semaine. Refonte Chrono (D-154).
 */
export default async function ImportLibraryPage({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { wid } = await params;
  const program = (await searchParams).mode === 'programme';
  const actor = await requireActor();
  if (!(await coachContext(actor.userId, wid))) notFound();
  const existing = program ? [] : (await listLibrary(actor.userId, wid)).map((i) => i.workout.title.toLowerCase());
  const base = `/coach/${wid}/library/import`;
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Stack gap={2}>
        <Cluster><LinkButton href={`/coach/${wid}/library`} variant="ghost" size="sm" icon="chevronLeft">Séances types</LinkButton></Cluster>
        <Heading level={1} size={1}>{program ? 'Importer un programme' : 'Importer mes séances'}</Heading>
        <Text muted>{program
          ? 'Colle un ancien programme, semaine par semaine. Tu vois chaque séance avant d’enregistrer ; il devient un programme type que tu appliques ensuite à un élève, en brouillons.'
          : 'Reprends ta base existante : un fichier CSV (enregistré depuis Excel, Numbers ou Google Sheets), des cellules copiées d’un tableur, ou une séance par ligne « Titre : séance ». Tu vois chaque séance avant d’importer ; rien n’est écrasé.'}</Text>
      </Stack>
      <SegmentedLinks label="Que veux-tu importer ?" items={[
        { href: base, label: 'Des séances', current: !program },
        { href: `${base}?mode=programme`, label: 'Un programme entier', current: program },
      ]} />
      {program ? <ProgramImport wid={wid} /> : <LibraryImport wid={wid} existing={existing} />}
    </Stack>
  );
}
