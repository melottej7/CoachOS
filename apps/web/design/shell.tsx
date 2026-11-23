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
/**
 * Pages hors espace (connexion, inscription, choix d’espace, compte, erreurs) : marque, colonne étroite par défaut,
 * plus large pour un texte long ou une grille (`wide`), éléments à droite de l’en-tête (`aside`).
 */
export function PublicShell({ children, wide, aside, home = '/' }: { children: ReactNode; wide?: boolean; aside?: ReactNode; home?: string }) {
  return (
    <div className={`chrono ${s.athlete}`} data-accent="emerald">
      <header className={s.publicHeader}>
        <Link href={home} className={s.publicBrand}><span className={s.publicMark} aria-hidden="true">C</span>CoachOS</Link>
        {aside ? <div className={s.publicAside}>{aside}</div> : null}
      </header>
      <main id="contenu" className={wide ? s.wide : s.narrow}>{children}</main>
    </div>
  );
}

/** Applique la couleur d’un coach à une partie de l’écran (aperçu de son espace). */
export function AccentScope({ accent, children }: { accent: string; children: ReactNode }) {
  return <div className={`chrono ${s.scope}`} data-accent={accent}>{children}</div>;
}

/**
 * Cadre du coach (D-143) : barre latérale sur ordinateur, en-tête et barre basse sur téléphone.
 * `rail` remplit la barre latérale, `top` l’en-tête du téléphone, `bottom` la barre basse.
 */
export function CoachShell({ accent, rail, top, bottom, children }: { accent: string; rail: ReactNode; top: ReactNode; bottom: ReactNode; children: ReactNode }) {
  return (
    <div className={`chrono ${s.coach}`} data-accent={accent}>
      <aside className={s.rail}>{rail}</aside>
      <div className={s.coachBody}>
        <div className={s.coachTop}>{top}</div>
        <main id="contenu" className={s.coachMain}>{children}</main>
      </div>
      {bottom}
    </div>
  );
}
