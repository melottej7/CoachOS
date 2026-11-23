import Link from 'next/link';
import { PRIVACY_SECTIONS, PRIVACY_VERSION, privacyContact } from '@/server/privacy/notice';
import { Brand } from '@/components/ui';

export const metadata = { title: 'Confidentialité' };

/** D-115 · Politique de confidentialité, publique, lisible sur téléphone. */
export default function Privacy() {
  const contact = privacyContact();
  return (
    <>
      <header className="top"><Brand href="/" /></header>
      <main id="contenu" className="athlete-zone">
        <Link className="back" href="/login">← Connexion</Link>
        <h1>Confidentialité</h1>
        <p className="sub">Ce que CoachOS fait de tes données, en clair. Version {PRIVACY_VERSION}.</p>
        <nav aria-label="Sommaire" className="card" style={{ marginTop: 18 }}>
          <ul className="plain card-body" style={{ columns: 2, gap: 16 }}>
            {PRIVACY_SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}
          </ul>
        </nav>
        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="card" style={{ marginTop: 18 }} aria-labelledby={`t-${s.id}`}>
            <div className="card-head"><h2 id={`t-${s.id}`}>{s.title}</h2></div>
            <div className="card-body stack">
              {s.paragraphs.map((p, i) => <p key={i} className="prose">{p}</p>)}
              {s.items ? <ul className="stack">{s.items.map((it, i) => <li key={i} className="prose">{it}</li>)}</ul> : null}
            </div>
          </section>
        ))}
        <section className="card" style={{ marginTop: 18 }} aria-labelledby="t-contact">
          <div className="card-head"><h2 id="t-contact">Contact</h2></div>
          <div className="card-body stack">
            <p className="prose">Pour toute question sur tes données : ton coach, dont le contact figure dans sa présentation (Profil › « Voir la présentation de ton coach »).</p>
            {contact ? <p className="prose">Opérateur de CoachOS : <a href={`mailto:${contact}`}>{contact}</a>.</p> : null}
          </div>
        </section>
      </main>
    </>
  );
}
