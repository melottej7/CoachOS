import Link from 'next/link';
import type { ConversationRow } from '@/components/conversation-list';
import { Avatar, Icon } from '@/design';
import { cx } from '@/design/cx';
import s from './conversation-list.module.css';

/** Liste des discussions (refonte Chrono, D-135) : avatar, nom, dernier message, heure, non-lus écrits en toutes lettres. */
export function ConversationList({ rows }: { rows: ConversationRow[] }) {
  if (!rows.length) return <p className={s.empty}>Aucune discussion pour l’instant.</p>;
  return (
    <ul className={s.list}>
      {rows.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className={cx(s.row, r.unread > 0 && s.unread)} aria-current={r.active ? 'page' : undefined}>
            {r.team ? <span className={s.team} aria-hidden="true"><Icon name="users" size={20} /></span> : <Avatar name={r.name} coach size={44} />}
            <span className={s.text}>
              <span className={s.top}><span className={s.name}>{r.name}</span>{r.when ? <span className={s.when}>{r.when}</span> : null}</span>
              <span className={s.preview}>{r.preview}</span>
            </span>
            {r.unread ? <span className={s.count}>{r.unread}<span className="ds-visually-hidden"> non lu{r.unread > 1 ? 's' : ''}</span></span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
