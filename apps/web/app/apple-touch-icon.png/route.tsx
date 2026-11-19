import { brandIcon } from '../brand-icon';

/** iPhone : icône de l’écran d’accueil (demandée à cette adresse par Safari). */
export async function GET() {
  const res = brandIcon(180, false, true);
  res.headers.set('cache-control', 'public, max-age=86400');
  return res;
}
