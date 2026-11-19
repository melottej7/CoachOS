'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';
import { PasswordInput } from './password-input';
import { CoachHeader, type CoachCardData } from './coach-card';

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
      router.push(`/athlete/${done.workspaceId}/setup?first=1`);
    }
  }

  if (token === undefined) return <p className="muted">Lecture de l’invitation…</p>;
  const header = <InvitationPreview token={token} />;
  if (token === null) {
    return (
      <p className="banner warn">
        Ce lien est incomplet. Ouvre de nouveau le bouton « Rejoindre l’espace » de l’e-mail d’invitation, ou demande un nouveau lien à ton coach.
      </p>
    );
  }

  if (!signedInAs) {
    if (!loginEnabled) return <p><a href="/demo">Choisir une identité de démonstration</a></p>;
    return <div className="stack">{header}<SignedOutChoice token={token} /></div>;
  }

  const wrongAccount = error?.kind === 'error' && error.code === 'ACTION_FORBIDDEN_OR_FEATURE_DISABLED';
  const dead = error?.kind === 'error' && (error.code === 'CONFLICT_OR_QUOTA' || error.code === 'RESOURCE_NOT_VISIBLE');
  return (
    <div className="stack">
      {header}
      {wrongAccount ? (
        // Point de vue de la personne invitée : le navigateur est resté connecté au compte de quelqu’un d’autre.
        <div className="stack">
          <div className="banner warn" role="alert">
            <p><strong>Ce lien n’est pas destiné au compte « {signedInAs} »</strong></p>
            <p>L’invitation a été envoyée à une autre adresse e-mail, et ce navigateur est encore connecté au compte « {signedInAs} ». Si tu es la personne invitée, continue : ce compte sera déconnecté et l’invitation gardée, pour que tu crées ou ouvres ton propre compte.</p>
          </div>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value="/invite" />
            <button className="btn primary" type="submit">Je suis la personne invitée : continuer</button>
          </form>
          <p className="muted">Astuce pour tester à deux sur le même ordinateur : ouvre le lien d’invitation dans une fenêtre de navigation privée.</p>
        </div>
      ) : (
        <>
          <p>Tu vas rejoindre cet espace avec le compte <strong>{signedInAs}</strong>.</p>
          <ErrorSummary error={error} onRetry={() => void accept()} />
        </>
      )}
      {!dead && !wrongAccount ? (
        <div className="actions">
          <button className="btn primary" type="button" onClick={() => void accept()} disabled={pending}>
            {pending ? 'Activation…' : 'Rejoindre l’espace'}
          </button>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value="/invite" />
            <button className="link-btn" type="submit">Ce n’est pas ton compte ? Changer de compte</button>
          </form>
        </div>
      ) : null}
      {dead ? <button type="button" className="link-btn" onClick={() => { forget(); router.push('/choose-workspace'); }}>Revenir à mes espaces</button> : null}
    </div>
  );
}

/**
 * Pas encore connecté·e : créer son compte (cas courant) ou se connecter à un compte existant.
 * L’adresse doit être celle qui a reçu l’invitation ; le serveur le vérifie avant de créer le compte.
 */
function SignedOutChoice({ token }: { token: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const { run, pending, error } = useIntent<{ workspaceId: string; athleteId: string }>();

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const done = await run('POST', '/auth/invite-register', {
      token,
      displayName: String(f.get('displayName') ?? ''),
      email: String(f.get('email') ?? ''),
      password: String(f.get('password') ?? ''),
    });
    if (done) {
      forget();
      router.push(`/athlete/${done.workspaceId}/setup?first=1`);
      router.refresh();
    }
  }

  if (mode === 'login') {
    return (
      <div className="stack">
        <p>Connecte-toi avec le compte lié à <strong>l’adresse qui a reçu l’invitation</strong>. Tu reviendras ensuite ici pour rejoindre l’espace.</p>
        <form className="form" action="/auth/login" method="post">
          <input type="hidden" name="next" value="/invite" />
          <div className="field">
            <label htmlFor="login-email">Adresse e-mail</label>
            <input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </div>
          <PasswordInput autoComplete="current-password" />
          <div className="actions">
            <button className="btn primary" type="submit">Se connecter</button>
            <button type="button" className="link-btn" onClick={() => setMode('create')}>Je n’ai pas encore de compte</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="stack">
      <p>Crée ton compte avec <strong>l’adresse qui a reçu l’invitation</strong> et choisis ton mot de passe.</p>
      <ErrorSummary error={error} />
      <form className="form" onSubmit={create} noValidate>
        <div className="field">
          <label htmlFor="displayName">Ton nom</label>
          <input id="displayName" name="displayName" autoComplete="name" required maxLength={100} aria-invalid={!!fieldError(error, 'displayName')} />
          {fieldError(error, 'displayName') ? <span className="field-error">{fieldError(error, 'displayName')}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} aria-invalid={!!fieldError(error, 'email')} />
          {fieldError(error, 'email') ? <span className="field-error">{fieldError(error, 'email')}</span> : null}
        </div>
        <PasswordInput autoComplete="new-password" minLength={8} hint="8 caractères minimum" />
        {fieldError(error, 'password') ? <span className="field-error">{fieldError(error, 'password')}</span> : null}
        <div className="actions">
          <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Création…' : 'Créer mon compte et rejoindre'}</button>
          <button type="button" className="link-btn" onClick={() => setMode('login')}>J’ai déjà un compte</button>
        </div>
      </form>
    </div>
  );
}

/** Présentation de l’espace qui invite, obtenue avec le jeton (aucune donnée d’athlète). */
function InvitationPreview({ token }: { token: string | null }) {
  const [data, setData] = useState<CoachCardData | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch('/api/v1/invitations/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { workspace?: CoachCardData } | null) => { if (alive && b?.workspace) setData(b.workspace); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [token]);
  if (!data) return null;
  return (
    <div className="tour-preview" data-accent={(data.profile as { accent?: string } | null)?.accent ?? 'emerald'} aria-label="Espace qui t’invite">
      <CoachHeader data={data} />
    </div>
  );
}
