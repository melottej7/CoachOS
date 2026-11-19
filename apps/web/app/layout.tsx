import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DevStyleRefresh } from '@/components/dev-style-refresh';
import { OfflineSupport } from '@/components/offline';

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
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#0a6452' }, { media: '(prefers-color-scheme: dark)', color: '#0f1d24' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-BE">
      <body>
        <a className="skip" href="#contenu">Aller au contenu</a>
        {children}
        {process.env.NODE_ENV === 'development' ? <DevStyleRefresh /> : null}
        <OfflineSupport />
      </body>
    </html>
  );
}
