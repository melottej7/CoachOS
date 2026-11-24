'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NO_TWEAKS, type AiProposal, type ProgramTweaks } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { AnchorButton, Badge, Banner, Button, Card, Cluster, Field, Heading, Stack, Text, Textarea } from '@/design';

// D-071, refonte Chrono (D-157) : « Ajuster avec l’IA ». Le coach écrit ; l’IA propose des réglages ; la page recalcule le
// programme avec ces réglages et montre ce qui change. Rien n’est enregistré avant « Créer » ou « Appliquer ».

const EXAMPLES = ['Moins de fractionné', 'Sortie longue le samedi', 'Allège de 10 %', 'Sorties longues progressives', 'Pas de VMA'];

/** Adresse de la même page avec les réglages proposés (et la trace de la proposition). */
export function withTweaks(href: string, tweaks: ProgramTweaks | null, days: number[] | null, suggestionId: string | null): string {
  const u = new URL(href, 'http://x');
  if (tweaks) u.searchParams.set('reglages', JSON.stringify(tweaks)); else u.searchParams.delete('reglages');
  if (days) { u.searchParams.delete('jours'); for (const d of days) u.searchParams.append('jours', String(d)); }
  if (suggestionId) u.searchParams.set('ia', suggestionId); else u.searchParams.delete('ia');
  return `${u.pathname}${u.search}`;
}

export function AiTweaks({ wid, aid, goalId, days, tweaks, href, first, source }: {
  wid: string; aid: string; goalId: string; days: number[]; tweaks: ProgramTweaks | null; href: string; first: string; source: 'simulation' | 'claude';
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ suggestionId: string; source: 'simulation' | 'claude'; proposal: AiProposal }>();
  const [text, setText] = useState('');
  const [abstain, setAbstain] = useState<string | null>(null);

  async function propose() {
    setAbstain(null);
    const r = await run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/goals/${goalId}/ai-tweaks`, { text, days, tweaks });
    if (!r) return;
    if (r.proposal.status === 'abstain') { setAbstain(r.proposal.uncertainty || 'Précise ta demande.'); return; }
    try { sessionStorage.setItem(`coachos:ai:${r.suggestionId}`, r.proposal.explanation); } catch { /* commodité */ }
    router.push(withTweaks(href, r.proposal.tweaks, r.proposal.days, r.suggestionId));
  }

  return (
    <Card pad={5}>
      <Stack as="section" gap={4} aria-labelledby="ai-title">
        <Cluster between gap={2}>
          <Heading level={3} size={4} id="ai-title">Ajuster avec l’IA</Heading>
          <Badge tone={source === 'claude' ? 'coach' : 'neutral'}>{source === 'claude' ? 'Claude' : 'IA simulée'}</Badge>
        </Cluster>
        <Text size="sm" muted>Écris ce que tu veux changer pour {first}. L’IA le traduit en réglages ; le programme est recalculé avec les mêmes garde-fous (objectif, progression, risques) et tu vois les différences avant de décider.</Text>
        <Field id="ai-text" label="Ta demande">
          <Textarea id="ai-text" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. moins de fractionné, sortie longue le samedi et progressive" />
        </Field>
        <Cluster gap={2} aria-label="Exemples" role="group">
          {EXAMPLES.map((x) => <Button key={x} size="sm" variant="ghost" icon="plus" onClick={() => setText((t) => (t ? `${t}, ${x.toLowerCase()}` : x))}>{x}</Button>)}
        </Cluster>
        {abstain ? <Banner tone="warning">{abstain}</Banner> : null}
        {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? (error.fields[0]?.rule ?? error.message) : 'Connexion perdue. Réessaie.'}</Text> : null}
        <Cluster gap={3}>
          <Button variant="primary" icon="bolt" loading={pending} disabled={text.trim().length < 3} onClick={() => void propose()}>Proposer des réglages</Button>
          <Text as="span" size="sm" muted>{source === 'claude' ? 'Envoyé à Claude sans le nom de l’élève ni ses messages.' : 'IA simulée : aucune donnée ne quitte CoachOS.'}</Text>
        </Cluster>
      </Stack>
    </Card>
  );
}

/** Bandeau des réglages en cours (proposés par l’IA ou gardés du programme), avec retour sans réglage. */
export function TweaksBanner({ lines, href, suggestionId }: { lines: string[]; href: string; suggestionId: string | null }) {
  // L’explication de l’IA est gardée dans l’onglet (jamais dans l’adresse) : lue après l’affichage.
  const [why, setWhy] = useState<string | null>(null);
  useEffect(() => { try { setWhy(suggestionId ? sessionStorage.getItem(`coachos:ai:${suggestionId}`) : null); } catch { /* commodité */ } }, [suggestionId]);
  if (!lines.length) return null;
  return (
    <Banner tone="info" title={`Réglages ${suggestionId ? 'proposés par l’IA' : 'du programme'}`}
      action={<AnchorButton href={withTweaks(href, NO_TWEAKS, null, null)} size="sm">Sans réglage</AnchorButton>}>
      {lines.join(' · ')}.{why ? ` ${why}` : ''}
    </Banner>
  );
}
