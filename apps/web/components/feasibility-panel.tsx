'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useIntent } from './use-intent';
import {
  assessGoal, FEASIBILITY_LABELS, formatClock, goalMessage, goalSolutions, WEEKLY_HOURS, WEEKLY_HOURS_LABELS, WEEKLY_SESSIONS, WEEKLY_SESSIONS_LABELS,
  type FeasibilityInput, type FeasibilityStatus, type Performance,
} from '@coachos/domain';

// CE-P-07 (D-057), sur le modèle de Foulée (capture 10) : statut, critères, solutions chiffrées avec leur statut,
// paramètres recalculés à chaque changement (rien n’est enregistré), message proposé que le coach relit et envoie lui-même.

const TONE: Record<FeasibilityStatus, string> = { realistic: '', ambitious: 'neutral', risky: 'attn', unrealistic: 'attn' };
const LEVEL_MARK = { ok: '✓', watch: '•', risk: '!', block: '✕' } as const;

function parseTime(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/i) ?? t.match(/^(\d{1,3})\s*(?:min|′|')$/i);
  if (!m) return undefined;
  return m[2] !== undefined || /h|:/i.test(t) ? Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 : Number(m[1]) * 60;
}
const timeText = (s: number | null) => (s ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : '');

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
    <div className="fz">
      <div className={`fz-status ${TONE[a.status]}`}>
        <p className="kicker">Faisabilité de l’objectif · indication</p>
        <p className="fz-title">{FEASIBILITY_LABELS[a.status]}</p>
        <p className="muted">{goalTitle} · {String(p.distanceKm).replace('.', ',')} km{p.targetSeconds ? ` en ${formatClock(p.targetSeconds)}` : ''} · {a.facts.weeksLeft} semaine{a.facts.weeksLeft > 1 ? 's' : ''} avant la course.</p>
        <ul className="fz-criteria">
          {a.criteria.map((c) => (
            <li key={c.key} className={`fz-c ${c.level}`}><span className="fz-mark" aria-hidden="true">{LEVEL_MARK[c.level]}</span>
              <span><strong>{c.label}.</strong> {c.text}</span></li>
          ))}
        </ul>
        <p className="fz-note">Estimation à partir du bilan de {first}, de ce qu’il ou elle a réellement fait et de son passif : une aide à la décision. C’est toi qui décides, plus bas.</p>
      </div>

      <h3>Solutions possibles</h3>
      <p className="muted">Chacune indique le statut qu’elle donnerait. Essaie-en une : les paramètres plus bas changent, rien n’est enregistré.</p>
      <ul className="plain fz-solutions">
        {solutions.map((s) => (
          <li key={s.key} className="fz-sol">
            <span className="fz-sol-head"><strong>{s.title}</strong><span className={`pill ${TONE[s.status]}`}>{FEASIBILITY_LABELS[s.status]}</span></span>
            <span className="muted">{s.text}</span>
            {s.key !== 'keep' ? <button type="button" className="link-btn" onClick={() => { set(s.input); setChrono(timeText(s.input.targetSeconds)); }}>Essayer cette solution</button> : null}
          </li>
        ))}
      </ul>

      <h3>Paramètres</h3>
      <div className="fz-params">
        <label className="field"><span>Distance (km)</span>
          <input aria-label="Distance en km" inputMode="decimal" value={String(p.distanceKm).replace('.', ',')} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v > 0 && v < 1000) set({ distanceKm: v }); }} /></label>
        <label className="field"><span>Date de la course</span>
          <input aria-label="Date de la course" type="date" value={p.eventDate} onChange={(e) => e.target.value && set({ eventDate: e.target.value })} /></label>
        <label className="field"><span>Chrono visé <span className="hint">vide : finir</span></span>
          <input aria-label="Chrono visé" value={chrono} placeholder="3h45" aria-invalid={chronoBad} onChange={(e) => { setChrono(e.target.value); const v = parseTime(e.target.value); if (v !== undefined) set({ targetSeconds: v }); }} />
          {chronoBad ? <span className="field-error">Écris par exemple 3h45 ou 50 min</span> : null}</label>
        <label className="field"><span>Séances par semaine</span>
          <select aria-label="Séances par semaine" value={p.weeklySessions} onChange={(e) => set({ weeklySessions: e.target.value as FeasibilityInput['weeklySessions'] })}>
            {WEEKLY_SESSIONS.map((x) => <option key={x} value={x}>{WEEKLY_SESSIONS_LABELS[x]}</option>)}</select></label>
        <label className="field"><span>Temps par semaine</span>
          <select aria-label="Temps par semaine" value={p.weeklyHours ?? ''} onChange={(e) => set({ weeklyHours: (e.target.value || null) as FeasibilityInput['weeklyHours'] })}>
            <option value="">Non précisé</option>{WEEKLY_HOURS.map((x) => <option key={x} value={x}>{WEEKLY_HOURS_LABELS[x]}</option>)}</select></label>
      </div>
      <p className="fz-compare" aria-live="polite"><span className="muted">Nouveau calcul :</span> <span className={`pill ${TONE[start]}`}>{FEASIBILITY_LABELS[start]}</span> → <span className={`pill ${TONE[a.status]}`}>{FEASIBILITY_LABELS[a.status]}</span></p>

      <h3>Ta décision</h3>
      {decision && !decided ? (
        <p className="fz-decided">✓ Objectif validé par toi le {fmtDay(decision.decidedAt)} : {String(decision.params.distanceKm).replace('.', ',')} km le {fmtDay(decision.params.eventDate)}{decision.params.targetSeconds ? ` en ${formatClock(decision.params.targetSeconds)}` : ', pour finir'}
          {' '}(indication au moment de la décision : {FEASIBILITY_LABELS[decision.statusAtDecision].toLowerCase()}).{decision.note ? ` « ${decision.note} »` : ''}</p>
      ) : null}
      {goalId ? (
        <div className="stack">
          <p className="muted">Si tu valides, le programme sera construit pour atteindre l’objectif avec les paramètres ci-dessus, même si l’indication est prudente. Ta justification reste privée.</p>
          <label className="field"><span>Ta justification <span className="hint">Facultatif · ex. « a déjà couru 3 marathons », « gros volume l’an dernier »</span></span>
            <textarea aria-label="Ta justification" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {p.eventDate !== initial.eventDate ? (
            <label className="check"><input type="checkbox" checked={applyDate} onChange={(e) => setApplyDate(e.target.checked)} />
              <span>Reporter la nouvelle date ({fmtDay(p.eventDate)}) sur l’objectif, visible par {first}</span></label>
          ) : null}
          <div className="actions">
            <button type="button" className="btn primary" disabled={decide.pending || chronoBad} onClick={() => void validate()}>
              {decide.pending ? 'Enregistrement…' : decision ? '✓ Mettre à jour ma décision' : `✓ Je valide cet objectif${a.status !== start || p.distanceKm !== initial.distanceKm ? ' ajusté' : ''}`}
            </button>
          </div>
          {decided ? <p className="banner ok" role="status">{decided}</p> : null}
          {decision || decided ? <p><a className="btn primary" href={`/coach/${wid}/athletes/${aid}/programme?objectif=${goalId}`}>📅 Générer le programme</a></p> : null}
          {decide.error ? <p className="field-error" role="alert">{decide.error.kind === 'error' ? (decide.error.fields[0]?.rule ?? decide.error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
        </div>
      ) : <p className="muted">Cette course vient du bilan de {first} : ajoute-la comme objectif pour pouvoir la valider.</p>}

      <h3>Message à {first}</h3>
      {message === null ? (
        <button type="button" className="btn" onClick={() => setMessage(goalMessage(first, goalTitle, { input: initial, a: assessGoal(initial) }, { input: p, a }, goalSolutions(initial)))}>✍️ Rédiger un message avec ces solutions</button>
      ) : (
        <div className="stack">
          <textarea className="fz-msg" value={message} onChange={(e) => setMessage(e.target.value)} aria-label={`Message proposé à ${first}`} />
          <div className="actions">
            <button type="button" className="btn primary" onClick={openConversation}>Ouvrir la conversation avec ce message</button>
            <span className="muted">Rien n’est envoyé : tu le relis dans la conversation, puis tu l’envoies toi-même.</span>
          </div>
        </div>
      )}
    </div>
  );
}
