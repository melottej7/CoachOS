'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

function TimeZoneSelect({ id, value, onChange, zones }: { id: string; value: string; onChange: (v: string) => void; zones: string[] }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {zones.map((z) => (
        <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}

/** X04 : créer un espace coach. Même clé rejouée → même espace (C02-08). */
export function WorkspaceForm({ zones, defaultZone }: { zones: string[]; defaultZone: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const { run, pending, error } = useIntent<{ id: string }>();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const done = await run('POST', '/api/v1/workspaces', { name, timeZone });
    if (done) router.push(`/coach/${done.id}/athletes/new?first=1`);
  }
  const err = (p: string) => fieldError(error, p);
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <div className="field">
        <label htmlFor="name">Nom de l’espace <span className="hint">Visible par tes athlètes, par exemple ton nom ou celui de ton club</span></label>
        <input id="name" required maxLength={120} autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err('name')} />
        {err('name') ? <span className="field-error">{err('name')}</span> : null}
      </div>
      <div className="field">
        <label htmlFor="timeZone">Fuseau horaire <span className="hint">Sert de valeur par défaut pour tes athlètes</span></label>
        <TimeZoneSelect id="timeZone" value={timeZone} onChange={setTimeZone} zones={zones} />
        {err('timeZone') ? <span className="field-error">{err('timeZone')}</span> : null}
      </div>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Création…' : 'Créer mon espace'}</button>
      </div>
    </form>
  );
}

/**
 * X13 : créer la fiche puis, si une adresse est saisie, envoyer l’invitation.
 * Si l’envoi échoue après la création, la fiche n’est pas recréée : seule l’invitation est rejouée.
 */
export function AthleteForm({ wid, zones, defaultZone }: { wid: string; zones: string[]; defaultZone: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const [email, setEmail] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const create = useIntent<{ id: string }>();
  const invite = useIntent<{ invitationId: string }>();
  const pending = create.pending || invite.pending;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    let id = createdId;
    if (!id) {
      const done = await create.run('POST', `/api/v1/workspaces/${wid}/athletes`, { displayName, timeZone });
      if (!done) return;
      id = done.id;
      setCreatedId(id);
    }
    if (email.trim() === '') {
      router.push(`/coach/${wid}/athletes/${id}?notice=created`);
      return;
    }
    const sent = await invite.run('POST', `/api/v1/workspaces/${wid}/athletes/${id}/invite`, { email });
    if (sent) router.push(`/coach/${wid}/athletes/${id}?notice=invited`);
  }

  const error = create.error ?? invite.error;
  const err = (p: string) => fieldError(error, p);
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} retryLabel={createdId ? 'Renvoyer l’invitation' : 'Réessayer'} />
      {createdId && invite.error ? <p className="banner warn">La fiche est créée. Seule l’invitation reste à envoyer.</p> : null}
      <div className="field">
        <label htmlFor="displayName">Nom de l’athlète</label>
        <input id="displayName" required maxLength={100} autoFocus value={displayName} disabled={!!createdId}
          onChange={(e) => setDisplayName(e.target.value)} aria-invalid={!!err('displayName')} />
        {err('displayName') ? <span className="field-error">{err('displayName')}</span> : null}
      </div>
      <div className="field">
        <label htmlFor="timeZone">Fuseau horaire de l’athlète <span className="hint">Les séances suivent ses dates locales</span></label>
        <TimeZoneSelect id="timeZone" value={timeZone} onChange={setTimeZone} zones={zones} />
      </div>
      <div className="field">
        <label htmlFor="email">Adresse e-mail pour l’invitation <span className="hint">Facultatif · sert seulement à envoyer le lien, l’adresse n’est pas conservée</span></label>
        <input id="email" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err('email')} />
        {err('email') ? <span className="field-error">{err('email')}</span> : null}
      </div>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Envoi…' : email.trim() ? (createdId ? 'Envoyer l’invitation' : 'Créer et inviter') : 'Créer la fiche'}
        </button>
      </div>
    </form>
  );
}

/** Renvoyer un lien (C03-05) : l’ancien lien cesse de fonctionner. */
export function ResendInvitation({ wid, aid, label }: { wid: string; aid: string; label: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const { run, pending, error } = useIntent<{ invitationId: string }>();
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/invite`, { email });
    if (done) {
      setEmail('');
      router.replace(`/coach/${wid}/athletes/${aid}?notice=invited`);
      router.refresh();
    }
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <div className="field">
        <label htmlFor="email">Adresse e-mail de l’athlète</label>
        <input id="email" type="email" inputMode="email" autoComplete="off" required maxLength={254} value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldError(error, 'email')} />
        {fieldError(error, 'email') ? <span className="field-error">{fieldError(error, 'email')}</span> : null}
      </div>
      <div className="actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? 'Envoi…' : label}</button></div>
    </form>
  );
}

/** Annuler le lien en cours (C03-04). */
export function RevokeInvitation({ wid, aid, iid }: { wid: string; aid: string; iid: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ revoked: boolean }>();
  async function revoke() {
    const done = await run('DELETE', `/api/v1/workspaces/${wid}/invitations/${iid}`, {});
    if (done) {
      router.replace(`/coach/${wid}/athletes/${aid}?notice=revoked`);
      router.refresh();
    }
  }
  return (
    <div className="stack">
      <ErrorSummary error={error} onRetry={() => void revoke()} />
      <button type="button" className="btn" onClick={() => void revoke()} disabled={pending}>{pending ? 'Annulation…' : 'Annuler l’invitation'}</button>
    </div>
  );
}
