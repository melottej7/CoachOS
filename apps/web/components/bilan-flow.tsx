'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BREAK_LENGTHS, BREAK_LENGTH_LABELS, DAY_LABELS, EQUIPMENT_LABELS, equipmentFor, PREFERRED_TIMES, PREFERRED_TIME_LABELS, WEEKDAY_MINUTES, WEEKDAY_MINUTES_LABELS, EXPERIENCES, EXPERIENCE_LABELS, LEVELS, LEVEL_LABELS, LONGEST_RECENT, LONGEST_RECENT_LABELS,
  PRACTICE_STATUSES, PRACTICE_STATUS_LABELS, RESUMED_SINCE, RESUMED_SINCE_LABELS, SPORTS, SPORT_LABELS, SPORT_WITH_ARTICLE,
  WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS, bilanCompletion, bilanSteps, deriveBilan, formatLongDate, resumeStep,
  type BilanAnswers, type BilanStep, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from './api-client';
import { useIntent } from './use-intent';

/**
 * Bilan d’arrivée (D-054), ergonomie reprise de Foulée : une question par écran, barre de progression, retour,
 * un toucher sur une réponse fait avancer, questions qui s’adaptent, récapitulatif modifiable avant l’envoi.
 * Élève : brouillon enregistré sur le serveur à chaque écran (reprise sur un autre appareil).
 * Coach (entretien, CE-B-05) : mêmes questions à la troisième personne, enregistrées comme réponses d’entretien.
 */

type Choice<T extends string> = { values: readonly T[]; labels: Record<T, string>; hints?: Partial<Record<T, string>> };

const VERB: Record<Sport, string> = { running: 'couru', trail: 'couru', cycling: 'roulé', swimming: 'nagé', triathlon: 'pratiqué', duathlon: 'pratiqué' };

export function BilanFlow({ wid, mode, initial, startAt, firstName, aid, expectedRevision, after }: {
  wid: string;
  mode: 'athlete' | 'coach';
  initial: BilanAnswers;
  startAt?: BilanStep;
  /** Prénom de l’élève (questions du coach à la troisième personne). */
  firstName: string;
  /** Coach seulement : dossier et révision attendue du bilan (null s’il n’existe pas). */
  aid?: string;
  expectedRevision?: number | null;
  after: string;
}) {
  const router = useRouter();
  const [a, setA] = useState<BilanAnswers>(() => deriveBilan(initial));
  const [step, setStep] = useState<BilanStep>(startAt ?? 'sport');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const [fromRecap, setFromRecap] = useState(false);
  const { run, pending, error } = useIntent<unknown>();
  const heading = useRef<HTMLHeadingElement>(null);
  const steps = bilanSteps(a);
  const idx = Math.max(0, steps.indexOf(step));
  const done = bilanCompletion(a);
  const coach = mode === 'coach';
  const sport = a.sport ?? 'running';
  const you = (t: string, c: string) => (coach ? c : t);

  useEffect(() => { heading.current?.focus(); }, [step]);

  function saveDraft(next: BilanAnswers, at: BilanStep) {
    if (coach) return;
    setSaved('saving');
    void mutate('PUT', `/api/v1/workspaces/${wid}/athlete-profile/draft`, { step: at, answers: clean(next) }, newKey())
      .then((r) => setSaved(r.ok ? 'saved' : 'offline'));
  }
  function go(to: BilanStep, next = a) {
    setStep(to);
    saveDraft(next, to);
    window.scrollTo({ top: 0 });
  }
  function nextStep(next: BilanAnswers) {
    const list = bilanSteps(next);
    // Depuis le récapitulatif : retour au récapitulatif, sauf si la réponse ouvre une question obligatoire encore vide.
    if (fromRecap) { const r = resumeStep(next); if (r === 'recap') setFromRecap(false); return go(r, next); }
    return go(list[Math.min(list.indexOf(step) + 1, list.length - 1)]!, next);
  }
  function answer<K extends keyof BilanAnswers>(k: K, v: BilanAnswers[K]) {
    const next = deriveBilan({ ...a, [k]: v });
    setA(next);
    nextStep(next);
  }
  function back() {
    if (idx > 0) go(steps[idx - 1]!);
  }

  async function submit() {
    // Un jour de séance longue retiré des jours disponibles n’est plus valable.
    const longDay = a.longDay && (!a.availableDays?.length || a.availableDays.includes(a.longDay)) ? a.longDay : null;
    const body = { ...clean(a), availableDays: a.availableDays ?? [], equipment: (a.equipment ?? []).filter((e) => equipmentFor(a.sport).includes(e)), longDay };
    const r = coach
      ? await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/athlete-profile`, { expectedRevision: expectedRevision ?? null, data: body })
      : await run('PUT', `/api/v1/workspaces/${wid}/athlete-profile`, body);
    if (r) { router.push(after); router.refresh(); }
  }

  const choice = <T extends string>(k: keyof BilanAnswers, c: Choice<T>) => (
    <div className="bf-choices" role="radiogroup" aria-labelledby="bf-q">
      {c.values.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={a[k] === v} className={`bf-choice${a[k] === v ? ' on' : ''}`} onClick={() => answer(k, v as never)}>
          <span>{c.labels[v]}</span>{c.hints?.[v] ? <small>{c.hints[v]}</small> : null}
        </button>
      ))}
    </div>
  );

  const Q: Record<BilanStep, { title: string; hint?: string; body: React.ReactNode }> = {
    sport: { title: you('Quel est ton sport principal ?', `Quel est le sport principal de ${firstName} ?`), hint: 'Celui que tu veux travailler avec ton coach.', body: choice('sport', { values: SPORTS, labels: SPORT_LABELS }) },
    status: {
      title: you(`Où en es-tu avec ${SPORT_WITH_ARTICLE[sport]} ?`, `Où en est ${firstName} avec ${SPORT_WITH_ARTICLE[sport]} ?`),
      hint: you('Choisis ce qui te ressemble le plus aujourd’hui. Les questions suivantes s’adaptent à ta réponse.', 'Ce qui lui ressemble le plus aujourd’hui.'),
      body: choice('practiceStatus', { values: PRACTICE_STATUSES, labels: PRACTICE_STATUS_LABELS }),
    },
    experience: {
      title: you(`En tout, pendant combien de temps as-tu ${VERB[sport]} régulièrement ?`, `En tout, combien de temps de pratique régulière ?`),
      hint: 'Additionne toutes les périodes, même anciennes. Ne compte pas les arrêts.',
      body: choice('experience', { values: EXPERIENCES, labels: EXPERIENCE_LABELS }),
    },
    break: { title: 'Combien de temps a duré l’arrêt ?', hint: 'L’arrêt le plus récent : la période sans pratique, ou presque.', body: choice('breakLength', { values: BREAK_LENGTHS, labels: BREAK_LENGTH_LABELS }) },
    resumed: { title: you('Depuis quand as-tu repris ?', `Depuis quand ${firstName} a-t-il ou elle repris ?`), hint: 'Depuis quand la pratique est de nouveau hebdomadaire.', body: choice('resumedSince', { values: RESUMED_SINCE, labels: RESUMED_SINCE_LABELS }) },
    sessions: {
      title: you(`Ces 4 dernières semaines, combien de fois par semaine as-tu ${VERB[sport]} ?`, 'Ces 4 dernières semaines, combien de séances par semaine ?'),
      hint: 'En moyenne, ce qui a vraiment été fait. Pas avant, ni ce qui est souhaité.',
      body: choice('weeklySessions', { values: WEEKLY_SESSIONS, labels: Object.fromEntries(WEEKLY_SESSIONS.map((s) => [s, `${WEEKLY_SESSIONS_LABELS[s]} fois`])) as Record<string, string> }),
    },
    longest: {
      title: you(`Ta plus longue ${sport === 'swimming' ? 'séance' : 'sortie'} de ces 4 dernières semaines ?`, `Sa plus longue ${sport === 'swimming' ? 'séance' : 'sortie'} de ces 4 dernières semaines ?`),
      hint: 'D’une traite. Aujourd’hui, pas le record d’avant.',
      body: <>{choice('longestRecent', { values: LONGEST_RECENT, labels: LONGEST_RECENT_LABELS })}<button type="button" className="link-btn bf-skip" onClick={() => answer('longestRecent', null)}>Je ne sais pas</button></>,
    },
    level: {
      title: you('Comment te décrirais-tu aujourd’hui ?', `Comment décrire ${firstName} aujourd’hui ?`),
      body: choice('level', { values: LEVELS, labels: Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].label])) as Record<string, string>, hints: Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].hint])) }),
    },
    hours: {
      title: you('Combien d’heures par semaine peux-tu y consacrer ?', 'Combien d’heures par semaine disponibles ?'), hint: 'Facultatif.',
      body: <>{choice('weeklyHours', { values: WEEKLY_HOURS, labels: WEEKLY_HOURS_LABELS })}<button type="button" className="link-btn bf-skip" onClick={() => answer('weeklyHours', null)}>Passer</button></>,
    },
    days: {
      title: you('Quels jours peux-tu t’entraîner ?', 'Quels jours sont disponibles ?'), hint: 'Plusieurs choix possibles. Facultatif.',
      body: (
        <>
          <div className="bf-days" role="group" aria-labelledby="bf-q">
            {DAY_LABELS.map((d, i) => {
              const on = (a.availableDays ?? []).includes(i + 1);
              return <button key={d} type="button" aria-pressed={on} className={`bf-day${on ? ' on' : ''}`}
                onClick={() => setA((x) => ({ ...x, availableDays: on ? (x.availableDays ?? []).filter((n) => n !== i + 1) : [...(x.availableDays ?? []), i + 1].sort() }))}>{d}</button>;
            })}
          </div>
          <button type="button" className="btn primary bf-next" onClick={() => nextStep(a)}>Suivant</button>
        </>
      ),
    },
    time: {
      title: you('Ton temps et tes habitudes', `Temps et habitudes de ${firstName}`),
      hint: 'Facultatif. Sert à placer les séances au bon moment et à la bonne durée.',
      body: (
        <div className="bf-form">
          <fieldset className="bf-group"><legend>{you('Un jour de semaine, combien de temps as-tu pour une séance ?', 'Temps disponible pour une séance en semaine')}</legend>
            <div className="bf-chips">{WEEKDAY_MINUTES.map((v) => (
              <button key={v} type="button" aria-pressed={a.weekdayMinutes === v} className={`bf-chip${a.weekdayMinutes === v ? ' on' : ''}`}
                onClick={() => setA((x) => ({ ...x, weekdayMinutes: x.weekdayMinutes === v ? null : v }))}>{WEEKDAY_MINUTES_LABELS[v]}</button>
            ))}</div></fieldset>
          <fieldset className="bf-group"><legend>{you('À quel moment préfères-tu t’entraîner ?', 'Moment préféré')}</legend>
            <div className="bf-chips">{PREFERRED_TIMES.map((v) => (
              <button key={v} type="button" aria-pressed={a.preferredTime === v} className={`bf-chip${a.preferredTime === v ? ' on' : ''}`}
                onClick={() => setA((x) => ({ ...x, preferredTime: x.preferredTime === v ? null : v }))}>{PREFERRED_TIME_LABELS[v]}</button>
            ))}</div></fieldset>
          <fieldset className="bf-group"><legend>{you('Quel jour pour la séance la plus longue ?', 'Jour préféré pour la séance longue')}</legend>
            <div className="bf-chips">{DAY_LABELS.map((d, i) => (a.availableDays?.length && !a.availableDays.includes(i + 1) ? null : (
              <button key={d} type="button" aria-pressed={a.longDay === i + 1} className={`bf-chip${a.longDay === i + 1 ? ' on' : ''}`}
                onClick={() => setA((x) => ({ ...x, longDay: x.longDay === i + 1 ? null : i + 1 }))}>{d}</button>
            )))}</div></fieldset>
          <button type="button" className="btn primary bf-next" onClick={() => nextStep(a)}>Suivant</button>
        </div>
      ),
    },
    equipment: {
      title: you('Ton matériel et tes contraintes', `Matériel et contraintes de ${firstName}`),
      hint: 'Facultatif. Plusieurs choix possibles.',
      body: (
        <div className="bf-form">
          <div className="bf-chips" role="group" aria-label="Matériel">{equipmentFor(a.sport).map((v) => {
            const on = (a.equipment ?? []).includes(v);
            return <button key={v} type="button" aria-pressed={on} className={`bf-chip${on ? ' on' : ''}`}
              onClick={() => setA((x) => ({ ...x, equipment: on ? (x.equipment ?? []).filter((e) => e !== v) : [...(x.equipment ?? []), v] }))}>{EQUIPMENT_LABELS[v]}</button>;
          })}</div>
          <label className="field"><span>{you('Contraintes utiles à ton coach', 'Contraintes utiles')} <span className="hint">Facultatif · ex. horaires décalés, enfants le mercredi, déplacements</span></span>
            <textarea maxLength={300} value={a.practicalConstraints ?? ''} onChange={(e) => setA((x) => ({ ...x, practicalConstraints: e.target.value }))} /></label>
          <p className="muted">Pas d’information médicale ici : {you('parles-en directement à ton coach', 'elle reste hors du bilan')}.</p>
          <button type="button" className="btn primary bf-next" onClick={() => nextStep(a)}>Suivant</button>
        </div>
      ),
    },
    goal: {
      title: you('Quel est ton objectif ?', `Quel est l’objectif de ${firstName} ?`), hint: 'Facultatif. En une phrase : ce que tu veux réussir, et quand.',
      body: (
        <div className="bf-form">
          <label className="field"><span>Objectif principal</span>
            <textarea maxLength={300} value={a.mainGoal ?? ''} onChange={(e) => setA((x) => ({ ...x, mainGoal: e.target.value }))} placeholder="Ex. Courir mon premier 10 km sans m’arrêter" /></label>
          <div className="form-row">
            <label className="field"><span>Prochaine course <span className="hint">Facultatif</span></span>
              <input maxLength={120} value={a.nextEventName ?? ''} onChange={(e) => setA((x) => ({ ...x, nextEventName: e.target.value }))} /></label>
            <label className="field"><span>Date</span>
              <input type="date" value={a.nextEventDate ?? ''} onChange={(e) => setA((x) => ({ ...x, nextEventDate: e.target.value || null }))} /></label>
          </div>
          <button type="button" className="btn primary bf-next" onClick={() => nextStep(a)}>Suivant</button>
        </div>
      ),
    },
    recap: {
      title: you('Ton bilan, avant l’envoi', `Bilan de ${firstName} (entretien)`),
      hint: you('Touche une ligne pour la modifier. Ton coach le lira puis le confirmera.', 'Les réponses modifiées seront marquées « entretien » ; le bilan sera confirmé.'),
      body: (
        <div className="bf-recap">
          <dl>
            {recapRows(a).map(([s, label, value]) => (
              <div key={s}><dt>{label}</dt><dd><button type="button" className="link-btn" onClick={() => { setFromRecap(true); go(s); }}>{value} <span aria-hidden="true">✎</span><span className="visually-hidden">Modifier</span></button></dd></div>
            ))}
          </dl>
          {!done.complete ? <p className="field-error" role="alert">Il manque {done.total - done.answered} réponse{done.total - done.answered > 1 ? 's' : ''} obligatoire{done.total - done.answered > 1 ? 's' : ''}.</p> : null}
          {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Tes réponses restent ici : réessaie.'}</p> : null}
          <button type="button" className="btn primary bf-next" disabled={pending || !done.complete} onClick={() => void submit()}>
            {pending ? 'Envoi…' : coach ? 'Enregistrer le bilan de l’entretien' : 'Envoyer mon bilan à mon coach'}
          </button>
        </div>
      ),
    },
  };
  const q = Q[step];

  return (
    <div className="bf">
      <div className="bf-top">
        <button type="button" className="bf-back" onClick={back} disabled={idx === 0} aria-label="Question précédente">←</button>
        <div className="bf-bar" role="progressbar" aria-label="Avancement du bilan" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={idx + 1}>
          <span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
        {coach ? null : <span className="bf-saved" aria-live="polite">{saved === 'saving' ? 'Enregistrement…' : saved === 'saved' ? 'Enregistré' : saved === 'offline' ? 'Hors ligne' : ''}</span>}
      </div>
      <h2 id="bf-q" ref={heading} tabIndex={-1}>{q.title}</h2>
      {q.hint ? <p className="bf-hint">{q.hint}</p> : null}
      {q.body}
      {!coach && step !== 'recap' ? <p className="muted bf-foot">Tu peux t’arrêter à tout moment : tes réponses sont gardées pour la prochaine fois.</p> : null}
    </div>
  );
}

/** Retire les champs vides pour le brouillon et l’envoi. */
function clean(a: BilanAnswers): BilanAnswers {
  const out: BilanAnswers = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length && k !== 'availableDays' && k !== 'equipment')) continue;
    (out as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() || null : v;
  }
  return out;
}

function recapRows(a: BilanAnswers): [BilanStep, string, string][] {
  const dash = '—';
  const rows: [BilanStep, string, string][] = [];
  for (const s of bilanSteps(a)) {
    if (s === 'sport') rows.push([s, 'Sport', a.sport ? SPORT_LABELS[a.sport] : dash]);
    if (s === 'status') rows.push([s, 'Situation', a.practiceStatus ? PRACTICE_STATUS_LABELS[a.practiceStatus] : dash]);
    if (s === 'experience') rows.push([s, 'Pratique régulière', a.experience ? EXPERIENCE_LABELS[a.experience] : dash]);
    if (s === 'break') rows.push([s, 'Durée de l’arrêt', a.breakLength ? BREAK_LENGTH_LABELS[a.breakLength] : dash]);
    if (s === 'resumed') rows.push([s, 'Reprise', a.resumedSince ? RESUMED_SINCE_LABELS[a.resumedSince] : dash]);
    if (s === 'sessions') rows.push([s, 'Séances par semaine', a.weeklySessions ? `${WEEKLY_SESSIONS_LABELS[a.weeklySessions]} fois` : dash]);
    if (s === 'longest') rows.push([s, 'Plus longue sortie', a.longestRecent ? LONGEST_RECENT_LABELS[a.longestRecent] : 'Non précisé']);
    if (s === 'level') rows.push([s, 'Niveau', a.level ? LEVEL_LABELS[a.level].label : dash]);
    if (s === 'hours') rows.push([s, 'Heures par semaine', a.weeklyHours ? WEEKLY_HOURS_LABELS[a.weeklyHours] : 'Non précisé']);
    if (s === 'days') rows.push([s, 'Jours disponibles', a.availableDays?.length ? a.availableDays.map((d) => DAY_LABELS[d - 1]).join(' ') : 'Non précisés']);
    if (s === 'time') rows.push([s, 'Temps et habitudes', [
      a.weekdayMinutes ? `${WEEKDAY_MINUTES_LABELS[a.weekdayMinutes]} en semaine` : null,
      a.preferredTime ? PREFERRED_TIME_LABELS[a.preferredTime].toLowerCase() : null,
      a.longDay ? `séance longue le ${(DAY_LABELS[a.longDay - 1] ?? "").toLowerCase()}` : null,
    ].filter(Boolean).join(' · ') || 'Non précisé']);
    if (s === 'equipment') rows.push([s, 'Matériel et contraintes', [
      a.equipment?.length ? a.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ') : null, a.practicalConstraints?.trim() || null,
    ].filter(Boolean).join(' · ') || 'Non précisé']);
    if (s === 'goal') rows.push([s, 'Objectif', [a.mainGoal, a.nextEventName, a.nextEventDate ? formatLongDate(a.nextEventDate).toLowerCase() : null].filter(Boolean).join(' · ') || 'Non précisé']);
  }
  return rows;
}
