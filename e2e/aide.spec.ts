import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-194 · Centre d’aide : le coach trouve comment faire par le menu de son compte, par ⌘K et par les liens « Aide »
 * des pages ; l’élève, par le point d’interrogation de l’en-tête. Chaque article mène à la bonne page.
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

test('coach : l’aide par la liste des élèves, la recherche, ⌘K ; « Y aller » mène à la page', async ({ browser }) => {
  const phone = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await phone.goto(`/coach/${WS_A}/athletes`);
  await phone.getByRole('link', { name: 'Aide', exact: true }).click();
  await expect(phone.getByRole('heading', { name: 'Ajouter et inviter tes élèves' })).toBeVisible();
  await phone.getByRole('link', { name: 'Toute l’aide' }).click();
  await expect(phone.getByRole('heading', { name: 'Aide', exact: true })).toBeVisible();
  // Recherche sans accent ni majuscule.
  await phone.getByRole('searchbox', { name: 'Rechercher dans l’aide' }).fill('ECRIRE seance');
  await expect(phone.getByRole('link', { name: /^Écrire une séance / }).first()).toBeVisible();
  await phone.getByRole('searchbox', { name: 'Rechercher dans l’aide' }).fill('inviter');
  await phone.getByRole('link', { name: /^Ajouter et inviter tes élèves/ }).click();
  expect(await overflow(phone)).toBe(0);
  await shot(phone, 'aide-article-390');
  await phone.getByRole('link', { name: 'Y aller : Ajouter un élève' }).click();
  await phone.waitForURL(new RegExp(`/coach/${WS_A}/athletes/new$`));

  // Ordinateur : ⌘K trouve l’article par sa question.
  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/aide`);
  await expect(desk.getByRole('region', { name: 'Séances' })).toBeVisible();
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'aide-1440');
  await desk.keyboard.press('ControlOrMeta+k');
  const palette = desk.getByRole('dialog', { name: 'Palette de commandes' });
  await palette.getByRole('combobox', { name: 'Rechercher' }).fill('pyramide');
  await expect(palette.getByRole('option', { name: /Changer la charge d’une série à l’autre/ })).toBeVisible();
  await desk.keyboard.press('Enter');
  await desk.waitForURL(/\/aide\/series-charges$/);
  await expect(desk.getByText('Varier d’une série à l’autre', { exact: false }).first()).toBeVisible();
});

test('élève : le point d’interrogation de l’en-tête, la recherche « silencieux »', async ({ browser }) => {
  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  await camille.goto(`/athlete/${WS_A}/today`);
  await camille.getByRole('link', { name: 'Aide', exact: true }).click();
  await expect(camille.getByRole('heading', { name: 'Aide', exact: true })).toBeVisible();
  await expect(camille.getByRole('link', { name: /^Ajouter et inviter/ })).toHaveCount(0); // l’aide du coach n’y est pas
  await camille.getByRole('searchbox', { name: 'Rechercher dans l’aide' }).fill('silencieux');
  await camille.getByRole('link', { name: /^Pas de bips ni de voix/ }).click();
  await expect(camille.getByText(/bouton silencieux sur le côté/)).toBeVisible();
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'aide-eleve-390');
});
