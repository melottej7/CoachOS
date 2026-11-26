import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import '@/design/tokens.css';
import { DevStyleRefresh } from '@/components/dev-style-refresh';
import { OfflineSupport } from '@/components/offline';
import { PullToRefresh } from '@/components/pull-to-refresh';

// D-121 · Police déclarée depuis le début mais jamais chargée : rendu homogène sur tous les appareils.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
// D-128 · Direction « Chrono » : Barlow pour le texte, Barlow Condensed pour les titres et les chiffres.
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-barlow' });
const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-barlow-condensed' });

export const metadata: Metadata = {
  title: { default: 'CoachOS', template: '%s · CoachOS' },
  robots: { index: false, follow: false },
  // CE-E-06 (D-070) : installable sur l’écran d’accueil, ouverte en plein écran.
  applicationName: 'CoachOS',
  appleWebApp: { capable: true, title: 'CoachOS', statusBarStyle: 'default' },
  icons: { icon: '/icons/192.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#F4F5F7' }, { media: '(prefers-color-scheme: dark)', color: '#0B0D10' }],
};

/** Thème et densité choisis par la personne (cookies), appliqués au rendu serveur : aucun éclair au chargement. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get('coachos_theme')?.value;
  const density = jar.get('coachos_density')?.value;
  return (
    <html lang="fr-BE" className={`${inter.variable} ${barlow.variable} ${barlowCondensed.variable}`}
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined} data-density={density === 'compact' ? 'compact' : undefined}>
      <body>
        <a className="skip" href="#contenu">Aller au contenu</a>
        {children}
        {process.env.NODE_ENV === 'development' ? <DevStyleRefresh /> : null}
        <OfflineSupport />
        <PullToRefresh />
      </body>
    </html>
  );
}
