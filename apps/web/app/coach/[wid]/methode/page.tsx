import { notFound } from 'next/navigation';
import { LEARNING } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { methodCandidates, readCoachMethod } from '@/server/commands/coach-method';
import { Disclosure, Eyebrow, Heading, Stack, Text } from '@/design';
import { MethodCandidates, MethodIdentity, MethodNotesForm, MethodRules } from '@/views/coach/library/method';
import { aiEnabled } from '@/server/ai/settings';

export const metadata = { title: 'Ma méthode' };

const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(iso));

/** D-072, refonte Chrono (D-154) : ma méthode (Coach DNA). Règles du générateur, propositions tirées de mes corrections, philosophie. */
export default async function MethodPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const view = await readCoachMethod(actor.userId, wid);
  const candidates = await methodCandidates(actor.userId, wid, view.method);
  const tz = ctx.workspace.timeZone;
  return (
    <Stack gap={8} className="ds-narrow-wide">
      <Stack gap={1}>
        <Eyebrow>Coach DNA{view.version ? ` · version ${view.version}` : ''}</Eyebrow>
        <Heading level={1} size={1}>Ma méthode</Heading>
        <Text muted>Ce que le générateur doit respecter pour tous tes élèves. Les réglages faits pour un programme précis restent prioritaires. Ta méthode n’est jamais partagée avec un autre coach.</Text>
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="m-rules">
        <Stack gap={1}>
          <Heading level={2} size={3} id="m-rules">Mes règles</Heading>
          <Text size="sm" muted>Appliquées à chaque programme généré.</Text>
        </Stack>
        <MethodRules wid={wid} version={view.version} method={view.method} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="m-learn">
        <Stack gap={1}>
          <Heading level={2} size={3} id="m-learn">Appris de tes corrections</Heading>
          <Text size="sm" muted>Sur les {LEARNING.windowDays} derniers jours. CoachOS observe tes retouches sur les programmes générés (sortie longue déplacée, VMA retirée, footing raccourci…) et les réglages que tu appliques. Une règle n’est proposée qu’avec au moins {LEARNING.minSupport} observations sur {LEARNING.minWeeks} semaines et {Math.round(LEARNING.minConcordance * 100)} % dans le même sens. Elle ne s’applique que si tu l’acceptes.</Text>
        </Stack>
        <MethodCandidates wid={wid} version={view.version} method={view.method} items={candidates} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="m-notes">
        <Stack gap={1}>
          <Heading level={2} size={3} id="m-notes">Ma méthode en quelques mots</Heading>
          <Text size="sm" muted>L’IA les lit quand elle te prépare un brouillon (séance dictée, programme, réponse), pour écrire comme toi. Laisse vide ce qui ne te parle pas : une méthode vide ne change rien.</Text>
        </Stack>
        <MethodNotesForm wid={wid} version={view.version} method={view.method} ai={await aiEnabled(actor.userId, wid)} />
      </Stack>

      <Stack as="section" gap={3} aria-labelledby="m-identity">
        <Heading level={2} size={3} id="m-identity">Ma philosophie</Heading>
        <MethodIdentity wid={wid} version={view.version} method={view.method} />
      </Stack>

      {view.history.length ? (
        <Stack as="section" gap={3} aria-labelledby="m-history">
          <Heading level={2} size={3} id="m-history">Historique</Heading>
          <Disclosure summary={`${view.history.length} version${view.history.length > 1 ? 's' : ''} · les programmes déjà créés ne changent pas`}>
            <Stack as="ol" gap={1} style={{ margin: 0, paddingLeft: '1.2em' }}>
              {view.history.map((h) => <li key={h.version}><Text as="span" size="sm"><strong>Version {h.version}</strong> · {fmt(h.createdAt, tz)}{h.reason ? ` · ${h.reason}` : ''}</Text></li>)}
            </Stack>
          </Disclosure>
        </Stack>
      ) : null}
    </Stack>
  );
}
