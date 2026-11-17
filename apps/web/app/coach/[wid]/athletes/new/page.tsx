import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { AthleteForm } from '@/components/roster-forms';

export const metadata = { title: 'Ajouter un athlète' };

/** X13 : identité, fuseau et adresse d’invitation. */
export default async function NewAthlete({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string }> }) {
  const { wid } = await params;
  const { first } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  if (ctx.role !== 'owner') {
    return (<><h1>Ajouter un athlète</h1><p className="sub">Seul le propriétaire de l’espace peut ajouter des athlètes.</p></>);
  }
  return (
    <>
      <Link className="back" href={`/coach/${wid}/athletes`}>← Athlètes</Link>
      {first ? <p className="banner ok" role="status" style={{ marginBottom: 16 }}>Ton espace « {ctx.workspace.name} » est prêt. Ajoute ton premier athlète.</p> : null}
      <div className="head"><div><div className="kicker">{ctx.workspace.name}</div><h1>Ajouter un athlète</h1>
        <p className="sub">L’athlète reçoit un lien personnel par e-mail, valable 7 jours. Il rejoint ton espace en se connectant avec cette adresse.</p></div></div>
      <section className="card"><div className="card-body">
        <AthleteForm wid={wid} zones={Intl.supportedValuesOf('timeZone')} defaultZone={ctx.workspace.timeZone} />
      </div></section>
    </>
  );
}
