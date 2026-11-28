'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cx } from './cx';
import { ChoiceGroup } from './form';
import { Icon } from './icons';
import nav from './nav.module.css';

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

/**
 * D-198 · Thème réellement affiché (le choix, sinon celui du système), suivi en direct, et le geste qui bascule.
 * Le choix est mémorisé sur cet appareil comme dans les réglages ; « Automatique » reste dans les réglages.
 */
function useDarkTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const read = () => { const t = root.getAttribute('data-theme'); setDark(t ? t === 'dark' : mq.matches); };
    read();
    mq.addEventListener('change', read);
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', read); mo.disconnect(); };
  }, []);
  const toggle = () => {
    const v = dark ? 'light' : 'dark';
    setCookie('coachos_theme', v);
    document.documentElement.setAttribute('data-theme', v);
    setDark(!dark);
  };
  return [dark, toggle];
}

/** D-198 · Interrupteur de l’en-tête : la lune passe en sombre, le soleil revient en clair. */
export function ThemeSwitch() {
  const [dark, toggle] = useDarkTheme();
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Mode sombre" title={dark ? 'Passer en clair' : 'Passer en sombre'}
      className={cx(nav.bell, nav.themeSwitch)} onClick={toggle}>
      <Icon name={dark ? 'sun' : 'moon'} size={22} />
    </button>
  );
}

/** D-198 · Ligne « Mode sombre » du menu du compte, avec son interrupteur. */
export function ThemeMenuSwitch({ className }: { className?: string }) {
  const [dark, toggle] = useDarkTheme();
  return (
    <button type="button" role="switch" aria-checked={dark} className={cx(className, nav.themeRow)} onClick={toggle}>
      <Icon name="moon" size={18} />Mode sombre
      <span className={nav.track} data-on={dark || undefined} aria-hidden="true"><span className={nav.thumb} /></span>
    </button>
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
