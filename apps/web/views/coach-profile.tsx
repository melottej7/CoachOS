import type { ReactNode } from 'react';
import { AUDIENCE_LABELS, COACH_GOAL_LABELS, SPOKEN_LANGUAGE_LABELS, SPORT_LABELS } from '@coachos/domain';
import { logoUrl, type CoachCardData } from '@/components/coach-card';
import { AnchorButton, Avatar, Badge, Card, Cluster, Eyebrow, Heading, Icon, Stack, Text } from '@/design';
import s from './coach-profile.module.css';

/**
 * Présentation d’un coach (refonte Chrono, D-139) : qui il est, comment il entraîne, ce qu’il prépare, comment le joindre.
 * Sert à l’élève (« Ton coach ») et à la personne invitée, avant son compte. N’affiche que ce que le coach a renseigné.
 */
export function CoachIdentity({ data, eyebrow, level = 1 }: { data: CoachCardData; eyebrow?: string; level?: 1 | 2 }) {
  const p = data.profile;
  return (
    <Stack gap={3}>
      <Cluster gap={4} nowrap align="center">
        <Avatar name={data.name} coach src={logoUrl(data)} size={64} />
        <Stack gap={1}>
          {eyebrow ? <Eyebrow tone="coach">{eyebrow}</Eyebrow> : null}
          <Heading level={level} size={2}>{data.name}</Heading>
          {data.coachName ? <Text muted>avec {data.coachName}{p?.city ? ` · ${p.city}` : ''}</Text> : p?.city ? <Text muted>{p.city}</Text> : null}
        </Stack>
      </Cluster>
      {p?.tagline ? <Text size="lg" strong>{p.tagline}</Text> : null}
    </Stack>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <Stack as="section" gap={2} aria-labelledby={id}>
      <Heading level={2} size={4} id={id}>{title}</Heading>
      {children}
    </Stack>
  );
}

function Tags({ items }: { items: string[] }) {
  return <Cluster as="ul" gap={2} className={s.tags}>{items.map((t) => <li key={t}><Badge>{t}</Badge></li>)}</Cluster>;
}

/** Le détail de la présentation ; `empty` remplace l’ensemble quand le coach n’a encore rien écrit. */
export function CoachDetails({ data, empty }: { data: CoachCardData; empty: ReactNode }) {
  const p = data.profile;
  if (!p || !(p.bio || p.approach || p.experienceYears !== null || p.certifications.length || p.sports.length || p.audiences.length || p.goals.length
    || p.languages.length || p.websiteUrl || p.socialUrl || p.contactEmail)) return <>{empty}</>;
  const facts = [
    p.sports.length ? { label: 'Sports', items: p.sports.map((x) => SPORT_LABELS[x]) } : null,
    p.audiences.length ? { label: 'Accompagne', items: p.audiences.map((x) => AUDIENCE_LABELS[x]) } : null,
    p.goals.length ? { label: 'Objectifs préparés', items: p.goals.map((x) => COACH_GOAL_LABELS[x]) } : null,
    p.languages.length ? { label: 'Langues', items: p.languages.map((x) => SPOKEN_LANGUAGE_LABELS[x]) } : null,
  ].filter((x): x is { label: string; items: string[] } => x !== null);
  return (
    <Stack gap={8}>
      {p.bio ? <Section title="Présentation" id="coach-bio"><Text prose>{p.bio}</Text></Section> : null}
      {p.approach ? <Section title="Approche d’entraînement" id="coach-approach"><Text prose>{p.approach}</Text></Section> : null}
      {p.experienceYears !== null || p.certifications.length ? (
        <Section title="Expérience" id="coach-experience">
          {p.experienceYears !== null ? <Text>{p.experienceYears} an{p.experienceYears > 1 ? 's' : ''} d’expérience en coaching</Text> : null}
          {p.certifications.length ? (
            <Stack as="ul" gap={2} className={s.certs}>
              {p.certifications.map((c) => <li key={c}><Icon name="check" size={16} /><span>{c}</span></li>)}
            </Stack>
          ) : null}
        </Section>
      ) : null}
      {facts.length ? (
        <Card pad={5}>
          <dl className={s.facts}>
            {facts.map((f) => (
              <div key={f.label} className={s.fact}>
                <dt><Eyebrow as="span">{f.label}</Eyebrow></dt>
                <dd><Tags items={f.items} /></dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
      {p.websiteUrl || p.socialUrl || p.contactEmail ? (
        <Section title="Le retrouver" id="coach-links">
          <Cluster gap={2}>
            {p.websiteUrl ? <AnchorButton href={p.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" iconRight="arrowUpRight">Site web</AnchorButton> : null}
            {p.socialUrl ? <AnchorButton href={p.socialUrl} target="_blank" rel="noopener noreferrer nofollow" iconRight="arrowUpRight">Réseau social</AnchorButton> : null}
            {p.contactEmail ? <AnchorButton href={`mailto:${p.contactEmail}`} variant="ghost">{p.contactEmail}</AnchorButton> : null}
          </Cluster>
        </Section>
      ) : null}
    </Stack>
  );
}
