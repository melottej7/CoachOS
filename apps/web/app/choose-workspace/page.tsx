import { redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { listWorkspaces, type WorkspaceSummary } from '@/server/repo/context';
import { Avatar, Card, Heading, LinkButton, LinkList, LinkListItem, PublicShell, Stack, Text } from '@/design';

export const metadata = { title: 'Choisir un espace' };

const ROLE: Record<WorkspaceSummary['role'], string> = { owner: 'Coach propriétaire', coach: 'Coach', athlete: 'Élève' };
const home = (w: WorkspaceSummary) => (w.role === 'athlete' ? `/athlete/${w.id}/today` : `/coach/${w.id}/planning`);

/** X05, refonte Chrono (D-156) : relation et rôle. Une seule relation : ouverture directe. */
export default async function ChooseWorkspace() {
  const actor = await requireActor();
  const spaces = await listWorkspaces(actor.userId);
  if (spaces.length === 1) redirect(home(spaces[0]!));
  return (
    <PublicShell home="/choose-workspace" aside={<LinkButton href="/profile" variant="ghost" size="sm" icon="user">Mon compte</LinkButton>}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1} size={1}>{spaces.length ? 'Choisir un espace' : 'Bienvenue'}</Heading>
          <Text muted>Connecté·e en tant que <strong>{actor.displayName}</strong>.</Text>
        </Stack>
        {spaces.length ? (
          <>
            <LinkList label="Mes espaces">
              {spaces.map((w) => (
                <LinkListItem key={w.id} href={home(w)} leading={<Avatar name={w.name} coach={w.role !== 'athlete'} size={40} />} title={w.name} meta={ROLE[w.role]} />
              ))}
            </LinkList>
            <div><LinkButton href="/coach/new" icon="plus">Créer un autre espace de coaching</LinkButton></div>
          </>
        ) : (
          <>
            <Card pad={5}>
              <Stack gap={3}>
                <Heading level={2} size={3}>Tu es coach ? Crée ton espace</Heading>
                <Text>Ton espace, c’est ton activité dans CoachOS, comme ton club ou ta structure : tes élèves, leurs séances, ta bibliothèque, les retours, les messages et ta présentation. Tu y invites ensuite tes élèves.</Text>
                <div><LinkButton href="/coach/new" variant="primary" icon="plus">Créer mon espace de coaching</LinkButton></div>
              </Stack>
            </Card>
            <Card pad={5} tinted>
              <Stack gap={2}>
                <Text strong>Tu es élève ?</Text>
                <Text size="sm" muted>Tu n’as rien à créer : ouvre le lien d’invitation de ton coach (e-mail, SMS ou WhatsApp) et touche « Rejoindre l’espace ».</Text>
              </Stack>
            </Card>
          </>
        )}
      </Stack>
    </PublicShell>
  );
}
