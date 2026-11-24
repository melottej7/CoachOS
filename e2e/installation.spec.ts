import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-171 · Installer CoachOS sur l’écran d’accueil : l’élève voit les étapes de son appareil (iPhone Safari, Android Chrome,
 * ordinateur), la visite guidée l’y mène, « Plus tard » range la carte trois jours, « C’est fait » pour de bon ; la page d’invitation
 * annonce les trois étapes. Données fictives d’un serveur isolé (playwright.config.ts).
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const PHONE = { width: 390, height: 844 };
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

async function camille(browser: Browser, viewport: { width: number; height: number }, userAgent?: string): Promise<Page> {
  const context = await browser.newContext({ viewport, userAgent, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: /Camille Laurent/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const guide = (p: Page) => p.getByRole('region', { name: 'Installe CoachOS sur ton téléphone' });

test('iPhone : la visite mène au guide Safari ; « Plus tard » la range trois jours, « C’est fait » pour de bon', async ({ browser }) => {
  const p = await camille(browser, PHONE, UA.iphone);
  await p.goto(`/athlete/${WS_A}/today?tour=start`);
  const tour = p.getByRole('dialog', { name: 'Visite guidée CoachOS' });
  await expect(tour).toContainText('Je suis ton guide');
  await tour.getByRole('button', { name: 'Suivant' }).click();
  await expect(tour).toContainText('installe CoachOS sur ton téléphone');
  // Échap ferme la visite (le bouton des outils de développement de Next recouvre « Passer » en bas à gauche).
  await p.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);

  await expect(guide(p)).toBeVisible();
  await expect(p.getByLabel('Étapes pour')).toHaveValue('ios-safari');
  const steps = p.getByRole('list', { name: 'Étapes · iPhone ou iPad, avec Safari' });
  await expect(steps.getByRole('listitem')).toHaveCount(4);
  await expect(steps).toContainText('Sur l’écran d’accueil');
  await expect(steps.getByRole('img', { name: 'Partager' })).toBeVisible();
  expect(await overflow(p)).toBe(0);

  // Pas le bon appareil : on choisit un autre guide.
  await p.getByLabel('Étapes pour').selectOption('in-app');
  await expect(p.getByRole('list', { name: /WhatsApp/ })).toContainText('Ouvrir dans Safari');
  await expect(guide(p).getByRole('button', { name: 'Copier l’adresse' })).toBeVisible();

  await guide(p).getByRole('button', { name: 'Plus tard' }).click();
  await expect(guide(p)).toHaveCount(0);
  await p.reload();
  await expect(p.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expect(guide(p)).toHaveCount(0);

  // Trois jours plus tard, la carte revient (le Profil la garde aussi, une fois le bilan rempli).
  await p.evaluate(() => localStorage.setItem('coachos_install:later', String(Date.now() - 4 * 24 * 3600 * 1000)));
  await p.reload();
  await expect(guide(p)).toBeVisible();
  await guide(p).getByRole('button', { name: 'C’est fait' }).click();
  await p.reload();
  await expect(p.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expect(guide(p)).toHaveCount(0);
});

test('Android : étapes de Chrome ; ordinateur : l’adresse à ouvrir sur le téléphone ; invitation : les trois étapes', async ({ browser }) => {
  const android = await camille(browser, PHONE, UA.android);
  await android.goto(`/athlete/${WS_A}/today`);
  await expect(android.getByLabel('Étapes pour')).toHaveValue('android');
  await expect(android.getByRole('list', { name: 'Étapes · Android, avec Chrome' })).toContainText('Installer l’application');
  await android.context().close();

  const desk = await camille(browser, { width: 1440, height: 900 });
  await desk.goto(`/athlete/${WS_A}/today`);
  await expect(desk.getByLabel('Étapes pour')).toHaveValue('desktop');
  await expect(guide(desk).locator('code')).toHaveText(/\/login$/);
  await desk.context().close();

  const ctx = await browser.newContext({ viewport: PHONE, locale: 'fr-BE' });
  const invite = await ctx.newPage();
  await invite.goto('/invite');
  const how = invite.getByRole('region', { name: 'Comment ça se passe' });
  await expect(how.getByRole('listitem')).toHaveCount(3);
  await expect(how).toContainText('Installe CoachOS sur ton téléphone');
  expect(await overflow(invite)).toBe(0);
});
