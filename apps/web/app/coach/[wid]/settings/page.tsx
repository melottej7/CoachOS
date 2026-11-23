import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { coachContext } from '@/server/repo/context';
import { CoachDetails, CoachHeader } from '@/components/coach-card';
import { CoachSpaceForm } from '@/components/coach-space-form';
import { Notice, SignOutButton } from '@/components/ui';
import { RuleSettingsForm } from '@/components/rule-settings-form';
import { autoRuleSettings } from '@/server/repo/portfolio';
import { aiMonth, aiSource } from '@/server/commands/ai';
import { formatUsd } from '@coachos/domain';
import { readRelanceTemplates } from '@/server/commands/relance-templates';
import { RelanceTemplatesForm } from '@/components/relance-templates-form';
import { listMyPrivacyRequests } from '@/server/commands/privacy';
import { PrivacyPanel } from '@/components/privacy-panel';

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
  const rules = await autoRuleSettings(actor.userId, wid);
  // CE-H-04 (D-045) : réglage personnel de chaque coach, propriétaire ou non.
  const mine = await readRelanceTemplates(actor.userId, wid);
  const requests = await listMyPrivacyRequests(actor.userId, wid);
  const followUps = (
    <>
      <section className="card" style={{ marginTop: 18 }} aria-labelledby="suivis" id="suivis">
        <div className="card-head"><h2 id="suivis">Suivis automatiques</h2></div>
        <div className="card-body stack">
          <p className="muted">Ce qui apparaît tout seul dans ton Planning, et quand. Décoche ce qui ne te sert pas ; pour un seul élève, utilise plutôt « Plus tard » sur la tâche.</p>
          <RuleSettingsForm wid={wid} initial={rules} />
        </div>
      </section>
      {/* D-104 : modèles de relance personnels (chaque coach, propriétaire ou non). */}
      <section className="card" style={{ marginTop: 18 }} aria-labelledby="mes-relances" id="relances">
        <div className="card-head"><h2 id="mes-relances">Mes relances</h2></div>
        <div className="card-body"><RelanceTemplatesForm wid={wid} mine={mine} /></div>
      </section>
    </>
  );

  if (ctx.role !== 'owner') {
    return (
      <>
        <h1>Présentation de l’espace</h1>
        <p className="sub">Seul le propriétaire de l’espace peut la modifier.</p>
        <section className="card" style={{ marginTop: 18 }}><div className="card-body stack"><CoachHeader data={ws} /><CoachDetails data={ws} /></div></section>
        {followUps}
      </>
    );
  }
  const wizard = Boolean(first);
  // D-081 : consommation de l’IA du mois, pour le propriétaire (c’est lui qui paie le compte Anthropic).
  const ai = await aiMonth(actor.userId, wid);
  const source = aiSource();
  const pct = ai.budgetMicros ? Math.min(100, Math.round((ai.spentMicros / ai.budgetMicros) * 100)) : 100;
  const aiCard = (
    <section className="card" style={{ marginTop: 18 }} aria-labelledby="ia-mois" id="ia">
      <div className="card-head"><h2 id="ia-mois">IA ce mois-ci</h2><span className="muted">{source === 'claude' ? 'Claude actif' : 'IA simulée (aucun coût)'}</span></div>
      <div className="card-body stack">
        <p><strong>{ai.calls}</strong> proposition{ai.calls > 1 ? 's' : ''} « Ajuster avec l’IA »{ai.claudeCalls !== ai.calls ? <span className="muted"> (dont {ai.claudeCalls} par Claude)</span> : null} · coût réel <strong>{formatUsd(ai.spentMicros)}</strong> sur un budget de {formatUsd(ai.budgetMicros)}.</p>
        <div className="ai-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Part du budget IA utilisée"><span style={{ width: `${pct}%` }} /></div>
        <p className="muted">Arrivé au budget, l’IA s’arrête jusqu’au mois suivant ; tout reste faisable à la main. Le budget se règle sur le serveur (COACHOS_AI_MONTHLY_BUDGET_USD). Les coûts viennent des jetons facturés par Anthropic à chaque appel.</p>
      </div>
    </section>
  );
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
          after={wizard ? `/coach/${wid}/planning?tour=start` : `/coach/${wid}/settings?notice=saved`}
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
      {wizard ? null : followUps}
      {wizard ? null : aiCard}
      {wizard ? null : <PrivacyPanel wid={wid} role="coach" owner={ctx.role === 'owner'} requests={requests} />}
      {wizard ? null : <div className="mobile-only" style={{ marginTop: 18 }}><SignOutButton className="btn" /></div>}
    </>
  );
}
