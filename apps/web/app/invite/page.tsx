import { getActor } from '@/server/auth/session';
import { supabaseConfigured } from '@/server/supabase/server';
import { AcceptInvitation } from '@/components/accept-invitation';
import { Brand } from '@/components/ui';

export const metadata = { title: 'Invitation' };
export const dynamic = 'force-dynamic';

/** X06 : activer une relation avec une identité vérifiée. */
export default async function Invite() {
  const actor = await getActor();
  return (
    <>
      <header className="top"><Brand href="/" /></header>
      <main id="contenu" className="athlete-zone">
        <h1>Rejoindre un espace</h1>
        <p className="sub">Ton coach t’a invité·e sur CoachOS pour retrouver tes séances et lui envoyer tes retours.</p>
        <div className="card" style={{ marginTop: 18 }}><div className="card-body">
          <AcceptInvitation signedInAs={actor?.displayName ?? null} loginEnabled={supabaseConfigured()} />
        </div></div>
      </main>
    </>
  );
}
