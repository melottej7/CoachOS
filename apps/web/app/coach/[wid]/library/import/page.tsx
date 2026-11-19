import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listLibrary } from '@/server/repo/library';
import { LibraryImport } from '@/components/library-import';

export const metadata = { title: 'Importer mes séances' };

/** D-079 (CE-B-06, CE-B-07) : la base du coach entre dans sa bibliothèque, après aperçu ligne par ligne. */
export default async function ImportLibraryPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  if (!(await coachContext(actor.userId, wid))) notFound();
  const existing = (await listLibrary(actor.userId, wid)).map((i) => i.workout.title.toLowerCase());
  return (
    <>
      <Link className="back" href={`/coach/${wid}/library`}>← Bibliothèque</Link>
      <div className="head"><div><div className="kicker">Bibliothèque</div><h1>Importer mes séances</h1>
        <p className="sub">Reprends ta base existante : un fichier CSV (enregistré depuis Excel, Numbers ou Google Sheets), des cellules copiées d’un tableur, ou une séance par ligne « Titre : séance ». Tu vois chaque séance avant d’importer ; rien n’est écrasé.</p></div></div>
      <LibraryImport wid={wid} existing={existing} />
    </>
  );
}
