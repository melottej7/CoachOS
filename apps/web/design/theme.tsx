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
export function ThemeChoiceGroup({ initial, hideLegend }: { initial: ThemeChoice; hideLegend?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState<ThemeChoice>(initial);
  return (
    <ChoiceGroup<ThemeChoice> legend="Apparence" hideLegend={hideLegend} name="theme" value={value}
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

export type ModeChoice = 'simple' | 'full';

/** Mémorise le mode simple sur cet appareil (D-169). */
export function setSimpleMode(on: boolean) {
  setCookie('coachos_mode', on ? 'simple' : null);
}

/** Mode simple ou complet de l’espace coach (D-169). */
export function ModeChoiceGroup({ initial }: { initial: ModeChoice }) {
  const router = useRouter();
  const [value, setValue] = useState<ModeChoice>(initial);
  return (
    <ChoiceGroup<ModeChoice> legend="Fonctions affichées" name="mode" value={value}
      options={[
        { value: 'simple', label: 'Mode simple', hint: 'Retours, élèves, calendrier et bibliothèque ; le reste est masqué' },
        { value: 'full', label: 'Tout afficher', hint: 'Tâches, rendez-vous, filtres, méthode et notifications' },
      ]}
      onChange={(v) => { setValue(v); setSimpleMode(v === 'simple'); router.refresh(); }} />
  );
}
