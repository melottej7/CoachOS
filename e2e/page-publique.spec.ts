import { expect, test, type Page } from '@playwright/test';

/**
 * D-174 · Page publique, offres et pages légales : un visiteur découvre CoachOS, voit les offres sans prix publié
 * (interrupteur commercial éteint) et lit les conditions ; une personne connectée va droit à son espace.
 */

const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`visiteur à ${viewport.width} px : présentation, offres, conditions, mentions`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, locale: 'fr-BE' });
    const p = await context.newPage();

    await p.goto('/');
    await expect(p.getByRole('heading', { level: 1 })).toHaveText('Tes élèves trouvent leur séance. Tu lis leurs retours.');
    await expect(p.getByRole('link', { name: 'Créer un compte coach' }).first()).toHaveAttribute('href', '/signup');
    await expect(p.getByText('Gratuit pendant la phase pilote, sans carte bancaire.', { exact: false })).toBeVisible();
    expect(await overflow(p)).toBeLessThanOrEqual(0);

    await p.getByRole('link', { name: 'Voir les offres' }).click();
    await expect(p).toHaveURL(/\/offres$/);
    for (const name of ['Starter', 'Pro', 'Elite']) await expect(p.getByRole('heading', { level: 2, name })).toBeVisible();
    await expect(p.getByText('Jusqu’à 20 élèves actifs')).toBeVisible();
    // Interrupteur éteint : aucun prix publié (D-120, le prix final appartient au fondateur).
    await expect(p.getByText('29 €')).toHaveCount(0);
    await expect(p.getByText('pendant la phase pilote').first()).toBeVisible();
    expect(await overflow(p)).toBeLessThanOrEqual(0);

    await p.getByRole('contentinfo').getByRole('link', { name: 'Conditions d’utilisation' }).click();
    await expect(p.getByRole('heading', { level: 1, name: 'Conditions d’utilisation' })).toBeVisible();
    await expect(p.getByRole('heading', { name: 'Prix et abonnement' })).toBeVisible();
    await expect(p.getByText('Pendant la phase pilote, CoachOS est gratuit.', { exact: false })).toBeVisible();

    await p.getByRole('contentinfo').getByRole('link', { name: 'Mentions légales' }).click();
    await expect(p.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeVisible();
    await expect(p.getByText('Supabase Inc.', { exact: false })).toBeVisible();
    expect(await overflow(p)).toBeLessThanOrEqual(0);
    await context.close();
  });
}

test('connecté, « / » mène à son espace et non à la présentation', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: /Camille Laurent/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Tes élèves trouvent leur séance. Tu lis leurs retours.' })).toHaveCount(0);
});
