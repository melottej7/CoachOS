import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar, Icon, IconLinkButton } from '@/design';
import s from './chat-header.module.css';

/**
 * En-tête de conversation (refonte Chrono, D-135) : retour, avatar, nom, sous-titre, actions.
 * Bilan produit : avec `href`, l’avatar et le nom mènent à la fiche (élève, groupe, présentation du coach).
 */
export function ChatHeader({ back, backLabel = 'Retour', name, team, people, subtitle, actions, href, hrefLabel }: { back: string; backLabel?: string; name: string; team?: boolean; people?: boolean; subtitle?: string; actions?: ReactNode; href?: string; hrefLabel?: string }) {
  const identity = (
    <>
      {team ? <span className={s.team} aria-hidden="true"><Icon name="users" size={20} /></span> : <Avatar name={name} coach={!people} size={40} />}
      <div className={s.who}>
        <h1 className={s.name}>{name}</h1>
        {subtitle ? <p className={s.sub}>{subtitle}</p> : null}
      </div>
    </>
  );
  return (
    <header className={s.head}>
      <IconLinkButton href={back} icon="chevronLeft" label={backLabel} variant="ghost" />
      {href ? <Link href={href} className={s.identity} title={hrefLabel} aria-label={hrefLabel}>{identity}</Link> : identity}
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </header>
  );
}
