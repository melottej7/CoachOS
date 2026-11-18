import Link from 'next/link';
import { excerpt } from '@coachos/domain';
import type { InboxEntry } from '@/server/repo/messages';
import { whenShort } from '@/server/repo/message-format';
import { initials } from './ui';

/** Liste de fils : nom, dernier message, heure, non-lus. */
export function InboxList({ entries, href, tz, empty }: { entries: InboxEntry[]; href: (e: InboxEntry) => string; tz: string; empty: string }) {
  if (!entries.length) return <p className="empty">{empty}</p>;
  return (
    <ul className="inbox">
      {entries.map((e) => (
        <li key={`${e.kind}-${e.id}`}>
          <Link className={`inbox-row${e.unread ? ' unread' : ''}`} href={href(e)}>
            <span className={`avatar${e.kind === 'team' ? ' team' : ''}`} aria-hidden="true">{e.kind === 'team' ? '👥' : initials(e.name)}</span>
            <span className="inbox-text">
              <strong>{e.name}</strong>
              <span className="inbox-last">{e.last ? `${e.last.mine ? 'Toi : ' : ''}${excerpt(e.last.body, 70)}` : 'Aucun message pour l’instant'}</span>
            </span>
            <span className="inbox-meta">
              {e.last ? <span className="muted">{whenShort(e.last.createdAt, tz)}</span> : null}
              {e.unread ? <span className="count" aria-label={`${e.unread} non lu${e.unread > 1 ? 's' : ''}`}>{e.unread}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
