import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-2 (D-190) · « Ma méthode en quelques mots » : la proposition depuis la bibliothèque (simulation) s’affiche à relire,
 * le coach la reprend ou écrit lui-même, enregistre une nouvelle version, et la retrouve après rechargement.
 * Vu à 390 et 1440 px. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function as(browser: Browser, who: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('ma méthode en quelques mots : proposition à relire, version enregistrée', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/methode`);
  await expect(coach.getByRole('heading', { name: 'Ma méthode en quelques mots' })).toBeVisible();
  await coach.getByRole('button', { name: 'Proposer depuis ma bibliothèque' }).click();
  await expect(coach.getByText('IA simulée', { exact: true })).toBeVisible();
  const reprendre = coach.getByRole('button', { name: 'Reprendre dans le formulaire' });
  if (await reprendre.isVisible()) await reprendre.click();
  else await coach.getByRole('button', { name: 'Fermer' }).click();
  const jamais = coach.getByLabel('Ce que je ne fais jamais');
  const texte = `Pas de charge maximale ${Date.now().toString(36)}`;
  await jamais.fill(texte);
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'methode-390');
  await coach.getByRole('button', { name: 'Enregistrer une nouvelle version' }).click();
  await expect(coach.getByText(/^Version \d+$/).or(coach.getByText(/Coach DNA · version \d+/)).first()).toBeVisible();
  await coach.reload();
  await expect(coach.getByLabel('Ce que je ne fais jamais')).toHaveValue(texte);

  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/methode`);
  await expect(desk.getByLabel('Ce que je ne fais jamais')).toHaveValue(texte);
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'methode-1440');
});
