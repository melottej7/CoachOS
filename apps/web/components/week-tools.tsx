'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addDays, formatShortDate, formatWeekday, templateDayLabel, WEEK_TEMPLATE_MAX_WEEKS } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-051 : semaine type (enregistrer cette semaine, en appliquer une) et publication explicite des brouillons de la semaine.

export interface WeekDraft { id: string; revision: number; title: string; localDate: string; changed: boolean }
export interface WeekTemplateOption { id: string; title: string; weeks: number; days: { offset: number; title: string }[] }

export function WeekTools({ wid, athleteId, first, monday, hasSessions, drafts, templates }: {
  wid: string; athleteId: string; first: string; monday: string; hasSessions: boolean; drafts: WeekDraft[]; templates: WeekTemplateOption[];
}) {
  const router = useRouter();
  const save = useIntent<{ id: string; sessions: number }>();
  const apply = useIntent<{ created: unknown[] }>();
  const publish = useIntent<unknown>();
  const [mode, setMode] = useState<'save' | 'apply' | 'publish' | null>(null);
  const [title, setTitle] = useState(`Semaine type · ${first}`);
  const [chosen, setChosen] = useState(templates[0]?.id ?? '');
  const [weeks, setWeeks] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const tpl = templates.find((t) => t.id === chosen);
  const toggle = (m: typeof mode) => { setDone(null); setMode((cur) => (cur === m ? null : m)); };

  async function doSave() {
    const r = await save.run('POST', `/api/v1/workspaces/${wid}/week-templates`, { athleteId, monday, title, weeks });
    if (r) { setDone(`« ${title} » enregistrée dans la bibliothèque (${weeks > 1 ? `${weeks} semaines, ` : ''}${r.sessions} séance${r.sessions > 1 ? 's' : ''}).`); setMode(null); router.refresh(); }
  }
  async function doApply() {
    const r = await apply.run('POST', `/api/v1/workspaces/${wid}/week-templates/${chosen}/apply`, { athleteId, monday });
    if (r) { setDone(`${r.created.length} brouillon${r.created.length > 1 ? 's' : ''} ajouté${r.created.length > 1 ? 's' : ''}. Rien n’est encore visible pour ${first}.`); setMode(null); router.refresh(); }
  }
  async function doPublish() {
    const r = await publish.run('POST', `/api/v1/workspaces/${wid}/athletes/${athleteId}/publications`, { changes: drafts.map((d) => ({ id: d.id, revision: d.revision })) });
    if (r) { setDone(`${drafts.length} séance${drafts.length > 1 ? 's' : ''} publiée${drafts.length > 1 ? 's' : ''} : ${first} les voit maintenant.`); setMode(null); router.refresh(); }
  }
  const err = (e: ReturnType<typeof useIntent>['error']) => (e ? <p className="field-error" role="alert">{e.kind === 'error' ? (e.fields[0]?.rule ?? e.message) : 'Connexion perdue. Réessaie.'}</p> : null);

  return (
    <div className="wt">
      <div className="wt-actions">
        {drafts.length ? <button type="button" className="btn primary" aria-expanded={mode === 'publish'} onClick={() => toggle('publish')}>Publier la semaine ({drafts.length})</button> : null}
        <button type="button" className="btn" aria-expanded={mode === 'apply'} onClick={() => toggle('apply')}>📋 Appliquer une semaine type</button>
        {hasSessions ? <button type="button" className="btn" aria-expanded={mode === 'save'} onClick={() => toggle('save')}>💾 Enregistrer comme semaine type</button> : null}
      </div>
      {done ? <p className="banner ok" role="status">{done}</p> : null}

      {mode === 'publish' ? (
        <div className="wt-panel">
          <p><strong>Publier pour {first} :</strong></p>
          <ul className="wt-list">
            {drafts.map((d) => <li key={d.id}>{formatWeekday(d.localDate)} {formatShortDate(d.localDate)} · {d.title}{d.changed ? ' (modification d’une séance déjà publiée)' : ''}</li>)}
          </ul>
          {err(publish.error)}
          <div className="actions">
            <button type="button" className="btn primary" disabled={publish.pending} onClick={() => void doPublish()}>{publish.pending ? 'Publication…' : `Publier ${drafts.length} séance${drafts.length > 1 ? 's' : ''}`}</button>
            <button type="button" className="btn" onClick={() => setMode(null)}>Annuler</button>
          </div>
        </div>
      ) : null}

      {mode === 'apply' ? (
        <div className="wt-panel">
          {templates.length ? (
            <>
              <div className="field">
                <label htmlFor="wt-choice">Semaine type</label>
                <select id="wt-choice" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.weeks > 1 ? `${t.weeks} semaines, ` : ''}{t.days.length} séance{t.days.length > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              {tpl ? <ul className="wt-list">{tpl.days.map((d, i) => <li key={i}>{templateDayLabel(d.offset, tpl.weeks > 1)} · {d.title}</li>)}</ul> : null}
              <p className="hint">{tpl && tpl.weeks > 1 ? `Un brouillon par séance, sur ${tpl.weeks} semaines à partir de cette semaine (jusqu’au ${formatShortDate(addDays(monday, tpl.weeks * 7 - 1))}).` : 'Un brouillon par séance, aux mêmes jours de cette semaine.'} Les séances déjà prévues restent en place ; rien n’est publié.</p>
              {err(apply.error)}
              <div className="actions">
                <button type="button" className="btn primary" disabled={apply.pending || !chosen} onClick={() => void doApply()}>{apply.pending ? 'Ajout…' : `Ajouter ${tpl?.days.length ?? 0} brouillon${(tpl?.days.length ?? 0) > 1 ? 's' : ''}`}</button>
                <button type="button" className="btn" onClick={() => setMode(null)}>Annuler</button>
              </div>
            </>
          ) : <p className="muted">Aucune semaine type pour l’instant. Prépare une semaine, puis « Enregistrer comme semaine type ».</p>}
        </div>
      ) : null}

      {mode === 'save' ? (
        <div className="wt-panel">
          <div className="field">
            <label htmlFor="wt-title">Nom de la semaine type</label>
            <input id="wt-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="wt-weeks">Semaines à garder</label>
            <select id="wt-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {Array.from({ length: WEEK_TEMPLATE_MAX_WEEKS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'Cette semaine seulement' : `${n} semaines (jusqu’au ${formatShortDate(addDays(monday, n * 7 - 1))})`}</option>)}
            </select>
          </div>
          <p className="hint">Les séances de {weeks > 1 ? 'ces semaines' : 'cette semaine'} (hors annulées), sans élève ni date : réutilisables pour n’importe quel élève{weeks > 1 ? ', comme un programme type' : ''}.</p>
          {err(save.error)}
          <div className="actions">
            <button type="button" className="btn primary" disabled={save.pending || !title.trim()} onClick={() => void doSave()}>{save.pending ? 'Enregistrement…' : 'Enregistrer'}</button>
            <button type="button" className="btn" onClick={() => setMode(null)}>Annuler</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
