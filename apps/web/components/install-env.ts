/**
 * D-171 : reconnaître l’appareil et le navigateur pour montrer les bonnes étapes d’installation sur l’écran d’accueil.
 * Fonction pure (testée) : l’agent utilisateur, l’affichage autonome et le nombre de points tactiles suffisent.
 */
export type InstallEnv =
  | 'installed' // déjà ouverte depuis l’icône de l’écran d’accueil
  | 'ios-safari' // iPhone ou iPad, Safari
  | 'ios-other' // iPhone ou iPad, Chrome, Firefox, Edge… (le bouton Partager est dans la barre d’adresse)
  | 'in-app' // navigateur intégré à WhatsApp, Instagram, Facebook, Messenger… : impossible d’installer d’ici
  | 'android-samsung' // Samsung Internet
  | 'android' // Chrome et la plupart des navigateurs Android
  | 'desktop';

const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Messenger|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Line\/|Twitter|GSA\/|; wv\)/i;

export function installEnv(ua: string, standalone: boolean, touchPoints = 0): InstallEnv {
  if (standalone) return 'installed';
  // iPadOS se présente comme un Mac : on le reconnaît à son écran tactile.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  const android = /Android/i.test(ua);
  if ((ios || android) && IN_APP.test(ua)) return 'in-app';
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua) ? 'ios-other' : 'ios-safari';
  if (android) return /SamsungBrowser/.test(ua) ? 'android-samsung' : 'android';
  return 'desktop';
}

/** Lecture dans le navigateur (jamais côté serveur). */
export function currentInstallEnv(): InstallEnv {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installEnv(navigator.userAgent, Boolean(standalone), navigator.maxTouchPoints ?? 0);
}
