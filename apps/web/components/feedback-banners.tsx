'use client';

import { useEffect, useRef } from 'react';
import type { IntentError } from './use-intent';

const FIELD_LABELS: Record<string, string> = {
  'data.title': 'Titre',
  'data.localDate': 'Date',
  'data.sport': 'Sport',
  'data.durationSeconds': 'Durée',
  'data.instructions': 'Consignes',
  state: 'Réalisation',
  durationSeconds: 'Durée réalisée',
  rpe: 'Effort ressenti',
  comment: 'Commentaire',
  name: 'Nom de l’espace',
  displayName: 'Nom de l’athlète',
  timeZone: 'Fuseau horaire',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  tagline: 'Accroche',
  bio: 'Présentation',
  approach: 'Approche d’entraînement',
  experienceYears: 'Années d’expérience',
  certifications: 'Diplômes et certifications',
  city: 'Ville ou région',
  websiteUrl: 'Site web',
  socialUrl: 'Réseau social',
  contactEmail: 'E-mail de contact',
  mainGoal: 'Objectif principal',
  nextEventName: 'Prochaine course',
  nextEventDate: 'Date de la course',
  sport: 'Sport',
  level: 'Niveau',
  experience: 'Ancienneté',
  weeklySessions: 'Séances par semaine',
};

const FIELD_IDS: Record<string, string> = {
  'data.title': 'title',
  'data.localDate': 'localDate',
  'data.sport': 'sport',
  'data.durationSeconds': 'duration',
  'data.instructions': 'instructions',
  state: 'state-completed',
  durationSeconds: 'duration',
  rpe: 'rpe-none',
  comment: 'comment',
  name: 'name',
  displayName: 'displayName',
  timeZone: 'timeZone',
  email: 'email',
  tagline: 'tagline',
  bio: 'bio',
  approach: 'approach',
  experienceYears: 'years',
  certifications: 'cert',
  city: 'city',
  websiteUrl: 'website',
  socialUrl: 'social',
  contactEmail: 'contact',
  mainGoal: 'goal',
  nextEventName: 'eventName',
  nextEventDate: 'eventDate',
};

/**
 * Résumé d’erreurs placé avant le formulaire, focus à l’apparition (design system : ErrorSummary).
 * Réseau coupé : la saisie reste en place et l’action peut être rejouée avec la même clé.
 */
/** « data.intervals.1.steps.0.measure.seconds » → « Bloc 2.1 ». */
function blockLabel(path: string): string | null {
  const m = /^data\.intervals\.(\d+)(?:\.steps\.(\d+))?(?:\.steps\.(\d+))?/.exec(path);
  if (!m) return null;
  return 'Bloc ' + [m[1], m[2], m[3]].filter((x) => x !== undefined).map((x) => Number(x) + 1).join('.');
}

export function ErrorSummary({ error, onRetry, retryLabel = 'Réessayer' }: { error: IntentError | null; onRetry?: () => void; retryLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;

  if (error.kind === 'network' || error.status === 503) {
    return (
      <div ref={ref} tabIndex={-1} className="banner warn" role="alert">
        <p>
          <strong>Connexion interrompue.</strong> Ta saisie est conservée. Rien n’a été envoyé en double.
        </p>
        {onRetry ? (
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={onRetry}>
              {retryLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }
  if (error.code === 'AUTH_REQUIRED_OR_INVALID_SIGNATURE') {
    return (
      <div ref={ref} tabIndex={-1} className="banner err" role="alert">
        <p>
          {error.message} <a href="/demo">Choisir une identité</a>. Ta saisie reste dans cet onglet.
        </p>
      </div>
    );
  }
  return (
    <div ref={ref} tabIndex={-1} className="error-summary" role="alert">
      <h2>{error.code === 'INVALID_FIELDS' ? 'À corriger' : 'Action impossible'}</h2>
      {error.fields.length ? (
        <ul>
          {error.fields.map((f) => (
            <li key={f.path + f.rule}>
              <a href={`#${FIELD_IDS[f.path.split('.')[0]!] ?? FIELD_IDS[f.path] ?? ''}`}>{FIELD_LABELS[f.path] ?? blockLabel(f.path) ?? FIELD_LABELS[f.path.split('.')[0]!] ?? f.path}</a> : {f.rule}
            </li>
          ))}
        </ul>
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  );
}
