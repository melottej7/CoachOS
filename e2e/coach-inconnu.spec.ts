import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-169 · Le coach inconnu : un entraîneur de club crée son espace (mode simple), colle sa liste de trois groupes depuis
 * un tableur, publie une première séance, l’élève rejoint par son lien sur téléphone et répond, le coach traite le retour.
 * Les « Premiers pas » de l’Accueil suivent chaque étape puis disparaissent. Droits : un autre coach et un élève ne peuvent
 * pas ajouter d’élèves dans cet espace. Données fictives d’un serveur isolé (playwright.config.ts).
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const todayBrussels = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());

async function as(browser: Browser, name: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const page = await context.newPage();
  await page.goto('/demo');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}

const LIST = [
  'Prénom\tNom\tE-mail\tGroupe',
  'Léa\tMoreau\tlea.moreau@demo.coachos.test\tJuniors',
  'Basile\tRenard\t\tJuniors',
  'Iris\tCollet\t\tSeniors',
  'Malo\tPerret\tmalo.perret@demo.coachos.test\tSeniors',
  'Rose\tVidal\t\tMasters',
  'Yanis\tBrun\t\tMasters',
].join('\n');

test('club à trois groupes : de la création de l’espace au premier retour traité, ordinateur et téléphone', async ({ browser }) => {
  const started = Date.now();
  const club = `Club e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Hugo Petit', DESKTOP);
  await coach.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  // 1. Créer l’espace : le mode simple est proposé d’office ; l’assistant commence par les spécialités.
  await coach.goto('/coach/new');
  await coach.locator('#name').fill(club);
  await expect(coach.getByRole('checkbox', { name: /Commencer en mode simple/ })).toBeChecked();
  await coach.getByRole('button', { name: 'Créer mon espace' }).click();
  await coach.waitForURL(/\/settings\?first=1/);
  const wid = /\/coach\/([0-9a-f-]{36})\//.exec(coach.url())![1]!;
  await expect(coach.getByText(/Étape 1 sur 4 · Spécialités/)).toBeVisible();
  await coach.getByRole('button', { name: 'Enregistrer et finir plus tard' }).click();
  await coach.waitForURL(new RegExp(`/coach/${wid}/planning`));

  // 2. Accueil d’un espace vide : les premiers pas, pas de liste « À faire » vide.
  const steps = coach.getByRole('region', { name: 'Premiers pas' });
  await expect(steps).toContainText('0 sur 4');
  await expect(coach.getByRole('heading', { name: 'À faire' })).toHaveCount(0);
  // La visite guidée d’un espace vide démarre seule ; on la passe.
  const tour = coach.getByRole('dialog', { name: 'Visite guidée CoachOS' });
  await expect(tour).toContainText('En quatre pas');
  await tour.getByRole('button', { name: /^(Passer|Arrêter la visite)$/ }).click();
  await expect(tour).toHaveCount(0);

  // 3. Coller la liste du tableur : aperçu, trois groupes nouveaux, deux liens.
  await steps.getByRole('link', { name: 'Coller ma liste' }).click();
  await coach.locator('#roster').fill(LIST);
  await expect(coach.getByText(/6 élèves à ajouter, dont 2 avec une adresse/)).toBeVisible();
  await expect(coach.getByText(/3 groupes \(3 nouveaux\)/)).toBeVisible();
  await coach.getByRole('button', { name: 'Retirer Yanis Brun' }).click();
  await expect(coach.getByText(/5 élèves à ajouter/)).toBeVisible();
  await coach.getByRole('button', { name: 'Ajouter 5 élèves' }).click();
  await expect(coach.getByText('5 élèves ajoutés')).toBeVisible();
  await coach.getByRole('button', { name: 'Copier les 2 liens' }).click();
  const copied = await coach.evaluate(() => navigator.clipboard.readText());
  const link = /Léa Moreau : (\S+)/.exec(copied)![1]!;
  expect(link).toMatch(/\/invite#token=[A-Za-z0-9_-]{40,}$/);

  // Groupes créés et rangés.
  await coach.goto(`/coach/${wid}/athletes`);
  for (const g of ['Juniors', 'Seniors', 'Masters']) await expect(coach.getByRole('link', { name: g, exact: true }).first()).toBeVisible();
  const leaHref = await coach.getByRole('link', { name: 'Léa Moreau', exact: true }).first().getAttribute('href');
  const lea = /\/athletes\/([0-9a-f-]{36})/.exec(leaHref!)![1]!;

  // 4. Droits : un autre coach et un élève ne peuvent pas ajouter d’élèves ici.
  const marine = await as(browser, 'Marine Roy', DESKTOP);
  const other = await marine.goto(`/coach/${wid}/athletes/import`);
  expect(other?.status()).toBe(404);
  const forbidden = await marine.evaluate(async (w) => (await fetch(`/api/v1/workspaces/${w}/athletes/import`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ timeZone: 'Europe/Brussels', rows: [{ displayName: 'Intrus' }] }),
  })).status, wid);
  expect(forbidden).toBe(404);
  await marine.context().close();

  // 5. Léa rejoint sur son téléphone avec le lien.
  const leaPage = await as(browser, 'Léa Moreau', PHONE);
  await leaPage.goto(link);
  await leaPage.getByRole('button', { name: 'Rejoindre l’espace' }).click();
  await leaPage.waitForURL(new RegExp(`/athlete/${wid}/setup\\?first=1`));
  const asAthlete = await leaPage.evaluate(async (w) => (await fetch(`/api/v1/workspaces/${w}/athletes/import`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ timeZone: 'Europe/Brussels', rows: [{ displayName: 'Intrus' }] }),
  })).status, wid);
  expect(asAthlete).toBe(404);

  // 6. Le coach publie la séance du jour de Léa.
  const title = 'Côtes courtes';
  await coach.goto(`/coach/${wid}/athletes/${lea}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#duration').fill('40');
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/notice=saved/);
  await coach.getByRole('button', { name: 'Publier pour Léa' }).click();
  await coach.waitForURL(/notice=published/);

  // 7. Léa répond en deux touches depuis « Aujourd’hui ».
  await leaPage.goto(`/athlete/${wid}/today`);
  await expect(leaPage.getByRole('heading', { name: title })).toBeVisible();
  await leaPage.getByRole('button', { name: /Faite/ }).click();
  await leaPage.getByRole('button', { name: 'Facile', exact: true }).click();
  await expect(leaPage.getByText('Retour envoyé')).toBeVisible();

  // 8. Le brief le dit, sur téléphone ; le coach traite le retour.
  await coach.setViewportSize(PHONE);
  await coach.goto(`/coach/${wid}/planning`);
  await expect(coach.getByText(/un retour à traiter/)).toBeVisible();
  await expect(coach.getByRole('region', { name: 'Premiers pas' })).toContainText('3 sur 4');
  await coach.getByRole('link', { name: 'un retour à traiter' }).click();
  await coach.getByRole('list', { name: 'Retours à traiter' }).getByRole('link').filter({ hasText: title }).click();
  await coach.getByRole('button', { name: 'Marquer comme traité' }).click();
  // Bilan produit : s’il reste un retour dans la file, le traitement enchaîne sur lui.
  await expect(coach.getByText(/Traité le|Retour précédent traité/).first()).toBeVisible();

  // 9. Premiers pas terminés : la carte disparaît ; le brief rassure et signale les élèves à inviter ; mode simple.
  await coach.goto(`/coach/${wid}/planning`);
  await expect(coach.getByRole('region', { name: 'Premiers pas' })).toHaveCount(0);
  await expect(coach.getByText(/tout le monde est en rythme/)).toBeVisible();
  await expect(coach.getByRole('link', { name: /4 élèves n’ont pas encore rejoint/ })).toBeVisible();
  await expect(coach.getByText(/Mode simple :/)).toBeVisible();
  await expect(coach.getByRole('button', { name: /Tâche/ })).toHaveCount(0);

  // Mesure : tout le parcours, chargements compris, sous la cible de 15 minutes (le robot ne lit pas : c’est un plancher).
  expect(Date.now() - started).toBeLessThan(15 * 60_000);
});
