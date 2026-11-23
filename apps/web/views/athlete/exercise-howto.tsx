import { BASE_VIDEO_SOURCE_LABELS, shownVideo, videoEmbed, type Exercise } from '@coachos/domain';
import { AnchorButton, Disclosure, MediaVideo, Stack, Text } from '@/design';

/**
 * D-096, D-099 (refonte D-129) · « Voir comment faire » d’un exercice : la vidéo du coach d’abord, sinon celle de
 * CoachOS s’il l’accepte, toujours avec qui on regarde ; ses consignes écrites dessous.
 */
export function ExerciseHowTo({ wid, exercise }: { wid: string; exercise: Exercise }) {
  const v = shownVideo({ videoUrl: exercise.videoUrl, clipId: exercise.clipId, starterKey: exercise.starterKey ?? null, useBaseVideo: exercise.useBaseVideo ?? true });
  const caption = v?.from === 'base' ? BASE_VIDEO_SOURCE_LABELS[v.source] : 'Vidéo de ton coach';
  let media: React.ReactNode = null;
  if (v?.from === 'coach_clip') {
    media = <MediaVideo kind="file" src={`/media/workspaces/${wid}/exercises/${exercise.id}/video?v=${exercise.clipId}`} title={`Vidéo : ${exercise.name}`} caption={caption} />;
  } else if (v) {
    const e = videoEmbed(v.url);
    if (e?.kind === 'link') media = <AnchorButton href={e.src} target="_blank" rel="noopener noreferrer" icon="play" size="sm">Voir la vidéo</AnchorButton>;
    else if (e) media = <MediaVideo kind={e.kind === 'file' ? 'file' : 'embed'} src={e.src} title={`Vidéo : ${exercise.name}`} caption={caption} />;
  }
  if (!media && !exercise.instructions) return null;
  return (
    <Disclosure summary={media ? `Voir comment faire · ${exercise.name}` : `Comment faire · ${exercise.name}`}>
      <Stack gap={2}>{media}{exercise.instructions ? <Text prose size="sm" muted>{exercise.instructions}</Text> : null}</Stack>
    </Disclosure>
  );
}
