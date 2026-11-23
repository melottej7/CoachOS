'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BREAK_LENGTHS, BREAK_LENGTH_LABELS, DAY_LABELS, EQUIPMENT_LABELS, equipmentFor, PREFERRED_TIMES, PREFERRED_TIME_LABELS, WEEKDAY_MINUTES, WEEKDAY_MINUTES_LABELS, EXPERIENCES, EXPERIENCE_LABELS, LEVELS, LEVEL_LABELS, LONGEST_RECENT, LONGEST_RECENT_LABELS,
  PRACTICE_STATUSES, PRACTICE_STATUS_LABELS, RESUMED_SINCE, RESUMED_SINCE_LABELS, SPORTS, SPORT_LABELS, SPORT_WITH_ARTICLE,
  WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS, bilanCompletion, bilanSports, bilanSteps, deriveBilan, formatLongDate, resumeStep,
  STRENGTH_FOCUS, STRENGTH_FOCUS_LABELS, STRENGTH_LEVEL_HINTS, EQUIPMENT, HOME_EQUIPMENT, TRAINING_PLACES, TRAINING_PLACE_HINTS, TRAINING_PLACE_LABELS, type Equipment,
  type BilanAnswers, type BilanStep, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { useIntent } from '@/components/use-intent';
import {
  AnswerList, Badge, Banner, Button, ChipChecks, ChipChoice, Field, Grid, Heading, Icon, IconButton, Input, Stack, Text, Textarea,
} from '@/design';
import { ErrorSummary } from './error-summary';
import s from './bilan-flow.module.css';

/**
 * Bilan d’arrivée (D-054), refonte Chrono (D-138) : une question par écran, en grand ; un toucher sur une réponse
 * fait avancer, les questions s’adaptent, le récapitulatif se modifie ligne par ligne avant l’envoi.
 * Élève : brouillon enregistré sur le serveur à chaque écran (reprise sur un autre appareil).
 * Coach (entretien, CE-B-05) : mêmes questions à la troisième personne, enregistrées comme réponses d’entretien.
 */

const Q_ID = 'bilan-question';
const DASH = '—';

const VERB: Record<Sport, string> = { running: 'couru', trail: 'couru', cycling: 'roulé', swimming: 'nagé', triathlon: 'pratiqué', duathlon: 'pratiqué', strength: 'pratiqué' };

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
  // D-153 : le sport principal n’apparaît choisi que s’il l’a vraiment été (bilan repris, déjà rempli). Juste après le choix
  // des sports, rien n’est coché : une réponse cochée d’office semblait déjà donnée alors qu’il fallait la toucher pour avancer.
  const [mainChosen, setMainChosen] = useState(() => bilanSports(initial).length > 1 && startAt !== 'mainSport');
  const { run, pending, error } = useIntent<unknown>();
  const first = useRef(true);
  const top = useRef<HTMLDivElement>(null);
  const steps = bilanSteps(a);
  const idx = Math.max(0, steps.indexOf(step));
  const done = bilanCompletion(a);
  const coach = mode === 'coach';
  const sport = a.sport ?? 'running';
  const strength = sport === 'strength';
  const picked = bilanSports(a);
  // D-108, D-110 : matériel d’endurance pour les sports d’endurance choisis ; matériel de musculation selon le lieu (maison).
  const enduranceSports = (picked.length ? picked : [sport]).filter((x) => x !== 'strength');
  const enduranceEquipment: Equipment[] = EQUIPMENT.filter((e) => !HOME_EQUIPMENT.includes(e) && enduranceSports.some((x) => equipmentFor(x).includes(e)));
  const wantsMuscu = picked.includes('strength') || strength;
  const atHome = (a.trainingPlaces ?? []).includes('home') || (wantsMuscu && !(a.trainingPlaces ?? []).length);
  const equipment: Equipment[] = [...enduranceEquipment, ...(wantsMuscu && atHome ? HOME_EQUIPMENT : [])];
  const you = (t: string, c: string) => (coach ? c : t);

  const toggleEquip = (v: Equipment) => setA((x) => {
    const cur = x.equipment ?? [];
    if (cur.includes(v)) return { ...x, equipment: cur.filter((e) => e !== v) };
    // « Rien : poids du corps » exclut le matériel de maison, et inversement.
    const home = HOME_EQUIPMENT.includes(v);
    const kept = v === 'bodyweight' ? cur.filter((e) => !HOME_EQUIPMENT.includes(e)) : home ? cur.filter((e) => e !== 'bodyweight') : cur;
    return { ...x, equipment: [...kept, v] };
  });
  /** D-108 : choisir plusieurs sports ; le premier choisi est le principal tant qu’on n’en désigne pas un autre. */
  const toggleSport = (x: Sport) => setA((cur) => {
    const list = bilanSports(cur);
    const next = list.includes(x) ? list.filter((y) => y !== x) : [...list, x];
    return deriveBilan({ ...cur, sport: next[0], otherSports: next.slice(1) });
  });

  // À chaque changement d’écran (pas à l’ouverture : la page se lit d’abord depuis son titre), l’écran remonte jusqu’à
  // la barre d’avancement, pour que la question et ses réponses occupent tout le téléphone, et la question reçoit le focus.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ block: 'start' });
    document.getElementById(Q_ID)?.focus({ preventScroll: true });
  }, [step]);

  function saveDraft(next: BilanAnswers, at: BilanStep) {
    if (coach) return;
    setSaved('saving');
    void mutate('PUT', `/api/v1/workspaces/${wid}/athlete-profile/draft`, { step: at, answers: clean(next) }, newKey())
      .then((r) => setSaved(r.ok ? 'saved' : 'offline'));
  }
  function go(to: BilanStep, next = a) {
    setStep(to);
    saveDraft(next, to);
  }
  function nextStep(next: BilanAnswers) {
    const list = bilanSteps(next);
    // Depuis le récapitulatif : retour au récapitulatif, sauf si la réponse ouvre une question obligatoire encore vide.
    if (fromRecap) {
      // D-108, D-110 : enchaîner les questions nouvelles (sport principal, musculation, lieu, matériel de maison) encore sans réponse.
      if (step === 'sport' || step === 'mainSport' || step === 'focus' || step === 'place') {
        const later = (x: BilanStep) => list.includes(x) && list.indexOf(x) > list.indexOf(step);
        const need = (['mainSport', 'focus', 'place', 'equipment'] as BilanStep[]).find((x) => later(x) && (
          x === 'mainSport' ? step === 'sport'
            : x === 'focus' ? !next.strengthFocus?.length
              : x === 'place' ? !next.trainingPlaces?.length
                : step === 'place' && Boolean(next.trainingPlaces?.includes('home'))));
        if (need) return go(need, next);
      }
      const r = resumeStep(next); if (r === 'recap') setFromRecap(false); return go(r, next);
    }
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
    const body = { ...clean(a), availableDays: a.availableDays ?? [], equipment: (a.equipment ?? []).filter((e) => equipment.includes(e)), longDay, otherSports: a.otherSports ?? [], strengthFocus: a.strengthFocus ?? [], trainingPlaces: a.trainingPlaces ?? [] };
    const r = coach
      ? await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/athlete-profile`, { expectedRevision: expectedRevision ?? null, data: body })
      : await run('PUT', `/api/v1/workspaces/${wid}/athlete-profile`, body);
    if (r) { router.push(after); router.refresh(); }
  }

  const nextButton = (disabled = false) => (
    <Button variant="coach" size="lg" block iconRight="arrowRight" disabled={disabled} onClick={() => nextStep(a)}>Suivant</Button>
  );
  /**
   * Une seule réponse : le toucher répond et fait avancer, même sur la réponse déjà choisie.
   * D-153 : une réponse déjà là (retour en arrière, bilan repris ou relu par le coach) se garde avec « Suivant ».
   */
  const single = <T extends string>(k: keyof BilanAnswers, values: readonly T[], labels: Record<T, string>, hints?: Partial<Record<T, string>>) => (
    <>
      <AnswerList labelledBy={Q_ID} options={values.map((v) => ({ value: v, label: labels[v], hint: hints?.[v] }))}
        value={a[k] as T | null | undefined} onPick={(v) => answer(k, v as never)} />
      {a[k] != null ? nextButton() : null}
    </>
  );
  const equipChecks = (list: readonly Equipment[], legend: string) => {
    const cur = (a.equipment ?? []).filter((e) => list.includes(e));
    return (
      <ChipChecks legend={legend} options={list.map((v) => ({ value: v, label: EQUIPMENT_LABELS[v] }))} value={cur}
        onChange={(next) => { const v = next.find((x) => !cur.includes(x)) ?? cur.find((x) => !next.includes(x)); if (v) toggleEquip(v); }} />
    );
  };

  const Q: Record<BilanStep, { title: string; hint?: string; body: ReactNode }> = {
    sport: {
      title: you('Quels sports veux-tu travailler avec ton coach ?', `Quels sports ${firstName} travaille-t-il ou elle avec toi ?`),
      hint: 'Plusieurs choix possibles : course et musculation, par exemple.',
      body: (
        <>
          <AnswerList multiple labelledBy={Q_ID} value={picked} onPick={(x) => { setMainChosen(false); toggleSport(x); }}
            options={SPORTS.map((x) => ({ value: x, label: SPORT_LABELS[x] }))} />
          {nextButton(!picked.length)}
        </>
      ),
    },
    mainSport: {
      title: you('Lequel compte le plus pour toi en ce moment ?', `Lequel compte le plus pour ${firstName} en ce moment ?`),
      hint: 'Les questions suivantes portent sur ce sport ; ton coach voit aussi les autres.',
      body: (
        <>
          <AnswerList labelledBy={Q_ID} value={mainChosen ? a.sport : null} options={SPORTS.filter((x) => picked.includes(x)).map((x) => ({ value: x, label: SPORT_LABELS[x] }))}
            onPick={(x) => { const next = deriveBilan({ ...a, sport: x, otherSports: picked.filter((y) => y !== x) }); setMainChosen(true); setA(next); nextStep(next); }} />
          {mainChosen ? nextButton() : null}
        </>
      ),
    },
    focus: {
      title: you('En musculation, que veux-tu travailler ?', `En musculation, que veut travailler ${firstName} ?`),
      hint: 'Plusieurs choix possibles. Facultatif.',
      body: (
        <>
          <ChipChecks legend="À travailler en musculation" hideLegend value={a.strengthFocus ?? []}
            options={STRENGTH_FOCUS.map((v) => ({ value: v, label: STRENGTH_FOCUS_LABELS[v] }))}
            onChange={(next) => setA((x) => ({ ...x, strengthFocus: next }))} />
          {nextButton()}
        </>
      ),
    },
    status: {
      title: you(`Où en es-tu avec ${SPORT_WITH_ARTICLE[sport]} ?`, `Où en est ${firstName} avec ${SPORT_WITH_ARTICLE[sport]} ?`),
      hint: you('Choisis ce qui te ressemble le plus aujourd’hui. Les questions suivantes s’adaptent à ta réponse.', 'Ce qui lui ressemble le plus aujourd’hui.'),
      body: single('practiceStatus', PRACTICE_STATUSES, PRACTICE_STATUS_LABELS),
    },
    experience: {
      title: you(`En tout, pendant combien de temps as-tu ${VERB[sport]} régulièrement ?`, 'En tout, combien de temps de pratique régulière ?'),
      hint: 'Additionne toutes les périodes, même anciennes. Ne compte pas les arrêts.',
      body: single('experience', EXPERIENCES, EXPERIENCE_LABELS),
    },
    break: {
      title: 'Combien de temps a duré l’arrêt ?', hint: 'L’arrêt le plus récent : la période sans pratique, ou presque.',
      body: single('breakLength', BREAK_LENGTHS, BREAK_LENGTH_LABELS),
    },
    resumed: {
      title: you('Depuis quand as-tu repris ?', `Depuis quand ${firstName} a-t-il ou elle repris ?`), hint: 'Depuis quand la pratique est de nouveau hebdomadaire.',
      body: single('resumedSince', RESUMED_SINCE, RESUMED_SINCE_LABELS),
    },
    sessions: {
      title: you(`Ces 4 dernières semaines, combien de fois par semaine as-tu ${VERB[sport]} ?`, 'Ces 4 dernières semaines, combien de séances par semaine ?'),
      hint: 'En moyenne, ce qui a vraiment été fait. Pas avant, ni ce qui est souhaité.',
      body: single('weeklySessions', WEEKLY_SESSIONS, Object.fromEntries(WEEKLY_SESSIONS.map((x) => [x, `${WEEKLY_SESSIONS_LABELS[x]} fois`])) as Record<(typeof WEEKLY_SESSIONS)[number], string>),
    },
    longest: {
      title: you(`Ta plus longue ${sport === 'swimming' ? 'séance' : 'sortie'} de ces 4 dernières semaines ?`, `Sa plus longue ${sport === 'swimming' ? 'séance' : 'sortie'} de ces 4 dernières semaines ?`),
      hint: 'D’une traite. Aujourd’hui, pas le record d’avant.',
      body: <>{single('longestRecent', LONGEST_RECENT, LONGEST_RECENT_LABELS)}<Button variant="ghost" onClick={() => answer('longestRecent', null)}>Je ne sais pas</Button></>,
    },
    level: {
      title: you(`En ${SPORT_LABELS[sport].toLowerCase()}, comment te décrirais-tu aujourd’hui ?`, `En ${SPORT_LABELS[sport].toLowerCase()}, comment décrire ${firstName} aujourd’hui ?`),
      body: single('level', LEVELS, Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].label])) as Record<(typeof LEVELS)[number], string>,
        Object.fromEntries(LEVELS.map((l) => [l, strength ? STRENGTH_LEVEL_HINTS[l] : LEVEL_LABELS[l].hint]))),
    },
    hours: {
      title: you('Combien d’heures par semaine peux-tu y consacrer ?', 'Combien d’heures par semaine disponibles ?'), hint: 'Facultatif.',
      body: <>{single('weeklyHours', WEEKLY_HOURS, WEEKLY_HOURS_LABELS)}<Button variant="ghost" onClick={() => answer('weeklyHours', null)}>Passer</Button></>,
    },
    days: {
      title: you('Quels jours peux-tu t’entraîner ?', 'Quels jours sont disponibles ?'), hint: 'Plusieurs choix possibles. Facultatif.',
      body: (
        <>
          <ChipChecks legend="Jours disponibles" hideLegend value={a.availableDays ?? []}
            options={DAY_LABELS.map((d, i) => ({ value: i + 1, label: d }))}
            onChange={(next) => setA((x) => ({ ...x, availableDays: [...next].sort((p, q) => p - q) }))} />
          {nextButton()}
        </>
      ),
    },
    time: {
      title: you('Ton temps et tes habitudes', `Temps et habitudes de ${firstName}`),
      hint: 'Facultatif. Sert à placer les séances au bon moment et à la bonne durée.',
      body: (
        <>
          <ChipChoice name="weekday-minutes" legend={you('Un jour de semaine, combien de temps as-tu pour une séance ?', 'Temps disponible pour une séance en semaine')}
            options={WEEKDAY_MINUTES.map((v) => ({ value: v, label: WEEKDAY_MINUTES_LABELS[v] }))} value={a.weekdayMinutes ?? null}
            onChange={(v) => setA((x) => ({ ...x, weekdayMinutes: v }))} />
          <ChipChoice name="preferred-time" legend={you('À quel moment préfères-tu t’entraîner ?', 'Moment préféré')}
            options={PREFERRED_TIMES.map((v) => ({ value: v, label: PREFERRED_TIME_LABELS[v] }))} value={a.preferredTime ?? null}
            onChange={(v) => setA((x) => ({ ...x, preferredTime: v }))} />
          {strength ? null : (
            <ChipChoice name="long-day" legend={you('Quel jour pour la séance la plus longue ?', 'Jour préféré pour la séance longue')}
              options={DAY_LABELS.flatMap((d, i) => (a.availableDays?.length && !a.availableDays.includes(i + 1) ? [] : [{ value: i + 1, label: d }]))}
              value={a.longDay ?? null} onChange={(v) => setA((x) => ({ ...x, longDay: v }))} />
          )}
          {nextButton()}
        </>
      ),
    },
    place: {
      title: you('Où fais-tu ta musculation ?', `Où ${firstName} fait-il ou elle sa musculation ?`),
      hint: 'Plusieurs choix possibles. Le matériel est demandé ensuite, seulement pour la maison.',
      body: (
        <>
          <AnswerList multiple labelledBy={Q_ID} value={a.trainingPlaces ?? []}
            options={TRAINING_PLACES.map((v) => ({ value: v, label: TRAINING_PLACE_LABELS[v], hint: TRAINING_PLACE_HINTS[v] }))}
            onPick={(v) => setA((x) => {
              const cur = x.trainingPlaces ?? [];
              return deriveBilan({ ...x, trainingPlaces: cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v] });
            })} />
          {nextButton()}
        </>
      ),
    },
    equipment: {
      title: you('Ton matériel et tes contraintes', `Matériel et contraintes de ${firstName}`),
      hint: 'Facultatif. Plusieurs choix possibles.',
      body: (
        <>
          {enduranceEquipment.length ? equipChecks(enduranceEquipment, wantsMuscu ? `Pour ${enduranceSports.map((x) => SPORT_WITH_ARTICLE[x]).join(' et ')}` : 'Matériel') : null}
          {wantsMuscu && atHome ? equipChecks(HOME_EQUIPMENT, you('À la maison, avec quoi ?', 'À la maison, avec quel matériel ?')) : null}
          {wantsMuscu && (a.trainingPlaces ?? []).includes('gym') ? <Text size="sm" muted>En salle, tout est sur place : machines, barres et poids libres.</Text> : null}
          {wantsMuscu && (a.trainingPlaces ?? []).includes('outdoor') ? <Text size="sm" muted>En extérieur : barres de traction, barres parallèles et poids du corps.</Text> : null}
          <Field id="bilan-constraints" label={you('Contraintes utiles à ton coach', 'Contraintes utiles')} hint="Facultatif · ex. horaires décalés, enfants le mercredi, déplacements">
            <Textarea id="bilan-constraints" hasHint maxLength={300} value={a.practicalConstraints ?? ''} onChange={(e) => setA((x) => ({ ...x, practicalConstraints: e.target.value }))} />
          </Field>
          <Text size="sm" muted>Pas d’information médicale ici : {you('parles-en directement à ton coach', 'elle reste hors du bilan')}.</Text>
          {nextButton()}
        </>
      ),
    },
    goal: {
      title: you('Quel est ton objectif ?', `Quel est l’objectif de ${firstName} ?`), hint: you('Facultatif. En une phrase : ce que tu veux réussir, et quand.', 'Facultatif. En une phrase : ce qu’il ou elle veut réussir, et quand.'),
      body: (
        <>
          <Field id="bilan-goal" label="Objectif principal">
            <Textarea id="bilan-goal" maxLength={300} value={a.mainGoal ?? ''} onChange={(e) => setA((x) => ({ ...x, mainGoal: e.target.value }))}
              placeholder={strength ? 'Ex. Faire 10 pompes complètes d’ici l’été, me sentir plus solide en courant' : 'Ex. Courir mon premier 10 km sans m’arrêter'} />
          </Field>
          <Grid min={200} gap={4}>
            <Field id="bilan-event" label={strength ? 'Échéance ou événement' : 'Prochaine course'} hint="Facultatif">
              <Input id="bilan-event" hasHint maxLength={120} value={a.nextEventName ?? ''} onChange={(e) => setA((x) => ({ ...x, nextEventName: e.target.value }))} />
            </Field>
            <Field id="bilan-event-date" label="Date">
              <Input id="bilan-event-date" type="date" value={a.nextEventDate ?? ''} onChange={(e) => setA((x) => ({ ...x, nextEventDate: e.target.value || null }))} />
            </Field>
          </Grid>
          {nextButton()}
        </>
      ),
    },
    recap: {
      title: you('Ton bilan, avant l’envoi', `Bilan de ${firstName} (entretien)`),
      hint: you('Touche une ligne pour la modifier. Ton coach le lira puis le confirmera.', 'Les réponses modifiées seront marquées « entretien » ; le bilan sera confirmé.'),
      body: (
        <>
          <ul className={s.recap}>
            {recapRows(a).map(([at, label, value]) => (
              <li key={at}>
                <button type="button" className={s.row} onClick={() => { setFromRecap(true); go(at); }}>
                  <span className={s.rowText}>
                    <span className={s.rowLabel}>{label}</span>
                    {value === DASH ? <span><Badge tone="warning" dot>À répondre</Badge></span> : <span className={s.rowValue}>{value}</span>}
                  </span>
                  <span className={s.rowEdit}><Icon name="edit" size={18} /><span className="ds-visually-hidden">Modifier</span></span>
                </button>
              </li>
            ))}
          </ul>
          {!done.complete ? (
            <Banner tone="warning" title={`Il manque ${done.total - done.answered} réponse${done.total - done.answered > 1 ? 's' : ''} obligatoire${done.total - done.answered > 1 ? 's' : ''}`}>
              Touche les lignes marquées « À répondre ».
            </Banner>
          ) : null}
          {error && error.kind === 'error' && error.status !== 503 && error.code !== 'AUTH_REQUIRED_OR_INVALID_SIGNATURE'
            ? <Banner tone="danger" title="Envoi impossible">{error.fields[0]?.rule ?? error.message}</Banner>
            : <ErrorSummary error={error} onRetry={() => void submit()} />}
          <Button variant="coach" size="lg" block icon="send" loading={pending} disabled={!done.complete} onClick={() => void submit()}>
            {coach ? 'Enregistrer le bilan de l’entretien' : 'Envoyer mon bilan à mon coach'}
          </Button>
        </>
      ),
    },
  };
  const q = Q[step];

  return (
    <div className={s.flow}>
      <div className={s.top} ref={top}>
        <IconButton icon="chevronLeft" label="Question précédente" variant="secondary" onClick={back} disabled={idx === 0} />
        <div className={s.bar} role="progressbar" aria-label="Avancement du bilan" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={idx + 1}
          aria-valuetext={`Question ${idx + 1} sur ${steps.length}`}>
          <span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
        <span className={s.count} aria-hidden="true">{idx + 1} / {steps.length}</span>
      </div>
      {coach ? null : (
        <p className={saved === 'offline' ? `${s.saved} ${s.offline}` : s.saved} aria-live="polite">
          {saved === 'saving' ? 'Enregistrement…'
            : saved === 'saved' ? <><Icon name="check" size={14} />Réponses enregistrées</>
              : saved === 'offline' ? <><Icon name="alert" size={14} />Hors ligne : tes réponses restent sur cet écran</>
                : null}
        </p>
      )}
      <Stack gap={2}>
        <Heading level={2} size={2} id={Q_ID} tabIndex={-1} className={s.question}>{q.title}</Heading>
        {q.hint ? <Text muted>{q.hint}</Text> : null}
      </Stack>
      <Stack gap={5}>{q.body}</Stack>
      {!coach && step !== 'recap' ? <Text size="sm" muted>Tu peux t’arrêter à tout moment : tes réponses sont gardées pour la prochaine fois.</Text> : null}
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
  const rows: [BilanStep, string, string][] = [];
  const sports = bilanSports(a);
  for (const st of bilanSteps(a)) {
    if (st === 'sport') rows.push([st, sports.length > 1 ? 'Sports' : 'Sport', sports.length ? sports.map((x, i) => `${SPORT_LABELS[x]}${i === 0 && sports.length > 1 ? ' (principal)' : ''}`).join(', ') : DASH]);
    if (st === 'place') rows.push([st, 'Musculation : où', a.trainingPlaces?.length ? a.trainingPlaces.map((x) => TRAINING_PLACE_LABELS[x]).join(', ') : 'Non précisé']);
    if (st === 'focus') rows.push([st, 'Musculation : à travailler', a.strengthFocus?.length ? a.strengthFocus.map((x) => STRENGTH_FOCUS_LABELS[x]).join(', ') : 'Non précisé']);
    if (st === 'status') rows.push([st, 'Situation', a.practiceStatus ? PRACTICE_STATUS_LABELS[a.practiceStatus] : DASH]);
    if (st === 'experience') rows.push([st, 'Pratique régulière', a.experience ? EXPERIENCE_LABELS[a.experience] : DASH]);
    if (st === 'break') rows.push([st, 'Durée de l’arrêt', a.breakLength ? BREAK_LENGTH_LABELS[a.breakLength] : DASH]);
    if (st === 'resumed') rows.push([st, 'Reprise', a.resumedSince ? RESUMED_SINCE_LABELS[a.resumedSince] : DASH]);
    if (st === 'sessions') rows.push([st, 'Séances par semaine', a.weeklySessions ? `${WEEKLY_SESSIONS_LABELS[a.weeklySessions]} fois` : DASH]);
    if (st === 'longest') rows.push([st, 'Plus longue sortie', a.longestRecent ? LONGEST_RECENT_LABELS[a.longestRecent] : 'Non précisé']);
    if (st === 'level') rows.push([st, 'Niveau', a.level ? LEVEL_LABELS[a.level].label : DASH]);
    if (st === 'hours') rows.push([st, 'Heures par semaine', a.weeklyHours ? WEEKLY_HOURS_LABELS[a.weeklyHours] : 'Non précisé']);
    if (st === 'days') rows.push([st, 'Jours disponibles', a.availableDays?.length ? a.availableDays.map((d) => DAY_LABELS[d - 1]).join(' ') : 'Non précisés']);
    if (st === 'time') rows.push([st, 'Temps et habitudes', [
      a.weekdayMinutes ? `${WEEKDAY_MINUTES_LABELS[a.weekdayMinutes]} en semaine` : null,
      a.preferredTime ? PREFERRED_TIME_LABELS[a.preferredTime].toLowerCase() : null,
      a.longDay ? `séance longue le ${(DAY_LABELS[a.longDay - 1] ?? '').toLowerCase()}` : null,
    ].filter(Boolean).join(' · ') || 'Non précisé']);
    if (st === 'equipment') rows.push([st, 'Matériel et contraintes', [
      a.equipment?.length ? a.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ') : null, a.practicalConstraints?.trim() || null,
    ].filter(Boolean).join(' · ') || 'Non précisé']);
    if (st === 'goal') rows.push([st, 'Objectif', [a.mainGoal, a.nextEventName, a.nextEventDate ? formatLongDate(a.nextEventDate).toLowerCase() : null].filter(Boolean).join(' · ') || 'Non précisé']);
  }
  return rows;
}
