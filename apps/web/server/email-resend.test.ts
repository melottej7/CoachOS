import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from './email/send';
import { AppError } from './errors';

// D-112 : envoi par Resend en production (clé et expéditeur fournis), sans journaliser le contenu.

const msg = { to: 'eleve@exemple.test', subject: 'Invitation', text: 'Lien', html: '<p>Lien</p>' };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('envoi d’e-mails', () => {
  it('Resend : une requête avec la clé, l’expéditeur et le message', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('EMAIL_FROM', 'CoachOS <bonjour@coachos.test>');
    const fetchMock = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendEmail(msg);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test_123');
    expect(JSON.parse(String(init.body))).toEqual({ from: 'CoachOS <bonjour@coachos.test>', to: ['eleve@exemple.test'], subject: 'Invitation', text: 'Lien', html: '<p>Lien</p>' });
  });

  it('refus du fournisseur : erreur lisible, sans le contenu dans le journal', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('EMAIL_FROM', 'bonjour@coachos.test');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 422 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(sendEmail(msg)).rejects.toBeInstanceOf(AppError);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('eleve@exemple.test');
    warn.mockRestore();
  });

  it('production sans clé : refus explicite', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(sendEmail(msg)).rejects.toBeInstanceOf(AppError);
  });
});
