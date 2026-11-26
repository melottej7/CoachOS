import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-0 · Paramètres › IA en simulation (aucune clé) : consommation du mois, modèle utilisé, interrupteur de l’espace.
 * Le propriétaire éteint puis rallume l’IA ; le réglage tient après rechargement ; un élève ne peut pas le changer.
 * Vu à 1440 et 390 px, sans défilement horizontal. Photos si SHOTS est défini.
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

test('Paramètres › IA : modèle, consommation et interrupteur de l’espace, en simulation', async ({ browser }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const coach = await as(browser, 'Marine Roy', viewport);
    await coach.goto(`/coach/${WS_A}/settings?onglet=ia`);
    await expect(coach.getByText('IA simulée, aucun coût')).toBeVisible();
    await expect(coach.getByText(/Modèle · aucun \(IA simulée/)).toBeVisible();
    await expect(coach.getByText(/coût réel/)).toBeVisible();
    const box = coach.getByLabel('IA activée pour cet espace');
    await expect(box).toBeChecked();
    expect(await overflow(coach)).toBeLessThanOrEqual(0);
    await shot(coach, `ia-parametres-${viewport.width}`);

    // Éteindre : le réglage est enregistré et tient après rechargement.
    await box.click();
    await expect(coach.getByRole('status')).toHaveText(/IA éteinte · enregistré/);
    await coach.reload();
    await expect(coach.getByLabel('IA activée pour cet espace')).not.toBeChecked();
    await expect(coach.getByText('IA éteinte', { exact: true })).toBeVisible();
    if (viewport.width === 390) await shot(coach, 'ia-eteinte-390');
    // Rallumer.
    await coach.getByLabel('IA activée pour cet espace').click();
    await expect(coach.getByRole('status')).toHaveText(/IA allumée · enregistré/);
    await coach.reload();
    await expect(coach.getByLabel('IA activée pour cet espace')).toBeChecked();
    await coach.context().close();
  }

  // Un élève de l’espace ne peut pas changer le réglage (refus serveur).
  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  const status = await camille.evaluate(async (wid) => (await fetch(`/api/v1/workspaces/${wid}/ai-settings`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ enabled: false }),
  })).status, WS_A);
  expect(status).toBe(404);
  await camille.goto('/confidentialite');
  await expect(camille.getByText(/sous-traitant pour l’assistant IA/)).toBeVisible();
  expect(await overflow(camille)).toBeLessThanOrEqual(0);
  await shot(camille, 'confidentialite-eleve-390');
});
