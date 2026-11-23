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
