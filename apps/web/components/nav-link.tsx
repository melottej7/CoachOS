'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Lien de navigation avec aria-current selon le segment courant. */
export function NavLink({ href, match, className, children }: { href: string; match: string; className?: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === match || pathname.startsWith(match + '/');
  return (
    <Link href={href} className={className} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}

export function AthleteSelect({ wid, week, athletes, selected }: { wid: string; week: string; athletes: { id: string; name: string }[]; selected: string }) {
  return (
    <form action={`/coach/${wid}/calendar`} method="get" className="actions">
      <input type="hidden" name="week" value={week} />
      <label className="visually-hidden" htmlFor="athlete-select">Athlète affiché</label>
      <select
        id="athlete-select"
        name="athlete"
        className="select"
        defaultValue={selected}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <noscript>
        <button className="btn" type="submit">Afficher</button>
      </noscript>
    </form>
  );
}
