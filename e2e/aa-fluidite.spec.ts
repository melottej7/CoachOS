import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Bilan produit (branche fluidite) · les gestes de tous les jours, sur téléphone (390 px), données fictives.
 * Nommé « aa- » pour passer en premier : il part de la base fictive neuve (retour du jour de Camille pas encore envoyé).
 */
const WS_A = '10000000-0000-4000-8000-00000000000a';
const PHONE = { width: 390, height: 844 };

async function as(browser: Browser, name: RegExp): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}

test('élève : la séance du jour et « Faite » sur le premier écran, sans défiler', async ({ browser }) => {
  const p = await as(browser, /Camille Laurent/);
  await p.goto(`/athlete/${WS_A}/today`);
  const faite = p.getByRole('button', { name: 'Faite', exact: true });
  await expect(faite).toBeVisible();
  const box = await faite.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(PHONE.height - 80); // au-dessus de la barre basse
  // Le bilan et l’installation restent proposés, plus bas.
  await expect(p.getByText('Ton bilan')).toBeAttached();
});

test('coach : traiter d’un geste les retours sans signal, puis annuler', async ({ browser }) => {
  // L’élève dit « Faite, Facile » en deux touchers depuis Aujourd’hui : un retour sans signal arrive chez le coach.
  const c = await as(browser, /Camille Laurent/);
  await c.goto(`/athlete/${WS_A}/today`);
  await c.getByRole('button', { name: 'Faite', exact: true }).click();
  await c.getByRole('button', { name: 'Facile', exact: true }).click();
  await expect(c.getByText('Retour envoyé')).toBeVisible();

  const p = await as(browser, /Marine Roy/);
  await p.goto(`/coach/${WS_A}/review`);
  const queue = p.getByRole('list', { name: 'Retours à traiter' });
  const before = await queue.getByRole('listitem').count();
  await expect(p.getByText(/retours? sans signal/)).toBeVisible();
  await p.getByRole('button', { name: 'Tout marquer traité' }).click();
  await expect(p.getByText(/marqués? comme traités?/)).toBeVisible();
  await expect.poll(async () => (await queue.count()) ? queue.getByRole('listitem').count() : 0).toBeLessThan(before);
  // Le retour avec commentaire reste à lire.
  await expect(queue.getByText('avec commentaire')).toBeVisible();

  await p.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(() => queue.getByRole('listitem').count()).toBe(before);
  await expect(p.getByText(/retours? sans signal/)).toBeVisible();
});
