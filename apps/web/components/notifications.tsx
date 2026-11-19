'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EMAIL_PREFERENCES, EMAIL_PREFERENCE_LABELS, type EmailPreference, type NotificationKind } from '@coachos/domain';
import { useIntent } from './use-intent';

// D-067 : centre de notifications (C25-08) et réglage des e-mails (C25-01). Aucun contenu de message.

const ICON: Record<NotificationKind, string> = { workouts_published: '📅', message: '💬', feedback: '✅', bilan_submitted: '📝' };

const when = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

export function NotificationList({ wid, items, timeZone }: {
  wid: string; timeZone: string;
  items: { id: string; kind: NotificationKind; text: string; createdAt: string; read: boolean }[];
}) {
  const router = useRouter();
  const all = useIntent<unknown>();
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="stack">
      <div className="actions">
        <span className="muted">{unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu.'}</span>
        {unread ? <button type="button" className="btn small" disabled={all.pending}
          onClick={async () => { if (await all.run('POST', `/api/v1/workspaces/${wid}/notifications/read-all`, {})) router.refresh(); }}>Tout marquer lu</button> : null}
      </div>
      {items.length ? (
        <ul className="plain notif-list">
          {items.map((n) => (
            <li key={n.id} className={`notif${n.read ? '' : ' unread'}`}>
              <a href={`/n/${wid}/${n.id}`}>
                <span className="notif-icon" aria-hidden="true">{ICON[n.kind]}</span>
                <span className="notif-text">{n.text}{n.read ? null : <span className="visually-hidden"> (non lue)</span>}</span>
                <span className="muted notif-when">{when(n.createdAt, timeZone)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="empty">Aucune notification pour l’instant.</p>}
    </div>
  );
}

export function NotificationSettings({ wid, email }: { wid: string; email: EmailPreference }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [value, setValue] = useState(email);
  const [saved, setSaved] = useState(false);
  return (
    <fieldset className="choice notif-settings">
      <legend>E-mails</legend>
      {EMAIL_PREFERENCES.map((p) => (
        <label key={p}><input type="radio" name="notif-email" checked={value === p} disabled={pending}
          onChange={async () => {
            setValue(p); setSaved(false);
            if (await run('PUT', `/api/v1/workspaces/${wid}/notification-settings`, { email: p })) { setSaved(true); router.refresh(); }
          }} /> {EMAIL_PREFERENCE_LABELS[p]}</label>
      ))}
      <p className="muted">Les e-mails ne contiennent jamais le texte d’un message : seulement ce qui s’est passé et un lien. Les invitations et la sécurité du compte restent toujours envoyées.</p>
      {saved ? <p className="muted" role="status">Réglage enregistré.</p> : null}
      {error ? <p className="field-error" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</p> : null}
    </fieldset>
  );
}
