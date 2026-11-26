import { notFound } from 'next/navigation';
import { addDays, DAY_LABELS, describeTweaks, formatShortDate, parseTweaksParam, weekIndexOf, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { buildRegeneration, regenContext, seenOf } from '@/server/commands/programs';
import { aiSource } from '@/server/commands/ai';
import { aiEnabled } from '@/server/ai/settings';
import { Badge, Banner, Button, Card, Cluster, Eyebrow, Field, Grid, Heading, LinkButton, Select, Stack, Text, type Tone } from '@/design';
import { AiTweaks, TweaksBanner } from '@/views/coach/program/ai-tweaks';
import { ProgramRegenerate } from '@/views/coach/program/program-regenerate';
import s from '@/views/coach/program/program.module.css';
import { AthleteLink } from '@/views/coach/athlete-link';

export const metadata = { title: 'Régénérer le programme' };

const RISK_TONE: Record<'watch' | 'risk' | 'block', Tone> = { watch: 'info', risk: 'warning', block: 'danger' };
const RISK_LABEL = { watch: 'À surveiller', risk: 'Risque', block: 'Bloquant' } as const;

/**
 * D-063 (CE-P-06), refonte Chrono (D-157) : régénérer seulement les semaines demandées d’un programme généré. Différences
 * avant d’appliquer ; séances passées, réalisées ou retouchées gardées. Paramètres en adresse : rien n’est modifié avant « Appliquer ».
 */
export default async function RegeneratePage({ params, searchParams }: {
  params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ plan?: string; de?: string; a?: string; jours?: string | string[]; reglages?: string; ia?: string }>;
}) {
  const { wid, aid } = await params;
  const sp = await searchParams;
  if (!isUuid(aid) || !sp.plan || !isUuid(sp.plan)) notFound();
  const actor = await requireActor();
  const rc = await regenContext(actor.userId, wid, aid, sp.plan);
  if (!rc) notFound();
  const { ctx, plan } = rc;
  const back = `/coach/${wid}/athletes/${aid}/programme?objectif=${ctx.goal.id}`;
  if (!ctx.feasibility) notFound();
  const first = ctx.athlete.name.split(' ')[0] ?? ctx.athlete.name;
  const raw = Array.isArray(sp.jours) ? sp.jours : sp.jours ? sp.jours.split(',') : null;
  const days = raw ? [...new Set(raw.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : plan.days;
  // D-071 : réglages de l’adresse (proposés par l’IA ou retirés), sinon ceux du programme.
  const tweaks = sp.reglages !== undefined ? parseTweaksParam(sp.reglages) : plan.tweaks;
  const suggestionId = sp.reglages !== undefined && sp.ia && isUuid(sp.ia) ? sp.ia : null;
  const probe = buildRegeneration(rc, days.length >= 2 ? days : plan.days, 1, 60, tweaks)!;
  const total = probe.weekCount;
  const idx = weekIndexOf(plan.startMonday, ctx.today);
  const current = idx >= 1 && idx <= total ? idx : null;
  const from = Math.min(total, Math.max(1, Number(sp.de) || current || 1));
  const to = Math.min(total, Math.max(from, Number(sp.a) || total));
  const built = days.length >= 2 ? buildRegeneration(rc, days, from, to, tweaks) : null;
  const here = `/coach/${wid}/athletes/${aid}/programme/regenerer?plan=${plan.id}&de=${from}&a=${to}${days.map((x) => `&jours=${x}`).join('')}${sp.reglages !== undefined && tweaks ? `&reglages=${encodeURIComponent(JSON.stringify(tweaks))}` : ''}${suggestionId ? `&ia=${suggestionId}` : ''}`;
  const weeks = Array.from({ length: total }, (_, i) => i + 1);
  const label = (n: number) => `Semaine ${n} · ${formatShortDate(addDays(plan.startMonday, (n - 1) * 7))}${n === current ? ' (en cours)' : ''}`;

  return (
    <Stack gap={8}>
      <Stack gap={3}>
        <Cluster><LinkButton href={back} variant="ghost" size="sm" icon="chevronLeft">Programme de {ctx.athlete.name}</LinkButton></Cluster>
        <Stack gap={1}>
          <Eyebrow tone="coach">Régénérer · <AthleteLink wid={wid} id={aid}>{ctx.athlete.name}</AthleteLink></Eyebrow>
          <Heading level={1} size={1}>{ctx.goal.title}</Heading>
        </Stack>
        <Text muted>
          Choisis les semaines à refaire et les jours. Le programme est recalculé avec ta décision actuelle sur l’objectif et ta bibliothèque, depuis le même départ.
          Les séances passées, réalisées par {first} ou retouchées par toi sont gardées. Rien n’est modifié avant « Appliquer ».
        </Text>
      </Stack>

      <Card pad={5}>
        <form method="get">
          <input type="hidden" name="plan" value={plan.id} />
          {sp.reglages !== undefined && tweaks ? <input type="hidden" name="reglages" value={JSON.stringify(tweaks)} /> : null}
          {suggestionId ? <input type="hidden" name="ia" value={suggestionId} /> : null}
          <Stack gap={4}>
            <Grid min={220} gap={4}>
              <Field id="de" label="De"><Select id="de" name="de" defaultValue={from}>{weeks.map((n) => <option key={n} value={n}>{label(n)}</option>)}</Select></Field>
              <Field id="a" label="À"><Select id="a" name="a" defaultValue={to}>{weeks.map((n) => <option key={n} value={n}>{label(n)}</option>)}</Select></Field>
            </Grid>
            <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <Stack gap={2}>
                <Text as="legend" strong>Jours d’entraînement</Text>
                <div className={s.days}>
                  {WEEKDAY_SHORT.map((l, i) => (
                    <label key={l} className={s.dayChip}><input type="checkbox" name="jours" value={i + 1} defaultChecked={days.includes(i + 1)} /> {l}</label>
                  ))}
                </div>
              </Stack>
            </fieldset>
            <Cluster><Button type="submit" icon="repeat">Voir les différences</Button></Cluster>
          </Stack>
        </form>
      </Card>

      {built ? <TweaksBanner lines={tweaks ? describeTweaks(tweaks, DAY_LABELS) : []} href={here} suggestionId={suggestionId} /> : null}
      {built && await aiEnabled(actor.userId, wid) ? <AiTweaks wid={wid} aid={aid} goalId={ctx.goal.id} days={days} tweaks={tweaks} href={here} first={first} source={aiSource()} /> : null}

      {!built ? <Banner tone="warning">Choisis au moins 2 jours d’entraînement.</Banner> : (
        <>
          <Stack as="section" gap={3} aria-labelledby="rg-sum">
            <Heading level={2} size={3} id="rg-sum">{from === to ? `Semaine ${from}` : `Semaines ${from} à ${to}`}</Heading>
            <Cluster gap={2}>
              <Badge tone="coach">{built.regen.counts.changed} modifiée{built.regen.counts.changed > 1 ? 's' : ''}</Badge>
              <Badge tone="coach">{built.regen.counts.added} ajoutée{built.regen.counts.added > 1 ? 's' : ''}</Badge>
              <Badge tone="warning">{built.regen.counts.removed} retirée{built.regen.counts.removed > 1 ? 's' : ''}</Badge>
              <Badge>{built.regen.counts.kept} gardée{built.regen.counts.kept > 1 ? 's' : ''}</Badge>
              <Badge>{built.regen.counts.same} inchangée{built.regen.counts.same > 1 ? 's' : ''}</Badge>
            </Cluster>
            {built.program.risks.length ? (
              <Card pad={4}>
                <Stack gap={2}>
                  <Text strong>Risques signalés <Text as="span" size="sm" muted>· à toi de décider</Text></Text>
                  <ul className={s.risks}>{built.program.risks.map((r, i) => <li key={i} className={s.risk}><Badge tone={RISK_TONE[r.level]}>{RISK_LABEL[r.level]}</Badge><span>{r.text}</span></li>)}</ul>
                </Stack>
              </Card>
            ) : null}
          </Stack>
          <ProgramRegenerate wid={wid} aid={aid} planId={plan.id} fromWeek={from} toWeek={to} days={days} seen={seenOf(built.regen)} tweaks={tweaks} suggestionId={suggestionId}
            weeks={built.regen.weeks} needsAccept={built.program.risks.some((r) => r.level !== 'watch')} validated={Boolean(ctx.decision)}
            calendarHref={`/coach/${wid}/calendar?athlete=${aid}&week=${addDays(plan.startMonday, (from - 1) * 7)}&notice=regenerated`} />
        </>
      )}
    </Stack>
  );
}
