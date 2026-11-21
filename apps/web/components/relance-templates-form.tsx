'use client';

import { useState } from 'react';
import {
  DEFAULT_RELANCE_TEMPLATES, fillRelance, RELANCE_KINDS, RELANCE_LABELS, RELANCE_PLACEHOLDER_HINTS, RELANCE_PLACEHOLDERS, unknownPlaceholders, type RelanceKind,
} from '@coachos/domain';
import { mutate, newKey } from './api-client';

// D-104 · Mes relances : un modèle par situation, avec des trous remplis au moment de préparer la relance.

const SAMPLE = { first: 'Emma', workout: { id: 'x', date: '2026-11-17', title: 'Côtes 8 × 30″', state: null }, silentDays: 9, done7: 3, due7: 3 } as const;
const WHEN: Record<RelanceKind, string> = {
  silent: 'Aucune nouvelle depuis 7 jours ou plus',
  readiness: 'A répondu ne pas être à 100 %',
  missed: 'Séances non faites ou sans nouvelle',
  no_feedback: 'Pas de retour 2 jours après une séance',
  bravo: 'Toutes ses séances faites sur 7 jours',
};

export function RelanceTemplatesForm({ wid, mine }: { wid: string; mine: Partial<Record<RelanceKind, string>> }) {
  return (
    <div className="stack">
      <p className="muted">Ces textes servent de brouillon dans la carte « Relances » du Planning ; tu peux encore les retoucher avant chaque envoi.
        Trous disponibles : {RELANCE_PLACEHOLDERS.map((p, i) => <span key={p}>{i ? ', ' : ''}<code>{`{${p}}`}</code> ({RELANCE_PLACEHOLDER_HINTS[p]})</span>)}.</p>
      {RELANCE_KINDS.map((k) => <TemplateRow key={k} wid={wid} kind={k} saved={mine[k] ?? null} />)}
    </div>
  );
}

function TemplateRow({ wid, kind, saved }: { wid: string; kind: RelanceKind; saved: string | null }) {
  const [text, setText] = useState(saved ?? DEFAULT_RELANCE_TEMPLATES[kind]);
  const [current, setCurrent] = useState<string | null>(saved);
  const [state, setState] = useState<'idle' | 'saving' | string>('idle');
  const unknown = unknownPlaceholders(text);
  const dirty = text.trim() !== (current ?? DEFAULT_RELANCE_TEMPLATES[kind]);
  async function save(body: string | null) {
    setState('saving');
    const r = await mutate<{ body: string | null }>('PUT', `/api/v1/workspaces/${wid}/relance-templates`, { kind, body }, newKey());
    if (!r.ok) { setState(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
    setCurrent(r.data.body);
    if (body === null) setText(DEFAULT_RELANCE_TEMPLATES[kind]);
    setState(body === null ? 'Modèle de CoachOS rétabli.' : 'Enregistré.');
  }
  return (
    <fieldset className="rt">
      <legend><strong>{RELANCE_LABELS[kind]}</strong> <span className="muted">· {WHEN[kind]}{current ? ' · ton modèle' : ' · modèle de CoachOS'}</span></legend>
      <label className="visually-hidden" htmlFor={`rt-${kind}`}>Modèle « {RELANCE_LABELS[kind]} »</label>
      <textarea id={`rt-${kind}`} rows={3} maxLength={1000} value={text} onChange={(e) => { setText(e.target.value); setState('idle'); }} />
      {unknown.length ? <p className="field-error">Trou inconnu : {unknown.map((u) => `{${u}}`).join(', ')}. Il restera tel quel dans le message.</p> : null}
      <p className="rt-preview"><span className="muted">Aperçu :</span> {fillRelance(text, SAMPLE)}</p>
      <div className="actions">
        <button type="button" className="btn small primary" disabled={state === 'saving' || !text.trim() || !dirty} onClick={() => void save(text.trim())}>Enregistrer</button>
        {current ? <button type="button" className="link-btn" disabled={state === 'saving'} onClick={() => void save(null)}>Revenir au modèle de CoachOS</button> : null}
        {state !== 'idle' && state !== 'saving' ? <span className="muted" role="status">{state}</span> : null}
      </div>
    </fieldset>
  );
}
