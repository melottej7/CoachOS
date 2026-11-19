import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DevStyleRefresh } from '@/components/dev-style-refresh';

export const metadata: Metadata = {
  title: { default: 'CoachOS', template: '%s · CoachOS' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-BE">
      <body>
        <a className="skip" href="#contenu">Aller au contenu</a>
        {children}
        {process.env.NODE_ENV === 'development' ? <DevStyleRefresh /> : null}
      </body>
    </html>
  );
}
