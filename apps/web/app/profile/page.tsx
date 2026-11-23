import Link from 'next/link';
import { requireActor } from '@/server/auth/session';
import { readMe } from '@/server/commands/profile';
import { Notice, SignOutButton, TopBar } from '@/components/ui';
import { ProfileForm } from '@/components/profile-form';

export const metadata = { title: 'Mon profil' };

/** Profil d’identité (C02-07) : nom d’affichage et langue. */
export default async function Profile({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const actor = await requireActor();
  const { notice } = await searchParams;
  const me = (await readMe(actor.userId)) ?? { displayName: actor.displayName, locale: 'fr' as const };
  return (
    <>
      <TopBar home="/choose-workspace"><span>{me.displayName}</span></TopBar>
      <main id="contenu" className="athlete-zone">
        <Link className="back" href="/choose-workspace">← Mes espaces</Link>
        <Notice message={notice === 'saved' ? 'Profil enregistré.' : notice === 'password' ? 'Mot de passe modifié. Utilise-le à ta prochaine connexion.' : null} />
        <h1>Mon profil</h1>
        <div className="card" style={{ marginTop: 18 }}><div className="card-body">
          <ProfileForm initialName={me.displayName} initialLocale={me.locale} submitLabel="Enregistrer" after="/profile?notice=saved" />
        </div></div>
        <section className="card" style={{ marginTop: 18 }} aria-labelledby="mes-donnees"><div className="card-body stack">
          <h2 id="mes-donnees">Mes données</h2>
          <p className="muted">Télécharger tes données ou demander leur effacement se fait dans chaque espace : onglet Profil pour un athlète, Paramètres pour un coach. <Link href="/confidentialite">Politique de confidentialité</Link>.</p>
        </div></section>
        <div className="mobile-only" style={{ marginTop: 18 }}><SignOutButton className="btn" /></div>
      </main>
    </>
  );
}
