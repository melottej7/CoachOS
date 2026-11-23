'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * D-117 · Erreur inattendue d’une page : message en français, aucun détail technique à l’écran. « Réessayer »
 * recharge la page ; la référence (digest) permet de retrouver l’erreur dans le journal du serveur.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ module: 'page', code: 'UNEXPECTED', digest: error.digest ?? null }));
  }, [error]);
  return (
    <main id="contenu" className="athlete-zone">
      <h1>Un problème est survenu</h1>
      <p className="sub">La page n’a pas pu s’afficher. Ce qui était enregistré l’est resté.</p>
      {error.digest ? <p className="muted">Référence à transmettre si le problème persiste : {error.digest}</p> : null}
      <p className="actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={() => reset()}>Réessayer</button>
        <Link className="btn" href="/choose-workspace">Revenir à mes espaces</Link>
      </p>
    </main>
  );
}
