'use client';

import { useState } from 'react';
import { AnswerList, Button, ChoiceGroup, Cluster, Field, Heading, Input, Stack, Textarea, Toast } from '@/design';

/** Parties interactives de la page du design system : choix, champs, message bref. */
export function DemoInteractive() {
  const [state, setState] = useState<'done' | 'partial' | 'missed' | null>('done');
  const [toast, setToast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState<string | null>('regular');
  const [places, setPlaces] = useState<string[]>(['home']);
  return (
    <Stack gap={5}>
      <ChoiceGroup legend="Ta séance d’aujourd’hui ?" name="demo-state" value={state} onChange={setState}
        options={[{ value: 'done', label: 'Faite', icon: 'check' }, { value: 'partial', label: 'En partie', icon: 'half' }, { value: 'missed', label: 'Pas faite', icon: 'close' }]} />
      <Heading level={3} size={4} id="demo-answer">Une réponse (le toucher fait avancer, dans le bilan)</Heading>
      <AnswerList labelledBy="demo-answer" value={level} onPick={setLevel}
        options={[{ value: 'regular', label: 'Je pratique régulièrement' }, { value: 'resumed', label: 'J’ai repris après un arrêt' }, { value: 'stopped', label: 'J’ai arrêté', hint: 'Les questions suivantes s’adaptent' }]} />
      <Heading level={3} size={4} id="demo-answers">Plusieurs réponses</Heading>
      <AnswerList multiple labelledBy="demo-answers" value={places} onPick={(v) => setPlaces((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]))}
        options={[{ value: 'home', label: 'À la maison', hint: 'Le matériel est demandé ensuite' }, { value: 'gym', label: 'En salle' }, { value: 'outdoor', label: 'En extérieur' }]} />
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
