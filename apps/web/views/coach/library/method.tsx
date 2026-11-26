'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  EMPTY_NOTES, LEVELS, LEVEL_LABELS, METHOD_NOTE_INFO, METHOD_NOTE_KEYS, METHOD_STYLES, METHOD_STYLE_LABELS, QUALITY_KINDS, QUALITY_KIND_LABELS, ruleLabel,
  type CoachMethod, type MethodNoteKey, type MethodNotes, type Level, type MethodCandidate, type MethodRule, type MethodRuleDraft, type MethodStyle, type QualityKind,
} from '@coachos/domain';
import { newKey } from '@/components/api-client';
import { useIntent } from '@/components/use-intent';
import { Badge, Button, Card, Cluster, Disclosure, Field, Grid, Select, Stack, Text, Textarea } from '@/design';
import s from './library.module.css';

// D-072, refonte Chrono (D-154) : la méthode du coach. Chaque enregistrement crée une nouvelle version ; rien n’est appliqué sans lui.

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
type Kind = MethodRule['kind'];
const KIND_LABELS: Record<Kind, string> = {
  avoid_quality: 'Éviter un type de séance', max_quality: 'Limiter la qualité par semaine', volume_pct: 'Volume par défaut',
  long_day: 'Jour de la sortie longue', long_progressive: 'Sorties longues progressives',
};

function useSave(wid: string, version: number) {
  const router = useRouter();
  const intent = useIntent<{ version: number }>();
  const save = async (method: CoachMethod, reason: string) => {
    const r = await intent.run('PUT', `/api/v1/workspaces/${wid}/method`, { expectedVersion: version, method, reason: reason.slice(0, 120) });
    if (r) router.refresh();
    return Boolean(r);
  };
  return { ...intent, save };
}
const errorText = (e: ReturnType<typeof useIntent>['error']) => (e ? (e.kind === 'error' ? (e.fields[0]?.rule ?? e.message) : 'Connexion perdue. Réessaie.') : null);
const ErrorLine = ({ e }: { e: ReturnType<typeof useIntent>['error'] }) => (errorText(e) ? <Text size="sm" tone="danger" role="alert">{errorText(e)}</Text> : null);

export function MethodIdentity({ wid, version, method }: { wid: string; version: number; method: CoachMethod }) {
  const { save, pending, error } = useSave(wid, version);
  const [philosophy, setPhilosophy] = useState(method.philosophy ?? '');
  const [style, setStyle] = useState<MethodStyle | ''>(method.style ?? '');
  const changed = philosophy !== (method.philosophy ?? '') || style !== (method.style ?? '');
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await save({ ...method, philosophy: philosophy.trim() || null, style: style || null }, 'Philosophie et style'); }}>
      <Stack gap={4}>
        <Field id="m-philosophy" label="Ta philosophie" hint="En une ou deux phrases · ex. « La régularité avant l’intensité. »">
          <Textarea id="m-philosophy" maxLength={500} value={philosophy} onChange={(e) => setPhilosophy(e.target.value)} hasHint />
        </Field>
        <Field id="m-style" label="Ton style avec les élèves" hint="Servira aux brouillons de messages ; n’agit pas sur les séances">
          <Select id="m-style" value={style} onChange={(e) => setStyle(e.target.value as MethodStyle | '')} aria-describedby="m-style-hint">
            <option value="">Non précisé</option>{METHOD_STYLES.map((x) => <option key={x} value={x}>{METHOD_STYLE_LABELS[x]}</option>)}
          </Select>
        </Field>
        <ErrorLine e={error} />
        <Cluster><Button type="submit" size="sm" variant="primary" loading={pending} disabled={!changed}>Enregistrer</Button></Cluster>
      </Stack>
    </form>
  );
}

/**
 * IA-2 (D-190) · Ma méthode en six champs courts, lus par l’IA pour écrire comme toi. « Proposer depuis ma
 * bibliothèque » remplit une proposition à relire : rien n’est enregistré tant que tu n’enregistres pas.
 */
export function MethodNotesForm({ wid, version, method, ai }: { wid: string; version: number; method: CoachMethod; ai: boolean }) {
  const { save, pending, error } = useSave(wid, version);
  const initial = method.notes ?? EMPTY_NOTES;
  const [notes, setNotes] = useState<MethodNotes>(initial);
  const [fromAi, setFromAi] = useState(false);
  const proposal = useIntent<{ source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; notes: MethodNotes; note: string }>();
  const [offer, setOffer] = useState<{ source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; notes: MethodNotes; note: string } | null>(null);
  const changed = METHOD_NOTE_KEYS.some((k) => (notes[k] ?? '') !== (initial[k] ?? ''));
  const set = (k: MethodNoteKey, v: string) => setNotes((n) => ({ ...n, [k]: v }));
  const clean = (n: MethodNotes): MethodNotes => Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, n[k]?.trim() ? n[k]!.trim() : null])) as MethodNotes;
  return (
    <Stack gap={4}>
      {ai ? (
        <Card pad={4}>
          <Stack gap={3}>
            <Cluster gap={2}>
              <Button size="sm" icon="bolt" loading={proposal.pending} onClick={async () => { const r = await proposal.run('POST', `/api/v1/workspaces/${wid}/method/proposal`, {}); if (r) setOffer(r); }}>Proposer depuis ma bibliothèque</Button>
              <Text as="span" size="sm" muted>L’IA lit jusqu’à 20 de tes séances et propose un texte ; tu reprends, corriges ou écartes.</Text>
            </Cluster>
            <ErrorLine e={proposal.error} />
            {offer ? (
              <Stack gap={2} aria-live="polite">
                <Cluster gap={2}><Text strong>Proposition</Text><Badge tone={offer.source === 'claude' ? 'coach' : 'neutral'}>{offer.source === 'claude' ? 'Claude' : 'IA simulée'}</Badge></Cluster>
                {offer.note ? <Text size="sm">{offer.note}</Text> : null}
                {offer.status === 'ready' ? (
                  <>
                    <ul className={s.list} aria-label="Méthode proposée">
                      {METHOD_NOTE_KEYS.filter((k) => offer.notes[k]).map((k) => <li key={k}><Text size="sm"><strong>{METHOD_NOTE_INFO[k].label}</strong> · {offer.notes[k]}</Text></li>)}
                    </ul>
                    <Cluster gap={2}>
                      <Button size="sm" variant="primary" icon="check" onClick={() => { setNotes((n) => Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, offer.notes[k] ?? n[k]])) as MethodNotes); setFromAi(true); setOffer(null); }}>Reprendre dans le formulaire</Button>
                      <Button size="sm" variant="ghost" onClick={() => setOffer(null)}>Écarter</Button>
                    </Cluster>
                  </>
                ) : <Cluster><Button size="sm" variant="ghost" onClick={() => setOffer(null)}>Fermer</Button></Cluster>}
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}
      <form onSubmit={async (e) => { e.preventDefault(); if (await save({ ...method, notes: clean(notes) }, fromAi ? 'Méthode proposée par l’IA, relue' : 'Méthode en quelques mots')) setFromAi(false); }}>
        <Stack gap={4}>
          {fromAi ? <Text size="sm" tone="success" role="status">Proposition reprise : relis et corrige chaque champ, puis enregistre.</Text> : null}
          {METHOD_NOTE_KEYS.map((k) => (
            <Field key={k} id={`m-note-${k}`} label={METHOD_NOTE_INFO[k].label} hint={`300 caractères au plus · ex. « ${METHOD_NOTE_INFO[k].example} »`}>
              <Textarea id={`m-note-${k}`} rows={2} maxLength={300} value={notes[k] ?? ''} onChange={(e) => set(k, e.target.value)} hasHint />
            </Field>
          ))}
          <ErrorLine e={error} />
          <Cluster><Button type="submit" size="sm" variant="primary" loading={pending} disabled={!changed}>Enregistrer une nouvelle version</Button></Cluster>
        </Stack>
      </form>
    </Stack>
  );
}

export function MethodRules({ wid, version, method }: { wid: string; version: number; method: CoachMethod }) {
  const { save, pending, error } = useSave(wid, version);
  const [kind, setKind] = useState<Kind>('avoid_quality');
  const [quality, setQuality] = useState<QualityKind>('vma');
  const [n, setN] = useState(1);
  const [pct, setPct] = useState(90);
  const [day, setDay] = useState(7);
  const [level, setLevel] = useState<Level | ''>('');
  const draft = (): MethodRule => {
    const common = { id: newKey(), source: 'manual' as const, support: null, scope: { level: level || null, sport: null } };
    if (kind === 'avoid_quality') return { ...common, kind, quality };
    if (kind === 'max_quality') return { ...common, kind, n };
    if (kind === 'volume_pct') return { ...common, kind, pct };
    if (kind === 'long_day') return { ...common, kind, day };
    return { ...common, kind };
  };
  return (
    <Stack gap={4}>
      {method.rules.length ? (
        <ul className={s.list}>
          {method.rules.map((r) => (
            <li key={r.id} className={s.row}>
              <div className={s.rowMain}>
                <Text strong>{ruleLabel(r)}</Text>
                <Cluster gap={2}>
                  <Badge tone={r.source === 'learned' ? 'coach' : 'neutral'}>{r.source === 'learned' ? 'Apprise de tes corrections' : 'Ajoutée par toi'}</Badge>
                  {r.source === 'learned' && r.support ? <Text as="span" size="sm" muted>{r.support} observations</Text> : null}
                </Cluster>
              </div>
              <Button size="sm" variant="ghost" icon="trash" disabled={pending} aria-label={`Retirer la règle « ${ruleLabel(r)} »`}
                onClick={() => void save({ ...method, rules: method.rules.filter((x) => x.id !== r.id) }, `Règle retirée : ${ruleLabel(r)}`)}>Retirer</Button>
            </li>
          ))}
        </ul>
      ) : <Text muted>Aucune règle pour l’instant : le générateur applique ses réglages de base.</Text>}
      <Disclosure summary="Ajouter une règle">
        <form onSubmit={async (e) => { e.preventDefault(); const r = draft(); await save({ ...method, rules: [...method.rules, r] }, `Règle ajoutée : ${ruleLabel(r)}`); }}>
          <Stack gap={4}>
            <Grid min={190} gap={4}>
              <Field id="m-kind" label="Règle">
                <Select id="m-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{(Object.keys(KIND_LABELS) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</Select>
              </Field>
              {kind === 'avoid_quality' ? (
                <Field id="m-quality" label="Type de séance">
                  <Select id="m-quality" value={quality} onChange={(e) => setQuality(e.target.value as QualityKind)}>{QUALITY_KINDS.map((q) => <option key={q} value={q}>{QUALITY_KIND_LABELS[q]}</option>)}</Select>
                </Field>
              ) : null}
              {kind === 'max_quality' ? (
                <Field id="m-n" label="Séances de qualité au plus">
                  <Select id="m-n" value={n} onChange={(e) => setN(Number(e.target.value))}>{[0, 1, 2].map((x) => <option key={x} value={x}>{x}</option>)}</Select>
                </Field>
              ) : null}
              {kind === 'volume_pct' ? (
                <Field id="m-pct" label="Volume">
                  <Select id="m-pct" value={pct} onChange={(e) => setPct(Number(e.target.value))}>{[70, 75, 80, 85, 90, 95, 105, 110].map((x) => <option key={x} value={x}>{x} %</option>)}</Select>
                </Field>
              ) : null}
              {kind === 'long_day' ? (
                <Field id="m-day" label="Jour de la sortie longue">
                  <Select id="m-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select>
                </Field>
              ) : null}
              <Field id="m-level" label="Pour">
                <Select id="m-level" value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
                  <option value="">Tous mes élèves</option>{LEVELS.map((l) => <option key={l} value={l}>Niveau {LEVEL_LABELS[l].label.toLowerCase()}</option>)}
                </Select>
              </Field>
            </Grid>
            <Cluster><Button type="submit" size="sm" variant="primary" icon="plus" loading={pending}>Ajouter à ma méthode</Button></Cluster>
          </Stack>
        </form>
      </Disclosure>
      <ErrorLine e={error} />
    </Stack>
  );
}

export function MethodCandidates({ wid, version, method, items }: { wid: string; version: number; method: CoachMethod; items: MethodCandidate[] }) {
  const { save, pending, error } = useSave(wid, version);
  if (!items.length) return <Text muted>Rien pour l’instant. Quand tu retouches souvent les programmes générés de la même façon (au moins 5 fois, sur 2 semaines), une règle te sera proposée ici.</Text>;
  return (
    <Stack gap={3}>
      {items.map((c) => {
        const rule = { ...(c.rule as MethodRuleDraft), id: newKey(), source: 'learned', support: c.support } as MethodRule;
        return (
          <Card key={c.key} pad={4} tinted>
            <Stack gap={2}>
              <Text strong>{c.label}</Text>
              <Text size="sm" muted>{c.support} fois sur {c.weeks} semaines, {c.athletes} élève{c.athletes > 1 ? 's' : ''} · {c.counter ? `${c.counter} fois tu as gardé le contraire (${Math.round(c.concordance * 100)} % dans ce sens)` : 'aucun contre-exemple'}.</Text>
              <Cluster gap={2}>
                <Button size="sm" variant="primary" icon="check" disabled={pending}
                  onClick={() => void save({ ...method, rules: [...method.rules, rule] }, `Règle apprise acceptée : ${c.label}`)}>Ajouter à ma méthode</Button>
                <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => void save({ ...method, dismissed: [...method.dismissed, c.key] }, `Proposition écartée : ${c.label}`)}>Pas une règle</Button>
              </Cluster>
            </Stack>
          </Card>
        );
      })}
      <ErrorLine e={error} />
    </Stack>
  );
}
