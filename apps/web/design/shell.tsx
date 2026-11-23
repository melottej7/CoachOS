import Link from 'next/link';
import type { ReactNode } from 'react';
import s from './shell.module.css';

/** Cadre de l’espace élève : couleur du coach, colonne lisible sur téléphone et sur ordinateur. */
export function AthleteShell({ accent, children }: { accent: string; children: ReactNode }) {
  return <div className={`chrono ${s.athlete}`} data-accent={accent}>{children}</div>;
}

export function AthleteColumn({ children }: { children: ReactNode }) {
  return <div className={s.column}>{children}</div>;
}

/** Lien vers le profil, présenté par l’avatar de la personne. */
export function ProfileLink({ href, label, tour, children }: { href: string; label: string; tour?: string; children: ReactNode }) {
  return <Link href={href} className={s.profileLink} aria-label={label} data-tour={tour}>{children}</Link>;
}

/**
 * Pages hors espace (invitation, connexion) : même fond, en-tête à la marque CoachOS, colonne étroite centrée.
 * Ces pages ne connaissent pas encore la couleur du coach : elle n’habille que l’aperçu de l’espace (AccentScope).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className={`chrono ${s.athlete}`} data-accent="emerald">
      <header className={s.publicHeader}>
        <Link href="/" className={s.publicBrand}><span className={s.publicMark} aria-hidden="true">C</span>CoachOS</Link>
      </header>
      <main id="contenu" className={s.narrow}>{children}</main>
    </div>
  );
}

/** Applique la couleur d’un coach à une partie de l’écran (aperçu de son espace). */
export function AccentScope({ accent, children }: { accent: string; children: ReactNode }) {
  return <div className={`chrono ${s.scope}`} data-accent={accent}>{children}</div>;
}
