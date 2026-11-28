import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * IA-1 (D-189) · « Dicter ou écrire avec l’IA » en simulation, sur téléphone (390 px) : le coach écrit sa séance en
 * langage courant, voit la proposition ligne par ligne, corrige le texte, insère dans la séance et enregistre un
 * brouillon (rien n’est publié). L’élève ne voit pas le brouillon. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
function todayBrussels(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
async function as(browser: Browser, who: string, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport, locale: 'fr-BE', timezoneId: 'Europe/Brussels' });
  const p = await context.newPage();
  await p.goto('/demo');
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return p;
}

test('dicter une séance : proposition relue, corrigée, insérée en brouillon', async ({ browser }) => {
  const title = `Dictée e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');
  await coach.getByText('Dicter ou écrire avec l’IA').click();
  const input = coach.getByLabel('Ta séance, en langage courant');
  await input.fill('échauffement 10 minutes vélo, puis presse 4 séries de 10 à 60 kilos, 2 minutes de repos, tirage poitrine 3 fois 12, fais un truc sympa');
  await coach.getByRole('button', { name: 'Proposer la séance' }).click();
  await expect(coach.getByText('IA simulée', { exact: true })).toBeVisible();
  // Ce qui ne se lit pas est signalé et laissé de côté ; le reste est prêt à relire.
  await expect(coach.getByText(/« fais un truc sympa » ·/)).toBeVisible();
  const draft = coach.getByLabel('Texte de la séance (modifiable)');
  await expect(draft).toHaveValue("échauffement 10' vélo RPE3 + 4×10 presse à cuisses 60kg R2' + 3×12 tirage poitrine");
  await expect(coach.getByText(/machine : ajoute-la depuis « Machines »/)).toBeVisible();
  // Le coach corrige : 3 séries de tirage passent à 15 répétitions, et il ajoute du gainage.
  await draft.fill("échauffement 10' RPE3 « vélo » + 4×10 presse à cuisses 60kg R2' + 3×15 tirage poitrine + 3×45\" gainage");
  await expect(coach.getByText('4 blocs compris')).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'dictee-proposition-390');
  await coach.getByRole('button', { name: 'Insérer dans la séance' }).click();
  await expect(coach.getByRole('status').filter({ hasText: 'Inséré dans la séance' })).toBeVisible();
  await expect(coach.getByText(/3 × \(Tirage poitrine · 15 répétitions\)/).filter({ visible: true }).first()).toBeVisible();
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await expect(coach.getByRole('button', { name: 'Publier pour Camille' })).toBeVisible(); // pas publiée

  // L’élève ne voit pas un brouillon.
  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  const res = await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  expect(res?.status() === 404 || (await camille.getByText(title).count()) === 0).toBe(true);

  // Sur ordinateur (1440 px) : même panneau, mise en page sans débordement.
  const desk = await as(browser, 'Marine Roy', { width: 1440, height: 900 });
  await desk.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await desk.locator('#sport').selectOption('running');
  await desk.getByText('Dicter ou écrire avec l’IA').click();
  await desk.getByLabel('Ta séance, en langage courant').fill('3 fois 8 minutes à 90 % de VMA, récup 2 minutes');
  await desk.getByRole('button', { name: 'Proposer la séance' }).click();
  await expect(desk.getByLabel('Texte de la séance (modifiable)')).toHaveValue("3×(8' Z4 + R2')");
  expect(await overflow(desk)).toBe(0);
  await shot(desk, 'dictee-1440');
});
