// D-178 · Photos d’une page d’animations à des instants donnés de la boucle (relecture image par image).
// Usage : node scripts/machines-frames.mjs <page.html> <sortie-prefixe> [secondes...]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const [, , page, prefix, ...times] = process.argv;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 560 } });
await p.goto(pathToFileURL(page).href);
for (const t of times.length ? times : ['0', '2']) {
  await p.evaluate((s) => document.querySelectorAll('svg').forEach((g) => { g.pauseAnimations(); g.setCurrentTime(Number(s)); }), t);
  await p.screenshot({ path: `${prefix}-${t}s.png`, clip: { x: 0, y: 90, width: 1100, height: 330 } });
}
await browser.close();
