'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

type Delivery = 'link' | 'email';

/** D-149 : comment l’élève reçoit son lien. « Moi-même » marche sans e-mail (SMS, WhatsApp…). */
function DeliveryChoice({ value, onChange }: { value: Delivery; onChange: (v: Delivery) => void }) {
  return (
    <fieldset className="choice">
      <legend>Comment lui envoyer le lien ?</legend>
      <label className="check"><input type="radio" name="delivery" checked={value === 'link'} onChange={() => onChange('link')} />
        <span>Je l’envoie moi-même (SMS, WhatsApp…) <span className="hint">CoachOS te donne le lien à copier</span></span></label>
      <label className="check"><input type="radio" name="delivery" checked={value === 'email'} onChange={() => onChange('email')} />
        <span>Par e-mail, envoyé par CoachOS</span></label>
    </fieldset>
  );
}

/** D-149 : le lien à transmettre, une seule fois à l’écran ; copier ou partager. */
export function InvitationLinkPanel({ link, name, email, next }: { link: string; name: string; email: string; next: string }) {
  const [copied, setCopied] = useState(false);
  const first = name.split(' ')[0] || 'ton élève';
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="stack" role="status">
      <p className="banner ok"><strong>Lien d’invitation prêt.</strong> Envoie-le à {first} par SMS, WhatsApp ou de vive voix.</p>
      <div className="field">
        <label htmlFor="invite-link">Lien pour {first}</label>
        <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => void copy()}>{copied ? 'Lien copié ✓' : 'Copier le lien'}</button>
        {canShare ? <button type="button" className="btn" onClick={() => void navigator.share({ title: 'Ton invitation CoachOS', text: `Rejoins-moi sur CoachOS pour tes séances : ${link}` }).catch(() => undefined)}>Partager…</button> : null}
        <a className="btn" href={next}>Aller à la fiche</a>
      </div>
      <p className="muted">À l’ouverture du lien, {first} crée son compte avec <strong>{email}</strong> (l’adresse que tu as saisie) et choisit son mot de passe. Le lien sert une seule fois et reste valable 7 jours. Ensuite, sur son téléphone : Safari › Partager › « Sur l’écran d’accueil » (iPhone), ou Chrome › ⋮ › « Installer l’application » (Android).</p>
    </div>
  );
}

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
export function WorkspaceForm({ zones, defaultZone, currentName }: { zones: string[]; defaultZone: string; currentName: string }) {
  const router = useRouter();
  const [coachName, setCoachName] = useState(currentName);
  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const me = useIntent<{ displayName: string }>();
  const { run, pending: creating, error: createError } = useIntent<{ id: string }>();
  const pending = creating || me.pending;
  const error = me.error ?? createError;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (coachName.trim() !== currentName && !(await me.run('PATCH', '/api/v1/me', { displayName: coachName }))) return;
    const done = await run('POST', '/api/v1/workspaces', { name, timeZone });
    if (done) router.push(`/coach/${done.id}/settings?first=1`);
  }
  const err = (p: string) => fieldError(error, p);
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <div className="field">
        <label htmlFor="displayName">Ton nom <span className="hint">Nom de ton compte, modifiable plus tard dans ton profil</span></label>
        <input id="displayName" required maxLength={100} autoComplete="name" value={coachName} onChange={(e) => setCoachName(e.target.value)}
          aria-invalid={!!err('displayName')} />
        {err('displayName') ? <span className="field-error">{err('displayName')}</span> : null}
      </div>
      <div className="field">
        <label htmlFor="name">Nom de l’espace <span className="hint">Visible par tes athlètes, par exemple ton nom ou celui de ton club</span></label>
        <input id="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err('name')} />
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
  const [delivery, setDelivery] = useState<Delivery>('link');
  const [link, setLink] = useState<string | null>(null);
  const create = useIntent<{ id: string }>();
  const invite = useIntent<{ invitationId: string; link?: string }>();
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
    const sent = await invite.run('POST', `/api/v1/workspaces/${wid}/athletes/${id}/invite`, { email, delivery });
    if (sent?.link) setLink(sent.link);
    else if (sent) router.push(`/coach/${wid}/athletes/${id}?notice=invited`);
  }

  if (link && createdId) return <InvitationLinkPanel link={link} name={displayName} email={email.trim().toLowerCase()} next={`/coach/${wid}/athletes/${createdId}?notice=created`} />;

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
        <label htmlFor="email">Adresse e-mail pour l’invitation <span className="hint">Facultatif · seule cette adresse pourra rejoindre l’espace avec le lien ; elle n’est pas conservée</span></label>
        <input id="email" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err('email')} />
        {err('email') ? <span className="field-error">{err('email')}</span> : null}
      </div>
      {email.trim() ? <DeliveryChoice value={delivery} onChange={setDelivery} /> : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Envoi…' : email.trim() ? (delivery === 'link' ? (createdId ? 'Créer le lien' : 'Créer la fiche et le lien') : (createdId ? 'Envoyer l’invitation' : 'Créer et inviter')) : 'Créer la fiche'}
        </button>
      </div>
    </form>
  );
}

/** Renvoyer un lien (C03-05) : l’ancien lien cesse de fonctionner. */
export function ResendInvitation({ wid, aid, label, name = '' }: { wid: string; aid: string; label: string; name?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('link');
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const { run, pending, error } = useIntent<{ invitationId: string; link?: string }>();
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const done = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/invite`, { email, delivery });
    if (done?.link) { setLink({ url: done.link, email: email.trim().toLowerCase() }); setEmail(''); router.refresh(); return; }
    if (done) {
      setEmail('');
      router.replace(`/coach/${wid}/athletes/${aid}?notice=invited`);
      router.refresh();
    }
  }
  if (link) return <InvitationLinkPanel link={link.url} name={name} email={link.email} next={`/coach/${wid}/athletes/${aid}`} />;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <div className="field">
        <label htmlFor="email">Adresse e-mail de l’athlète</label>
        <input id="email" type="email" inputMode="email" autoComplete="off" required maxLength={254} value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldError(error, 'email')} />
        {fieldError(error, 'email') ? <span className="field-error">{fieldError(error, 'email')}</span> : null}
      </div>
      <DeliveryChoice value={delivery} onChange={setDelivery} />
      <div className="actions"><button className="btn primary" type="submit" disabled={pending}>{pending ? 'Envoi…' : delivery === 'link' ? 'Créer le lien à envoyer' : label}</button></div>
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
