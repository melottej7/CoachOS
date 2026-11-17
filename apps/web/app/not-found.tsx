import Link from 'next/link';

/** X50 : message uniforme, aucune donnée, retour à la liste autorisée. */
export default function NotFound() {
  return (
    <main id="contenu" className="athlete-zone">
      <h1>Page indisponible</h1>
      <p className="sub">Cette page n’existe pas ou n’est pas accessible avec ce compte.</p>
      <p style={{ marginTop: 16 }}><Link className="btn" href="/choose-workspace">Revenir à mes espaces</Link></p>
    </main>
  );
}
