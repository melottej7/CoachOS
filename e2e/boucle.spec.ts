import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-125 · Boucle coach → élève → coach dans un vrai navigateur, avec les droits (coach B, élève tiers).
 * Coach à 1440 px, élèves à 390 px. Données fictives d’un serveur isolé (playwright.config.ts).
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

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

test('créer, publier, lire sur téléphone, envoyer un retour, traiter ; droits respectés', async ({ browser }) => {
  const title = `Fartlek e2e ${Date.now().toString(36)}`;

  // 1. Le coach crée un brouillon pour Camille.
  const coach = await as(browser, 'Marine Roy', DESKTOP);
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('running');
  await coach.locator('#duration').fill('30');
  await coach.locator('#instructions').fill('Accélérations libres sur terrain vallonné.');
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await expect(coach.getByRole('heading', { name: title })).toBeVisible();

  // 2. Le brouillon est invisible pour l’élève.
  const camille = await as(browser, 'Camille Laurent', PHONE);
  await camille.goto(`/athlete/${WS_A}/schedule`);
  await expect(camille.getByText(title)).toHaveCount(0);
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(camille.getByRole('heading', { name: 'Page indisponible' })).toBeVisible();

  // 3. Le coach publie.
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  // 4. L’élève lit sa séance sur téléphone, puis envoie son retour.
  await camille.goto(`/athlete/${WS_A}/schedule`);
  await expect(camille.getByText(title).first()).toBeVisible();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(camille.getByRole('heading', { name: title })).toBeVisible();
  await expect(camille.getByText('Accélérations libres sur terrain vallonné.')).toBeVisible();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/feedback`);
  await camille.locator('#state-completed').check();
  await camille.locator('#comment').fill('Bonnes sensations, test de bout en bout.');
  await camille.getByRole('button', { name: 'Envoyer le retour' }).click();
  await camille.waitForURL(/notice=sent/);

  // 5. Le coach traite le retour depuis la file.
  await coach.goto(`/coach/${WS_A}/review`);
  const row = coach.getByRole('region', { name: 'Retours à traiter' }).locator('.row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('link', { name: 'Ouvrir le retour' }).click();
  await expect(coach.getByText('Bonnes sensations, test de bout en bout.')).toBeVisible();
  await coach.getByRole('button', { name: 'Marquer comme traité' }).click();
  await expect(coach.getByText(/Traité le/)).toBeVisible();

  // 6. Droits : le coach d’un autre espace et les élèves tiers ne voient rien.
  const hugo = await as(browser, 'Hugo Petit', DESKTOP);
  await hugo.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/${sid}`);
  await expect(hugo.getByRole('heading', { name: 'Page indisponible' })).toBeVisible();
  const lea = await as(browser, 'Léa Moreau', PHONE);
  await lea.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(lea.getByRole('heading', { name: 'Page indisponible' })).toBeVisible();
  const noah = await as(browser, 'Noah Dubois', PHONE);
  await noah.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(noah.getByRole('heading', { name: 'Page indisponible' })).toBeVisible();
});
