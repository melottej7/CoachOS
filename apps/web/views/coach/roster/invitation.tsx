'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { fieldError, useIntent } from '@/components/use-intent';
import { Banner, Button, ChoiceGroup, Cluster, Field, Input, LinkButton, Select, Stack, Text } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

type Delivery = 'link' | 'email';

/** D-149 : comment l’élève reçoit son lien. « Moi-même » marche sans e-mail (SMS, WhatsApp…). */
function DeliveryChoice({ value, onChange }: { value: Delivery; onChange: (v: Delivery) => void }) {
  return (
    <ChoiceGroup legend="Comment lui envoyer le lien ?" name="delivery" columns={1} value={value} onChange={onChange}
      options={[
        { value: 'link', label: 'Je l’envoie moi-même (SMS, WhatsApp…)', hint: 'CoachOS te donne le lien à copier' },
        { value: 'email', label: 'Par e-mail, envoyé par CoachOS' },
      ]} />
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
    <Stack gap={4} role="status">
      <Banner tone="success" title="Lien d’invitation prêt">Envoie-le à {first} par SMS, WhatsApp ou de vive voix.</Banner>
      <Field id="invite-link" label={`Lien pour ${first}`}>
        <Input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <Cluster gap={2}>
        <Button variant="primary" icon={copied ? 'check' : 'copy'} onClick={() => void copy()}>{copied ? 'Lien copié' : 'Copier le lien'}</Button>
        {canShare ? <Button icon="send" onClick={() => void navigator.share({ title: 'Ton invitation CoachOS', text: `Rejoins-moi sur CoachOS pour tes séances : ${link}` }).catch(() => undefined)}>Partager…</Button> : null}
        <LinkButton href={next} variant="ghost">Aller à la fiche</LinkButton>
      </Cluster>
      <Text size="sm" muted>À l’ouverture du lien, {first} crée son compte avec <strong>{email}</strong> (l’adresse que tu as saisie) et choisit son mot de passe. Le lien sert une seule fois et reste valable 7 jours. Ensuite, CoachOS lui montre pas à pas comment l’installer sur son téléphone, puis lui fait faire le tour.</Text>
    </Stack>
  );
}

/**
 * X13, refonte Chrono (D-150) : créer la fiche puis, si une adresse est saisie, l’invitation (lien à copier ou e-mail).
 * Si l’invitation échoue après la création, la fiche n’est pas recréée : seule l’invitation est rejouée.
 */
export function AthleteForm({ wid, zones, defaultZone }: { wid: string; zones: string[]; defaultZone: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const [email, setEmail] = useState('');
  const [delivery, setDelivery] = useState<Delivery>('link');
  const [createdId, setCreatedId] = useState<string | null>(null);
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
    if (email.trim() === '') { router.push(`/coach/${wid}/athletes/${id}?notice=created`); return; }
    const sent = await invite.run('POST', `/api/v1/workspaces/${wid}/athletes/${id}/invite`, { email, delivery });
    if (sent?.link) setLink(sent.link);
    else if (sent) router.push(`/coach/${wid}/athletes/${id}?notice=invited`);
  }

  if (link && createdId) return <InvitationLinkPanel link={link} name={displayName} email={email.trim().toLowerCase()} next={`/coach/${wid}/athletes/${createdId}?notice=created`} />;
  const error = create.error ?? invite.error;
  const err = (p: string) => fieldError(error, p);
  const label = pending ? undefined : email.trim()
    ? (delivery === 'link' ? (createdId ? 'Créer le lien' : 'Créer la fiche et le lien') : (createdId ? 'Envoyer l’invitation' : 'Créer et inviter'))
    : 'Créer la fiche';
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={5}>
        <ErrorSummary error={error} onRetry={() => void submit()} retryLabel={createdId ? 'Renvoyer l’invitation' : 'Réessayer'} labels={{ displayName: 'Nom de l’élève', email: 'Adresse e-mail' }} />
        {createdId && invite.error ? <Banner tone="warning">La fiche est créée. Seule l’invitation reste à faire.</Banner> : null}
        <Field id="displayName" label="Nom de l’élève" error={err('displayName')}>
          <Input id="displayName" required maxLength={100} autoFocus value={displayName} disabled={!!createdId} onChange={(e) => setDisplayName(e.target.value)} invalid={!!err('displayName')} />
        </Field>
        <Field id="timeZone" label="Fuseau horaire de l’élève" hint="Ses séances suivent ses dates locales">
          <Select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-describedby="timeZone-hint">
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </Select>
        </Field>
        <Field id="email" label="Adresse e-mail pour l’invitation" hint="Facultatif · seule cette adresse pourra rejoindre l’espace avec le lien ; elle n’est pas conservée" error={err('email')}>
          <Input id="email" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!err('email')} hasHint />
        </Field>
        {email.trim() ? <DeliveryChoice value={delivery} onChange={setDelivery} /> : null}
        <Cluster><Button type="submit" variant="primary" loading={pending}>{label ?? 'Envoi…'}</Button></Cluster>
      </Stack>
    </form>
  );
}

/** Renvoyer un lien (C03-05) : l’ancien cesse de fonctionner. */
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
    if (done) { setEmail(''); router.replace(`/coach/${wid}/athletes/${aid}?notice=invited`); router.refresh(); }
  }
  if (link) return <InvitationLinkPanel link={link.url} name={name} email={link.email} next={`/coach/${wid}/athletes/${aid}`} />;
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={4}>
        <ErrorSummary error={error} onRetry={() => void submit()} labels={{ email: 'Adresse e-mail' }} ids={{ email: 'invite-email' }} />
        <Field id="invite-email" label="Adresse e-mail de l’élève" error={fieldError(error, 'email')}>
          <Input id="invite-email" type="email" inputMode="email" autoComplete="off" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!fieldError(error, 'email')} />
        </Field>
        <DeliveryChoice value={delivery} onChange={setDelivery} />
        <Cluster><Button type="submit" variant="primary" loading={pending}>{delivery === 'link' ? 'Créer le lien à envoyer' : label}</Button></Cluster>
      </Stack>
    </form>
  );
}

/** Annuler le lien en cours (C03-04). */
export function RevokeInvitation({ wid, aid, iid }: { wid: string; aid: string; iid: string }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ revoked: boolean }>();
  async function revoke() {
    const done = await run('DELETE', `/api/v1/workspaces/${wid}/invitations/${iid}`, {});
    if (done) { router.replace(`/coach/${wid}/athletes/${aid}?notice=revoked`); router.refresh(); }
  }
  return (
    <Stack gap={2}>
      <ErrorSummary error={error} onRetry={() => void revoke()} />
      <Cluster><Button variant="ghost" loading={pending} onClick={() => void revoke()}>Annuler l’invitation</Button></Cluster>
    </Stack>
  );
}
