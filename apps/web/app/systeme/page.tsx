import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  Avatar, Badge, Banner, Button, Card, Cluster, Divider, EmptyState, Eyebrow, Grid, Heading, IconButton, Kbd, LinkButton, Meter, Skeleton, Stack, Stats, Text, ZoneChip, ZoneProfile, ZoneStrip,
  type ZoneLevel,
} from '@/design';
import { DensityChoiceGroup, ThemeChoiceGroup } from '@/design/theme';
import { DemoInteractive } from './demo-client';

export const metadata = { title: 'Design system' };
export const dynamic = 'force-dynamic';

const COLORS = ['bg', 'surface', 'surface-2', 'surface-3', 'ink', 'ink-2', 'rule', 'rule-strong', 'primary', 'signal', 'coach', 'success', 'warning', 'danger', 'info', 'focus'];
const ZONE_NAMES = ['Récupération', 'Endurance', 'Endurance active', 'Seuil', 'Allure 5 km', 'VMA', 'Vitesse'];
const ACCENTS = [['emerald', 'Émeraude'], ['ocean', 'Océan'], ['sunset', 'Couchant'], ['berry', 'Mûre'], ['slate', 'Ardoise'], ['forest', 'Forêt']] as const;

/**
 * Page de démonstration interne du design system « Chrono » (D-128, étape 4 de D-123). Développement uniquement.
 * Chaque composant y figure avec ses états ; un écran reconstruit n’utilise que ces pièces.
 */
export default async function DesignSystem() {
  if (process.env.NODE_ENV === 'production') notFound();
  const jar = await cookies();
  const theme = jar.get('coachos_theme')?.value;
  const density = jar.get('coachos_density')?.value;
  const intervals: { zone: ZoneLevel; seconds: number }[] = [{ zone: 2, seconds: 900 }, ...Array.from({ length: 10 }, (_, i) => [{ zone: 6 as ZoneLevel, seconds: 30 }, { zone: 1 as ZoneLevel, seconds: i < 9 ? 30 : 0 }]).flat().filter((x) => x.seconds), { zone: 1, seconds: 600 }];
  return (
    <div className="chrono" style={{ minHeight: '100vh' }}>
      <Stack as="main" gap={10} style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 16px 80px' }}>
        <Stack gap={2}>
          <Eyebrow tone="signal">CoachOS · interne</Eyebrow>
          <Heading level={1}>Design system « Chrono »</Heading>
          <Text muted size="md">Jetons, composants et états. Tout écran reconstruit s’écrit avec ces pièces (D-128).</Text>
        </Stack>

        <Grid min={280} gap={6}>
          <Card pad={5}><Stack gap={3}><Heading level={2} size={4}>Apparence</Heading><ThemeChoiceGroup initial={theme === 'light' || theme === 'dark' ? theme : 'system'} /></Stack></Card>
          <Card pad={5}><Stack gap={3}><Heading level={2} size={4}>Densité (coach)</Heading><DensityChoiceGroup initial={density === 'compact' ? 'compact' : 'comfortable'} /></Stack></Card>
        </Grid>

        <Stack as="section" gap={4} aria-labelledby="couleurs">
          <Heading level={2} size={3} id="couleurs">Couleurs</Heading>
          <Grid min={150} gap={3}>
            {COLORS.map((c) => (
              <Card key={c} pad={3}><Stack gap={2}><span style={{ display: 'block', height: 48, borderRadius: 8, background: `var(--ds-${c})`, border: '1px solid var(--ds-rule)' }} /><Text size="sm" strong>--ds-{c}</Text></Stack></Card>
            ))}
          </Grid>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="zones">
          <Heading level={2} size={3} id="zones">Les 7 zones</Heading>
          <Text muted>La signature de la donnée : une couleur par zone dans tout le produit, toujours doublée de « Zn ».</Text>
          <Grid min={150} gap={3}>
            {ZONE_NAMES.map((n, i) => (
              <Card key={n} pad={3}><Cluster gap={3}><ZoneChip zone={(i + 1) as ZoneLevel} size="lg" /><Text strong>{n}</Text></Cluster></Card>
            ))}
          </Grid>
          <Card pad={5}>
            <Stack gap={5}>
              <ZoneStrip title="Footing facile : 10 minutes en Z1, 20 en Z2, 5 en Z1" labels height={16}
                segments={[{ zone: 1, seconds: 600, label: '10 min' }, { zone: 2, seconds: 1200, label: '20 min' }, { zone: 1, seconds: 300, label: '5 min' }]} />
              <ZoneProfile title="30 secondes, 30 secondes, dix fois" bars={intervals} height={72} />
            </Stack>
          </Card>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="typo">
          <Heading level={2} size={3} id="typo">Typographie</Heading>
          <Card pad={5}>
            <Stack gap={3}>
              <Eyebrow>Lundi 23 novembre · course à pied</Eyebrow>
              <Heading level={3} size={1}>Footing facile</Heading>
              <Heading level={3} size={2}>Semaine du 23 au 29 nov.</Heading>
              <Heading level={3} size={4}>Qui a besoin de toi</Heading>
              <Text size="lg">Texte important, 18 px.</Text>
              <Text>Texte courant, Barlow 15 px. Une allure où tu peux parler en phrases complètes.</Text>
              <Text size="sm" muted>Texte secondaire, 13 px, contraste vérifié.</Text>
            </Stack>
          </Card>
          <Stats items={[{ label: 'Durée', value: '35', unit: ' min' }, { label: 'Distance', value: '5,8', unit: ' km', sub: 'environ' }, { label: 'Régularité', value: '61', unit: ' %', trend: { up: true, text: '4 points' } }]} />
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="boutons">
          <Heading level={2} size={3} id="boutons">Boutons</Heading>
          <Card pad={5}>
            <Stack gap={4}>
              <Cluster gap={2}><Button variant="primary" icon="plus">Séance</Button><Button>Modifier</Button><Button variant="ghost">Plus tard</Button><Button variant="danger" icon="trash">Supprimer</Button><Button variant="coach" icon="play">Suivre la séance</Button></Cluster>
              <Cluster gap={2}><Button variant="primary" size="sm">Petit</Button><Button variant="primary" size="lg">Grand</Button><Button variant="primary" loading>Enregistrement</Button><Button variant="primary" disabled>Désactivé</Button></Cluster>
              <Cluster gap={2}><IconButton icon="search" label="Rechercher" /><IconButton icon="settings" label="Réglages" variant="secondary" /><LinkButton href="/systeme" iconRight="arrowRight">Lien bouton</LinkButton></Cluster>
              <Text size="sm" muted>Raccourcis : <Kbd>⌘K</Kbd> <Kbd>J</Kbd> <Kbd>K</Kbd> <Kbd>T</Kbd></Text>
            </Stack>
          </Card>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="etats">
          <Heading level={2} size={3} id="etats">Pastilles, messages, états</Heading>
          <Card pad={5}>
            <Stack gap={4}>
              <Cluster gap={2}><Badge>Neutre</Badge><Badge tone="success" dot>Publiée</Badge><Badge tone="warning" dot>Brouillon</Badge><Badge tone="danger">Pas à 100 %</Badge><Badge tone="info">Groupe</Badge><Badge tone="signal">Retour</Badge><Badge tone="coach">Ton coach</Badge></Cluster>
              <Banner tone="success" title="Retour envoyé">Marine le verra dans sa boîte de réception.</Banner>
              <Banner tone="warning" title="Brouillon" action={<Button size="sm">Publier</Button>}>Camille ne voit pas encore cette séance.</Banner>
              <Banner tone="danger" title="Connexion interrompue">Ta saisie est conservée. Réessaie quand le réseau revient.</Banner>
              <Banner tone="coach">Ton bilan prend 2 minutes et aide ton coach à te préparer un programme.</Banner>
              <Divider />
              <EmptyState title="Pas de séance aujourd’hui" action={<Button>Voir le programme</Button>}>Jour de repos, ou programme pas encore publié.</EmptyState>
              <Stack gap={2}><Skeleton width="40%" height={14} /><Skeleton height={44} radius={10} /><Skeleton width="70%" /></Stack>
              <Cluster gap={3}><Avatar name="Marine Roy" /><Avatar name="Camille Laurent" size={44} /><Avatar name="Atelier Endurance" coach size={40} /><Stack gap={1} style={{ minWidth: 200 }}><Text size="sm" muted>Régularité 57 %</Text><Meter value={57} /></Stack></Cluster>
            </Stack>
          </Card>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="formulaires">
          <Heading level={2} size={3} id="formulaires">Formulaires et choix</Heading>
          <Card pad={5}><DemoInteractive /></Card>
        </Stack>

        <Stack as="section" gap={4} aria-labelledby="coachs">
          <Heading level={2} size={3} id="coachs">Couleur du coach chez l’élève</Heading>
          <Grid min={170} gap={3}>
            {ACCENTS.map(([key, label]) => (
              <div key={key} className="chrono" data-accent={key} style={{ background: 'transparent' }}>
                <Card pad={3}><Stack gap={3}><Eyebrow tone="coach">{label}</Eyebrow><Button variant="coach" block icon="play">Suivre</Button><Badge tone="coach">Aujourd’hui</Badge></Stack></Card>
              </div>
            ))}
          </Grid>
        </Stack>
      </Stack>
    </div>
  );
}
