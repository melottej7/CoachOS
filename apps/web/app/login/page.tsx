import Link from 'next/link';
import { redirect } from 'next/navigation';
import { demoAuthEnabled, getActor } from '@/server/auth/session';
import { safeNext, supabaseConfigured } from '@/server/supabase/server';
import { Brand } from '@/components/ui';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  link: 'Ce lien de connexion n’est plus valable (déjà utilisé ou expiré). Demande un nouveau lien ci-dessous.',
  email: 'Saisis une adresse e-mail valide.',
  send: 'L’envoi du lien a échoué. Réessaie dans un instant.',
  rate: 'Trop de demandes rapprochées. Patiente une minute avant de redemander un lien.',
};

/** X02 : recevoir un lien de connexion. Message de succès neutre (ne révèle pas si le compte existe). */
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor?.source === 'supabase') redirect(next === '/' ? '/choose-workspace' : next);
  const mailpit = process.env.NODE_ENV !== 'production' ? process.env.MAILPIT_URL : undefined;
  return (
    <>
      <header className="top"><Brand href="/login" /></header>
      <main id="contenu" className="athlete-zone">
        <h1>Connexion</h1>
        <p className="sub">Reçois un lien de connexion par e-mail. Pas de mot de passe à retenir.</p>
        {sp.sent ? (
          <div className="banner ok" role="status" style={{ marginTop: 18 }}>
            <p><strong>Vérifie ta boîte e-mail.</strong> Si cette adresse peut se connecter, un lien vient d’être envoyé. Il est valable une heure et ne sert qu’une fois.</p>
            {mailpit ? <p style={{ marginTop: 8 }}>En local, les e-mails arrivent dans <a href={mailpit} target="_blank" rel="noreferrer">la boîte de test Mailpit</a>.</p> : null}
          </div>
        ) : null}
        {sp.error && ERRORS[sp.error] ? <p className="banner err" role="alert" style={{ marginTop: 18 }}>{ERRORS[sp.error]}</p> : null}
        <form className="form" action="/auth/login" method="post" style={{ marginTop: 20 }}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus={!sp.sent} />
          </div>
          <div className="actions">
            <button className="btn primary" type="submit">{sp.sent ? 'Renvoyer un lien' : 'Recevoir un lien de connexion'}</button>
          </div>
        </form>
        {demoAuthEnabled() ? <p className="muted" style={{ marginTop: 24 }}>Développement : <Link href="/demo">identités de démonstration</Link>.</p> : null}
      </main>
    </>
  );
}
