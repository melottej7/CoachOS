'use client';

import { BASE_VIDEO_SOURCE_LABELS, exerciseHasVideo, shownVideo, videoEmbed, type BaseVideo } from '@coachos/domain';

/** Ce qu’il faut d’un exercice pour choisir et montrer sa vidéo. */
export interface VideoFields { id: string; name: string; videoUrl: string | null; clipId: string | null; starterKey?: string | null; useBaseVideo?: boolean }

/**
 * D-096, D-099 · Vidéo d’un exercice, côté coach et élève. Priorité : fichier filmé par le coach (route privée de
 * l’espace), lien du coach, puis vidéo de base CoachOS si le coach l’accepte. L’élève lit toujours qui il regarde.
 */
export function ExerciseVideo({ wid, exercise, compact = false, catalog }: {
  wid: string; exercise: VideoFields; compact?: boolean;
  /** Catalogue de vidéos de base (tests et aperçus) ; par défaut celui de CoachOS. */
  catalog?: Readonly<Record<string, BaseVideo>>;
}) {
  const v = shownVideo({ videoUrl: exercise.videoUrl, clipId: exercise.clipId, starterKey: exercise.starterKey ?? null, useBaseVideo: exercise.useBaseVideo ?? true }, catalog);
  if (!v) return null;
  const caption = v.from === 'base' ? BASE_VIDEO_SOURCE_LABELS[v.source] : 'Vidéo de ton coach';
  const cls = compact ? ' compact' : '';
  let media: React.ReactNode;
  if (v.from === 'coach_clip') {
    media = <video className={`ex-video${cls}`} controls playsInline preload="metadata"
      src={`/media/workspaces/${wid}/exercises/${exercise.id}/video?v=${exercise.clipId}`} aria-label={`Vidéo : ${exercise.name}`} />;
  } else {
    const e = videoEmbed(v.url);
    if (!e) return null;
    if (e.kind === 'link') media = <a className="btn small" href={e.src} target="_blank" rel="noopener noreferrer">▶ Voir la vidéo de « {exercise.name} »</a>;
    else if (e.kind === 'file') media = <video className={`ex-video${cls}`} controls playsInline preload="metadata" src={e.src} aria-label={`Vidéo : ${exercise.name}`} />;
    else media = (
      <div className={`ex-frame${cls}`}>
        <iframe src={e.src} title={`Vidéo : ${exercise.name}`} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
    );
  }
  return (
    <figure className="ex-fig">
      {media}
      <figcaption className={`ex-cap${v.from === 'base' ? ' base' : ''}`}>{caption}</figcaption>
    </figure>
  );
}

/** Vrai si l’exercice a une vidéo à montrer (la sienne ou celle de CoachOS). */
export const hasVideo = (e: VideoFields, catalog?: Readonly<Record<string, BaseVideo>>) => exerciseHasVideo(e, catalog);
