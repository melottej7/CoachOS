'use client';

import { useState } from 'react';
import { Button, ChoiceGroup, Cluster, Field, Input, Stack, Textarea, Toast } from '@/design';

/** Parties interactives de la page du design system : choix, champs, message bref. */
export function DemoInteractive() {
  const [state, setState] = useState<'done' | 'partial' | 'missed' | null>('done');
  const [toast, setToast] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Stack gap={5}>
      <ChoiceGroup legend="Ta séance d’aujourd’hui ?" name="demo-state" value={state} onChange={setState}
        options={[{ value: 'done', label: 'Faite', icon: 'check' }, { value: 'partial', label: 'En partie', icon: 'half' }, { value: 'missed', label: 'Pas faite', icon: 'close' }]} />
      <Field id="demo-title" label="Titre de la séance" hint="Ce que l’élève lira en premier.">
        <Input id="demo-title" placeholder="Footing facile" hasHint />
      </Field>
      <Field id="demo-err" label="Durée en minutes" error="Indique une durée entre 1 et 1 440 minutes.">
        <Input id="demo-err" defaultValue="0" invalid inputMode="numeric" />
      </Field>
      <Field id="demo-note" label="Consignes">
        <Textarea id="demo-note" defaultValue="Une allure où tu peux parler en phrases complètes." />
      </Field>
      <Cluster gap={2}>
        <Button variant="primary" loading={busy} onClick={() => { setBusy(true); setTimeout(() => setBusy(false), 1500); }}>Enregistrer</Button>
        <Button onClick={() => setToast(true)}>Déplacer la séance</Button>
      </Cluster>
      {toast ? <Toast action={{ label: 'Annuler', onClick: () => setToast(false) }}>« Footing facile » déplacé à mardi</Toast> : null}
    </Stack>
  );
}
