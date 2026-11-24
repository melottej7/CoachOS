'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { fieldError, useIntent } from '@/components/use-intent';
import { Button, Checkbox, Field, Input, Select, Stack, setSimpleMode } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

/** X04, refonte Chrono (D-156) : créer un espace coach (nom, fuseau) ; ton nom de compte au passage ; mode simple coché (D-169). Même clé rejouée → même espace (C02-08). */
export function WorkspaceForm({ zones, defaultZone, currentName }: { zones: string[]; defaultZone: string; currentName: string }) {
  const router = useRouter();
  const [coachName, setCoachName] = useState(currentName);
  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const [simple, setSimple] = useState(true);
  const me = useIntent<{ displayName: string }>();
  const create = useIntent<{ id: string }>();
  const pending = create.pending || me.pending;
  const error = me.error ?? create.error;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (coachName.trim() !== currentName && !(await me.run('PATCH', '/api/v1/me', { displayName: coachName }))) return;
    const done = await create.run('POST', '/api/v1/workspaces', { name, timeZone });
    if (done) { setSimpleMode(simple); router.push(`/coach/${done.id}/settings?first=1`); }
  }
  const err = (p: string) => fieldError(error, p);
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={4}>
        <ErrorSummary error={error} onRetry={() => void submit()} labels={{ displayName: 'Ton nom', name: 'Nom de l’espace', timeZone: 'Fuseau horaire' }} />
        <Field id="displayName" label="Ton nom" hint="Prénom et nom, modifiables plus tard dans Mon compte" error={err('displayName')}>
          <Input id="displayName" required maxLength={100} autoComplete="name" value={coachName} onChange={(e) => setCoachName(e.target.value)} invalid={!!err('displayName')} hasHint />
        </Field>
        <Field id="name" label="Nom de l’espace" hint="Visible par tes élèves : ton nom, ton club ou ta marque. Modifiable ensuite dans Paramètres." error={err('name')}>
          <Input id="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} invalid={!!err('name')} hasHint autoFocus placeholder="Ex. Coaching Dupont, Running Club Namur" />
        </Field>
        <Field id="timeZone" label="Fuseau horaire" hint="Sert de valeur par défaut pour tes élèves" error={err('timeZone')}>
          <Select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-describedby="timeZone-hint">
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </Select>
        </Field>
        <Checkbox id="simple" checked={simple} onChange={setSimple} label="Commencer en mode simple"
          hint="L’essentiel d’abord : tes élèves, leurs séances et leurs retours. Tu pourras tout afficher dans Paramètres › Apparence." />
        <Button type="submit" variant="primary" size="lg" block loading={pending}>Créer mon espace</Button>
      </Stack>
    </form>
  );
}
