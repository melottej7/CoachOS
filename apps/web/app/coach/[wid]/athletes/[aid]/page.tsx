import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { DAY_LABELS, EXPERIENCE_LABELS, formatLongDate, LEVEL_LABELS, SPORT_LABELS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS_LABELS } from '@coachos/domain';
import { readAthleteProfile } from '@/server/commands/athlete-profile';
import { latestInvitation } from '@/server/commands/invitations';
import { listAssignedAthletes } from '@/server/repo/coach';
import { coachContext } from '@/server/repo/context';
import { Notice, Pill } from '@/components/ui';
import { ResendInvitation, RevokeInvitation } from '@/components/roster-forms';

export const metadata = { title: 'Athlète' };

const NOTICES: Record<string, string> = {
  created: 'Fiche créée. Envoie l’invitation quand tu as l’adresse e-mail.',
  invited: 'Invitation envoyée. Le lien précédent, s’il existait, ne fonctionne plus.',
  revoked: 'Invitation annulée. Le lien ne permet plus de rejoindre l’espace.',
};

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeZone: tz }).format(new Date(iso));

/** X14 (version minimale) : état du dossier et de l’invitation. */
export default async function AthletePage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid, aid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  const athlete = ctx ? (await listAssignedAthletes(actor.userId, wid)).find((a) => a.id === aid) : undefined;
  if (!ctx || !athlete) notFound();
  const inv = athlete.state === 'invited' ? await latestInvitation(actor.userId, wid, aid) : null;
  const profile = athlete.state === 'active' ? await readAthleteProfile(actor.userId, wid, aid) : null;
  const tz = ctx.workspace.timeZone;
  const first = athlete.displayName.split(' ')[0];
  return (
    <>
      <Link className="back" href={`/coach/${wid}/athletes`}>← Athlètes</Link>
      <Notice message={notice ? NOTICES[notice] ?? null : null} />
      <div className="head">
        <div>
          <div className="kicker">Dossier · {athlete.timeZone}</div>
          <h1>{athlete.displayName}</h1>
          <p className="sub">{athlete.state === 'active' ? <Pill>A rejoint l’espace</Pill> : <Pill tone="neutral">Invité·e, pas encore connecté·e</Pill>}</p>
        </div>
        <Link className="btn primary" href={`/coach/${wid}/calendar?athlete=${aid}`}>Ouvrir le planning</Link>
      </div>

      {athlete.state === 'active' ? (
        <section className="card" aria-labelledby="profile-title">
          <div className="card-head"><h2 id="profile-title">Profil sportif</h2><Pill tone="neutral">Déclaré par {first}</Pill></div>
          {profile ? (
            <div className="card-body stack">
              <dl className="details">
                <div><dt>Sport</dt><dd>{SPORT_LABELS[profile.sport]}</dd></div>
                <div><dt>Niveau</dt><dd>{LEVEL_LABELS[profile.level].label}</dd></div>
                <div><dt>Pratique depuis</dt><dd>{EXPERIENCE_LABELS[profile.experience]}</dd></div>
                <div><dt>Séances / semaine</dt><dd>{WEEKLY_SESSIONS_LABELS[profile.weeklySessions]}</dd></div>
                <div><dt>Volume / semaine</dt><dd>{profile.weeklyHours ? WEEKLY_HOURS_LABELS[profile.weeklyHours] : 'Non précisé'}</dd></div>
                <div><dt>Jours disponibles</dt><dd>{profile.availableDays.length ? profile.availableDays.map((d) => DAY_LABELS[d - 1]).join(' ') : 'Non précisés'}</dd></div>
              </dl>
              <div>
                <h3>Objectif</h3>
                <p className="prose">{profile.mainGoal ?? 'Non précisé.'}</p>
              </div>
              {profile.nextEventName || profile.nextEventDate ? (
                <p><strong>Prochaine course :</strong> {profile.nextEventName ?? 'Sans nom'}{profile.nextEventDate ? `, ${formatLongDate(profile.nextEventDate).toLowerCase()}` : ''}</p>
              ) : null}
              <p className="muted">Mis à jour le {fmt(profile.updatedAt, tz)}. Ce profil ne contient aucune donnée de santé.</p>
            </div>
          ) : (
            <p className="empty">{first} n’a pas encore rempli son profil sportif.</p>
          )}
        </section>
      ) : null}

      {athlete.state === 'invited' ? (
        <section className="card" aria-labelledby="inv-title">
          <div className="card-head"><h2 id="inv-title">Invitation</h2></div>
          <div className="card-body stack">
            {!inv ? <p>Aucune invitation envoyée pour l’instant.</p> : null}
            {inv?.state === 'pending' ? <p>Envoyée le {fmt(inv.createdAt, tz)}, valable jusqu’au {fmt(inv.expiresAt, tz)}. {first} doit se connecter avec l’adresse qui l’a reçue.</p> : null}
            {inv?.state === 'expired' ? <p className="banner warn">Le dernier lien a expiré le {fmt(inv.expiresAt, tz)}. Envoie-en un nouveau.</p> : null}
            {inv?.state === 'revoked' ? <p>Le dernier lien a été annulé.</p> : null}
            <p className="muted">Tu peux préparer et publier des séances dès maintenant : {first} les verra en rejoignant l’espace.</p>
            <h3>{inv ? 'Envoyer un nouveau lien' : 'Envoyer l’invitation'}</h3>
            <ResendInvitation wid={wid} aid={aid} label={inv ? 'Renvoyer l’invitation' : 'Envoyer l’invitation'} />
            {inv?.state === 'pending' && ctx.role === 'owner' ? <RevokeInvitation wid={wid} aid={aid} iid={inv.id} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
