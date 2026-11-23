import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listExercises } from '@/server/repo/exercises';
import { portfolio } from '@/server/repo/portfolio';
import { ExerciseLibrary } from '@/components/exercise-library';

export const metadata = { title: 'Exercices' };

/** D-096 · Bibliothèque d’exercices de musculation, avec les vidéos du coach. */
export default async function Exercises({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, p] = [await listExercises(actor.userId, wid), await portfolio(actor.userId, wid, ctx.workspace.timeZone)];
  return (
    <>
      <div className="head">
        <div><div className="kicker">Séances</div><h1>Exercices</h1>
          <p className="sub">Tes exercices de musculation, avec tes consignes et tes vidéos. Compose ensuite une séance « Musculation » : tes élèves la suivent à distance, vidéo à l’appui.</p></div>
      </div>
      {!ctx.modules.strength ? <p className="banner warn">La musculation n’est pas cochée dans tes sports encadrés (Paramètres) : l’onglet Exercices est masqué et le sport « Musculation » n’est pas proposé dans tes séances.</p> : null}
      <section className="card"><div className="card-body"><ExerciseLibrary wid={wid} items={items} /></div></section>
    </>
  );
}
