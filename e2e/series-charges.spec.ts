import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-184 · Retour du fondateur : entre les séries, on change souvent la charge. Le coach règle une carte série par série
 * (12 × 10 kg, 10 × 12 kg, 8 × 14 kg) ; l’élève la lit sur sa séance et la suit sur téléphone, la charge de chaque
 * série affichée, la nouvelle charge annoncée pendant la récupération, la case « Fait » préremplie. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** « 12 × 10 kg, 10 × 12 kg, 8 × 14 kg », espaces insécables compris. */
const PYRAMIDE = /12\s*×\s*10\s*kg,\s*10\s*×\s*12\s*kg,\s*8\s*×\s*14\s*kg/;
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

test('charge et répétitions série par série : le coach les règle, l’élève les suit', async ({ browser }) => {
  const title = `Pyramide e2e ${Date.now().toString(36)}`;
  // Le coach, sur téléphone : c’est là que le fondateur l’a demandé.
  const coach = await as(browser, 'Marine Roy', { width: 390, height: 844 });
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  const card = coach.getByRole('group', { name: 'Bloc 1' });
  await card.getByLabel('Exercice').fill('Tirer latéral');
  await card.getByLabel('Nombre de répétitions').fill('12');
  await card.getByLabel('Intensité').selectOption('load');
  await card.getByLabel('Charge en kg').fill('10');
  await card.getByRole('button', { name: /Varier la charge ou les répétitions/ }).click();
  const sets = card.getByRole('group', { name: 'Séries, une par une' });
  await expect(sets.getByLabel(/^Répétitions de la série/)).toHaveCount(3);
  await sets.getByRole('button', { name: '+2,5 kg par série' }).click();
  await expect(sets.getByLabel('Charge de la série 3 en kg')).toHaveValue('15');
  await sets.getByLabel('Charge de la série 2 en kg').fill('12');
  await sets.getByLabel('Charge de la série 3 en kg').fill('14');
  await sets.getByLabel('Répétitions de la série 2').fill('10');
  await sets.getByLabel('Répétitions de la série 3').fill('8');
  await expect(coach.getByRole('listitem').filter({ hasText: PYRAMIDE }).first()).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await card.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/charges-carte-390.png` : undefined });
  // Une 4e série reprend la dernière ; revenir à 3 la retire.
  await card.getByRole('spinbutton', { name: 'Séries', exact: true }).fill('4');
  await expect(sets.getByLabel('Charge de la série 4 en kg')).toHaveValue('14');
  await card.getByRole('spinbutton', { name: 'Séries', exact: true }).fill('3');
  await expect(sets.getByLabel(/^Charge de la série/)).toHaveCount(3);
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await expect(coach.getByText(PYRAMIDE).first()).toBeVisible();
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);
  // Rouvrir : le tableau est retrouvé.
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/${sid}/edit`);
  await expect(coach.getByLabel('Charge de la série 2 en kg')).toHaveValue('12');

  // L’élève lit la carte, puis suit la séance série par série.
  const camille = await as(browser, 'Camille Laurent', { width: 390, height: 844 });
  await camille.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { if (u.text.trim()) w.__said.push(u.text); };
  });
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(camille.getByText(PYRAMIDE).first()).toBeVisible();
  await camille.clock.install();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  await expect(camille.getByText(PYRAMIDE).filter({ visible: true }).first()).toBeVisible();
  await camille.getByRole('button', { name: 'C’est parti' }).click();
  await expect(camille.getByText('Série 1 sur 3', { exact: true })).toBeVisible();
  await expect(camille.getByLabel('Charge utilisée en kg')).toHaveValue('10');
  await camille.getByRole('button', { name: 'Fait, suivant' }).click();
  // Récupération : la nouvelle charge, en évidence et à voix haute.
  await expect(camille.getByText('Récupère')).toBeVisible();
  await expect(camille.getByText(/^Prépare 12 kg/)).toBeVisible();
  await expect.poll(() => camille.evaluate(() => (window as unknown as { __said: string[] }).__said)).toContain('Récupération, 1 minute 30. Ensuite : Tirer latéral. Prépare 12 kilos.');
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'charges-repos-390');
  await camille.getByRole('button', { name: 'Passer le repos' }).click();
  await expect(camille.getByText('Série 2 sur 3', { exact: true })).toBeVisible();
  await expect(camille.getByLabel('Répétitions faites')).toHaveValue('10');
  await expect(camille.getByLabel('Charge utilisée en kg')).toHaveValue('12');
});
