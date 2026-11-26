import { expect, test } from '@playwright/test';

/**
 * D-180 · Tirer vers le bas pour actualiser, dans l’app installée (forcé ici par `coachos-pull`, l’affichage autonome
 * ne s’émule pas). Un geste court ne fait rien ; un geste long relit les données du serveur sans recharger la page.
 */
const WS_A = '10000000-0000-4000-8000-00000000000a';

test('élève, téléphone : tirer vers le bas actualise la page sans la recharger', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: /Camille Laurent/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  await page.evaluate(() => sessionStorage.setItem('coachos-pull', '1'));
  await page.goto(`/athlete/${WS_A}/today`);
  await page.evaluate(() => { (window as unknown as { marque: number }).marque = 1; });
  const cdp = await context.newCDPSession(page);
  const pull = async (to: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 150 }] });
    for (let y = 150; y <= to; y += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const refreshes: string[] = [];
  page.on('request', (r) => { if (r.headers()['rsc'] === '1') refreshes.push(r.url()); });

  await pull(230); // 80 px : trop court
  await page.waitForTimeout(500);
  expect(refreshes).toHaveLength(0);

  await pull(350); // 200 px : actualise
  await expect(page.getByRole('status').filter({ hasText: 'Actualisation…' })).toBeAttached();
  await expect.poll(() => refreshes.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { marque?: number }).marque)).toBe(1); // même page, pas de rechargement
  await context.close();
});
