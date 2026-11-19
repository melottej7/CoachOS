'use client';

import Link from 'next/link';
import { useState } from 'react';

// Liste des discussions façon messagerie instantanée : recherche, avatar, nom, dernier message, heure, non-lus.

export interface ConversationRow {
  key: string;
  href: string;
  name: string;
  team: boolean;
  initials: string;
  preview: string;
  when: string | null;
  unread: number;
  active: boolean;
}

export function ConversationList({ rows, searchable = true }: { rows: ConversationRow[]; searchable?: boolean }) {
  const [q, setQ] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const shown = q.trim() ? rows.filter((r) => norm(r.name).includes(norm(q.trim()))) : rows;
  return (
    <div className="cl">
      {searchable ? (
        <div className="cl-search">
          <label className="visually-hidden" htmlFor="cl-q">Rechercher une discussion</label>
          <input id="cl-q" type="search" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      ) : null}
      <ul className="cl-list">
        {shown.map((r) => (
          <li key={r.key}>
            <Link href={r.href} className={`cl-row${r.active ? ' active' : ''}${r.unread ? ' unread' : ''}`} aria-current={r.active ? 'page' : undefined}>
              <span className={`cl-avatar${r.team ? ' team' : ''}`} aria-hidden="true">{r.team ? '👥' : r.initials}</span>
              <span className="cl-text">
                <span className="cl-name">{r.name}</span>
                <span className="cl-preview"><span className="cl-preview-text">{r.preview}</span>{r.when ? <span className="cl-when"> · {r.when}</span> : null}</span>
              </span>
              {r.unread ? <span className="cl-dot" aria-label={`${r.unread} non lu${r.unread > 1 ? 's' : ''}`} /> : null}
            </Link>
          </li>
        ))}
        {!shown.length ? <li className="cl-empty">{q ? 'Aucune discussion ne correspond.' : 'Aucune discussion pour l’instant.'}</li> : null}
      </ul>
    </div>
  );
}
