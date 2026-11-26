'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from '@/design';
import { currentInstallEnv } from './install-env';

/**
 * D-180 · Tirer vers le bas pour actualiser, dans l’app installée sur l’écran d’accueil (l’iPhone ne le propose pas
 * hors de Safari). Le navigateur garde son propre geste : rien n’est ajouté ailleurs. L’actualisation relit les données
 * du serveur sans recharger la page : ce qui est en cours de saisie reste en place.
 */
export const PULL_THRESHOLD = 64;
const PULL_MAX = 96;
const FORCE_KEY = 'coachos-pull'; // essais : active le geste hors de l’app installée

/** Distance affichée pour un doigt descendu de `dy` pixels : résistance croissante, plafonnée. */
export function pullDistance(dy: number): number {
  if (dy <= 0) return 0;
  return Math.min(PULL_MAX, Math.round(dy * 0.5));
}

/** Le geste ne commence pas dans un champ, une fenêtre, une zone marquée ou une liste déjà défilée. */
export function pullBlockedBy(target: Element | null): boolean {
  if (!target) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [data-no-pull]')) return true;
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
  }
  return false;
}

function enabled(): boolean {
  try {
    if (sessionStorage.getItem(FORCE_KEY) === '1') return true;
  } catch { /* stockage indisponible */ }
  return currentInstallEnv() === 'installed';
}

export function PullToRefresh() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [dist, setDist] = useState(0);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const distRef = useRef(0);

  useEffect(() => { setOn(enabled()); }, []);

  useEffect(() => {
    if (!on) return;
    const begin = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0 || pullBlockedBy(e.target as Element)) { start.current = null; return; }
      start.current = e.touches[0]!.clientY;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { start.current = null; distRef.current = 0; setDist(0); return; }
      if (e.cancelable) e.preventDefault(); // pas de rebond de la page pendant le geste
      distRef.current = pullDistance(dy);
      setDist(distRef.current);
    };
    const end = () => {
      if (start.current === null) return;
      start.current = null;
      const go = distRef.current >= PULL_THRESHOLD;
      distRef.current = 0;
      setDist(0);
      if (!go) return;
      setBusy(true);
      startTransition(() => router.refresh());
    };
    window.addEventListener('touchstart', begin, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', begin);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [on, busy, router]);

  // La roue reste au moins un instant : une actualisation trop rapide ne se verrait pas.
  useEffect(() => {
    if (!busy || pending) return;
    const t = setTimeout(() => setBusy(false), 400);
    return () => clearTimeout(t);
  }, [busy, pending]);

  if (!on) return null;
  const shown = busy ? PULL_THRESHOLD : dist;
  const ready = dist >= PULL_THRESHOLD;
  return (
    <>
      <div className="pull-refresh" data-state={busy ? 'busy' : ready ? 'ready' : 'pull'} aria-hidden="true"
        style={{ transform: `translate(-50%, ${shown - 48}px)`, opacity: shown ? Math.min(1, shown / PULL_THRESHOLD) : 0 }}>
        <span style={busy ? undefined : { transform: `rotate(${Math.round(dist * 4)}deg)` }}><Icon name="repeat" size={20} /></span>
      </div>
      <span className="pull-refresh-sr" role="status">{busy ? 'Actualisation…' : ''}</span>
    </>
  );
}
