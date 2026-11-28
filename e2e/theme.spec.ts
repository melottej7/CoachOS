import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-198 · L’interrupteur clair ou sombre, à portée de main : dans le menu du compte du coach (ordinateur),
 * dans l’en-tête de l’élève (téléphone). Le choix tient après un rechargement.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const theme = (p: Page) => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function as(browser: Browser, who: string, viewport: { width: number; height: number }, colorScheme: 'light' | 'dark'): Promise<Page> {
  const context = await browser.newContext({ viewport, colorScheme, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('coach : « Mode sombre » dans le menu du compte, gardé après un rechargement', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 1440, height: 900 }, 'light');
  await coach.goto(`/coach/${WS_A}/planning`);
  const menu = coach.getByLabel(/^Menu du compte/).first();
  await menu.click();
  const sw = coach.getByRole('switch', { name: 'Mode sombre' }).first();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(await theme(coach)).toBe('dark');
  await coach.reload();
  expect(await theme(coach)).toBe('dark');
  await coach.getByLabel(/^Menu du compte/).first().click();
  await coach.getByRole('switch', { name: 'Mode sombre' }).first().click();
  expect(await theme(coach)).toBe('light');
});

test('élève : la lune de l’en-tête passe en sombre, le soleil revient en clair', async ({ browser }) => {
  // Téléphone déjà en sombre (réglage du système) : l’interrupteur part allumé.
  const athlete = await as(browser, 'Camille Laurent', { width: 390, height: 844 }, 'dark');
  await athlete.goto(`/athlete/${WS_A}/today`);
  const sw = athlete.getByRole('switch', { name: 'Mode sombre' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await theme(athlete)).toBe('light');
  expect(await overflow(athlete)).toBe(0);
  await athlete.reload();
  expect(await theme(athlete)).toBe('light');
  await athlete.getByRole('switch', { name: 'Mode sombre' }).click();
  expect(await theme(athlete)).toBe('dark');
});
