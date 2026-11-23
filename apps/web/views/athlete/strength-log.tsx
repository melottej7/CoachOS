import { compareSet, entryVerdict, setText, type PlannedEntry, type StrengthEntry } from '@coachos/domain';
import { Badge, Cluster, Stack, Text } from '@/design';

/** D-100 (refonte D-129) · Séries et charges réalisées comparées au prévu ; le sens est écrit, jamais la couleur seule. */
export function StrengthLog({ plan, log }: { plan: PlannedEntry[]; log: StrengthEntry[] }) {
  if (!log.length) return null;
  const byKey = new Map(plan.map((p) => [p.exerciseId ?? `nom:${p.name.toLowerCase()}`, p]));
  return (
    <Stack gap={3}>
      <Text strong>Séries et charges</Text>
      <Stack as="ul" gap={3}>
        {log.map((e, i) => {
          const p = byKey.get(e.exerciseId ?? `nom:${e.name.toLowerCase()}`) ?? plan[i];
          const v = entryVerdict(p, e);
          const flags = [v.less ? `${v.less} série${v.less > 1 ? 's' : ''} en moins` : null, v.missing ? `${v.missing} non faite${v.missing > 1 ? 's' : ''}` : null, v.more ? `${v.more} au-dessus du prévu` : null].filter(Boolean);
          return (
            <Stack as="li" key={i} gap={1}>
              <Cluster gap={2}><Text strong>{e.name}</Text><Badge tone={v.less || v.missing ? 'warning' : 'success'}>{flags.length ? flags.join(' · ') : 'comme prévu'}</Badge></Cluster>
              <Cluster gap={2}>
                {e.sets.map((s, j) => {
                  const c = s.reps === 0 ? 'less' : compareSet(p?.sets[j], s);
                  return <Badge key={j} tone={c === 'less' ? 'warning' : c === 'more' ? 'info' : 'neutral'}>{s.reps === 0 ? 'non faite' : setText(s)}{c === 'less' && s.reps !== 0 ? ' · moins' : c === 'more' ? ' · plus' : ''}</Badge>;
                })}
              </Cluster>
              {p ? <Text size="sm" muted>Prévu : {p.sets.map(setText).join(' · ')}</Text> : null}
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
}
