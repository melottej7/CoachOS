'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/design';

/** Choisir l’élève dont on prépare la semaine : l’adresse change aussitôt (et reste partageable). */
export function AthletePicker({ wid, week, athletes, selected }: { wid: string; week: string; athletes: { id: string; name: string }[]; selected: string }) {
  const router = useRouter();
  return (
    <div data-tour="athlete-select">
      <label className="ds-visually-hidden" htmlFor="athlete-picker">Élève affiché</label>
      <Select id="athlete-picker" value={selected} onChange={(e) => router.push(`/coach/${wid}/calendar?athlete=${e.target.value}&week=${week}`)}>
        {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
    </div>
  );
}
