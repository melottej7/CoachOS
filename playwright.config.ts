import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * D-125 · Tests de bout en bout dans un vrai navigateur. Serveur de développement isolé : port 3100, base PGlite neuve
 * avec le jeu fictif (dossier .data/e2e-pglite, effacé à chaque lancement), aucune variable Supabase, e-mail ou IA.
 * Ni Supabase local ni la base en ligne ne sont jamais touchés.
 */
const PORT = 3100;
const dataDir = path.join(root, '.data', 'e2e-pglite');

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-BE',
    timezoneId: 'Europe/Brussels',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `rm -rf "${dataDir}" && npx next dev --port ${PORT}`,
    cwd: path.join(root, 'apps', 'web'),
    url: `http://localhost:${PORT}/demo`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      COACHOS_DEMO_AUTH: '1',
      COACHOS_PGLITE_DIR: dataDir,
      COACHOS_DIST_DIR: '.next-e2e',
      // Vides : Next ne les remplace pas par celles de .env.local, l’app repasse en mode démonstration.
      DATABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      MAILPIT_URL: '',
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
      ANTHROPIC_API_KEY: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
