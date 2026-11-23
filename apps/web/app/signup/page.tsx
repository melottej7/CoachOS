import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PASSWORD_MIN } from '@coachos/domain';
import { getActor } from '@/server/auth/session';
import { safeNext, supabaseConfigured } from '@/server/supabase/server';
import { Brand } from '@/components/ui';
import { PasswordInput } from '@/components/password-input';

export const metadata = { title: 'Créer un compte coach' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  weak: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
  fields: 'Vérifie ton prénom, ton nom et ton adresse e-mail.',
  exists: 'Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».',
  rate: 'Trop de tentatives rapprochées. Patiente une minute avant de réessayer.',
  failed: 'La création du compte a échoué. Réessaie dans un instant.',
};

/** Inscription coach (C02-01) : un compte, puis la création d’espace (X04). */
export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!supabaseConfigured()) redirect('/demo');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor?.source === 'supabase') redirect('/choose-workspace');
  return (
    <>
      <header className="top"><Brand href="/login" /></header>
      <main id="contenu" className="athlete-zone">
        <Link className="back" href="/login">← Connexion</Link>
        <h1>Créer un compte coach</h1>
        <p className="sub">Ensuite, tu créeras ton espace et tu inviteras tes athlètes.</p>
        {sp.error && ERRORS[sp.error] ? <p className="banner err" role="alert" style={{ marginTop: 18 }}>{ERRORS[sp.error]}</p> : null}
        <form className="form" action="/auth/signup" method="post" style={{ marginTop: 20 }}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="firstName">Prénom</label>
            <input id="firstName" name="firstName" autoComplete="given-name" required maxLength={50} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" autoComplete="family-name" required maxLength={50} />
          </div>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} />
          </div>
          <PasswordInput autoComplete="new-password" minLength={PASSWORD_MIN} hint={`${PASSWORD_MIN} caractères minimum`} />
          <div className="actions"><button className="btn primary" type="submit">Créer mon compte</button></div>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>En créant ton compte, tu acceptes que CoachOS traite tes données comme décrit dans la <Link href="/confidentialite">politique de confidentialité</Link>.</p>
      </main>
    </>
  );
}
