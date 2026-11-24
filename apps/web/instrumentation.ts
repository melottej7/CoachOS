import type { Instrumentation } from 'next';
import { reportError } from '@/server/error-report';

/**
 * D-168 · Erreurs serveur non rattrapées (pages, actions, routes) : envoyées au suivi si `SENTRY_DSN` est réglé.
 * La référence (digest) est celle que l’utilisateur voit sur « Un problème est survenu ». Ni adresse réelle,
 * ni en-têtes : seulement le gabarit de route.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? String((error as { digest: unknown }).digest) : undefined;
  await reportError(error, { module: 'page', code: 'UNEXPECTED', digest, route: context.routePath, kind: context.routeType });
};
