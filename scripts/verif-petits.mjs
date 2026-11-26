// Vérifie deux retouches sur téléphone (données fictives, port 3200) : onglet ouvert visible, nom d’espace proposé.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3200';
const WS = '10000000-0000-4000-8000-00000000000a';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
await p.goto(`${BASE}/demo`);
await p.getByRole('button', { name: /Marine Roy/ }).click();
await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
await p.goto(`${BASE}/coach/${WS}/settings?onglet=donnees`);
await p.waitForLoadState('networkidle');
const tab = await p.getByRole('link', { name: 'Mes données' }).boundingBox();
console.log('onglet « Mes données » de', Math.round(tab.x), 'à', Math.round(tab.x + tab.width), 'px (écran de 390)');
await p.screenshot({ path: 'docs/bilan-produit/apres-onglets-parametres.png', clip: { x: 0, y: 0, width: 390, height: 300 } });
await p.goto(`${BASE}/coach/new`);
await p.waitForLoadState('networkidle');
console.log('nom d’espace proposé :', await p.locator('#name').inputValue());
await b.close();
