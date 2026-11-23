'use client';

import { useEffect, useState } from 'react';
import { useIntent } from './use-intent';

type State = 'checking' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

/** Clé VAPID (base64 URL) → octets attendus par le navigateur. */
function toKey(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** iPhone ou iPad sans l’app sur l’écran d’accueil : iOS n’offre les rappels qu’une fois installée. */
function iosNotInstalled(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

const ready = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
]);

/**
 * D-118 · Rappels sur cet appareil : un abonnement push par navigateur et par espace. Activer = permission du
 * navigateur puis enregistrement sur le serveur ; désactiver = oubli côté serveur puis côté navigateur.
 */
export function PushSettings({ wid, role, publicKey, devices }: { wid: string; role: 'athlete' | 'coach'; publicKey: string | null; devices: number }) {
  const { run, pending, error } = useIntent<{ id: string; devices: number } | { removed: boolean }>();
  const [state, setState] = useState<State>('checking');
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
      } catch {
        if (alive) setState('unsupported');
      }
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
    } catch {
      setState('unsupported');
      return;
    }
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

  const why = role === 'athlete'
    ? 'Une alerte courte quand ton coach publie une séance, t’écrit ou écrit au groupe. Jamais le texte du message.'
    : 'Une alerte courte quand un élève envoie un retour, un bilan ou un message. Jamais le texte du message.';

  return (
    <fieldset className="choice notif-settings">
      <legend>Rappels sur cet appareil</legend>
      <p className="muted">{why}</p>
      {!publicKey ? <p className="muted">Les rappels sur téléphone ne sont pas encore réglés sur ce serveur.</p>
        : state === 'checking' ? <p className="muted">Vérification…</p>
        : state === 'unsupported' ? <p className="muted">Ce navigateur ne permet pas les rappels. Essaie Chrome, Edge, Firefox ou Safari récent.</p>
        : state === 'ios-install' ? <p className="muted">Sur iPhone, installe d’abord CoachOS sur l’écran d’accueil (Partager › « Sur l’écran d’accueil »), puis reviens ici.</p>
        : state === 'denied' ? <p className="muted">Les notifications sont bloquées pour CoachOS dans les réglages de ton téléphone ou de ton navigateur.</p>
        : state === 'on' ? (
          <p className="actions">
            <span>Rappels activés sur cet appareil{count > 1 ? ` (${count} appareils au total)` : ''}.</span>
            <button type="button" className="link-btn" disabled={pending} onClick={() => void disable()}>Désactiver sur cet appareil</button>
          </p>
        ) : (
          <p className="actions"><button type="button" className="btn small" disabled={pending} onClick={() => void enable()}>{pending ? 'Activation…' : 'Activer les rappels sur cet appareil'}</button></p>
        )}
      {error ? <p className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</p> : null}
    </fieldset>
  );
}
