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

test('coach : retirer un élève en un toucher, « Annuler », puis le rétablir depuis la liste', async ({ browser }) => {
  const p = await as(browser, /Marine Roy/);
  await p.goto(`/coach/${WS_A}/athletes/new`);
  await p.getByLabel('Nom de l’élève').fill('Adri Essai');
  await p.getByRole('button', { name: 'Créer la fiche' }).click();
  await p.waitForURL(/\/athletes\/[0-9a-f-]{36}/);
  const dossier = new URL(p.url()).pathname;

  await p.getByRole('button', { name: 'Retirer Adri de ma liste' }).click();
  await expect(p.getByText('Adri Essai retiré·e de ta liste')).toBeVisible();
  await expect(p.getByRole('link', { name: /Adri Essai/ })).toHaveCount(0);
  await p.getByRole('button', { name: 'Annuler' }).click();
  await p.waitForURL((u) => u.pathname === dossier);
  await expect(p.getByRole('heading', { level: 1, name: 'Adri Essai' })).toBeVisible();

  await p.getByRole('button', { name: 'Retirer Adri de ma liste' }).click();
  await expect(p.getByText('Adri Essai retiré·e de ta liste')).toBeVisible();
  await p.goto(`/coach/${WS_A}/athletes`);
  await p.getByText('Élèves retirés (1)').click();
  await p.getByRole('list', { name: 'Élèves retirés' }).getByRole('button', { name: 'Rétablir' }).click();
  await p.waitForURL((u) => u.pathname === dossier);
  await expect(p.getByText('Invité·e, pas encore connecté·e').first()).toBeVisible();
});

test('coach : le nom de l’élève ouvre sa fiche, depuis la conversation, un retour et sa semaine', async ({ browser }) => {
  const p = await as(browser, /Marine Roy/);
  const fiche = new RegExp(`/coach/${WS_A}/athletes/20000000-0000-4000-8000-000000000001$`);
  await p.goto(`/coach/${WS_A}/messages/20000000-0000-4000-8000-000000000001`);
  await p.getByRole('link', { name: 'Ouvrir la fiche de Camille Laurent' }).click();
  await expect(p).toHaveURL(fiche);
  await p.goto(`/coach/${WS_A}/calendar?athlete=20000000-0000-4000-8000-000000000001`);
  await p.getByRole('heading', { level: 1 }).getByRole('link', { name: 'Camille' }).click();
  await expect(p).toHaveURL(fiche);
  await p.goto(`/coach/${WS_A}/review`);
  await p.getByRole('list', { name: 'Retours à traiter' }).getByRole('link').first().click();
  await p.getByRole('link', { name: 'Camille Laurent', exact: true }).first().click();
  await expect(p).toHaveURL(fiche);
});
