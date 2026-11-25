// Captures du bilan produit (docs/bilan-produit) sur téléphone, 390 × 844, données fictives du serveur de démonstration.
// Usage : node scripts/bilan-captures.mjs avant|apres   (serveur : bash scripts/demo-server.sh, port 3200)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const phase = process.argv[2] === 'apres' ? 'apres' : 'avant';
const BASE = process.env.BASE ?? 'http://localhost:3200';
const WS = '10000000-0000-4000-8000-00000000000a';
const out = path.resolve('docs/bilan-produit');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
async function as(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-BE', timezoneId: 'Europe/Brussels', colorScheme: 'light', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/demo`);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/demo'));
  return page;
}
const shot = (page, file, full = false) => page.screenshot({ path: path.join(out, `${phase}-${file}.png`), fullPage: full });

// Élève : ce qu’elle voit en ouvrant l’app.
const camille = await as('Camille Laurent');
await camille.goto(`${BASE}/athlete/${WS}/today`);
await camille.waitForLoadState('networkidle');
await shot(camille, 'eleve-aujourdhui');
const faite = await camille.getByRole('button', { name: 'Faite', exact: true }).boundingBox();
console.log(`élève : bouton « Faite » à ${Math.round(faite?.y ?? -1)} px du haut (écran de 844 px, barre basse comprise)`);

// L’élève répond en deux touchers (Faite, Facile) : un retour sans signal arrive chez le coach.
if (phase === 'apres' && await camille.getByRole('button', { name: 'Faite', exact: true }).isVisible()) {
  await camille.getByRole('button', { name: 'Faite', exact: true }).click();
  await camille.getByRole('button', { name: 'Facile', exact: true }).click();
  await camille.getByText('Retour envoyé').waitFor();
}

// Coach : la file des retours.
const marine = await as('Marine Roy');
await marine.goto(`${BASE}/coach/${WS}/review`);
await marine.waitForLoadState('networkidle');
await shot(marine, 'coach-retours');
if (phase === 'apres') {
  await marine.getByRole('button', { name: 'Tout marquer traité' }).click();
  await marine.getByText(/marqués? comme traités?/).waitFor();
  await marine.waitForLoadState('networkidle');
  await shot(marine, 'coach-retours-traites');
}

await browser.close();
console.log(`captures ${phase} écrites dans ${out}`);
