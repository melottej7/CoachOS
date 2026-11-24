import { excerpt } from '@coachos/domain';
import type { InboxEntry } from '@/server/repo/messages';
import { whenShort } from '@/server/repo/message-format';
import type { ConversationRow } from './conversation-list';
import { initials } from './ui';

// Lignes de la liste des discussions (D-033) ; l’affichage est dans views/messaging (refonte D-135, D-145).

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
