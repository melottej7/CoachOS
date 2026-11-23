'use client';

import { usePathname } from 'next/navigation';
import { SectionTabs, type SectionTab } from '@/design';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/**
 * Sous-onglets des sections du coach (D-143, carte de docs/18_REFONTE.md) : la page courante dit dans quelle section on est.
 * Boîte de réception : Retours, Messages, Notifications. Calendrier : Élèves, Groupes, À préparer.
 * Bibliothèque : Séances types, Exercices (si la musculation est encadrée), Ma méthode. Aucune page ne perd son accès.
 */
export function CoachSectionTabs({ base, strength, counts }: { base: string; strength: boolean; counts: { review: number; messages: number; notifications: number } }) {
  const path = usePathname() ?? '';
  const under = (p: string) => path === `${base}/${p}` || path.startsWith(`${base}/${p}/`);
  let label: string;
  let items: (SectionTab | null)[];
  if (under('review') || under('messages') || under('notifications')) {
    label = 'Boîte de réception';
    items = [
      { href: `${base}/review`, label: 'Retours', count: counts.review, countLabel: plural(counts.review, 'à traiter', 'à traiter'), current: under('review') },
      { href: `${base}/messages`, label: 'Messages', count: counts.messages, countLabel: plural(counts.messages, 'non lu', 'non lus'), current: under('messages'), tour: 'nav-messages' },
      { href: `${base}/notifications`, label: 'Notifications', count: counts.notifications, countLabel: plural(counts.notifications, 'non lue', 'non lues'), current: under('notifications') },
    ];
  } else if (under('calendar') || under('group-sessions') || under('groups') || under('to-plan')) {
    label = 'Calendrier';
    items = [
      { href: `${base}/calendar`, label: 'Semaine d’un élève', current: under('calendar') },
      { href: `${base}/group-sessions`, label: 'Groupes', current: under('group-sessions') || under('groups') },
      { href: `${base}/to-plan`, label: 'À préparer', current: under('to-plan') },
    ];
  } else if (under('library') || under('exercises') || under('methode')) {
    label = 'Bibliothèque';
    items = [
      { href: `${base}/library`, label: 'Séances types', current: under('library') },
      strength || under('exercises') ? { href: `${base}/exercises`, label: 'Exercices', current: under('exercises') } : null,
      { href: `${base}/methode`, label: 'Ma méthode', current: under('methode') },
    ];
  } else {
    return null;
  }
  return <SectionTabs label={label} items={items.filter((x): x is SectionTab => x !== null)} />;
}
