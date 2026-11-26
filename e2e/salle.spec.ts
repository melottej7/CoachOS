import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-181 · D-182 · À la salle. Le coach (1440 px) choisit « Basic-Fit » et ajoute trois machines à la séance en trois
 * touchers, reliées à sa bibliothèque. L’élève (390 px), machine prise : commence par un autre exercice, en remplace un,
 * en ajoute un hors programme ; la séance revient ensuite à l’exercice laissé ; son retour reprend les changements.
 */
const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function as(browser: Browser, who: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('salle : séance Basic-Fit choisie machine par machine, puis suivie dans un autre ordre', async ({ browser }) => {
  const coach = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${today()}`);
  await coach.locator('#title').fill(`Salle e2e ${Date.now().toString(36)}`);
  await coach.locator('#sport').selectOption('strength');
  await coach.getByRole('button', { name: /^Machines/ }).click();
  const sheet = coach.getByRole('dialog', { name: 'Ajouter des machines' });
  await sheet.getByRole('radio', { name: 'Basic-Fit (Belgique)' }).click();
  // D-185 : recherche par le nom écrit sur la machine, sans accents et dans n’importe quel ordre.
  const search = sheet.getByRole('searchbox', { name: 'Chercher une machine ou un muscle' });
  await search.fill('row seated');
  await expect(sheet.getByRole('button', { name: /Rowing assis/ }).first()).toBeVisible();
  await search.fill('developpe assis');
  await expect(sheet.getByRole('button', { name: /Développé assis à la machine/ }).first()).toBeVisible();
  await search.fill('');
  for (const name of ['Presse à cuisses', 'Tirage vertical', 'Développé assis à la machine']) {
    await sheet.getByRole('button', { name: new RegExp(`^\\S*\\s*${name}`) }).first().click();
  }
  await expect(sheet.getByRole('button', { name: /Presse à cuisses/ }).first()).toHaveAttribute('aria-pressed', 'true');
  await shot(coach, 'salle-coach-1440');
  await sheet.getByRole('button', { name: 'Ajouter 3 exercices' }).click();
  await expect(sheet).toBeHidden();
  // Reliés à la bibliothèque : pas d’avertissement « sans vidéo » ; la salle est retenue sur le bouton.
  await expect(coach.locator('input[value="Tirage vertical"]')).toBeVisible();
  await expect(coach.getByText('Pas dans ta bibliothèque')).toHaveCount(0);
  await expect(coach.getByRole('button', { name: 'Machines Basic-Fit' })).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  const p = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  await p.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  const title = (name: string) => p.locator('#fw-gate').filter({ hasText: name });
  await expect(title('Presse à cuisses')).toBeVisible();

  // La presse est prise : on commence par le tirage.
  await p.getByRole('button', { name: 'Machine prise ? Changer' }).click();
  const change = p.getByRole('dialog', { name: 'Machine prise ?' });
  await change.getByRole('button', { name: /^Tirage vertical/ }).click();
  await expect(title('Tirage vertical')).toBeVisible();

  // Le tirage aussi : remplacé, puis un exercice en plus.
  await p.getByRole('button', { name: 'Machine prise ? Changer' }).click();
  await change.getByPlaceholder('Ou écris un exercice').fill('Tirage horizontal');
  await change.getByRole('button', { name: 'Remplacer', exact: true }).click();
  await expect(change.getByText('Tirage vertical remplacé par Tirage horizontal.')).toBeVisible();
  await change.getByLabel('Exercice', { exact: true }).fill('Gainage');
  await change.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(change.getByText('Gainage ajouté, noté pour ton coach.')).toBeVisible();
  expect(await overflow(p)).toBe(0);
  await shot(p, 'salle-eleve-390');
  await change.getByRole('button', { name: 'Retour à la séance' }).click();
  await expect(title('Tirage horizontal')).toBeVisible();

  // Après le tirage : le développé, puis retour à la presse laissée en arrière.
  await p.getByRole('button', { name: 'Passer cet exercice' }).click();
  await expect(title('Développé assis à la machine')).toBeVisible();
  await p.getByRole('button', { name: 'Passer cet exercice' }).click();
  await expect(title('Presse à cuisses')).toBeVisible();
  await expect(p.getByText('Exercice 3 sur 3 · le dernier')).toBeVisible();
  await p.getByRole('button', { name: 'Finir sans cet exercice' }).click();
  await expect(p.getByText('Tirage vertical → Tirage horizontal')).toBeVisible();
  await expect(p.getByText('En plus :')).toBeVisible();

  // Le retour reprend les changements pour le coach (rechargé : tout est gardé sur le téléphone).
  await p.goto(`/athlete/${WS_A}/workouts/${sid}/feedback`);
  await expect(p.locator('#comment')).toHaveValue(/remplacé : Tirage vertical → Tirage horizontal.*en plus : Gainage \(3 × 10\)/);
});
