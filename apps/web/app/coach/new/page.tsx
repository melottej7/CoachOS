import { requireActor } from '@/server/auth/session';
import { Card, Cluster, Heading, LinkButton, PublicShell, Stack, Text } from '@/design';
import { WorkspaceForm } from '@/views/account/workspace-form';

export const metadata = { title: 'Créer un espace' };

/** X04, refonte Chrono (D-156) : nom et fuseau. Ensuite : l’assistant de présentation, puis inviter un élève. */
export default async function NewWorkspace() {
  const actor = await requireActor();
  const zones = Intl.supportedValuesOf('timeZone');
  return (
    <PublicShell home="/choose-workspace" aside={<LinkButton href="/profile" variant="ghost" size="sm" icon="user">Mon compte</LinkButton>}>
      <Stack gap={6}>
        <Cluster><LinkButton href="/choose-workspace" variant="ghost" size="sm" icon="chevronLeft">Mes espaces</LinkButton></Cluster>
        <Stack gap={1}>
          <Heading level={1} size={1}>Créer ton espace coach</Heading>
          <Text muted>Ton espace regroupe tes élèves, leurs séances et leurs retours.</Text>
        </Stack>
        <Card pad={5}>
          <WorkspaceForm zones={zones} currentName={actor.displayName} defaultZone={zones.includes('Europe/Brussels') ? 'Europe/Brussels' : 'UTC'} />
        </Card>
      </Stack>
    </PublicShell>
  );
}
