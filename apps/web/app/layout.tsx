import type { Metadata, Viewport } from 'next';
import './globals.css';

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
      </body>
    </html>
  );
}
