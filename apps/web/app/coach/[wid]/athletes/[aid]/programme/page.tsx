import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DAY_LABELS, programBlocks, weekDelta, describeTweaks, formatClock, formatLongDate, formatShortDate, isLocalDate, parseTweaksParam, PROGRAM_PHASE_LABELS, weekStart, WEEKDAY_SHORT } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { buildProgram, existingInPeriod, nextMonday, programContext, readGoalPlans } from '@/server/commands/programs';
import { aiSource } from '@/server/commands/ai';
import { Badge, Banner, Button, Card, Cluster, Disclosure, Eyebrow, Field, Heading, Input, LinkButton, Stack, Text, type Tone } from '@/design';
import { AiTweaks, TweaksBanner } from '@/views/coach/program/ai-tweaks';
import { ProgramChart } from '@/views/coach/program/program-chart';
import { ProgramCreate } from '@/views/coach/program/program-create';
import s from '@/views/coach/program/program.module.css';
import { AthleteLink } from '@/views/coach/athlete-link';

export const metadata = { title: 'Programme' };

const h = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);
const RISK_TONE: Record<'watch' | 'risk' | 'block', Tone> = { watch: 'info', risk: 'warning', block: 'danger' };
const RISK_LABEL = { watch: 'À surveiller', risk: 'Risque', block: 'Bloquant' } as const;
const WEEKDAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;
const KIND_LABEL = { easy: 'Facile', long: 'Longue', quality: 'Qualité', race: 'Course' } as const;
const PHASE_TONE: Record<string, Tone> = { tremplin: 'neutral', developpement: 'coach', recuperation: 'info', affutage: 'signal' };
/** D-106 : nom et but de chaque bloc. */
const BLOCK_TITLE = { tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée', affutage: 'Affûtage' } as const;
const BLOCK_AIM = {
  tremplin: 'Reprendre la régularité depuis ce qui est fait aujourd’hui, sans à-coup.',
  developpement: 'La charge monte, puis une semaine allégée pour assimiler.',
  recuperation: 'Moins de volume pour assimiler.',
  affutage: 'Moins de volume, un rappel d’allure : arriver frais le jour J.',
} as const;

/**
 * D-061, refonte Chrono (D-157) : générateur de programme. À la hauteur de l’objectif validé, semaines de tremplin, risques
 * signalés au coach qui décide. Paramètres en adresse (rien n’est enregistré avant « Créer »). D-101 : le programme d’abord,
 * puis les risques et la création, les réglages repliés en bas.
 */
export default async function ProgramPage({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ objectif?: string; debut?: string; jours?: string | string[]; reglages?: string; ia?: string }> }) {
  const { wid, aid } = await params;
  const sp = await searchParams;
  if (!isUuid(aid) || !sp.objectif || !isUuid(sp.objectif)) notFound();
  const actor = await requireActor();
  const ctx = await programContext(actor.userId, wid, aid, sp.objectif);
  if (!ctx) notFound();
  const first = ctx.athlete.name.split(' ')[0] ?? ctx.athlete.name;
  const fiche = `/coach/${wid}/athletes/${aid}`;
  const backLink = <Cluster><LinkButton href={`${fiche}?onglet=progression`} variant="ghost" size="sm" icon="chevronLeft">Fiche de {ctx.athlete.name}</LinkButton></Cluster>;
  if (!ctx.feasibility) {
    return (
      <Stack gap={6} className="ds-narrow-wide">
        {backLink}
        <Heading level={1} size={1}>Programme</Heading>
        <Banner tone="warning" title="Le bilan manque" action={<LinkButton href={`${fiche}/bilan`} size="sm">Remplir le bilan</LinkButton>}>
          Le générateur a besoin du bilan de {first} (pratique actuelle, disponibilités). Remplis-le avec {first} en entretien.
        </Banner>
      </Stack>
    );
  }
  const start = sp.debut && isLocalDate(sp.debut) ? weekStart(sp.debut) : nextMonday(ctx.today);
  const raw = Array.isArray(sp.jours) ? sp.jours : sp.jours ? sp.jours.split(',') : null;
  const days = raw ? [...new Set(raw.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : ctx.defaultDays;
  // D-071 : réglages proposés par l’IA (ou retirés) ; la proposition reste tracée par son identifiant.
  const tweaks = parseTweaksParam(sp.reglages);
  const suggestionId = tweaks && sp.ia && isUuid(sp.ia) ? sp.ia : null;
  const program = days.length >= 2 ? buildProgram(ctx, start, days, tweaks) : null;
  const here = `/coach/${wid}/athletes/${aid}/programme?objectif=${ctx.goal.id}&debut=${start}${days.map((x) => `&jours=${x}`).join('')}${tweaks ? `&reglages=${encodeURIComponent(JSON.stringify(tweaks))}` : ''}${suggestionId ? `&ia=${suggestionId}` : ''}`;
  const total = program ? program.weeks.reduce((n, w) => n + w.sessions.length, 0) : 0;
  const fromLib = program ? program.weeks.reduce((n, w) => n + w.sessions.filter((x) => x.source === 'library').length, 0) : 0;
  const [existing, plans] = await Promise.all([
    program ? existingInPeriod(actor.userId, wid, aid, start, ctx.feasibility.eventDate) : Promise.resolve(0),
    readGoalPlans(actor.userId, wid, aid, ctx.goal.id),
  ]);
  const d = ctx.decision?.params;
  const eventDate = ctx.feasibility.eventDate;
  const dayNames = days.map((x) => WEEKDAY_SHORT[x - 1]).join(', ');
  const longest = program ? Math.max(...program.weeks.map((w) => w.longMinutes ?? 0)) : 0;

  const adjust = (
    <Card pad={5} id="ajuster">
      <Disclosure summary="Ajuster le programme : premier lundi, jours, ta méthode, l’IA" open={!program || Boolean(tweaks)}>
        <Stack gap={5}>
          <form method="get">
            <input type="hidden" name="objectif" value={ctx.goal.id} />
            {tweaks ? <input type="hidden" name="reglages" value={JSON.stringify(tweaks)} /> : null}
            {suggestionId ? <input type="hidden" name="ia" value={suggestionId} /> : null}
            <Stack gap={4}>
              <Field id="debut" label="Premier lundi">
                <Input id="debut" type="date" name="debut" defaultValue={start} min={weekStart(ctx.today)} style={{ maxWidth: 220 }} />
              </Field>
              <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <Stack gap={2}>
                  <Text as="legend" strong>Jours d’entraînement</Text>
                  <div className={s.days}>
                    {WEEKDAY_SHORT.map((label, i) => (
                      <label key={label} className={s.dayChip}><input type="checkbox" name="jours" value={i + 1} defaultChecked={days.includes(i + 1)} /> {label}</label>
                    ))}
                  </div>
                </Stack>
              </fieldset>
              <Cluster><Button type="submit" icon="repeat">Recalculer</Button></Cluster>
            </Stack>
          </form>
          {ctx.methodLines.length ? (
            <Banner tone="info" title="Ta méthode s’applique" action={<LinkButton href={`/coach/${wid}/methode`} size="sm">Ma méthode</LinkButton>}>{ctx.methodLines.join(' · ')}.</Banner>
          ) : null}
          {program ? <AiTweaks wid={wid} aid={aid} goalId={ctx.goal.id} days={days} tweaks={tweaks} href={here} first={first} source={aiSource()} /> : null}
        </Stack>
      </Disclosure>
    </Card>
  );

  return (
    <Stack gap={8}>
      <Stack gap={3}>
        {backLink}
        <Stack gap={1}>
          <Eyebrow tone="coach">Programme · <AthleteLink wid={wid} id={aid}>{ctx.athlete.name}</AthleteLink></Eyebrow>
          <Heading level={1} size={1}>{ctx.goal.title}</Heading>
        </Stack>
        <ul className={s.facts} aria-label="Objectif">
          {d ? <li><Badge>{String(d.distanceKm).replace('.', ',')} km</Badge></li> : null}
          <li><Badge>{formatLongDate(eventDate)}</Badge></li>
          {d ? <li><Badge tone="coach">{d.targetSeconds ? `objectif ${formatClock(d.targetSeconds)}` : 'pour finir'}</Badge></li> : null}
          <li><Badge>{dayNames}</Badge></li>
        </ul>
      </Stack>

      {plans.map((p) => (
        <Banner key={p.id} tone="info" title={`Programme déjà créé du ${formatShortDate(p.startsOn)} au ${formatShortDate(p.endsOn)}`}
          action={<LinkButton href={`/coach/${wid}/athletes/${aid}/programme/regenerer?plan=${p.id}`} size="sm" icon="repeat">Régénérer une partie</LinkButton>}>
          {p.days.map((x) => WEEKDAY_SHORT[x - 1]).join(', ')}{p.regenerations ? ` · régénéré ${p.regenerations} fois` : ''}. Pour changer des jours ou des semaines, régénère plutôt que de créer un second programme : les séances passées ou retouchées sont gardées.
        </Banner>
      ))}

      {!program ? (
        <>
          <Banner tone="warning">Choisis au moins 2 jours d’entraînement.</Banner>
          {adjust}
        </>
      ) : (
        <>
          <TweaksBanner lines={tweaks ? describeTweaks(tweaks, DAY_LABELS) : []} href={here} suggestionId={suggestionId} />
          <Stack as="section" gap={4} aria-labelledby="prog-sum">
            <Cluster between gap={2}>
              <Heading level={2} size={3} id="prog-sum">{program.weeks.length} semaines · {total} séances</Heading>
              <LinkButton href="#creer" variant="primary" size="sm" iconRight="chevronDown">Créer en brouillons</LinkButton>
            </Cluster>
            <ul className={s.stats}>
              <li className={s.stat}><span className={s.statN}>{h(program.startWeekly)} → {h(program.peakWeekly)}</span><Text as="span" size="sm" muted>par semaine, du départ au pic</Text></li>
              <li className={s.stat}><span className={s.statN}>{h(longest || program.longNeed)}</span><Text as="span" size="sm" muted>séance longue la plus longue</Text></li>
              <li className={s.stat}><span className={s.statN}>{fromLib}</span><Text as="span" size="sm" muted>séance{fromLib > 1 ? 's' : ''} de ta bibliothèque</Text></li>
              <li className={s.stat}><span className={s.statN}>{program.risks.length ? `${program.risks.length} point${program.risks.length > 1 ? 's' : ''}` : 'Aucun'}</span>
                <Text as="span" size="sm" muted>{program.risks.length ? <a href="#creer">d’attention à lire</a> : 'risque signalé'}</Text></li>
            </ul>
            <Card pad={5}><ProgramChart weeks={program.weeks} eventDate={eventDate} eventLabel={ctx.goal.title} /></Card>
          </Stack>

          <Stack as="section" gap={4} aria-labelledby="prog-weeks">
            <Stack gap={1}>
              <Heading level={2} size={3} id="prog-weeks">Semaine par semaine</Heading>
              <Text size="sm" muted>Touche une séance pour lire pourquoi elle est là.</Text>
            </Stack>
            {/* D-105 : un bloc = des semaines ; leurs séances en petites lignes dépliables. */}
            <ol className={s.blocks}>
              {programBlocks(program.weeks).map((b) => {
                const bf = b.weeks[0]!, bl = b.weeks.at(-1)!;
                const top = Math.max(...b.weeks.map((w) => w.minutes));
                return (
                  <li key={b.n} className={`${s.block} ${s[b.phase]}`}>
                    <Stack gap={1}>
                      <Heading level={3} size={4}>Bloc {b.n} · {BLOCK_TITLE[b.phase]} <Text as="span" muted>· S{bf.index}{bl.index !== bf.index ? `–S${bl.index}` : ''}</Text></Heading>
                      <Text size="sm" muted>{b.phase === 'developpement' && !b.lightWeeks ? 'La charge monte jusqu’à l’affûtage.'
                        : b.phase === 'tremplin' && b.lightWeeks ? `${b.loadWeeks} semaines pour reprendre la régularité depuis ce qui est fait aujourd’hui, puis une petite semaine de décharge.` : BLOCK_AIM[b.phase]}
                        {b.phase === 'developpement' ? ` ${b.loadWeeks} semaine${b.loadWeeks > 1 ? 's' : ''} de charge${b.lightWeeks ? ` + ${b.lightWeeks} allégée` : ''} · ${h(bf.minutes) === h(top) ? h(top) : `${h(bf.minutes)} → ${h(top)}`} par semaine.` : ''}</Text>
                    </Stack>
                    <ol className={s.weeks}>
                      {b.weeks.map((w) => {
                        // Semaine allégée comparée à la plus grosse semaine de son bloc (la semaine du test est plus courte).
                        const before = Math.max(0, ...b.weeks.filter((x) => x.index < w.index).map((x) => x.minutes));
                        const delta = before ? Math.round((w.minutes / before - 1) * 100) : weekDelta(program.weeks, w.index);
                        return (
                          <li key={w.index} id={`semaine-${w.index}`} className={s.week}>
                            <div className={s.weekHead}>
                              <span className={s.weekN}>S{w.index}</span>
                              <Text as="span" size="sm" muted>{formatShortDate(w.monday)}</Text>
                              <Badge tone={PHASE_TONE[w.phase] ?? 'neutral'}>{w.phase === 'recuperation' ? 'Semaine allégée' : PROGRAM_PHASE_LABELS[w.phase]}</Badge>
                            </div>
                            <Text size="sm"><strong>{w.minutes ? h(w.minutes) : 'Semaine de la course'}</strong>{w.longMinutes ? <Text as="span" size="sm" muted> · longue {h(w.longMinutes)}</Text> : null}
                              {w.phase === 'recuperation' && delta !== null && delta < 0 ? <Text as="span" size="sm" muted> · −{Math.abs(delta)} % de volume pour assimiler</Text> : null}</Text>
                            <ul className={s.tiles}>
                              {w.sessions.map((x, i) => {
                                const dow = (new Date(`${x.date}T12:00:00Z`).getUTCDay() + 6) % 7;
                                return (
                                  <li key={i} className={s[x.kind]}>
                                    <details className={s.tile}>
                                      <summary>
                                        <span className={s.day}>{WEEKDAY_SHORT[dow]}</span>
                                        <span className={s.title}>{x.title}</span>
                                        <span className={s.kind}>{KIND_LABEL[x.kind]}{x.source === 'library' ? ' · biblio' : ''}</span>
                                      </summary>
                                      <p className={s.why}><strong>{WEEKDAY_LONG[dow]} · pourquoi ?</strong> {x.why}</p>
                                    </details>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </Stack>

          <Stack as="section" gap={4} aria-labelledby="creer-title" id="creer">
            <Heading level={2} size={3} id="creer-title">Créer le programme</Heading>
            <Card pad={5}>
              <Stack gap={4}>
                {program.risks.length ? (
                  <Stack gap={2}>
                    <Text strong>Points d’attention <Text as="span" size="sm" muted>· le programme vise toujours l’objectif ; à toi de décider</Text></Text>
                    <ul className={s.risks}>
                      {program.risks.map((r, i) => <li key={i} className={s.risk}><Badge tone={RISK_TONE[r.level]}>{RISK_LABEL[r.level]}</Badge><span>{r.text}</span></li>)}
                    </ul>
                  </Stack>
                ) : <Text muted>Aucun risque particulier signalé.</Text>}
                {existing ? <Text size="sm" muted>{existing} séance{existing > 1 ? 's' : ''} déjà prévue{existing > 1 ? 's' : ''} sur la période : elles restent ; le programme s’y ajoute.</Text> : null}
                <ProgramCreate wid={wid} aid={aid} goalId={ctx.goal.id} startMonday={start} days={days} sessions={total} tweaks={tweaks} suggestionId={suggestionId}
                  needsAccept={program.risks.some((r) => r.level !== 'watch')} validated={Boolean(ctx.decision)} />
              </Stack>
            </Card>
          </Stack>

          {adjust}
        </>
      )}
      <Text size="sm" muted><Link href={`${fiche}?onglet=progression`}>Revenir à la faisabilité de {first}</Link></Text>
    </Stack>
  );
}
