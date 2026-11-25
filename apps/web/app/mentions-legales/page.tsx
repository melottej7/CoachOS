import { HOSTS, imprint } from '@/server/legal/texts';
import type { NoticeSection } from '@/server/privacy/notice';
import { LegalPage } from '@/views/public/legal-page';

export const metadata = { title: 'Mentions légales' };
export const dynamic = 'force-dynamic';

/**
 * D-174 · Mentions légales. L’identité de l’éditeur vient du réglage COACHOS_LEGAL_PUBLISHER (fondateur) ; tant qu’elle
 * manque, la page le dit sobrement au lieu d’afficher un champ vide. Brouillon à faire relire (D-120).
 */
export default function Imprint() {
  const { publisher, contact } = imprint();
  const sections: NoticeSection[] = [
    {
      id: 'editeur',
      title: 'Éditeur',
      paragraphs: publisher ?? ['CoachOS est en phase pilote. Les coordonnées complètes de l’éditeur seront publiées ici avant l’ouverture des abonnements.'],
    },
    {
      id: 'contact',
      title: 'Contact',
      paragraphs: [contact ? `Par e-mail : ${contact}.` : 'Une adresse de contact sera publiée ici avant l’ouverture des abonnements. D’ici là, un élève s’adresse à son coach, dont le contact figure dans sa présentation.'],
    },
    {
      id: 'hebergement',
      title: 'Hébergement',
      paragraphs: ['CoachOS fonctionne chez ces prestataires :'],
      items: HOSTS.map((h) => `${h.name} · ${h.role} · ${h.site.replace('https://', '')}`),
    },
    {
      id: 'propriete',
      title: 'Propriété',
      paragraphs: ['Le nom CoachOS, l’interface et ses textes appartiennent à son éditeur. Les séances, programmes, vidéos et messages appartiennent à ceux qui les créent (conditions d’utilisation, « Tes contenus »).'],
    },
  ];
  return <LegalPage title="Mentions légales" intro="Qui édite CoachOS et où il est hébergé." sections={sections} />;
}
