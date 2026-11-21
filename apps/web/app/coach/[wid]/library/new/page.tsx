import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listBlockTemplates } from '@/server/repo/library';
import { LibraryForm } from '@/components/library-form';
import { listExercises } from '@/server/repo/exercises';

export const metadata = { title: 'Nouvelle séance de bibliothèque' };

export default async function NewLibraryWorkout({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  if (!(await coachContext(actor.userId, wid))) notFound();
  return (
    <>
      <Link className="back" href={`/coach/${wid}/library`}>← Bibliothèque</Link>
      <div className="head"><div><div className="kicker">Bibliothèque</div><h1>Nouvelle séance</h1></div></div>
      <section className="card"><div className="card-body"><LibraryForm wid={wid} exercises={(await listExercises(actor.userId, wid)).map((x) => ({ id: x.id, name: x.name }))} savedBlocks={await listBlockTemplates(actor.userId, wid)} /></div></section>
    </>
  );
}
