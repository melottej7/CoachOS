'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react';
import {
  announce, describeIntensity, describeMeasure, exerciseKey, followChains, followSequence, formatElapsed, PHASE_LABELS, reminderAt, setLabel,
  type Block, type Exercise, type FollowStep, type LastDone, type Sport,
} from '@coachos/domain';
import { Button, Cluster, Disclosure, Eyebrow, Heading, Icon, IconButton, LinkButton, Stack, Text, ZoneChip, type ZoneLevel } from '@/design';
import { cx } from '@/design/cx';
import { ExerciseMedia } from './exercise-howto';
import {
  elapsedOf, followClockKey, followLogKey, followPosKey, keep, NO_CLOCK, readClock, readFollowLog, readPos, readRun, writeRun,
  type ClockState, type FollowLog, type Run,
} from './follow-store';
import s from './follow-session.module.css';

// ---------- D-166 · Chronomètre de séance (gardé sur ce téléphone : il survit à un rechargement) ----------

function useSessionClock(sid: string) {
  const [c, setC] = useState<ClockState>(NO_CLOCK);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setC(readClock(sid)); }, [sid]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const save = useCallback((next: ClockState) => {
    setC(next);
    setNow(Date.now());
    keep(followClockKey(sid), next);
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
    /** D-167 : terminée par erreur → la séance revient en pause, au temps où elle s’était arrêtée. */
    reopen: () => { if (c.endedAt !== null) save({ ...c, pausedAt: c.endedAt, endedAt: null }); },
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
 * La position, les séries notées et le chronomètre restent sur ce téléphone pour reprendre plus tard.
 */
export function FollowSession({ wid, sid, title, blocks, exercises, backHref, feedbackHref, lastDone = {} }: {
  wid: string; sid: string; title: string; sport: Sport; blocks: Block[];
  exercises: Record<string, Exercise>; backHref: string; feedbackHref: string | null;
  /** D-112 : ce que l’élève a fait la dernière fois, par exercice. */
  lastDone?: Record<string, LastDone>;
}) {
  const seq = useMemo(() => followSequence(blocks), [blocks]);
  const [i, setI] = useState(0);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const v = readPos(sid);
    if (v <= seq.length) setI(v);
    setRestored(true);
  }, [sid, seq.length]);
  useEffect(() => { if (restored) keep(followPosKey(sid), String(i)); }, [i, restored, sid]);
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
  // Avancer suit le fil de la séance (un effort enchaîné part seul) ; revenir ou sauter à une étape laisse l’élève lancer.
  const [flow, setFlow] = useState(false);
  const go = (n: number, byFlow = false) => { writeRun(sid, i, null); setFlow(byFlow); setI(Math.max(0, Math.min(seq.length, n))); };
  const advance = () => { clock.start(); go(i + 1, true); };
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
          <Stack gap={2} className={s.actions}>
            {feedbackHref ? <LinkButton href={feedbackHref} variant="coach" size="lg" block>Donner mon retour</LinkButton> : <Text size="sm" muted>Tu pourras donner ton retour à partir du jour de la séance.</Text>}
            <Button variant="ghost" block icon="chevronLeft" onClick={() => { clock.reopen(); go(seq.length - 1); }}>Revenir à la dernière étape</Button>
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
          <StepScreen key={i} wid={wid} sid={sid} f={seq[i]!} prev={seq[i - 1] ?? null} next={seq[i + 1] ?? null} exercises={exercises} logged={log[i]} lastDone={lastDone}
            paused={clock.paused} started={clock.started} elapsed={clock.elapsed} cues={cues} onBegin={clock.start} flowing={flow}
            onLog={(v) => note(i, v)} onNext={advance} onPrev={i > 0 ? () => go(i - 1) : null} />
        </>
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

function StepScreen({ wid, sid, f, prev, next, exercises, logged, onLog, onNext, onPrev, onBegin, flowing, lastDone, paused, started, elapsed, cues }: {
  wid: string; sid: string; f: FollowStep; prev: FollowStep | null; next: FollowStep | null; exercises: Record<string, Exercise>; lastDone: Record<string, LastDone>;
  logged?: { reps: number | null; kg: number | null }; onLog: (v: { reps: number | null; kg: number | null }) => void;
  onNext: () => void; onPrev: (() => void) | null; onBegin: () => void; flowing: boolean;
  paused: boolean; started: boolean; elapsed: number; cues: Cues;
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
  // D-165 · D-167 : dans une même carte (séries, circuit) ou un cardio en paliers, les étapes en temps s’enchaînent
  // comme une minuterie ; la première se lance au doigt. Le repos démarre toujours seul et passe toujours à la suite.
  const auto = rest || (flowing && followChains(prev, f));
  const advance = rest || followChains(f, next);
  const toEffort = Boolean(advance && next && !isRest(next));
  const endText = rest ? (next ? 'C’est reparti !' : 'Terminé !') : stage && next?.stage ? 'Palier suivant' : toEffort ? 'Exercice suivant' : 'Terminé !';
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
        <Countdown sid={sid} index={f.index} seconds={timed} auto={auto} lead={!rest} advance={advance} paused={paused} cues={cues}
          endSound={toEffort ? 'go' : 'end'} endText={endText} onStart={onStart} onEnd={onNext} />
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
      {paused ? null : (
        <Stack gap={2} className={s.actions}>
          <Cluster gap={2} nowrap grow>
            {onPrev ? <Button size="lg" icon="chevronLeft" onClick={onPrev} aria-label="Étape précédente" className={s.prev} /> : null}
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

/**
 * Compte à rebours fondé sur l’heure de fin (juste même si le téléphone met la page en veille), gardé sur ce téléphone
 * pour être retrouvé après un rechargement (D-167). Bips sur les 3 dernières secondes, son de départ et de fin,
 * rappel vocal, pause de la séance respectée (D-166) ; mise en place de 5 s avant un effort lancé au doigt (D-167).
 */
function Countdown({ sid, index, seconds, auto, lead, advance, paused, cues, endSound, endText, onStart, onEnd }: {
  sid: string; index: number; seconds: number; auto: boolean; lead: boolean; advance: boolean; paused: boolean; cues: Cues;
  endSound: SoundName; endText: string; onStart: () => void; onEnd: () => void;
}) {
  const [run, setRun] = useState<Run>(() => readRun(sid, index) ?? (
    !auto ? { endAt: null, frozen: null, extra: 0 }
      : paused ? { endAt: null, frozen: seconds * 1000, extra: 0 }
        : { endAt: Date.now() + seconds * 1000, frozen: null, extra: 0 }));
  const [now, setNow] = useState(() => Date.now());
  const change = (f: (r: Run) => Run) => { setNow(Date.now()); setRun(f); };
  useEffect(() => { writeRun(sid, index, run); }, [sid, index, run]);
  // Pause de la séance : on fige le temps restant, on le rend à la reprise.
  useEffect(() => {
    change((r) => {
      if (paused && r.endAt !== null) return { ...r, endAt: null, frozen: Math.max(0, r.endAt - Date.now()) };
      if (!paused && r.frozen !== null) return { ...r, endAt: Date.now() + r.frozen, frozen: null };
      return r;
    });
  }, [paused]);

  // Les rappels lisent toujours les dernières valeurs, sans relancer la minuterie à chaque affichage.
  const latest = useRef({ cues, endSound, advance, onEnd, seconds });
  latest.current = { cues, endSound, advance, onEnd, seconds };
  const lastKey = useRef<string | null>(null);
  const ended = useRef(false);
  useEffect(() => {
    if (run.endAt === null || paused) return;
    const endAt = run.endAt;
    const span = (latest.current.seconds + run.extra) * 1000;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const r = Math.max(0, endAt - n);
      const leadLeft = r > span ? Math.ceil((r - span) / 1000) : 0;
      const left = Math.ceil(Math.min(r, span) / 1000);
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
      if (before) c.sound(latest.current.endSound);
      // Fin du repos ou d’une étape enchaînée : on passe à la suite ; fin d’un effort isolé : l’élève confirme.
      if (latest.current.advance) setTimeout(() => latest.current.onEnd(), 600);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [run.endAt, run.extra, paused]);

  const span = (seconds + run.extra) * 1000;
  const rem = run.frozen ?? (run.endAt !== null ? Math.max(0, run.endAt - now) : null);
  const running = rem !== null;
  const inLead = running && rem > span;
  const shown = !running ? seconds : inLead ? Math.min(LEAD, Math.ceil((rem - span) / 1000)) : Math.ceil(Math.min(rem, span) / 1000);
  const ratio = running && !inLead ? Math.min(rem, span) / span : 1;
  const begin = () => {
    onStart();
    change(() => ({ endAt: Date.now() + ((lead ? LEAD : 0) + seconds) * 1000, frozen: null, extra: 0 }));
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
        <Button size="sm" variant="secondary" onClick={() => change((r) => ({ ...r, endAt: Date.now() + span }))}>Partir maintenant</Button>
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
