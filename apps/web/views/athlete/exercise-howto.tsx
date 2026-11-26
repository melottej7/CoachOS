import {
  alternativeName, athleteMotion, BASE_VIDEO_SOURCE_LABELS, chainLabel, gymMachine, MACHINE_LEVEL_LABELS, MACHINE_MOTIONS, machineHowTo, motionStatus, shownVideo, videoEmbed, type Exercise,
} from '@coachos/domain';
import { AnchorButton, Disclosure, MediaVideo, Stack, Text } from '@/design';
import { MachineMotion } from '@/views/shared/machine-motion';
import s from './exercise-howto.module.css';

/**
 * D-096, D-099 (refonte D-129), D-179 · « Voir comment faire » d’un exercice : la vidéo du coach d’abord, sinon celle de
 * CoachOS s’il l’accepte, sinon l’animation dessinée de la machine une fois validée par le fondateur ; toujours avec
 * qui on regarde. Dessous : réglages, consignes, erreur fréquente et alternative, ou le texte du coach.
 */
/** Ce qu’il faut d’un exercice pour choisir sa vidéo (aussi l’aperçu du coach pendant la saisie, D-154). */
type VideoFields = Pick<Exercise, 'id' | 'name' | 'videoUrl' | 'clipId'> & { starterKey?: string | null; useBaseVideo?: boolean };

/** La vidéo à montrer pour un exercice, ou null. `coach` : aperçu du coach, qui voit aussi une animation encore à relire. */
export function ExerciseMedia({ wid, exercise, coach = false }: { wid: string; exercise: VideoFields; coach?: boolean }) {
  const v = shownVideo({ videoUrl: exercise.videoUrl, clipId: exercise.clipId, starterKey: exercise.starterKey ?? null, useBaseVideo: exercise.useBaseVideo ?? true });
  const caption = v?.from === 'base' ? BASE_VIDEO_SOURCE_LABELS[v.source] : 'Vidéo de ton coach';
  if (v?.from === 'coach_clip') {
    return <MediaVideo kind="file" src={`/media/workspaces/${wid}/exercises/${exercise.id}/video?v=${exercise.clipId}`} title={`Vidéo : ${exercise.name}`} caption={caption} />;
  }
  if (!v) {
    const key = exercise.useBaseVideo === false ? null : exercise.starterKey;
    const spec = athleteMotion(key) ?? (coach && key ? MACHINE_MOTIONS[key] ?? null : null);
    if (!spec) return null;
    const review = motionStatus(spec.key) === 'to_review';
    return <MachineMotion spec={spec} title={exercise.name} caption={review ? 'Animation CoachOS · à relire : tes élèves ne la voient pas encore' : 'Animation CoachOS · touche pour mettre en pause'} />;
  }
  const e = videoEmbed(v.url);
  if (e?.kind === 'link') return <AnchorButton href={e.src} target="_blank" rel="noopener noreferrer" icon="play" size="sm">Voir la vidéo</AnchorButton>;
  if (e) return <MediaVideo kind={e.kind === 'file' ? 'file' : 'embed'} src={e.src} title={`Vidéo : ${exercise.name}`} caption={caption} />;
  return null;
}

/** Réglages, trois consignes, erreur fréquente et alternative d’un exercice sur machine. */
export function MachineSteps({ exercise }: { exercise: Pick<Exercise, 'starterKey' | 'instructions'> }) {
  const how = machineHowTo(exercise);
  if (!how) return exercise.instructions ? <Text prose size="sm" muted>{exercise.instructions}</Text> : null;
  const m = how.machine;
  const alt = alternativeName(m.alternative);
  return (
    <Stack gap={2}>
      <Text size="sm" muted>{m.muscles} · {MACHINE_LEVEL_LABELS[m.level]}{gymMachine(m.machine) ? ` · sur la machine : « ${chainLabel(gymMachine(m.machine)!)} »` : ''}</Text>
      {how.structured ? (
        <dl className={s.steps}>
          <dt>Réglages</dt><dd>{m.settings}</dd>
          <dt>Consignes</dt><dd><ol className={s.cues}>{m.cues.map((c) => <li key={c}>{c}</li>)}</ol></dd>
          <dt>Erreur fréquente</dt><dd>{m.mistake}</dd>
          {alt ? <><dt>Machine prise ?</dt><dd>{alt}</dd></> : null}
        </dl>
      ) : <Text prose size="sm" muted>{exercise.instructions}</Text>}
    </Stack>
  );
}

export function ExerciseHowTo({ wid, exercise }: { wid: string; exercise: Exercise }) {
  const media = ExerciseMedia({ wid, exercise });
  const machine = machineHowTo(exercise);
  if (!media && !exercise.instructions && !machine) return null;
  return (
    <Disclosure summary={media ? `Voir comment faire · ${exercise.name}` : `Comment faire · ${exercise.name}`}>
      <Stack gap={2}>{media}<MachineSteps exercise={exercise} /></Stack>
    </Disclosure>
  );
}
