'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatShortDate, PROGRAM_PHASE_LABELS, PROTECT_LABELS, regenItemKey, WEEKDAY_SHORT, type ProgramTweaks, type RegenItem, type RegenWeek } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-063 : le coach lit les différences et les risques, puis applique. Tout reste en brouillons ; rien n’est publié.
// D-078 : chaque changement se décoche ; seuls les changements cochés sont appliqués.

const dowOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const day = (d: string) => `${WEEKDAY_SHORT[dowOf(d)]} ${formatShortDate(d)}`;

function ItemText({ it }: { it: RegenItem }) {
  const pub = 'before' in it && it.before.published && (it.kind === 'changed' || it.kind === 'removed')
    ? <span className="muted"> · publiée : l’élève garde l’ancienne version jusqu’à ta republication</span> : null;
  switch (it.kind) {
    case 'kept':
      return <><span className="muted">{day(it.date)}</span> {it.before.title}
        <span className="muted"> · gardée ({PROTECT_LABELS[it.reason]}){it.dropped ? ` ; « ${it.dropped} » n’est pas ajoutée ce jour-là` : ''}</span></>;
    case 'same':
      return <><span className="muted">{day(it.date)}</span> {it.before.title} <span className="muted">· inchangée</span></>;
    case 'changed':
      return <><span className="muted">{day(it.date)}</span> {it.before.title === it.after.title
        ? <>{it.after.title} <span className="muted">· {it.before.minutes && it.after.minutes && it.before.minutes !== it.after.minutes ? `${it.before.minutes}′ → ${it.after.minutes}′` : 'contenu ajusté'}</span></>
        : <><s>{it.before.title}</s> → <strong>{it.after.title}</strong></>}{it.after.source === 'library' ? ' 📚' : ''}{pub}</>;
    case 'added':
      return <><span className="muted">{day(it.date)}</span> <strong>{it.after.title}</strong>{it.after.source === 'library' ? ' 📚' : ''} <span className="muted">· ajoutée</span></>;
    case 'removed':
      return <><span className="muted">{day(it.date)}</span> <s>{it.before.title}</s> <span className="muted">· retirée</span>{pub}</>;
  }
}

const MARK: Record<RegenItem['kind'], string> = { kept: '🔒', same: '=', changed: '✎', added: '+', removed: '−' };

export function ProgramRegenerate({ wid, aid, planId, fromWeek, toWeek, days, seen, weeks, needsAccept, validated, calendarHref, tweaks = null, suggestionId = null }: {
  tweaks?: ProgramTweaks | null; suggestionId?: string | null;
  wid: string; aid: string; planId: string; fromWeek: number; toWeek: number; days: number[]; seen: { id: string; revision: number }[];
  weeks: RegenWeek[]; needsAccept: boolean; validated: boolean; calendarHref: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [accept, setAccept] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const keys = weeks.flatMap((w) => w.items).map(regenItemKey).filter((k): k is string => k !== null);
  const n = keys.filter((k) => !skip.has(k)).length;
  const toggle = (k: string) => setSkip((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });

  const apply = !validated ? <p className="banner warn">Valide d’abord l’objectif dans la fiche (Faisabilité → Ta décision).</p>
    : !keys.length ? <p className="muted">Rien à changer dans ces semaines avec ces jours.</p> : (
      <div className="stack">
        {needsAccept ? (
          <label className="check"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>J’ai lu les risques signalés et je décide de régénérer ces semaines.</span></label>
        ) : null}
        {error ? <p className="field-error" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
        <div className="actions">
          <button type="button" className="btn primary" disabled={pending || !n || (needsAccept && !accept)}
            onClick={async () => {
              const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/plans/${planId}/regenerate`, { fromWeek, toWeek, days, seen, acceptRisks: accept, skip: [...skip].filter((k) => keys.includes(k)), tweaks, suggestionId });
              if (r) router.push(calendarHref);
            }}>
            {pending ? 'Application…' : !n ? 'Aucun changement coché' : `Appliquer ${n === keys.length ? `les ${n}` : `${n} sur ${keys.length}`} changement${n > 1 ? 's' : ''} en brouillons`}
          </button>
          <span className="muted">Rien n’est envoyé à l’élève : tu relis, puis publies semaine par semaine.</span>
        </div>
      </div>
    );

  return (
    <>
      <div className="card"><div className="card-body">{apply}</div></div>
      <section className="card" aria-labelledby="rg-weeks">
        <div className="card-head"><h2 id="rg-weeks">Différences semaine par semaine</h2>
          {keys.length > 1 ? <span className="actions">
            <button type="button" className="btn small ghost" onClick={() => setSkip(new Set())} disabled={!skip.size}>Tout cocher</button>
            <button type="button" className="btn small ghost" onClick={() => setSkip(new Set(keys))} disabled={skip.size === keys.length}>Tout décocher</button>
          </span> : null}
        </div>
        <p className="muted card-body rg-hint">Décoche un changement pour garder la séance actuelle (ou ne rien ajouter ce jour-là).</p>
        <ol className="plain prog-weeks card-body">
          {weeks.map((w) => (
            <li key={w.index} className="prog-week">
              <p className="prog-week-head"><strong>S{w.index}</strong> · {formatShortDate(w.monday)}
                {w.phase ? <> · <span className={`pill ${w.phase === 'tremplin' ? 'neutral' : w.phase === 'recuperation' || w.phase === 'affutage' ? 'attn' : ''}`}>{PROGRAM_PHASE_LABELS[w.phase]}</span></> : null}</p>
              {w.items.length ? (
                <ul className="plain rg-list">{w.items.map((it, i) => {
                  const k = regenItemKey(it);
                  const off = k !== null && skip.has(k);
                  return (
                    <li key={k ?? `${it.kind}-${i}`} className={`rg ${it.kind}${off ? ' off' : ''}`}>
                      {k ? <input type="checkbox" className="rg-check" checked={!off} onChange={() => toggle(k)} aria-label={`Appliquer ce changement du ${day(it.date)}`} />
                        : <span className="rg-mark" aria-hidden="true">{MARK[it.kind]}</span>}
                      <span>{k ? <span className="rg-mark-inline" aria-hidden="true">{MARK[it.kind]} </span> : null}<ItemText it={it} />{off ? <span className="muted"> · non appliqué</span> : null}</span>
                    </li>
                  );
                })}</ul>
              ) : <p className="muted">Aucune séance.</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
