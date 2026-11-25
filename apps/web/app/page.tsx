import { redirect } from 'next/navigation';
import { getActor } from '@/server/auth/session';
import { Landing } from '@/views/public/landing';

export const dynamic = 'force-dynamic';

/** Connecté : son espace. Visiteur : la page publique de CoachOS (D-174). */
export default async function Home() {
  if (await getActor()) redirect('/choose-workspace');
  return <Landing />;
}
