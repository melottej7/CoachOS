'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import {
  ACCENTS, ACCENT_LABELS, ACCENT_SWATCHES, AUDIENCE_LABELS, COACH_GOALS, COACH_GOAL_LABELS, LEVELS, LOGO_MAX_BYTES,
  SPOKEN_LANGUAGES, SPOKEN_LANGUAGE_LABELS, SPORTS, SPORT_LABELS,
  type Accent, type CoachGoal, type Level, type SpokenLanguage, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from './api-client';
import { CoachHeader, type CoachCardData } from './coach-card';
import { ErrorSummary } from './feedback-banners';
import { MascotSays } from './mascot';
import { fieldError, useIntent } from './use-intent';

export interface SpaceInitial {
  name: string;
  coachName: string | null;
  logoVersion: string | null;
  tagline: string; bio: string; approach: string; experienceYears: string; certifications: string[];
  sports: Sport[]; audiences: Level[]; goals: CoachGoal[]; city: string; languages: SpokenLanguage[];
  websiteUrl: string; socialUrl: string; contactEmail: string; accent: Accent;
}

const STEPS = ['Présentation', 'Spécialités', 'Identité visuelle', 'Infos pratiques'] as const;

function Chips<T extends string>({ legend, hint, options, labels, value, onChange }: {
  legend: string; hint?: string; options: readonly T[]; labels: Record<T, string>; value: T[]; onChange: (v: T[]) => void;
}) {
  const toggle = (o: T) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <fieldset className="choice">
      <legend>{legend} {hint ? <span className="hint">{hint}</span> : null}</legend>
      <div className="chips">
        {options.map((o) => (
          <label key={o}><input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} /> {labels[o]}</label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Personnalisation de l’espace (D-022). Assistant en quatre étapes facultatives après la création,
 * puis page unique dans Paramètres. Le logo s’enregistre dès qu’il est choisi.
 */
export function CoachSpaceForm({ wid, initial, mode, after }: { wid: string; initial: SpaceInitial; mode: 'wizard' | 'single'; after: string }) {
  const router = useRouter();
  const wizard = mode === 'wizard';
  const [step, setStep] = useState(0);
  const [v, setV] = useState(initial);
  const [cert, setCert] = useState('');
  const [logoVersion, setLogoVersion] = useState(initial.logoVersion);
  const [logoState, setLogoState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const top = useRef<HTMLDivElement>(null);
  const save = useIntent<unknown>();
  const set = <K extends keyof SpaceInitial>(k: K, val: SpaceInitial[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const show = (k: number) => !wizard || step === k;
  const err = (p: string) => fieldError(save.error, p);

  function go(k: number) {
    setStep(k);
    top.current?.scrollIntoView({ block: 'start' });
    top.current?.focus();
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setLogoState({ busy: false, error: 'Format accepté : PNG, JPEG ou WebP.' });
    if (file.size > LOGO_MAX_BYTES) return setLogoState({ busy: false, error: 'Image trop lourde : 512 Kio au plus.' });
    setLogoState({ busy: true, error: null });
    try {
      const res = await fetch(`/api/v1/workspaces/${wid}/logo`, { method: 'PUT', headers: { 'content-type': file.type, 'idempotency-key': newKey() }, body: file });
      const body = (await res.json().catch(() => null)) as { logoVersion?: string; error?: { message: string; fields?: { rule: string }[] } } | null;
      if (!res.ok) return setLogoState({ busy: false, error: body?.error?.fields?.[0]?.rule ?? body?.error?.message ?? 'Envoi impossible.' });
      setLogoVersion(body?.logoVersion ?? null);
      setLogoState({ busy: false, error: null });
    } catch {
      setLogoState({ busy: false, error: 'Connexion interrompue. Réessaie.' });
    }
  }
  async function removeLogo() {
    setLogoState({ busy: true, error: null });
    const r = await mutate<{ logoVersion: null }>('DELETE', `/api/v1/workspaces/${wid}/logo`, {}, newKey());
    setLogoState({ busy: false, error: r.ok ? null : 'Suppression impossible. Réessaie.' });
    if (r.ok) setLogoVersion(null);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (wizard && step < STEPS.length - 1) return go(step + 1); // Entrée : avancer, ne pas envoyer
    await persist();
  }

  async function persist() {
    const years = v.experienceYears.trim() === '' ? null : Number(v.experienceYears);
    const done = await save.run('PUT', `/api/v1/workspaces/${wid}/profile`, {
      name: v.name, tagline: v.tagline, bio: v.bio, approach: v.approach,
      experienceYears: years === null || Number.isNaN(years) ? null : Math.round(years),
      certifications: v.certifications, sports: v.sports, audiences: v.audiences, goals: v.goals,
      city: v.city, languages: v.languages, websiteUrl: v.websiteUrl, socialUrl: v.socialUrl, contactEmail: v.contactEmail, accent: v.accent,
    });
    if (done) {
      router.push(after);
      router.refresh();
    }
  }

  const preview: CoachCardData = {
    id: wid, name: v.name || 'Ton espace', coachName: initial.coachName, logoVersion,
    profile: { ...v, tagline: v.tagline || null, bio: null, approach: null, experienceYears: null, city: v.city || null, websiteUrl: null, socialUrl: null, contactEmail: null },
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div ref={top} tabIndex={-1} style={{ outline: 'none' }}>
        {wizard ? (
          <>
            <div className="steps" aria-hidden="true">{STEPS.map((t, k) => <span key={t} className={k <= step ? 'on' : ''} />)}</div>
            <p className="muted" aria-live="polite">Étape {step + 1} sur {STEPS.length} · {STEPS[step]} · tout est facultatif et modifiable ensuite</p>
          </>
        ) : null}
      </div>
      <ErrorSummary error={save.error} onRetry={() => void persist()} />

      {!wizard ? (
        <div className="field">
          <label htmlFor="name">Nom de l’espace</label>
          <input id="name" required maxLength={120} value={v.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!err('name')} />
          {err('name') ? <span className="field-error">{err('name')}</span> : null}
        </div>
      ) : null}

      {show(0) ? (
        <section className="stack" aria-labelledby="sec-pres">
          <h2 id="sec-pres">Présentation</h2>
          {wizard ? <MascotSays>Présente-toi en quelques mots : tes athlètes verront cette présentation dès l’invitation.</MascotSays> : null}
          <div className="field">
            <label htmlFor="tagline">Accroche <span className="hint">Une phrase, par exemple « Coaching running et trail, du premier 10 km à l’ultra »</span></label>
            <input id="tagline" maxLength={120} value={v.tagline} onChange={(e) => set('tagline', e.target.value)} aria-invalid={!!err('tagline')} />
          </div>
          <div className="field">
            <label htmlFor="bio">Qui es-tu ? <span className="hint">Ton parcours, ce qui te motive à coacher</span></label>
            <textarea id="bio" maxLength={1500} value={v.bio} onChange={(e) => set('bio', e.target.value)} aria-invalid={!!err('bio')} />
          </div>
          <div className="field">
            <label htmlFor="approach">Ton approche d’entraînement <span className="hint">Comment tu construis les plans, ce que tu attends des retours</span></label>
            <textarea id="approach" maxLength={1000} value={v.approach} onChange={(e) => set('approach', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="years">Années d’expérience en coaching</label>
            <input id="years" type="number" inputMode="numeric" min={0} max={60} value={v.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} aria-invalid={!!err('experienceYears')} />
          </div>
          <div className="field list-input">
            <label htmlFor="cert">Diplômes et certifications <span className="hint">10 au plus</span></label>
            {v.certifications.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {v.certifications.map((c, i) => (
                  <li key={`${c}-${i}`}>{c} <button type="button" className="link-btn" onClick={() => set('certifications', v.certifications.filter((_, k) => k !== i))} aria-label={`Retirer ${c}`}>Retirer</button></li>
                ))}
              </ul>
            ) : null}
            <div className="row-inline">
              <input id="cert" maxLength={120} value={cert} onChange={(e) => setCert(e.target.value)} placeholder="Par exemple : BPJEPS AF, DE Triathlon"
                onKeyDown={(e) => {
                  // Entrée ajoute le diplôme au lieu d’avancer dans l’assistant.
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  if (cert.trim() && v.certifications.length < 10) { set('certifications', [...v.certifications, cert.trim()]); setCert(''); }
                }} />
              <button type="button" className="btn" disabled={!cert.trim() || v.certifications.length >= 10}
                onClick={() => { set('certifications', [...v.certifications, cert.trim()]); setCert(''); }}>Ajouter</button>
            </div>
          </div>
        </section>
      ) : null}

      {show(1) ? (
        <section className="stack" aria-labelledby="sec-spe">
          <h2 id="sec-spe">Spécialités</h2>
          {wizard ? <MascotSays>Quels sports encadres-tu, et pour qui ? Cela aide tes futurs athlètes à savoir s’ils sont au bon endroit.</MascotSays> : null}
          <Chips legend="Sports encadrés" options={SPORTS} labels={SPORT_LABELS} value={v.sports} onChange={(x) => set('sports', x)} />
          <Chips legend="Publics accompagnés" options={LEVELS} labels={AUDIENCE_LABELS} value={v.audiences} onChange={(x) => set('audiences', x)} />
          <Chips legend="Objectifs préparés" options={COACH_GOALS} labels={COACH_GOAL_LABELS} value={v.goals} onChange={(x) => set('goals', x)} />
        </section>
      ) : null}

      {show(2) ? (
        <section className="stack" aria-labelledby="sec-id">
          <h2 id="sec-id">Identité visuelle</h2>
          {wizard ? <MascotSays mood="wink">Ajoute ton logo ou ta photo, et choisis la couleur de ton espace. Tes athlètes la retrouveront sur leur téléphone.</MascotSays> : null}
          <div className="field">
            <label htmlFor="logo">Logo ou photo <span className="hint">PNG, JPEG ou WebP, 512 Kio au plus. Enregistré dès qu’il est choisi.</span></label>
            <input id="logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={logoState.busy} onChange={(e) => void uploadLogo(e.target.files?.[0])} />
            {logoState.busy ? <span className="muted" role="status">Envoi…</span> : null}
            {logoState.error ? <span className="field-error" role="alert">{logoState.error}</span> : null}
            {logoVersion ? <button type="button" className="link-btn" onClick={() => void removeLogo()}>Retirer le logo</button> : null}
          </div>
          <fieldset className="choice">
            <legend>Couleur de l’espace <span className="hint">Palettes lisibles en mode clair et sombre</span></legend>
            <div className="accent-swatches">
              {ACCENTS.map((a) => (
                <label key={a}>
                  <input type="radio" name="accent" value={a} checked={v.accent === a} onChange={() => set('accent', a)} />
                  <span className="swatch" style={{ background: ACCENT_SWATCHES[a] }} aria-hidden="true" /> {ACCENT_LABELS[a]}
                </label>
              ))}
            </div>
          </fieldset>
          <div data-accent={v.accent} className="tour-preview" aria-label="Aperçu de l’en-tête vu par tes athlètes">
            <CoachHeader data={preview} />
            <div className="actions" style={{ marginTop: 12 }}>
              <span className="btn primary" aria-hidden="true">Voir la séance</span>
              <span className="pill">Course à pied</span>
            </div>
          </div>
        </section>
      ) : null}

      {show(3) ? (
        <section className="stack" aria-labelledby="sec-info">
          <h2 id="sec-info">Infos pratiques</h2>
          {wizard ? <MascotSays>Dernière étape : où te trouver et comment te contacter. Tout est facultatif.</MascotSays> : null}
          <div className="form-row">
            <div className="field">
              <label htmlFor="city">Ville ou région</label>
              <input id="city" maxLength={80} value={v.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="contact">E-mail de contact affiché</label>
              <input id="contact" type="email" maxLength={254} value={v.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} aria-invalid={!!err('contactEmail')} />
              {err('contactEmail') ? <span className="field-error">{err('contactEmail')}</span> : null}
            </div>
          </div>
          <Chips legend="Langues parlées" options={SPOKEN_LANGUAGES} labels={SPOKEN_LANGUAGE_LABELS} value={v.languages} onChange={(x) => set('languages', x)} />
          <div className="form-row">
            <div className="field">
              <label htmlFor="website">Site web <span className="hint">https://…</span></label>
              <input id="website" type="url" inputMode="url" maxLength={200} value={v.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} aria-invalid={!!err('websiteUrl')} />
              {err('websiteUrl') ? <span className="field-error">{err('websiteUrl')}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="social">Réseau social <span className="hint">https://…</span></label>
              <input id="social" type="url" inputMode="url" maxLength={200} value={v.socialUrl} onChange={(e) => set('socialUrl', e.target.value)} aria-invalid={!!err('socialUrl')} />
              {err('socialUrl') ? <span className="field-error">{err('socialUrl')}</span> : null}
            </div>
          </div>
          <p className="muted">Ces informations sont visibles par tes athlètes et par les personnes que tu invites.</p>
        </section>
      ) : null}

      <div className="actions">
        {wizard && step > 0 ? <button key="prev" type="button" className="btn" onClick={() => go(step - 1)}>Précédent</button> : null}
        {wizard && step < STEPS.length - 1 ? (
          <button key="next" type="button" className="btn primary" onClick={() => go(step + 1)}>Suivant</button>
        ) : (
          <button key="submit" type="submit" className="btn primary" disabled={save.pending}>{save.pending ? 'Enregistrement…' : wizard ? 'Terminer' : 'Enregistrer'}</button>
        )}
        {wizard ? <button key="skip" type="button" className="link-btn" onClick={() => void persist()}>Enregistrer et finir plus tard</button> : null}
      </div>
    </form>
  );
}
