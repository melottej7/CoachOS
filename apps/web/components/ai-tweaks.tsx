'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NO_TWEAKS, type AiProposal, type ProgramTweaks } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-071 : « Ajuster avec l’IA ». Le coach écrit ; l’IA propose des réglages ; la page recalcule le programme avec ces
// réglages et montre ce qui change. Rien n’est enregistré avant « Créer » ou « Appliquer ».

const EXAMPLES = ['Moins de fractionné', 'Sortie longue le samedi', 'Allège de 10 %', 'Sorties longues progressives', 'Pas de VMA'];

/** Adresse de la même page avec les réglages proposés (et la trace de la proposition). */
export function withTweaks(href: string, tweaks: ProgramTweaks | null, days: number[] | null, suggestionId: string | null): string {
  const u = new URL(href, 'http://x');
  if (tweaks) u.searchParams.set('reglages', JSON.stringify(tweaks)); else u.searchParams.delete('reglages');
  if (days) { u.searchParams.delete('jours'); for (const d of days) u.searchParams.append('jours', String(d)); }
  if (suggestionId) u.searchParams.set('ia', suggestionId); else u.searchParams.delete('ia');
  return `${u.pathname}${u.search}`;
}

export function AiTweaks({ wid, aid, goalId, days, tweaks, href, first, source }: {
  wid: string; aid: string; goalId: string; days: number[]; tweaks: ProgramTweaks | null; href: string; first: string; source: 'simulation' | 'claude';
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ suggestionId: string; source: 'simulation' | 'claude'; proposal: AiProposal }>();
  const [text, setText] = useState('');
  const [abstain, setAbstain] = useState<string | null>(null);

  async function propose() {
    setAbstain(null);
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals/${goalId}/ai-tweaks`, { text, days, tweaks });
    if (!r) return;
    if (r.proposal.status === 'abstain') { setAbstain(r.proposal.uncertainty || 'Précise ta demande.'); return; }
    try { sessionStorage.setItem(`coachos:ai:${r.suggestionId}`, r.proposal.explanation); } catch { /* commodité */ }
    router.push(withTweaks(href, r.proposal.tweaks, r.proposal.days, r.suggestionId));
  }

  return (
    <section className="card ai-card" aria-labelledby="ai-title">
      <div className="card-head"><h2 id="ai-title">✨ Ajuster avec l’IA</h2>
        <span className={`pill ${source === 'claude' ? '' : 'neutral'}`}>{source === 'claude' ? 'Claude' : 'IA simulée'}</span></div>
      <div className="card-body stack">
        <p className="muted">Écris ce que tu veux changer pour {first}. L’IA le traduit en réglages ; le programme est recalculé avec les mêmes garde-fous (objectif, progression, risques) et tu vois les différences avant de décider.</p>
        <label className="field"><span>Ta demande</span>
          <textarea maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-label="Ta demande à l’IA"
            placeholder="Ex. moins de fractionné, sortie longue le samedi et progressive" /></label>
        <div className="chips" aria-label="Exemples">{EXAMPLES.map((x) => (
          <button key={x} type="button" className="chip-btn" onClick={() => setText((t) => (t ? `${t}, ${x.toLowerCase()}` : x))}>{x}</button>
        ))}</div>
        {abstain ? <p className="banner warn" role="status">{abstain}</p> : null}
        {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
        <div className="actions">
          <button type="button" className="btn primary" disabled={pending || text.trim().length < 3} onClick={() => void propose()}>{pending ? 'Réflexion…' : '✨ Proposer des réglages'}</button>
          <span className="muted">{source === 'claude' ? 'Envoyé à Claude sans le nom de l’élève ni ses messages.' : 'IA simulée : aucune donnée ne quitte CoachOS. Branche Claude pour de vraies réponses.'}</span>
        </div>
      </div>
    </section>
  );
}

/** Bandeau des réglages en cours (proposés par l’IA ou gardés du programme), avec retour sans réglage. */
export function TweaksBanner({ lines, href, suggestionId }: { lines: string[]; href: string; suggestionId: string | null }) {
  // L’explication de l’IA est gardée dans l’onglet (jamais dans l’adresse) : lue après l’affichage.
  const [why, setWhy] = useState<string | null>(null);
  useEffect(() => { try { setWhy(suggestionId ? sessionStorage.getItem(`coachos:ai:${suggestionId}`) : null); } catch { /* commodité */ } }, [suggestionId]);
  if (!lines.length) return null;
  return (
    <div className="banner next-step" role="status">
      <span><strong>Réglages {suggestionId ? 'proposés par l’IA' : 'du programme'} :</strong> {lines.join(' · ')}.{why ? <> <span className="muted">{why}</span></> : null}</span>
      <a className="btn small" href={withTweaks(href, NO_TWEAKS, null, null)}>Sans réglage</a>
    </div>
  );
}
