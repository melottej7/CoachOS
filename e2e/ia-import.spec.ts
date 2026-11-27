import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-5 (D-193) · En simulation : au téléphone (390 px), une photo envoyée depuis l’import de programme remplit le texte et
 * l’aperçu habituel prend la suite ; sur ordinateur (1440 px), « Proposer les consignes » d’un nouvel exercice donne un
 * texte « À relire » que le coach reprend dans le champ. Photos si SHOTS est défini.
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
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('photo d’un programme, puis consignes d’un exercice', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/library/import?mode=programme`);
  await expect(coach.getByRole('button', { name: 'Depuis une photo ou un PDF' })).toBeVisible();
  await coach.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({ name: 'programme.png', mimeType: 'image/png', buffer: PNG });
  await expect(coach.getByText(/IA simulée : relis le texte et l’aperçu/)).toBeVisible();
  await expect(coach.locator('#pimp-text')).toHaveValue(/^S1\nLun · Footing 40' Z2/);
  await expect(coach.getByRole('heading', { name: 'Aperçu' })).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'import-photo-390');
  // Un fichier qui n’est ni une photo ni un PDF est refusé clairement.
  await coach.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('S1 Footing') });
  await expect(coach.getByText('Photo (JPEG, PNG, WebP) ou PDF seulement')).toBeVisible();

  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/exercises`);
  await desk.getByRole('button', { name: 'Nouvel exercice' }).click();
  const form = desk.getByRole('form', { name: 'Nouvel exercice' });
  await form.getByLabel('Nom').fill(`Squat sauté ${Date.now().toString(36)}`);
  await form.getByRole('button', { name: 'Proposer les consignes' }).click();
  await expect(form.getByText('À relire').first()).toBeVisible();
  await form.getByRole('button', { name: 'Reprendre dans les consignes' }).click();
  await expect(form.getByLabel('Consignes')).toHaveValue(/^• /);
  await expect(form.getByText('À relire')).toBeVisible();
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'consignes-1440');
});
