'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MascotSays } from './mascot';

export interface TourStep {
  title: string;
  text: string;
  mood?: 'happy' | 'wink' | 'cheer';
  /** Aperçu illustrant la fonctionnalité (rendu côté serveur). */
  preview?: React.ReactNode;
}

/**
 * Guide d’introduction pas à pas avec l’avatar. Une page, pas une surcouche :
 * fonctionne au clavier, sur téléphone et se relit à volonté depuis « Guide ».
 */
export function IntroTour({ steps, finishHref, finishLabel, skipHref }: { steps: TourStep[]; finishHref: string; finishLabel: string; skipHref: string }) {
  const [i, setI] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const step = steps[i]!;
  const last = i === steps.length - 1;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [i]);

  return (
    <section className="tour" aria-roledescription="guide" aria-label="Présentation de CoachOS">
      <div className="tour-progress" aria-hidden="true">
        {steps.map((s, k) => <span key={s.title} className={k <= i ? 'on' : ''} />)}
      </div>
      <p className="muted" aria-live="polite">Étape {i + 1} sur {steps.length}</p>
      <h2 ref={heading} tabIndex={-1} className="tour-title">{step.title}</h2>
      <MascotSays mood={step.mood}>{step.text}</MascotSays>
      {step.preview ? <div className="tour-preview" aria-label="Aperçu">{step.preview}</div> : null}
      <div className="actions tour-actions">
        {i > 0 ? <button type="button" className="btn" onClick={() => setI(i - 1)}>Précédent</button> : null}
        {last ? (
          <Link className="btn primary" href={finishHref}>{finishLabel}</Link>
        ) : (
          <button type="button" className="btn primary" onClick={() => setI(i + 1)}>Suivant</button>
        )}
        {!last ? <Link className="link-btn" href={skipHref}>Passer la présentation</Link> : null}
      </div>
    </section>
  );
}
