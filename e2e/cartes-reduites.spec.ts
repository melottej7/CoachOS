import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-185 · Retour du fondateur : un exercice écrit doit pouvoir se réduire, pour se concentrer sur la suite. Sur téléphone :
 * ajouter un exercice replie ceux déjà écrits (une ligne, leur résumé) ; un toucher les rouvre ; « Tout réduire » et
 * « Tout déplier » ; une carte réduite garde sa poignée, sa copie et sa suppression.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function as(browser: Browser, who: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('un exercice écrit se réduit à une ligne, et se rouvre d’un toucher', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy');
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new`);
  await coach.locator('#sport').selectOption('strength');
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  await coach.getByRole('group', { name: 'Bloc 1' }).getByLabel('Exercice').fill('Squat goblet');

  // Ajouter un exercice replie le premier : une ligne, son résumé ; le nouveau est ouvert.
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  const one = coach.getByRole('group', { name: 'Bloc 1' });
  const two = coach.getByRole('group', { name: 'Bloc 2' });
  await expect(one.getByRole('button', { name: 'Déplier le bloc 1' })).toBeVisible();
  await expect(one.getByRole('button', { name: /^Squat goblet 3 séries · 10 répétitions · repos 1 min 30 s$/ })).toBeVisible();
  await expect(one.getByLabel('Exercice')).toHaveCount(0);
  await expect(two.getByLabel('Exercice')).toBeVisible();
  await two.getByLabel('Exercice').fill('Pompes');
  expect(await overflow(coach)).toBe(0);
  if (process.env.SHOTS) await one.screenshot({ path: `${process.env.SHOTS}/carte-reduite-390.png` });

  // Toucher le résumé rouvre la carte ; « Tout réduire », puis « Tout déplier ».
  await one.getByRole('button', { name: /Squat goblet/ }).click();
  await expect(one.getByLabel('Exercice')).toHaveValue('Squat goblet');
  await coach.getByRole('button', { name: 'Tout réduire' }).click();
  await expect(coach.getByRole('button', { name: /^Déplier le bloc/ })).toHaveCount(2);
  await expect(coach.getByText('2 blocs · 2 réduits')).toBeVisible();
  // Une carte réduite se copie encore : la copie s’ouvre, prête à modifier.
  await two.getByRole('button', { name: 'Dupliquer le bloc 2' }).click();
  await expect(coach.getByRole('group', { name: 'Bloc 3' }).getByLabel('Exercice')).toHaveValue('Pompes');
  await coach.getByRole('button', { name: 'Tout réduire' }).click();
  await coach.getByRole('button', { name: 'Tout déplier' }).click();
  await expect(coach.getByRole('button', { name: /^Réduire le bloc/ })).toHaveCount(3);
});
