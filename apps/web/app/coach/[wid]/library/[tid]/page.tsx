import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { listBlockTemplates, readTemplate } from '@/server/repo/library';
import { LibraryForm } from '@/components/library-form';
import { listExercises } from '@/server/repo/exercises';

export const metadata = { title: 'Séance de bibliothèque' };

export default async function EditLibraryWorkout({ params }: { params: Promise<{ wid: string; tid: string }> }) {
  const { wid, tid } = await params;
  const actor = await requireActor();
  if (!(await coachContext(actor.userId, wid)) || !isUuid(tid)) notFound();
  const t = await readTemplate(actor.userId, wid, tid);
  if (!t || !t.mine) notFound();
  return (
    <>
      <Link className="back" href={`/coach/${wid}/library`}>← Bibliothèque</Link>
      <div className="head"><div><div className="kicker">Bibliothèque</div><h1>{t.workout.title}</h1>
        <p className="sub">Les séances déjà créées à partir de celle-ci ne changent pas.</p></div></div>
      <section className="card"><div className="card-body"><LibraryForm modules={(await coachContext(actor.userId, wid))?.modules} wid={wid} exercises={(await listExercises(actor.userId, wid)).map((x) => ({ id: x.id, name: x.name }))} savedBlocks={await listBlockTemplates(actor.userId, wid)} initial={{ id: t.id, revision: t.revision, category: t.category, workout: t.workout }} /></div></section>
    </>
  );
}
