import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listLibrary } from '@/server/repo/library';
import { LibraryImport } from '@/components/library-import';
import { ProgramImport } from '@/components/program-import';

export const metadata = { title: 'Importer' };

/**
 * D-079 (CE-B-06, CE-B-07) : la base du coach entre dans sa bibliothèque, après aperçu ligne par ligne.
 * D-085 : un ancien programme entier devient un programme type (semaines), après aperçu semaine par semaine.
 */
export default async function ImportLibraryPage({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { wid } = await params;
  const program = (await searchParams).mode === 'programme';
  const actor = await requireActor();
  if (!(await coachContext(actor.userId, wid))) notFound();
  const existing = program ? [] : (await listLibrary(actor.userId, wid)).map((i) => i.workout.title.toLowerCase());
  return (
    <>
      <Link className="back" href={`/coach/${wid}/library`}>← Bibliothèque</Link>
      <div className="head"><div><div className="kicker">Bibliothèque</div><h1>{program ? 'Importer un programme' : 'Importer mes séances'}</h1>
        <p className="sub">{program
          ? 'Colle un ancien programme, semaine par semaine. Tu vois chaque séance avant d’enregistrer ; il devient un programme type que tu appliques ensuite à un élève, en brouillons.'
          : 'Reprends ta base existante : un fichier CSV (enregistré depuis Excel, Numbers ou Google Sheets), des cellules copiées d’un tableur, ou une séance par ligne « Titre : séance ». Tu vois chaque séance avant d’importer ; rien n’est écrasé.'}</p></div></div>
      <nav className="seg-links" aria-label="Que veux-tu importer ?">
        <Link href={`/coach/${wid}/library/import`} aria-current={program ? undefined : 'page'}>Des séances</Link>
        <Link href={`/coach/${wid}/library/import?mode=programme`} aria-current={program ? 'page' : undefined}>Un programme entier</Link>
      </nav>
      {program ? <ProgramImport wid={wid} /> : <LibraryImport wid={wid} existing={existing} />}
    </>
  );
}
