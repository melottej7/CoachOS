'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addDays, formatShortDate, formatWeekday, templateDayLabel, WEEK_TEMPLATE_MAX_WEEKS } from '@coachos/domain';
import { useIntent, type IntentError } from '@/components/use-intent';
import { Banner, Button, Card, Cluster, Field, Input, Select, Stack, Text } from '@/design';
import s from './calendar.module.css';

// D-051, refonte Chrono (D-146) : publier les brouillons de la semaine (geste explicite), appliquer ou enregistrer une semaine type.

export interface WeekDraft { id: string; revision: number; title: string; localDate: string; changed: boolean }
export interface WeekTemplateOption { id: string; title: string; weeks: number; days: { offset: number; title: string }[] }

const errText = (e: IntentError | null) => (e ? (e.kind === 'error' ? (e.fields[0]?.rule ?? e.message) : 'Connexion perdue. Réessaie.') : null);

export function WeekTools({ wid, athleteId, first, monday, hasSessions, drafts, templates }: {
  wid: string; athleteId: string; first: string; monday: string; hasSessions: boolean; drafts: WeekDraft[]; templates: WeekTemplateOption[];
}) {
  const router = useRouter();
  const save = useIntent<{ id: string; sessions: number }>();
  const apply = useIntent<{ created: unknown[] }>();
  const publish = useIntent<unknown>();
  const [mode, setMode] = useState<'save' | 'apply' | 'publish' | null>(null);
  const [title, setTitle] = useState(`Semaine type · ${first}`);
  const [chosen, setChosen] = useState(templates[0]?.id ?? '');
  const [weeks, setWeeks] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const tpl = templates.find((t) => t.id === chosen);
  const toggle = (m: typeof mode) => { setDone(null); setMode((cur) => (cur === m ? null : m)); };
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

  async function doSave() {
    const r = await save.run('POST', `/api/v1/workspaces/${wid}/week-templates`, { athleteId, monday, title, weeks });
    if (r) { setDone(`« ${title} » enregistrée dans la bibliothèque (${weeks > 1 ? `${weeks} semaines, ` : ''}${plural(r.sessions, 'séance')}).`); setMode(null); router.refresh(); }
  }
  async function doApply() {
    const r = await apply.run('POST', `/api/v1/workspaces/${wid}/week-templates/${chosen}/apply`, { athleteId, monday });
    if (r) { setDone(`${plural(r.created.length, 'brouillon')} ajouté${r.created.length > 1 ? 's' : ''}. Rien n’est encore visible pour ${first}.`); setMode(null); router.refresh(); }
  }
  async function doPublish() {
    const r = await publish.run('POST', `/api/v1/workspaces/${wid}/athletes/${athleteId}/publications`, { changes: drafts.map((d) => ({ id: d.id, revision: d.revision })) });
    if (r) { setDone(`${plural(drafts.length, 'séance')} publiée${drafts.length > 1 ? 's' : ''} : ${first} ${drafts.length > 1 ? 'les' : 'la'} voit maintenant.`); setMode(null); router.refresh(); }
  }

  return (
    <div className={s.tools}>
      <Cluster gap={2}>
        {drafts.length ? <Button variant="primary" icon="send" aria-expanded={mode === 'publish'} onClick={() => toggle('publish')}>Publier la semaine ({drafts.length})</Button> : null}
        <Button icon="copy" aria-expanded={mode === 'apply'} onClick={() => toggle('apply')}>Appliquer une semaine type</Button>
        {hasSessions ? <Button icon="download" aria-expanded={mode === 'save'} onClick={() => toggle('save')}>Enregistrer comme semaine type</Button> : null}
      </Cluster>
      {done ? <Banner tone="success">{done}</Banner> : null}

      {mode === 'publish' ? (
        <Card pad={5}>
          <Stack gap={4}>
            <Text strong>Publier pour {first} :</Text>
            <ul className={s.panelList}>
              {drafts.map((d) => <li key={d.id}><Text size="sm">{formatWeekday(d.localDate)} {formatShortDate(d.localDate)} · {d.title}{d.changed ? ' (modification d’une séance déjà publiée)' : ''}</Text></li>)}
            </ul>
            {errText(publish.error) ? <Text size="sm" tone="danger" role="alert">{errText(publish.error)}</Text> : null}
            <Cluster gap={2}>
              <Button variant="primary" loading={publish.pending} onClick={() => void doPublish()}>Publier {plural(drafts.length, 'séance')}</Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
            </Cluster>
          </Stack>
        </Card>
      ) : null}

      {mode === 'apply' ? (
        <Card pad={5}>
          {templates.length ? (
            <Stack gap={4}>
              <Field id="wt-choice" label="Semaine type">
                <Select id="wt-choice" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.title} · {t.weeks > 1 ? `${t.weeks} semaines, ` : ''}{plural(t.days.length, 'séance')}</option>)}
                </Select>
              </Field>
              {tpl ? <ul className={s.panelList}>{tpl.days.map((d, i) => <li key={i}><Text size="sm">{templateDayLabel(d.offset, tpl.weeks > 1)} · {d.title}</Text></li>)}</ul> : null}
              <Text size="sm" muted>{tpl && tpl.weeks > 1 ? `Un brouillon par séance, sur ${tpl.weeks} semaines à partir de cette semaine (jusqu’au ${formatShortDate(addDays(monday, tpl.weeks * 7 - 1))}).` : 'Un brouillon par séance, aux mêmes jours de cette semaine.'} Les séances déjà prévues restent en place ; rien n’est publié.</Text>
              {errText(apply.error) ? <Text size="sm" tone="danger" role="alert">{errText(apply.error)}</Text> : null}
              <Cluster gap={2}>
                <Button variant="primary" loading={apply.pending} disabled={!chosen} onClick={() => void doApply()}>Ajouter {plural(tpl?.days.length ?? 0, 'brouillon')}</Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
              </Cluster>
            </Stack>
          ) : <Text muted>Aucune semaine type pour l’instant. Prépare une semaine, puis « Enregistrer comme semaine type ».</Text>}
        </Card>
      ) : null}

      {mode === 'save' ? (
        <Card pad={5}>
          <Stack gap={4}>
            <Field id="wt-title" label="Nom de la semaine type">
              <Input id="wt-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field id="wt-weeks" label="Semaines à garder">
              <Select id="wt-weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {Array.from({ length: WEEK_TEMPLATE_MAX_WEEKS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'Cette semaine seulement' : `${n} semaines (jusqu’au ${formatShortDate(addDays(monday, n * 7 - 1))})`}</option>)}
              </Select>
            </Field>
            <Text size="sm" muted>Les séances de {weeks > 1 ? 'ces semaines' : 'cette semaine'} (hors annulées), sans élève ni date : réutilisables pour n’importe quel élève{weeks > 1 ? ', comme un programme type' : ''}.</Text>
            {errText(save.error) ? <Text size="sm" tone="danger" role="alert">{errText(save.error)}</Text> : null}
            <Cluster gap={2}>
              <Button variant="primary" loading={save.pending} disabled={!title.trim()} onClick={() => void doSave()}>Enregistrer</Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
            </Cluster>
          </Stack>
        </Card>
      ) : null}
    </div>
  );
}
