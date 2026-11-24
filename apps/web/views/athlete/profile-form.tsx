'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  DAY_LABELS, EXPERIENCES, EXPERIENCE_LABELS, LEVELS, LEVEL_LABELS, LOCALES, LOCALE_LABELS, SPORTS, SPORT_LABELS,
  WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS,
  type Experience, type Level, type Locale, type Sport, type WeeklyHours, type WeeklySessions,
} from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { Banner, Button, ChipChecks, ChipChoice, ChoiceGroup, Divider, Eyebrow, Field, Grid, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

/** Ce que le formulaire « Mes informations » reçoit (repris de l’ancien accueil, supprimé en D-159). */
export interface OnboardingInitial {
  displayName: string;
  locale: Locale;
  timeZone: string;
  profile: {
    sport: Sport; level: Level; experience: Experience; weeklySessions: WeeklySessions; weeklyHours: WeeklyHours | null;
    availableDays: number[]; mainGoal: string | null; nextEventName: string | null; nextEventDate: string | null;
    /** Réponses du bilan (D-054) non modifiables ici : renvoyées telles quelles pour ne pas les effacer. */
    bilan?: {
      practiceStatus: string | null; breakLength: string | null; resumedSince: string | null; longestRecent: string | null;
      /** D-066 : renvoyés aussi pour ne pas les effacer. */
      weekdayMinutes?: string | null; preferredTime?: string | null; longDay?: number | null; equipment?: string[]; practicalConstraints?: string | null;
    };
  } | null;
}

/**
 * X07 enrichi (D-021), refonte Chrono (D-136) · « Mes informations » dans le Profil de l’élève : compte, pratique,
 * objectifs, sans donnée de santé. Enregistre le nom et la langue (PATCH /me), le fuseau (PATCH athlete-settings)
 * et le profil (PUT athlete-profile) ; les réponses du bilan sont renvoyées telles quelles pour ne pas les effacer.
 */
export function ProfileForm({ wid, coachSpace, zones, initial, after }: { wid: string; coachSpace: string; zones: string[]; initial: OnboardingInitial; after: string }) {
  const router = useRouter();
  const p = initial.profile;
  const [name, setName] = useState(initial.displayName);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [timeZone, setTimeZone] = useState(initial.timeZone);
  const [sport, setSport] = useState<Sport | null>(p?.sport ?? null);
  const [level, setLevel] = useState<Level | null>(p?.level ?? null);
  const [experience, setExperience] = useState<Experience | null>(p?.experience ?? null);
  const [sessions, setSessions] = useState<WeeklySessions | null>(p?.weeklySessions ?? null);
  const [hours, setHours] = useState<WeeklyHours | null>(p?.weeklyHours ?? null);
  const [days, setDays] = useState<number[]>(p?.availableDays ?? []);
  const [goal, setGoal] = useState(p?.mainGoal ?? '');
  const [eventName, setEventName] = useState(p?.nextEventName ?? '');
  const [eventDate, setEventDate] = useState(p?.nextEventDate ?? '');
  const [missing, setMissing] = useState<string | null>(null);
  const me = useIntent<unknown>();
  const tz = useIntent<unknown>();
  const prof = useIntent<unknown>();
  const pending = me.pending || tz.pending || prof.pending;
  const error = me.error ?? tz.error ?? prof.error;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const msg = name.trim() === '' ? 'Indique ton nom.' : !sport || !level || !experience || !sessions ? 'Réponds aux quatre premières questions sur ta pratique.' : null;
    if (msg) { setMissing(msg); return; }
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
    if (saved) { router.push(after); router.refresh(); }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={6}>
        <ErrorSummary error={error} onRetry={() => void submit()} />

        <Stack as="section" gap={4} aria-labelledby="s-toi">
          <Eyebrow as="h3" tone="coach" id="s-toi">Toi</Eyebrow>
          <Field id="displayName" label="Ton nom" hint="Nom de ton compte. Ton coach garde le nom de ton dossier." error={fieldError(error, 'displayName') ?? null}>
            <Input id="displayName" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} hasHint invalid={!!fieldError(error, 'displayName')} />
          </Field>
          <Grid cols={2} gap={3}>
            <Field id="locale" label="Langue">
              <Select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
              </Select>
            </Field>
            <Field id="timeZone" label="Fuseau horaire">
              <Select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
              </Select>
            </Field>
          </Grid>
          <Text size="sm" muted>Tes séances s’affichent selon ce fuseau. Les séances déjà prévues gardent leur date.</Text>
        </Stack>

        <Divider />
        <Stack as="section" gap={5} aria-labelledby="s-pratique">
          <Eyebrow as="h3" tone="coach" id="s-pratique">Ta pratique</Eyebrow>
          <ChipChoice legend="Ton sport principal" name="sport" idPrefix="sport" clearable={false} value={sport} onChange={(v) => v && setSport(v)}
            options={SPORTS.map((x) => ({ value: x, label: SPORT_LABELS[x] }))} />
          <ChoiceGroup legend="Ton niveau" name="level" idPrefix="level" columns={1} value={level} onChange={setLevel}
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l].label, hint: LEVEL_LABELS[l].hint }))} />
          <ChipChoice legend="Depuis combien de temps pratiques-tu ?" name="experience" clearable={false} value={experience} onChange={(v) => v && setExperience(v)}
            options={EXPERIENCES.map((x) => ({ value: x, label: EXPERIENCE_LABELS[x] }))} />
          <ChipChoice legend="Combien de séances par semaine en ce moment ?" name="sessions" clearable={false} value={sessions} onChange={(v) => v && setSessions(v)}
            options={WEEKLY_SESSIONS.map((x) => ({ value: x, label: WEEKLY_SESSIONS_LABELS[x] }))} />
          <ChipChoice legend="Temps d’entraînement par semaine" hint="Facultatif" name="hours" value={hours} onChange={setHours}
            options={WEEKLY_HOURS.map((x) => ({ value: x, label: WEEKLY_HOURS_LABELS[x] }))} />
        </Stack>

        <Divider />
        <Stack as="section" gap={4} aria-labelledby="s-objectifs">
          <Eyebrow as="h3" tone="coach" id="s-objectifs">Tes objectifs</Eyebrow>
          <Field id="goal" label="Ton objectif principal" hint="Facultatif · par exemple « courir un 10 km sans m’arrêter »" error={fieldError(error, 'mainGoal') ?? null}>
            <Textarea id="goal" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} hasHint invalid={!!fieldError(error, 'mainGoal')} />
          </Field>
          <Grid cols={2} gap={3}>
            <Field id="eventName" label="Prochaine course" hint="Facultatif">
              <Input id="eventName" maxLength={120} value={eventName} onChange={(e) => setEventName(e.target.value)} hasHint />
            </Field>
            <Field id="eventDate" label="Date" error={fieldError(error, 'nextEventDate') ?? null}>
              <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} invalid={!!fieldError(error, 'nextEventDate')} />
            </Field>
          </Grid>
          <ChipChecks legend="Tes jours disponibles pour t’entraîner" value={days} onChange={(v) => setDays([...v].sort())}
            options={DAY_LABELS.map((d, k) => ({ value: k + 1, label: d }))} />
          <Text size="sm" muted>Ces réponses sont visibles uniquement par ton coach, dans l’espace « {coachSpace} ». Aucune question de santé.</Text>
        </Stack>

        {missing ? <Banner tone="warning">{missing}</Banner> : null}
        <Button type="submit" variant="coach" size="lg" block loading={pending}>{pending ? 'Enregistrement…' : 'Enregistrer mes informations'}</Button>
      </Stack>
    </form>
  );
}
