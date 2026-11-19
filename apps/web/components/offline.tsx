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
