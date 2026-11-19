'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AUTO_RULE_DELAY, AUTO_RULE_INFO, AUTO_RULE_ORDER, type AutoRule, type AutoRuleSetting } from '@coachos/domain';
import { fieldError, useIntent } from './use-intent';

// CE-H-04 (D-045) : chaque coach choisit les suivis qu’il veut voir dans son Planning et leur délai.

export function RuleSettingsForm({ wid, initial }: { wid: string; initial: Record<AutoRule, AutoRuleSetting> }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ rules: AutoRuleSetting[] }>();
  const [rules, setRules] = useState(initial);
  const [saved, setSaved] = useState(false);
  const set = (rule: AutoRule, patch: Partial<AutoRuleSetting>) => { setSaved(false); setRules((r) => ({ ...r, [rule]: { ...r[rule], ...patch } })); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await run('PUT', `/api/v1/workspaces/${wid}/auto-task-rules`, { rules: AUTO_RULE_ORDER.map((k) => rules[k]) });
    if (r) { setSaved(true); router.refresh(); }
  }

  return (
    <form className="rules" onSubmit={save} noValidate>
      <ul className="plain rules-list">
        {AUTO_RULE_ORDER.map((rule, i) => {
          const s = rules[rule];
          const d = AUTO_RULE_DELAY[rule];
          const info = AUTO_RULE_INFO[rule];
          const err = fieldError(error, `rules.${i}.delayDays`);
          return (
            <li key={rule} className={`rules-row${s.enabled ? '' : ' off'}`}>
              <label className="check">
                <input type="checkbox" checked={s.enabled} onChange={(e) => set(rule, { enabled: e.target.checked })} />
                <span><strong>{info.title}</strong><span className="muted rules-why">{rule === 'no_upcoming' ? 'Aucune séance publiée sur la période choisie' : info.reason}</span></span>
              </label>
              {d ? (
                <span className="rules-delay">
                  <input id={`delay-${rule}`} type="number" inputMode="numeric" min={d.min} max={d.max} value={s.delayDays ?? d.default} disabled={!s.enabled}
                    aria-invalid={!!err} aria-label={`${info.title} : nombre de ${d.label}`}
                    onChange={(e) => set(rule, { delayDays: e.target.value === '' ? d.min : Math.max(d.min, Math.min(d.max, Math.round(Number(e.target.value)))) })} />
                  <label htmlFor={`delay-${rule}`} className="muted">{d.label}</label>
                  {err ? <span className="field-error">{err}</span> : null}
                </span>
              ) : <span className="muted rules-delay">Dès que l’information manque</span>}
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer les suivis'}</button>
        {saved ? <span className="pill" role="status">Enregistré · ton Planning est à jour</span> : null}
      </div>
      {error && error.kind !== 'error' ? <p className="field-error" role="alert">Connexion perdue. Réessaie.</p> : null}
      {error && error.kind === 'error' && !error.fields?.length ? <p className="field-error" role="alert">{error.message}</p> : null}
    </form>
  );
}
