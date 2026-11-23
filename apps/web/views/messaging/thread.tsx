'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatVoiceDuration, VOICE_MAX_SECONDS } from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { useIntent } from '@/components/use-intent';
import type { UiAppointment, UiMessage } from '@/components/messaging';
import { AnchorButton, Avatar, Icon, IconButton, Text } from '@/design';
import { cx } from '@/design/cx';
import s from './thread.module.css';

// Messagerie (CE-H-07, CE-E-02, CE-H-08, CE-H-09, D-033), refonte Chrono (D-135). Tout envoi est un geste explicite.

type Target = { kind: 'direct'; athleteId: string; conversationId: string | null } | { kind: 'team'; teamId: string };

const base = (wid: string) => `/api/v1/workspaces/${wid}`;
const GROUP_GAP = 5 * 60_000; // bulles regroupées si moins de 5 min entre deux messages du même auteur
const STAMP_GAP = 30 * 60_000; // heure affichée au-dessus après 30 min de silence
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

async function ensureConversation(wid: string, t: Target): Promise<string | null> {
  if (t.kind !== 'direct') return null;
  if (t.conversationId) return t.conversationId;
  const r = await mutate<{ id: string }>('POST', `${base(wid)}/athletes/${t.athleteId}/conversations`, {}, newKey());
  return r.ok ? r.data.id : null;
}

function sendUrl(wid: string, t: Target, cid: string | null, what: 'messages' | 'voice' | 'receipt') {
  return t.kind === 'team' ? `${base(wid)}/teams/${t.teamId}/${what}` : `${base(wid)}/conversations/${cid}/${what}`;
}

const KIND = { video: { icon: 'monitor', label: 'Appel vidéo' }, call: { icon: 'chat', label: 'Appel' }, in_person: { icon: 'users', label: 'Rendez-vous' } } as const;

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

function AppointmentCard({ a }: { a: UiAppointment }) {
  const k = KIND[a.kind];
  const live = a.status === 'planned' && !a.past;
  return (
    <div className={cx(s.appt, a.status === 'canceled' && s.apptCanceled)}>
      <div className={s.apptTop}>
        <span className={s.apptIcon} aria-hidden="true"><Icon name={k.icon} size={20} /></span>
        <div>
          <p className={s.apptKind}>{k.label}{a.status === 'canceled' ? ' · annulé' : a.status === 'done' ? ' · fait' : a.past ? ' · passé' : ''}</p>
          <p className={s.apptTitle}>{a.title}</p>
        </div>
      </div>
      <p className={s.apptWhen}>{a.dateLabel}<br />{a.time} – {a.endTime} · {a.durationMin} min</p>
      {live ? (
        <div className={s.apptActions}>
          {a.kind === 'video' && a.videoUrl ? <AnchorButton href={a.videoUrl} target="_blank" rel="noopener noreferrer" variant="coach" size="sm" icon="monitor">Rejoindre l’appel</AnchorButton> : null}
          <AnchorButton href={icsHref(a)} download="rendez-vous-coachos.ics" size="sm" icon="calendar">Ajouter à mon agenda</AnchorButton>
        </div>
      ) : null}
    </div>
  );
}

/** Lecteur vocal intégré à la bulle : lecture, barre de progression, durée. */
function VoicePlayer({ src, seconds, label }: { src: string; seconds: number; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = seconds || 1;
  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); };
  return (
    <div className={s.voice}>
      <button type="button" className={s.voiceBtn} onClick={toggle} aria-label={playing ? `Mettre en pause : ${label}` : `Écouter : ${label}`}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <div className={s.voiceTrack} aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className={i / 28 < pos / total ? s.voiceOn : undefined} style={{ blockSize: `${30 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
      <span className={s.voiceTime}>{formatVoiceDuration(Math.round(playing || pos ? Math.max(0, total - pos) : total))}</span>
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
        const internal = /^https?:\/\/[^/]+\/(athlete|coach)\//.test(url);
        return <span key={i}><a className={s.link} href={url} {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{url}</a>{rest}</span>;
      })}
    </>
  );
}

/** Fil façon messagerie instantanée : bulles regroupées, avatar de l’autre, heure entre deux échanges espacés. */
export function Thread({ wid, target, messages, showNames, emptyText, otherName, about }: {
  wid: string; target: Target; messages: UiMessage[]; showNames: boolean; emptyText: string; otherName?: string;
  about?: { workoutId: string; label: string } | null;
}) {
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  const lastMessage = messages.filter((m) => !m.event).at(-1);

  // Amène le dernier message en vue et marque comme lu le dernier message reçu.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
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
    <div className={s.chat}>
      <div className={s.list} role="log" aria-live="polite" aria-label="Messages">
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
                {stamp ? <p className={s.stamp}>{m.day} · {m.time}</p> : null}
                <div className={s.event}>
                  <p className={s.eventHead}><Icon name="flag" size={14} /> Retour de séance{e.reviewed ? ' · traité' : ''}</p>
                  <p className={s.eventTitle}>{e.href ? <a href={e.href}>{e.title}</a> : e.title}</p>
                  <p className={s.eventMeta}>{e.state}{e.rpe !== null ? ` · effort ${e.rpe}/10` : ''}</p>
                  {e.comment ? <p className={s.eventQuote}>« {e.comment} »</p> : null}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id}>
              {stamp ? <p className={s.stamp}>{m.day} · {m.time}</p> : null}
              {m.workout ? (
                <p className={cx(s.ref, m.mine && s.refMine)}>
                  <Icon name="arrowRight" size={14} /> À propos de : {m.workout.href ? <a href={m.workout.href}>{m.workout.label}</a> : m.workout.label}
                </p>
              ) : null}
              {first && showNames && !m.mine ? <p className={s.name}>{m.senderName}{m.fromCoach ? ' · coach' : ''}</p> : null}
              <div className={cx(s.row, m.mine && s.mine, first && s.first, lastOfGroup && s.last)}>
                {!m.mine ? (
                  <span className={s.avatarSlot} aria-hidden="true">{lastOfGroup ? <Avatar name={showNames ? m.senderName : otherName ?? m.senderName} coach={m.fromCoach} size={28} /> : null}</span>
                ) : null}
                <div className={cx(s.bubble, m.voiceId && s.bubbleVoice, m.appointment && s.bubbleCard)} title={`${m.day} · ${m.time}`}>
                  {m.appointment ? <AppointmentCard a={m.appointment} /> : m.voiceId ? (
                    <VoicePlayer src={`/media/workspaces/${wid}/voice/${m.voiceId}`} seconds={m.voiceDurationS ?? 0}
                      label={`message vocal de ${m.mine ? 'toi' : m.senderName}, ${formatVoiceDuration(m.voiceDurationS ?? 0)}`} />
                  ) : <Linkified text={m.body} />}
                  <span className="ds-visually-hidden"> · {m.mine ? 'envoyé' : `de ${m.senderName}`} à {m.time}</span>
                </div>
              </div>
            </div>
          );
        }) : <p className={s.empty}>{emptyText}</p>}
        <div ref={end} />
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

  // Brouillon préparé ailleurs (ex. faisabilité de l’objectif, D-057) : repris une fois, jamais envoyé seul.
  useEffect(() => {
    if (target.kind !== 'direct') return;
    try {
      const key = `coachos:draft:${target.athleteId}`;
      const d = sessionStorage.getItem(key);
      if (d) { setText(d); sessionStorage.removeItem(key); area.current?.focus(); }
    } catch { /* stockage indisponible : rien à reprendre */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le champ grandit avec le texte (5 lignes au plus).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight ne compte pas les bordures : sans elles, une barre de défilement apparaît dès la première ligne.
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 120)}px`;
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
    <div className={s.composer}>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.fields[0]?.rule ?? error.message : 'Connexion perdue. Ton message est conservé : réessaie.'}</Text> : null}
      {context ? (
        <p className={s.context}><Icon name="arrowRight" size={14} /> <span>À propos de : <strong>{context.label}</strong></span>
          <IconButton icon="close" size="sm" label="Ne plus citer cette séance" onClick={() => setContext(null)} /></p>
      ) : null}
      <div className={s.bar}>
        <VoiceRecorder wid={wid} target={target} onActive={setRecording} />
        {!recording ? (
          <>
            <label className="ds-visually-hidden" htmlFor="msg-text">Ton message</label>
            <textarea id="msg-text" ref={area} className={s.input} rows={1} maxLength={2000} placeholder="Écris ton message" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
            <button type="button" className={cx(s.round, s.send)} disabled={pending || opening || !text.trim()} onClick={() => void send()} aria-label="Envoyer le message">
              <Icon name="send" size={20} />
            </button>
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
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
      setError('Micro refusé. Autorise le micro pour ce site dans ton navigateur, puis réessaie.');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    const chunks: BlobPart[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const sec = Math.max(1, Math.min(VOICE_MAX_SECONDS, Math.round((Date.now() - started.current) / 1000)));
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      setClip({ blob, url: URL.createObjectURL(blob), s: sec });
      setState('ready');
    };
    rec.current = r;
    started.current = Date.now();
    setSeconds(0);
    r.start();
    setState('recording');
    timer.current = setInterval(() => {
      const sec = Math.round((Date.now() - started.current) / 1000);
      setSeconds(sec);
      if (sec >= VOICE_MAX_SECONDS) stop();
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
        <button type="button" className={s.round} onClick={() => void start()} aria-label="Enregistrer un message vocal" title="Message vocal"><Icon name="mic" size={20} /></button>
        {error ? <Text size="sm" tone="danger" role="alert" className={s.recError}>{error}</Text> : null}
      </>
    );
  }
  return (
    <div className={s.rec}>
      <button type="button" className={s.round} onClick={discard} aria-label="Jeter le vocal" disabled={state === 'sending'}><Icon name="trash" size={20} /></button>
      {state === 'recording' ? (
        <div className={s.recPill}>
          <span className={s.recDot} aria-hidden="true" />
          <span role="status" className={s.recTime}>{formatVoiceDuration(seconds)} / 3:00</span>
          <button type="button" className={s.recStop} onClick={stop} aria-label="Arrêter l’enregistrement"><span aria-hidden="true" /></button>
        </div>
      ) : clip ? (
        <div className={s.recPill}><VoicePlayer src={clip.url} seconds={clip.s} label="ton vocal" /></div>
      ) : null}
      <button type="button" className={cx(s.round, s.send)} onClick={() => void send()} disabled={state !== 'ready'} aria-label="Envoyer le vocal"><Icon name="send" size={20} /></button>
      {error ? <Text size="sm" tone="danger" role="alert" className={s.recError}>{error}</Text> : null}
    </div>
  );
}
