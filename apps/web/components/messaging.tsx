'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatVoiceDuration, QUICK_REPLIES, VOICE_MAX_SECONDS } from '@coachos/domain';
import { mutate, newKey } from './api-client';
import { useIntent } from './use-intent';

// Messagerie (CE-H-07, CE-E-02, CE-H-08, CE-H-09, D-033). Tout envoi est un geste explicite.

export interface UiMessage {
  id: string;
  body: string;
  mine: boolean;
  senderName: string;
  fromCoach: boolean;
  voiceId: string | null;
  voiceDurationS: number | null;
  /** Libellés calculés côté serveur dans le bon fuseau (pas d’écart d’affichage). */
  day: string;
  time: string;
  at: number;
  appointment?: UiAppointment | null;
  /** Séance dont parle le message (D-036). */
  workout?: { label: string; href: string | null } | null;
  /** Retour de séance intercalé dans la conversation. */
  event?: { title: string; href: string | null; state: string; rpe: number | null; comment: string | null; reviewed: boolean } | null;
}

export interface UiAppointment {
  id: string; title: string; kind: 'video' | 'call' | 'in_person'; status: 'planned' | 'done' | 'canceled'; videoUrl: string | null;
  durationMin: number; dateLabel: string; time: string; endTime: string; startsAt: string; past: boolean;
}

const KIND = { video: { icon: '🎥', label: 'Appel vidéo' }, call: { icon: '📞', label: 'Appel' }, in_person: { icon: '🤝', label: 'Rendez-vous' } } as const;

/** Fichier agenda (.ics) généré dans le navigateur : rien n’est envoyé à un service tiers. */
function icsHref(a: UiAppointment): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(a.startsAt);
  const end = new Date(start.getTime() + a.durationMin * 60_000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CoachOS//FR', 'BEGIN:VEVENT', `UID:${a.id}@coachos`, `DTSTAMP:${fmt(start)}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${a.title.replace(/[,;\\]/g, ' ')}`,
    ...(a.videoUrl ? [`URL:${a.videoUrl}`, `LOCATION:${a.videoUrl}`] : []), 'END:VEVENT', 'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

/** Carte de rendez-vous dans la conversation : quoi, quand, rejoindre, ajouter à l’agenda. */
function AppointmentBubble({ a }: { a: UiAppointment }) {
  const k = KIND[a.kind];
  const live = a.status === 'planned' && !a.past;
  return (
    <div className={`appt-card${a.status === 'canceled' ? ' canceled' : ''}`}>
      <div className="appt-card-top">
        <span className="appt-card-icon" aria-hidden="true">{k.icon}</span>
        <div>
          <p className="appt-card-kind">{k.label}{a.status === 'canceled' ? ' · annulé' : a.status === 'done' ? ' · fait' : a.past ? ' · passé' : ''}</p>
          <p className="appt-card-title">{a.title}</p>
        </div>
      </div>
      <p className="appt-card-when">{a.dateLabel}<br />{a.time} – {a.endTime} · {a.durationMin} min</p>
      {live ? (
        <div className="appt-card-actions">
          {a.kind === 'video' && a.videoUrl ? <a className="appt-btn primary" href={a.videoUrl} target="_blank" rel="noopener noreferrer">Rejoindre l’appel</a> : null}
          <a className="appt-btn" href={icsHref(a)} download="rendez-vous-coachos.ics">Ajouter à mon agenda</a>
        </div>
      ) : null}
    </div>
  );
}

type Target = { kind: 'direct'; athleteId: string; conversationId: string | null } | { kind: 'team'; teamId: string };

const base = (wid: string) => `/api/v1/workspaces/${wid}`;
const GROUP_GAP = 5 * 60_000; // bulles regroupées si moins de 5 min entre deux messages du même auteur
const STAMP_GAP = 30 * 60_000; // heure affichée au-dessus après 30 min de silence

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Ouvre le fil privé au besoin et renvoie son identifiant. */
async function ensureConversation(wid: string, t: Target): Promise<string | null> {
  if (t.kind !== 'direct') return null;
  if (t.conversationId) return t.conversationId;
  const r = await mutate<{ id: string }>('POST', `${base(wid)}/athletes/${t.athleteId}/conversations`, {}, newKey());
  return r.ok ? r.data.id : null;
}

function sendUrl(wid: string, t: Target, cid: string | null, what: 'messages' | 'voice' | 'receipt') {
  return t.kind === 'team' ? `${base(wid)}/teams/${t.teamId}/${what}` : `${base(wid)}/conversations/${cid}/${what}`;
}

// ---------- Icônes ----------

const Icon = {
  send: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L15 12 3.3 13.9z" /></svg>,
  mic: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11Z" /></svg>,
  play: <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>,
  pause: <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>,
  trash: <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z" /></svg>,
  stop: <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>,
};

/** Lecteur vocal intégré à la bulle : lecture, barre de progression, durée. */
function VoicePlayer({ src, seconds, label }: { src: string; seconds: number; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = seconds || 1;
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };
  return (
    <div className="vp">
      <button type="button" className="vp-btn" onClick={toggle} aria-label={playing ? `Mettre en pause : ${label}` : `Écouter : ${label}`}>{playing ? Icon.pause : Icon.play}</button>
      <div className="vp-track" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className={i / 28 < pos / total ? 'on' : ''} style={{ height: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
      <span className="vp-time">{formatVoiceDuration(Math.round(playing || pos ? Math.max(0, total - pos) : total))}</span>
      <audio ref={audio} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }} onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} />
    </div>
  );
}

/** Texte de message avec adresses web cliquables (http et https seulement). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!/^https?:\/\//.test(p)) return p;
        const url = p.replace(/[.,;:!?)»]+$/, '');
        const rest = p.slice(url.length);
        // Pages de CoachOS (espace élève ou coach) : même onglet ; sites extérieurs : nouvel onglet.
        const internal = /^https?:\/\/[^/]+\/(athlete|coach)\//.test(url);
        return (
          <span key={i}>
            <a className="chat-link" href={url} {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{url}</a>{rest}
          </span>
        );
      })}
    </>
  );
}

/** Fil façon messagerie instantanée : bulles regroupées, avatar de l’autre, heure entre deux échanges espacés. */
export function Thread({ wid, target, messages, showNames, emptyText, otherName, about }: {
  wid: string; target: Target; messages: UiMessage[]; showNames: boolean; emptyText: string; otherName?: string;
  /** Séance dont on veut parler (ouverte depuis la page de la séance). */
  about?: { workoutId: string; label: string } | null;
}) {
  const router = useRouter();
  const list = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  // Seuls les vrais messages portent un accusé de lecture : les retours de séance intercalés (« fb-… ») n’en sont pas.
  const lastMessage = messages.filter((m) => !m.event).at(-1);

  // Défile en bas et marque comme lu le dernier message reçu.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
    if (!lastMessage || lastMessage.mine) return;
    const cid = target.kind === 'direct' ? target.conversationId : null;
    if (target.kind === 'direct' && !cid) return;
    void mutate('PUT', sendUrl(wid, target, cid, 'receipt'), { messageId: lastMessage.id }, newKey()).then((r) => { if (r.ok) router.refresh(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id, lastMessage?.id]);

  // Nouveaux messages : relecture discrète toutes les 15 s quand l’onglet est visible.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 15000);
    return () => clearInterval(t);
  }, [router]);

  const sameAuthor = (a?: UiMessage, b?: UiMessage) => Boolean(a && b && !a.event && !b.event && !b.workout && a.mine === b.mine && a.senderName === b.senderName && Math.abs(b.at - a.at) < GROUP_GAP && a.day === b.day);

  return (
    <div className="chat">
      <div className="chat-list" ref={list} role="log" aria-live="polite" aria-label="Messages">
        {messages.length ? messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const stamp = !prev || prev.day !== m.day || m.at - prev.at > STAMP_GAP;
          const first = stamp || !sameAuthor(prev, m);
          const lastOfGroup = !next || !sameAuthor(m, next) || next.day !== m.day || next.at - m.at > STAMP_GAP;
          if (m.event) {
            const e = m.event;
            return (
              <div key={m.id}>
                {stamp ? <p className="chat-stamp">{m.day} · {m.time}</p> : null}
                <div className="chat-event">
                  <p className="chat-event-head"><span aria-hidden="true">📝</span> Retour de séance</p>
                  <p className="chat-event-title">{e.href ? <a href={e.href}>{e.title}</a> : e.title}</p>
                  <p className="chat-event-meta">{e.state}{e.rpe !== null ? ` · effort ${e.rpe}/10` : ''}{e.reviewed ? ' · traité' : ''}</p>
                  {e.comment ? <p className="chat-event-quote">« {e.comment} »</p> : null}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id}>
              {stamp ? <p className="chat-stamp">{m.day} · {m.time}</p> : null}
              {m.workout ? (
                <p className={`chat-ref${m.mine ? ' mine' : ''}`}>
                  <span aria-hidden="true">↪</span> À propos de : {m.workout.href ? <a href={m.workout.href}>{m.workout.label}</a> : m.workout.label}
                </p>
              ) : null}
              {first && showNames && !m.mine ? <p className="chat-name">{m.senderName}{m.fromCoach ? ' · coach' : ''}</p> : null}
              <div className={`chat-row${m.mine ? ' mine' : ''}${first ? ' first' : ''}${lastOfGroup ? ' last' : ''}`}>
                {!m.mine ? (
                  <span className={`chat-avatar${m.fromCoach ? ' coach' : ''}`} aria-hidden="true">{lastOfGroup ? initialsOf(showNames ? m.senderName : otherName ?? m.senderName) : ''}</span>
                ) : null}
                <div className={`chat-bubble${m.voiceId ? ' voice' : ''}${m.appointment ? ' card' : ''}`} title={`${m.day} · ${m.time}`}>
                  {m.appointment ? <AppointmentBubble a={m.appointment} /> : m.voiceId ? (
                    <VoicePlayer src={`/media/workspaces/${wid}/voice/${m.voiceId}`} seconds={m.voiceDurationS ?? 0}
                      label={`message vocal de ${m.mine ? 'toi' : m.senderName}, ${formatVoiceDuration(m.voiceDurationS ?? 0)}`} />
                  ) : <Linkified text={m.body} />}
                  <span className="visually-hidden"> · {m.mine ? 'envoyé' : `de ${m.senderName}`} à {m.time}</span>
                </div>
              </div>
            </div>
          );
        }) : <p className="chat-empty">{emptyText}</p>}
      </div>
      <Composer wid={wid} target={target} about={about ?? null} />
    </div>
  );
}

/** Barre d’écriture : micro, champ en pastille, envoi. Entrée envoie, Maj + Entrée passe à la ligne. */
function Composer({ wid, target, about }: { wid: string; target: Target; about: { workoutId: string; label: string } | null }) {
  const router = useRouter();
  const { run, pending, error, setError } = useIntent<{ item: { id: string } }>();
  const [text, setText] = useState('');
  const [context, setContext] = useState(about);
  const [opening, setOpening] = useState(false);
  const [recording, setRecording] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Le champ grandit avec le texte (5 lignes au plus).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  async function send() {
    if (!text.trim() || pending || opening) return;
    setOpening(true);
    const cid = await ensureConversation(wid, target);
    setOpening(false);
    if (target.kind === 'direct' && !cid) { setError({ ok: false, kind: 'network' }); return; }
    const ok = await run('POST', sendUrl(wid, target, cid, 'messages'), { body: text, workoutId: context?.workoutId ?? null });
    if (ok) { setText(''); setContext(null); router.refresh(); area.current?.focus(); }
  }

  return (
    <div className="chat-composer">
      {error ? <p className="field-error" role="alert">{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Ton message est conservé : réessaie.'}</p> : null}
      {context ? (
        <p className="chat-context"><span aria-hidden="true">↪</span> À propos de : <strong>{context.label}</strong>
          <button type="button" className="chat-context-x" onClick={() => setContext(null)} aria-label="Ne plus citer cette séance">✕</button></p>
      ) : null}
      <div className="chat-bar">
        <VoiceRecorder wid={wid} target={target} onActive={setRecording} />
        {!recording ? (
          <>
            <label className="visually-hidden" htmlFor="msg-text">Ton message</label>
            <textarea id="msg-text" ref={area} rows={1} maxLength={2000} placeholder="Aa" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
            <button type="button" className="chat-icon send" disabled={pending || opening || !text.trim()} onClick={() => void send()} aria-label="Envoyer le message">{Icon.send}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Enregistreur : micro → barre d’enregistrement → réécoute → envoyer ou jeter. Arrêt automatique à 3 minutes. */
function VoiceRecorder({ wid, target, onActive }: { wid: string; target: Target; onActive: (on: boolean) => void }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'recording' | 'ready' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; s: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { onActive(state !== 'idle'); }, [state, onActive]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function start() {
    setError(null);
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setError('Ton navigateur ne permet pas d’enregistrer un vocal.'); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Micro refusé. Autorise le micro pour ce site dans ton navigateur, puis réessaie.');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    const chunks: BlobPart[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const s = Math.max(1, Math.min(VOICE_MAX_SECONDS, Math.round((Date.now() - started.current) / 1000)));
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      setClip({ blob, url: URL.createObjectURL(blob), s });
      setState('ready');
    };
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    r.start();
    setState('recording');
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= VOICE_MAX_SECONDS) stop();
    }, 250);
  }

  function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  function discard() {
    if (state === 'recording') { if (rec.current) rec.current.onstop = () => rec.current?.stream.getTracks().forEach((t) => t.stop()); stop(); }
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setState('idle');
  }

  async function send() {
    if (!clip) return;
    setState('sending');
    setError(null);
    const cid = await ensureConversation(wid, target);
    if (target.kind === 'direct' && !cid) { setError('Connexion perdue. Réessaie.'); setState('ready'); return; }
    try {
      const res = await fetch(`${sendUrl(wid, target, cid, 'voice')}?seconds=${clip.s}`, {
        method: 'POST', body: clip.blob, credentials: 'same-origin', headers: { 'content-type': clip.blob.type.split(';')[0] || 'application/octet-stream' },
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: { rule: string }[] } } | null;
        setError(p?.error?.fields?.[0]?.rule ?? p?.error?.message ?? 'Envoi impossible. Réessaie.');
        setState('ready');
        return;
      }
    } catch {
      setError('Connexion perdue. Ton vocal est conservé : réessaie.');
      setState('ready');
      return;
    }
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setState('idle');
    router.refresh();
  }

  if (state === 'idle') {
    return (
      <>
        <button type="button" className="chat-icon" onClick={() => void start()} aria-label="Enregistrer un message vocal" title="Message vocal">{Icon.mic}</button>
        {error ? <span className="field-error chat-error" role="alert">{error}</span> : null}
      </>
    );
  }
  return (
    <div className="rec-bar">
      <button type="button" className="chat-icon" onClick={discard} aria-label="Jeter le vocal" disabled={state === 'sending'}>{Icon.trash}</button>
      {state === 'recording' ? (
        <div className="rec-pill">
          <span className="rec-dot" aria-hidden="true" />
          <span role="status">{formatVoiceDuration(seconds)} / 3:00</span>
          <button type="button" className="rec-stop" onClick={stop} aria-label="Arrêter l’enregistrement">{Icon.stop}</button>
        </div>
      ) : clip ? (
        <div className="rec-pill preview"><VoicePlayer src={clip.url} seconds={clip.s} label="ton vocal" /></div>
      ) : null}
      <button type="button" className="chat-icon send" onClick={() => void send()} disabled={state !== 'ready'} aria-label="Envoyer le vocal">{Icon.send}</button>
      {error ? <span className="field-error chat-error" role="alert">{error}</span> : null}
    </div>
  );
}

/** Réponse rapide sous un retour (CE-H-08) : envoyée seulement sur le geste du coach. */
export function QuickReply({ wid, athleteId, first, workoutId }: { wid: string; athleteId: string; first: string; workoutId?: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: string) {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const cid = await ensureConversation(wid, { kind: 'direct', athleteId, conversationId: null });
    const r = cid ? await mutate('POST', `${base(wid)}/conversations/${cid}/messages`, { body, workoutId: workoutId ?? null }, newKey()) : null;
    setBusy(false);
    if (r?.ok) { setSent(body); setText(''); } else setError('Envoi impossible. Réessaie.');
  }

  return (
    <div className="quick-reply">
      <p className="muted">Répondre à {first} en un geste : le message part seulement quand tu cliques.</p>
      <div className="chips-row">
        {QUICK_REPLIES.map((q) => <button key={q} type="button" className="btn small" disabled={busy} onClick={() => void send(q)}>{q}</button>)}
      </div>
      <div className="inline-form">
        <label className="visually-hidden" htmlFor="qr-text">Ta réponse</label>
        <input id="qr-text" className="input" maxLength={2000} placeholder="Ou écris ta réponse…" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn primary small" disabled={busy || !text.trim()} onClick={() => void send(text)}>Envoyer</button>
      </div>
      {sent ? <p role="status" className="banner ok">Envoyé à {first} : « {sent} ». <a href={`/coach/${wid}/messages/${athleteId}`}>Voir la conversation</a></p> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
