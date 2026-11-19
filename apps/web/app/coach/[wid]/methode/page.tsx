import { notFound } from 'next/navigation';
import { LEARNING } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { methodCandidates, readCoachMethod } from '@/server/commands/coach-method';
import { MethodCandidates, MethodIdentity, MethodRules } from '@/components/coach-method';

export const metadata = { title: 'Ma méthode' };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso));

/** D-072 : ma méthode (Coach DNA). Philosophie, règles appliquées par le générateur, propositions tirées de mes corrections. */
export default async function MethodPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const view = await readCoachMethod(actor.userId, wid);
  const candidates = await methodCandidates(actor.userId, wid, view.method);
  const tz = ctx.workspace.timeZone;
  return (
    <>
      <div className="kicker">Coach DNA{view.version ? ` · version ${view.version}` : ''}</div>
      <h1>Ma méthode</h1>
      <p className="sub">Ce que le générateur doit respecter pour tous tes élèves. Les réglages faits pour un programme précis restent prioritaires. Ta méthode n’est jamais partagée avec un autre coach.</p>

      <section className="card" aria-labelledby="m-rules">
        <div className="card-head"><h2 id="m-rules">Mes règles</h2><span className="muted">Appliquées à chaque programme généré</span></div>
        <div className="card-body"><MethodRules wid={wid} version={view.version} method={view.method} /></div>
      </section>

      <section className="card" aria-labelledby="m-learn">
        <div className="card-head"><h2 id="m-learn">Appris de tes corrections</h2><span className="muted">{LEARNING.windowDays} derniers jours</span></div>
        <div className="card-body stack">
          <p className="muted">CoachOS observe tes retouches sur les programmes générés (sortie longue déplacée, VMA retirée, footing raccourci…) et les réglages que tu appliques. Une règle n’est proposée qu’avec au moins {LEARNING.minSupport} observations sur {LEARNING.minWeeks} semaines et {Math.round(LEARNING.minConcordance * 100)} % dans le même sens. Elle ne s’applique que si tu l’acceptes.</p>
          <MethodCandidates wid={wid} version={view.version} method={view.method} items={candidates} />
        </div>
      </section>

      <section className="card" aria-labelledby="m-identity">
        <div className="card-head"><h2 id="m-identity">Ma philosophie</h2></div>
        <div className="card-body"><MethodIdentity wid={wid} version={view.version} method={view.method} /></div>
      </section>

      {view.history.length ? (
        <section className="card" aria-labelledby="m-history">
          <div className="card-head"><h2 id="m-history">Historique</h2><span className="muted">Chaque changement crée une version ; les programmes déjà créés ne changent pas</span></div>
          <ol className="plain card-body method-history">
            {view.history.map((h) => <li key={h.version}><strong>Version {h.version}</strong> · {fmt(h.createdAt, tz)}{h.reason ? <span className="muted"> · {h.reason}</span> : null}</li>)}
          </ol>
        </section>
      ) : null}
    </>
  );
}
