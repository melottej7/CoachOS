import Link from 'next/link';
import s from './athlete-link.module.css';

/** Bilan produit : partout où le coach lit le nom d’un élève, ce nom ouvre sa fiche. */
export function AthleteLink({ wid, id, children }: { wid: string; id: string; children: React.ReactNode }) {
  return <Link className={s.link} href={`/coach/${wid}/athletes/${id}`}>{children}</Link>;
}
