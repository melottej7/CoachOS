import { PRIVACY_SECTIONS, PRIVACY_VERSION, privacyContact } from '@/server/privacy/notice';
import { Card, Cluster, Heading, LinkButton, PublicShell, Stack, Text } from '@/design';
import s from '@/views/account/account.module.css';

export const metadata = { title: 'Confidentialité' };

/** D-115, refonte Chrono (D-156) · Politique de confidentialité, publique, lisible sur téléphone. */
export default function Privacy() {
  const contact = privacyContact();
  return (
    <PublicShell wide>
      <Stack gap={6}>
        <Cluster><LinkButton href="/login" variant="ghost" size="sm" icon="chevronLeft">Connexion</LinkButton></Cluster>
        <Stack gap={1}>
          <Heading level={1} size={1}>Confidentialité</Heading>
          <Text muted>Ce que CoachOS fait de tes données, en clair. Version {PRIVACY_VERSION}.</Text>
        </Stack>
        <Card as="nav" pad={5} aria-label="Sommaire">
          <ul className={s.toc}>{PRIVACY_SECTIONS.map((x) => <li key={x.id}><a href={`#${x.id}`}>{x.title}</a></li>)}</ul>
        </Card>
        {PRIVACY_SECTIONS.map((x) => (
          <Stack as="section" key={x.id} id={x.id} gap={3} aria-labelledby={`t-${x.id}`}>
            <Heading level={2} size={3} id={`t-${x.id}`}>{x.title}</Heading>
            {x.paragraphs.map((p, i) => <p key={i} className={s.prose}>{p}</p>)}
            {x.items ? <ul className={s.items}>{x.items.map((it, i) => <li key={i}>{it}</li>)}</ul> : null}
          </Stack>
        ))}
        <Stack as="section" gap={3} aria-labelledby="t-contact">
          <Heading level={2} size={3} id="t-contact">Contact</Heading>
          <p className={s.prose}>Pour toute question sur tes données : ton coach, dont le contact figure dans sa présentation (Profil › « Voir la présentation de ton coach »).</p>
          {contact ? <p className={s.prose}>Opérateur de CoachOS : <a href={`mailto:${contact}`}>{contact}</a>.</p> : null}
        </Stack>
      </Stack>
    </PublicShell>
  );
}
