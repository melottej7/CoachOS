import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { coachContext } from '@/server/repo/context';
import { CoachDetails, CoachHeader } from '@/components/coach-card';
import { CoachSpaceForm } from '@/components/coach-space-form';
import { Notice } from '@/components/ui';

export const metadata = { title: 'Paramètres' };

/** X32 : personnaliser l’espace (D-022). Assistant après la création (first=1), puis page unique. */
export default async function Settings({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ first?: string; notice?: string }> }) {
  const { wid } = await params;
  const { first, notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  const ws = ctx ? await readWorkspacePublic(actor.userId, wid) : null;
  if (!ctx || !ws) notFound();
  const p = ws.profile;

  if (ctx.role !== 'owner') {
    return (
      <>
        <h1>Présentation de l’espace</h1>
        <p className="sub">Seul le propriétaire de l’espace peut la modifier.</p>
        <section className="card" style={{ marginTop: 18 }}><div className="card-body stack"><CoachHeader data={ws} /><CoachDetails data={ws} /></div></section>
      </>
    );
  }
  const wizard = Boolean(first);
  return (
    <>
      <Notice message={notice === 'saved' ? 'Présentation enregistrée. Tes athlètes la voient dans « Ton coach ».' : null} />
      <div className="head">
        <div>
          <div className="kicker">{ws.name}</div>
          <h1>{wizard ? 'Personnalise ton espace' : 'Paramètres de l’espace'}</h1>
          <p className="sub">{wizard ? 'Quatre étapes rapides pour te présenter à tes athlètes. Tu peux tout passer et y revenir plus tard dans Paramètres.' : 'Ce que voient tes athlètes et les personnes que tu invites.'}</p>
        </div>
      </div>
      <section className="card"><div className="card-body">
        <CoachSpaceForm
          wid={wid}
          mode={wizard ? 'wizard' : 'single'}
          after={wizard ? `/coach/${wid}/welcome?first=1` : `/coach/${wid}/settings?notice=saved`}
          initial={{
            name: ws.name, coachName: ws.coachName, logoVersion: ws.logoVersion,
            tagline: p?.tagline ?? '', bio: p?.bio ?? '', approach: p?.approach ?? '',
            experienceYears: p?.experienceYears === null || p?.experienceYears === undefined ? '' : String(p.experienceYears),
            certifications: p?.certifications ?? [], sports: p?.sports ?? [], audiences: p?.audiences ?? [], goals: p?.goals ?? [],
            city: p?.city ?? '', languages: p?.languages ?? [], websiteUrl: p?.websiteUrl ?? '', socialUrl: p?.socialUrl ?? '',
            contactEmail: p?.contactEmail ?? '', accent: p?.accent ?? 'emerald',
          }}
        />
      </div></section>
    </>
  );
}
