'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { currentInstallEnv, type InstallEnv } from '@/components/install-env';
import { Button, Cluster, Eyebrow, Heading, Stack, Text } from '@/design';
import s from './install-guide.module.css';

type Guide = Exclude<InstallEnv, 'installed'>;
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DONE = 'coachos_install:done';
const LATER = 'coachos_install:later';
const LATER_MS = 3 * 24 * 3600 * 1000;
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};

// L’invitation d’installation d’Android arrive parfois avant que la carte soit affichée : on la garde.
let deferred: PromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; });
}

/** Petites touches dessinées comme à l’écran, pour reconnaître le bon bouton. */
const ICONS = {
  share: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v10M6.5 6 10 2.5 13.5 6" /><path d="M7 8.5H5.5A1.5 1.5 0 0 0 4 10v6a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16v-6a1.5 1.5 0 0 0-1.5-1.5H13" /></svg>,
  add: <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3" /><path d="M10 6.5v7M6.5 10h7" /></svg>,
  dotsH: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="15.5" cy="10" r="1.6" /></svg>,
  dotsV: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" /></svg>,
  menu: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" /></svg>,
};
function Key({ icon, label }: { icon: keyof typeof ICONS; label: string }) {
  return <span className={s.key} role="img" aria-label={label}>{ICONS[icon]}</span>;
}
const B = ({ children }: { children: ReactNode }) => <strong className={s.ui}>{children}</strong>;

const OPEN_ICON = <>Reviens sur l’écran d’accueil de ton téléphone et touche la nouvelle icône <B>CoachOS</B>. Si on te le demande, connecte-toi une fois avec ton adresse e-mail et ton mot de passe. C’est tout !</>;

const GUIDES: Record<Guide, { label: string; steps: ReactNode[] }> = {
  'ios-safari': {
    label: 'iPhone ou iPad, avec Safari',
    steps: [
      <>Touche le bouton <B>Partager</B> <Key icon="share" label="Partager" /> dans la barre de Safari, en bas de l’écran (sur iPad : en haut à droite). Tu ne le vois pas ? Touche d’abord <Key icon="dotsH" label="Plus" /> en bas à droite, puis <B>Partager</B>.</>,
      <>Dans le menu qui s’ouvre, fais défiler vers le bas et touche <B>Sur l’écran d’accueil</B> <Key icon="add" label="Ajouter" /> (selon ton iPhone : <B>Ajouter à l’écran d’accueil</B>).</>,
      <>Si « Ouvrir en tant qu’app web » est proposé, laisse-le activé. Touche <B>Ajouter</B> en haut à droite.</>,
      OPEN_ICON,
    ],
  },
  'ios-other': {
    label: 'iPhone ou iPad, avec Chrome ou un autre navigateur',
    steps: [
      <>Touche le bouton <B>Partager</B> <Key icon="share" label="Partager" /> dans la barre d’adresse, en haut à droite. Tu ne le trouves pas ? Touche <Key icon="dotsH" label="Plus" /> puis <B>Partager</B>.</>,
      <>Touche <B>Ajouter à l’écran d’accueil</B> <Key icon="add" label="Ajouter" /> (ou <B>Sur l’écran d’accueil</B>), puis <B>Ajouter</B>.</>,
      OPEN_ICON,
    ],
  },
  'in-app': {
    label: 'Lien ouvert dans WhatsApp, Instagram, Messenger…',
    steps: [
      <>Tu es dans le navigateur d’une application, qui ne sait pas installer CoachOS. Il faut d’abord ouvrir la page dans ton vrai navigateur.</>,
      <>Touche <Key icon="dotsH" label="Plus" /> ou <Key icon="dotsV" label="Menu" /> (en haut ou en bas à droite), puis <B>Ouvrir dans Safari</B> sur iPhone, ou <B>Ouvrir dans Chrome</B> sur Android.</>,
      <>Pas de bouton ? Copie l’adresse avec le bouton ci-dessous, ouvre Safari ou Chrome et colle-la dans la barre d’adresse.</>,
      <>Connecte-toi : ce guide t’attend sur « Aujourd’hui », avec les étapes pour ton téléphone.</>,
    ],
  },
  android: {
    label: 'Android, avec Chrome',
    steps: [
      <>Touche <Key icon="dotsV" label="Menu" /> en haut à droite de Chrome.</>,
      <>Touche <B>Installer l’application</B> ou <B>Ajouter à l’écran d’accueil</B>.</>,
      <>Confirme avec <B>Installer</B> (ou <B>Ajouter</B>).</>,
      <>Ouvre CoachOS depuis sa nouvelle icône, sur ton écran d’accueil ou dans la liste de tes applications. Si on te le demande, connecte-toi une fois.</>,
    ],
  },
  'android-samsung': {
    label: 'Samsung, avec Samsung Internet',
    steps: [
      <>Touche <Key icon="menu" label="Menu" /> en bas à droite.</>,
      <>Touche <B>Ajouter la page à</B>, puis <B>Écran d’accueil</B>.</>,
      <>Confirme avec <B>Ajouter</B>.</>,
      <>Ouvre CoachOS depuis sa nouvelle icône sur ton écran d’accueil. Si on te le demande, connecte-toi une fois.</>,
    ],
  },
  desktop: {
    label: 'Ordinateur',
    steps: [
      <>CoachOS est faite pour ton téléphone : tu y trouves ta séance du jour et tu y donnes ton retour en deux touches.</>,
      <>Sur ton téléphone, ouvre l’adresse ci-dessous (envoie-la-toi par message ou par e-mail avec le bouton « Copier l’adresse »).</>,
      <>Connecte-toi avec ton adresse e-mail et ton mot de passe : ce guide t’attend sur « Aujourd’hui », avec les étapes pour ton téléphone.</>,
    ],
  },
};
/** Bilan produit : sur ordinateur, le coach lit des étapes qui parlent de son travail, pas de « ta séance du jour ». */
const COACH_DESKTOP: ReactNode[] = [
  <>CoachOS se garde aussi sur ton téléphone : séances, retours et messages te suivent où que tu sois.</>,
  <>Sur ton téléphone, ouvre l’adresse ci-dessous (envoie-la-toi par message ou par e-mail avec le bouton « Copier l’adresse »).</>,
  <>Connecte-toi avec ton adresse e-mail et ton mot de passe, puis ouvre « Mon compte » : ce guide t’y attend, avec les étapes pour ton téléphone.</>,
];
const ORDER: Guide[] = ['ios-safari', 'ios-other', 'android', 'android-samsung', 'in-app', 'desktop'];

/**
 * D-171 : installer CoachOS sur l’écran d’accueil, pas à pas, avec les étapes de l’appareil reconnu.
 * « today » : carte d’Aujourd’hui (C’est fait / Plus tard) ; « profile » : toujours disponible dans le Profil.
 */
export function InstallGuide({ variant, audience = 'athlete' }: { variant: 'today' | 'profile'; audience?: 'athlete' | 'coach' }) {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [guide, setGuide] = useState<Guide>('desktop');
  const [hidden, setHidden] = useState(true);
  const [canPrompt, setCanPrompt] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const e = currentInstallEnv();
    setEnv(e);
    if (e !== 'installed') setGuide(e);
    setUrl(`${window.location.origin}/login`);
    const later = Number(store.get(LATER) ?? 0);
    setHidden(variant === 'today' && (e === 'installed' || store.get(DONE) === '1' || Date.now() - later < LATER_MS));
    setCanPrompt(Boolean(deferred));
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => { setJustInstalled(true); store.set(DONE, '1'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, [variant]);

  if (env === null || (variant === 'today' && hidden && !justInstalled)) return null;

  const id = `install-${variant}`;
  if (env === 'installed' || justInstalled) {
    if (variant === 'today' && !justInstalled) return null;
    return (
      <section className={s.card} aria-labelledby={id} data-tour={variant === 'today' ? 'install' : undefined}>
        <Stack gap={1}>
          <Heading level={2} size={4} id={id}>CoachOS est installée</Heading>
          <Text muted>{justInstalled ? 'L’icône CoachOS est sur ton écran d’accueil : à partir de maintenant, ouvre-la de là.' : 'Tu l’utilises depuis son icône sur l’écran d’accueil. Rien d’autre à faire.'}</Text>
        </Stack>
      </section>
    );
  }

  async function promptInstall() {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    deferred = null;
    setCanPrompt(false);
    if (outcome === 'accepted') { setJustInstalled(true); store.set(DONE, '1'); }
  }
  async function copyUrl() {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { /* copie refusée : l’adresse reste affichée */ }
  }
  const close = (key: string, value: string) => { store.set(key, value); setHidden(true); };
  const g = audience === 'coach' && guide === 'desktop' ? { ...GUIDES.desktop, steps: COACH_DESKTOP } : GUIDES[guide];
  const oneTap = canPrompt && (guide === 'android' || guide === 'android-samsung' || guide === 'desktop');
  const showUrl = guide === 'desktop' || guide === 'in-app' || guide === 'ios-other';

  return (
    <section className={s.card} aria-labelledby={id} data-tour={variant === 'today' ? 'install' : undefined}>
      <Stack gap={4}>
        <Stack gap={1}>
          {variant === 'today' ? <Eyebrow tone="coach">À faire une fois · 1 minute</Eyebrow> : null}
          <Heading level={2} size={variant === 'today' ? 3 : 4} id={id}>Installe CoachOS sur ton téléphone</Heading>
          <Text muted>Tu l’ouvriras d’un toucher depuis ton écran d’accueil, en plein écran, comme une application.</Text>
        </Stack>

        <div className={s.device}>
          <label htmlFor={`${id}-device`}>Étapes pour</label>
          <select id={`${id}-device`} className={s.select} value={guide} onChange={(e) => setGuide(e.target.value as Guide)}>
            {ORDER.map((k) => <option key={k} value={k}>{GUIDES[k].label}</option>)}
          </select>
        </div>

        {oneTap ? (
          <Stack gap={2}>
            <Button variant="coach" size="lg" icon="download" onClick={() => void promptInstall()}>Installer CoachOS</Button>
            <Text size="sm" muted>Puis touche <B>Installer</B> dans la fenêtre qui s’ouvre. Si rien ne s’ouvre, suis les étapes ci-dessous.</Text>
          </Stack>
        ) : null}

        <ol className={s.steps} aria-label={`Étapes · ${g.label}`}>
          {g.steps.map((step, i) => (
            <li key={`${guide}-${i}`}><span className={s.num} aria-hidden="true">{i + 1}</span><span>{step}</span></li>
          ))}
        </ol>

        {showUrl && url ? (
          <div className={s.url}>
            <code>{url.replace(/^https?:\/\//, '')}</code>
            <Button size="sm" icon={copied ? 'check' : 'copy'} onClick={() => void copyUrl()}>{copied ? 'Adresse copiée' : 'Copier l’adresse'}</Button>
          </div>
        ) : null}

        {variant === 'today' ? (
          <Cluster gap={2} align="center">
            <Button variant="secondary" icon="check" onClick={() => close(DONE, '1')}>C’est fait</Button>
            <Button variant="ghost" onClick={() => close(LATER, String(Date.now()))}>Plus tard</Button>
            <Text size="sm" muted>Ce guide reste dans ton Profil.</Text>
          </Cluster>
        ) : null}
      </Stack>
    </section>
  );
}
