'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  AUTO_RULE_DELAY, AUTO_RULE_INFO, AUTO_RULE_ORDER, DEFAULT_RELANCE_TEMPLATES, fillRelance, RELANCE_KINDS, RELANCE_LABELS, RELANCE_PLACEHOLDER_HINTS,
  RELANCE_PLACEHOLDERS, unknownPlaceholders, type AutoRule, type AutoRuleSetting, type RelanceKind,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { fieldError, useIntent } from '@/components/use-intent';
import { Badge, Button, Card, Checkbox, Cluster, Field, Input, Stack, Text, Textarea } from '@/design';
import s from './settings.module.css';

/**
 * CE-H-04 (D-045), refonte Chrono (D-155) : chaque coach choisit les suivis qui apparaissent seuls dans son Accueil, et leur délai.
 */
export function AutoRulesForm({ wid, initial }: { wid: string; initial: Record<AutoRule, AutoRuleSetting> }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ rules: AutoRuleSetting[] }>();
  const [rules, setRules] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (rule: AutoRule, patch: Partial<AutoRuleSetting>) => { setSaved(false); setRules((r) => ({ ...r, [rule]: { ...r[rule], ...patch } })); };

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = await run('PUT', `/api/v1/workspaces/${wid}/auto-task-rules`, { rules: AUTO_RULE_ORDER.map((k) => rules[k]) });
    if (r) { setSaved(true); router.refresh(); }
  }

  return (
    <form onSubmit={save} noValidate>
      <Stack gap={4}>
        <ul className={s.rules}>
          {AUTO_RULE_ORDER.map((rule, i) => {
            const st = rules[rule];
            const d = AUTO_RULE_DELAY[rule];
            const info = AUTO_RULE_INFO[rule];
            const err = fieldError(error, `rules.${i}.delayDays`);
            return (
              <li key={rule} className={s.rule} data-off={st.enabled ? undefined : ''}>
                <div className={s.ruleText}>
                  <Checkbox id={`rule-${rule}`} checked={st.enabled} onChange={(v) => set(rule, { enabled: v })}
                    label={info.title} hint={rule === 'no_upcoming' ? 'Aucune séance publiée sur la période choisie' : info.reason} />
                </div>
                {d ? (
                  <span className={s.delay}>
                    <Input id={`delay-${rule}`} type="number" inputMode="numeric" min={d.min} max={d.max} value={st.delayDays ?? d.default} disabled={!st.enabled}
                      invalid={!!err} aria-label={`${info.title} : nombre de ${d.label}`}
                      onChange={(e) => set(rule, { delayDays: e.target.value === '' ? d.min : Math.max(d.min, Math.min(d.max, Math.round(Number(e.target.value)))) })} />
                    <span aria-hidden="true">{d.label}</span>
                    {err ? <Text as="span" size="sm" tone="danger">{err}</Text> : null}
                  </span>
                ) : <Text as="span" size="sm" muted>Dès que l’information manque</Text>}
              </li>
            );
          })}
        </ul>
        <Cluster gap={3}>
          <Button type="submit" variant="primary" icon="check" loading={pending}>Enregistrer les suivis</Button>
          {saved ? <Text as="span" size="sm" tone="success" role="status">Enregistré · ton Accueil est à jour</Text> : null}
        </Cluster>
        {error && error.kind !== 'error' ? <Text size="sm" tone="danger" role="alert">Connexion perdue. Réessaie.</Text> : null}
        {error && error.kind === 'error' && !error.fields?.length ? <Text size="sm" tone="danger" role="alert">{error.message}</Text> : null}
      </Stack>
    </form>
  );
}

// D-104 · Mes relances : un modèle par situation, avec des trous remplis au moment de préparer la relance.

const SAMPLE = { first: 'Emma', workout: { id: 'x', date: '2026-11-17', title: 'Côtes 8 × 30″', state: null }, silentDays: 9, done7: 3, due7: 3 } as const;
const WHEN: Record<RelanceKind, string> = {
  silent: 'Aucune nouvelle depuis 7 jours ou plus',
  readiness: 'A répondu ne pas être à 100 %',
  missed: 'Séances non faites ou sans nouvelle',
  no_feedback: 'Pas de retour 2 jours après une séance',
  bravo: 'Toutes ses séances faites sur 7 jours',
};

export function RelanceTemplates({ wid, mine }: { wid: string; mine: Partial<Record<RelanceKind, string>> }) {
  return (
    <Stack gap={4}>
      <Text size="sm" muted>
        Ces textes servent de brouillon aux relances de ton Accueil ; tu les retouches encore avant chaque envoi. Trous disponibles :{' '}
        {RELANCE_PLACEHOLDERS.map((p, i) => <span key={p}>{i ? ', ' : ''}<code className={s.code}>{`{${p}}`}</code> ({RELANCE_PLACEHOLDER_HINTS[p]})</span>)}.
      </Text>
      {RELANCE_KINDS.map((k) => <TemplateRow key={k} wid={wid} kind={k} saved={mine[k] ?? null} />)}
    </Stack>
  );
}

function TemplateRow({ wid, kind, saved }: { wid: string; kind: RelanceKind; saved: string | null }) {
  const [text, setText] = useState(saved ?? DEFAULT_RELANCE_TEMPLATES[kind]);
  const [current, setCurrent] = useState<string | null>(saved);
  const [state, setState] = useState<'idle' | 'saving' | { ok: boolean; text: string }>('idle');
  const unknown = unknownPlaceholders(text);
  const dirty = text.trim() !== (current ?? DEFAULT_RELANCE_TEMPLATES[kind]);
  async function save(body: string | null) {
    setState('saving');
    const r = await mutate<{ body: string | null }>('PUT', `/api/v1/workspaces/${wid}/relance-templates`, { kind, body }, newKey());
    if (!r.ok) { setState({ ok: false, text: r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.' }); return; }
    setCurrent(r.data.body);
    if (body === null) setText(DEFAULT_RELANCE_TEMPLATES[kind]);
    setState({ ok: true, text: body === null ? 'Modèle de CoachOS rétabli.' : 'Enregistré.' });
  }
  return (
    <Card pad={4}>
      <Stack gap={3}>
        <Cluster between gap={2}>
          <Stack gap={1}>
            <Text strong>{RELANCE_LABELS[kind]}</Text>
            <Text size="sm" muted>{WHEN[kind]}</Text>
          </Stack>
          <Badge tone={current ? 'coach' : 'neutral'}>{current ? 'Ton modèle' : 'Modèle de CoachOS'}</Badge>
        </Cluster>
        <Field id={`rt-${kind}`} label={<span className="ds-visually-hidden">Modèle « {RELANCE_LABELS[kind]} »</span>} error={unknown.length ? `Trou inconnu : ${unknown.map((u) => `{${u}}`).join(', ')}. Il restera tel quel dans le message.` : null}>
          <Textarea id={`rt-${kind}`} rows={3} maxLength={1000} value={text} invalid={unknown.length > 0} onChange={(e) => { setText(e.target.value); setState('idle'); }} />
        </Field>
        <div className={s.sample}><Text as="span" size="sm" muted>Aperçu : </Text>{fillRelance(text, SAMPLE)}</div>
        <Cluster gap={2}>
          <Button size="sm" variant="primary" loading={state === 'saving'} disabled={!text.trim() || !dirty} onClick={() => void save(text.trim())}>Enregistrer</Button>
          {current ? <Button size="sm" variant="ghost" disabled={state === 'saving'} onClick={() => void save(null)}>Revenir au modèle de CoachOS</Button> : null}
          {typeof state === 'object' ? <Text as="span" size="sm" tone={state.ok ? 'success' : 'danger'} role={state.ok ? 'status' : 'alert'}>{state.text}</Text> : null}
        </Cluster>
      </Stack>
    </Card>
  );
}
