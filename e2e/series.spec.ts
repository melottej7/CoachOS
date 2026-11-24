import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * D-165 · Exercice en séries dans un vrai navigateur (exemple du fondateur : 6 × 20 s de planche, 40 s de récupération).
 * Le coach remplit une seule carte (séries, durée par série, récupération), enregistre et publie ; l’élève suit sur
 * téléphone et les séries s’enchaînent comme une minuterie (horloge simulée : pas d’attente réelle). Photos si SHOTS est défini.
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

test('une carte d’exercice : 6 séries de 20 s, 40 s de récupération ; l’élève les enchaîne comme une minuterie', async ({ browser }) => {
  const title = `Gainage e2e ${Date.now().toString(36)}`;
  const coach = await as(browser, 'Marine Roy', DESKTOP);
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/new?date=${todayBrussels()}`);
  await coach.locator('#title').fill(title);
  await coach.locator('#sport').selectOption('strength');

  // « Exercice » : une carte, 3 séries de 10 d’office.
  await coach.getByRole('button', { name: 'Exercice', exact: true }).click();
  const card = coach.getByRole('group', { name: 'Bloc 1' });
  await expect(card.getByText('3 séries', { exact: true })).toBeVisible();
  await card.getByLabel('Exercice').fill('Planche');
  await card.getByRole('spinbutton', { name: 'Séries', exact: true }).fill('6');
  await card.getByRole('radio', { name: 'Durée' }).check();
  await card.getByLabel('Minutes', { exact: true }).fill('0');
  await card.getByLabel('Secondes', { exact: true }).fill('20');
  await card.getByLabel('Minutes de récupération').fill('0');
  await card.getByLabel('Secondes de récupération').fill('40');
  await expect(card.getByText('6 séries', { exact: true })).toBeVisible();
  await expect(coach.getByRole('listitem').filter({ hasText: /^6 × \(Planche · 20 s \/ repos 40 s\)$/ })).toBeVisible();
  await expect(coach.getByText(/Total : 6 min/)).toBeVisible();
  expect(await overflow(coach)).toBe(0);
  await card.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/series-carte-1440.png` : undefined });

  await coach.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await coach.waitForURL(/\/workouts\/[0-9a-f-]{36}\?notice=saved/);
  const sid = /\/workouts\/([0-9a-f-]{36})/.exec(coach.url())![1]!;
  await expect(coach.getByText(/6\s*séries · 20\s*s · repos 40\s*s/)).toBeVisible();
  await coach.getByRole('button', { name: 'Publier pour Camille' }).click();
  await coach.waitForURL(/notice=published/);

  // Rouvrir : la carte retrouve 6 séries et 40 s.
  await coach.goto(`/coach/${WS_A}/athletes/${CAMILLE}/workouts/${sid}/edit`);
  const again = coach.getByRole('group', { name: 'Bloc 1' });
  await expect(again.getByRole('spinbutton', { name: 'Séries', exact: true })).toHaveValue('6');
  await expect(again.getByLabel('Secondes de récupération')).toHaveValue('40');

  // L’élève, téléphone, horloge simulée ; on garde ce que le téléphone dit et chaque bip joué (D-166).
  const camille = await as(browser, 'Camille Laurent', PHONE);
  await camille.addInitScript(() => {
    const w = window as unknown as { __said: string[]; __beeps: number[] };
    w.__said = [];
    w.__beeps = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { if (u.text.trim()) w.__said.push(u.text); };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...a: [number?]) { w.__beeps.push(Math.round(this.frequency.value)); return start.apply(this, a); };
  });
  const said = () => camille.evaluate(() => (window as unknown as { __said: string[] }).__said);
  const beeps = () => camille.evaluate(() => (window as unknown as { __beeps: number[] }).__beeps);
  const elapsed = camille.getByLabel(/^Temps de séance/);
  await camille.clock.install();
  await camille.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  await expect(camille.getByText('Série 1 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByRole('heading', { name: 'Planche' })).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText('0:20');
  await expect(elapsed).toHaveText('0:00');
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'true');
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'series-suivre-390');

  // Départ au doigt : la séance démarre, la voix annonce la série, son de départ.
  await camille.getByRole('button', { name: 'Démarrer le chrono' }).click();
  await expect.poll(said).toContain('Série 1 sur 6. Planche. 20 secondes.');
  await expect.poll(beeps).toEqual([880, 1320]);
  await camille.clock.fastForward(10_000);
  await expect(elapsed).toHaveText('0:10');

  // Pause : tout se fige ; reprise : tout repart.
  await camille.getByRole('button', { name: 'Mettre la séance en pause' }).click();
  await expect(camille.getByRole('heading', { name: 'Séance en pause' })).toBeVisible();
  await shot(camille, 'suivre-pause-390');
  await camille.clock.fastForward(30_000);
  await expect(elapsed).toHaveText('0:10');
  await expect(camille.getByRole('timer')).toHaveText('0:10');
  await camille.getByRole('button', { name: 'Reprendre', exact: true }).click();
  // runFor joue chaque battement du chrono (les bips des 3 dernières secondes) ; fastForward saute d’un coup.
  await camille.clock.runFor(11_000);

  // Fin de l’effort : bips 3-2-1, son de fin, la récupération part seule et s’annonce.
  await expect(camille.getByText('Récupère')).toBeVisible();
  const played = await beeps();
  expect(played.filter((f) => f === 660)).toHaveLength(3);
  expect(played).toContain(988);
  await expect.poll(said).toContain('Récupération, 40 secondes. Ensuite : Planche.');
  await camille.clock.runFor(31_000);
  await expect.poll(said).toContain('Encore 10 secondes.');
  await camille.clock.runFor(10_000);
  // Fin de la récupération : la série 2 part seule.
  await expect(camille.getByText('Série 2 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByRole('button', { name: '+15 s' })).toBeVisible();
  await expect.poll(said).toContain('Série 2 sur 6. Planche. 20 secondes.');

  // Réglage gardé : sans bips, même après rechargement ; la séance reprend où elle était, chronomètre compris.
  await camille.getByRole('button', { name: 'Bips' }).click();
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'false');
  await camille.reload();
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'false');
  await expect(camille.getByText('Série 2 sur 6', { exact: true })).toBeVisible();
  await expect(elapsed).not.toHaveText('0:00');

  // Jusqu’au bout : durée de séance, puis le retour la reprend.
  for (let n = 0; n < 20 && !(await camille.getByRole('heading', { name: /Séance terminée, bravo\s!/ }).isVisible()); n++) {
    await camille.getByRole('button', { name: /^(Suivant|Passer le repos|Fait, suivant)$/ }).click();
  }
  await expect(camille.getByRole('heading', { name: /Séance terminée, bravo\s!/ })).toBeVisible();
  await expect(camille.getByText('Durée', { exact: true })).toBeVisible();
  await expect.poll(said).toContain('Séance terminée. Bravo !');
  await shot(camille, 'suivre-fin-390');
  await camille.getByRole('link', { name: 'Donner mon retour' }).click();
  await camille.locator('#state-completed').check();
  await expect(camille.locator('#duration')).toHaveValue('1');
  await expect(camille.getByText(/D’après ton chronomètre de séance/)).toBeVisible();
});
