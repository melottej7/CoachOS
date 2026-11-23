import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import s from './list.module.css';

/** Liste de liens en lignes (séances à venir, élèves, conversations). */
export function LinkList({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className={s.list} aria-label={label}>{children}</ul>;
}

export function LinkListItem({ href, leading, title, meta }: { href: string; leading?: ReactNode; title: ReactNode; meta?: ReactNode }) {
  return (
    <li className={s.item}>
      <Link href={href} className={s.link}>
        {leading}
        <span className={s.title}>{title}</span>
        {meta ? <span className={s.meta}>{meta}</span> : null}
        <Icon name="chevronRight" size={18} className={s.chevron} />
      </Link>
    </li>
  );
}
