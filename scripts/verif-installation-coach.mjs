// Le coach trouve le guide d’installation dans « Mon compte » (téléphone iPhone et ordinateur), données fictives, port 3200.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3200';
const b = await chromium.launch();
for (const [label, opts] of [['iPhone', { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', isMobile: true, hasTouch: true }], ['ordinateur', { viewport: { width: 1440, height: 900 } }]]) {
  const p = await (await b.newContext({ ...opts, serviceWorkers: 'block' })).newPage();
  await p.goto(`${BASE}/demo`);
  await p.getByRole('button', { name: /Marine Roy/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  await p.goto(`${BASE}/profile`);
  const guide = p.getByRole('region', { name: 'Installe CoachOS sur ton téléphone' });
  await guide.waitFor();
  console.log(label, '·', (await guide.innerText()).replace(/\n+/g, ' · ').slice(0, 260));
  if (label === 'iPhone') { await guide.scrollIntoViewIfNeeded(); await p.screenshot({ path: 'docs/bilan-produit/apres-coach-installation.png' }); }
}
await b.close();
