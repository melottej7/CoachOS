'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCENTS, ACCENT_LABELS, ACCENT_SWATCHES, AUDIENCE_LABELS, COACH_GOALS, COACH_GOAL_LABELS, LEVELS, LOGO_MAX_BYTES,
  SPOKEN_LANGUAGES, SPOKEN_LANGUAGE_LABELS, SPORTS, SPORT_LABELS,
  type Accent, type CoachGoal, type Level, type SpokenLanguage, type Sport,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import type { CoachCardData } from '@/components/coach-card';
import { fieldError, useIntent } from '@/components/use-intent';
import { AccentScope, Button, Card, ChipChecks, Cluster, Field, Grid, Heading, IconButton, Input, Stack, Text, Textarea } from '@/design';
import { CoachIdentity } from '@/views/coach-profile';
import { ErrorSummary } from '@/views/error-summary';
import s from './settings.module.css';

export interface SpaceInitial {
  name: string;
  coachName: string | null;
  logoVersion: string | null;
  tagline: string; bio: string; approach: string; experienceYears: string; certifications: string[];
  sports: Sport[]; audiences: Level[]; goals: CoachGoal[]; city: string; languages: SpokenLanguage[];
  websiteUrl: string; socialUrl: string; contactEmail: string; accent: Accent;
}

// D-169 : les spécialités d’abord — elles décident de ce que CoachOS montre (endurance, musculation) ; la présentation ensuite.
const STEPS = ['Spécialités', 'Présentation', 'Identité visuelle', 'Infos pratiques'] as const;
const LABELS = {
  name: 'Nom de l’espace', tagline: 'Accroche', bio: 'Qui es-tu ?', approach: 'Ton approche', experienceYears: 'Années d’expérience',
  contactEmail: 'E-mail de contact', websiteUrl: 'Site web', socialUrl: 'Réseau social', certifications: 'Diplômes',
};
const IDS = { name: 'name', tagline: 'tagline', bio: 'bio', approach: 'approach', experienceYears: 'years', contactEmail: 'contact', websiteUrl: 'website', socialUrl: 'social', certifications: 'cert' };

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <Stack as="section" gap={4} aria-labelledby={id}>
      <Stack gap={1}>
        <Heading level={2} size={3} id={id}>{title}</Heading>
        {intro ? <Text size="sm" muted>{intro}</Text> : null}
      </Stack>
      {children}
    </Stack>
  );
}

/**
 * Présentation de l’espace (D-022), refonte Chrono (D-155). Assistant en quatre étapes facultatives juste après la création,
 * puis formulaire unique dans Paramètres, avec le nom de l’espace. Le logo s’enregistre dès qu’il est choisi.
 */
export function SpaceForm({ wid, initial, mode, after }: { wid: string; initial: SpaceInitial; mode: 'wizard' | 'single'; after: string }) {
  const router = useRouter();
  const wizard = mode === 'wizard';
  const [step, setStep] = useState(0);
  const [v, setV] = useState(initial);
  const [cert, setCert] = useState('');
  const [logoVersion, setLogoVersion] = useState(initial.logoVersion);
  const [logoState, setLogoState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const top = useRef<HTMLDivElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const save = useIntent<unknown>();
  const set = <K extends keyof SpaceInitial>(k: K, val: SpaceInitial[K]) => setV((cur) => ({ ...cur, [k]: val }));
  const show = (k: number) => !wizard || step === k;
  const err = (p: string) => fieldError(save.error, p);

  // Étape suivante : l’écran remonte et le titre de l’étape reçoit le focus (pas à l’ouverture).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ block: 'start' });
    top.current?.focus({ preventScroll: true });
  }, [step]);

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
      router.refresh();
    } catch {
      setLogoState({ busy: false, error: 'Connexion interrompue. Réessaie.' });
    }
  }
  async function removeLogo() {
    setLogoState({ busy: true, error: null });
    const r = await mutate<{ logoVersion: null }>('DELETE', `/api/v1/workspaces/${wid}/logo`, {}, newKey());
    setLogoState({ busy: false, error: r.ok ? null : 'Suppression impossible. Réessaie.' });
    if (r.ok) { setLogoVersion(null); router.refresh(); }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (wizard && step < STEPS.length - 1) { setStep(step + 1); return; } // Entrée : avancer, ne pas envoyer
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
    if (done) { router.push(after); router.refresh(); }
  }

  const addCert = () => { if (cert.trim() && v.certifications.length < 10) { set('certifications', [...v.certifications, cert.trim()]); setCert(''); } };
  const preview: CoachCardData = {
    id: wid, name: v.name || 'Ton espace', coachName: initial.coachName, logoVersion,
    profile: { ...v, tagline: v.tagline || null, bio: null, approach: null, experienceYears: null, city: v.city || null, websiteUrl: null, socialUrl: null, contactEmail: null },
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={8}>
        <div ref={top} tabIndex={-1} style={{ outline: 'none' }}>
          {wizard ? (
            <Stack gap={2}>
              <div className={s.steps} aria-hidden="true">{STEPS.map((t, k) => <span key={t} data-on={k <= step ? '' : undefined} />)}</div>
              <Text size="sm" muted aria-live="polite">Étape {step + 1} sur {STEPS.length} · {STEPS[step]} · tout est facultatif et modifiable ensuite</Text>
            </Stack>
          ) : null}
        </div>
        <ErrorSummary error={save.error} onRetry={() => void persist()} labels={LABELS} ids={IDS} />

        {!wizard ? (
          <Field id="name" label="Nom de l’espace" hint="Visible par tes élèves, en haut de leur application et sur l’invitation" error={err('name')}>
            <Input id="name" required maxLength={120} value={v.name} onChange={(e) => set('name', e.target.value)} invalid={!!err('name')} hasHint />
          </Field>
        ) : null}

        {show(1) ? (
          <Section id="sec-pres" title="Présentation" intro={wizard ? 'Présente-toi en quelques mots : tes élèves verront cette présentation dès l’invitation.' : undefined}>
            <Field id="tagline" label="Accroche" hint="Une phrase, par exemple « Coaching running et trail, du premier 10 km à l’ultra »" error={err('tagline')}>
              <Input id="tagline" maxLength={120} value={v.tagline} onChange={(e) => set('tagline', e.target.value)} invalid={!!err('tagline')} hasHint />
            </Field>
            <Field id="bio" label="Qui es-tu ?" hint="Ton parcours, ce qui te motive à coacher" error={err('bio')}>
              <Textarea id="bio" maxLength={1500} value={v.bio} onChange={(e) => set('bio', e.target.value)} invalid={!!err('bio')} hasHint />
            </Field>
            <Field id="approach" label="Ton approche d’entraînement" hint="Comment tu construis les plans, ce que tu attends des retours" error={err('approach')}>
              <Textarea id="approach" maxLength={1000} value={v.approach} onChange={(e) => set('approach', e.target.value)} invalid={!!err('approach')} hasHint />
            </Field>
            <Field id="years" label="Années d’expérience en coaching" error={err('experienceYears')}>
              <Input id="years" type="number" inputMode="numeric" min={0} max={60} value={v.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} invalid={!!err('experienceYears')} style={{ maxWidth: 140 }} />
            </Field>
            <Stack gap={2}>
              <Field id="cert" label="Diplômes et certifications" hint={`10 au plus${v.certifications.length ? ` · ${v.certifications.length} ajouté${v.certifications.length > 1 ? 's' : ''}` : ''}`}>
                <Cluster gap={2} nowrap>
                  <Input id="cert" maxLength={120} value={cert} onChange={(e) => setCert(e.target.value)} placeholder="Par exemple : BPJEPS AF, DE Triathlon" hasHint
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCert(); } }} />
                  <Button icon="plus" disabled={!cert.trim() || v.certifications.length >= 10} onClick={addCert}>Ajouter</Button>
                </Cluster>
              </Field>
              {v.certifications.length ? (
                <ul className={s.certs} aria-label="Diplômes ajoutés">
                  {v.certifications.map((c, i) => (
                    <li key={`${c}-${i}`}><Text as="span">{c}</Text>
                      <IconButton icon="close" size="sm" label={`Retirer ${c}`} onClick={() => set('certifications', v.certifications.filter((_, k) => k !== i))} /></li>
                  ))}
                </ul>
              ) : null}
            </Stack>
          </Section>
        ) : null}

        {show(0) ? (
          <Section id="sec-spe" title="Spécialités" intro={wizard ? 'Quels sports encadres-tu, et pour qui ? Tes futurs élèves sauront s’ils sont au bon endroit.' : undefined}>
            <ChipChecks legend="Sports encadrés" value={v.sports} onChange={(x) => set('sports', x)} options={SPORTS.map((x) => ({ value: x, label: SPORT_LABELS[x] }))}
              hint="Décident aussi de ce que CoachOS te montre : endurance, musculation (Exercices, séances en séries, vidéos), ou les deux. Rien de coché : tout est proposé." />
            <ChipChecks legend="Publics accompagnés" value={v.audiences} onChange={(x) => set('audiences', x)} options={LEVELS.map((x) => ({ value: x, label: AUDIENCE_LABELS[x] }))} />
            <ChipChecks legend="Objectifs préparés" value={v.goals} onChange={(x) => set('goals', x)} options={COACH_GOALS.map((x) => ({ value: x, label: COACH_GOAL_LABELS[x] }))} />
          </Section>
        ) : null}

        {show(2) ? (
          <Section id="sec-id" title="Identité visuelle" intro={wizard ? 'Ton logo ou ta photo, et la couleur de ton espace : tes élèves les retrouvent sur leur téléphone.' : undefined}>
            <Stack gap={2}>
              <Text as="span" strong id="logo-label">Logo ou photo</Text>
              <Cluster gap={2}>
                <Button icon="upload" loading={logoState.busy} onClick={() => logoInput.current?.click()} aria-describedby="logo-hint">{logoVersion ? 'Changer le logo' : 'Choisir une image'}</Button>
                {logoVersion ? <Button variant="ghost" icon="trash" disabled={logoState.busy} onClick={() => void removeLogo()}>Retirer le logo</Button> : null}
              </Cluster>
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="ds-visually-hidden" tabIndex={-1} aria-hidden="true"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void uploadLogo(f); }} />
              <Text size="sm" muted id="logo-hint">PNG, JPEG ou WebP, 512 Kio au plus. Enregistré dès qu’il est choisi.</Text>
              {logoState.error ? <Text size="sm" tone="danger" role="alert">{logoState.error}</Text> : null}
            </Stack>
            <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <Stack gap={2}>
                <Text as="legend" strong>Couleur de l’espace</Text>
                <Text size="sm" muted>Palettes lisibles en clair et en sombre ; tes élèves la voient dans leur application.</Text>
                <div className={s.swatches}>
                  {ACCENTS.map((a) => (
                    <label key={a} className={s.swatch}>
                      <input type="radio" name="accent" value={a} checked={v.accent === a} onChange={() => set('accent', a)} />
                      <span className={s.dot} style={{ background: ACCENT_SWATCHES[a] }} aria-hidden="true" />{ACCENT_LABELS[a]}
                    </label>
                  ))}
                </div>
              </Stack>
            </fieldset>
            <AccentScope accent={v.accent}>
              <div className={s.preview} aria-label="Aperçu de ce que voient tes élèves">
                <Stack gap={3}>
                  <Text size="sm" muted>Aperçu chez tes élèves</Text>
                  <CoachIdentity data={preview} level={2} />
                  <Cluster gap={2}><Button variant="coach" size="sm" tabIndex={-1} aria-hidden="true">Voir la séance</Button></Cluster>
                </Stack>
              </div>
            </AccentScope>
          </Section>
        ) : null}

        {show(3) ? (
          <Section id="sec-info" title="Infos pratiques" intro={wizard ? 'Dernière étape : où te trouver et comment te contacter. Tout est facultatif.' : 'Visibles par tes élèves et par les personnes que tu invites.'}>
            <Grid min={220} gap={4}>
              <Field id="city" label="Ville ou région"><Input id="city" maxLength={80} value={v.city} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field id="contact" label="E-mail de contact affiché" error={err('contactEmail')}>
                <Input id="contact" type="email" maxLength={254} value={v.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} invalid={!!err('contactEmail')} />
              </Field>
            </Grid>
            <ChipChecks legend="Langues parlées" value={v.languages} onChange={(x) => set('languages', x)} options={SPOKEN_LANGUAGES.map((x) => ({ value: x, label: SPOKEN_LANGUAGE_LABELS[x] }))} />
            <Grid min={220} gap={4}>
              <Field id="website" label="Site web" hint="https://…" error={err('websiteUrl')}>
                <Input id="website" type="url" inputMode="url" maxLength={200} value={v.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} invalid={!!err('websiteUrl')} hasHint />
              </Field>
              <Field id="social" label="Réseau social" hint="https://…" error={err('socialUrl')}>
                <Input id="social" type="url" inputMode="url" maxLength={200} value={v.socialUrl} onChange={(e) => set('socialUrl', e.target.value)} invalid={!!err('socialUrl')} hasHint />
              </Field>
            </Grid>
          </Section>
        ) : null}

        <Card pad={4} tinted>
          <Cluster gap={2}>
            {wizard && step > 0 ? <Button icon="chevronLeft" onClick={() => setStep(step - 1)}>Précédent</Button> : null}
            {wizard && step < STEPS.length - 1
              ? <Button variant="primary" iconRight="arrowRight" onClick={() => setStep(step + 1)}>Suivant</Button>
              : <Button type="submit" variant="primary" icon="check" loading={save.pending}>{wizard ? 'Terminer' : 'Enregistrer la présentation'}</Button>}
            {wizard ? <Button variant="ghost" disabled={save.pending} onClick={() => void persist()}>Enregistrer et finir plus tard</Button> : null}
          </Cluster>
        </Card>
      </Stack>
    </form>
  );
}
