import type { ReactNode } from 'react';
import type { ConversationRow } from '@/components/conversation-list';
import { Heading } from '@/design';
import { cx } from '@/design/cx';
import { ConversationList } from './conversation-list';
import s from './messages-layout.module.css';

/**
 * Messages du coach (refonte Chrono, D-145) : les discussions à gauche et la conversation à droite sur ordinateur ;
 * sur téléphone, la liste ou la conversation ouverte.
 */
export function MessagesLayout({ rows, active, children }: { rows: ConversationRow[]; active: boolean; children: ReactNode }) {
  return (
    <div className={cx(s.layout, active && s.hasActive)}>
      <aside className={s.side} aria-labelledby="discussions">
        <Heading level={active ? 2 : 1} size={active ? 4 : 1} id="discussions">Discussions</Heading>
        <ConversationList rows={rows} people searchable />
      </aside>
      <section className={s.main} aria-label="Conversation">{children}</section>
    </div>
  );
}
