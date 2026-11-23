'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatShortDate, PROGRAM_PHASE_LABELS, PROTECT_LABELS, regenItemKey, WEEKDAY_SHORT, type ProgramTweaks, type RegenItem, type RegenWeek } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Banner, Button, Card, Checkbox, Cluster, Heading, Stack, Text, type Tone } from '@/design';
import s from './program.module.css';

// D-063, refonte Chrono (D-157) : le coach lit les différences et les risques, puis applique. Tout reste en brouillons.
// D-078 : chaque changement se décoche ; seuls les changements cochés sont appliqués.

const dowOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const day = (d: string) => `${WEEKDAY_SHORT[dowOf(d)]} ${formatShortDate(d)}`;
const PHASE_TONE: Record<string, Tone> = { tremplin: 'neutral', developpement: 'coach', recuperation: 'info', affutage: 'signal' };

function ItemText({ it }: { it: RegenItem }) {
  const pub = 'before' in it && it.before.published && (it.kind === 'changed' || it.kind === 'removed')
    ? <span className={s.muted}> · publiée : l’élève garde l’ancienne version jusqu’à ta republication</span> : null;
  switch (it.kind) {
    case 'kept':
      return <><span className={s.muted}>{day(it.date)}</span> {it.before.title}
        <span className={s.muted}> · gardée ({PROTECT_LABELS[it.reason]}){it.dropped ? ` ; « ${it.dropped} » n’est pas ajoutée ce jour-là` : ''}</span></>;
    case 'same':
      return <><span className={s.muted}>{day(it.date)}</span> {it.before.title} <span className={s.muted}>· inchangée</span></>;
    case 'changed':
      return <><span className={s.muted}>{day(it.date)}</span> {it.before.title === it.after.title
        ? <>{it.after.title} <span className={s.muted}>· {it.before.minutes && it.after.minutes && it.before.minutes !== it.after.minutes ? `${it.before.minutes}′ → ${it.after.minutes}′` : 'contenu ajusté'}</span></>
        : <><s>{it.before.title}</s> → <strong>{it.after.title}</strong></>}{it.after.source === 'library' ? <span className={s.muted}> · bibliothèque</span> : null}{pub}</>;
    case 'added':
      return <><span className={s.muted}>{day(it.date)}</span> <strong>{it.after.title}</strong>{it.after.source === 'library' ? <span className={s.muted}> · bibliothèque</span> : null} <span className={s.muted}>· ajoutée</span></>;
    case 'removed':
      return <><span className={s.muted}>{day(it.date)}</span> <s>{it.before.title}</s> <span className={s.muted}>· retirée</span>{pub}</>;
  }
}

const MARK: Record<RegenItem['kind'], string> = { kept: '=', same: '=', changed: '✎', added: '+', removed: '−' };
const KIND_CLASS: Partial<Record<RegenItem['kind'], string>> = { changed: s.rgChanged, added: s.rgAdded, removed: s.rgRemoved };

export function ProgramRegenerate({ wid, aid, planId, fromWeek, toWeek, days, seen, weeks, needsAccept, validated, calendarHref, tweaks = null, suggestionId = null }: {
  tweaks?: ProgramTweaks | null; suggestionId?: string | null;
  wid: string; aid: string; planId: string; fromWeek: number; toWeek: number; days: number[]; seen: { id: string; revision: number }[];
  weeks: RegenWeek[]; needsAccept: boolean; validated: boolean; calendarHref: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [accept, setAccept] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const keys = weeks.flatMap((w) => w.items).map(regenItemKey).filter((k): k is string => k !== null);
  const n = keys.filter((k) => !skip.has(k)).length;
  const toggle = (k: string) => setSkip((x) => { const y = new Set(x); if (y.has(k)) y.delete(k); else y.add(k); return y; });

  const apply = !validated ? <Banner tone="warning">Valide d’abord l’objectif dans la fiche (Progression › Faisabilité › Ta décision).</Banner>
    : !keys.length ? <Text muted>Rien à changer dans ces semaines avec ces jours.</Text> : (
      <Stack gap={3}>
        {needsAccept ? <Checkbox id="accept-regen" checked={accept} onChange={setAccept} label="J’ai lu les risques signalés et je décide de régénérer ces semaines." /> : null}
        {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
        <Cluster gap={3}>
          <Button variant="primary" icon="check" loading={pending} disabled={!n || (needsAccept && !accept)}
            onClick={async () => {
              const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/plans/${planId}/regenerate`, { fromWeek, toWeek, days, seen, acceptRisks: accept, skip: [...skip].filter((k) => keys.includes(k)), tweaks, suggestionId });
              if (r) router.push(calendarHref);
            }}>
            {!n ? 'Aucun changement coché' : `Appliquer ${n === keys.length ? `les ${n}` : `${n} sur ${keys.length}`} changement${n > 1 ? 's' : ''}`}
          </Button>
          <Text as="span" size="sm" muted>En brouillons : rien n’est envoyé à l’élève avant ta publication.</Text>
        </Cluster>
      </Stack>
    );

  return (
    <>
      <Card pad={5}>{apply}</Card>
      <Stack as="section" gap={4} aria-labelledby="rg-weeks">
        <Cluster between gap={2}>
          <Heading level={2} size={3} id="rg-weeks">Différences semaine par semaine</Heading>
          {keys.length > 1 ? (
            <Cluster gap={1}>
              <Button size="sm" variant="ghost" onClick={() => setSkip(new Set())} disabled={!skip.size}>Tout cocher</Button>
              <Button size="sm" variant="ghost" onClick={() => setSkip(new Set(keys))} disabled={skip.size === keys.length}>Tout décocher</Button>
            </Cluster>
          ) : null}
        </Cluster>
        <Text size="sm" muted>Décoche un changement pour garder la séance actuelle (ou ne rien ajouter ce jour-là).</Text>
        <ol className={s.weeks} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {weeks.map((w) => (
            <li key={w.index} className={s.week}>
              <div className={s.weekHead}>
                <span className={s.weekN}>S{w.index}</span>
                <Text as="span" size="sm" muted>{formatShortDate(w.monday)}</Text>
                {w.phase ? <Badge tone={PHASE_TONE[w.phase] ?? 'neutral'}>{PROGRAM_PHASE_LABELS[w.phase]}</Badge> : null}
              </div>
              {w.items.length ? (
                <ul className={s.rgList}>{w.items.map((it, i) => {
                  const k = regenItemKey(it);
                  const off = k !== null && skip.has(k);
                  return (
                    <li key={k ?? `${it.kind}-${i}`} className={`${s.rg} ${KIND_CLASS[it.kind] ?? ''}`} data-off={off ? '' : undefined}>
                      {k ? <input type="checkbox" className={s.tick} checked={!off} onChange={() => toggle(k)} aria-label={`Appliquer ce changement du ${day(it.date)}`} />
                        : <span className={s.mark} aria-hidden="true">{MARK[it.kind]}</span>}
                      <span><ItemText it={it} />{off ? <span className={s.muted}> · non appliqué</span> : null}</span>
                    </li>
                  );
                })}</ul>
              ) : <Text size="sm" muted>Aucune séance.</Text>}
            </li>
          ))}
        </ol>
      </Stack>
    </>
  );
}
