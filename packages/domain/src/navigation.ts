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

// ---------- D-183 · Liens vers une section du dossier élève ----------

export type AthleteFileTab = 'apercu' | 'progression' | 'bilan' | 'notes' | 'donnees';
/** Le dossier élève est en onglets (D-151) : chaque section vit dans un onglet ; hors de cette liste, la vue d’ensemble. */
const SECTION_TABS: Record<string, Exclude<AthleteFileTab, 'apercu'>> = {
  suivi: 'progression', charges: 'progression', levels: 'progression', goals: 'progression', faisabilite: 'progression',
  refs: 'progression', resultats: 'progression', bilan: 'bilan', notes: 'notes', donnees: 'donnees',
};
/** Onglet qui contient une section (« refs-title » : la section « refs »). */
export function athleteFileTab(section: string): AthleteFileTab {
  return SECTION_TABS[section.replace(/-title$/, '')] ?? 'apercu';
}
/** Lien vers le dossier d’un élève, ouvert sur l’onglet de la section visée : « …/athletes/x?onglet=bilan#bilan ». */
export function athleteFileHref(wid: string, aid: string, section?: string): string {
  const base = `/coach/${wid}/athletes/${aid}`;
  if (!section) return base;
  const tab = athleteFileTab(section);
  return `${base}${tab === 'apercu' ? '' : `?onglet=${tab}`}#${section}`;
}
