import { notFound } from 'next/navigation';
import { describeBlock, fouleeOutdated, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listBlockTemplates, listLibrary, listWeekTemplates } from '@/server/repo/library';
import { portfolio } from '@/server/repo/portfolio';
import { Cluster, Heading, LinkButton, Stack, Text } from '@/design';
import { ActionButton } from '@/views/coach/action-button';
import { FouleeButton, LibraryBrowser, StarterButton } from '@/views/coach/library/library-browser';
import { WeekTemplateList } from '@/views/coach/library/week-templates';
import s from '@/views/coach/library/library.module.css';

export const metadata = { title: 'Séances types' };

/** CE-B-01, refonte Chrono (D-154) : séances types, semaines types et blocs du coach, à réutiliser pour tous ses élèves. */
export default async function Library({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ pour?: string }> }) {
  const { wid } = await params;
  const { pour } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, p, weeks, myBlocks] = await Promise.all([
    listLibrary(actor.userId, wid),
    portfolio(actor.userId, wid, ctx.workspace.timeZone),
    listWeekTemplates(actor.userId, wid),
    listBlockTemplates(actor.userId, wid),
  ]);
  const athletes = p.roster.map((a) => ({ id: a.id, name: a.name, timeZone: a.timeZone }));
  // D-093 : fractions courtes Foulée encore en Z7 (import antérieur, non modifiées par le coach).
  const foulee = items.filter((i) => i.meta?.source === 'foulee');
  const outdated = fouleeOutdated(foulee.map((i) => ({ title: i.workout.title, intervals: i.workout.intervals })));
  return (
    <Stack gap={8}>
      <Cluster between gap={3} align="end">
        <Stack gap={1}>
          <Heading level={1} size={1}>Séances types</Heading>
          <Text muted>Crée une séance une fois, utilise-la pour n’importe quel élève.</Text>
        </Stack>
        <Cluster gap={2}>
          {!items.length ? <StarterButton wid={wid} /> : null}
          {ctx.modules.endurance && (foulee.length < 324 || outdated) ? <FouleeButton wid={wid} outdated={outdated} /> : null}
          <LinkButton href={`/coach/${wid}/library/import`} icon="upload">Importer</LinkButton>
          <LinkButton href={`/coach/${wid}/library/new`} variant="primary" icon="plus">Nouvelle séance</LinkButton>
        </Cluster>
      </Cluster>

      <Stack as="section" gap={3} aria-label="Séances">
        <LibraryBrowser wid={wid} athletes={athletes} preselect={pour}
          teams={p.teams.filter((t) => !t.archived && t.members > 0).map((t) => ({ id: t.id, name: t.name }))}
          items={items.map((i) => ({ id: i.id, revision: i.revision, category: i.category, workout: i.workout, meta: i.meta }))} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="weeks-title" id="semaines">
        <Stack gap={1}>
          <Heading level={2} size={3} id="weeks-title">Semaines types</Heading>
          <Text size="sm" muted>Une semaine ou un programme de plusieurs semaines ; s’applique depuis la semaine d’un élève, en brouillons.</Text>
        </Stack>
        <WeekTemplateList wid={wid} items={weeks.map((w) => ({ id: w.id, revision: w.revision, title: w.title, days: w.days, weeks: w.weeks, notes: w.notes }))} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="blocs-title" id="blocs">
        <Stack gap={1}>
          <Heading level={2} size={3} id="blocs-title">Mes blocs</Heading>
          <Text size="sm" muted>Parties de séance à réutiliser : échauffement type, série type…</Text>
        </Stack>
        {myBlocks.length ? (
          <ul className={s.list}>
            {myBlocks.map((b) => (
              <li key={b.id} className={s.row}>
                <div className={s.rowMain}>
                  <Text strong>{b.title}</Text>
                  <Text size="sm" muted>{b.sport ? SPORT_LABELS[b.sport] : 'Tous les sports'} · {b.blocks.map((x) => describeBlock(x, b.sport ?? 'running')).join(' + ')}</Text>
                </div>
                <Cluster gap={2}>
                  <ActionButton method="DELETE" url={`/api/v1/workspaces/${wid}/block-templates/${b.id}`} icon="trash" label={`Retirer le bloc « ${b.title} »`}
                    confirm={`Retirer le bloc « ${b.title} » ? Les séances qui l’ont utilisé ne changent pas.`}>Retirer</ActionButton>
                </Cluster>
              </li>
            ))}
          </ul>
        ) : <Text muted>Aucun bloc pour l’instant. Dans l’éditeur d’une séance, « Ajouter des blocs à ma bibliothèque » enregistre un échauffement ou une série ; « Mon bloc… » l’ajoute ensuite à n’importe quelle séance.</Text>}
      </Stack>
    </Stack>
  );
}
