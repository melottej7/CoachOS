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
  // D-172 : la séance s’ouvre sur l’écran « prêt·e ? » : l’exercice en grand, son résumé, un seul bouton pour partir.
  await expect(camille.getByRole('heading', { name: 'Planche' })).toBeVisible();
  await expect(camille.getByText('6 séries · 20 s · repos 40 s', { exact: true })).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveCount(0);
  await expect(elapsed).toHaveText('0:00');
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'true');
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'suivre-pret-390');

  // « C’est parti » : la séance démarre, la voix annonce la série ; 5 s de mise en place (3-2-1), puis son de départ (D-167).
  await camille.getByRole('button', { name: 'C’est parti' }).click();
  await expect(camille.getByText('Série 1 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByText('Mets-toi en place')).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText('5');
  await expect.poll(said).toContain('Série 1 sur 6. Planche. 20 secondes.');
  expect(await beeps()).toEqual([]);
  await shot(camille, 'suivre-mise-en-place-390');
  await camille.clock.runFor(5_000);
  await expect(camille.getByRole('timer')).toHaveText('0:20');
  await expect.poll(beeps).toEqual([660, 660, 660, 880, 1320]);
  await camille.clock.fastForward(10_000);
  await expect(elapsed).toHaveText('0:15');

  // Pause sous le pouce, en plein effort : tout se fige, la pause se compte ; reprise : 5 s pour se remettre en place (D-172).
  await camille.getByRole('button', { name: 'Mettre la séance en pause' }).click();
  await expect(camille.getByRole('heading', { name: 'Séance en pause' })).toBeVisible();
  await expect(camille.getByRole('button', { name: 'Démarrer le chrono' })).toHaveCount(0);
  await camille.clock.fastForward(30_000);
  await expect(elapsed).toHaveText('0:15');
  await expect(camille.getByRole('timer')).toHaveText('0:10');
  await expect(camille.getByLabel('En pause depuis 0:30')).toBeVisible();
  // La barre garde le temps d’effort restant (10 s sur 20 s), pas la mise en place.
  await expect(camille.getByRole('timer').locator('xpath=following-sibling::div[1]/span')).toHaveAttribute('style', /inline-size: (4[5-9](\.\d+)?|50)%/); // environ la moitié, même sur une machine chargée
  await shot(camille, 'suivre-pause-390');
  await camille.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(camille.getByText('Mets-toi en place')).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText('5');
  // runFor joue chaque battement du chrono (les bips des 3 dernières secondes) ; fastForward saute d’un coup.
  await camille.clock.runFor(16_000);

  // Fin de l’effort : bips 3-2-1, son de fin, la récupération part seule, s’annonce et montre ce qui vient.
  await expect(camille.getByText('Récupère')).toBeVisible();
  const played = await beeps();
  expect(played.filter((f) => f === 660)).toHaveLength(9); // départ, reprise, fin d’effort
  expect(played.filter((f) => f === 880)).toHaveLength(2);
  expect(played).toContain(988);
  await expect.poll(said).toContain('Récupération, 40 secondes. Ensuite : Planche.');
  await expect(camille.getByText('À suivre', { exact: true })).toBeVisible();
  await expect(camille.getByText('Série 2 sur 6 · 20 s', { exact: true }).filter({ visible: true })).toBeVisible();
  await shot(camille, 'suivre-repos-390');
  await camille.clock.runFor(31_000);
  await expect.poll(said).toContain('Encore 10 secondes.');
  await camille.clock.runFor(10_000);
  // Fin de la récupération : la série 2 part seule, sans mise en place.
  await expect(camille.getByText('Série 2 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByRole('button', { name: '+15 s' })).toBeVisible();
  await expect.poll(said).toContain('Série 2 sur 6. Planche. 20 secondes.');
  await camille.clock.runFor(5_000);

  // Réglage gardé : sans bips, même après rechargement ; la séance reprend où elle était, minuterie et chronomètre compris.
  await camille.getByRole('button', { name: 'Bips' }).click();
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'false');
  await camille.reload();
  await expect(camille.getByRole('button', { name: 'Bips' })).toHaveAttribute('aria-pressed', 'false');
  await expect(camille.getByText('Série 2 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByRole('timer')).toHaveText(/^0:1\d$/);
  await expect(elapsed).not.toHaveText('0:00');

  // « Quitter » met la séance en pause ; la fiche propose de la reprendre.
  await camille.getByRole('link', { name: 'Quitter' }).click();
  await camille.waitForURL(new RegExp(`/workouts/${sid}$`));
  await camille.getByRole('link', { name: 'Reprendre la séance' }).click();
  await expect(camille.getByRole('heading', { name: 'Séance en pause' })).toBeVisible();
  await camille.getByRole('button', { name: 'Reprendre', exact: true }).click();

  // Le déroulé : l’étape en cours marquée ; toucher la dernière série y va (sans lancer son chrono : on n’arrive pas par le fil).
  await camille.getByRole('button', { name: /^Étape \d+ sur 11$/ }).click();
  const outline = camille.getByRole('dialog', { name: 'Déroulé' });
  await expect(outline.getByRole('listitem')).toHaveCount(11);
  await expect(outline.locator('[aria-current="step"]')).toContainText('Planche');
  expect(await overflow(camille)).toBe(0);
  await shot(camille, 'suivre-deroule-390');
  await outline.getByRole('listitem').last().getByRole('button', { name: /^Planche Série 6 sur 6/ }).click();
  await expect(outline).toBeHidden();
  await expect(camille.getByText('Série 6 sur 6', { exact: true })).toBeVisible();
  await expect(camille.getByText('Dernière série !', { exact: true })).toBeVisible();
  await expect(camille.getByRole('button', { name: 'Démarrer le chrono' })).toBeVisible();

  // Jusqu’au bout : durée de séance ; terminée par erreur, on revient à la dernière étape (en pause), puis on finit.
  await camille.getByRole('button', { name: 'Suivant' }).click();
  await expect(camille.getByRole('heading', { name: /Séance terminée, bravo\s!/ })).toBeVisible();
  await expect(camille.getByText('Durée', { exact: true })).toBeVisible();
  await expect(camille.getByText(/^Pauses non comptées : 0:3\d$/)).toBeVisible();
  await expect.poll(said).toContain('Séance terminée. Bravo !');
  await camille.getByRole('button', { name: 'Revenir à la dernière étape' }).click();
  await expect(camille.getByRole('heading', { name: 'Séance en pause' })).toBeVisible();
  await camille.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await camille.getByRole('button', { name: 'Suivant' }).click();
  await expect(camille.getByRole('heading', { name: /Séance terminée, bravo\s!/ })).toBeVisible();
  await shot(camille, 'suivre-fin-390');

  // Sur ordinateur (1440) : la progression est propre à chaque appareil, la séance repart au début ; pas de débordement.
  const large = await as(browser, 'Camille Laurent', DESKTOP);
  await large.goto(`/athlete/${WS_A}/workouts/${sid}/suivre`);
  await expect(large.getByRole('heading', { name: 'Planche' })).toBeVisible();
  await expect(large.getByRole('button', { name: 'C’est parti' })).toBeVisible();
  expect(await overflow(large)).toBe(0);
  await shot(large, 'suivre-1440');
  await large.getByRole('button', { name: 'Étape 1 sur 11' }).click();
  await expect(large.getByRole('dialog', { name: 'Déroulé' })).toBeVisible();
  expect(await overflow(large)).toBe(0);
  await shot(large, 'suivre-deroule-1440');
  await large.keyboard.press('Escape');
  await camille.getByRole('link', { name: 'Donner mon retour' }).click();
  await camille.locator('#state-completed').check();
  await expect(camille.locator('#duration')).toHaveValue('1');
  await expect(camille.getByText(/D’après ton chronomètre de séance/)).toBeVisible();
});
