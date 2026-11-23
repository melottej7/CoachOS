import type { ReactNode } from 'react';
import { Icon } from './icons';
import s from './disclosure.module.css';

/** Volet dépliable natif (clavier et lecteurs d’écran compris), pour la profondeur à la demande. */
export function Disclosure({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className={s.details} open={open}>
      <summary className={s.summary}><Icon name="chevronRight" size={18} />{summary}</summary>
      <div className={s.body}>{children}</div>
    </details>
  );
}

/** Vidéo lue sur place (fichier ou intégration), avec sa légende : qui on regarde. */
export function MediaVideo({ kind, src, title, caption }: { kind: 'file' | 'embed'; src: string; title: string; caption: string }) {
  return (
    <figure className={s.media}>
      {kind === 'file'
        ? <video className={s.video} controls playsInline preload="metadata" src={src} aria-label={title} />
        : <div className={s.frame}><iframe src={src} title={title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>}
      <figcaption className={s.caption}>{caption}</figcaption>
    </figure>
  );
}
