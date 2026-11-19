import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamRecipients } from '@/server/repo/group-sessions';
import { readTemplate } from '@/server/repo/library';
import { GroupSessionForm } from '@/components/group-session-form';

export const metadata = { title: 'Séance pour un groupe' };

/** CE-G2-01 : préparer une séance pour un groupe (base commune, destinataires exacts). */
export default async function NewGroupSession({ params, searchParams }: { params: Promise<{ wid: string; tid: string }>; searchParams: Promise<{ modele?: string; date?: string }> }) {
  const { wid, tid } = await params;
  const { modele, date } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const team = await teamRecipients(actor.userId, wid, tid);
  if (!team) notFound();
  const tpl = modele && isUuid(modele) ? await readTemplate(actor.userId, wid, modele) : null;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : addDays(todayIn(ctx.workspace.timeZone), 1);
  return (
    <>
      <Link className="back" href={`/coach/${wid}/group-sessions`}>← Séances de groupe</Link>
      <div className="kicker">Groupe · {team.name}</div>
      <h1>Séance pour le groupe</h1>
      <p className="sub">{tpl ? `À partir de « ${tpl.workout.title} ». ` : ''}Un brouillon par élève : tu pourras adapter chaque séance avant de publier.</p>
      {team.members.length ? (
        <section className="card"><div className="card-body">
          <GroupSessionForm wid={wid} teamId={tid} teamName={team.name} members={team.members.map((m) => ({ id: m.id, name: m.name, state: m.state }))} date={day} initial={tpl?.workout} />
        </div></section>
      ) : <p className="empty">Ce groupe n’a pas encore d’élève que tu suis. <Link href={`/coach/${wid}/athletes?team=${tid}`}>Ajouter des élèves</Link>.</p>}
    </>
  );
}
