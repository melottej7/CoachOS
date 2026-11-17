import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { listWorkspaces, type WorkspaceSummary } from '@/server/repo/context';
import { TopBar } from '@/components/ui';

export const metadata = { title: 'Choisir un espace' };

const ROLE: Record<WorkspaceSummary['role'], string> = { owner: 'Coach propriétaire', coach: 'Coach', athlete: 'Athlète' };
const home = (w: WorkspaceSummary) => (w.role === 'athlete' ? `/athlete/${w.id}/today` : `/coach/${w.id}/calendar`);

/** X05 : relation et rôle. Une seule relation : ouverture directe. */
export default async function ChooseWorkspace() {
  const actor = await requireActor();
  const spaces = await listWorkspaces(actor.userId);
  if (spaces.length === 1) redirect(home(spaces[0]!));
  return (
    <>
      <TopBar home="/choose-workspace" />
      <main id="contenu" className="athlete-zone">
        <h1>Choisir un espace</h1>
        <p className="sub">Connecté·e en tant que {actor.displayName}.</p>
        <section className="card" style={{ marginTop: 20 }} aria-label="Espaces">
          {spaces.length === 0 ? (
            <p className="empty">
              Aucun espace n’est encore associé à ce compte. Athlète : ouvre le bouton « Rejoindre l’espace » de l’e-mail
              d’invitation de ton coach. Coach : crée ton espace ci-dessous.
            </p>
          ) : null}
          {spaces.map((w) => (
            <div className="row" key={w.id}>
              <div className="row-text">
                <h3>{w.name}</h3>
                <p>{ROLE[w.role]}</p>
              </div>
              <Link className="btn" href={home(w)}>Ouvrir</Link>
            </div>
          ))}
        </section>
        <p style={{ marginTop: 16 }}><Link className="btn" href="/coach/new">+ Créer un espace coach</Link></p>
      </main>
    </>
  );
}
