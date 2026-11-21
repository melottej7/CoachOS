import { AppError } from '../errors';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type Mailer = (message: EmailMessage) => Promise<void>;

const globalForMail = globalThis as unknown as { __coachosMailer?: Mailer };

/** Tests : remplacer l’envoi par une capture en mémoire. */
export function setMailer(mailer: Mailer | undefined): void {
  globalForMail.__coachosMailer = mailer;
}

/**
 * Adaptateur d’envoi. Développement : API d’envoi de Mailpit (Supabase local), aucun e-mail réel.
 * Production : Resend (RESEND_API_KEY, EMAIL_FROM), branché à la mise en ligne (D-112) ; sans clé, refus explicite.
 * Ne journalise jamais le destinataire ni le contenu (le lien contient un secret).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (globalForMail.__coachosMailer) return globalForMail.__coachosMailer(message);
  // D-112 : production, fournisseur Resend dès que la clé et l’expéditeur sont fournis (mise en ligne).
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return sendWithResend(message, process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  const mailpit = process.env.MAILPIT_URL;
  if (!mailpit || process.env.NODE_ENV === 'production') {
    throw new AppError('TEMPORARILY_UNAVAILABLE', 'L’envoi d’e-mails n’est pas configuré sur cet environnement.');
  }
  let res: Response;
  try {
    res = await fetch(`${mailpit}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: 'no-reply@coachos.test', Name: 'CoachOS' },
        To: [{ Email: message.to }],
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
      }),
    });
  } catch {
    throw new AppError('TEMPORARILY_UNAVAILABLE', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
  }
  if (!res.ok) {
    console.warn(JSON.stringify({ module: 'email', code: 'send_failed', status: res.status }));
    throw new AppError('TEMPORARILY_UNAVAILABLE', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function invitationEmail(to: string, workspaceName: string, link: string, days: number, coachName: string | null = null, tagline: string | null = null): EmailMessage {
  const subject = coachName ? `${coachName} t’invite à rejoindre ${workspaceName} sur CoachOS` : `Invitation à rejoindre ${workspaceName} sur CoachOS`;
  const who = coachName ? `${coachName} t’invite` : 'Ton coach t’invite';
  const text = [
    'Bonjour,',
    '',
    `${who} à rejoindre l’espace « ${workspaceName} » sur CoachOS pour retrouver tes séances et lui envoyer tes retours.`,
    ...(tagline ? ['', `« ${tagline} »`] : []),
    '',
    `Rejoindre l’espace : ${link}`,
    '',
    `Ce lien est personnel, valable ${days} jours et utilisable une seule fois. Tu y choisiras ton mot de passe (ou tu te connecteras si tu as déjà un compte avec cette adresse).`,
    'Si tu ne connais pas ce coach, ignore simplement cet e-mail.',
  ].join('\n');
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f2f5f4;font-family:Inter,system-ui,sans-serif;color:#162e37">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d8e2df;border-radius:10px"><tr><td style="padding:24px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800">CoachOS</p>
<p style="margin:0 0 16px;font-size:16px;line-height:24px">Bonjour,</p>
<p style="margin:0 0 20px;font-size:16px;line-height:24px">${esc(who)} à rejoindre l’espace <strong>${esc(workspaceName)}</strong> sur CoachOS pour retrouver tes séances et lui envoyer tes retours.</p>
${tagline ? `<p style="margin:0 0 20px;font-size:15px;line-height:22px;font-style:italic;color:#50646a">« ${esc(tagline)} »</p>` : ''}
<p style="margin:0 0 24px"><a href="${esc(link)}" style="display:inline-block;background:#0a6452;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Rejoindre l’espace</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:18px;color:#50646a">Ce lien est personnel, valable ${days} jours et utilisable une seule fois. Tu y choisiras ton mot de passe (ou tu te connecteras si tu as déjà un compte avec cette adresse).</p>
<p style="margin:0;font-size:13px;line-height:18px;color:#50646a">Si tu ne connais pas ce coach, ignore simplement cet e-mail.</p>
</td></tr></table></body></html>`;
  return { to, subject, text, html };
}

/** Envoi par l’API de Resend (une requête par e-mail). Rien n’est journalisé hormis le statut en cas d’échec. */
async function sendWithResend(message: EmailMessage, key: string, from: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
  } catch {
    throw new AppError('TEMPORARILY_UNAVAILABLE', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
  }
  if (!res.ok) {
    console.warn(JSON.stringify({ module: 'email', provider: 'resend', code: 'send_failed', status: res.status }));
    throw new AppError('TEMPORARILY_UNAVAILABLE', 'L’e-mail n’a pas pu être envoyé. Réessaie dans un instant.');
  }
}

