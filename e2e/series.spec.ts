import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-165 · Exercice en séries dans un vrai navigateur (exemple du fondateur : 6 × 20 s de planche, 40 s de récupération).
 * Le coach remplit une seule carte (séries, durée par série, récupération), enregistre et publie ; l’élève suit sur
 * téléphone et les séries s’enchaînent comme une minuterie (horloge simulée : pas d’attente réelle). Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

function todayBrussels(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function as(browser: Browser, who: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('une carte d’exercice : 6 séries de 20 s, 40 s de récupération ; l’élève les enchaîne comme une minuterie', async ({ browser }) => {
  const title = `Gainage e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', DESKTOP);
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');

  // « Exercice » : une carte, 3 séries de 10 d’office.
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  const card = coach.getByRole('group', { name: 'Bloc 1' });
  await expect(card.getByText('3 séries', { exact: true })).toBeVisible();
  await card.getByLabel('Exercice').fill('Planche');
  await card.getByRole('spinbutton', { name: 'Séries', exact: true }).fill('6');
  await card.getByRole('radio', { name: 'Durée' }).check();
  await card.getByLabel('Minutes', { exact: true }).fill('0');
  await card.getByLabel('Secondes', { exact: true }).fill('20');
  await card.getByLabel('Minutes de récupération').fill('0');
  await card.getByLabel('Secondes de récupération').fill('40');
  await expect(card.getByText('6 séries', { exact: true })).toBeVisible();
  await expect(coach.getByRole('listitem').filter({ hasText: /^6 × \(Planche · 20 s \/ repos 40 s\)$/ })).toBeVisible();
  await expect(coach.getByText(/Total : 6 min/)).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await card.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/series-carte-1440.png` : undefined });

  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await expect(coach.getByText(/6\s*séries · 20\s*s · repos 40\s*s/)).toBeVisible();
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  // Rouvrir : la carte retrouve 6 séries et 40 s.
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/${sid}/edit`);
  const again = coach.getByRole('group', { name: 'Bloc 1' });
  await expect(again.getByRole('spinbutton', { name: 'Séries', exact: true })).toHaveValue('6');
  await expect(again.getByLabel('Secondes de récupération')).toHaveValue('40');

  // L’élève, téléphone, horloge simulée.
  const camille = await as(browser, 'Camille Laurent', PHONE);
  await camille.clock.install();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  await expect(camille.getByText('Série 1 sur 6')).toBeVisible();
  await expect(camille.getByRole('heading', { name: 'Planche' })).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText('0:20');
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'series-suivre-390');
  await camille.getByRole('button', { name: 'Démarrer le chrono' }).click();
  await camille.clock.fastForward(21_000);
  // Fin de l’effort : la récupération part seule.
  await expect(camille.getByText('Récupère')).toBeVisible();
  await expect(camille.getByRole('button', { name: '+15 s' })).toBeVisible();
  await camille.clock.fastForward(41_000);
  // Fin de la récupération : la série 2 part seule.
  await expect(camille.getByText('Série 2 sur 6')).toBeVisible();
  await expect(camille.getByRole('button', { name: '+15 s' })).toBeVisible();
});
