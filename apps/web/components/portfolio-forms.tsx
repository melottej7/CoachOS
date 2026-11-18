'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  addDays, APPOINTMENT_KIND_LABELS, APPOINTMENT_KINDS, LEVEL_LABELS, LEVELS, PRIORITY_LABELS, SPORT_LABELS, SPORTS, TASK_KIND_LABELS, TASK_KINDS,
  type AppointmentKind, type AutoRule, type Level, type Sport, type TaskKind,
} from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

// Formulaires des lots G et H (D-032). Chaque action = une intention idempotente, puis rafraîchissement de la page.

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function useAction() {
  const router = useRouter();
  const intent = useIntent<unknown>();
  const act = async (method: Method, url: string, body: unknown = {}) => {
    const r = await intent.run(method, url, body);
    if (r !== null) router.refresh();
    return r !== null;
  };
  return { ...intent, act };
}

/** Bouton d’action simple (terminer, archiver, retirer…). */
export function ActionButton({ method, url, body, children, className = 'btn small', confirm, label }: {
  method: Method; url: string; body?: unknown; children: ReactNode; className?: string; confirm?: string; label?: string;
}) {
  const { act, pending, error } = useAction();
  return (
    <>
      <button type="button" className={className} disabled={pending} aria-label={label}
        onClick={() => { if (confirm && !window.confirm(confirm)) return; void act(method, url, body ?? {}); }}>
        {children}
      </button>
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Réessaie.'}</span> : null}
    </>
  );
}

/** Petit formulaire repliable « + Ajouter … ». */
function Disclosure({ label, children, open: initial = false }: { label: string; children: (close: () => void) => ReactNode; open?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="disclosure" ref={ref} open={initial}>
      <summary className="btn small">{label}</summary>
      <div className="disclosure-body">{children(() => ref.current?.removeAttribute('open'))}</div>
    </details>
  );
}

// ---------- Groupes ----------

export function CreateTeamForm({ wid }: { wid: string }) {
  const { act, pending, error } = useAction();
  const [name, setName] = useState('');
  return (
    <form className="inline-form" onSubmit={async (e) => { e.preventDefault(); if (await act('POST', `/api/v1/workspaces/${wid}/teams`, { name })) setName(''); }}>
      <label className="visually-hidden" htmlFor="team-name">Nom du nouveau groupe</label>
      <input id="team-name" className="input" placeholder="Ex. Préparation marathon" maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
        aria-invalid={!!fieldError(error, 'name')} />
      <button className="btn primary small" type="submit" disabled={pending || !name.trim()}>Créer le groupe</button>
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? fieldError(error, 'name') ?? error.message : 'Connexion perdue. Réessaie.'}</span> : null}
    </form>
  );
}

export function RenameTeam({ wid, id, name }: { wid: string; id: string; name: string }) {
  const { act, pending, error } = useAction();
  const [value, setValue] = useState(name);
  return (
    <Disclosure label="Renommer">
      {(close) => (
        <form className="inline-form" onSubmit={async (e) => { e.preventDefault(); if (await act('PATCH', `/api/v1/workspaces/${wid}/teams/${id}`, { name: value })) close(); }}>
          <label className="visually-hidden" htmlFor={`rename-${id}`}>Nouveau nom</label>
          <input id={`rename-${id}`} className="input" maxLength={60} value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn primary small" type="submit" disabled={pending}>Enregistrer</button>
          {error ? <span className="field-error" role="alert">{error.kind === 'error' ? fieldError(error, 'name') ?? error.message : 'Connexion perdue.'}</span> : null}
        </form>
      )}
    </Disclosure>
  );
}

/** Appartenances de l’élève : retirer d’un groupe, ajouter à un autre. */
export function TeamMembership({ wid, aid, teams, all }: { wid: string; aid: string; teams: { id: string; name: string }[]; all: { id: string; name: string }[] }) {
  const { act, pending, error } = useAction();
  const others = all.filter((t) => !teams.some((m) => m.id === t.id));
  return (
    <div className="tags" role="group" aria-label="Groupes de l’élève">
      {teams.map((t) => (
        <span className="tag" key={t.id}>{t.name}
          <button type="button" className="tag-x" disabled={pending} aria-label={`Retirer du groupe ${t.name}`}
            onClick={() => void act('DELETE', `/api/v1/workspaces/${wid}/teams/${t.id}/athletes/${aid}`)}>✕</button>
        </span>
      ))}
      {others.length ? (
        <select className="select small" value="" aria-label="Ajouter à un groupe" disabled={pending}
          onChange={(e) => { if (e.target.value) void act('PUT', `/api/v1/workspaces/${wid}/teams/${e.target.value}/athletes/${aid}`); }}>
          <option value="">+ Ajouter à un groupe…</option>
          {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      ) : teams.length ? null : <span className="muted">Aucun groupe dans ton espace pour l’instant.</span>}
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue.'}</span> : null}
    </div>
  );
}

// ---------- Niveau par sport ----------

export function LevelConfirm({ wid, aid, sport, declared, confirmed }: { wid: string; aid: string; sport: Sport; declared: Level | null; confirmed: Level | null }) {
  const { act, pending, error } = useAction();
  const [level, setLevel] = useState<Level>(confirmed ?? declared ?? 'intermediate');
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void act('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/levels`, { sport, level }); }}>
      <label htmlFor={`level-${sport}`}>{SPORT_LABELS[sport]}</label>
      <select id={`level-${sport}`} className="select small" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
        {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l].label}</option>)}
      </select>
      <button className="btn primary small" type="submit" disabled={pending}>{confirmed ? 'Mettre à jour' : 'Confirmer'}</button>
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue.'}</span> : null}
    </form>
  );
}

// ---------- Objectifs et notes ----------

export function GoalForm({ wid, aid, sport }: { wid: string; aid: string; sport: Sport | null }) {
  const { act, pending, error } = useAction();
  return (
    <Disclosure label="+ Ajouter un objectif">
      {(close) => (
        <form className="stack" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const ok = await act('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals`, { title: f.get('title'), sport: f.get('sport'), targetDate: f.get('targetDate') || null });
          if (ok) { e.currentTarget?.reset(); close(); }
        }}>
          <ErrorSummary error={error} />
          <div className="form-row">
            <div className="field"><label htmlFor="goal-title">Objectif</label><input id="goal-title" name="title" maxLength={200} required placeholder="Ex. Semi-marathon en moins de 1 h 45" /></div>
            <div className="field"><label htmlFor="goal-sport">Sport</label>
              <select id="goal-sport" name="sport" defaultValue={sport ?? 'running'}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="goal-date">Échéance <span className="hint">Facultatif</span></label><input id="goal-date" name="targetDate" type="date" /></div>
          <div className="actions"><button className="btn primary small" type="submit" disabled={pending}>Ajouter l’objectif</button></div>
        </form>
      )}
    </Disclosure>
  );
}

export function NoteForm({ wid, aid }: { wid: string; aid: string }) {
  const { act, pending, error } = useAction();
  const [body, setBody] = useState('');
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await act('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/notes`, { body })) setBody(''); }}>
      <div className="field">
        <label htmlFor="note-body">Nouvelle note <span className="hint">Visible par toi seul·e, jamais par l’élève</span></label>
        <textarea id="note-body" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ex. Préfère les séances le matin, revient d’une pause de deux mois." />
      </div>
      <div className="actions"><button className="btn small" type="submit" disabled={pending || !body.trim()}>Enregistrer la note</button></div>
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue.'}</span> : null}
    </form>
  );
}

// ---------- Tâches ----------

export function TaskForm({ wid, athletes, teams, athleteId, open, today }: {
  wid: string; athletes: { id: string; name: string }[]; teams: { id: string; name: string }[]; athleteId?: string; open?: boolean; today: string;
}) {
  const { act, pending, error } = useAction();
  return (
    <Disclosure label="+ Tâche" open={open}>
      {(close) => (
        <form className="stack" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const ok = await act('POST', `/api/v1/workspaces/${wid}/tasks`, {
            title: f.get('title'), kind: f.get('kind'), athleteId: f.get('athleteId') || null, teamId: f.get('teamId') || null,
            dueOn: f.get('dueOn') || null, priority: Number(f.get('priority')), notes: f.get('notes') || null,
          });
          if (ok) { form.reset(); close(); }
        }}>
          <ErrorSummary error={error} />
          <div className="field"><label htmlFor="task-title">Quoi faire ?</label><input id="task-title" name="title" maxLength={200} required placeholder="Ex. Appeler Emma pour préparer son bloc de décembre" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="task-kind">Type</label>
              <select id="task-kind" name="kind" defaultValue="other">{TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABELS[k as TaskKind]}</option>)}</select></div>
            <div className="field"><label htmlFor="task-athlete">Élève <span className="hint">Facultatif</span></label>
              <select id="task-athlete" name="athleteId" defaultValue={athleteId ?? ''}>
                <option value="">Aucun</option>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="task-due">Échéance <span className="hint">Facultatif</span></label><input id="task-due" name="dueOn" type="date" defaultValue={today} /></div>
            <div className="field"><label htmlFor="task-priority">Priorité</label>
              <select id="task-priority" name="priority" defaultValue="1">{([0, 1, 2, 3] as const).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></div>
          </div>
          {teams.length ? (
            <div className="field"><label htmlFor="task-team">Groupe <span className="hint">Facultatif</span></label>
              <select id="task-team" name="teamId" defaultValue=""><option value="">Aucun</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          ) : null}
          <div className="field"><label htmlFor="task-notes">Notes <span className="hint">Facultatif</span></label><textarea id="task-notes" name="notes" maxLength={2000} /></div>
          <div className="actions"><button className="btn primary small" type="submit" disabled={pending}>Ajouter la tâche</button></div>
        </form>
      )}
    </Disclosure>
  );
}

/** Actions d’une tâche : terminer, reporter, annuler (humaine) ou « plus tard » (suivi automatique). */
export function TaskActions({ wid, source, id, rule, sourceRef, revision, today, link }: {
  wid: string; source: 'manual' | 'auto'; id: string | null; rule: AutoRule | null; sourceRef: string; revision: number | null; today: string; link: string | null;
}) {
  const { act, pending, error } = useAction();
  const patch = (body: Record<string, unknown>) => act('PATCH', `/api/v1/workspaces/${wid}/tasks/${id}`, { expectedRevision: revision, ...body });
  const snooze = (days: number) => act('PUT', `/api/v1/workspaces/${wid}/auto-tasks/${sourceRef}`, { rule, until: addDays(today, days) });
  return (
    <span className="task-actions">
      {link ? <a className="btn small primary" href={link}>Ouvrir</a> : null}
      {source === 'manual' ? (
        <>
          <button type="button" className="btn small" disabled={pending} onClick={() => void patch({ status: 'done' })}>Terminé</button>
          <details className="b-more">
            <summary className="icon-btn" aria-label="Plus d’actions">⋯</summary>
            <div className="b-menu">
              <button type="button" onClick={() => void patch({ status: 'in_progress' })}>En cours</button>
              <button type="button" onClick={() => void patch({ status: 'waiting' })}>En attente</button>
              <button type="button" onClick={() => void patch({ dueOn: addDays(today, 1), status: 'postponed' })}>Reporter à demain</button>
              <button type="button" onClick={() => void patch({ dueOn: addDays(today, 7), status: 'postponed' })}>Reporter d’une semaine</button>
              <button type="button" onClick={() => void patch({ status: 'canceled' })}>Annuler la tâche</button>
            </div>
          </details>
        </>
      ) : (
        <details className="b-more">
          <summary className="btn small">Plus tard</summary>
          <div className="b-menu">
            <button type="button" onClick={() => void snooze(1)}>Demain</button>
            <button type="button" onClick={() => void snooze(3)}>Dans 3 jours</button>
            <button type="button" onClick={() => void snooze(7)}>Dans une semaine</button>
          </div>
        </details>
      )}
      {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Réessaie.'}</span> : null}
    </span>
  );
}

// ---------- Rendez-vous ----------

export function AppointmentForm({ wid, athletes, athleteId, timeZone, today }: {
  wid: string; athletes: { id: string; name: string; timeZone: string }[]; athleteId?: string; timeZone: string; today: string;
}) {
  const { act, pending, error } = useAction();
  const [who, setWho] = useState(athleteId ?? athletes[0]?.id ?? '');
  const [kind, setKind] = useState<AppointmentKind>('video');
  const tz = athletes.find((a) => a.id === who)?.timeZone ?? timeZone;
  return (
    <Disclosure label="+ Rendez-vous">
      {(close) => (
        <form className="stack" onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          const ok = await act('POST', `/api/v1/workspaces/${wid}/appointments`, {
            athleteId: who, title: f.get('title'), kind, startsLocal: `${f.get('date')}T${f.get('time')}`, timeZone: tz,
            durationMin: Number(f.get('duration')), videoUrl: kind === 'video' ? f.get('videoUrl') || null : null, prepNotes: f.get('prep') || null,
          });
          if (ok) { form.reset(); close(); }
        }}>
          <ErrorSummary error={error} />
          <div className="form-row">
            <div className="field"><label htmlFor="ap-athlete">Élève</label>
              <select id="ap-athlete" value={who} onChange={(e) => setWho(e.target.value)} required>{athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div className="field"><label htmlFor="ap-kind">Type</label>
              <select id="ap-kind" value={kind} onChange={(e) => setKind(e.target.value as AppointmentKind)}>{APPOINTMENT_KINDS.map((k) => <option key={k} value={k}>{APPOINTMENT_KIND_LABELS[k]}</option>)}</select></div>
          </div>
          <div className="field"><label htmlFor="ap-title">Objet</label><input id="ap-title" name="title" maxLength={120} required defaultValue="Bilan" /></div>
          <div className="form-row">
            <div className="field"><label htmlFor="ap-date">Date</label><input id="ap-date" name="date" type="date" required defaultValue={today} /></div>
            <div className="field"><label htmlFor="ap-time">Heure <span className="hint">{tz.replace(/_/g, ' ')}</span></label><input id="ap-time" name="time" type="time" required defaultValue="18:00" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label htmlFor="ap-duration">Durée (min)</label><input id="ap-duration" name="duration" type="number" min={5} max={480} step={5} defaultValue={30} required /></div>
            {kind === 'video' ? (
              <div className="field"><label htmlFor="ap-url">Lien de visio <span className="hint">https://…</span></label><input id="ap-url" name="videoUrl" type="url" placeholder="https://" aria-invalid={!!fieldError(error, 'videoUrl')} />
                {fieldError(error, 'videoUrl') ? <span className="field-error">{fieldError(error, 'videoUrl')}</span> : null}</div>
            ) : <div />}
          </div>
          <div className="field"><label htmlFor="ap-prep">Préparation <span className="hint">Facultatif · visible par toi seul·e</span></label><textarea id="ap-prep" name="prep" maxLength={4000} /></div>
          <div className="actions"><button className="btn primary small" type="submit" disabled={pending}>Planifier</button></div>
        </form>
      )}
    </Disclosure>
  );
}

export function AppointmentReport({ wid, id, revision, report }: { wid: string; id: string; revision: number; report: string | null }) {
  const { act, pending, error } = useAction();
  const [text, setText] = useState(report ?? '');
  return (
    <Disclosure label={report ? 'Modifier le compte rendu' : 'Faire le compte rendu'}>
      {(close) => (
        <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (await act('PATCH', `/api/v1/workspaces/${wid}/appointments/${id}`, { expectedRevision: revision, status: 'done', report: text })) close(); }}>
          <div className="field"><label htmlFor={`rep-${id}`}>Compte rendu</label><textarea id={`rep-${id}`} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} /></div>
          <div className="actions"><button className="btn primary small" type="submit" disabled={pending}>Enregistrer et marquer fait</button></div>
          {error ? <span className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue.'}</span> : null}
        </form>
      )}
    </Disclosure>
  );
}
