'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { searchHelp, type HelpAudience } from '@/help/articles';
import { Icon, Stack, Text } from '@/design';
import s from './help.module.css';

/**
 * D-194 · Centre d’aide : une recherche qui tolère les accents et les fautes de casse, puis les articles par thème.
 * Chaque article tient en quelques lignes et mène à la bonne page.
 */
export function HelpCenter({ audience, base, initial = '' }: { audience: HelpAudience; base: string; initial?: string }) {
  const [q, setQ] = useState(initial);
  const found = useMemo(() => searchHelp(q, audience), [q, audience]);
  const themes = useMemo(() => [...new Set(found.map((a) => a.theme))], [found]);
  const searching = q.trim().length > 1;
  return (
    <Stack gap={5}>
      <label className={s.search}>
        <Icon name="search" size={18} />
        <span className="ds-visually-hidden">Rechercher dans l’aide</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={audience === 'coach' ? 'Ex. inviter, charge, publier, abonnement…' : 'Ex. installer, pause, son, retour…'}
          aria-label="Rechercher dans l’aide" autoComplete="off" enterKeyHint="search" />
      </label>
      {searching ? <Text size="sm" muted aria-live="polite">{found.length ? `${found.length} article${found.length > 1 ? 's' : ''}` : ''}</Text> : null}
      {found.length ? (searching ? [null] : themes).map((theme) => (
        <section key={theme ?? 'resultats'} className={s.group} aria-label={theme ?? 'Résultats'}>
          {theme ? <h2 className={s.theme}>{theme}</h2> : null}
          <ul className={s.list}>
            {found.filter((a) => !theme || a.theme === theme).map((a) => (
              <li key={a.slug}>
                <Link className={s.item} href={`${base}/aide/${a.slug}`}>
                  <span className={s.itemText}><span className={s.itemTitle}>{a.title}</span><span className={s.itemSummary}>{a.summary}</span></span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )) : (
        <Text muted>{`Rien trouvé pour « ${q.trim()} ». Essaie un autre mot${audience === 'athlete' ? ', ou demande à ton coach dans Échanges' : ''}.`}</Text>
      )}
    </Stack>
  );
}
