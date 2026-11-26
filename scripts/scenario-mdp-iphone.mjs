// Scénario iPhone : la demande part de « l’app installée » (contexte A) ; le lien est ouvert dans « Safari » (contexte B,
// qui ne partage rien avec A). Compte fictif de Supabase local, e-mails lus dans Mailpit.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:3300';
const MAIL = 'http://127.0.0.1:54324';
const EMAIL = 'marine.roy@demo.coachos.test';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const out = process.argv[2];

async function lastMail(after) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`)).json();
    const m = list.messages?.[0];
    if (m && new Date(m.Created) > after) return (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('aucun e-mail');
}

const browser = await chromium.launch();
const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: UA, isMobile: true, hasTouch: true, locale: 'fr-BE', serviceWorkers: 'block' });

// 1. Code recopié dans l’app.
const app = await (await ctx()).newPage();
let t0 = new Date();
await app.goto(`${BASE}/forgot-password`);
await app.getByLabel('Adresse e-mail').fill(EMAIL);
await app.getByRole('button', { name: 'Recevoir un code' }).click();
await app.getByLabel('Code à 6 chiffres reçu par e-mail').waitFor();
if (out) await app.screenshot({ path: `${out}/apres-mdp-oublie-code.png` });
let mail = await lastMail(t0);
const code = /(\d{6})/.exec(mail.Text)?.[1];
console.log('e-mail :', mail.Subject, '· code trouvé :', Boolean(code));
await app.getByLabel('Code à 6 chiffres reçu par e-mail').fill(code.slice(0, 3) + ' ' + code.slice(3));
await app.getByRole('button', { name: 'Valider le code' }).click();
await app.waitForLoadState('networkidle');
console.log('1. code saisi dans l’app →', new URL(app.url()).pathname);

// 2. Lien ouvert dans un autre navigateur (Safari), après une nouvelle demande faite dans l’app.
const app2 = await (await ctx()).newPage();
t0 = new Date();
await app2.goto(`${BASE}/forgot-password`);
await app2.getByLabel('Adresse e-mail').fill(EMAIL);
await app2.getByRole('button', { name: 'Recevoir un code' }).click();
await app2.getByLabel('Code à 6 chiffres reçu par e-mail').waitFor();
mail = await lastMail(t0);
const link = /href="([^"]*auth\/confirm[^"]*)"/.exec(mail.HTML)?.[1]?.replaceAll('&amp;', '&');
const safari = await (await ctx()).newPage();
await safari.goto(link);
await safari.waitForLoadState('networkidle');
console.log('2. lien ouvert dans un autre navigateur →', new URL(safari.url()).pathname);

// 3. Code faux : message clair, pas de session.
const bad = await (await ctx()).newPage();
await bad.goto(`${BASE}/forgot-password?sent=1`);
await bad.locator('#code-email').fill(EMAIL);
await bad.getByLabel('Code à 6 chiffres reçu par e-mail').fill('000000');
await bad.getByRole('button', { name: 'Valider le code' }).click();
await bad.waitForLoadState('networkidle');
console.log('3. code faux →', new URL(bad.url()).pathname + new URL(bad.url()).search, '·', (await bad.locator('main').textContent())?.includes('Ce code ne correspond pas') ? 'message affiché' : 'MESSAGE ABSENT');
await browser.close();
