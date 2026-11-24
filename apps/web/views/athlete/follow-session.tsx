'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  announce, describeIntensity, describeMeasure, exerciseKey, followSequence, formatElapsed, PHASE_LABELS, reminderAt, setLabel,
  type Block, type Exercise, type FollowStep, type LastDone, type Sport,
} from '@coachos/domain';
import { Button, Cluster, Disclosure, Eyebrow, Heading, Icon, IconButton, LinkButton, Stack, Text, ZoneChip, type ZoneLevel } from '@/design';
import { cx } from '@/design/cx';
import { ExerciseMedia } from './exercise-howto';
import s from './follow-session.module.css';

/** Ce qui a été noté pendant la séance, par étape du mode « Suivre » (D-096, M4). */
export type FollowLog = Record<number, { reps: number | null; kg: number | null }>;
export const followLogKey = (sid: string) => `coachos:suivre:${sid}:series`;
export function readFollowLog(sid: string): FollowLog {
  try { const v = JSON.parse(localStorage.getItem(followLogKey(sid)) ?? '{}') as unknown; return v && typeof v === 'object' ? (v as FollowLog) : {}; } catch { return {}; }
}

// ---------- D-166 · Chronomètre de séance (gardé sur ce téléphone : il survit à un rechargement) ----------

interface ClockState { startedAt: number | null; pausedAt: number | null; pausedMs: number; endedAt: number | null }
const NO_CLOCK: ClockState = { startedAt: null, pausedAt: null, pausedMs: 0, endedAt: null };
export const followClockKey = (sid: string) => `coachos:suivre:${sid}:chrono`;
function readClock(sid: string): ClockState {
  try {
    const v = JSON.parse(localStorage.getItem(followClockKey(sid)) ?? 'null') as Partial<ClockState> | null;
    return v && typeof v.startedAt === 'number' ? { ...NO_CLOCK, ...v } : NO_CLOCK;
  } catch { return NO_CLOCK; }
}
const elapsedOf = (c: ClockState, now: number) => (c.startedAt ? Math.max(0, (c.endedAt ?? c.pausedAt ?? now) - c.startedAt - c.pausedMs) : 0);
/** Durée mesurée par le chronomètre de « Suivre », pour préremplir le retour (null si la séance n’a pas été suivie). */
export function readFollowElapsed(sid: string): number | null {
  const c = readClock(sid);
  return c.startedAt ? elapsedOf(c, Date.now()) : null;
}

function useSessionClock(sid: string) {
  const [c, setC] = useState<ClockState>(NO_CLOCK);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setC(readClock(sid)); }, [sid]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const save = useCallback((next: ClockState) => {
    setC(next);
    setNow(Date.now());
    try { localStorage.setItem(followClockKey(sid), JSON.stringify(next)); } catch { /* stockage indisponible */ }
  }, [sid]);
  return {
    started: c.startedAt !== null, paused: c.pausedAt !== null, ended: c.endedAt !== null, elapsed: elapsedOf(c, now),
    start: () => { if (c.startedAt === null) save({ ...NO_CLOCK, startedAt: Date.now() }); },
    pause: () => { if (c.startedAt !== null && c.pausedAt === null && c.endedAt === null) save({ ...c, pausedAt: Date.now() }); },
    resume: () => { if (c.pausedAt !== null) save({ ...c, pausedAt: null, pausedMs: c.pausedMs + Date.now() - c.pausedAt }); },
    end: () => {
      if (c.startedAt === null || c.endedAt !== null) return;
      const t = Date.now();
      save({ ...c, pausedAt: null, pausedMs: c.pausedMs + (c.pausedAt !== null ? t - c.pausedAt : 0), endedAt: t });
    },
    reset: () => save(NO_CLOCK),
  };
}

// ---------- D-166 · Sons et voix ----------

interface Prefs { sound: boolean; voice: boolean }
const PREFS_KEY = 'coachos:suivre:reglages';
let audio: AudioContext | null = null;
let voiceReady = false;

/** Le son et la voix ne sont permis qu’après un geste de l’élève (règle des téléphones) : on les prépare au premier toucher. */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio?.state === 'suspended') void audio.resume();
  } catch { /* son indisponible */ }
  try {
    if (!voiceReady && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      voiceReady = true;
    }
  } catch { /* voix indisponible */ }
}

function beep(freq: number, ms: number, delay = 0) {
  if (!audio) return;
  try {
    const t = audio.currentTime + delay;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.01);
    g.gain.setValueAtTime(0.2, t + ms / 1000 - 0.03);
    g.gain.linearRampToValueAtTime(0, t + ms / 1000);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch { /* son indisponible */ }
}
/** Trois sons distincts : décompte, départ, fin d’effort. */
const SOUNDS = {
  tick: () => beep(660, 110),
  go: () => { beep(880, 120); beep(1320, 280, 0.15); },
  end: () => { beep(988, 150); beep(988, 150, 0.22); beep(1319, 360, 0.44); },
};
type SoundName = keyof typeof SOUNDS;

function say(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.05;
    const fr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('fr'));
    if (fr) u.voice = fr;
    synth.speak(u);
  } catch { /* voix indisponible */ }
}

interface Cues { sound: (n: SoundName) => void; voice: (t: string) => void }

function usePrefs(): [Prefs, (p: Prefs) => void] {
  const [prefs, setPrefs] = useState<Prefs>({ sound: true, voice: true });
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null; if (v) setPrefs({ sound: v.sound !== false, voice: v.voice !== false }); } catch { /* défauts */ }
  }, []);
  return [prefs, (p) => { setPrefs(p); try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* stockage indisponible */ } }];
}

// ---------- Écran ----------

const isRest = (f: FollowStep) => f.step.phase === 'rest' || f.step.phase === 'recovery';
const zoneOf = (f: FollowStep): ZoneLevel => (f.step.intensity.kind === 'zone' ? Math.max(1, Math.min(7, f.step.intensity.zone)) as ZoneLevel : 0);

/**
 * D-096 (M3) · Suivre la séance sur téléphone (refonte Chrono, D-133) : une étape par écran, en très grand —
 * l’exercice, sa vidéo, la série en cours, puis le repos chronométré qui démarre seul.
 * D-166 : chronomètre de séance avec pause, bips (3-2-1, départ, fin), voix qui annonce chaque étape, réglages gardés.
 * La position, les séries notées et le chronomètre restent sur ce téléphone pour reprendre plus tard.
 */
export function FollowSession({ wid, sid, title, blocks, exercises, backHref, feedbackHref, lastDone = {} }: {
  wid: string; sid: string; title: string; sport: Sport; blocks: Block[];
  exercises: Record<string, Exercise>; backHref: string; feedbackHref: string | null;
  /** D-112 : ce que l’élève a fait la dernière fois, par exercice. */
  lastDone?: Record<string, LastDone>;
}) {
  const seq = useMemo(() => followSequence(blocks), [blocks]);
  const storeKey = `coachos:suivre:${sid}`;
  const [i, setI] = useState(0);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(storeKey)); if (Number.isInteger(v) && v > 0 && v <= seq.length) setI(v); } catch { /* stockage indisponible */ }
    setRestored(true);
  }, [storeKey, seq.length]);
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(storeKey, String(i)); } catch { /* stockage indisponible */ }
  }, [i, restored, storeKey]);
  useWakeLock();
  // D-096 (M4) : ce que l’élève a vraiment fait, série par série, gardé sur ce téléphone jusqu’à son retour.
  const [log, setLog] = useState<FollowLog>({});
  useEffect(() => { setLog(readFollowLog(sid)); }, [sid]);
  const note = (index: number, v: { reps: number | null; kg: number | null }) => setLog((l) => {
    const next = { ...l, [index]: v };
    try { localStorage.setItem(followLogKey(sid), JSON.stringify(next)); } catch { /* stockage indisponible */ }
    return next;
  });

  const clock = useSessionClock(sid);
  const [prefs, setPrefs] = usePrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const cues = useMemo<Cues>(() => ({
    sound: (n) => {
      if (prefsRef.current.sound) SOUNDS[n]();
      try { navigator.vibrate?.(n === 'tick' ? 60 : n === 'go' ? [120, 60, 120] : [200, 100, 200, 100, 300]); } catch { /* indisponible */ }
    },
    voice: (t) => { if (prefsRef.current.voice) say(t); },
  }), []);

  const done = i >= seq.length;
  const go = (n: number) => setI(Math.max(0, Math.min(seq.length, n)));
  const { end: endClock, started } = clock;
  useEffect(() => {
    if (!done || !restored) return;
    if (started) { endClock(); cues.voice('Séance terminée. Bravo !'); cues.sound('end'); }
    // À la fin seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, restored]);
  // Premier geste : prépare le son et la voix, lance le chronomètre de séance.
  const onFirstTouch = (e: MouseEvent<HTMLElement>) => {
    if (!(e.target as HTMLElement).closest('button')) return;
    unlockAudio();
    if (!done) clock.start();
  };
  if (!seq.length) return <Text muted>Cette séance n’a pas de déroulé à suivre.</Text>;

  return (
    <Stack gap={4} onClickCapture={onFirstTouch}>
      <Cluster between nowrap>
        <LinkButton href={backHref} variant="ghost" size="sm" icon="close">Quitter</LinkButton>
        <Cluster gap={2} nowrap align="center">
          <span className={cx(s.elapsed, !clock.started && s.idle)} aria-label={`Temps de séance : ${formatElapsed(clock.elapsed)}`}>
            <Icon name="clock" size={16} />{formatElapsed(clock.elapsed)}
          </span>
          {clock.started && !done ? (
            <IconButton icon={clock.paused ? 'play' : 'pause'} label={clock.paused ? 'Reprendre la séance' : 'Mettre la séance en pause'} variant="secondary" size="sm"
              onClick={clock.paused ? clock.resume : clock.pause} />
          ) : null}
        </Cluster>
      </Cluster>
      <div className={s.bar} role="progressbar" aria-label="Avancement de la séance" aria-valuemin={0} aria-valuemax={seq.length} aria-valuenow={i}>
        <span className={s.barFill} style={{ inlineSize: `${(i / seq.length) * 100}%` }} />
      </div>
      <Cluster between align="center">
        <Text size="sm" muted tabular>{done ? 'Terminé' : `Étape ${i + 1} sur ${seq.length}`}</Text>
        <Cluster gap={1} nowrap>
          <Button size="sm" variant={prefs.sound ? 'secondary' : 'ghost'} icon={prefs.sound ? 'volume' : 'volumeOff'} aria-pressed={prefs.sound}
            onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}>Bips</Button>
          <Button size="sm" variant={prefs.voice ? 'secondary' : 'ghost'} icon="speech" aria-pressed={prefs.voice}
            onClick={() => { if (prefs.voice) window.speechSynthesis?.cancel(); setPrefs({ ...prefs, voice: !prefs.voice }); }}>Voix</Button>
        </Cluster>
      </Cluster>
      {done ? (
        <section className={cx(s.card, s.end)} aria-live="polite">
          <span className={s.endMark} aria-hidden="true"><Icon name="check" size={40} /></span>
          <Heading level={2} size={2}>Séance terminée, bravo !</Heading>
          <Text muted>{title}</Text>
          {clock.started ? <p className={s.total}><span>Durée</span>{formatElapsed(clock.elapsed)}</p> : null}
          <Stack gap={2} className={s.actions}>
            {feedbackHref ? <LinkButton href={feedbackHref} variant="coach" size="lg" block>Donner mon retour</LinkButton> : <Text size="sm" muted>Tu pourras donner ton retour à partir du jour de la séance.</Text>}
            <Button variant="ghost" block onClick={() => { clock.reset(); go(0); }}>Recommencer</Button>
          </Stack>
        </section>
      ) : (
        <>
          {clock.paused ? (
            <section className={cx(s.card, s.paused)} aria-live="polite">
              <Heading level={2} size={3}>Séance en pause</Heading>
              <Text muted>Le chronomètre est arrêté. Reprends quand tu es prêt·e.</Text>
              <Button variant="coach" size="lg" icon="play" block onClick={clock.resume}>Reprendre</Button>
            </section>
          ) : null}
          <StepScreen key={i} wid={wid} f={seq[i]!} prev={seq[i - 1] ?? null} next={seq[i + 1] ?? null} exercises={exercises} logged={log[i]} lastDone={lastDone}
            paused={clock.paused} started={clock.started} elapsed={clock.elapsed} cues={cues}
            onLog={(v) => note(i, v)} onNext={() => go(i + 1)} onPrev={i > 0 ? () => go(i - 1) : null} />
        </>
      )}
    </Stack>
  );
}

function StepScreen({ wid, f, prev, next, exercises, logged, onLog, onNext, onPrev, lastDone, paused, started, elapsed, cues }: {
  wid: string; f: FollowStep; prev: FollowStep | null; next: FollowStep | null; exercises: Record<string, Exercise>; lastDone: Record<string, LastDone>;
  logged?: { reps: number | null; kg: number | null }; onLog: (v: { reps: number | null; kg: number | null }) => void;
  onNext: () => void; onPrev: (() => void) | null;
  paused: boolean; started: boolean; elapsed: number; cues: Cues;
}) {
  const st = f.step;
  const ex = st.exercise?.id ? exercises[st.exercise.id] : undefined;
  const rest = isRest(f);
  const timed = st.measure.kind === 'time' ? st.measure.seconds : null;
  const stage = f.stage;
  const name = stage?.name ?? st.exercise?.name ?? (rest ? 'Repos' : PHASE_LABELS[st.phase]);
  const zone = zoneOf(f);
  // Une étape chronométrée montre sa durée dans le chrono, pas deux fois ; la zone a sa pastille.
  // D-164 : un palier de cardio montre ses réglages en grand (« niveau 2 · 60 tr/min »).
  const target = stage ? stage.settings : [timed ? null : describeMeasure(st.measure), st.intensity.kind === 'zone' ? null : describeIntensity(st.intensity)].filter(Boolean).join(' · ');
  const sets = [setLabel(f.sets), stage && stage.n > 1 ? `Palier ${stage.k} sur ${stage.n}` : null].filter(Boolean).join(' · ') || null;
  // D-165 : des séries en temps (6 × 20 s de planche, 40 s de récupération) s’enchaînent comme une minuterie :
  // la fin de l’effort lance la récupération, la fin de la récupération lance la série suivante. La première se lance au doigt.
  const sameRound = (a: FollowStep | null) => Boolean(a && a.sets.length && a.sets.length === f.sets.length);
  const seriesTimed = !rest && !stage && timed !== null && f.sets.length > 0;
  const chained = Boolean(stage && stage.k > 1) || (seriesTimed && sameRound(prev) && isRest(prev!) && (f.sets[f.sets.length - 1]?.k ?? 1) > 1);
  const chainNext = Boolean(stage && stage.k < stage.n) || (seriesTimed && sameRound(next) && isRest(next!));
  const last = !rest && st.exercise ? lastDone[exerciseKey(st.exercise.id, st.exercise.name)] : undefined;
  const media = !rest && ex ? ExerciseMedia({ wid, exercise: ex }) : null;
  const phrase = announce(f, next);

  // D-166 : la voix annonce l’étape dès qu’elle s’affiche (une fois la séance lancée) ; sinon au départ du chrono.
  const announced = useRef(false);
  useEffect(() => {
    if (started && !announced.current) { announced.current = true; cues.voice(phrase); }
    // À l’arrivée sur l’étape seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onStart = () => { if (!announced.current) { announced.current = true; cues.voice(phrase); } };

  // D-166 : temps passé sur une étape sans chrono (répétitions, distance, libre).
  const [since, setSince] = useState<number | null>(started ? elapsed : null);
  useEffect(() => { if (since === null && started) setSince(elapsed); }, [since, started, elapsed]);

  return (
    <section className={cx(s.card, rest && s.rest)} data-zone={zone || undefined} aria-labelledby="fw-name">
      <p className="ds-visually-hidden" aria-live="polite">{phrase}</p>
      <Stack gap={2}>
        {sets && !rest ? <Eyebrow tone="coach">{sets}</Eyebrow> : rest ? <Eyebrow>Récupère</Eyebrow> : null}
        <Cluster gap={3} align="center" nowrap>
          {zone ? <ZoneChip zone={zone} size="lg" /> : null}
          <h2 id="fw-name" className={s.name}>{name}</h2>
        </Cluster>
        {target ? <p className={s.target}>{target}</p> : null}
        {st.note ? <Text muted>{st.note}</Text> : null}
        {last ? <Text size="sm">La dernière fois : <strong>{last.text}</strong></Text> : null}
      </Stack>
      {timed ? (
        <Countdown seconds={timed} auto={rest || chained} rest={rest} advance={rest || chainNext} paused={paused} cues={cues}
          endSound={rest || (stage && stage.k < stage.n) ? 'go' : 'end'} onStart={onStart} onEnd={onNext} />
      ) : since !== null ? (
        <p className={s.since} aria-label={`Depuis ${formatElapsed(elapsed - since)} sur cette étape`}><Icon name="clock" size={16} />{formatElapsed(elapsed - since)}</p>
      ) : null}
      {media || ex?.instructions ? (
        <Stack gap={2}>
          {media}
          {ex?.instructions ? (
            <Disclosure summary="Consignes" open={!media}><Text prose size="sm" muted>{ex.instructions}</Text></Disclosure>
          ) : null}
        </Stack>
      ) : null}
      {!rest && st.exercise && st.measure.kind === 'reps' ? (
        <DoneInputs planned={{ reps: st.measure.reps, kg: st.intensity.kind === 'load' ? st.intensity.min : null }} value={logged} onChange={onLog} />
      ) : null}
      {paused ? null : (
        <Stack gap={2} className={s.actions}>
          <Cluster gap={2} nowrap grow>
            {onPrev ? <Button size="lg" icon="chevronLeft" onClick={onPrev} aria-label="Étape précédente" className={s.prev} /> : null}
            {/* Étape chronométrée : le chrono est l’action principale, « Suivant » passe au second plan. */}
            <Button size="lg" variant={timed && !rest ? 'secondary' : 'coach'} icon={rest || timed ? undefined : 'check'} iconRight={rest || timed ? 'chevronRight' : undefined} onClick={onNext}>
              {rest ? 'Passer le repos' : timed ? 'Suivant' : 'Fait, suivant'}
            </Button>
          </Cluster>
          {next ? (
            <Text size="sm" muted>Ensuite : {next.stage && next.stage.k > 1 ? `palier ${next.stage.k}` : next.stage?.name ?? next.step.exercise?.name ?? (isRest(next) ? 'repos' : PHASE_LABELS[next.step.phase].toLowerCase())}{next.step.measure.kind !== 'open' ? ` · ${describeMeasure(next.step.measure)}` : ''}{next.stage?.settings ? ` · ${next.stage.settings}` : ''}</Text>
          ) : <Text size="sm" muted>Dernière étape.</Text>}
        </Stack>
      )}
    </section>
  );
}

/**
 * Compte à rebours fondé sur l’heure de fin (juste même si le téléphone met la page en pause).
 * D-166 : bips sur les 3 dernières secondes, son de départ et de fin, rappel vocal, pause de la séance respectée.
 */
function Countdown({ seconds, auto, rest, advance = rest, paused, cues, endSound, onStart, onEnd }: {
  seconds: number; auto: boolean; rest: boolean; advance?: boolean; paused: boolean; cues: Cues; endSound: SoundName; onStart: () => void; onEnd: () => void;
}) {
  const [endAt, setEndAt] = useState<number | null>(auto && !paused ? Date.now() + seconds * 1000 : null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  const lastLeft = useRef(seconds);
  // Départ au doigt : son de départ. Départ enchaîné : le son a déjà retenti à la fin de l’étape précédente.
  const begin = () => { setEndAt(Date.now() + seconds * 1000); cues.sound('go'); onStart(); };
  // Pause de la séance : on fige le temps restant, on le rend à la reprise.
  useEffect(() => {
    if (paused && endAt !== null) { setFrozen(Math.max(0, endAt - Date.now())); setEndAt(null); }
    else if (!paused && frozen !== null) { setEndAt(Date.now() + frozen); setFrozen(null); }
    // Seulement quand la pause change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(l);
      if (l !== lastLeft.current) {
        lastLeft.current = l;
        if (l > 0 && l <= 3) cues.sound('tick');
        const r = reminderAt(seconds, l);
        if (r) cues.voice(r);
      }
      if (l === 0 && !ended.current) {
        ended.current = true;
        cues.sound(endSound);
        // Fin du repos ou d’un palier qui en a un autre après : on enchaîne ; fin d’un effort chronométré : l’élève confirme.
        if (advance) setTimeout(onEnd, 600);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [endAt, advance, onEnd, seconds, cues, endSound]);
  const shown = frozen !== null ? Math.ceil(frozen / 1000) : left;
  const running = endAt !== null || frozen !== null;
  const ratio = running ? shown / seconds : 1;
  return (
    <div className={s.timer}>
      <p className={s.clock} aria-live={shown === 0 ? 'assertive' : 'off'} role="timer">
        {shown === 0 ? (rest ? 'C’est reparti !' : advance ? 'Palier suivant' : 'Terminé !') : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`}
      </p>
      <div className={s.timerBar} aria-hidden="true"><span style={{ inlineSize: `${ratio * 100}%` }} /></div>
      {!running ? (
        <Button variant="primary" size="lg" icon="play" onClick={begin}>Démarrer le chrono</Button>
      ) : shown > 0 && !paused ? (
        <Button size="sm" variant="secondary" onClick={() => setEndAt((e) => (e ?? Date.now()) + 15_000)}>+15 s</Button>
      ) : null}
    </div>
  );
}

/** Garde l’écran allumé pendant la séance quand le navigateur le permet (https). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const ask = () => { nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => undefined); };
    ask();
    const again = () => { if (document.visibilityState === 'visible') ask(); };
    document.addEventListener('visibilitychange', again);
    return () => { document.removeEventListener('visibilitychange', again); void lock?.release().catch(() => undefined); };
  }, []);
}

/** « Fait : 10 rép. · 16 kg », prérempli avec le prévu ; l’élève corrige s’il a fait moins ou plus. */
function DoneInputs({ planned, value, onChange }: { planned: { reps: number; kg: number | null }; value?: { reps: number | null; kg: number | null }; onChange: (v: { reps: number | null; kg: number | null }) => void }) {
  const v = value ?? { reps: planned.reps, kg: planned.kg };
  const num = (t: string, max: number, step = 1) => (t.trim() === '' ? null : Math.max(0, Math.min(max, Math.round(Number(t.replace(',', '.')) / step) * step)));
  const changed = v.reps !== planned.reps || v.kg !== planned.kg;
  return (
    <div className={s.done}>
      <span className={s.doneLabel}>Fait</span>
      <label className={s.unit}>
        <input className={s.num} type="number" inputMode="numeric" min={0} max={500} value={v.reps ?? ''} aria-label="Répétitions faites"
          onChange={(e) => onChange({ ...v, reps: num(e.target.value, 500) })} />
        <span aria-hidden="true">rép.</span>
      </label>
      {planned.kg !== null || v.kg !== null ? (
        <label className={s.unit}>
          <input className={s.num} type="number" inputMode="decimal" min={0} max={500} step={0.5} value={v.kg ?? ''} aria-label="Charge utilisée en kg"
            onChange={(e) => onChange({ ...v, kg: num(e.target.value, 500, 0.5) })} />
          <span aria-hidden="true">kg</span>
        </label>
      ) : null}
      {changed ? <Button size="sm" variant="ghost" onClick={() => onChange({ reps: planned.reps, kg: planned.kg })}>Comme prévu</Button> : null}
    </div>
  );
}
