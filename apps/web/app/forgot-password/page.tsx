import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/server/supabase/server';
import { Brand } from '@/components/ui';

export const metadata = { title: 'Mot de passe oublié' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  email: 'Saisis une adresse e-mail valide.',
  rate: 'Trop de demandes rapprochées. Patiente une minute avant de redemander.',
  expired: 'Le lien de réinitialisation n’est plus valable. Fais une nouvelle demande.',
};

/** C02-06 : réponse identique pour une adresse connue ou inconnue. */
export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const mailpit = process.env.NODE_ENV !== 'production' ? process.env.MAILPIT_URL : undefined;
  return (
    <>
      <header className="top"><Brand href="/login" /></header>
      <main id="contenu" className="athlete-zone">
        <Link className="back" href="/login">← Connexion</Link>
        <h1>Mot de passe oublié</h1>
        <p className="sub">Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.</p>
        {sp.sent ? (
          <div className="banner ok" role="status" style={{ marginTop: 18 }}>
            <p><strong>Vérifie ta boîte e-mail.</strong> Si un compte existe avec cette adresse, un lien vient d’être envoyé. Il est valable une heure.</p>
            {mailpit ? <p style={{ marginTop: 8 }}>En local, les e-mails arrivent dans <a href={mailpit} target="_blank" rel="noreferrer">la boîte de test Mailpit</a>.</p> : null}
          </div>
        ) : null}
        {sp.error && ERRORS[sp.error] ? <p className="banner err" role="alert" style={{ marginTop: 18 }}>{ERRORS[sp.error]}</p> : null}
        <form className="form" action="/auth/forgot" method="post" style={{ marginTop: 20 }}>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus={!sp.sent} />
          </div>
          <div className="actions"><button className="btn primary" type="submit">Recevoir un lien</button></div>
        </form>
      </main>
    </>
  );
}
