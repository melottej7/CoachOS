import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { CoachHeader } from '@/components/coach-card';
import { IntroTour, type TourStep } from '@/components/intro-tour';
import { Pill, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Bienvenue' };

/** Guide d’introduction athlète avec l’avatar (D-021). Juste après l’invitation, puis via Profil. */
export default async function AthleteWelcome({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string }> }) {
  const { wid } = await params;
  const { first } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const name = actor.displayName.split(/[\s.]/)[0];
  const ws = await readWorkspacePublic(actor.userId, wid);
  const base = `/athlete/${wid}`;
  const next = first ? `${base}/setup?first=1` : `${base}/today`;

  const steps: TourStep[] = [
    {
      title: `Bienvenue dans ${ctx.workspace.name}`,
      text: `Salut ${name} ! Moi, c’est Allure. En une minute, je te montre comment CoachOS t’accompagne avec ton coach.`,
      mood: 'cheer',
      preview: ws ? <CoachHeader data={ws} /> : undefined,
    },
    {
      title: 'Ta séance du jour',
      text: 'Chaque jour, ouvre l’écran Aujourd’hui : tu y trouves la séance préparée par ton coach, avec sa durée et ses consignes.',
      preview: (
        <div className="athlete-card">
          <Pill>Course à pied</Pill>
          <h2>Footing facile</h2>
          <p className="sub">35 min · 10 min très faciles, puis allure de conversation.</p>
        </div>
      ),
    },
    {
      title: 'Ton programme de la semaine',
      text: 'L’onglet Programme montre toute ta semaine. Seules les séances publiées par ton coach y apparaissent : pas de surprise de dernière minute.',
      preview: (
        <div className="card">
          <div className="row"><div className="date-cell"><strong>18</strong>Mer.</div><div className="row-text"><h3>Fartlek nature</h3><p>Course à pied · 45 min</p></div></div>
          <div className="row"><div className="date-cell"><strong>22</strong>Dim.</div><div className="row-text"><h3>Sortie longue</h3><p>Course à pied · 1 h 05</p></div></div>
        </div>
      ),
    },
    {
      title: 'Ton retour en 30 secondes',
      text: 'Après ta séance, dis si tu l’as faite, ton effort ressenti de 0 à 10 et un mot si tu veux. Ton coach le lit et ajuste la suite.',
      mood: 'wink',
      preview: (
        <div className="stack">
          <Pill>Réalisée</Pill>
          <div className="rpe" aria-hidden="true">
            {Array.from({ length: 11 }, (_, k) => <span key={k} className={`pill ${k === 6 ? '' : 'neutral'}`} style={{ justifyContent: 'center' }}>{k}</span>)}
          </div>
        </div>
      ),
    },
    {
      title: 'Faisons connaissance',
      text: 'Dernière étape : quelques questions sur ta pratique et tes objectifs, pour que ton coach te connaisse. Aucune question de santé.',
      mood: 'cheer',
      preview: <p><StatusBadge status="published" /> <span className="muted">Tu pourras tout modifier ensuite dans Profil.</span></p>,
    },
  ];

  return (
    <IntroTour
      steps={steps}
      finishHref={next}
      finishLabel={first ? 'Remplir mon profil' : 'Voir ma séance du jour'}
      skipHref={next}
    />
  );
}
