'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatClock, formatShortDate, PROPOSAL_INFO, WEEKDAY_SHORT, type ProposalKind, type WeekProposal } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Banner, Button, Cluster, Disclosure, Stack, Text } from '@/design';
import s from './calendar.module.css';

// CE-P-05 (D-056), refonte Chrono (D-146) : propositions de la plus prudente à la plus exigeante, volume avant → après,
// séances barrées et remplacées, conséquence probable, application en brouillons (rien n’est publié).

const dur = (x: number) => (x ? formatClock(Math.round(x / 60) * 60) : '—');
const dayIdx = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;

export function WeekAdapt({ wid, aid, monday, first, proposals, seen }: {
  wid: string; aid: string; monday: string; first: string; proposals: WeekProposal[]; seen: { id: string; revision: number }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ProposalKind | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error } = useIntent<{ updated: { canceled: boolean }[] }>();
  const changed = proposals[0]?.changes.length ?? 0;
  const locked = proposals[0]?.locked ?? 0;

  async function apply() {
    if (!kind) return;
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/week-proposals`, { monday, kind, seen });
    if (r) {
      setDone(`« ${PROPOSAL_INFO[kind].title} » appliquée : ${r.updated.length} séance${r.updated.length > 1 ? 's' : ''} en brouillon. Relis-les, puis « Publier la semaine » pour que ${first} les voie.`);
      setKind(null);
      router.refresh();
    }
  }

  return (
    <Disclosure summary="Adapter la semaine · propositions de la plus prudente à la plus exigeante">
      <Stack gap={4}>
        {done ? <Banner tone="success">{done}</Banner> : null}
        {!changed ? <Text muted>Aucune séance à adapter : celles de cette semaine sont faites, passées ou annulées.</Text> : (
          <fieldset className={s.proposals}>
            <legend className="ds-visually-hidden">Choisir une proposition</legend>
            <Text size="sm" muted>Compare avec la semaine actuelle, puis choisis. {locked ? `${locked} séance${locked > 1 ? 's' : ''} faite${locked > 1 ? 's' : ''}, passée${locked > 1 ? 's' : ''} ou annulée${locked > 1 ? 's' : ''} ne change${locked > 1 ? 'nt' : ''} pas. ` : ''}Rien n’est visible pour {first} avant la publication.</Text>
            {proposals.map((p) => {
              const info = PROPOSAL_INFO[p.kind];
              return (
                <label key={p.kind} className={s.proposal}>
                  <input type="radio" name="proposal" checked={kind === p.kind} onChange={() => setKind(p.kind)} />
                  <span className={s.proposalHead}><Text as="span" strong size="md">{info.title}</Text><Text as="span" size="sm">{dur(p.beforeSeconds)} → <strong>{dur(p.afterSeconds)}</strong></Text></span>
                  <Text as="span" size="sm" muted>{info.summary}</Text>
                  <ul className={s.changes}>
                    {p.changes.map((c) => (
                      <li key={c.id}>
                        <strong>{WEEKDAY_SHORT[dayIdx(c.localDate)]} {formatShortDate(c.localDate).replace(/\.$/, '')}</strong>{' '}
                        <s>{c.before.title} ({dur(c.before.seconds)})</s>{' → '}
                        {c.after ? <strong>{c.after.title}{c.after.title === c.before.title ? ', raccourcie' : ''} ({dur(c.after.seconds)})</strong> : <strong>retirée cette semaine</strong>}
                      </li>
                    ))}
                  </ul>
                  <Text as="span" size="sm"><strong>Conséquence probable :</strong> {info.consequence}</Text>
                </label>
              );
            })}
            {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
            <Cluster>
              <Button variant="primary" loading={pending} disabled={!kind} onClick={() => void apply()}>
                {kind ? `Appliquer « ${PROPOSAL_INFO[kind].title} » en brouillons` : 'Choisis une proposition'}
              </Button>
            </Cluster>
          </fieldset>
        )}
      </Stack>
    </Disclosure>
  );
}
