'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import {
  announce, announceExercise, describeIntensity, describeMeasure, exerciseKey, followExercises, followGate, followSequence, followStart, formatElapsed,
  lastSetLabel, PHASE_LABELS, reminderAt, setLabel,
  type Block, type Exercise, type FollowExercise, type FollowStep, type LastDone, type Sport,
} from '@coachos/domain';
import { Button, Cluster, Disclosure, Eyebrow, Heading, Icon, IconButton, LinkButton, Stack, Text, ZoneChip, type ZoneLevel } from '@/design';
import { cx } from '@/design/cx';
import { ExerciseMedia } from './exercise-howto';
import {
  elapsedOf, followClockKey, followGateKey, followLogKey, followPosKey, followSkipKey, keep, NO_CLOCK, readClock, readFollowLog, readGate, readPos, readRun, readSkipped, writeRun,
  type ClockState, type FollowLog, type Gate, type Run,
} from './follow-store';
import s from './follow-session.module.css';

// ---------- D-166 · Chronomètre de séance (gardé sur ce téléphone : il survit à un rechargement) ----------

function useSessionClock(sid: string) {
  const [c, setC] = useState<ClockState>(NO_CLOCK);
  // D-172 : un même toucher peut lancer puis mettre en pause (fin d’un exercice) ; chaque geste lit l’état le plus récent.
  const cur = useRef<ClockState>(NO_CLOCK);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const v = readClock(sid); cur.current = v; setC(v); }, [sid]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const save = useCallback((next: ClockState) => {
    cur.current = next;
    setC(next);
    setNow(Date.now());
    keep(followClockKey(sid), next);
  }, [sid]);
  const pausedFor = c.pausedAt !== null && c.endedAt === null ? Math.max(0, now - c.pausedAt) : 0;
  return {
    started: c.startedAt !== null, paused: c.pausedAt !== null, ended: c.endedAt !== null, elapsed: elapsedOf(c, now),
    /** D-172 : depuis quand la séance est en pause, et le total des pauses (non comptées dans la durée). */
    pausedFor, pauses: c.pausedMs + pausedFor, pausedAt: c.endedAt === null ? c.pausedAt : null,
    start: () => { if (cur.current.startedAt === null) save({ ...NO_CLOCK, startedAt: Date.now() }); },
    pause: () => { const v = cur.current; if (v.startedAt !== null && v.pausedAt === null && v.endedAt === null) save({ ...v, pausedAt: Date.now() }); },
    resume: () => { const v = cur.current; if (v.pausedAt !== null) save({ ...v, pausedAt: null, pausedMs: v.pausedMs + Date.now() - v.pausedAt }); },
    end: () => {
      const v = cur.current;
      if (v.startedAt === null || v.endedAt !== null) return;
      const t = Date.now();
      save({ ...v, pausedAt: null, pausedMs: v.pausedMs + (v.pausedAt !== null ? t - v.pausedAt : 0), endedAt: t });
    },
    /** D-167 : terminée par erreur → la séance revient en pause, au temps où elle s’était arrêtée. */
    reopen: () => { const v = cur.current; if (v.endedAt !== null) save({ ...v, pausedAt: v.endedAt, endedAt: null }); },
    reset: () => save(NO_CLOCK),
  };
}

// ---------- D-166 · Sons et voix ----------

interface Prefs { sound: boolean; voice: boolean }
const PREFS_KEY = 'coachos:suivre:reglages';
let audio: AudioContext | null = null;
let voiceReady = false;

/** Le son et la voix ne sont permis qu’après un geste de l’élève (règle des téléphones) : on les prépare à chaque toucher. */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    if (audio && audio.state !== 'running') void audio.resume().catch(() => undefined);
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
    g.gain.linearRampToValueAtTime(0.35, t + 0.01);
    g.gain.setValueAtTime(0.35, t + ms / 1000 - 0.03);
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
  return [prefs, (p) => { setPrefs(p); keep(PREFS_KEY, p); }];
}

/**
 * Garde l’écran allumé pendant la séance quand le navigateur le permet (https) ; redemandé au retour sur la page
 * et à chaque toucher, car certains téléphones ne l’accordent qu’après un geste. Le son reprend au retour.
 */
function useAwake(): () => void {
  const lock = useRef<{ released: boolean; release: () => Promise<void> } | null>(null);
  const ask = useCallback(() => {
    if (lock.current && !lock.current.released) return;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ released: boolean; release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => { lock.current = l; }).catch(() => undefined);
  }, []);
  useEffect(() => {
    ask();
    const again = () => {
      if (document.visibilityState !== 'visible') return;
      ask();
      if (audio && audio.state !== 'running') void audio.resume().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', again);
    return () => { document.removeEventListener('visibilitychange', again); void lock.current?.release().catch(() => undefined); };
  }, [ask]);
  return ask;
}

// ---------- Écran ----------

const isRest = (f: FollowStep) => f.step.phase === 'rest' || f.step.phase === 'recovery';
const zoneOf = (f: FollowStep): ZoneLevel => (f.step.intensity.kind === 'zone' ? Math.max(1, Math.min(7, f.step.intensity.zone)) as ZoneLevel : 0);
const nameOf = (f: FollowStep) => f.stage?.name ?? f.step.exercise?.name ?? (isRest(f) ? 'Repos' : PHASE_LABELS[f.step.phase]);
/** « Série 2 sur 6 · 20 s », « Palier 2 sur 4 · 7 min · niveau 2 ». */
const detailOf = (f: FollowStep) => [
  f.stage ? `Palier ${f.stage.k} sur ${f.stage.n}` : isRest(f) ? null : setLabel(f.sets),
  f.step.measure.kind === 'open' ? null : describeMeasure(f.step.measure),
  f.stage ? f.stage.settings || null : describeIntensity(f.step.intensity) || null,
].filter(Boolean).join(' · ');

/**
 * D-096 (M3) · Suivre la séance sur téléphone (refonte Chrono, D-133) : une étape par écran, en très grand —
 * l’exercice, sa vidéo, la série en cours, puis le repos chronométré qui démarre seul.
 * D-166 : chronomètre de séance avec pause, bips (3-2-1, départ, fin), voix qui annonce chaque étape, réglages gardés.
 * D-167 : séries et circuits en temps enchaînés comme une minuterie, mise en place de 5 s, minuterie retrouvée après
 * un rechargement, « À suivre » pendant le repos, déroulé pour sauter à une étape, « Quitter » met en pause.
 * D-172 : suivre malgré les péripéties. Entre deux exercices, un écran attend l’élève (pause de séance, à son rythme) ;
 * la pause est toujours sous le pouce et la reprise redonne 5 s de mise en place ; un chrono fini passe à la suite ;
 * dernière série annoncée, mi-chemin encouragé, pauses non comptées dans la durée.
 * La position, les séries notées et le chronomètre restent sur ce téléphone pour reprendre plus tard.
 */
export function FollowSession({ wid, sid, title, blocks, exercises, backHref, feedbackHref, lastDone = {} }: {
  wid: string; sid: string; title: string; sport: Sport; blocks: Block[];
  exercises: Record<string, Exercise>; backHref: string; feedbackHref: string | null;
  /** D-112 : ce que l’élève a fait la dernière fois, par exercice. */
  lastDone?: Record<string, LastDone>;
}) {
  const seq = useMemo(() => followSequence(blocks), [blocks]);
  const parts = useMemo(() => followExercises(seq), [seq]);
  const partOf = (n: number) => parts.findIndex((p) => n >= p.first && n <= p.last);
  const [i, setI] = useState(0);
  // D-172 : l’écran entre deux exercices, gardé pour être retrouvé après un rechargement ; au tout début, la séance s’y ouvre.
  const [gate, setGate] = useState<Gate | null>(null);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const v = readPos(sid);
    const at = v <= seq.length ? v : 0;
    setI(at);
    const g = readGate(sid);
    const fresh = at === 0 && readClock(sid).startedAt === null;
    setGate(g && g.at === at ? g : fresh && seq[0] && followGate(null, seq[0]) ? { at: 0, after: null } : null);
    setRestored(true);
  }, [sid, seq]);
  useEffect(() => { if (restored) keep(followPosKey(sid), String(i)); }, [i, restored, sid]);
  useEffect(() => { if (restored) keep(followGateKey(sid), gate); }, [gate, restored, sid]);
  const [skipped, setSkipped] = useState<number[]>([]);
  useEffect(() => { setSkipped(readSkipped(sid)); }, [sid]);
  const markSkipped = (k: number, on: boolean) => setSkipped((list) => {
    const next = on ? [...new Set([...list, k])].sort((a, b) => a - b) : list.filter((x) => x !== k);
    keep(followSkipKey(sid), next.length ? next : null);
    return next;
  });
  const keepAwake = useAwake();
  // D-096 (M4) : ce que l’élève a vraiment fait, série par série, gardé sur ce téléphone jusqu’à son retour.
  const [log, setLog] = useState<FollowLog>({});
  useEffect(() => { setLog(readFollowLog(sid)); }, [sid]);
  const note = (index: number, v: { reps: number | null; kg: number | null }) => setLog((l) => {
    const next = { ...l, [index]: v };
    keep(followLogKey(sid), next);
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
  // Changer d’étape oublie la minuterie de l’étape quittée ; seul un rechargement la retrouve.
  // « flow » : on avance dans le fil (un effort enchaîné part seul, un nouvel exercice attend l’élève) ;
  // « ready » : l’élève vient de dire qu’il est prêt (5 s de mise en place puis départ) ; « manual » : retour ou saut.
  const [entry, setEntry] = useState<Entry>('manual');
  const go = (n: number, o: { flow?: boolean; after?: string | null; gate?: boolean } = {}) => {
    writeRun(sid, i, null);
    const to = Math.max(0, Math.min(seq.length, n));
    const f = seq[to];
    const gated = Boolean(f && (o.gate ?? (o.flow && followGate(seq[to - 1], f))));
    // Entre deux exercices, la séance est en pause : la durée ne compte que le temps d’exercice.
    if (gated) clock.pause();
    setGate(gated ? { at: to, after: o.after ?? null } : null);
    setEntry(o.flow ? 'flow' : 'manual');
    setI(to);
  };
  const advance = () => {
    clock.start();
    const k = partOf(i);
    const p = parts[k];
    if (p && p.last === i) markSkipped(k, false);
    go(i + 1, { flow: true, after: p && p.last === i ? p.name : null });
  };
  const ready = () => { clock.start(); clock.resume(); setGate(null); setEntry('ready'); };
  const skipPart = () => {
    markSkipped(partOf(i), true);
    const nextPart = parts[partOf(i) + 1];
    go(nextPart ? nextPart.first : seq.length, { flow: true, gate: Boolean(nextPart) });
  };
  const { end: endClock, started } = clock;
  useEffect(() => {
    if (!done || !restored) return;
    if (started) { endClock(); cues.voice('Séance terminée. Bravo !'); cues.sound('end'); }
    // À la fin seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, restored]);
  // Chaque toucher sur un bouton prépare le son et la voix et redemande l’écran allumé ; la séance démarre au premier effort.
  const onTouch = (e: MouseEvent<HTMLElement>) => {
    if (!(e.target as HTMLElement).closest('button')) return;
    unlockAudio();
    keepAwake();
  };
  const outline = useRef<HTMLDialogElement>(null);
  if (!seq.length) return <Text muted>Cette séance n’a pas de déroulé à suivre.</Text>;

  return (
    <Stack gap={4} onClickCapture={onTouch}>
      <Cluster between nowrap>
        {/* Quitter met la séance en pause : le chronomètre ne tourne pas pendant l’absence. */}
        <LinkButton href={backHref} variant="ghost" size="sm" icon="close" onClick={() => clock.pause()}>Quitter</LinkButton>
        <span className={cx(s.elapsed, (!clock.started || (clock.paused && !done)) && s.idle)}
          aria-label={`Temps de séance : ${formatElapsed(clock.elapsed)}${clock.paused && !done ? ', en pause' : ''}`}>
          <Icon name={clock.paused && !done ? 'pause' : 'clock'} size={16} />{formatElapsed(clock.elapsed)}
        </span>
      </Cluster>
      <div className={s.bar} role="progressbar" aria-label="Avancement de la séance" aria-valuemin={0} aria-valuemax={seq.length} aria-valuenow={i}>
        <span className={s.barFill} style={{ inlineSize: `${(i / seq.length) * 100}%` }} />
      </div>
      <Cluster between align="center" nowrap>
        <Button size="sm" variant="ghost" icon="list" aria-haspopup="dialog" className={s.where}
          onClick={() => { outline.current?.showModal(); outline.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'center' }); }}>
          {done ? 'Terminé' : `Étape ${i + 1} sur ${seq.length}`}
        </Button>
        <Cluster gap={1} nowrap>
          <Button size="sm" variant={prefs.sound ? 'secondary' : 'ghost'} icon={prefs.sound ? 'volume' : 'volumeOff'} aria-pressed={prefs.sound}
            onClick={() => setPrefs({ ...prefs, sound: !prefs.sound })}>Bips</Button>
          <Button size="sm" variant={prefs.voice ? 'secondary' : 'ghost'} icon="speech" aria-pressed={prefs.voice}
            onClick={() => { if (prefs.voice) window.speechSynthesis?.cancel(); setPrefs({ ...prefs, voice: !prefs.voice }); }}>Voix</Button>
        </Cluster>
      </Cluster>
      <Outline dialog={outline} seq={seq} current={i} onPick={(n) => go(n)} />
      {!restored ? null : done ? (
        <section className={cx(s.card, s.end)} aria-live="polite">
          <span className={s.endMark} aria-hidden="true"><Icon name="check" size={40} /></span>
          <Heading level={2} size={2}>Séance terminée, bravo !</Heading>
          <Text muted>{title}</Text>
          {clock.started ? <p className={s.total}><span>Durée</span>{formatElapsed(clock.elapsed)}</p> : null}
          {clock.started && clock.pauses >= 1000 ? <Text size="sm" muted>Pauses non comptées : {formatElapsed(clock.pauses)}</Text> : null}
          {skipped.length ? (
            <Text size="sm">{skipped.length > 1 ? 'Exercices passés' : 'Exercice passé'} : <strong>{skipped.map((k) => parts[k]?.name).filter(Boolean).join(', ')}</strong>. Dis-le à ton coach dans ton retour.</Text>
          ) : null}
          <Stack gap={2} className={s.actions}>
            {feedbackHref ? <LinkButton href={feedbackHref} variant="coach" size="lg" block>Donner mon retour</LinkButton> : <Text size="sm" muted>Tu pourras donner ton retour à partir du jour de la séance.</Text>}
            <Button variant="ghost" block icon="chevronLeft" onClick={() => { clock.reopen(); go(seq.length - 1); }}>Revenir à la dernière étape</Button>
            <Button variant="ghost" block onClick={() => { clock.reset(); setSkipped([]); keep(followSkipKey(sid), null); go(0, { gate: true }); }}>Recommencer</Button>
          </Stack>
        </section>
      ) : gate && gate.at === i && parts[partOf(i)] ? (
        <GateScreen key={`pret-${i}`} wid={wid} f={seq[i]!} part={parts[partOf(i)]!} k={partOf(i) + 1} n={parts.length} seq={seq} after={gate.after}
          exercises={exercises} lastDone={lastDone} started={clock.started} pausedFor={clock.pausedFor} cues={cues} speak={entry === 'flow'}
          onGo={ready} onSkip={skipPart} onPrev={i > 0 ? () => go(i - 1) : null} />
      ) : (
        <StepScreen key={i} wid={wid} sid={sid} f={seq[i]!} prev={seq[i - 1] ?? null} next={seq[i + 1] ?? null} exercises={exercises} logged={log[i]} lastDone={lastDone}
          paused={clock.paused} pausedAt={clock.pausedAt} pausedFor={clock.pausedFor} started={clock.started} elapsed={clock.elapsed} cues={cues} onBegin={clock.start} entry={entry}
          onPause={clock.pause} onResume={clock.resume} onLog={(v) => note(i, v)} onNext={advance} onPrev={i > 0 ? () => go(i - 1) : null} />
      )}
    </Stack>
  );
}

/** D-167 · Le déroulé de la séance : ce qui est fait, l’étape en cours, ce qui vient ; toucher une étape y va. */
function Outline({ dialog, seq, current, onPick }: { dialog: RefObject<HTMLDialogElement | null>; seq: FollowStep[]; current: number; onPick: (n: number) => void }) {
  const close = () => dialog.current?.close();
  return (
    <dialog ref={dialog} className={s.outline} aria-labelledby="fw-outline" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={s.outlineHead}>
        <h2 id="fw-outline" className={s.outlineTitle}>Déroulé</h2>
        <IconButton icon="close" label="Fermer le déroulé" onClick={close} />
      </div>
      <ol className={s.outlineList}>
        {seq.map((f, k) => (
          <li key={k}>
            <button type="button" className={cx(s.row, isRest(f) && s.rowRest, k < current && s.rowDone)} aria-current={k === current ? 'step' : undefined}
              onClick={() => { close(); if (k !== current) onPick(k); }}>
              <span className={s.rowMark} aria-hidden="true">{k < current ? <Icon name="check" size={16} /> : k + 1}</span>
              <span className={s.rowText}>
                <span className={s.rowName}>{nameOf(f)}</span>{' '}
                {detailOf(f) ? <span className={s.rowDetail}>{detailOf(f)}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </dialog>
  );
}

type Entry = 'manual' | 'flow' | 'ready';

function StepScreen({ wid, sid, f, prev, next, exercises, logged, onLog, onNext, onPrev, onBegin, onPause, onResume, entry, lastDone, paused, pausedAt, pausedFor, started, elapsed, cues }: {
  wid: string; sid: string; f: FollowStep; prev: FollowStep | null; next: FollowStep | null; exercises: Record<string, Exercise>; lastDone: Record<string, LastDone>;
  logged?: { reps: number | null; kg: number | null }; onLog: (v: { reps: number | null; kg: number | null }) => void;
  onNext: () => void; onPrev: (() => void) | null; onBegin: () => void; onPause: () => void; onResume: () => void; entry: Entry;
  paused: boolean; pausedAt: number | null; pausedFor: number; started: boolean; elapsed: number; cues: Cues;
}) {
  const st = f.step;
  const ex = st.exercise?.id ? exercises[st.exercise.id] : undefined;
  const rest = isRest(f);
  const timed = st.measure.kind === 'time' ? st.measure.seconds : null;
  const stage = f.stage;
  const name = nameOf(f);
  const zone = zoneOf(f);
  // Une étape chronométrée montre sa durée dans le chrono, pas deux fois ; la zone a sa pastille.
  // D-164 : un palier de cardio montre ses réglages en grand (« niveau 2 · 60 tr/min »).
  const target = stage ? stage.settings : [timed ? null : describeMeasure(st.measure), st.intensity.kind === 'zone' ? null : describeIntensity(st.intensity)].filter(Boolean).join(' · ');
  const sets = [setLabel(f.sets), stage && stage.n > 1 ? `Palier ${stage.k} sur ${stage.n}` : null].filter(Boolean).join(' · ') || null;
  const lastOne = lastSetLabel(f);
  // D-165 · D-167 · D-172 : le repos part toujours seul ; par le fil, un effort enchaîné part seul, un effort après des
  // répétitions ou après « C’est parti » part après 5 s de mise en place ; revenir ou sauter à une étape laisse l’élève lancer.
  const how = rest ? 'auto' : entry === 'ready' ? 'lead' : entry === 'flow' ? followStart(prev, f) : 'idle';
  const start: CountStart = how === 'auto' || how === 'lead' ? how : 'idle';
  // Un chrono fini passe toujours à la suite : l’effort suivant, le repos, l’écran entre deux exercices ou la fin.
  const nextHow = next ? followStart(f, next) : null;
  const toEffort = nextHow === 'auto' && next !== null && !isRest(next);
  const endSound: SoundName | null = !next ? null : toEffort ? 'go' : 'end';
  const endText = !next ? 'Terminé !' : nextHow === 'gate' ? 'Bravo !' : rest ? 'C’est reparti !' : stage && next.stage ? 'Palier suivant'
    : toEffort ? (next.step.exercise?.name === st.exercise?.name ? 'Série suivante' : 'Exercice suivant') : 'Terminé !';
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
  const onStart = () => { onBegin(); if (!announced.current) { announced.current = true; cues.voice(phrase); } };

  // D-166 : temps passé sur une étape sans chrono (répétitions, distance, libre).
  const [since, setSince] = useState<number | null>(started ? elapsed : null);
  useEffect(() => { if (since === null && started) setSince(elapsed); }, [since, started, elapsed]);

  return (
    <section className={cx(s.card, rest && s.rest)} data-zone={zone || undefined} aria-labelledby="fw-name">
      <p className="ds-visually-hidden" aria-live="polite">{phrase}</p>
      <Stack gap={2}>
        {sets && !rest ? (
          <Cluster gap={2} align="center">
            <Eyebrow tone="coach">{sets}</Eyebrow>
            {lastOne ? <span className={s.lastOne}>{lastOne} !</span> : null}
          </Cluster>
        ) : rest ? <Eyebrow>Récupère</Eyebrow> : null}
        <Cluster gap={3} align="center" nowrap>
          {zone ? <ZoneChip zone={zone} size="lg" /> : null}
          <h2 id="fw-name" className={s.name}>{name}</h2>
        </Cluster>
        {target ? <p className={s.target}>{target}</p> : null}
        {st.note ? <Text muted>{st.note}</Text> : null}
        {last ? <Text size="sm">La dernière fois : <strong>{last.text}</strong></Text> : null}
      </Stack>
      {timed ? (
        <Countdown sid={sid} index={f.index} seconds={timed} start={start} lead={!rest} paused={paused} pausedAt={pausedAt} cues={cues}
          endSound={endSound} endText={endText} onStart={onStart} onEnd={onNext} />
      ) : since !== null ? (
        <p className={s.since} aria-label={`Depuis ${formatElapsed(elapsed - since)} sur cette étape`}><Icon name="clock" size={16} />{formatElapsed(elapsed - since)}</p>
      ) : null}
      {rest && next ? <UpNext f={next} /> : null}
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
      {paused ? (
        // D-172 : la pause se lève au même endroit, sous le pouce ; l’étape reste visible, son chrono figé.
        <Stack gap={2} className={cx(s.actions, s.pausePanel)} aria-live="polite">
          <Cluster between align="center" nowrap>
            <Heading level={3} size={4}>Séance en pause</Heading>
            <span className={s.pausedFor} aria-label={`En pause depuis ${formatElapsed(pausedFor)}`}><Icon name="pause" size={14} />{formatElapsed(pausedFor)}</span>
          </Cluster>
          <Text size="sm" muted>{timed && !rest ? 'Le chrono attend. À la reprise, 5 secondes pour te remettre en place, puis il repart.' : 'Le chronomètre est arrêté. Reprends quand tu es prêt·e.'}</Text>
          <Button variant="coach" size="lg" icon="play" block onClick={onResume}>Reprendre</Button>
        </Stack>
      ) : (
        <Stack gap={2} className={s.actions}>
          <Cluster gap={2} nowrap grow>
            {onPrev ? <Button size="lg" icon="chevronLeft" onClick={onPrev} aria-label="Étape précédente" className={s.square} /> : null}
            {/* D-172 : pause toujours à portée de pouce, une fois la séance lancée. */}
            {started ? <Button size="lg" icon="pause" onClick={onPause} aria-label="Mettre la séance en pause" className={s.square} /> : null}
            {/* Étape chronométrée : le chrono est l’action principale, « Suivant » passe au second plan. */}
            <Button size="lg" variant={timed && !rest ? 'secondary' : 'coach'} icon={rest || timed ? undefined : 'check'} iconRight={rest || timed ? 'chevronRight' : undefined} onClick={onNext}>
              {rest ? 'Passer le repos' : timed ? 'Suivant' : 'Fait, suivant'}
            </Button>
          </Cluster>
          {rest ? null : next ? (
            <Text size="sm" muted>Ensuite : {next.stage && next.stage.k > 1 ? `palier ${next.stage.k}` : isRest(next) ? 'repos' : nameOf(next)}{next.step.measure.kind !== 'open' ? ` · ${describeMeasure(next.step.measure)}` : ''}{next.stage?.settings ? ` · ${next.stage.settings}` : ''}</Text>
          ) : <Text size="sm" muted>Dernière étape.</Text>}
        </Stack>
      )}
    </section>
  );
}

/**
 * D-172 · Entre deux exercices (et au début de la séance) : bravo pour celui qui finit, ce qui vient en grand, la pause
 * qui court. L’élève prend son temps (boire, aller aux toilettes, changer de machine) et lance quand il est prêt :
 * 5 s de mise en place, puis le chrono part. Le chronomètre de séance est en pause pendant ce temps.
 */
function GateScreen({ wid, f, part, k, n, seq, after, exercises, lastDone, started, pausedFor, cues, speak, onGo, onSkip, onPrev }: {
  wid: string; f: FollowStep; part: FollowExercise; k: number; n: number; seq: FollowStep[]; after: string | null;
  exercises: Record<string, Exercise>; lastDone: Record<string, LastDone>; started: boolean; pausedFor: number; cues: Cues;
  speak: boolean; onGo: () => void; onSkip: () => void; onPrev: (() => void) | null;
}) {
  const st = f.step;
  const ex = st.exercise?.id ? exercises[st.exercise.id] : undefined;
  const media = ex ? ExerciseMedia({ wid, exercise: ex }) : null;
  const last = st.exercise ? lastDone[exerciseKey(st.exercise.id, st.exercise.name)] : undefined;
  const zone = zoneOf(f);
  const stages = f.stage ? seq.slice(part.first, part.last + 1).filter((x) => x.stage) : [];
  const phrase = announceExercise(part, k, n, after !== null);
  useEffect(() => {
    // Annoncé en arrivant par le fil de la séance, pas après un rechargement.
    if (speak && started) cues.voice(phrase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className={cx(s.card, s.gate)} data-zone={zone || undefined} aria-labelledby="fw-gate">
      <p className="ds-visually-hidden" aria-live="polite">{phrase}</p>
      {after ? (
        <p className={s.gateDone}><span className={s.gateCheck} aria-hidden="true"><Icon name="check" size={16} /></span>Bravo, {after} : fait !</p>
      ) : null}
      <Stack gap={2}>
        <Eyebrow tone="coach">{n > 1 ? `Exercice ${k} sur ${n}${k === n ? ' · le dernier' : ''}` : 'Ta séance'}</Eyebrow>
        <Cluster gap={3} align="center" nowrap>
          {zone ? <ZoneChip zone={zone} size="lg" /> : null}
          <h2 id="fw-gate" className={s.name}>{part.name}</h2>
        </Cluster>
        {part.summary ? <p className={s.target}>{part.summary}</p> : null}
        {stages.length > 1 ? (
          <ol className={s.stages} aria-label="Paliers à venir">
            {stages.map((x) => (
              <li key={x.index}><span className={s.stageK}>Palier {x.stage!.k}</span> {[describeMeasure(x.step.measure), x.stage!.settings].filter(Boolean).join(' · ')}</li>
            ))}
          </ol>
        ) : null}
        {st.note ? <Text muted>{st.note}</Text> : null}
        {last ? <Text size="sm">La dernière fois : <strong>{last.text}</strong></Text> : null}
      </Stack>
      {media || ex?.instructions ? (
        <Stack gap={2}>
          {media}
          {ex?.instructions ? <Disclosure summary="Consignes"><Text prose size="sm" muted>{ex.instructions}</Text></Disclosure> : null}
        </Stack>
      ) : null}
      <Stack gap={3} className={s.actions}>
        {started ? (
          <Cluster between align="center" nowrap>
            <Text size="sm" muted>Prends ton temps : la séance est en pause.</Text>
            <span className={s.pausedFor} aria-label={`En pause depuis ${formatElapsed(pausedFor)}`}><Icon name="pause" size={14} />{formatElapsed(pausedFor)}</span>
          </Cluster>
        ) : null}
        <Button variant="coach" size="lg" icon="play" block onClick={onGo}>C’est parti</Button>
        <Text size="sm" muted>{st.measure.kind === 'time' ? 'Appuie quand tu es prêt·e : 5 secondes pour te mettre en place, puis le chrono part.' : 'Appuie quand tu es prêt·e, puis avance à ton rythme.'}</Text>
        {/* Machine prise, douleur, manque de temps : passer l’exercice reste possible (une séance d’un seul exercice, non). */}
        {onPrev || n > 1 ? (
          <Cluster gap={2} nowrap grow>
            {onPrev ? <Button size="lg" icon="chevronLeft" onClick={onPrev} aria-label="Étape précédente" className={s.square} /> : null}
            {n > 1 ? <Button size="lg" variant="ghost" iconRight="chevronRight" onClick={onSkip}>{k < n ? 'Passer cet exercice' : 'Finir sans cet exercice'}</Button> : null}
          </Cluster>
        ) : null}
      </Stack>
    </section>
  );
}

/** D-167 · Pendant le repos, ce qui vient, en assez grand pour se préparer de loin. */
function UpNext({ f }: { f: FollowStep }) {
  return (
    <div className={s.upNext}>
      <span className={s.upLabel}>À suivre</span>
      <span className={s.upName}>{nameOf(f)}</span>
      {detailOf(f) ? <span className={s.upDetail}>{detailOf(f)}</span> : null}
    </div>
  );
}

/** D-167 · Mise en place avant un effort lancé au doigt : de quoi poser le téléphone et se mettre en position. */
const LEAD = 5;
const IDLE: Run = { endAt: null, frozen: null, extra: 0, goAt: null };
type CountStart = 'auto' | 'lead' | 'idle';

/**
 * Compte à rebours fondé sur l’heure de fin (juste même si le téléphone met la page en veille), gardé sur ce téléphone
 * pour être retrouvé après un rechargement (D-167). Bips sur les 3 dernières secondes, son de départ et de fin,
 * rappels vocaux, pause de la séance respectée (D-166) ; mise en place de 5 s avant un effort lancé au doigt (D-167)
 * et à chaque reprise après une pause (D-172) ; à la fin, la séance passe toujours à la suite (D-172).
 */
function Countdown({ sid, index, seconds, start, lead, paused, pausedAt, cues, endSound, endText, onStart, onEnd }: {
  sid: string; index: number; seconds: number; start: CountStart; lead: boolean; paused: boolean; pausedAt: number | null; cues: Cues;
  endSound: SoundName | null; endText: string; onStart: () => void; onEnd: () => void;
}) {
  const [run, setRun] = useState<Run>(() => {
    const saved = readRun(sid, index);
    if (saved) return saved;
    if (start === 'idle') return IDLE;
    if (paused) return { ...IDLE, frozen: seconds * 1000 };
    const t = Date.now();
    const goAt = start === 'lead' && lead ? t + LEAD * 1000 : null;
    return { endAt: (goAt ?? t) + seconds * 1000, frozen: null, extra: 0, goAt };
  });
  const [now, setNow] = useState(() => Date.now());
  const change = (f: (r: Run) => Run) => { setNow(Date.now()); setRun(f); };
  useEffect(() => { writeRun(sid, index, run); }, [sid, index, run]);
  // Pause de la séance : on fige le temps d’effort restant à l’instant de la pause (même si l’écran se met à jour plus tard,
  // ou si la page est rouverte après l’absence) ; à la reprise, 5 s pour se remettre en place (pas pour un repos).
  useEffect(() => {
    change((r) => {
      const t = Date.now();
      const at = Math.min(t, pausedAt ?? t);
      if (paused && r.endAt !== null) return { ...r, endAt: null, goAt: null, frozen: Math.max(0, r.endAt - Math.max(at, r.goAt ?? at)) };
      if (!paused && r.frozen !== null) {
        const goAt = lead ? t + LEAD * 1000 : null;
        return { ...r, frozen: null, goAt, endAt: (goAt ?? t) + r.frozen };
      }
      return r;
    });
    // À chaque pause ou reprise seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Les rappels lisent toujours les dernières valeurs, sans relancer la minuterie à chaque affichage.
  const latest = useRef({ cues, endSound, onEnd, seconds, paused });
  latest.current = { cues, endSound, onEnd, seconds, paused };
  const lastKey = useRef<string | null>(null);
  const ended = useRef(false);
  useEffect(() => {
    if (run.endAt === null || paused) return;
    const endAt = run.endAt;
    const goAt = run.goAt;
    const span = (latest.current.seconds + run.extra) * 1000;
    const tick = () => {
      // En pause depuis le dernier affichage : plus rien ne bouge, même avant que la minuterie soit arrêtée.
      if (latest.current.paused) return;
      const n = Date.now();
      setNow(n);
      const leadLeft = goAt !== null && n < goAt ? Math.ceil((goAt - n) / 1000) : 0;
      const left = Math.ceil(Math.min(Math.max(0, endAt - n), span) / 1000);
      const key = leadLeft ? `L${leadLeft}` : `E${left}`;
      if (key === lastKey.current) return;
      // Premier passage (départ, reprise après rechargement) : pas de son ; une minuterie déjà finie passe sans bruit.
      const before = lastKey.current;
      lastKey.current = key;
      const { cues: c } = latest.current;
      if (leadLeft) { if (before && leadLeft <= 3) c.sound('tick'); return; }
      if (before?.startsWith('L')) c.sound('go');
      if (left > 0) {
        if (before && left <= 3) c.sound('tick');
        const msg = before ? reminderAt(span / 1000, left) : null;
        if (msg) c.voice(msg);
        return;
      }
      if (ended.current) return;
      ended.current = true;
      if (before && latest.current.endSound) c.sound(latest.current.endSound);
      setTimeout(() => latest.current.onEnd(), 600);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [run.endAt, run.goAt, run.extra, paused]);

  const span = (seconds + run.extra) * 1000;
  const inLead = run.endAt !== null && run.goAt !== null && now < run.goAt;
  const rem = run.frozen ?? (run.endAt !== null ? Math.max(0, run.endAt - Math.max(now, run.goAt ?? now)) : null);
  const running = rem !== null;
  const shown = !running ? seconds : inLead ? Math.min(LEAD, Math.ceil((run.goAt! - now) / 1000)) : Math.ceil(Math.min(rem, span) / 1000);
  const ratio = running ? Math.min(rem, span) / span : 1;
  const begin = () => {
    onStart();
    const t = Date.now();
    const goAt = lead ? t + LEAD * 1000 : null;
    change(() => ({ endAt: (goAt ?? t) + seconds * 1000, frozen: null, extra: 0, goAt }));
    if (!lead) cues.sound('go');
  };
  return (
    <div className={cx(s.timer, inLead && s.leading)}>
      {inLead ? <p className={s.leadLabel}>Mets-toi en place</p> : null}
      <p className={s.clock} aria-live={shown === 0 && !inLead ? 'assertive' : 'off'} role="timer">
        {inLead ? shown : shown === 0 ? endText : `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`}
      </p>
      <div className={s.timerBar} aria-hidden="true"><span style={{ inlineSize: `${ratio * 100}%` }} /></div>
      {paused ? null : !running ? (
        <Button variant="primary" size="lg" icon="play" onClick={begin}>Démarrer le chrono</Button>
      ) : inLead ? (
        <Button size="sm" variant="secondary" onClick={() => change((r) => (r.endAt === null || r.goAt === null ? r : { ...r, endAt: r.endAt - Math.max(0, r.goAt - Date.now()), goAt: null }))}>Partir maintenant</Button>
      ) : shown > 0 ? (
        <Button size="sm" variant="secondary" onClick={() => change((r) => (r.endAt === null ? r : { ...r, endAt: r.endAt + 15_000, extra: r.extra + 15 }))}>+15 s</Button>
      ) : null}
    </div>
  );
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
