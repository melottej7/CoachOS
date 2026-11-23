import type { CoachGoal, Level, SpokenLanguage, Sport } from '@coachos/domain';

/** Données publiques d’un espace (sérialisables, utilisables côté serveur et client). */
export interface CoachCardData {
  id: string;
  name: string;
  coachName: string | null;
  logoVersion: string | null;
  profile: {
    tagline: string | null; bio: string | null; approach: string | null; experienceYears: number | null; certifications: string[];
    sports: Sport[]; audiences: Level[]; goals: CoachGoal[]; city: string | null; languages: SpokenLanguage[];
    websiteUrl: string | null; socialUrl: string | null; contactEmail: string | null;
  } | null;
}

export function logoUrl(d: Pick<CoachCardData, 'id' | 'logoVersion'>): string | null {
  return d.logoVersion ? `/media/workspaces/${d.id}/logo?v=${d.logoVersion}` : null;
}
