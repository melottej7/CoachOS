'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  assessGoal, FEASIBILITY_LABELS, formatClock, goalMessage, goalSolutions, WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS,
  type FeasibilityInput, type FeasibilityStatus, type Performance,
} from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import {
  Badge, Banner, Button, Card, Checkbox, Cluster, Eyebrow, Field, Heading, Icon, Input, LinkButton, Select, Stack, Text, Textarea, type IconName, type Tone,
} from '@/design';
import { cx } from '@/design/cx';
import s from './fiche.module.css';

// CE-P-07 (D-057), refonte Chrono (D-151) : statut, critères, solutions chiffrées avec leur statut, paramètres recalculés
// à chaque changement (rien n’est enregistré), décision du coach, message proposé que le coach relit et envoie lui-même.

export const FEASIBILITY_TONE: Record<FeasibilityStatus, Tone> = { realistic: 'success', ambitious: 'info', risky: 'warning', unrealistic: 'danger' };
const MARK: Record<'ok' | 'watch' | 'risk' | 'block', IconName> = { ok: 'check', watch: 'info', risk: 'alert', block: 'close' };

function parseTime(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/i) ?? t.match(/^(\d{1,3})\s*(?:min|′|')$/i);
  if (!m) return undefined;
  return m[2] !== undefined || /h|:/i.test(t) ? Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 : Number(m[1]) * 60;
}
const timeText = (x: number | null) => (x ? `${Math.floor(x / 3600)}h${String(Math.round((x % 3600) / 60)).padStart(2, '0')}` : '');

export interface PanelDecision { statusAtDecision: FeasibilityStatus; params: { distanceKm: number; eventDate: string; targetSeconds: number | null }; note: string | null; decidedAt: string }

const fmtDay = (iso: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

export function FeasibilityPanel({ aid, wid, first, goalTitle, goalId, initial: base, decision, performances }: {
  aid: string; wid: string; first: string; goalTitle: string; goalId: string | null; initial: FeasibilityInput; decision: PanelDecision | null; performances: Performance[];
}) {
  // D-060 : la prédiction suit la distance des paramètres (résultats de référence de l’élève).
  const withPred = (x: FeasibilityInput): FeasibilityInput => ({ ...x, history: x.history ? { ...x.history, performances } : x.history });
  const initial = useMemo(() => withPred(base), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const router = useRouter();
  const [p, setP] = useState<FeasibilityInput>(initial);
  const [chrono, setChrono] = useState(timeText(initial.targetSeconds));
  const [message, setMessage] = useState<string | null>(null);
  const start = useMemo(() => assessGoal(initial).status, [initial]);
  const a = assessGoal(withPred(p));
  const solutions = goalSolutions(withPred(p));
  const set = (patch: Partial<FeasibilityInput>) => { setP((x) => ({ ...x, ...patch })); setMessage(null); };
  const chronoBad = parseTime(chrono) === undefined;
  // D-058 : c’est le coach qui décide. La décision enregistre les paramètres validés et sa justification.
  const decide = useIntent<unknown>();
  const [note, setNote] = useState(decision?.note ?? '');
  const [applyDate, setApplyDate] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  async function validate() {
    if (!goalId) return;
    const r = await decide.run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/goals/${goalId}/decision`, {
      statusAtDecision: a.status, note: note || null, applyDate: applyDate && p.eventDate !== initial.eventDate,
      params: { distanceKm: p.distanceKm, eventDate: p.eventDate, targetSeconds: p.targetSeconds, weeklySessions: p.weeklySessions, weeklyHours: p.weeklyHours },
    });
    if (r) {
      setDecided(`Objectif validé. Le programme sera construit pour l’atteindre avec ces paramètres${a.status === 'risky' || a.status === 'unrealistic' ? ' ; prévois un suivi rapproché' : ''}.`);
      // Suite logique : la première validation ouvre directement le générateur (les points d’attention y sont rappelés).
      if (!decision) router.push(`/coach/${wid}/athletes/${aid}/programme?objectif=${goalId}`);
      else router.refresh();
    }
  }
  function openConversation() {
    try { sessionStorage.setItem(`coachos:draft:${aid}`, message ?? ''); } catch { /* commodité seulement */ }
    router.push(`/coach/${wid}/messages/${aid}`);
  }

  return (
    <Stack gap={6}>
      <Card pad={5} tinted>
        <Stack gap={3}>
          <Eyebrow>Faisabilité de l’objectif · indication</Eyebrow>
          <Cluster gap={2}><Heading level={3} size={3}>{FEASIBILITY_LABELS[a.status]}</Heading><Badge tone={FEASIBILITY_TONE[a.status]} dot>{FEASIBILITY_LABELS[a.status]}</Badge></Cluster>
          <Text size="sm" muted>{goalTitle} · {String(p.distanceKm).replace('.', ',')} km{p.targetSeconds ? ` en ${formatClock(p.targetSeconds)}` : ''} · {a.facts.weeksLeft} semaine{a.facts.weeksLeft > 1 ? 's' : ''} avant la course.</Text>
          <ul className={s.criteria}>
            {a.criteria.map((c) => (
              <li key={c.key} className={s[c.level]}><Icon name={MARK[c.level]} size={16} /><Text as="span" size="sm"><strong>{c.label}.</strong> {c.text}</Text></li>
            ))}
          </ul>
          <Text size="sm" muted>Estimation à partir du bilan de {first}, de ce qu’il ou elle a réellement fait et de son passif : une aide à la décision. C’est toi qui décides, plus bas.</Text>
        </Stack>
      </Card>

      <Stack gap={3}>
        <Heading level={3} size={4}>Solutions possibles</Heading>
        <Text size="sm" muted>Chacune indique le statut qu’elle donnerait. Essaie-en une : les paramètres plus bas changent, rien n’est enregistré.</Text>
        <ul className={s.list}>
          {solutions.map((x) => (
            <li key={x.key}>
              <Stack gap={1} className={s.grow}>
                <Cluster gap={2}><Text strong>{x.title}</Text><Badge tone={FEASIBILITY_TONE[x.status]}>{FEASIBILITY_LABELS[x.status]}</Badge></Cluster>
                <Text size="sm" muted>{x.text}</Text>
              </Stack>
              {x.key !== 'keep' ? <Button size="sm" variant="ghost" onClick={() => { set(x.input); setChrono(timeText(x.input.targetSeconds)); }}>Essayer cette solution</Button> : null}
            </li>
          ))}
        </ul>
      </Stack>

      <Stack gap={3}>
        <Heading level={3} size={4}>Paramètres</Heading>
        <div className={s.params}>
          <Field id="fz-km" label="Distance (km)">
            <Input id="fz-km" inputMode="decimal" value={String(p.distanceKm).replace('.', ',')} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0 && v < 1000) set({ distanceKm: v }); }} />
          </Field>
          <Field id="fz-date" label="Date de la course"><Input id="fz-date" type="date" value={p.eventDate} onChange={(e) => e.target.value && set({ eventDate: e.target.value })} /></Field>
          <Field id="fz-chrono" label="Chrono visé" hint="Vide : finir" error={chronoBad ? 'Écris par exemple 3h45 ou 50 min' : null}>
            <Input id="fz-chrono" value={chrono} placeholder="3h45" invalid={chronoBad} hasHint onChange={(e) => { setChrono(e.target.value); const v = parseTime(e.target.value); if (v !== undefined) set({ targetSeconds: v }); }} />
          </Field>
          <Field id="fz-sessions" label="Séances par semaine">
            <Select id="fz-sessions" value={p.weeklySessions} onChange={(e) => set({ weeklySessions: e.target.value as FeasibilityInput['weeklySessions'] })}>
              {WEEKLY_SESSIONS.map((x) => <option key={x} value={x}>{WEEKLY_SESSIONS_LABELS[x]}</option>)}
            </Select>
          </Field>
          <Field id="fz-hours" label="Temps par semaine">
            <Select id="fz-hours" value={p.weeklyHours ?? ''} onChange={(e) => set({ weeklyHours: (e.target.value || null) as FeasibilityInput['weeklyHours'] })}>
              <option value="">Non précisé</option>{WEEKLY_HOURS.map((x) => <option key={x} value={x}>{WEEKLY_HOURS_LABELS[x]}</option>)}
            </Select>
          </Field>
        </div>
        <Cluster gap={2} aria-live="polite">
          <Text as="span" size="sm" muted>Nouveau calcul :</Text>
          <Badge tone={FEASIBILITY_TONE[start]}>{FEASIBILITY_LABELS[start]}</Badge><Icon name="arrowRight" size={14} /><Badge tone={FEASIBILITY_TONE[a.status]}>{FEASIBILITY_LABELS[a.status]}</Badge>
        </Cluster>
      </Stack>

      <Stack gap={3}>
        <Heading level={3} size={4}>Ta décision</Heading>
        {decision && !decided ? (
          <Banner tone="success" title={`Objectif validé par toi le ${fmtDay(decision.decidedAt)}`}>
            {String(decision.params.distanceKm).replace('.', ',')} km le {fmtDay(decision.params.eventDate)}{decision.params.targetSeconds ? ` en ${formatClock(decision.params.targetSeconds)}` : ', pour finir'} (indication au moment de la décision : {FEASIBILITY_LABELS[decision.statusAtDecision].toLowerCase()}).{decision.note ? ` « ${decision.note} »` : ''}
          </Banner>
        ) : null}
        {goalId ? (
          <Stack gap={3}>
            <Text size="sm" muted>Si tu valides, le programme sera construit pour atteindre l’objectif avec les paramètres ci-dessus, même si l’indication est prudente. Ta justification reste privée.</Text>
            <Field id="fz-note" label="Ta justification" hint="Facultatif · ex. « a déjà couru 3 marathons », « gros volume l’an dernier »">
              <Textarea id="fz-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} hasHint />
            </Field>
            {p.eventDate !== initial.eventDate ? (
              <Checkbox checked={applyDate} onChange={setApplyDate} label={`Reporter la nouvelle date (${fmtDay(p.eventDate)}) sur l’objectif, visible par ${first}`} />
            ) : null}
            <Cluster gap={2}>
              <Button variant="primary" icon="check" loading={decide.pending} disabled={chronoBad} onClick={() => void validate()}>
                {decision ? 'Mettre à jour ma décision' : `Je valide cet objectif${a.status !== start || p.distanceKm !== initial.distanceKm ? ' ajusté' : ''}`}
              </Button>
              {decision || decided ? <LinkButton href={`/coach/${wid}/athletes/${aid}/programme?objectif=${goalId}`} icon="calendar">Générer le programme</LinkButton> : null}
            </Cluster>
            {decided ? <Banner tone="success">{decided}</Banner> : null}
            {decide.error ? <Text size="sm" tone="danger" role="alert">{decide.error.kind === 'error' ? (decide.error.fields[0]?.rule ?? decide.error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
          </Stack>
        ) : <Text size="sm" muted>Cette course vient du bilan de {first} : ajoute-la comme objectif pour pouvoir la valider.</Text>}
      </Stack>

      <Stack gap={3}>
        <Heading level={3} size={4}>Message à {first}</Heading>
        {message === null ? (
          <Cluster><Button icon="edit" onClick={() => setMessage(goalMessage(first, goalTitle, { input: initial, a: assessGoal(initial) }, { input: p, a }, goalSolutions(initial)))}>Rédiger un message avec ces solutions</Button></Cluster>
        ) : (
          <Stack gap={3}>
            <Field id="fz-msg" label={`Message proposé à ${first}`}><Textarea id="fz-msg" className={cx()} value={message} onChange={(e) => setMessage(e.target.value)} rows={8} /></Field>
            <Cluster gap={2}>
              <Button variant="primary" icon="chat" onClick={openConversation}>Ouvrir la conversation avec ce message</Button>
              <Text as="span" size="sm" muted>Rien n’est envoyé : tu le relis dans la conversation, puis tu l’envoies toi-même.</Text>
            </Cluster>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
