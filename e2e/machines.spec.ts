import { expect, test, type Browser, type Page } from '@playwright/test';
import { motionStatus } from '../packages/domain/src/index';

/**
 * D-178 · Exercices sur machine dans un vrai navigateur. Le coach (1440 px) ajoute la presse, le tirage vertical et le
 * développé machine depuis la bibliothèque des machines, écrit « 4×10 presse à cuisses 60kg R2' » et publie ; l’élève
 * (390 px) touche l’exercice dans sa séance et voit réglages, consignes, erreur et alternative sans quitter la séance ;
 * l’animation n’apparaît qu’une fois validée ; la séance de la semaine reste lisible sans réseau. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
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

test('machines : le coach ajoute trois exercices et publie, l’élève voit la fiche dans sa séance, même sans réseau', async ({ browser }) => {
  const title = `Machines e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', DESKTOP);
  await coach.goto(`/coach/${WS_A}/exercises`);
  await expect(coach.getByRole('heading', { name: 'Machines de salle' })).toBeVisible();
  const search = coach.getByPlaceholder('Chercher : presse, dos, fessiers…');
  for (const [q, key] of [['presse', 'presse-a-cuisses'], ['tirage vertical', 'tirage-vertical'], ['assis à la machine', 'developpe-machine']] as const) {
    await search.fill(q);
    await coach.locator(`#mc-${key}`).check();
  }
  await search.fill('presse');
  await expect(coach.getByText(/^Animation (à relire|validée)$/).first()).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await shot(coach, 'machines-coach-1440');
  await coach.getByRole('button', { name: 'Ajouter 3 exercices à ma bibliothèque' }).click();
  await expect(coach.getByText('3 exercices ajoutés à ta bibliothèque.')).toBeVisible();
  await expect(coach.getByText('déjà dans ta bibliothèque').first()).toBeVisible();

  // Séance écrite en texte, récupération en notation du coach (R2', R1'30).
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');
  await coach.getByText('Écrire la séance en texte').click();
  await coach.getByLabel('Ta séance en texte').fill("8' RPE3 + 4×10 presse à cuisses 60kg R2' + 3×12 tirage vertical 40kg R1'30 + 3×10 développé assis à la machine 30kg R1'30");
  await expect(coach.getByText('4 × (Presse à cuisses · 10 répétitions · 60 kg / récup 2 min)')).toBeVisible();
  await coach.getByRole('button', { name: 'Créer ces blocs' }).click();
  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  // L’élève, téléphone : Aujourd’hui d’abord (la semaine est gardée pour le hors-ligne), puis la séance.
  const camille = await as(browser, 'Camille Laurent', PHONE);
  await camille.goto(`/athlete/${WS_A}/today`);
  const url = `/athlete/${WS_A}/workouts/${sid}`;
  await expect.poll(() => camille.evaluate(async (u) => {
    const c = await caches.open('coachos-pages-v1');
    return (await c.keys()).some((r) => new URL(r.url).pathname === u);
  }, url), { timeout: 20_000 }).toBe(true);

  await camille.goto(url);
  const validated = motionStatus('presse-a-cuisses') === 'validated';
  await camille.getByText(validated ? 'Voir comment faire · Presse à cuisses' : 'Comment faire · Presse à cuisses').click();
  const fiche = camille.locator('details[open]').filter({ hasText: 'Presse à cuisses' }).first();
  await expect(fiche.getByText('Réglages')).toBeVisible();
  await expect(fiche.getByText('Descends jusqu’à environ 90° aux genoux, le bas du dos reste collé.')).toBeVisible();
  await expect(fiche.getByText('Erreur fréquente')).toBeVisible();
  await expect(fiche.getByText('Squat à la Smith machine')).toBeVisible();
  // Aucune animation avant validation du fondateur.
  await expect(camille.getByRole('button', { name: /animation : Presse à cuisses/ })).toHaveCount(validated ? 1 : 0);
  expect(await overflow(camille)).toBe(0);
  await camille.getByText(validated ? 'Voir comment faire · Presse à cuisses' : 'Comment faire · Presse à cuisses').scrollIntoViewIfNeeded();
  if (process.env.SHOTS) await camille.screenshot({ path: `${process.env.SHOTS}/machines-eleve-390.png` });

  // Mode « Suivre » : la fiche est aussi là, sous l’exercice.
  await camille.goto(`${url}/suivre`);
  await expect(camille.getByRole('heading', { name: /Échauffement|Presse à cuisses/ }).first()).toBeVisible();

  // Sans réseau : la séance de la semaine s’ouvre avec sa fiche.
  await camille.context().setOffline(true);
  await camille.goto(url);
  await expect(camille.getByText(/Hors ligne · page enregistrée/)).toBeVisible();
  await expect(camille.getByText('Comment faire · Presse à cuisses').or(camille.getByText('Voir comment faire · Presse à cuisses'))).toBeVisible();
  await camille.context().setOffline(false);
});
