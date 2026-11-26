'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { athleteFileTab } from '@coachos/domain';

/**
 * D-183 · Ancien lien vers une section du dossier élève (« …#bilan », déjà envoyé par notification ou e-mail) :
 * si la section vit dans un autre onglet, on ouvre cet onglet, sur la section.
 */
export function SectionTabFromHash({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const section = decodeURIComponent(window.location.hash.slice(1));
    if (!section || document.getElementById(section)) return;
    const tab = athleteFileTab(section);
    if (tab === current) return;
    const u = new URL(window.location.href);
    if (tab === 'apercu') u.searchParams.delete('onglet'); else u.searchParams.set('onglet', tab);
    router.replace(`${u.pathname}${u.search}${u.hash}`);
  }, [current, router]);
  return null;
}
