import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, DAY_LABELS, programBlocks, weekDelta, describeTweaks, formatClock, formatLongDate, formatShortDate, isLocalDate, parseTweaksParam, PROGRAM_PHASE_LABELS, weekStart, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { buildProgram, existingInPeriod, nextMonday, programContext, readGoalPlans } from '@/server/commands/programs';
import { ProgramCreate } from '@/components/program-create';
import { AiTweaks, TweaksBanner } from '@/components/ai-tweaks';
import { aiSource } from '@/server/commands/ai';
import { Pill } from '@/components/ui';
import { ProgramChart } from '@/components/program-chart';

export const metadata = { title: 'Programme' };

const h = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);
const RISK_MARK = { watch: '•', risk: '!', block: '✕' } as const;
const WEEKDAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
const KIND_LABEL = { easy: 'Facile', long: 'Longue', quality: 'Qualité', race: 'Course' } as const;
/** D-106 : nom et but de chaque bloc. */
const BLOCK_TITLE = { tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée', affutage: 'Affûtage' } as const;
const BLOCK_AIM = {
  tremplin: 'Reprendre la régularité depuis ce qui est fait aujourd’hui, sans à-coup.',
  developpement: 'La charge monte, puis une semaine allégée pour assimiler.',
  recuperation: 'Moins de volume pour assimiler.',
  affutage: 'Moins de volume, un rappel d’allure : arriver frais le jour J.',
} as const;

/**
 * D-061 : générateur de programme. À la hauteur de l’objectif validé, 4 semaines de tremplin, risques signalés au coach
 * qui décide. Paramètres en adresse (rien n’est enregistré avant « Créer »).
 */
export default async function ProgramPage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ objectif?: string; debut?: string; jours?: string | string[]; reglages?: string; ia?: string }> }) {
  const { wid, aid } = await params;
  const sp = await searchParams;
  if (!isUuid(aid) || !sp.objectif || !isUuid(sp.objectif)) notFound();
  const actor = await requireActor();
  const ctx = await programContext(actor.userId, wid, aid, sp.objectif);
  if (!ctx) notFound();
  const first = ctx.athlete.name.split(' ')[0] ?? ctx.athlete.name;
  const back = `/coach/${wid}/athletes/${aid}`;
  if (!ctx.feasibility) {
    return (<><Link className="back" href={`${back}#bilan`}>← Fiche de {ctx.athlete.name}</Link><h1>Programme</h1>
      <p className="banner warn">Le générateur a besoin du bilan de {first} (pratique actuelle, disponibilités). Remplis-le avec {first} en entretien.</p></>);
  }
  const start = sp.debut && isLocalDate(sp.debut) ? weekStart(sp.debut) : nextMonday(ctx.today);
  const raw = Array.isArray(sp.jours) ? sp.jours : sp.jours ? sp.jours.split(',') : null;
  const days = raw ? [...new Set(raw.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : ctx.defaultDays;
  // D-071 : réglages proposés par l’IA (ou retirés) ; la proposition reste tracée par son identifiant.
  const tweaks = parseTweaksParam(sp.reglages);
  const suggestionId = tweaks && sp.ia && isUuid(sp.ia) ? sp.ia : null;
  const program = days.length >= 2 ? buildProgram(ctx, start, days, tweaks) : null;
  const here = `/coach/${wid}/athletes/${aid}/programme?objectif=${ctx.goal.id}&debut=${start}${days.map((x) => `&jours=${x}`).join('')}${tweaks ? `&reglages=${encodeURIComponent(JSON.stringify(tweaks))}` : ''}${suggestionId ? `&ia=${suggestionId}` : ''}`;
  const total = program ? program.weeks.reduce((n, w) => n + w.sessions.length, 0) : 0;
  const fromLib = program ? program.weeks.reduce((n, w) => n + w.sessions.filter((s) => s.source === 'library').length, 0) : 0;
  const existing = program ? await existingInPeriod(actor.userId, wid, aid, start, ctx.feasibility.eventDate) : 0;
  const d = ctx.decision?.params;
  const plans = await readGoalPlans(actor.userId, wid, aid, ctx.goal.id);

  const eventDate = ctx.feasibility.eventDate;
  const dayNames = days.map((x) => WEEKDAY_SHORT[x - 1]).join(', ');
  const longest = program ? Math.max(...program.weeks.map((w) => w.longMinutes ?? 0)) : 0;

  // D-101 : le programme d’abord (aperçu, semaines), puis les risques et la création, les réglages repliés en bas.
  const adjust = (
    <details className="card prog-adjust" id="ajuster" open={!program || Boolean(tweaks)}>
      <summary><span className="prog-adjust-title">⚙️ Ajuster le programme</span> <span className="muted">Premier lundi, jours, ta méthode, demande à l’IA</span></summary>
      <form className="prog-params" method="get">
        <input type="hidden" name="objectif" value={ctx.goal.id} />
        {tweaks ? <input type="hidden" name="reglages" value={JSON.stringify(tweaks)} /> : null}
        {suggestionId ? <input type="hidden" name="ia" value={suggestionId} /> : null}
        <div className="form-row">
          <label className="field"><span>Premier lundi</span><input type="date" name="debut" defaultValue={start} min={weekStart(ctx.today)} aria-label="Premier lundi du programme" /></label>
          <fieldset className="field prog-days"><legend>Jours d’entraînement</legend>
            {WEEKDAY_SHORT.map((label, i) => (
              <label key={label} className="check"><input type="checkbox" name="jours" value={i + 1} defaultChecked={days.includes(i + 1)} /> {label}</label>
            ))}
          </fieldset>
          <div className="actions"><button className="btn" type="submit">Recalculer</button></div>
        </div>
      </form>
      {ctx.methodLines.length ? (
        <p className="prog-method"><span><strong>Ta méthode s’applique :</strong> {ctx.methodLines.join(' · ')}.</span>
          <Link className="btn small" href={`/coach/${wid}/methode`}>Ma méthode</Link></p>
      ) : null}
      {program ? <AiTweaks wid={wid} aid={aid} goalId={ctx.goal.id} days={days} tweaks={tweaks} href={here} first={first} source={aiSource()} /> : null}
    </details>
  );

  return (
    <>
      <Link className="back" href={`${back}#faisabilite`}>← Fiche de {ctx.athlete.name}</Link>
      <div className="kicker">Programme · {ctx.athlete.name}</div>
      <h1>{ctx.goal.title}</h1>
      <ul className="plain prog-facts" aria-label="Objectif">
        {d ? <li>{String(d.distanceKm).replace('.', ',')} km</li> : null}
        <li>{formatLongDate(eventDate)}</li>
        {d ? <li>{d.targetSeconds ? `objectif ${formatClock(d.targetSeconds)}` : 'pour finir'}</li> : null}
        <li>{dayNames}</li>
      </ul>

      {plans.length ? (
        <div className="banner prog-has" role="note">
          {plans.map((p) => (
            <span key={p.id} className="prog-existing">
              <span><strong>Programme déjà créé</strong> du {formatShortDate(p.startsOn)} au {formatShortDate(p.endsOn)}
                <span className="muted"> · {p.days.map((x) => WEEKDAY_SHORT[x - 1]).join(', ')}{p.regenerations ? ` · régénéré ${p.regenerations} fois` : ''}</span></span>
              <Link className="btn small" href={`/coach/${wid}/athletes/${aid}/programme/regenerer?plan=${p.id}`}>Régénérer une partie</Link>
            </span>
          ))}
          <span className="muted">Pour changer des jours ou des semaines, régénère plutôt que de créer un second programme : les séances passées ou retouchées sont gardées.</span>
        </div>
      ) : null}

      {!program ? (
        <>
          <p className="banner warn">Choisis au moins 2 jours d’entraînement.</p>
          {adjust}
        </>
      ) : (
        <>
          <TweaksBanner lines={tweaks ? describeTweaks(tweaks, DAY_LABELS) : []} href={here} suggestionId={suggestionId} />
          <section className="card prog-glance" aria-labelledby="prog-sum">
            <div className="card-head"><h2 id="prog-sum">{program.weeks.length} semaines · {total} séances</h2>
              <a className="btn small primary" href="#creer">Créer en brouillons ↓</a></div>
            <div className="card-body stack">
              <ul className="plain prog-stats">
                <li><span className="prog-stat-n">{h(program.startWeekly)} → {h(program.peakWeekly)}</span><span className="muted">par semaine, du départ au pic</span></li>
                <li><span className="prog-stat-n">{h(longest || program.longNeed)}</span><span className="muted">séance longue la plus longue</span></li>
                <li><span className="prog-stat-n">{fromLib}</span><span className="muted">séance{fromLib > 1 ? 's' : ''} de ta bibliothèque 📚</span></li>
                <li><span className="prog-stat-n">{program.risks.length ? `${program.risks.length} point${program.risks.length > 1 ? 's' : ''}` : 'Aucun'}</span><span className="muted">{program.risks.length ? <a href="#creer">d’attention à lire</a> : 'risque signalé'}</span></li>
              </ul>
              <ProgramChart weeks={program.weeks} eventDate={eventDate} eventLabel={ctx.goal.title} />
            </div>
          </section>

          <section className="card" aria-labelledby="prog-weeks">
            <div className="card-head"><h2 id="prog-weeks">Semaine par semaine</h2><span className="muted">Touche une séance pour lire pourquoi elle est là</span></div>
            {/* D-105 : une semaine = un bloc ; ses séances en petites tuiles. */}
            <ol className="plain pb-list card-body">
              {programBlocks(program.weeks).map((b) => {
                const first = b.weeks[0]!, last = b.weeks.at(-1)!;
                return (
                  <li key={b.n} className={`pb ${b.phase}`}>
                    <div className="pb-head">
                      <h3><span className="pb-n">Bloc {b.n}</span> · {BLOCK_TITLE[b.phase]} <span className="muted">· S{first.index}{last.index !== first.index ? `–S${last.index}` : ''}</span></h3>
                      <p className="muted pb-sum">{b.phase === 'developpement' && !b.lightWeeks ? 'La charge monte jusqu’à l’affûtage.'
                        : b.phase === 'tremplin' && b.lightWeeks ? `${b.loadWeeks} semaines pour reprendre la régularité depuis ce qui est fait aujourd’hui, puis une petite semaine de décharge.` : BLOCK_AIM[b.phase]}
                        {b.phase === 'developpement' ? (() => {
                          const top = Math.max(...b.weeks.map((w) => w.minutes));
                          return ` ${b.loadWeeks} semaine${b.loadWeeks > 1 ? 's' : ''} de charge${b.lightWeeks ? ` + ${b.lightWeeks} allégée` : ''} · ${h(first.minutes) === h(top) ? h(top) : `${h(first.minutes)} → ${h(top)}`} par semaine.`;
                        })() : ''}</p>
                    </div>
                    <ol className="plain pw-grid">
                      {b.weeks.map((w) => {
                        // Semaine allégée comparée à la plus grosse semaine de son bloc (la semaine du test est plus courte).
                        const top = Math.max(0, ...b.weeks.filter((x) => x.index < w.index).map((x) => x.minutes));
                        const delta = top ? Math.round((w.minutes / top - 1) * 100) : weekDelta(program.weeks, w.index);
                        return (
                          <li key={w.index} id={`semaine-${w.index}`} className={`pw ${w.phase}`}>
                            <div className="pw-head">
                              <strong className="pw-n">S{w.index}</strong>
                              <span className="muted">{formatShortDate(w.monday)}</span>
                              {w.phase === 'recuperation'
                                ? <span className="pill pw-light">↓ Semaine allégée</span>
                                : <Pill tone={w.phase === 'tremplin' ? 'neutral' : w.phase === 'affutage' ? 'attn' : ''}>{PROGRAM_PHASE_LABELS[w.phase]}</Pill>}
                              <span className="pw-vol"><strong>{h(w.minutes)}</strong>{w.longMinutes ? <span className="muted"> · longue {h(w.longMinutes)}</span> : null}
                                {w.phase === 'recuperation' && delta !== null && delta < 0 ? <span className="pw-delta"> · −{Math.abs(delta)}&nbsp;% de volume pour assimiler</span> : null}</span>
                            </div>
                            <ul className="plain pw-tiles">
                              {w.sessions.map((s, i) => {
                                const dow = (new Date(`${s.date}T12:00:00Z`).getUTCDay() + 6) % 7;
                                return (
                                  <li key={i} className={`pt ${s.kind}`}>
                                    <details>
                                      <summary>
                                        <span className="pt-day">{WEEKDAY_SHORT[dow]}</span>
                                        <span className="pt-title">{s.title}</span>
                                        <span className="pt-kind">{KIND_LABEL[s.kind]}{s.source === 'library' ? ' · 📚' : ''}</span>
                                      </summary>
                                      <p className="pt-why"><strong>{WEEKDAY_LONG[dow]} · pourquoi ?</strong> {s.why}</p>
                                    </details>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card" aria-labelledby="creer-title" id="creer">
            <div className="card-head"><h2 id="creer-title">Créer le programme</h2></div>
            <div className="card-body stack">
              {program.risks.length ? (
                <div className="prog-risks" role="note">
                  <p><strong>Points d’attention</strong> <span className="muted">· le programme vise toujours l’objectif ; à toi de décider</span></p>
                  <ul className="plain">{program.risks.map((r, i) => <li key={i} className={`fz-c ${r.level}`}><span className="fz-mark" aria-hidden="true">{RISK_MARK[r.level]}</span><span>{r.text}</span></li>)}</ul>
                </div>
              ) : <p className="muted">Aucun risque particulier signalé.</p>}
              {existing ? <p className="muted">{existing} séance{existing > 1 ? 's' : ''} déjà prévue{existing > 1 ? 's' : ''} sur la période : elles restent ; le programme s’y ajoute.</p> : null}
              <ProgramCreate wid={wid} aid={aid} goalId={ctx.goal.id} startMonday={start} days={days} sessions={total} tweaks={tweaks} suggestionId={suggestionId}
                needsAccept={program.risks.some((r) => r.level !== 'watch')} validated={Boolean(ctx.decision)} />
            </div>
          </section>

          {adjust}
        </>
      )}
    </>
  );
}
