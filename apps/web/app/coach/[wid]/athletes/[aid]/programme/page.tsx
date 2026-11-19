import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, formatClock, formatLongDate, formatShortDate, isLocalDate, PROGRAM_PHASE_LABELS, weekStart, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { buildProgram, existingInPeriod, nextMonday, programContext } from '@/server/commands/programs';
import { ProgramCreate } from '@/components/program-create';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Programme' };

const h = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);
const RISK_MARK = { watch: '•', risk: '!', block: '✕' } as const;

/**
 * D-061 : générateur de programme. À la hauteur de l’objectif validé, 4 semaines de tremplin, risques signalés au coach
 * qui décide. Paramètres en adresse (rien n’est enregistré avant « Créer »).
 */
export default async function ProgramPage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ objectif?: string; debut?: string; jours?: string | string[] }> }) {
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
  const program = days.length >= 2 ? buildProgram(ctx, start, days) : null;
  const total = program ? program.weeks.reduce((n, w) => n + w.sessions.length, 0) : 0;
  const existing = program ? await existingInPeriod(actor.userId, wid, aid, start, ctx.feasibility.eventDate) : 0;
  const maxMin = program ? Math.max(...program.weeks.map((w) => w.minutes), 1) : 1;
  const d = ctx.decision?.params;

  return (
    <>
      <Link className="back" href={`${back}#faisabilite`}>← Fiche de {ctx.athlete.name}</Link>
      <div className="kicker">Programme · {ctx.athlete.name}</div>
      <h1>{ctx.goal.title}</h1>
      <p className="sub">
        {d ? <>Objectif validé : {String(d.distanceKm).replace('.', ',')} km le {formatLongDate(d.eventDate).toLowerCase()}{d.targetSeconds ? ` en ${formatClock(d.targetSeconds)}` : ', pour finir'}. </> : null}
        Le programme est construit pour atteindre cet objectif : 4 semaines de tremplin depuis ce que {first} fait aujourd’hui, puis le développement et l’affûtage. Les risques te sont signalés ; c’est toi qui décides.
      </p>

      <form className="card prog-params" method="get">
        <input type="hidden" name="objectif" value={ctx.goal.id} />
        <div className="card-body form-row">
          <label className="field"><span>Premier lundi</span><input type="date" name="debut" defaultValue={start} min={weekStart(ctx.today)} aria-label="Premier lundi du programme" /></label>
          <fieldset className="field prog-days"><legend>Jours d’entraînement</legend>
            {WEEKDAY_SHORT.map((label, i) => (
              <label key={label} className="check"><input type="checkbox" name="jours" value={i + 1} defaultChecked={days.includes(i + 1)} /> {label}</label>
            ))}
          </fieldset>
          <div className="actions"><button className="btn" type="submit">Recalculer</button></div>
        </div>
      </form>

      {!program ? <p className="banner warn">Choisis au moins 2 jours d’entraînement.</p> : (
        <>
          <section className="card" aria-labelledby="prog-sum">
            <div className="card-head"><h2 id="prog-sum">{program.weeks.length} semaines · {total} séances</h2></div>
            <div className="card-body stack">
              <p>Départ : <strong>{h(program.startWeekly)}</strong> par semaine (ce que {first} fait aujourd’hui) → pic : <strong>{h(program.peakWeekly)}</strong> par semaine, avec une séance longue de <strong>{h(program.longNeed)}</strong>.</p>
              {existing ? <p className="muted">{existing} séance{existing > 1 ? 's' : ''} déjà prévue{existing > 1 ? 's' : ''} sur la période : elles restent ; le programme s’y ajoute.</p> : null}
              {program.risks.length ? (
                <div className="prog-risks" role="note">
                  <p><strong>Risques signalés</strong> — le programme reste construit pour atteindre l’objectif ; à toi de décider.</p>
                  <ul className="plain">{program.risks.map((r, i) => <li key={i} className={`fz-c ${r.level}`}><span className="fz-mark" aria-hidden="true">{RISK_MARK[r.level]}</span><span>{r.text}</span></li>)}</ul>
                </div>
              ) : <p className="muted">Aucun risque particulier signalé.</p>}
              <ProgramCreate wid={wid} aid={aid} goalId={ctx.goal.id} startMonday={start} days={days} sessions={total}
                needsAccept={program.risks.some((r) => r.level !== 'watch')} validated={Boolean(ctx.decision)} />
            </div>
          </section>

          <section className="card" aria-labelledby="prog-weeks">
            <div className="card-head"><h2 id="prog-weeks">Semaine par semaine</h2></div>
            <ol className="plain prog-weeks card-body">
              {program.weeks.map((w) => (
                <li key={w.index} className={`prog-week ${w.phase}`}>
                  <p className="prog-week-head">
                    <strong>S{w.index}</strong> · {formatShortDate(w.monday)} · <Pill tone={w.phase === 'tremplin' ? 'neutral' : w.phase === 'recuperation' || w.phase === 'affutage' ? 'attn' : ''}>{PROGRAM_PHASE_LABELS[w.phase]}</Pill>
                    {' '}<span className="muted">{h(w.minutes)}{w.longMinutes ? ` · longue ${h(w.longMinutes)}` : ''}</span>
                  </p>
                  <span className="prog-bar" aria-hidden="true"><span style={{ width: `${Math.round((w.minutes / maxMin) * 100)}%` }} /></span>
                  <ul className="plain prog-sessions">
                    {w.sessions.map((s, i) => {
                      const dow = (new Date(`${s.date}T12:00:00Z`).getUTCDay() + 6) % 7;
                      return <li key={i} className={`prog-s ${s.kind}`}><span className="muted">{WEEKDAY_SHORT[dow]}</span> {s.title}</li>;
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
