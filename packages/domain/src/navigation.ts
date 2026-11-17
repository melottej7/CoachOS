/**
 * Chemin local sûr pour une redirection après connexion (C02-09).
 * Refuse URL absolues, //domaine, \\ et caractères de contrôle ; sinon « / ».
 */
export function safeNext(value: string | null | undefined): string {
  if (!value || value.length > 512) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f\\]/.test(value)) return '/';
  return value;
}
