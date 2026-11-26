import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-164 · Cardio sur machine en paliers dans un vrai navigateur : le coach programme 19 minutes d’elliptique
 * (5 min niveau 1, 7 min niveau 2, 5 min niveau 3, 2 min niveau 1) et des squats, enregistre, publie ;
 * l’élève lit les paliers sur téléphone et les suit un par un. Photos si SHOTS est défini.
 */

const WS_A = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const shot = async (p: Page, name: string) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };

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

async function stage(p: Page, n: number, minutes: number, level: number) {
  await p.getByLabel(`Minutes du palier ${n}`).fill(String(minutes));
  const lvl = p.getByLabel(`Niveau du palier ${n}`);
  await lvl.fill(String(level));
  await lvl.blur();
}

const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('le coach programme un cardio en paliers ; l’élève le lit et le suit palier par palier', async ({ browser }) => {
  const title = `Salle e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', DESKTOP);
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');

  await coach.getByRole('button', { name: 'Cardio', exact: true }).click();
  await expect(coach.getByLabel('Machine')).toHaveValue('elliptical');
  await stage(coach, 1, 5, 1);
  for (const [n, minutes, level] of [[2, 7, 2], [3, 5, 3], [4, 2, 1]] as const) {
    await coach.getByRole('button', { name: 'Palier', exact: true }).click();
    await stage(coach, n, minutes, level);
  }
  await expect(coach.getByText('19 min', { exact: true })).toBeVisible();
  // D-170 : déplacer un palier, au clavier puis à la souris ; chaque palier garde ses valeurs.
  const level = (n: number) => coach.getByLabel(`Niveau du palier ${n}`, { exact: true });
  await coach.getByRole('button', { name: /^Déplacer le palier 4/ }).press('ArrowUp');
  await expect(level(3)).toHaveValue('1');
  await expect(level(4)).toHaveValue('3');
  await expect(coach.getByRole('button', { name: /^Déplacer le palier 3/ })).toBeFocused();
  const grip = await coach.getByRole('button', { name: /^Déplacer le palier 3/ }).boundingBox();
  const last = await coach.locator('[data-stage]').nth(3).boundingBox();
  await coach.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
  await coach.mouse.down();
  await coach.mouse.move(grip!.x + grip!.width / 2, last!.y + last!.height - 4, { steps: 8 });
  await coach.mouse.up();
  await expect(level(3)).toHaveValue('3');
  await expect(level(4)).toHaveValue('1');
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  await coach.getByLabel('Exercice').last().fill('Squat goblet');
  // « Ce que lira l’élève » :
  await expect(coach.getByRole('listitem').filter({ hasText: /^Vélo elliptique · 19 min : 5 min · niveau 1, 7 min · niveau 2, 5 min · niveau 3, 2 min · niveau 1$/ })).toBeVisible();
  await shot(coach, 'cardio-editeur-1440');
  expect(await overflow(coach)).toBe(0);

  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  const paliers = coach.getByRole('list', { name: 'Paliers' });
  await expect(paliers.getByRole('listitem')).toHaveText([/5\s*min · niveau 1$/, /7\s*min · niveau 2$/, /5\s*min · niveau 3$/, /2\s*min · niveau 1$/]);
  await shot(coach, 'cardio-seance-coach-1440');
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  // L’élève, sur téléphone : la séance avec ses paliers, puis le suivi palier par palier.
  const camille = await as(browser, 'Camille Laurent', PHONE);
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await expect(camille.getByRole('heading', { name: title })).toBeVisible();
  await expect(camille.getByRole('list', { name: 'Paliers' }).getByRole('listitem')).toHaveCount(4);
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'cardio-seance-eleve-390');

  await camille.clock.install();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  // D-172 : l’écran « prêt·e ? » montre l’exercice et ses paliers ; « C’est parti », 5 s de mise en place, puis le palier 1.
  await expect(camille.getByText('Exercice 1 sur 2', { exact: true })).toBeVisible();
  await expect(camille.getByRole('heading', { name: 'Vélo elliptique' })).toBeVisible();
  await expect(camille.getByText('19 min · 4 paliers', { exact: true })).toBeVisible();
  await expect(camille.getByRole('list', { name: 'Paliers à venir' }).getByRole('listitem')).toHaveCount(4);
  expect(await overflow(camille)).toBe(0);
  await camille.getByRole('button', { name: 'C’est parti' }).click();
  await expect(camille.getByText('Palier 1 sur 4', { exact: true })).toBeVisible();
  await expect(camille.getByText('niveau 1', { exact: true })).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText('5');
  await camille.clock.runFor(5_000);
  await expect(camille.getByRole('timer')).toHaveText('5:00');
  await expect(camille.getByText(/Ensuite : palier 2 · 7 min · niveau 2/)).toBeVisible();
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'cardio-suivre-390');
  await camille.getByRole('button', { name: 'Suivant' }).click();
  await expect(camille.getByText('Palier 2 sur 4', { exact: true })).toBeVisible();
  // Le palier suivant démarre seul, comme sur la machine, et passe seul au palier 3 à la fin de ses 7 minutes.
  await expect(camille.getByRole('button', { name: '+15 s' })).toBeVisible();
  await camille.clock.fastForward(7 * 60_000 + 1000);
  await expect(camille.getByText('Palier 3 sur 4', { exact: true })).toBeVisible();
  await expect(camille.getByText('niveau 3', { exact: true })).toBeVisible();

  // D-172 : fin du cardio → l’écran entre deux exercices : bravo, la séance en pause (la pause se compte, pas la durée),
  // l’exercice suivant en grand ; l’élève lance quand elle est prête.
  await camille.clock.fastForward(5 * 60_000 + 1000);
  await expect(camille.getByText('Palier 4 sur 4', { exact: true })).toBeVisible();
  await camille.clock.fastForward(2 * 60_000 + 1000);
  await expect(camille.getByText('Bravo, Vélo elliptique : fait !')).toBeVisible();
  await expect(camille.getByText('Exercice 2 sur 2 · le dernier', { exact: true })).toBeVisible();
  await expect(camille.getByRole('heading', { name: 'Squat goblet' })).toBeVisible();
  const elapsed = camille.getByLabel(/^Temps de séance/);
  await expect(elapsed).toHaveAttribute('aria-label', /, en pause$/);
  const before = await elapsed.textContent();
  await camille.clock.fastForward(90_000);
  await expect(camille.getByLabel(/^En pause depuis 1:3\d$/)).toBeVisible();
  await expect(elapsed).toHaveText(before!);
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'suivre-entre-deux-390');
  // Un rechargement retrouve l’écran, la pause comprise.
  await camille.reload();
  await expect(camille.getByText('Bravo, Vélo elliptique : fait !')).toBeVisible();
  await expect(elapsed).toHaveAttribute('aria-label', /, en pause$/);
  await camille.getByRole('button', { name: 'C’est parti' }).click();
  await expect(camille.getByText('Série 1 sur 3', { exact: true })).toBeVisible();
  await expect(camille.getByRole('button', { name: 'Fait, suivant' })).toBeVisible();
  await expect(elapsed).not.toHaveAttribute('aria-label', /en pause/);

  // Revenir au dernier palier, le refaire passer : l’écran revient ; passer le dernier exercice finit la séance,
  // et la fin rappelle ce qui a été passé, pour le dire au coach.
  await camille.getByRole('button', { name: 'Étape précédente' }).click();
  await expect(camille.getByText('Palier 4 sur 4', { exact: true })).toBeVisible();
  await expect(camille.getByRole('button', { name: 'Démarrer le chrono' })).toBeVisible();
  await camille.getByRole('button', { name: 'Suivant' }).click();
  await expect(camille.getByText('Bravo, Vélo elliptique : fait !')).toBeVisible();
  await camille.getByRole('button', { name: 'Finir sans cet exercice' }).click();
  await expect(camille.getByRole('heading', { name: /Séance terminée, bravo\s!/ })).toBeVisible();
  await expect(camille.getByText(/^Exercice passé : Squat goblet\.$/)).toBeVisible();
  await expect(camille.getByText('Ton retour le reprend pour ton coach.')).toBeVisible(); // D-182
  // Le suivi a sa propre sortie (« Quitter ») : pas de flèche d’en-tête ici. Sur la fiche de la séance, la flèche ramène au programme.
  await expect(camille.getByRole('button', { name: 'Revenir en arrière' })).toHaveCount(0);
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}`);
  await camille.getByRole('button', { name: 'Revenir en arrière' }).click();
  await camille.waitForURL(new RegExp(`/athlete/${WS_A}/schedule`));
});
