'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Icon } from './icons';
import s from './nav.module.css';

/** Une page principale (onglet de la barre du bas) et les pages qui lui appartiennent. */
export interface BackRoot { href: string; also?: string[] }

/**
 * Retour du fondateur · Une fois CoachOS installée sur le téléphone, il n’y a plus de bouton « précédent » du navigateur :
 * sur toute page intérieure, une flèche ramène en arrière. Si l’on est arrivé par l’application, c’est la page précédente ;
 * sinon (lien d’une notification, page rechargée), la page d’où l’on vient (`from`) ou l’onglet auquel la page appartient.
 * Rien sur les pages principales.
 */
export function BackLink({ roots, home, except = [] }: { roots: BackRoot[]; home: string; except?: string[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const first = useRef(pathname);
  const moved = useRef(false);
  useEffect(() => { if (pathname !== first.current) moved.current = true; }, [pathname]);
  const isRoot = pathname === home || roots.some((r) => r.href === pathname || r.also?.includes(pathname));
  // Pages qui ont déjà leur propre sortie (« Quitter » du suivi de séance).
  if (isRoot || except.some((x) => pathname.endsWith(x))) return null;
  const from = params.get('from');
  const owner = roots.find((r) => [r.href, ...(r.also ?? [])].some((p) => pathname.startsWith(`${p}/`)));
  const fallback = from && /^\/(coach|athlete)\//.test(from) && !from.startsWith('//') ? from : owner?.href ?? home;
  return (
    <button type="button" className={s.back} aria-label="Revenir en arrière"
      onClick={() => { if (moved.current && window.history.length > 1) router.back(); else router.push(fallback); }}>
      <Icon name="chevronLeft" size={24} />
    </button>
  );
}
