'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { CoachCardData } from '@/components/coach-card';
import { fieldError, useIntent } from '@/components/use-intent';
import { AccentScope, Banner, Button, Card, Field, Grid, Input, LinkButton, PasswordInput, Skeleton, Stack, Text } from '@/design';
import { CoachIdentity } from '@/views/coach-profile';
import { ErrorSummary } from '@/views/error-summary';

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
 * X06, refonte Chrono (D-140). Le jeton arrive dans le fragment (#token=…) : il n’est jamais envoyé au serveur dans l’URL.
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

  if (token === undefined) {
    return (
      <Stack gap={3} aria-busy="true">
        <Skeleton height={96} radius={16} />
        <Text muted>Lecture de l’invitation…</Text>
      </Stack>
    );
  }
  if (token === null) {
    return (
      <Banner tone="warning" title="Ce lien est incomplet">
        Ouvre de nouveau le bouton « Rejoindre l’espace » de l’e-mail d’invitation, ou demande un nouveau lien à ton coach.
      </Banner>
    );
  }

  const preview = <InvitationPreview token={token} />;
  if (!signedInAs) {
    if (!loginEnabled) return <Stack gap={5}>{preview}<LinkButton href="/demo" variant="primary" size="lg" block>Choisir une identité de démonstration</LinkButton></Stack>;
    return <Stack gap={5}>{preview}<SignedOutChoice token={token} /></Stack>;
  }

  const wrongAccount = error?.kind === 'error' && error.code === 'ACTION_FORBIDDEN_OR_FEATURE_DISABLED';
  const dead = error?.kind === 'error' && (error.code === 'CONFLICT_OR_QUOTA' || error.code === 'RESOURCE_NOT_VISIBLE');
  return (
    <Stack gap={5}>
      {preview}
      {wrongAccount ? (
        // Point de vue de la personne invitée : le navigateur est resté connecté au compte de quelqu’un d’autre.
        <Stack gap={4}>
          <Banner tone="warning" title={`Ce lien n’est pas destiné au compte « ${signedInAs} »`}>
            L’invitation a été envoyée à une autre adresse e-mail, et ce navigateur est encore connecté au compte « {signedInAs} ». Si tu es la personne invitée, continue : ce compte sera déconnecté et l’invitation gardée, pour que tu crées ou ouvres ton propre compte.
          </Banner>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value="/invite" />
            <Button type="submit" variant="primary" size="lg" block>Je suis la personne invitée : continuer</Button>
          </form>
          <Text size="sm" muted>Astuce pour tester à deux sur le même ordinateur : ouvre le lien d’invitation dans une fenêtre de navigation privée.</Text>
        </Stack>
      ) : (
        <Stack gap={4}>
          <Text size="md">Tu vas rejoindre cet espace avec le compte <strong>{signedInAs}</strong>.</Text>
          <ErrorSummary error={error} onRetry={() => void accept()} />
        </Stack>
      )}
      {!dead && !wrongAccount ? (
        <Stack gap={2}>
          <Button variant="primary" size="lg" block loading={pending} onClick={() => void accept()}>Rejoindre l’espace</Button>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value="/invite" />
            <Button type="submit" variant="ghost" block>Ce n’est pas ton compte ? Changer de compte</Button>
          </form>
        </Stack>
      ) : null}
      {dead ? <Button variant="secondary" block onClick={() => { forget(); router.push('/choose-workspace'); }}>Revenir à mes espaces</Button> : null}
    </Stack>
  );
}

/**
 * Pas encore connecté·e : créer son compte (cas courant) ou se connecter à un compte existant.
 * L’adresse doit être celle qui a reçu l’invitation ; le serveur le vérifie avant de créer le compte.
 */
export function SignedOutChoice({ token }: { token: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const { run, pending, error } = useIntent<{ workspaceId: string; athleteId: string }>();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const done = await run('POST', '/auth/invite-register', {
      token,
      firstName: String(f.get('firstName') ?? ''),
      lastName: String(f.get('lastName') ?? ''),
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
      <Card pad={5}>
        <Stack gap={5}>
          <Text>Connecte-toi avec le compte lié à <strong>l’adresse qui a reçu l’invitation</strong>. Tu reviendras ensuite ici pour rejoindre l’espace.</Text>
          <form action="/auth/login" method="post"><Stack gap={4}>
            <input type="hidden" name="next" value="/invite" />
            <Field id="login-email" label="Adresse e-mail">
              <Input id="login-email" name="email" type="email" autoComplete="email" inputMode="email" required />
            </Field>
            <Field id="login-password" label="Mot de passe">
              <PasswordInput id="login-password" autoComplete="current-password" />
            </Field>
            <Button type="submit" variant="primary" size="lg" block>Se connecter</Button>
            <Button variant="ghost" block onClick={() => setMode('create')}>Je n’ai pas encore de compte</Button>
          </Stack></form>
        </Stack>
      </Card>
    );
  }

  const firstError = fieldError(error, 'firstName');
  const lastError = fieldError(error, 'lastName');
  const emailError = fieldError(error, 'email');
  const passwordError = fieldError(error, 'password');
  return (
    <Card pad={5}>
      <Stack gap={5}>
        <Text>Crée ton compte avec <strong>l’adresse qui a reçu l’invitation</strong> et choisis ton mot de passe.</Text>
        <ErrorSummary error={error} labels={{ firstName: 'Prénom', lastName: 'Nom' }} />
        <form onSubmit={create} noValidate><Stack gap={4}>
          <Grid min={160} gap={4}>
            <Field id="firstName" label="Prénom" error={firstError}>
              <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={50} invalid={!!firstError} />
            </Field>
            <Field id="lastName" label="Nom" error={lastError}>
              <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={50} invalid={!!lastError} />
            </Field>
          </Grid>
          <Field id="email" label="Adresse e-mail" error={emailError}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} invalid={!!emailError} />
          </Field>
          <Field id="password" label="Mot de passe" hint={passwordError ? undefined : '8 caractères minimum'} error={passwordError}>
            <PasswordInput id="password" autoComplete="new-password" minLength={8} hasHint={!passwordError} invalid={!!passwordError} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={pending}>Créer mon compte et rejoindre</Button>
          <Button variant="ghost" block onClick={() => setMode('login')}>J’ai déjà un compte</Button>
        </Stack></form>
      </Stack>
    </Card>
  );
}

/** Présentation de l’espace qui invite, obtenue avec le jeton (aucune donnée d’athlète), à la couleur du coach. */
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
    <AccentScope accent={(data.profile as { accent?: string } | null)?.accent ?? 'emerald'}>
      <section aria-label="Espace qui t’invite">
        <Card tinted pad={5}><CoachIdentity data={data} eyebrow="Ton coach t’invite" level={2} /></Card>
      </section>
    </AccentScope>
  );
}
