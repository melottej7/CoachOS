'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LEVELS, LEVEL_LABELS, METHOD_STYLES, METHOD_STYLE_LABELS, QUALITY_KINDS, QUALITY_KIND_LABELS, ruleLabel,
  type CoachMethod, type Level, type MethodCandidate, type MethodRule, type MethodRuleDraft, type MethodStyle, type QualityKind,
} from '@coachos/domain';
import { newKey } from './api-client';
import { useIntent } from './use-intent';

// D-072 : la méthode du coach. Chaque enregistrement crée une nouvelle version ; rien n’est appliqué sans lui.

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

export function MethodIdentity({ wid, version, method }: { wid: string; version: number; method: CoachMethod }) {
  const { save, pending, error } = useSave(wid, version);
  const [philosophy, setPhilosophy] = useState(method.philosophy ?? '');
  const [style, setStyle] = useState<MethodStyle | ''>(method.style ?? '');
  const changed = philosophy !== (method.philosophy ?? '') || style !== (method.style ?? '');
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); await save({ ...method, philosophy: philosophy.trim() || null, style: style || null }, 'Philosophie et style'); }}>
      <label className="field"><span>Ta philosophie <span className="hint">En une ou deux phrases · ex. « La régularité avant l’intensité. »</span></span>
        <textarea aria-label="Ta philosophie" maxLength={500} value={philosophy} onChange={(e) => setPhilosophy(e.target.value)} /></label>
      <label className="field"><span>Ton style avec les élèves <span className="hint">Servira aux brouillons de messages ; n’agit pas sur les séances</span></span>
        <select aria-label="Ton style" value={style} onChange={(e) => setStyle(e.target.value as MethodStyle | '')}>
          <option value="">Non précisé</option>{METHOD_STYLES.map((s) => <option key={s} value={s}>{METHOD_STYLE_LABELS[s]}</option>)}</select></label>
      {errorText(error) ? <p className="field-error" role="alert">{errorText(error)}</p> : null}
      <div className="actions"><button className="btn small primary" type="submit" disabled={pending || !changed}>Enregistrer</button></div>
    </form>
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
    <div className="stack">
      {method.rules.length ? (
        <ul className="plain method-rules">
          {method.rules.map((r) => (
            <li key={r.id}>
              <span><strong>{ruleLabel(r)}</strong>
                <span className="muted"> · {r.source === 'learned' ? `apprise de tes corrections${r.support ? ` (${r.support} observations)` : ''}` : 'ajoutée par toi'}</span></span>
              <button type="button" className="link-btn" disabled={pending}
                onClick={() => void save({ ...method, rules: method.rules.filter((x) => x.id !== r.id) }, `Règle retirée : ${ruleLabel(r)}`)}>Retirer</button>
            </li>
          ))}
        </ul>
      ) : <p className="empty">Aucune règle pour l’instant : le générateur applique ses réglages de base.</p>}
      <details className="perf-add">
        <summary>+ Ajouter une règle</summary>
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); const r = draft(); await save({ ...method, rules: [...method.rules, r] }, `Règle ajoutée : ${ruleLabel(r)}`); }}>
          <div className="form-row">
            <label className="field"><span>Règle</span>
              <select aria-label="Type de règle" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{(Object.keys(KIND_LABELS) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
            {kind === 'avoid_quality' ? <label className="field"><span>Type</span>
              <select aria-label="Type de séance" value={quality} onChange={(e) => setQuality(e.target.value as QualityKind)}>{QUALITY_KINDS.map((q) => <option key={q} value={q}>{QUALITY_KIND_LABELS[q]}</option>)}</select></label> : null}
            {kind === 'max_quality' ? <label className="field"><span>Au plus</span>
              <select aria-label="Séances de qualité au plus" value={n} onChange={(e) => setN(Number(e.target.value))}>{[0, 1, 2].map((x) => <option key={x} value={x}>{x}</option>)}</select></label> : null}
            {kind === 'volume_pct' ? <label className="field"><span>Volume</span>
              <select aria-label="Volume" value={pct} onChange={(e) => setPct(Number(e.target.value))}>{[70, 75, 80, 85, 90, 95, 105, 110].map((x) => <option key={x} value={x}>{x} %</option>)}</select></label> : null}
            {kind === 'long_day' ? <label className="field"><span>Jour</span>
              <select aria-label="Jour de la sortie longue" value={day} onChange={(e) => setDay(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label> : null}
            <label className="field"><span>Pour</span>
              <select aria-label="Portée de la règle" value={level} onChange={(e) => setLevel(e.target.value as Level | '')}>
                <option value="">Tous mes élèves</option>{LEVELS.map((l) => <option key={l} value={l}>Niveau {LEVEL_LABELS[l].label.toLowerCase()}</option>)}</select></label>
          </div>
          <div className="actions"><button className="btn small primary" type="submit" disabled={pending}>Ajouter à ma méthode</button></div>
        </form>
      </details>
      {errorText(error) ? <p className="field-error" role="alert">{errorText(error)}</p> : null}
    </div>
  );
}

export function MethodCandidates({ wid, version, method, items }: { wid: string; version: number; method: CoachMethod; items: MethodCandidate[] }) {
  const { save, pending, error } = useSave(wid, version);
  if (!items.length) return <p className="empty">Rien pour l’instant. Quand tu retouches souvent les programmes générés de la même façon (au moins 5 fois, sur 2 semaines), une règle te sera proposée ici.</p>;
  return (
    <div className="stack">
      <ul className="plain method-candidates">
        {items.map((c) => {
          const rule = { ...(c.rule as MethodRuleDraft), id: newKey(), source: 'learned', support: c.support } as MethodRule;
          return (
            <li key={c.key} className="method-candidate">
              <p><strong>{c.label}</strong></p>
              <p className="muted">{c.support} fois sur {c.weeks} semaines, {c.athletes} élève{c.athletes > 1 ? 's' : ''} · {c.counter ? `${c.counter} fois tu as gardé le contraire (${Math.round(c.concordance * 100)} % dans ce sens)` : 'aucun contre-exemple'}.</p>
              <div className="actions">
                <button type="button" className="btn small primary" disabled={pending}
                  onClick={() => void save({ ...method, rules: [...method.rules, rule] }, `Règle apprise acceptée : ${c.label}`)}>Ajouter à ma méthode</button>
                <button type="button" className="btn small" disabled={pending}
                  onClick={() => void save({ ...method, dismissed: [...method.dismissed, c.key] }, `Proposition écartée : ${c.label}`)}>Pas une règle</button>
              </div>
            </li>
          );
        })}
      </ul>
      {errorText(error) ? <p className="field-error" role="alert">{errorText(error)}</p> : null}
    </div>
  );
}
