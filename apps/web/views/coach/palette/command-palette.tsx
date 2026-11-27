'use client';

import { useRouter } from 'next/navigation';
import { HELP_ARTICLES } from '@/help/articles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PaletteData } from '@/server/repo/palette';
import { Icon, IconButton, type IconName } from '@/design';
import s from './palette.module.css';

const OPEN = 'coachos:palette';
const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

interface Entry { id: string; group: string; label: string; meta?: string; icon: IconName; href: string; keywords?: string }

/** Ouvre la palette depuis n’importe quel bouton (rail, en-tête du téléphone). */
export function PaletteButton({ variant }: { variant: 'rail' | 'header' }) {
  const open = () => window.dispatchEvent(new Event(OPEN));
  if (variant === 'header') return <IconButton icon="search" label="Rechercher (⌘K)" variant="ghost" onClick={open} />;
  return (
    <button type="button" className={s.railTrigger} onClick={open} aria-keyshortcuts="Meta+K Control+K">
      <Icon name="search" size={16} /><span>Rechercher</span><kbd>⌘K</kbd>
    </button>
  );
}

/**
 * D-160 · Palette de commandes du coach (direction D-128, « Studio ») : ⌘K ou Ctrl+K partout dans l’espace coach.
 * Destinations, actions courantes, élèves (fiche, semaine, écrire), groupes et séances types ; flèches, Entrée, Échap.
 * Les élèves, groupes et séances types sont lus à la première ouverture, sous les mêmes droits que les pages.
 */
export function CommandPalette({ wid, owner, strength }: { wid: string; owner: boolean; strength: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [data, setData] = useState<PaletteData | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `/coach/${wid}`;

  const open = useCallback(() => {
    const d = ref.current;
    if (!d || d.open) return;
    setQ(''); setActive(0);
    d.showModal();
    input.current?.focus();
    if (!data) {
      fetch(`/api/v1/workspaces/${wid}/palette`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((x: PaletteData) => { setData(x); setFailed(false); })
        .catch(() => setFailed(true));
    }
  }, [data, wid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN, open);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN, open); };
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const nav: Entry[] = [
      { id: 'n-home', group: 'Aller à', label: 'Accueil', icon: 'home', href: `${base}/planning` },
      { id: 'n-cal', group: 'Aller à', label: 'Calendrier', icon: 'calendar', href: `${base}/calendar` },
      { id: 'n-ath', group: 'Aller à', label: 'Élèves', icon: 'users', href: `${base}/athletes` },
      { id: 'n-rev', group: 'Aller à', label: 'Retours à traiter', icon: 'inbox', href: `${base}/review`, keywords: 'boite reception' },
      { id: 'n-msg', group: 'Aller à', label: 'Messages', icon: 'chat', href: `${base}/messages` },
      { id: 'n-lib', group: 'Aller à', label: 'Séances types', icon: 'library', href: `${base}/library`, keywords: 'bibliotheque' },
      ...(strength ? [{ id: 'n-ex', group: 'Aller à', label: 'Exercices', icon: 'library' as IconName, href: `${base}/exercises`, keywords: 'musculation' }] : []),
      { id: 'n-meth', group: 'Aller à', label: 'Ma méthode', icon: 'library', href: `${base}/methode` },
      { id: 'n-grp', group: 'Aller à', label: 'Séances de groupe', icon: 'users', href: `${base}/group-sessions` },
      { id: 'n-set', group: 'Aller à', label: 'Paramètres', icon: 'settings', href: `${base}/settings` },
      { id: 'n-acc', group: 'Aller à', label: 'Mon compte', icon: 'user', href: '/profile' },
    ];
    const actions: Entry[] = [
      ...(owner ? [{ id: 'a-add', group: 'Actions', label: 'Ajouter un élève', icon: 'plus' as IconName, href: `${base}/athletes/new`, keywords: 'inviter' }] : []),
      { id: 'a-ask', group: 'Actions', label: 'Demander à l’IA', icon: 'bolt', href: `${base}/assistant`, keywords: 'ia assistant question resume brouillon' },
      { id: 'a-tpl', group: 'Actions', label: 'Nouvelle séance type', icon: 'plus', href: `${base}/library/new` },
      { id: 'a-imp', group: 'Actions', label: 'Importer des séances', icon: 'upload', href: `${base}/library/import` },
      { id: 'a-prep', group: 'Actions', label: 'Semaines à préparer', icon: 'calendar', href: `${base}/to-plan` },
      { id: 'a-theme', group: 'Actions', label: 'Apparence : clair, sombre, densité', icon: 'sun', href: `${base}/settings?onglet=apparence` },
    ];
    const people: Entry[] = (data?.athletes ?? []).flatMap((a) => [
      { id: `p-${a.id}`, group: 'Élèves', label: a.name, meta: a.invited ? 'invité·e · fiche' : 'fiche', icon: 'user' as IconName, href: `${base}/athletes/${a.id}` },
      { id: `w-${a.id}`, group: 'Élèves', label: `Semaine de ${a.name}`, meta: 'calendrier', icon: 'calendar' as IconName, href: `${base}/calendar?athlete=${a.id}` },
      { id: `m-${a.id}`, group: 'Élèves', label: `Écrire à ${a.name}`, meta: 'message', icon: 'chat' as IconName, href: `${base}/messages/${a.id}` },
    ]);
    const teams: Entry[] = (data?.teams ?? []).map((t) => ({ id: `t-${t.id}`, group: 'Groupes', label: t.name, meta: 'semaine du groupe', icon: 'users', href: `${base}/groups/${t.id}/week` }));
    const tpls: Entry[] = (data?.templates ?? []).map((t) => ({ id: `l-${t.id}`, group: 'Séances types', label: t.title, meta: t.mine ? 'modifier' : 'bibliothèque', icon: 'library', href: t.mine ? `${base}/library/${t.id}` : `${base}/library` }));
    // D-194 : l’aide, par sa question (« Inviter tes élèves »), et le centre d’aide.
    const help: Entry[] = [
      { id: 'h-center', group: 'Aide', label: 'Centre d’aide', icon: 'info', href: `${base}/aide`, keywords: 'aide question comment faire' },
      ...HELP_ARTICLES.filter((a) => a.audience === 'coach').map((a) => ({ id: `h-${a.slug}`, group: 'Aide', label: a.title, meta: 'aide', icon: 'info' as IconName, href: `${base}/aide/${a.slug}`, keywords: `aide comment ${a.keywords}` })),
    ];
    return [...nav, ...actions, ...people, ...teams, ...tpls, ...help];
  }, [base, data, owner, strength]);

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return entries.filter((e) => e.group === 'Aller à' || e.group === 'Actions' || (e.group === 'Élèves' && e.id.startsWith('p-'))).slice(0, 40);
    return entries.filter((e) => { const t = norm(`${e.label} ${e.meta ?? ''} ${e.keywords ?? ''} ${e.group}`); return words.every((w) => t.includes(w)); }).slice(0, 40);
  }, [entries, q]);

  useEffect(() => { setActive(0); }, [q]);

  function go(e: Entry | undefined) {
    if (!e) return;
    ref.current?.close();
    router.push(e.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[active]); }
  }

  useEffect(() => { document.getElementById(`pal-${shown[active]?.id}`)?.scrollIntoView({ block: 'nearest' }); }, [active, shown]);

  let last = '';
  return (
    <dialog ref={ref} className={s.dialog} aria-label="Palette de commandes" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className={s.inner}>
        <div className={s.search}>
          <Icon name="search" size={20} />
          <input ref={input} className={s.input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Élève, groupe, séance type, page ou action…" aria-label="Rechercher" role="combobox" aria-expanded="true"
            aria-controls="pal-list" aria-activedescendant={shown[active] ? `pal-${shown[active].id}` : undefined} autoComplete="off" spellCheck={false} />
        </div>
        {shown.length ? (
          <ul id="pal-list" role="listbox" className={s.list} aria-label="Résultats">
            {shown.map((e, i) => {
              const head = e.group !== last ? e.group : null;
              last = e.group;
              return (
                <li key={e.id} role="presentation">
                  {head ? <div className={s.group} role="presentation">{head}</div> : null}
                  <div id={`pal-${e.id}`} role="option" aria-selected={i === active} className={s.option}
                    onMouseMove={() => setActive(i)} onClick={() => go(e)}>
                    <Icon name={e.icon} size={18} />
                    <span className={s.label}>{e.label}</span>
                    {e.meta ? <span className={s.meta}>{e.meta}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>{failed ? 'Recherche indisponible pour l’instant. Les pages restent accessibles par le menu.' : 'Aucun résultat.'}</p>}
        <div className={s.foot} aria-hidden="true"><span>↑ ↓ choisir</span><span>Entrée ouvrir</span><span>Échap fermer</span></div>
      </div>
    </dialog>
  );
}
