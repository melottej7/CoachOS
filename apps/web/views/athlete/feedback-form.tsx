'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  activityTotals, applyFollowLog, asDone, strengthPlan, type StrengthEntry, CHANGES, formatDuration2, parseDuration, testDistanceOf, CHANGE_LABELS, describeBlock, DIFFICULTIES, DIFFICULTY_LABELS, FEELING_LABELS, READINESS, READINESS_LABELS, READINESS_QUESTION, type Readiness, RESULT_STATES, RESULT_STATE_LABELS, SPORTS, SPORT_LABELS,
  type Block, type Change, type Difficulty, type FeedbackActivity, type ResultState, type Sport,
} from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { followLogKey, readFollowElapsed, readFollowLog } from './follow-session';
import {
  Banner, Button, ChipChecks, ChipChoice, ChoiceGroup, Disclosure, Divider, Field, Grid, Heading, Input, LinkButton, ScaleChoice, Select, Stack, Text, Textarea,
  type IconName,
} from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { ActivityImport } from './activity-import';
import { StrengthLogEditor } from './strength-log-editor';

interface Props {
  wid: string;
  aid: string;
  sid: string;
  publishedRevision: number;
  plannedMinutes: number | null;
  workspaceName: string;
  /** Déroulé prévu : sert à demander les répétitions faites par série. */
  intervals: Block[];
  /** Titre de la séance : « Test 5 km » demande le chrono (D-090). */
  title?: string;
  sport: Sport;
  /** Date prévue et fuseau de l’élève : vérifier qu’une activité importée est la bonne (D-048). */
  plannedDate: string;
  timeZone: string;
  existing: {
    revision: number; state: ResultState; durationSeconds: number | null; distanceM: number | null; rpe: number | null; comment: string | null;
    overallFeeling: number | null; readiness?: Readiness | null; difficulties: Difficulty[]; changes: Change[]; actualSport: Sport | null; repeatsDone: number[];
    measureFile: 'fit' | 'tcx' | 'gpx' | null;
    activities: FeedbackActivity[];
    testSeconds?: number | null;
    strengthLog?: StrengthEntry[];
  } | null;
}

const STATE_ICONS: Record<ResultState, IconName> = { completed: 'check', partial: 'half', postponed: 'calendar', missed: 'close' };

/**
 * X43 · Retour détaillé (refonte Chrono, D-132) : en quelques gestes, à une main. Seul l’état est requis.
 * La saisie reste en mémoire si le réseau coupe ; « Réessayer » rejoue avec la même clé.
 */
export function FeedbackForm({ wid, aid, sid, publishedRevision, plannedMinutes, workspaceName, intervals, title, sport, plannedDate, timeZone, existing }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | ''>(existing?.state ?? '');
  const [minutes, setMinutes] = useState(existing?.durationSeconds ? String(Math.round(existing.durationSeconds / 60)) : '');
  const [rpe, setRpe] = useState(existing?.rpe === null || existing?.rpe === undefined ? '' : String(existing.rpe));
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [feeling, setFeeling] = useState<number | null>(existing?.overallFeeling ?? null);
  const [readiness, setReadiness] = useState<Readiness | null>(existing?.readiness ?? null);
  // D-090 : chrono d’un test (« Test 5 km »).
  const testMeters = title ? testDistanceOf(title, intervals) : null;
  const [testText, setTestText] = useState(existing?.testSeconds ? formatDuration2(existing.testSeconds) : '');
  const testSeconds = testText.trim() ? parseDuration(testText) : null;
  const [difficulties, setDifficulties] = useState<Difficulty[]>(existing?.difficulties ?? []);
  const [km, setKm] = useState(existing?.distanceM ? String(existing.distanceM / 1000).replace('.', ',') : '');
  const [changes, setChanges] = useState<Change[]>(existing?.changes ?? []);
  const [actualSport, setActualSport] = useState<Sport | ''>(existing?.actualSport ?? '');
  const repeats = intervals.filter((b): b is Extract<Block, { type: 'repeat' }> => b.type === 'repeat');
  const [repsText, setRepsText] = useState<string[]>(() => repeats.map((_, i) => (existing?.repeatsDone[i] === undefined ? '' : String(existing.repeatsDone[i]))));
  const [missingState, setMissingState] = useState(false);
  // D-096 (M4) : séries et charges d’une séance qui nomme des exercices ; reprend ce qui a été noté pendant « Suivre ».
  const plan = useMemo(() => strengthPlan(intervals), [intervals]);
  const [strength, setStrength] = useState<StrengthEntry[]>(() => (existing?.strengthLog?.length ? existing.strengthLog : asDone(plan)));
  useEffect(() => {
    if (existing?.strengthLog?.length || !plan.length) return;
    const noted = readFollowLog(sid);
    if (Object.keys(noted).length) setStrength(applyFollowLog(plan, noted));
  }, [existing?.strengthLog?.length, plan, sid]);
  // D-166 : durée mesurée par le chronomètre de « Suivre la séance », proposée si l’élève n’a rien saisi.
  const [timed, setTimed] = useState(false);
  useEffect(() => {
    if (existing?.durationSeconds) return;
    const ms = readFollowElapsed(sid);
    if (ms && ms >= 60_000) { setMinutes((m) => m || String(Math.round(ms / 60_000))); setTimed(true); }
  }, [existing?.durationSeconds, sid]);
  // Provenance (D-048) : mesures lues dans un fichier, tant que l’élève ne les modifie pas.
  const kmText = (m: number | null) => (m ? String(Math.round(m / 10) / 100).replace('.', ',') : '');
  const [imported, setImported] = useState<{ file: 'fit' | 'tcx' | 'gpx'; minutes: string; km: string } | null>(
    existing?.measureFile ? { file: existing.measureFile, minutes: existing.durationSeconds ? String(Math.round(existing.durationSeconds / 60)) : '', km: existing.distanceM ? String(existing.distanceM / 1000).replace('.', ',') : '' } : null,
  );
  // CE-X-03 (D-064) : activités rattachées ; durée et distance additionnées, tant que l’élève ne les modifie pas.
  const [activities, setActivities] = useState<FeedbackActivity[]>(existing?.activities ?? []);
  function changeActivities(next: FeedbackActivity[]) {
    const t = activityTotals(next);
    const mm = t.seconds ? String(Math.round(t.seconds / 60)) : '';
    const kk = kmText(t.distanceM);
    // Premier import : il remplit (geste explicite). Ensuite, les valeurs suivent les activités tant qu’elles ne sont pas corrigées à la main.
    const followed = activities.length === 0 || (!minutes && !km) || (imported !== null && imported.minutes === minutes && imported.km === km);
    setActivities(next);
    if (!next.length) { if (followed) { setMinutes(''); setKm(''); } setImported(null); return; }
    if (followed) { setMinutes(mm); setKm(kk); setImported({ file: next[0]!.format, minutes: mm, km: kk }); }
  }
  const { run, pending, error } = useIntent<{ item: { id: string; revision: number } }>();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!state) {
      setMissingState(true);
      document.getElementById('state-completed')?.focus();
      return;
    }
    const m = minutes.trim() === '' ? null : Number(minutes);
    const done = state === 'completed' || state === 'partial';
    const dist = km.trim() === '' ? null : Number(km.replace(',', '.'));
    // Répétitions : si une série est renseignée, les autres valent le prévu.
    const repeatsDone = done && repsText.some((t) => t.trim() !== '')
      ? repeats.map((r, i) => (repsText[i]!.trim() === '' ? r.times : Math.max(0, Math.min(50, Math.round(Number(repsText[i]) || 0)))))
      : [];
    const body = {
      publishedRevision,
      expectedRevision: existing?.revision ?? null,
      state,
      durationSeconds: state === 'missed' || state === 'postponed' || m === null || Number.isNaN(m) ? null : Math.round(m * 60),
      distanceM: done && dist !== null && !Number.isNaN(dist) && dist > 0 ? Math.round(dist * 1000) : null,
      rpe: rpe === '' ? null : Number(rpe),
      comment,
      overallFeeling: feeling,
      readiness,
      testSeconds: done && testMeters && testSeconds ? testSeconds : null,
      difficulties,
      changes: done ? changes : [],
      actualSport: done && changes.includes('other_sport') && actualSport ? actualSport : null,
      repeatsDone,
      strengthLog: done && plan.length ? strength : [],
      measureFile: done && imported && imported.minutes === minutes && imported.km === km && (minutes || km) ? imported.file : null,
      activities: done ? activities : [],
    };
    const sent = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, body);
    if (sent) {
      // D-096 (M4) : ce qui a été noté pendant « Suivre » est maintenant chez le coach.
      try { localStorage.removeItem(followLogKey(sid)); localStorage.removeItem(`coachos:suivre:${sid}`); } catch { /* stockage indisponible */ }
      router.push(`/athlete/${wid}/workouts/${sid}?notice=sent`);
      router.refresh();
    }
  }

  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  const err = (p: string) => fieldError(error, p);

  const done = state === 'completed' || state === 'partial';
  const rpeValue = rpe === '' ? null : Number(rpe);

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={6}>
        <ErrorSummary error={error} onRetry={() => void submit()} retryLabel="Renvoyer mon retour" />
        {conflict ? (
          <Banner tone="warning" title="Ta séance a changé" action={<LinkButton href={`/athlete/${wid}/workouts/${sid}`} size="sm">Relire la séance</LinkButton>}>
            {error.kind === 'error' ? error.message : ''} Ta saisie est conservée ici.
          </Banner>
        ) : null}

        <Stack gap={2}>
          <ChoiceGroup legend="As-tu fait cette séance ?" name="state" idPrefix="state" columns={2} value={state || null} onChange={(v) => { setState(v); setMissingState(false); }}
            describedBy={missingState && !state ? 'state-error' : undefined}
            options={RESULT_STATES.map((v) => ({ value: v, label: RESULT_STATE_LABELS[v], icon: STATE_ICONS[v] }))} />
          {missingState && !state ? <Text id="state-error" size="sm" role="alert" tone="danger">Choisis une réponse pour envoyer ton retour.</Text> : null}
        </Stack>

        {done ? (
          <Stack as="section" gap={5} aria-labelledby="fb-done">
            <Divider />
            <Heading level={2} size={4} id="fb-done">Ce que tu as fait</Heading>
            {testMeters ? (
              <Field id="test-time" label={`Ton chrono sur le ${testMeters >= 1000 ? `${String(testMeters / 1000).replace('.', ',')} km` : `${testMeters} m`}`}
                hint="Le temps du test seul, sans échauffement (ex. 27:45)"
                error={testText.trim() && !testSeconds ? 'Écris le temps ainsi : 27:45 ou 1:02:30' : err('testSeconds') ?? null}>
                <Input id="test-time" inputMode="text" placeholder="27:45" value={testText} onChange={(e) => setTestText(e.target.value)}
                  hasHint invalid={Boolean((testText.trim() && !testSeconds) || err('testSeconds'))} />
              </Field>
            ) : null}
            <ActivityImport plannedDate={plannedDate} plannedSport={sport} timeZone={timeZone} items={activities} onChange={changeActivities} />
            {err('activities') ? <Text size="sm" role="alert" tone="danger">{err('activities')}</Text> : null}
            {/* La distance n’a pas de sens pour une séance de renforcement. */}
            <Grid cols={sport === 'strength' ? 1 : 2} gap={3}>
              <Field id="duration" label="Durée (min)" hint={[timed ? 'D’après ton chronomètre de séance' : null, plannedMinutes ? `prévu ${plannedMinutes} min` : null].filter(Boolean).join(' · ').replace(/^p/, 'P') || 'Facultatif'} error={err('durationSeconds') ?? null}>
                <Input id="duration" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} hasHint invalid={!!err('durationSeconds')} />
              </Field>
              {sport === 'strength' ? null : (
                <Field id="distance" label="Distance (km)" hint="Facultatif" error={err('distanceM') ?? null}>
                  <Input id="distance" inputMode="decimal" placeholder="8,5" value={km} onChange={(e) => setKm(e.target.value)} hasHint invalid={!!err('distanceM')} />
                </Field>
              )}
            </Grid>

            {plan.length ? (
              <>
                <StrengthLogEditor plan={plan} value={strength} onChange={setStrength} onReset={() => setStrength(asDone(plan))} />
                {err('strengthLog') ? <Text size="sm" role="alert" tone="danger">{err('strengthLog')}</Text> : null}
              </>
            ) : null}

            <Disclosure summary={state === 'partial' ? 'Qu’est-ce qui a changé ?' : 'Ma séance était différente du prévu'}
              open={state === 'partial' || changes.length > 0 || repsText.some((t) => t !== '')}>
              <Stack gap={4}>
                <ChipChecks legend="Ce qui a changé" hint="Facultatif · aide ton coach à ajuster" value={changes} onChange={setChanges}
                  options={CHANGES.map((c) => ({ value: c, label: CHANGE_LABELS[c] }))} />
                {changes.includes('other_sport') ? (
                  <Field id="actual-sport" label="Sport pratiqué à la place">
                    <Select id="actual-sport" value={actualSport} onChange={(e) => setActualSport(e.target.value as Sport | '')}>
                      <option value="">Choisir…</option>
                      {SPORTS.filter((x) => x !== sport).map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}
                    </Select>
                  </Field>
                ) : null}
                {repeats.length && !plan.length ? (
                  <Stack gap={3}>
                    <Text strong>Répétitions faites <Text as="span" size="sm" muted>· laisse vide si tout a été fait</Text></Text>
                    {repeats.map((r, i) => (
                      <Field key={i} id={`reps-${i}`} label={describeBlock(r, sport)} hint={`sur ${r.times}`}>
                        <Input id={`reps-${i}`} type="number" inputMode="numeric" min={0} max={r.times} placeholder={String(r.times)} value={repsText[i]} hasHint
                          onChange={(e) => setRepsText((cur) => cur.map((t, j) => (j === i ? e.target.value : t)))} />
                      </Field>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Disclosure>
          </Stack>
        ) : null}

        <Stack as="section" gap={5} aria-labelledby="fb-feel">
          <Divider />
          <Heading level={2} size={4} id="fb-feel">Ton ressenti</Heading>
          <ScaleChoice legend="Effort ressenti" hint="Facultatif · de 0 (très facile) à 10 (maximal)" name="rpe" min={0} max={10}
            value={rpeValue} onChange={(v) => setRpe(v === null ? '' : String(v))} lowLabel="Très facile" highLabel="Maximal" idPrefix="rpe" />
          <ChipChoice legend="Ressenti général" hint="Facultatif" name="feeling" value={feeling} onChange={setFeeling}
            options={([1, 2, 3, 4, 5] as const).map((v) => ({ value: v, label: FEELING_LABELS[v] }))} />
          {/* D-088 : question du fondateur, sans parler du corps ; le coach en parle ensuite avec l’élève. */}
          <ChipChoice legend={READINESS_QUESTION} hint="Facultatif" name="readiness" value={readiness} onChange={setReadiness}
            options={READINESS.map((v) => ({ value: v, label: READINESS_LABELS[v] }))}>
            {readiness === 'not_quite' || readiness === 'no' ? (
              <Text size="sm" muted role="status">Merci, ton coach est prévenu et en parlera avec toi. Pas besoin d’expliquer pourquoi ici.</Text>
            ) : null}
          </ChipChoice>
          <ChipChecks legend="Une difficulté particulière ?" hint="Facultatif" value={difficulties} onChange={setDifficulties}
            options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))} />
          <Field id="comment" label="Commentaire" hint={`Facultatif · lu par ton coach (${workspaceName})`}>
            <Textarea id="comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} hasHint />
          </Field>
        </Stack>

        <Stack gap={2}>
          <Button type="submit" variant="coach" size="lg" block loading={pending}>{pending ? 'Envoi…' : existing ? 'Enregistrer la correction' : 'Envoyer le retour'}</Button>
          <LinkButton href={`/athlete/${wid}/workouts/${sid}`} variant="ghost" block>Retour à la séance</LinkButton>
        </Stack>
      </Stack>
    </form>
  );
}
