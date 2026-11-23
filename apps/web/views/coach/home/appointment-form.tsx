'use client';

import { useState, type FormEvent } from 'react';
import { addDays, newVideoLink, type AppointmentKind } from '@coachos/domain';
import { fieldError } from '@/components/use-intent';
import { Button, Checkbox, ChipChoice, Cluster, Disclosure, Field, Input, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import { useAction } from '@/views/coach/use-action';

const KINDS: { value: AppointmentKind; label: string }[] = [{ value: 'video', label: 'Visio' }, { value: 'call', label: 'Appel' }, { value: 'in_person', label: 'Rencontre' }];
const TIMES = ['08:00', '12:00', '18:00', '19:00'];
const DURATIONS = [15, 30, 45, 60];

/**
 * Planification rapide d’un rendez-vous (D-034), refonte Chrono (D-144) : type, jour, heure et durée en un toucher,
 * lien de visio créé en un clic, annonce à l’élève dans la conversation si la case est cochée.
 */
export function AppointmentForm({ wid, athletes, athleteId, timeZone, today, defaultTitle, idPrefix = 'ap', onDone, onCancel }: {
  wid: string; athletes: { id: string; name: string; timeZone: string }[]; athleteId?: string; timeZone: string; today: string; defaultTitle?: string;
  idPrefix?: string; onDone: () => void; onCancel: () => void;
}) {
  const { act, pending, error } = useAction();
  const [who, setWho] = useState(athleteId ?? athletes[0]?.id ?? '');
  const [kind, setKind] = useState<AppointmentKind>('video');
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(30);
  const [link, setLink] = useState(() => newVideoLink());
  const [notify, setNotify] = useState(true);
  const [prep, setPrep] = useState('');
  const athlete = athletes.find((a) => a.id === who);
  const firstOf = (id: string) => athletes.find((a) => a.id === id)?.name.split(' ')[0] ?? 'l’élève';
  const first = firstOf(who);
  const [title, setTitle] = useState(defaultTitle ?? `Point avec ${first}`);
  const tz = athlete?.timeZone ?? timeZone;
  const id = (k: string) => `${idPrefix}-${k}`;
  const urlError = fieldError(error, 'videoUrl');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await act('POST', `/api/v1/workspaces/${wid}/appointments`, {
      athleteId: who, title, kind, startsLocal: `${date}T${time}`, timeZone: tz, durationMin: duration,
      videoUrl: kind === 'video' ? link || null : null, prepNotes: prep || null, notify,
    });
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit}>
      <Stack gap={5}>
        <ErrorSummary error={error} labels={{ title: 'Objet', videoUrl: 'Lien de la visio', startsLocal: 'Jour et heure' }} ids={{ title: id('title'), videoUrl: id('url'), startsLocal: id('date') }} />
        {athletes.length > 1 ? (
          <Field id={id('athlete')} label="Avec">
            <Select id={id('athlete')} value={who} onChange={(e) => { setWho(e.target.value); setTitle(`Point avec ${firstOf(e.target.value)}`); }}>
              {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        ) : null}
        <ChipChoice name={id('kind')} legend="Type" clearable={false} options={KINDS} value={kind} onChange={(v) => v && setKind(v)} />
        <Field id={id('title')} label="Objet">
          <Input id={id('title')} maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <ChipChoice name={id('day')} legend="Jour" clearable={false} value={date} onChange={(v) => v && setDate(v)}
          options={[{ value: today, label: 'Aujourd’hui' }, { value: addDays(today, 1), label: 'Demain' }, { value: addDays(today, 2), label: 'Après-demain' }]}>
          <Field id={id('date')} label="Ou une autre date">
            <Input id={id('date')} type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </ChipChoice>
        <ChipChoice name={id('time')} legend="Heure" hint={`Heure de ${first} (${tz.replace(/_/g, ' ')})`} clearable={false} value={time} onChange={(v) => v && setTime(v)}
          options={TIMES.map((t) => ({ value: t, label: t }))}>
          <Field id={id('time-input')} label="Ou une autre heure">
            <Input id={id('time-input')} type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} required />
          </Field>
        </ChipChoice>
        <ChipChoice name={id('duration')} legend="Durée" clearable={false} value={duration} onChange={(v) => v && setDuration(v)}
          options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))} />
        {kind === 'video' ? (
          <Field id={id('url')} label="Lien de la visio" hint="Créé pour toi (Jitsi, sans compte), ou colle ton lien Zoom, Meet, Teams…" error={urlError}>
            <Cluster gap={2} nowrap>
              <Input id={id('url')} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" invalid={!!urlError} hasHint />
              <Button size="sm" onClick={() => setLink(newVideoLink())}>Nouveau lien</Button>
            </Cluster>
          </Field>
        ) : null}
        <Disclosure summary="Préparation (visible par toi seul·e)">
          <Field id={id('prep')} label="Points à aborder">
            <Textarea id={id('prep')} maxLength={4000} value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="Points à aborder, chiffres à revoir…" />
          </Field>
        </Disclosure>
        <Checkbox checked={notify} onChange={setNotify} label={`Prévenir ${first} dans la conversation`} hint="Avec « Rejoindre » et « Ajouter à mon agenda »." />
        {!who ? <Text size="sm" muted>Ajoute d’abord un élève pour planifier un rendez-vous.</Text> : null}
        <Cluster gap={2}>
          <Button type="submit" variant="primary" loading={pending} disabled={!who}>Planifier</Button>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        </Cluster>
      </Stack>
    </form>
  );
}
