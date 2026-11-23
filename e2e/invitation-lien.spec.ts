import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-149 · Inviter un élève sans e-mail : le coach obtient un lien à copier, l’élève l’ouvre et rejoint l’espace.
 * Léa Moreau (élève de l’espace B) est invitée dans l’espace A avec son adresse ; une autre identité est refusée.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';

async function as(browser: Browser, name: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}

test('créer la fiche et le lien, le copier, l’élève l’ouvre et rejoint ; une autre adresse est refusée', async ({ browser }) => {
  const name = `Léa Lien ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await coach.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await coach.goto(`/coach/${WS_A}/athletes/new`);
  await coach.locator('#displayName').fill(name);
  await coach.locator('#email').fill('lea.moreau@demo.coachos.test');
  // « Je l’envoie moi-même » est le choix proposé d’office.
  await expect(coach.getByRole('radio', { name: /Je l’envoie moi-même/ })).toBeChecked();
  await coach.getByRole('button', { name: 'Créer la fiche et le lien' }).click();
  const field = coach.locator('#invite-link');
  await expect(field).toBeVisible();
  const link = await field.inputValue();
  expect(link).toMatch(/\/invite#token=[A-Za-z0-9_-]{40,}$/);
  await coach.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(coach.getByRole('button', { name: /Lien copié/ })).toBeVisible();
  expect(await coach.evaluate(() => navigator.clipboard.readText())).toBe(link);

  // Une autre identité (Camille, autre adresse) ne peut pas utiliser ce lien.
  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  await camille.goto(link);
  await camille.getByRole('button', { name: 'Rejoindre l’espace' }).click();
  await expect(camille.getByText(/Ce lien n’est pas destiné au compte/)).toBeVisible();

  // Léa ouvre le lien sur son téléphone et rejoint l’espace : elle arrive sur son bilan.
  const lea = await as(browser, 'Léa Moreau', { width: 390, height: 844 });
  await lea.goto(link);
  await lea.getByRole('button', { name: 'Rejoindre l’espace' }).click();
  await lea.waitForURL(new RegExp(`/athlete/${WS_A}/setup\\?first=1`));

  // Côté coach, la fiche n’est plus « invitée ».
  await coach.goto(`/coach/${WS_A}/athletes`);
  await expect(coach.getByText(name).first()).toBeVisible();
});
