// D-179 · Enregistre une page d’animations en vidéo (WebM), pour la regarder sur un téléphone.
// Usage : node scripts/machines-video.mjs <page.html> <dossier-sortie> [secondes]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const [, , page, dir, seconds = '8'] = process.argv;
const size = { width: 1100, height: 360 };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
const p = await context.newPage();
await p.goto(pathToFileURL(page).href);
await p.waitForTimeout(Number(seconds) * 1000);
const video = p.video();
await context.close();
console.log(await video.path());
await browser.close();
