import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { aiEnabled } from '@/server/ai/settings';
import { coachContext } from '@/server/repo/context';
import { Banner, Eyebrow, Heading, Stack, Text } from '@/design';
import { AskPanel } from '@/views/coach/home/ask-panel';

export const metadata = { title: 'Demander à l’IA' };

/** IA-4 (D-192) · « Demander » en pleine page (ouverte aussi depuis la palette ⌘K). */
export default async function Assistant({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ q?: string }> }) {
  const { wid } = await params;
  const { q } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const on = await aiEnabled(actor.userId, wid);
  return (
    <Stack gap={6} className="ds-narrow-wide">
      <Stack gap={1}>
        <Eyebrow tone="coach">{ctx.workspace.name}</Eyebrow>
        <Heading level={1} size={1}>Demander à l’IA</Heading>
        <Text muted>Une question sur tes élèves, ou un brouillon : réponse à un retour, séance, tâche. L’IA lit tes données avec tes droits, sans les noms ; elle n’envoie et ne publie rien. Chaque demande repart des données.</Text>
      </Stack>
      {on ? <AskPanel wid={wid} initial={(q ?? '').slice(0, 500)} /> : <Banner tone="info" title="IA éteinte pour cet espace">Le propriétaire peut la rallumer dans Paramètres › IA.</Banner>}
    </Stack>
  );
}
