import { TERMS_VERSION, termsSections } from '@/server/legal/texts';
import { LegalPage } from '@/views/public/legal-page';

export const metadata = { title: 'Conditions d’utilisation' };
export const dynamic = 'force-dynamic';

/** D-174 · Conditions d’utilisation, publiques (brouillon à faire relire par un professionnel, D-120). */
export default function Terms() {
  return <LegalPage title="Conditions d’utilisation" intro={`Les règles du jeu entre CoachOS, les coachs et leurs élèves, en clair. Version ${TERMS_VERSION}.`} sections={termsSections()} />;
}
