import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { listBlockTemplates, listLibrary, listWeekTemplates } from '@/server/repo/library';
import { describeBlock, SPORT_LABELS } from '@coachos/domain';
import { ActionButton } from '@/components/portfolio-forms';
import { WeekTemplateList } from '@/components/week-template-list';
import { portfolio } from '@/server/repo/portfolio';
import { FouleeButton, LibraryBrowser, StarterButton } from '@/components/library-browser';
import { SessionsTabs, toPlanCount } from '@/components/sessions-tabs';

export const metadata = { title: 'Bibliothèque' };

/** CE-B-01 : bibliothèque de séances du coach. */
export default async function Library({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ pour?: string }> }) {
  const { wid } = await params;
  const { pour } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [items, p] = [await listLibrary(actor.userId, wid), await portfolio(actor.userId, wid, ctx.workspace.timeZone)];
  const weeks = await listWeekTemplates(actor.userId, wid);
  const myBlocks = await listBlockTemplates(actor.userId, wid);
  const athletes = p.roster.map((a) => ({ id: a.id, name: a.name, timeZone: a.timeZone }));
  return (
    <>
      <div className="head">
        <div><div className="kicker">Séances</div><h1>Bibliothèque</h1>
          <p className="sub">Tes séances prêtes à l’emploi : crée-les une fois, utilise-les pour n’importe quel élève.</p></div>
        <span className="actions">
          {!items.length ? <StarterButton wid={wid} /> : null}
          {items.filter((i) => i.meta?.source === 'foulee').length < 324 ? <FouleeButton wid={wid} /> : null}
          <Link className="btn" href={`/coach/${wid}/library/import`}>Importer mes séances</Link>
          <Link className="btn primary" href={`/coach/${wid}/library/new`}>+ Nouvelle séance</Link>
        </span>
      </div>
      <SessionsTabs wid={wid} current="library" toPlan={toPlanCount(p.roster)} />
      <section className="card">
        <LibraryBrowser wid={wid} athletes={athletes} preselect={pour} teams={p.teams.filter((t) => !t.archived && t.members > 0).map((t) => ({ id: t.id, name: t.name }))} items={items.map((i) => ({ id: i.id, revision: i.revision, category: i.category, workout: i.workout, meta: i.meta }))} />
        {!items.length ? <p className="muted foot-note">Pour démarrer, ajoute les séances de départ (fractionné, tempo, côtes, sortie longue, vélo, natation…) puis adapte-les. Tu peux aussi ajouter une séance déjà créée depuis sa page : « 📚 Ajouter à la bibliothèque ».</p> : null}
      </section>
      <section className="card" aria-labelledby="weeks-title" id="semaines">
        <div className="card-head"><h2 id="weeks-title">Semaines types</h2><span className="muted">Une semaine ou un bloc de plusieurs semaines ; s’appliquent depuis la semaine d’un élève</span></div>
        <div className="card-body"><WeekTemplateList wid={wid} items={weeks.map((w) => ({ id: w.id, revision: w.revision, title: w.title, days: w.days, weeks: w.weeks }))} /></div>
      </section>
      <section className="card" aria-labelledby="blocs-title" id="blocs">
        <div className="card-head"><h2 id="blocs-title">Mes blocs</h2><span className="muted">Parties de séance à réutiliser (échauffement type, série type…)</span></div>
        <div className="card-body">
          {myBlocks.length ? (
            <ul className="plain my-blocks">
              {myBlocks.map((b) => (
                <li key={b.id}>
                  <span><strong>{b.title}</strong> <span className="muted">· {b.sport ? SPORT_LABELS[b.sport] : 'tous les sports'} · {b.blocks.map((x) => describeBlock(x, b.sport ?? 'running')).join(' + ')}</span></span>
                  <ActionButton method="DELETE" url={`/api/v1/workspaces/${wid}/block-templates/${b.id}`} className="link-btn" confirm={`Retirer le bloc « ${b.title} » ? Les séances qui l’ont utilisé ne changent pas.`}>Retirer</ActionButton>
                </li>
              ))}
            </ul>
          ) : <p className="empty">Aucun bloc pour l’instant. Dans l’éditeur d’une séance, « 💾 Garder des blocs dans ma bibliothèque » enregistre un échauffement ou une série ; « + Mon bloc… » l’ajoute ensuite à n’importe quelle séance.</p>}
        </div>
      </section>
    </>
  );
}
