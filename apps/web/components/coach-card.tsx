import {
  AUDIENCE_LABELS, COACH_GOAL_LABELS, SPOKEN_LANGUAGE_LABELS, SPORT_LABELS,
  type CoachGoal, type Level, type SpokenLanguage, type Sport,
} from '@coachos/domain';

/** Données publiques d’un espace (sérialisables, utilisables côté serveur et client). */
export interface CoachCardData {
  id: string;
  name: string;
  coachName: string | null;
  logoVersion: string | null;
  profile: {
    tagline: string | null; bio: string | null; approach: string | null; experienceYears: number | null; certifications: string[];
    sports: Sport[]; audiences: Level[]; goals: CoachGoal[]; city: string | null; languages: SpokenLanguage[];
    websiteUrl: string | null; socialUrl: string | null; contactEmail: string | null;
  } | null;
}

export function logoUrl(d: Pick<CoachCardData, 'id' | 'logoVersion'>): string | null {
  return d.logoVersion ? `/media/workspaces/${d.id}/logo?v=${d.logoVersion}` : null;
}

function Initials({ name, small }: { name: string; small?: boolean }) {
  const t = name.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();
  return <span className={`logo ${small ? 'small' : ''}`} aria-hidden="true" style={{ display: 'grid', placeItems: 'center', fontWeight: 800, background: 'var(--mint)', color: 'var(--mint-ink)' }}>{t}</span>;
}

export function CoachLogo({ data, small }: { data: Pick<CoachCardData, 'id' | 'logoVersion' | 'name'>; small?: boolean }) {
  const url = logoUrl(data);
  // eslint-disable-next-line @next/next/no-img-element -- image servie par l’application, taille fixe
  return url ? <img className={`logo ${small ? 'small' : ''}`} src={url} alt="" width={small ? 32 : 64} height={small ? 32 : 64} /> : <Initials name={data.name} small={small} />;
}

/** En-tête de présentation : logo, nom de l’espace, coach, accroche. */
export function CoachHeader({ data }: { data: CoachCardData }) {
  const p = data.profile;
  return (
    <div className="coach-card">
      <CoachLogo data={data} />
      <div>
        <h2 style={{ margin: 0 }}>{data.name}</h2>
        {data.coachName ? <p className="muted">avec {data.coachName}{p?.city ? ` · ${p.city}` : ''}</p> : null}
        {p?.tagline ? <p style={{ marginTop: 6, fontWeight: 600 }}>{p.tagline}</p> : null}
      </div>
    </div>
  );
}

/** Présentation complète (écran « Ton coach »). N’affiche que ce que le coach a renseigné. */
export function CoachDetails({ data }: { data: CoachCardData }) {
  const p = data.profile;
  if (!p) return <p className="muted">Ton coach n’a pas encore complété sa présentation.</p>;
  const tags = (items: string[]) => <div className="tags">{items.map((t) => <span key={t} className="pill neutral">{t}</span>)}</div>;
  return (
    <div className="stack">
      {p.bio ? <section><h3>Présentation</h3><p className="prose">{p.bio}</p></section> : null}
      {p.approach ? <section><h3>Approche d’entraînement</h3><p className="prose">{p.approach}</p></section> : null}
      {p.experienceYears !== null || p.certifications.length ? (
        <section>
          <h3>Expérience</h3>
          {p.experienceYears !== null ? <p>{p.experienceYears} an{p.experienceYears > 1 ? 's' : ''} d’expérience en coaching</p> : null}
          {p.certifications.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{p.certifications.map((c) => <li key={c}>{c}</li>)}</ul> : null}
        </section>
      ) : null}
      {p.sports.length ? <section><h3>Sports</h3>{tags(p.sports.map((s) => SPORT_LABELS[s]))}</section> : null}
      {p.audiences.length ? <section><h3>Accompagne</h3>{tags(p.audiences.map((a) => AUDIENCE_LABELS[a]))}</section> : null}
      {p.goals.length ? <section><h3>Objectifs préparés</h3>{tags(p.goals.map((g) => COACH_GOAL_LABELS[g]))}</section> : null}
      {p.languages.length || p.websiteUrl || p.socialUrl || p.contactEmail ? (
        <section>
          <h3>Infos pratiques</h3>
          {p.languages.length ? <p>Langues : {p.languages.map((l) => SPOKEN_LANGUAGE_LABELS[l]).join(', ')}</p> : null}
          {p.websiteUrl ? <p><a href={p.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">Site web</a></p> : null}
          {p.socialUrl ? <p><a href={p.socialUrl} target="_blank" rel="noopener noreferrer nofollow">Réseau social</a></p> : null}
          {p.contactEmail ? <p>Contact : <a href={`mailto:${p.contactEmail}`}>{p.contactEmail}</a></p> : null}
        </section>
      ) : null}
    </div>
  );
}
