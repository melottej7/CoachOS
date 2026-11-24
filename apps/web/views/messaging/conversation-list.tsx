'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ConversationRow } from '@/components/conversation-list';
import { Avatar, Icon, Input, Stack } from '@/design';
import { cx } from '@/design/cx';
import s from './conversation-list.module.css';

/**
 * Liste des discussions (refonte Chrono, D-135) : avatar, nom, dernier message, heure, non-lus écrits en toutes lettres.
 * `people` : les lignes sont des élèves (côté coach), avatar rond ; sinon le coach, avatar à sa couleur.
 * `searchable` : recherche par nom, sans accents (côté coach, reprise de l’ancienne liste).
 */
export function ConversationList({ rows, people, searchable }: { rows: ConversationRow[]; people?: boolean; searchable?: boolean }) {
  const [q, setQ] = useState('');
  if (!rows.length) return <p className={s.empty}>Aucune discussion pour l’instant.</p>;
  const norm = (x: string) => x.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = q.trim() ? rows.filter((r) => norm(r.name).includes(norm(q.trim()))) : rows;
  const list = shown.length ? (
    <ul className={s.list}>
      {shown.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className={cx(s.row, r.unread > 0 && s.unread)} aria-current={r.active ? 'page' : undefined}>
            {r.team ? <span className={s.team} aria-hidden="true"><Icon name="users" size={20} /></span> : <Avatar name={r.name} coach={!people} size={44} />}
            <span className={s.text}>
              <span className={s.top}><span className={s.name}>{r.name}</span>{r.when ? <span className={s.when}>{r.when}</span> : null}</span>
              <span className={s.preview}>{r.preview}</span>
            </span>
            {r.unread ? <span className={s.count}>{r.unread}<span className="ds-visually-hidden"> non lu{r.unread > 1 ? 's' : ''}</span></span> : null}
          </Link>
        </li>
      ))}
    </ul>
  ) : <p className={s.empty}>Aucune discussion ne correspond.</p>;
  if (!searchable) return list;
  return (
    <Stack gap={3}>
      <label className="ds-visually-hidden" htmlFor="conversation-search">Rechercher une discussion</label>
      <Input id="conversation-search" type="search" placeholder="Rechercher un élève ou un groupe" value={q} onChange={(e) => setQ(e.target.value)} />
      {list}
    </Stack>
  );
}
