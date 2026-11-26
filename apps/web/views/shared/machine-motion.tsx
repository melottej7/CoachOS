'use client';

import { useEffect, useRef, useState } from 'react';
import { motionSvg, type MotionSpec } from '@coachos/domain';
import s from './machine-motion.module.css';

/**
 * D-178 · Animation dessinée d’un exercice sur machine : boucle muette de 4 s, dans la page (donc lisible hors ligne).
 * Un toucher met en pause ou relance ; si l’appareil demande moins d’animations, elle démarre en pause.
 */
export function MachineMotion({ spec, title, caption }: { spec: MotionSpec; title: string; caption: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);
  useEffect(() => {
    const svg = box.current?.querySelector('svg');
    if (!svg) return;
    if (playing) svg.unpauseAnimations(); else svg.pauseAnimations();
  }, [playing]);
  return (
    <figure className={s.figure}>
      <button type="button" className={s.stage} onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}
        aria-label={playing ? `Mettre en pause l’animation : ${title}` : `Lire l’animation : ${title}`}>
        <div ref={box} className={s.svg} dangerouslySetInnerHTML={{ __html: motionSvg(spec, { title }) }} />
        {playing ? null : <span className={s.play} aria-hidden="true">▶</span>}
      </button>
      <figcaption className={s.caption}>{caption}</figcaption>
    </figure>
  );
}
