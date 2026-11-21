'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  describeIntensity, describeMeasure, followSequence, PHASE_LABELS, setLabel, type Block, type FollowStep, type Sport,
} from '@coachos/domain';
import { ExerciseVideo } from './exercise-video';
import type { ExerciseInfo } from './structure-view';

/**
 * D-096 (M3) · Suivre la séance sur téléphone, une étape par écran : l’exercice, sa vidéo, la série en cours,
 * puis le repos chronométré qui démarre seul. La position est gardée sur ce téléphone pour reprendre plus tard.
 */
export function FollowSession({ wid, sid, title, blocks, exercises, backHref, feedbackHref }: {
  wid: string; sid: string; title: string; sport: Sport; blocks: Block[];
  exercises: Record<string, ExerciseInfo>; backHref: string; feedbackHref: string | null;
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

  const done = i >= seq.length;
  const go = (n: number) => setI(Math.max(0, Math.min(seq.length, n)));
  if (!seq.length) return <p className="empty">Cette séance n’a pas de déroulé à suivre.</p>;

  return (
    <div className="fw">
      <div className="fw-top">
        <Link className="back" href={backHref}>← Quitter</Link>
        <span className="muted">{done ? 'Terminé' : `Étape ${i + 1} sur ${seq.length}`}</span>
      </div>
      <div className="fw-bar" role="progressbar" aria-label="Avancement de la séance" aria-valuemin={0} aria-valuemax={seq.length} aria-valuenow={i}>
        <span style={{ width: `${(i / seq.length) * 100}%` }} />
      </div>
      {done ? (
        <section className="fw-card fw-end" aria-live="polite">
          <p className="fw-big" aria-hidden="true">🎉</p>
          <h2>Séance terminée, bravo !</h2>
          <p className="muted">{title}</p>
          <div className="actions fw-actions">
            {feedbackHref ? <Link className="btn primary" href={feedbackHref}>Donner mon retour</Link> : <p className="muted">Tu pourras donner ton retour à partir du jour de la séance.</p>}
            <button type="button" className="btn" onClick={() => go(0)}>Recommencer</button>
          </div>
        </section>
      ) : (
        <StepScreen key={i} wid={wid} f={seq[i]!} next={seq[i + 1] ?? null} exercises={exercises}
          onNext={() => go(i + 1)} onPrev={i > 0 ? () => go(i - 1) : null} />
      )}
    </div>
  );
}

const isRest = (f: FollowStep) => f.step.phase === 'rest' || f.step.phase === 'recovery';

function StepScreen({ wid, f, next, exercises, onNext, onPrev }: {
  wid: string; f: FollowStep; next: FollowStep | null; exercises: Record<string, ExerciseInfo>; onNext: () => void; onPrev: (() => void) | null;
}) {
  const s = f.step;
  const ex = s.exercise?.id ? exercises[s.exercise.id] : undefined;
  const rest = isRest(f);
  const timed = s.measure.kind === 'time' ? s.measure.seconds : null;
  const name = s.exercise?.name ?? (rest ? 'Repos' : PHASE_LABELS[s.phase]);
  // Une étape chronométrée montre sa durée dans le chrono, pas deux fois.
  const target = [timed ? null : describeMeasure(s.measure), describeIntensity(s.intensity)].filter(Boolean).join(' · ');
  const sets = setLabel(f.sets);
  return (
    <section className={`fw-card${rest ? ' fw-rest' : ''}`} aria-labelledby="fw-name">
      {sets && !rest ? <p className="fw-kicker">{sets}</p> : null}
      <h2 id="fw-name" className="fw-name">{name}</h2>
      {target ? <p className="fw-target">{target}</p> : null}
      {s.note ? <p className="fw-note">{s.note}</p> : null}
      {timed ? <Countdown seconds={timed} auto={rest} onEnd={onNext} rest={rest} /> : null}
      {!rest && ex ? (
        <div className="fw-media">
          <ExerciseVideo wid={wid} exercise={ex} />
          {ex.instructions ? <details className="fw-howto" open={!ex.videoUrl && !ex.clipId}><summary>Consignes</summary><p>{ex.instructions}</p></details> : null}
        </div>
      ) : null}
      <div className="actions fw-actions">
        {onPrev ? <button type="button" className="btn" onClick={onPrev}>← Précédent</button> : null}
        <button type="button" className="btn primary fw-main" onClick={onNext}>{rest ? 'Passer le repos' : timed ? 'Suivant' : '✓ Fait, suivant'}</button>
      </div>
      {next ? <p className="muted fw-next">Ensuite : {next.step.exercise?.name ?? (isRest(next) ? 'repos' : PHASE_LABELS[next.step.phase].toLowerCase())}{next.step.measure.kind !== 'open' ? ` · ${describeMeasure(next.step.measure)}` : ''}</p> : null}
    </section>
  );
}

/** Compte à rebours fondé sur l’heure de fin (juste même si le téléphone met la page en pause). */
function Countdown({ seconds, auto, rest, onEnd }: { seconds: number; auto: boolean; rest: boolean; onEnd: () => void }) {
  const [endAt, setEndAt] = useState<number | null>(auto ? Date.now() + seconds * 1000 : null);
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(l);
      if (l === 0 && !ended.current) {
        ended.current = true;
        signal();
        // Fin du repos : on enchaîne ; fin d’un effort chronométré : l’élève confirme.
        if (rest) setTimeout(onEnd, 600);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [endAt, rest, onEnd]);
  return (
    <div className="fw-timer">
      <p className="fw-clock" aria-live={left === 0 ? 'assertive' : 'off'} role="timer">{left === 0 ? (rest ? 'C’est reparti !' : 'Terminé !') : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p>
      {endAt === null ? (
        <button type="button" className="btn primary" onClick={() => setEndAt(Date.now() + seconds * 1000)}>▶ Démarrer le chrono</button>
      ) : left > 0 ? (
        <button type="button" className="btn small" onClick={() => setEndAt((e) => (e ?? Date.now()) + 15_000)}>+15 s</button>
      ) : null}
    </div>
  );
}

/** Fin d’un chrono : vibration si le téléphone la permet, et un bip court. */
function signal() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* indisponible */ }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const a = new Ctx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.25);
    o.onended = () => void a.close();
  } catch { /* son indisponible */ }
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
