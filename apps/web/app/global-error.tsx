'use client';

import './globals.css';

/** D-117 · Erreur dans le gabarit racine lui-même : page minimale autonome, en français. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr-BE">
      <body>
        <main id="contenu" className="athlete-zone">
          <h1>Un problème est survenu</h1>
          <p className="sub">CoachOS n’a pas pu s’afficher. Ce qui était enregistré l’est resté.</p>
          {error.digest ? <p className="muted">Référence : {error.digest}</p> : null}
          <p className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn primary" onClick={() => reset()}>Réessayer</button>
            <a className="btn" href="/login">Revenir à la connexion</a>
          </p>
        </main>
      </body>
    </html>
  );
}
