import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { listWorkspaces, type WorkspaceSummary } from '@/server/repo/context';
import { TopBar } from '@/components/ui';

export const metadata = { title: 'Choisir un espace' };

const ROLE: Record<WorkspaceSummary['role'], string> = { owner: 'Coach propriétaire', coach: 'Coach', athlete: 'Athlète' };
const home = (w: WorkspaceSummary) => (w.role === 'athlete' ? `/athlete/${w.id}/today` : `/coach/${w.id}/planning`);

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
        <p className="sub">Connecté·e en tant que <strong>{actor.displayName}</strong>. <Link href="/profile">Ce n’est pas ton nom ? Le modifier</Link></p>
        <section className="card" style={{ marginTop: 20 }} aria-label="Espaces">
          {spaces.length === 0 ? (
            <div className="card-body stack">
              <h2>Tu es coach ? Crée ton espace de coaching</h2>
              <p>Ton espace, c’est ton activité dans CoachOS, comme ton club ou ta structure : tes élèves, leurs séances, ta bibliothèque, les retours, les messages et ta présentation. Tu y invites ensuite tes élèves.</p>
              <p><Link className="btn primary" href="/coach/new">Créer mon espace de coaching</Link></p>
              <p className="muted">Tu es élève ? Tu n’as rien à créer : ouvre l’e-mail d’invitation de ton coach et clique sur « Rejoindre l’espace ».</p>
            </div>
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
        {spaces.length ? <p style={{ marginTop: 16 }}><Link className="btn" href="/coach/new">+ Créer un autre espace de coaching</Link></p> : null}
      </main>
    </>
  );
}
