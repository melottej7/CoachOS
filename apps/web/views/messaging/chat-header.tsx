import type { ReactNode } from 'react';
import { Avatar, Icon, IconLinkButton } from '@/design';
import s from './chat-header.module.css';

/** En-tête de conversation (refonte Chrono, D-135) : retour, avatar, nom, sous-titre, actions. */
export function ChatHeader({ back, backLabel = 'Retour', name, team, subtitle, actions }: { back: string; backLabel?: string; name: string; team?: boolean; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className={s.head}>
      <IconLinkButton href={back} icon="chevronLeft" label={backLabel} variant="ghost" />
      {team ? <span className={s.team} aria-hidden="true"><Icon name="users" size={20} /></span> : <Avatar name={name} coach size={40} />}
      <div className={s.who}>
        <h1 className={s.name}>{name}</h1>
        {subtitle ? <p className={s.sub}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </header>
  );
}
