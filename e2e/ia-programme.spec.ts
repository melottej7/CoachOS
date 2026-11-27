import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-3 (D-191) · « Programme avec l’IA » en simulation : pour Camille au téléphone (390 px), le coach écrit sa demande,
 * relit le programme semaine par semaine, corrige une séance et enregistre en brouillon (rien publié) ; pour un groupe
 * sur ordinateur (1440 px), le brouillon s’affiche avec ce que l’IA a lu. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
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

test('programme avec l’IA : relu, corrigé, enregistré en brouillon', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}`);
  await coach.getByRole('link', { name: 'Programme avec l’IA' }).click();
  await coach.waitForURL(/programme-ia/);
  await coach.getByLabel(/Ta demande pour Camille/).fill('Force en salle, 3 séances par semaine');
  await coach.getByLabel('Semaines').fill('2');
  await coach.getByRole('button', { name: 'Préparer le programme' }).click();
  await expect(coach.getByText('IA simulée', { exact: true })).toBeVisible();
  await expect(coach.getByText(/^Semaine 1 ·/)).toBeVisible();
  await expect(coach.getByText(/^L’IA a lu : la bibliothèque et les machines, les charges réalisées\.$/)).toBeVisible();
  const first = coach.locator('textarea[id^="aip-1-0"]');
  await first.fill(`${await first.inputValue()} + 3×45" gainage`);
  await expect(coach.getByText(/Gainage · 45 s/).first()).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'programme-ia-390');
  await coach.getByRole('button', { name: /Enregistrer en brouillon \(6 séances\)/ }).click();
  await expect(coach.getByText('6 séances enregistrées en brouillon')).toBeVisible();
  await expect(coach.getByText('Rien n’est publié.')).toBeVisible();

  // Groupe, sur ordinateur : le coach crée un groupe avec Camille (API), puis prépare son programme.
  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/group-sessions`);
  const tid = await desk.evaluate(async ({ wid, aid }) => {
    const h = () => ({ 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() });
    const t = await (await fetch(`/api/v1/workspaces/${wid}/teams`, { method: 'POST', headers: h(), body: JSON.stringify({ name: `IA ${Date.now().toString(36)}` }) })).json() as { id: string };
    await fetch(`/api/v1/workspaces/${wid}/teams/${t.id}/athletes/${aid}`, { method: 'PUT', headers: h(), body: '{}' });
    return t.id;
  }, { wid: WS_A, aid: CAMILLE });
  await desk.goto(`/coach/${WS_A}/groups/${tid}/week`);
  await desk.getByRole('link', { name: 'Programme avec l’IA' }).click();
  await desk.getByLabel(/Ta demande pour le groupe/).fill('Endurance, 2 séances par semaine');
  await desk.getByLabel('Semaines').fill('1');
  await desk.getByRole('button', { name: 'Préparer le programme' }).click();
  await expect(desk.getByText(/^Semaine 1 ·/)).toBeVisible();
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'programme-ia-groupe-1440');
  await desk.getByRole('button', { name: /Enregistrer en brouillon \(2 séances\)/ }).click();
  await expect(desk.getByText('2 séances enregistrées en brouillon')).toBeVisible();
});
