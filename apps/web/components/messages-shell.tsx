import Link from 'next/link';
import { excerpt } from '@coachos/domain';
import type { InboxEntry } from '@/server/repo/messages';
import { whenShort } from '@/server/repo/message-format';
import { ConversationList, type ConversationRow } from './conversation-list';
import { initials } from './ui';

// Messagerie façon messagerie instantanée (D-033) : liste des discussions à gauche, conversation à droite.

/** Discussions triées par dernière activité ; celles sans message ensuite, par ordre alphabétique. */
export function toRows(entries: InboxEntry[], tz: string, href: (e: InboxEntry) => string, activeKey: string | null): ConversationRow[] {
  return [...entries]
    .sort((a, b) => (b.last?.createdAt ?? '').localeCompare(a.last?.createdAt ?? '') || a.name.localeCompare(b.name, 'fr'))
    .map((e) => ({
      key: `${e.kind}:${e.id}`,
      href: href(e),
      name: e.name,
      team: e.kind === 'team',
      initials: initials(e.name),
      preview: e.last ? `${e.last.mine ? 'Vous : ' : ''}${excerpt(e.last.body, 60)}` : e.kind === 'team' ? 'Écrire au groupe' : 'Démarrer la discussion',
      when: e.last ? whenShort(e.last.createdAt, tz) : null,
      unread: e.unread,
      active: activeKey === `${e.kind}:${e.id}`,
    }));
}

export function MessagesShell({ rows, active, children }: { rows: ConversationRow[]; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`mx${active ? ' has-active' : ''}`}>
      <aside className="mx-side" aria-label="Discussions">
        <h1 className="mx-title">Discussions</h1>
        <ConversationList rows={rows} />
      </aside>
      <section className="mx-main">{children}</section>
    </div>
  );
}

/** En-tête de conversation : retour (téléphone), avatar, nom, sous-titre, actions. */
export function ChatHeader({ back, name, team, subtitle, actions }: { back: string; name: string; team?: boolean; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mx-head">
      <Link className="mx-back" href={back} aria-label="Retour aux discussions">‹</Link>
      <span className={`cl-avatar${team ? ' team' : ''}`} aria-hidden="true">{team ? '👥' : initials(name)}</span>
      <div className="mx-who">
        <h2>{name}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="mx-actions">{actions}</div> : null}
    </header>
  );
}
