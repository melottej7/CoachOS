// Relevé rapide des écrans sur téléphone (390 × 844) : hauteur en écrans, commandes, début du texte. Données fictives (port 3200).
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3200';
const WS = '10000000-0000-4000-8000-00000000000a';
const CAMILLE = '20000000-0000-4000-8000-000000000001';
const pages = {
  'Marine Roy': [`/coach/${WS}/athletes`, `/coach/${WS}/athletes/${CAMILLE}`, `/coach/${WS}/methode`, `/coach/${WS}/calendar?eleve=${CAMILLE}`],
  'Camille Laurent': [`/athlete/${WS}/setup`, `/athlete/${WS}/progress`, `/athlete/${WS}/schedule`],
};
const only = process.argv[2];
const browser = await chromium.launch();
for (const [who, urls] of Object.entries(pages)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-BE', timezoneId: 'Europe/Brussels', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/demo`);
  await p.getByRole('button', { name: new RegExp(who) }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/demo'));
  for (const u of urls) {
    if (only && !u.includes(only)) continue;
    const res = await p.goto(`${BASE}${u}`);
    await p.waitForLoadState('networkidle');
    const info = await p.evaluate(() => ({
      screens: Math.round((document.documentElement.scrollHeight / 844) * 10) / 10,
      controls: document.querySelectorAll('main button, main a, main input, main select, main textarea').length,
      text: (document.querySelector('main')?.innerText ?? '').replace(/\n+/g, ' · ').slice(0, 700),
    })).catch(() => ({ screens: 0, controls: 0, text: '' }));
    console.log(`\n## ${who} · ${u.replace(WS, 'WS').replace(CAMILLE, 'CAMILLE')} · ${res?.status()} · ${info.screens} écrans · ${info.controls} commandes\n${info.text}`);
  }
  await ctx.close();
}
await browser.close();
