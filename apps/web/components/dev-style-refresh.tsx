'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Développement seulement. Next garde la feuille de styles chargée au premier affichage de l’onglet ;
 * quand elle change pendant que l’onglet reste ouvert, les nouvelles pages s’affichaient sans leurs styles
 * (cas vécu par le fondateur dans Safari). À chaque changement de page et à chaque retour sur l’onglet,
 * on relit la feuille courante et on applique sa dernière version si elle a changé.
 */
export function DevStyleRefresh() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let cancelled = false;
    const refresh = async () => {
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="/_next/static/"]')];
      for (const link of links) {
        const href = link.href.split('?')[0]!;
        let css: string;
        try {
          css = await (await fetch(`${href}?v=${Date.now()}`, { cache: 'no-store' })).text();
        } catch {
          continue;
        }
        if (cancelled) return;
        let style = document.head.querySelector<HTMLStyleElement>(`style[data-dev-css="${href}"]`);
        if (style?.textContent === css) continue;
        if (!style) {
          style = document.createElement('style');
          style.dataset.devCss = href;
          document.head.appendChild(style);
        }
        style.textContent = css;
      }
    };
    void refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [pathname]);
  return null;
}
