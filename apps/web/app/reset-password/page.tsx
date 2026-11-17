import { redirect } from 'next/navigation';
import { PASSWORD_MIN } from '@coachos/domain';
import { getActor } from '@/server/auth/session';
import { Brand } from '@/components/ui';
import { PasswordInput } from '@/components/password-input';

export const metadata = { title: 'Nouveau mot de passe' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  weak: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
  same: 'Choisis un mot de passe différent de l’ancien.',
};

/** Arrivée depuis le lien de réinitialisation : la session de récupération est active. */
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await getActor();
  if (actor?.source !== 'supabase') redirect('/forgot-password?error=expired');
  const sp = await searchParams;
  return (
    <>
      <header className="top"><Brand href="/login" /></header>
      <main id="contenu" className="athlete-zone">
        <h1>Nouveau mot de passe</h1>
        <p className="sub">Choisis le mot de passe que tu utiliseras désormais pour te connecter.</p>
        {sp.error && ERRORS[sp.error] ? <p className="banner err" role="alert" style={{ marginTop: 18 }}>{ERRORS[sp.error]}</p> : null}
        <form className="form" action="/auth/reset" method="post" style={{ marginTop: 20 }}>
          <PasswordInput autoComplete="new-password" label="Nouveau mot de passe" minLength={PASSWORD_MIN} hint={`${PASSWORD_MIN} caractères minimum`} />
          <div className="actions"><button className="btn primary" type="submit">Enregistrer</button></div>
        </form>
      </main>
    </>
  );
}
