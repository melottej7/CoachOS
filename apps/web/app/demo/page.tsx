import { notFound } from 'next/navigation';
import { demoAuthEnabled, getActor } from '@/server/auth/session';
import { DEMO_IDENTITIES } from '@/server/db/fixtures';
import { supabaseConfigured } from '@/server/supabase/server';
import { Brand, initials } from '@/components/ui';

export const metadata = { title: 'Démonstration' };
export const dynamic = 'force-dynamic';

/**
 * Entrée de démonstration (tranches A et B) : choisir une identité fictive.
 * Remplacée par /login (Supabase Auth) en tranche C. Absente en production.
 */
export default async function Demo({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (!demoAuthEnabled()) notFound();
  const actor = await getActor();
  const { reset } = await searchParams;
  const real = supabaseConfigured();
  return (
    <>
      <header className="top"><Brand href="/demo" /><div className="top-meta"><span className="demo-tag">Données fictives</span></div></header>
      <main id="contenu" className="main" style={{ maxWidth: 960 }}>
        <div className="head">
          <div>
            <div className="kicker">Environnement local</div>
            <h1>Choisir une identité</h1>
            <p className="sub">
              Ouvrir le coach sur ordinateur et l’athlète sur téléphone (ou dans une fenêtre étroite) pour dérouler
              créer → publier → lire → envoyer un retour → traiter.
            </p>
          </div>
        </div>
        {reset ? <p className="banner ok" role="status" style={{ marginBottom: 16 }}>Données de démonstration réinitialisées.</p> : null}
        {actor ? <p className="muted" style={{ marginBottom: 12 }}>Identité actuelle : {actor.displayName}{actor.source === 'supabase' ? ' (connexion réelle)' : ' (démo)'}.</p> : null}
        {real ? (
          <p className="banner" style={{ marginBottom: 16 }}>
            Connexion réelle disponible : <a href="/login">se connecter</a> avec l’une des adresses ci-dessous et le mot de passe
            de démonstration (constante <code>DEMO_PASSWORD</code> de <code>apps/web/server/db/fixtures.ts</code>).
            Un clic sur une carte ouvre l’identité directement (raccourci de développement).
          </p>
        ) : null}
        <div className="demo-grid">
          {DEMO_IDENTITIES.map((i) => (
            <form key={i.userId} action="/api/dev/identity" method="post">
              <input type="hidden" name="userId" value={i.userId} />
              <button className="identity" type="submit">
                <span className="actions"><span className="avatar" aria-hidden="true">{initials(i.name)}</span><strong>{i.name}</strong></span>
                <span>{i.role === 'coach' ? 'Coach' : 'Athlète'} · {i.workspace}</span>
                <small>{i.description}</small>
                {real ? <small>{i.email}</small> : null}
              </button>
            </form>
          ))}
        </div>
        <section className="card" style={{ marginTop: 28 }}>
          <div className="card-head"><h2>Réinitialiser</h2></div>
          <div className="card-body stack">
            <p>Remplace les séances et retours saisis par le jeu de départ, daté autour d’aujourd’hui.</p>
            <form action="/api/dev/reset" method="post"><button className="btn" type="submit">Réinitialiser la démo</button></form>
          </div>
        </section>
      </main>
    </>
  );
}
