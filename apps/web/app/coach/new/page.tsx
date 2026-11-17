import Link from 'next/link';
import { requireActor } from '@/server/auth/session';
import { TopBar } from '@/components/ui';
import { WorkspaceForm } from '@/components/roster-forms';

export const metadata = { title: 'Créer un espace' };

/** X04 : nom et fuseau. Première action utile ensuite : inviter un athlète. */
export default async function NewWorkspace() {
  const actor = await requireActor();
  const zones = Intl.supportedValuesOf('timeZone');
  return (
    <>
      <TopBar home="/choose-workspace"><span>{actor.displayName}</span></TopBar>
      <main id="contenu" className="athlete-zone">
        <Link className="back" href="/choose-workspace">← Mes espaces</Link>
        <h1>Créer ton espace coach</h1>
        <p className="sub">Ton espace regroupe tes athlètes, leurs séances et leurs retours. Tu pourras changer son nom plus tard.</p>
        <div className="card" style={{ marginTop: 18 }}><div className="card-body">
          <WorkspaceForm zones={zones} currentName={actor.displayName} defaultZone={zones.includes('Europe/Brussels') ? 'Europe/Brussels' : 'UTC'} />
        </div></div>
      </main>
    </>
  );
}
