'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorSummary } from './feedback-banners';
import { useIntent } from './use-intent';

const KEY = 'coachos_pending_invitation';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function readSaved(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { token?: string; at?: number };
    if (!v.token || !v.at || Date.now() - v.at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return v.token;
  } catch {
    return null;
  }
}
function forget() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : rien à effacer */
  }
}

/**
 * X06. Le jeton arrive dans le fragment (#token=…) : il n’est jamais envoyé au serveur dans l’URL.
 * Il est gardé dans ce navigateur le temps de la connexion par lien, puis effacé après usage.
 */
export function AcceptInvitation({ signedInAs, loginEnabled }: { signedInAs: string | null; loginEnabled: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const { run, pending, error } = useIntent<{ workspaceId: string; athleteId: string }>();

  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (fromHash) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ token: fromHash, at: Date.now() }));
      } catch {
        /* navigation privée : le jeton reste en mémoire pour cet onglet */
      }
      window.history.replaceState(null, '', window.location.pathname);
      setToken(fromHash);
      return;
    }
    setToken(readSaved());
  }, []);

  async function accept() {
    if (!token) return;
    const done = await run('POST', '/api/v1/invitations/accept', { token });
    if (done) {
      forget();
      router.push(`/athlete/${done.workspaceId}/today?notice=joined`);
    }
  }

  if (token === undefined) return <p className="muted">Lecture de l’invitation…</p>;
  if (token === null) {
    return (
      <p className="banner warn">
        Ce lien est incomplet. Ouvre de nouveau le bouton « Rejoindre l’espace » de l’e-mail d’invitation, ou demande un nouveau lien à ton coach.
      </p>
    );
  }

  if (!signedInAs) {
    return (
      <div className="stack">
        <p>Pour rejoindre l’espace, connecte-toi avec <strong>l’adresse e-mail qui a reçu l’invitation</strong>. Tu recevras un lien de connexion, puis tu reviendras ici.</p>
        {loginEnabled ? (
          <form className="form" action="/auth/login" method="post">
            <input type="hidden" name="next" value="/invite" />
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
            </div>
            <div className="actions"><button className="btn primary" type="submit">Recevoir un lien de connexion</button></div>
          </form>
        ) : (
          <p><a href="/demo">Choisir une identité de démonstration</a></p>
        )}
      </div>
    );
  }

  const wrongAccount = error?.kind === 'error' && error.code === 'ACTION_FORBIDDEN_OR_FEATURE_DISABLED';
  const dead = error?.kind === 'error' && (error.code === 'CONFLICT_OR_QUOTA' || error.code === 'RESOURCE_NOT_VISIBLE');
  return (
    <div className="stack">
      <p>Connecté·e en tant que <strong>{signedInAs}</strong>.</p>
      <ErrorSummary error={error} onRetry={() => void accept()} />
      {wrongAccount ? (
        <form action="/auth/signout" method="post">
          <button className="btn" type="submit">Changer de compte</button>
        </form>
      ) : null}
      {!dead && !wrongAccount ? (
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => void accept()} disabled={pending}>
            {pending ? 'Activation…' : 'Rejoindre l’espace'}
          </button>
        </div>
      ) : null}
      {dead ? <button type="button" className="link-btn" onClick={() => { forget(); router.push('/choose-workspace'); }}>Revenir à mes espaces</button> : null}
    </div>
  );
}
