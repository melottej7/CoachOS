import Link from 'next/link';
import { redirect } from 'next/navigation';
import { demoAuthEnabled, getActor } from '@/server/auth/session';
import { safeNext, supabaseConfigured } from '@/server/supabase/server';
import { Brand } from '@/components/ui';
import { PasswordInput } from '@/components/password-input';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  credentials: 'Adresse e-mail ou mot de passe incorrect.',
  rate: 'Trop de tentatives rapprochées. Patiente une minute avant de réessayer.',
  link: 'Ce lien n’est plus valable (déjà utilisé ou expiré). Recommence la demande.',
};
const NOTICES: Record<string, string> = {
  confirm: 'Compte créé. Confirme ton adresse depuis l’e-mail reçu, puis connecte-toi.',
};

/** X02 : connexion par adresse et mot de passe (D-020). */
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor?.source === 'supabase') redirect(next === '/' ? '/choose-workspace' : next);
  const q = next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <>
      <header className="top"><Brand href="/login" /></header>
      <main id="contenu" className="athlete-zone">
        <h1>Connexion</h1>
        <p className="sub">Connecte-toi avec ton adresse e-mail et ton mot de passe.</p>
        {sp.error && ERRORS[sp.error] ? <p className="banner err" role="alert" style={{ marginTop: 18 }}>{ERRORS[sp.error]}</p> : null}
        {sp.notice && NOTICES[sp.notice] ? <p className="banner ok" role="status" style={{ marginTop: 18 }}>{NOTICES[sp.notice]}</p> : null}
        <form className="form" action="/auth/login" method="post" style={{ marginTop: 20 }}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
          </div>
          <PasswordInput autoComplete="current-password" />
          <div className="actions">
            <button className="btn primary" type="submit">Se connecter</button>
            <Link className="link-btn" href="/forgot-password">Mot de passe oublié ?</Link>
          </div>
        </form>
        <div className="card" style={{ marginTop: 28 }}>
          <div className="card-body stack">
            <p><strong>Coach, pas encore de compte ?</strong> <Link href={`/signup${q}`}>Créer un compte coach</Link></p>
            <p className="muted">Athlète : ton compte se crée depuis l’e-mail d’invitation de ton coach (bouton « Rejoindre l’espace »).</p>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 16 }}><Link href="/confidentialite">Comment CoachOS protège tes données</Link></p>
        {demoAuthEnabled() ? <p className="muted" style={{ marginTop: 24 }}>Développement : <Link href="/demo">identités de démonstration</Link>.</p> : null}
      </main>
    </>
  );
}
