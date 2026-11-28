import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-FLU · Répondre, c’est traiter : depuis un retour à traiter, la réponse rapide part ET le retour quitte la file.
 * L’élève lit la réponse dans Échanges. Coach à 1440 px, élève à 390 px.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const todayBrussels = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
async function as(browser: Browser, name: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}

test('répondre à un retour le marque traité ; l’élève lit la réponse', async ({ browser }) => {
  const title = `Côtes e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('running');
  await coach.locator('#duration').fill('30');
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/feedback`);
  await camille.locator('#state-completed').check();
  await camille.locator('#comment').fill('Les côtes piquent, mais ça passe.');
  await camille.getByRole('button', { name: 'Envoyer le retour' }).click();
  await camille.waitForURL(/notice=sent/);

  await coach.goto(`/coach/${WS_A}/review`);
  const row = coach.getByRole('list', { name: 'Retours à traiter' }).getByRole('link').filter({ hasText: title });
  await row.click();
  await expect(coach.getByText('Les côtes piquent, mais ça passe.')).toBeVisible();
  await expect(coach.getByText(/le message part quand tu cliques, et le retour est marqué traité/)).toBeVisible();
  await coach.getByRole('button', { name: 'Bien joué, continue comme ça.' }).click();
  await expect(coach.getByText(/^Réponse envoyée, (retour traité|retour précédent traité · voici le suivant)$/)).toBeVisible();
  await coach.goto(`/coach/${WS_A}/review`);
  await expect(coach.getByRole('link').filter({ hasText: title })).toHaveCount(0);

  await camille.goto(`/athlete/${WS_A}/messages`);
  await expect(camille.getByText('Bien joué, continue comme ça.').last()).toBeVisible();
});
