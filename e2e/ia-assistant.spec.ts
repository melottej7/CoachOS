import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-4 (D-192) · « Demander » en simulation : sur l’Accueil au téléphone (390 px), une question d’exemple reçoit une
 * réponse courte ; une tâche proposée se crée d’un bouton ; depuis la palette ⌘K sur ordinateur (1440 px), la page
 * « Demander à l’IA » répond. Rien n’est envoyé. Photos si SHOTS est défini.
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

test('demander à l’IA : réponse courte, tâche proposée créée par le coach, palette', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/planning`);
  await coach.getByRole('button', { name: 'Qui n’a pas fait ses séances cette semaine ?' }).click();
  await expect(coach.getByText('IA simulée', { exact: true })).toBeVisible();
  await expect(coach.getByText(/séance.*(manquée|sans retour)|Personne n’a de séance manquée/).first()).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'assistant-accueil-390');
  await coach.getByLabel('Demander à l’IA').fill('Crée une tâche : appeler Noah pour son objectif');
  await coach.getByRole('button', { name: 'Demander', exact: true }).click();
  await expect(coach.getByText(/^Tâche proposée : crée-la/)).toBeVisible();
  await coach.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(coach.getByRole('button', { name: 'Tâche créée' })).toBeVisible();

  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/planning`);
  await desk.keyboard.press('ControlOrMeta+k');
  await desk.getByRole('combobox').fill('demander');
  await desk.keyboard.press('Enter');
  await desk.waitForURL(/\/assistant/);
  await desk.getByLabel('Demander à l’IA').fill('Résume la semaine dernière');
  await desk.getByRole('button', { name: 'Demander', exact: true }).click();
  await expect(desk.getByText('IA simulée', { exact: true })).toBeVisible();
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'assistant-1440');
});
