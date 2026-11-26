import { describe, expect, it } from 'vitest';
import { athleteFileHref, athleteFileTab } from './navigation';

describe('liens vers une section du dossier élève (D-183)', () => {
  it('ouvrent l’onglet qui contient la section', () => {
    expect(athleteFileHref('w', 'a', 'bilan')).toBe('/coach/w/athletes/a?onglet=bilan#bilan');
    expect(athleteFileHref('w', 'a', 'levels')).toBe('/coach/w/athletes/a?onglet=progression#levels');
    expect(athleteFileHref('w', 'a', 'refs-title')).toBe('/coach/w/athletes/a?onglet=progression#refs-title');
    expect(athleteFileHref('w', 'a', 'rdv')).toBe('/coach/w/athletes/a#rdv');
    expect(athleteFileHref('w', 'a')).toBe('/coach/w/athletes/a');
    expect(athleteFileTab('inv-title')).toBe('apercu');
  });
});
