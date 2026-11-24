import { expect, test, type Page } from '@playwright/test';

/**
 * D-158 · Gestes du calendrier dans un vrai navigateur : glisser pour déplacer puis « Annuler », copier par le menu et
 * coller un autre jour puis « Annuler », retirer un brouillon puis ⌘Z / Ctrl+Z, copier-coller au clavier, déplacer une
 * séance publiée (à republier). Les séances du test sont créées trois semaines plus loin : rien ne dépend du jour du lancement.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const ORIGIN = 'http://localhost:3100';

/** Lundi de la semaine dans trois semaines, en date locale (AAAA-MM-JJ). */
function mondayIn3Weeks(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 21);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const plus = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOf = (p: Page, title: string) => p.locator('[data-day]').filter({ has: p.locator('[data-workout]', { hasText: title }) }).first().getAttribute('data-day');

async function create(p: Page, title: string, localDate: string): Promise<string> {
  const r = await p.request.post(`/api/v1/workspaces/${WS_A}/athletes/${CAMILLE}/workouts`, {
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), origin: ORIGIN },
    data: { data: { localDate, timeZone: 'Europe/Brussels', sortOrder: 0, sport: 'running', title, instructions: null, durationSeconds: 1800, distanceM: null, intervals: [] } },
  });
  expect(r.status(), await r.text()).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

test('glisser, annuler, copier-coller, retirer, raccourcis ; une séance publiée déplacée attend la republication', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: /Marine Roy/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));

  const monday = mondayIn3Weeks();
  const suffix = Date.now().toString(36);
  const draft = `Brouillon geste ${suffix}`;
  const pub = `Publiée geste ${suffix}`;
  await create(p, draft, plus(monday, 1));
  const pubId = await create(p, pub, plus(monday, 3));
  const r = await p.request.post(`/api/v1/workspaces/${WS_A}/athletes/${CAMILLE}/publications`, {
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), origin: ORIGIN },
    data: { changes: [{ id: pubId, revision: 1 }] },
  });
  expect(r.status(), await r.text()).toBeLessThan(300);

  await p.goto(`/coach/${WS_A}/calendar?athlete=${CAMILLE}&week=${monday}`);
  await p.waitForLoadState('networkidle');

  // Glisser le brouillon du mardi au vendredi, puis « Annuler ».
  await p.locator('[data-workout]', { hasText: draft }).dragTo(p.locator(`[data-day="${plus(monday, 4)}"]`));
  await expect(p.getByRole('status').filter({ hasText: /déplacée au/ })).toBeVisible();
  await expect.poll(() => dayOf(p, draft)).toBe(plus(monday, 4));
  await p.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(() => dayOf(p, draft)).toBe(plus(monday, 1));

  // Copier par le menu, coller le samedi, « Annuler » retire la copie.
  await p.getByLabel(`Gestes pour « ${pub} »`).click();
  await p.getByRole('button', { name: /Copier \(pour coller ailleurs\)/ }).click();
  await expect(p.getByText(`« ${pub} » est copiée`)).toBeVisible();
  await p.locator(`[data-day="${plus(monday, 5)}"]`).getByRole('button', { name: /Coller/ }).click();
  await expect.poll(() => p.locator('[data-workout]', { hasText: pub }).count()).toBe(2);
  await p.getByRole('button', { name: 'Annuler' }).click();
  await expect.poll(() => p.locator('[data-workout]', { hasText: pub }).count()).toBe(1);
  await p.getByRole('button', { name: 'Terminer' }).click();

  // Retirer le brouillon, puis ⌘Z / Ctrl+Z le rétablit.
  await p.getByLabel(`Gestes pour « ${draft} »`).click();
  await p.getByRole('button', { name: 'Retirer le brouillon' }).click();
  await expect(p.locator('[data-workout]', { hasText: draft })).toHaveCount(0);
  await p.locator(`[data-day="${monday}"]`).getByRole('link', { name: /Ajouter une séance/ }).focus();
  await p.keyboard.press('ControlOrMeta+z');
  await expect(p.locator('[data-workout]', { hasText: draft })).toHaveCount(1);

  // Clavier : copier le brouillon, le coller le dimanche.
  await p.locator('[data-workout]', { hasText: draft }).getByRole('link').focus();
  await p.keyboard.press('ControlOrMeta+c');
  await expect(p.getByText(`« ${draft} » est copiée`)).toBeVisible();
  await p.locator(`[data-day="${plus(monday, 6)}"]`).getByRole('link', { name: /Ajouter une séance/ }).focus();
  await p.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => p.locator('[data-workout]', { hasText: draft }).count()).toBe(2);
  await p.getByRole('button', { name: 'Terminer' }).click();

  // Déplacer la séance publiée par le menu : elle attend la republication.
  await p.getByLabel(`Gestes pour « ${pub} »`).click();
  await p.getByRole('button', { name: 'Déplacer à une date…' }).click();
  await p.getByRole('button', { name: 'Déplacer', exact: true }).click();
  await expect(p.getByRole('status').filter({ hasText: /à republier pour que Camille la voie/ })).toBeVisible();
  await expect(p.locator('[data-workout]', { hasText: pub }).getByText('Modifiée, non publiée')).toBeVisible();
});
