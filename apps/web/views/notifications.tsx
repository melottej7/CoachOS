'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EMAIL_PREFERENCES, EMAIL_PREFERENCE_LABELS, type EmailPreference, type NotificationKind } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Button, ChoiceGroup, Cluster, EmptyState, Icon, Stack, Text, type IconName } from '@/design';
import { cx } from '@/design/cx';
import s from './notifications.module.css';

// D-067, D-118, refonte Chrono (D-137) : centre de notifications, rappels sur l’appareil et e-mails. Aucun contenu de message.

const ICON: Record<NotificationKind, IconName> = { workouts_published: 'calendar', message: 'chat', feedback: 'check', bilan_submitted: 'edit', group_message: 'users' };
const when = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

export function NotificationList({ wid, items, timeZone, role = 'athlete' }: {
  wid: string; timeZone: string; role?: 'athlete' | 'coach';
  items: { id: string; kind: NotificationKind; text: string; createdAt: string; read: boolean }[];
}) {
  const router = useRouter();
  const all = useIntent<unknown>();
  const unread = items.filter((n) => !n.read).length;
  if (!items.length) return <EmptyState icon="bell" title="Rien de neuf">{role === 'coach' ? 'Tu seras prévenu·e ici quand un élève envoie un retour, un bilan ou un message.' : 'Tu seras prévenu·e ici quand ton coach publie une séance ou t’écrit.'}</EmptyState>;
  return (
    <Stack gap={3}>
      <Cluster between gap={2}>
        <Text size="sm" muted>{unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu.'}</Text>
        {unread ? <Button size="sm" loading={all.pending} icon="check"
          onClick={async () => { if (await all.run('POST', `/api/v1/workspaces/${wid}/notifications/read-all`, {})) router.refresh(); }}>Tout marquer lu</Button> : null}
      </Cluster>
      <ul className={s.list}>
        {items.map((n) => (
          <li key={n.id}>
            <a href={`/n/${wid}/${n.id}`} className={cx(s.row, !n.read && s.unread)}>
              <span className={s.icon} aria-hidden="true"><Icon name={ICON[n.kind]} size={18} /></span>
              <span className={s.text}>
                <span className={s.what}>{n.text}{n.read ? null : <span className="ds-visually-hidden"> (non lue)</span>}</span>
                <span className={s.when}>{when(n.createdAt, timeZone)}</span>
              </span>
              {n.read ? null : <span className={s.dot} aria-hidden="true" />}
            </a>
          </li>
        ))}
      </ul>
    </Stack>
  );
}

export function NotificationSettings({ wid, email }: { wid: string; email: EmailPreference }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [value, setValue] = useState(email);
  const [saved, setSaved] = useState(false);
  return (
    <Stack gap={3}>
      <ChoiceGroup legend="E-mails" hideLegend name="notif-email" columns={1} value={value} disabled={pending}
        options={EMAIL_PREFERENCES.map((p) => ({ value: p, label: EMAIL_PREFERENCE_LABELS[p] }))}
        onChange={async (p) => {
          setValue(p); setSaved(false);
          if (await run('PUT', `/api/v1/workspaces/${wid}/notification-settings`, { email: p })) { setSaved(true); router.refresh(); }
        }} />
      <Text size="sm" muted>Les e-mails ne contiennent jamais le texte d’un message : seulement ce qui s’est passé et un lien. Les invitations et la sécurité du compte restent toujours envoyées.</Text>
      {saved ? <Text size="sm" tone="success" role="status">Réglage enregistré.</Text> : null}
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </Stack>
  );
}

type PushState = 'checking' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

function toKey(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function iosNotInstalled(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))]);

/**
 * D-118 · Rappels sur cet appareil : un abonnement push par navigateur et par espace. Activer = permission du
 * navigateur puis enregistrement sur le serveur ; désactiver = oubli côté serveur puis côté navigateur.
 */
export function PushSettings({ wid, publicKey, devices, role = 'athlete' }: { wid: string; publicKey: string | null; devices: number; role?: 'athlete' | 'coach' }) {
  const { run, pending, error } = useIntent<{ id: string; devices: number } | { removed: boolean }>();
  const [state, setState] = useState<PushState>('checking');
  const [count, setCount] = useState(devices);
  const url = `/api/v1/workspaces/${wid}/push-subscriptions`;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !window.isSecureContext) {
        if (alive) setState(iosNotInstalled() ? 'ios-install' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') { if (alive) setState('denied'); return; }
      try {
        const reg = await ready();
        if (!reg) { if (alive) setState('unsupported'); return; }
        const sub = await reg.pushManager.getSubscription();
        if (alive) setState(sub ? 'on' : 'off');
      } catch { if (alive) setState('unsupported'); }
    })();
    return () => { alive = false; };
  }, []);

  async function enable() {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { setState('denied'); return; }
    const reg = await ready();
    if (!reg) { setState('unsupported'); return; }
    let sub: PushSubscription;
    try {
      sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
    } catch { setState('unsupported'); return; }
    const json = sub.toJSON();
    const r = await run('POST', url, { endpoint: json.endpoint, keys: json.keys });
    if (r && 'devices' in r) { setCount(r.devices); setState('on'); } else await sub.unsubscribe().catch(() => undefined);
  }

  async function disable() {
    const reg = await ready();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const r = await run('DELETE', url, { endpoint: sub.endpoint });
      if (!r) return;
      await sub.unsubscribe().catch(() => undefined);
      setCount((c) => Math.max(0, c - 1));
    }
    setState('off');
  }

  const note = !publicKey ? 'Les rappels sur téléphone ne sont pas encore réglés sur ce serveur.'
    : state === 'checking' ? 'Vérification…'
    : state === 'unsupported' ? 'Ce navigateur ne permet pas les rappels. Essaie Chrome, Edge, Firefox ou Safari récent.'
    : state === 'ios-install' ? 'Sur iPhone, installe d’abord CoachOS sur l’écran d’accueil (Partager › « Sur l’écran d’accueil »), puis reviens ici.'
    : state === 'denied' ? 'Les notifications sont bloquées pour CoachOS dans les réglages de ton téléphone ou de ton navigateur.'
    : null;

  return (
    <Stack gap={3}>
      <Text size="sm" muted>{role === 'coach' ? 'Une alerte courte quand un élève envoie un retour, un bilan ou un message. Jamais le texte du message.' : 'Une alerte courte quand ton coach publie une séance, t’écrit ou écrit au groupe. Jamais le texte du message.'}</Text>
      {note ? <Text size="sm">{note}</Text> : state === 'on' ? (
        <Cluster between gap={2}>
          <Badge tone="success" dot>Activés sur cet appareil{count > 1 ? ` · ${count} appareils` : ''}</Badge>
          <Button size="sm" variant="ghost" loading={pending} onClick={() => void disable()}>Désactiver ici</Button>
        </Cluster>
      ) : (
        <Cluster><Button icon="bell" variant={role === 'coach' ? 'primary' : 'coach'} loading={pending} onClick={() => void enable()}>{pending ? 'Activation…' : 'Activer les rappels sur cet appareil'}</Button></Cluster>
      )}
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </Stack>
  );
}
