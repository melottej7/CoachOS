'use client';

import { videoEmbed } from '@coachos/domain';

/**
 * D-096 · Vidéo d’un exercice, côté coach et élève : fichier filmé par le coach (route privée de l’espace),
 * sinon lien YouTube ou Vimeo intégré, sinon lien ouvert dans un nouvel onglet.
 */
export function ExerciseVideo({ wid, exercise, compact = false }: {
  wid: string;
  exercise: { id: string; name: string; videoUrl: string | null; clipId: string | null; revision?: number };
  compact?: boolean;
}) {
  if (exercise.clipId) {
    return (
      <video className={`ex-video${compact ? ' compact' : ''}`} controls playsInline preload="metadata"
        src={`/media/workspaces/${wid}/exercises/${exercise.id}/video?v=${exercise.clipId}`} aria-label={`Vidéo : ${exercise.name}`} />
    );
  }
  const e = videoEmbed(exercise.videoUrl);
  if (!e) return null;
  if (e.kind === 'link') {
    return <a className="btn small" href={e.src} target="_blank" rel="noopener noreferrer">▶ Voir la vidéo de « {exercise.name} »</a>;
  }
  return (
    <div className={`ex-frame${compact ? ' compact' : ''}`}>
      <iframe src={e.src} title={`Vidéo : ${exercise.name}`} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

/** Vrai si l’exercice a une vidéo à montrer. */
export const hasVideo = (e: { videoUrl: string | null; clipId: string | null }) => Boolean(e.clipId || e.videoUrl);
