'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import {
  DAY_LABELS, EXPERIENCES, EXPERIENCE_LABELS, LEVELS, LEVEL_LABELS, LOCALES, LOCALE_LABELS, SPORTS, SPORT_LABELS,
  WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS,
  type Experience, type Level, type Locale, type Sport, type WeeklyHours, type WeeklySessions,
} from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { MascotSays } from './mascot';
import { fieldError, useIntent } from './use-intent';

export interface OnboardingInitial {
  displayName: string;
  locale: Locale;
  timeZone: string;
  profile: {
    sport: Sport; level: Level; experience: Experience; weeklySessions: WeeklySessions; weeklyHours: WeeklyHours | null;
    availableDays: number[]; mainGoal: string | null; nextEventName: string | null; nextEventDate: string | null;
    /** Réponses du bilan (D-054) non modifiables ici : renvoyées telles quelles pour ne pas les effacer. */
    bilan?: { practiceStatus: string | null; breakLength: string | null; resumedSince: string | null; longestRecent: string | null };
  } | null;
}

interface Props {
  wid: string;
  coachSpace: string;
  zones: string[];
  initial: OnboardingInitial;
  /** wizard : trois étapes (première fois) ; single : tout sur une page (onglet Profil). */
  mode: 'wizard' | 'single';
  after: string;
}

const STEP_TITLES = ['Toi', 'Ta pratique', 'Tes objectifs'];

function Radios<T extends string>({ name, legend, options, value, onChange, labels, hints, chips }: {
  name: string; legend: string; options: readonly T[]; value: T | ''; onChange: (v: T) => void;
  labels: Record<T, string>; hints?: Record<T, string>; chips?: boolean;
}) {
  return (
    <fieldset className={chips ? 'choice' : 'choice'}>
      <legend>{legend}</legend>
      <div className={chips ? 'chips' : 'stack'} style={chips ? undefined : { display: 'grid', gap: 8 }}>
        {options.map((o) => (
          <label key={o}>
            <input type="radio" name={name} id={`${name}-${o}`} value={o} checked={value === o} onChange={() => onChange(o)} />
            <span>{labels[o]}{hints ? <span className="hint-line">{hints[o]}</span> : null}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * X07 enrichi (D-021) : profil de compte puis profil sportif, sans donnée de santé.
 * Enregistre le nom et la langue (PATCH /me), le fuseau (PATCH athlete-settings) et le profil (PUT athlete-profile).
 */
export function AthleteOnboarding({ wid, coachSpace, zones, initial, mode, after }: Props) {
  const router = useRouter();
  const p = initial.profile;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.displayName);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [timeZone, setTimeZone] = useState(initial.timeZone);
  const [sport, setSport] = useState<Sport | ''>(p?.sport ?? '');
  const [level, setLevel] = useState<Level | ''>(p?.level ?? '');
  const [experience, setExperience] = useState<Experience | ''>(p?.experience ?? '');
  const [sessions, setSessions] = useState<WeeklySessions | ''>(p?.weeklySessions ?? '');
  const [hours, setHours] = useState<WeeklyHours | ''>(p?.weeklyHours ?? '');
  const [days, setDays] = useState<number[]>(p?.availableDays ?? []);
  const [goal, setGoal] = useState(p?.mainGoal ?? '');
  const [eventName, setEventName] = useState(p?.nextEventName ?? '');
  const [eventDate, setEventDate] = useState(p?.nextEventDate ?? '');
  const [missing, setMissing] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const me = useIntent<unknown>();
  const tz = useIntent<unknown>();
  const prof = useIntent<unknown>();
  const pending = me.pending || tz.pending || prof.pending;
  const error = me.error ?? tz.error ?? prof.error;
  const wizard = mode === 'wizard';
  const show = (k: number) => !wizard || step === k;

  function check(k: number): string | null {
    if (k === 0 && name.trim() === '') return 'Indique ton nom.';
    if (k === 1 && (!sport || !level || !experience || !sessions)) return 'Réponds aux quatre premières questions sur ta pratique.';
    return null;
  }
  function go(k: number) {
    const msg = check(step);
    if (k > step && msg) {
      setMissing(msg);
      return;
    }
    setMissing(null);
    setStep(k);
    top.current?.scrollIntoView({ block: 'start' });
    top.current?.focus();
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    // Touche Entrée avant la dernière étape : avancer, ne jamais envoyer (bug corrigé, D-021).
    if (wizard && step < 2) {
      go(step + 1);
      return;
    }
    const msg = check(0) ?? check(1);
    if (msg) {
      setMissing(msg);
      if (wizard) setStep(check(0) ? 0 : 1);
      return;
    }
    setMissing(null);
    if (name.trim() !== initial.displayName || locale !== initial.locale) {
      if (!(await me.run('PATCH', '/api/v1/me', { displayName: name, locale }))) return;
    }
    if (timeZone !== initial.timeZone) {
      if (!(await tz.run('PATCH', `/api/v1/workspaces/${wid}/athlete-settings`, { timeZone }))) return;
    }
    const saved = await prof.run('PUT', `/api/v1/workspaces/${wid}/athlete-profile`, {
      sport, level, experience, weeklySessions: sessions, weeklyHours: hours || null,
      availableDays: days, mainGoal: goal, nextEventName: eventName, nextEventDate: eventDate || null,
      ...(p?.bilan ?? {}),
    });
    if (saved) {
      router.push(after);
      router.refresh();
    }
  }

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div ref={top} tabIndex={-1} style={{ outline: 'none' }}>
        {wizard ? (
          <>
            <div className="steps" aria-hidden="true">{STEP_TITLES.map((t, k) => <span key={t} className={k <= step ? 'on' : ''} />)}</div>
            <p className="muted" aria-live="polite">Étape {step + 1} sur 3 · {STEP_TITLES[step]}</p>
          </>
        ) : null}
      </div>
      <ErrorSummary error={error} onRetry={() => void submit()} />

      {show(0) ? (
        <section className="stack" aria-labelledby="s-toi">
          <h2 id="s-toi">Toi</h2>
          {wizard ? <MascotSays>Commençons simple : comment t’appelles-tu, et où t’entraînes-tu ?</MascotSays> : null}
          <div className="field">
            <label htmlFor="displayName">Ton nom <span className="hint">Nom de ton compte. Ton coach garde le nom de ton dossier.</span></label>
            <input id="displayName" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldError(error, 'displayName')} />
          </div>
          <div className="field">
            <label htmlFor="locale">Langue</label>
            <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="timeZone">Fuseau horaire <span className="hint">Tes séances s’affichent selon ce fuseau. Les séances déjà prévues gardent leur date.</span></label>
            <select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </section>
      ) : null}

      {show(1) ? (
        <section className="stack" aria-labelledby="s-pratique">
          <h2 id="s-pratique">Ta pratique</h2>
          {wizard ? <MascotSays>Pour que ton coach adapte tes séances, dis-moi où tu en es. Il n’y a pas de mauvaise réponse !</MascotSays> : null}
          <Radios name="sport" legend="Ton sport principal" options={SPORTS} value={sport} onChange={setSport} labels={SPORT_LABELS} chips />
          <Radios name="level" legend="Ton niveau" options={LEVELS} value={level} onChange={setLevel}
            labels={Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].label])) as Record<Level, string>}
            hints={Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].hint])) as Record<Level, string>} />
          <Radios name="experience" legend="Depuis combien de temps pratiques-tu ?" options={EXPERIENCES} value={experience} onChange={setExperience} labels={EXPERIENCE_LABELS} chips />
          <Radios name="sessions" legend="Combien de séances par semaine en ce moment ?" options={WEEKLY_SESSIONS} value={sessions} onChange={setSessions} labels={WEEKLY_SESSIONS_LABELS} chips />
          <Radios name="hours" legend="Temps d’entraînement par semaine (facultatif)" options={WEEKLY_HOURS} value={hours} onChange={setHours} labels={WEEKLY_HOURS_LABELS} chips />
        </section>
      ) : null}

      {show(2) ? (
        <section className="stack" aria-labelledby="s-objectifs">
          <h2 id="s-objectifs">Tes objectifs</h2>
          {wizard ? <MascotSays mood="wink">Dernière ligne droite ! Qu’est-ce qui te motive, et quand peux-tu t’entraîner ?</MascotSays> : null}
          <div className="field">
            <label htmlFor="goal">Ton objectif principal <span className="hint">Facultatif · par exemple « courir un 10 km sans m’arrêter »</span></label>
            <textarea id="goal" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} aria-invalid={!!fieldError(error, 'mainGoal')} />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="eventName">Prochaine course <span className="hint">Facultatif</span></label>
              <input id="eventName" maxLength={120} value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="eventDate">Date</label>
              <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-invalid={!!fieldError(error, 'nextEventDate')} />
            </div>
          </div>
          <fieldset className="choice">
            <legend>Tes jours disponibles pour t’entraîner</legend>
            <div className="chips">
              {DAY_LABELS.map((d, k) => (
                <label key={d}><input type="checkbox" checked={days.includes(k + 1)} onChange={() => toggleDay(k + 1)} /> {d}</label>
              ))}
            </div>
          </fieldset>
          <p className="muted">Ces réponses sont visibles uniquement par ton coach, dans l’espace « {coachSpace} ». Ce questionnaire ne demande aucune information de santé.</p>
        </section>
      ) : null}

      {missing ? <p className="banner warn" role="alert">{missing}</p> : null}
      <div className="actions">
        {wizard && step > 0 ? <button key="prev" type="button" className="btn" onClick={() => go(step - 1)}>Précédent</button> : null}
        {/* Clés distinctes : le bouton « Suivant » n’est jamais réutilisé comme bouton d’envoi pendant le clic. */}
        {wizard && step < 2 ? (
          <button key="next" type="button" className="btn primary" onClick={() => go(step + 1)}>Suivant</button>
        ) : (
          <button key="submit" type="submit" className="btn primary" disabled={pending}>{pending ? 'Enregistrement…' : wizard ? 'Terminer et voir ma séance' : 'Enregistrer'}</button>
        )}
      </div>
    </form>
  );
}
