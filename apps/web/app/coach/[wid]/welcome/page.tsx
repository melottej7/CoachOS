import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { IntroTour, type TourStep } from '@/components/intro-tour';
import { Pill, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Guide' };

/** Guide d’introduction coach avec l’avatar (D-021). Après la création d’espace, puis via « Guide ». */
export default async function CoachWelcome({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string }> }) {
  const { wid } = await params;
  const { first } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const name = actor.displayName.split(/[\s.]/)[0];
  const base = `/coach/${wid}`;
  const next = first ? `${base}/athletes/new?first=1` : `${base}/calendar`;

  const steps: TourStep[] = [
    {
      title: `${ctx.workspace.name} est prêt`,
      text: `Bonjour ${name} ! Moi, c’est Allure. Je te montre en une minute la boucle de CoachOS : inviter, planifier, publier, puis lire les retours.`,
      mood: 'cheer',
    },
    {
      title: 'Invite tes athlètes',
      text: 'Ajoute un athlète avec son adresse e-mail : il reçoit un lien personnel, crée son compte et remplit un court profil sportif que tu retrouves dans son dossier.',
      preview: <p><Pill tone="neutral">Invité·e</Pill> <span className="muted">puis</span> <Pill>A rejoint l’espace</Pill></p>,
    },
    {
      title: 'Prépare la semaine',
      text: 'Dans Planning, crée tes séances jour par jour. Un brouillon reste invisible pour l’athlète : rien ne part tant que tu ne cliques pas sur Publier.',
      preview: (
        <div className="stack">
          <span className="session draft" style={{ display: 'block' }}><strong>Montées régulières</strong><small>45 min · Brouillon</small></span>
          <span className="session" style={{ display: 'block' }}><strong>Footing facile</strong><small>35 min · Publiée</small></span>
          <p className="muted"><StatusBadge status="draft" /> invisible · <StatusBadge status="published" /> visible par l’athlète</p>
        </div>
      ),
    },
    {
      title: 'Lis et traite les retours',
      text: 'Après chaque séance, l’athlète déclare ce qu’il a fait et son effort. Ils arrivent dans Retours : compare le prévu et le réalisé, puis marque le retour comme traité.',
      mood: 'wink',
      preview: <p>Retours <span className="count">2</span> <span className="muted">· Réalisée · Effort 6/10 · avec commentaire</span></p>,
    },
    {
      title: 'C’est parti',
      text: first ? 'Commence par ajouter ton premier athlète. Tu peux revoir ce guide à tout moment depuis le menu « Guide ».' : 'Tu peux revoir ce guide à tout moment depuis le menu « Guide ».',
      mood: 'cheer',
    },
  ];

  return (
    <IntroTour steps={steps} finishHref={next} finishLabel={first ? 'Ajouter mon premier athlète' : 'Aller au planning'} skipHref={next} />
  );
}
