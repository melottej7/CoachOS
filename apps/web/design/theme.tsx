'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChoiceGroup } from './form';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type DensityChoice = 'comfortable' | 'compact';
const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string | null) {
  document.cookie = value === null ? `${name}=; path=/; max-age=0; samesite=lax` : `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
}

/** Clair, sombre ou automatique (système). Appliqué tout de suite, mémorisé sur cet appareil. */
export function ThemeChoiceGroup({ initial }: { initial: ThemeChoice }) {
  const router = useRouter();
  const [value, setValue] = useState<ThemeChoice>(initial);
  return (
    <ChoiceGroup<ThemeChoice> legend="Apparence" name="theme" value={value}
      options={[{ value: 'system', label: 'Automatique', icon: 'monitor' }, { value: 'light', label: 'Clair', icon: 'sun' }, { value: 'dark', label: 'Sombre', icon: 'moon' }]}
      onChange={(v) => {
        setValue(v);
        setCookie('coachos_theme', v === 'system' ? null : v);
        if (v === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', v);
        router.refresh();
      }} />
  );
}

/** Densité de l’espace coach : confortable par défaut, compacte pour voir plus de choses à la fois. */
export function DensityChoiceGroup({ initial }: { initial: DensityChoice }) {
  const router = useRouter();
  const [value, setValue] = useState<DensityChoice>(initial);
  return (
    <ChoiceGroup<DensityChoice> legend="Densité" name="density" value={value}
      options={[{ value: 'comfortable', label: 'Confortable' }, { value: 'compact', label: 'Compacte' }]}
      onChange={(v) => {
        setValue(v);
        setCookie('coachos_density', v === 'compact' ? 'compact' : null);
        if (v === 'compact') document.documentElement.setAttribute('data-density', 'compact');
        else document.documentElement.removeAttribute('data-density');
        router.refresh();
      }} />
  );
}
