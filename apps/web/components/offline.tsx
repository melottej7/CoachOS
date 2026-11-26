'use client';

import { useEffect } from 'react';

/**
 * D-080 : enregistre le service worker de lecture hors ligne (public/sw.js). Seulement en contexte sûr (https ou
 * localhost) : sur une adresse http du réseau local, le navigateur le refuse et l’application marche comme avant.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* sans hors-ligne, rien ne change */ });
  }, []);
  return null;
}

/**
 * D-179 · Garde les séances de la semaine lisibles sans réseau, consignes et animations comprises : quand l’élève
 * ouvre Aujourd’hui ou son Programme en ligne, le service worker enregistre aussi ces pages, sans attendre qu’il les ouvre.
 */
export function KeepOffline({ urls }: { urls: string[] }) {
  const key = urls.join('|');
  useEffect(() => {
    if (!key || !('serviceWorker' in navigator) || !window.isSecureContext || !navigator.onLine) return;
    const t = window.setTimeout(() => {
      void navigator.serviceWorker.ready.then((r) => r.active?.postMessage({ type: 'coachos-keep', urls: key.split('|') }));
    }, 1500);
    return () => window.clearTimeout(t);
  }, [key]);
  return null;
}
