import { expect, test } from '@playwright/test';

/** D-160 · Palette ⌘K du coach : ouvrir au clavier, chercher un élève, ouvrir sa fiche ; sur téléphone, par le bouton. */

const WS_A = '10000000-0000-4000-8000-00000000000a';

test('⌘K / Ctrl+K : chercher « Cam », Entrée ouvre la fiche ; bouton de recherche sur téléphone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: /Marine Roy/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  await p.goto(`/coach/${WS_A}/planning`);
  await p.waitForLoadState('networkidle');

  await p.keyboard.press('ControlOrMeta+k');
  const dialog = p.getByRole('dialog', { name: 'Palette de commandes' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Rechercher' }).fill('cam');
  await expect(dialog.getByRole('option', { name: /Camille Laurent/ }).first()).toBeVisible();
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/athletes\/20000000-0000-4000-8000-000000000001$/);
  await expect(p.getByRole('heading', { name: 'Camille Laurent', level: 1 })).toBeVisible();

  // Une page par son nom, sans accent ; Échap ferme.
  await p.keyboard.press('ControlOrMeta+k');
  await dialog.getByRole('combobox').fill('biblio');
  await expect(dialog.getByRole('option', { name: /Séances types/ })).toBeVisible();
  await p.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const t = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-BE', storageState: await context.storageState() });
  const tp = await t.newPage();
  await tp.goto(`/coach/${WS_A}/planning`);
  await tp.getByRole('button', { name: 'Rechercher (⌘K)' }).click();
  await expect(tp.getByRole('dialog', { name: 'Palette de commandes' })).toBeVisible();
  await tp.getByRole('combobox', { name: 'Rechercher' }).fill('semaine de noah');
  await tp.getByRole('option', { name: /Semaine de Noah/ }).click();
  await tp.waitForURL(/\/calendar\?athlete=20000000-0000-4000-8000-000000000002/);
});
