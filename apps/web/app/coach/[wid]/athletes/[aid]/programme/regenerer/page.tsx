import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, DAY_LABELS, describeTweaks, formatShortDate, parseTweaksParam, PROGRAM_PHASE_LABELS, PROTECT_LABELS, weekIndexOf, WEEKDAY_SHORT, type RegenItem } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { buildRegeneration, regenContext, seenOf } from '@/server/commands/programs';
import { ProgramRegenerate } from '@/components/program-regenerate';
import { AiTweaks, TweaksBanner } from '@/components/ai-tweaks';
import { aiSource } from '@/server/commands/ai';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Régénérer le programme' };

const RISK_MARK = { watch: '•', risk: '!', block: '✕' } as const;
const dowOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const day = (d: string) => `${WEEKDAY_SHORT[dowOf(d)]} ${formatShortDate(d)}`;

function Item({ it }: { it: RegenItem }) {
  const pub = 'before' in it && it.before.published && (it.kind === 'changed' || it.kind === 'removed')
    ? <span className="muted"> · publiée : l’élève garde l’ancienne version jusqu’à ta republication</span> : null;
  switch (it.kind) {
    case 'kept':
      return <li className="rg kept"><span className="rg-mark" aria-hidden="true">🔒</span><span><span className="muted">{day(it.date)}</span> {it.before.title}
        <span className="muted"> · gardée ({PROTECT_LABELS[it.reason]}){it.dropped ? ` ; « ${it.dropped} » n’est pas ajoutée ce jour-là` : ''}</span></span></li>;
    case 'same':
      return <li className="rg same"><span className="rg-mark" aria-hidden="true">=</span><span><span className="muted">{day(it.date)}</span> {it.before.title} <span className="muted">· inchangée</span></span></li>;
    case 'changed':
      return <li className="rg changed"><span className="rg-mark" aria-hidden="true">✎</span><span><span className="muted">{day(it.date)}</span> {it.before.title === it.after.title
        ? <>{it.after.title} <span className="muted">· {it.before.minutes && it.after.minutes && it.before.minutes !== it.after.minutes ? `${it.before.minutes}′ → ${it.after.minutes}′` : 'contenu ajusté'}</span></>
        : <><s>{it.before.title}</s> → <strong>{it.after.title}</strong></>}{it.after.source === 'library' ? ' 📚' : ''}{pub}</span></li>;
    case 'added':
      return <li className="rg added"><span className="rg-mark" aria-hidden="true">+</span><span><span className="muted">{day(it.date)}</span> <strong>{it.after.title}</strong>{it.after.source === 'library' ? ' 📚' : ''} <span className="muted">· ajoutée</span></span></li>;
    case 'removed':
      return <li className="rg removed"><span className="rg-mark" aria-hidden="true">−</span><span><span className="muted">{day(it.date)}</span> <s>{it.before.title}</s> <span className="muted">· retirée</span>{pub}</span></li>;
  }
}

/**
 * D-063 (CE-P-06) : régénérer seulement les semaines demandées d’un programme généré. Différences avant d’appliquer ;
 * séances passées, réalisées ou retouchées gardées. Paramètres en adresse : rien n’est modifié avant « Appliquer ».
 */
export default async function RegeneratePage({ params, searchParams }: {
  params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ plan?: string; de?: string; a?: string; jours?: string | string[]; reglages?: string; ia?: string }>;
}) {
  const { wid, aid } = await params;
  const sp = await searchParams;
  if (!isUuid(aid) || !sp.plan || !isUuid(sp.plan)) notFound();
  const actor = await requireActor();
  const rc = await regenContext(actor.userId, wid, aid, sp.plan);
  if (!rc) notFound();
  const { ctx, plan } = rc;
  const back = `/coach/${wid}/athletes/${aid}/programme?objectif=${ctx.goal.id}`;
  if (!ctx.feasibility) notFound();
  const raw = Array.isArray(sp.jours) ? sp.jours : sp.jours ? sp.jours.split(',') : null;
  const days = raw ? [...new Set(raw.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : plan.days;
  // D-071 : réglages de l’adresse (proposés par l’IA ou retirés), sinon ceux du programme.
  const tweaks = sp.reglages !== undefined ? parseTweaksParam(sp.reglages) : plan.tweaks;
  const suggestionId = sp.reglages !== undefined && sp.ia && isUuid(sp.ia) ? sp.ia : null;
  const probe = buildRegeneration(rc, days.length >= 2 ? days : plan.days, 1, 60, tweaks)!;
  const total = probe.weekCount;
  const idx = weekIndexOf(plan.startMonday, ctx.today);
  const current = idx >= 1 && idx <= total ? idx : null;
  const from = Math.min(total, Math.max(1, Number(sp.de) || current || 1));
  const to = Math.min(total, Math.max(from, Number(sp.a) || total));
  const built = days.length >= 2 ? buildRegeneration(rc, days, from, to, tweaks) : null;
  const here = `/coach/${wid}/athletes/${aid}/programme/regenerer?plan=${plan.id}&de=${from}&a=${to}${days.map((x) => `&jours=${x}`).join('')}${sp.reglages !== undefined && tweaks ? `&reglages=${encodeURIComponent(JSON.stringify(tweaks))}` : ''}${suggestionId ? `&ia=${suggestionId}` : ''}`;
  const weeks = Array.from({ length: total }, (_, i) => i + 1);
  const label = (n: number) => `Semaine ${n} · ${formatShortDate(addDays(plan.startMonday, (n - 1) * 7))}${n === current ? ' (en cours)' : ''}`;

  return (
    <>
      <Link className="back" href={back}>← Programme de {ctx.athlete.name}</Link>
      <div className="kicker">Régénérer · {ctx.athlete.name}</div>
      <h1>{ctx.goal.title}</h1>
      <p className="sub">
        Choisis les semaines à refaire et les jours. Le programme est recalculé avec ta décision actuelle sur l’objectif et ta bibliothèque, depuis le même départ.
        Les séances passées, réalisées par {ctx.athlete.name.split(' ')[0]} ou retouchées par toi sont gardées. Rien n’est modifié avant « Appliquer ».
      </p>

      <form className="card prog-params" method="get">
        <input type="hidden" name="plan" value={plan.id} />
        {sp.reglages !== undefined && tweaks ? <input type="hidden" name="reglages" value={JSON.stringify(tweaks)} /> : null}
        {suggestionId ? <input type="hidden" name="ia" value={suggestionId} /> : null}
        <div className="card-body form-row">
          <label className="field"><span>De</span>
            <select name="de" defaultValue={from} aria-label="Première semaine à régénérer">{weeks.map((n) => <option key={n} value={n}>{label(n)}</option>)}</select></label>
          <label className="field"><span>À</span>
            <select name="a" defaultValue={to} aria-label="Dernière semaine à régénérer">{weeks.map((n) => <option key={n} value={n}>{label(n)}</option>)}</select></label>
          <fieldset className="field prog-days"><legend>Jours d’entraînement</legend>
            {WEEKDAY_SHORT.map((l, i) => (
              <label key={l} className="check"><input type="checkbox" name="jours" value={i + 1} defaultChecked={days.includes(i + 1)} /> {l}</label>
            ))}
          </fieldset>
          <div className="actions"><button className="btn" type="submit">Voir les différences</button></div>
        </div>
      </form>

      {built ? <TweaksBanner lines={tweaks ? describeTweaks(tweaks, DAY_LABELS) : []} href={here} suggestionId={suggestionId} /> : null}
      {built ? <AiTweaks wid={wid} aid={aid} goalId={ctx.goal.id} days={days} tweaks={tweaks} href={here} first={ctx.athlete.name.split(' ')[0] ?? ctx.athlete.name} source={aiSource()} /> : null}

      {!built ? <p className="banner warn">Choisis au moins 2 jours d’entraînement.</p> : (
        <>
          <section className="card" aria-labelledby="rg-sum">
            <div className="card-head"><h2 id="rg-sum">{from === to ? `Semaine ${from}` : `Semaines ${from} à ${to}`}</h2></div>
            <div className="card-body stack">
              <p>
                <strong>{built.regen.counts.changed}</strong> modifiée{built.regen.counts.changed > 1 ? 's' : ''} · <strong>{built.regen.counts.added}</strong> ajoutée{built.regen.counts.added > 1 ? 's' : ''} · <strong>{built.regen.counts.removed}</strong> retirée{built.regen.counts.removed > 1 ? 's' : ''}
                <span className="muted"> · {built.regen.counts.kept} gardée{built.regen.counts.kept > 1 ? 's' : ''}, {built.regen.counts.same} inchangée{built.regen.counts.same > 1 ? 's' : ''}</span>
              </p>
              {built.program.risks.length ? (
                <div className="prog-risks" role="note">
                  <p><strong>Risques signalés</strong> — à toi de décider.</p>
                  <ul className="plain">{built.program.risks.map((r, i) => <li key={i} className={`fz-c ${r.level}`}><span className="fz-mark" aria-hidden="true">{RISK_MARK[r.level]}</span><span>{r.text}</span></li>)}</ul>
                </div>
              ) : null}
              <ProgramRegenerate wid={wid} aid={aid} planId={plan.id} fromWeek={from} toWeek={to} days={days} seen={seenOf(built.regen)} tweaks={tweaks} suggestionId={suggestionId}
                counts={built.regen.counts} needsAccept={built.program.risks.some((r) => r.level !== 'watch')} validated={Boolean(ctx.decision)}
                calendarHref={`/coach/${wid}/calendar?athlete=${aid}&week=${addDays(plan.startMonday, (from - 1) * 7)}&notice=regenerated`} />
            </div>
          </section>

          <section className="card" aria-labelledby="rg-weeks">
            <div className="card-head"><h2 id="rg-weeks">Différences semaine par semaine</h2></div>
            <ol className="plain prog-weeks card-body">
              {built.regen.weeks.map((w) => (
                <li key={w.index} className="prog-week">
                  <p className="prog-week-head"><strong>S{w.index}</strong> · {formatShortDate(w.monday)}
                    {w.phase ? <> · <Pill tone={w.phase === 'tremplin' ? 'neutral' : w.phase === 'recuperation' || w.phase === 'affutage' ? 'attn' : ''}>{PROGRAM_PHASE_LABELS[w.phase]}</Pill></> : null}</p>
                  {w.items.length ? <ul className="plain rg-list">{w.items.map((it, i) => <Item key={i} it={it} />)}</ul> : <p className="muted">Aucune séance.</p>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
