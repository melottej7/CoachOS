'use client';

import { useMemo, useState } from 'react';
import { parseRoster } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Banner, Button, Cluster, DataTable, Field, LinkButton, Select, Stack, Text, Textarea } from '@/design';
import { ErrorSummary } from '@/views/error-summary';
import s from './roster.module.css';

type Imported = { athleteId: string; displayName: string; group: string | null; link?: string };

const EXAMPLE = 'Marie Dupont ; marie.dupont@gmail.com ; Trail long\nPaul Martin ; paul@exemple.fr ; Débutants\nLéa Bernard';

/** Copie dans le presse-papiers ; rend vrai si c’est fait. */
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * D-169 : coller sa liste (Google Docs, tableur, e-mail), relire l’aperçu ligne par ligne, tout créer en une fois.
 * Rien n’est envoyé aux élèves : chaque lien d’invitation est rendu au coach, qui l’envoie lui-même.
 */
export function RosterImport({ wid, zones, defaultZone, existing, teams }: {
  wid: string; zones: string[]; defaultZone: string; existing: string[]; teams: string[];
}) {
  const [text, setText] = useState('');
  const [timeZone, setTimeZone] = useState(defaultZone);
  const [done, setDone] = useState<{ items: Imported[]; teamsCreated: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const { run, pending, error } = useIntent<{ items: Imported[]; teamsCreated: number }>();

  const known = useMemo(() => new Set(existing.map((n) => n.toLowerCase())), [existing]);
  const knownTeams = useMemo(() => new Set(teams.map((n) => n.toLowerCase())), [teams]);
  const parsed = useMemo(() => parseRoster(text), [text]);
  const rows = parsed.rows.filter((r) => !known.has(r.displayName.toLowerCase()) && !removed.has(r.line));
  const dropped = parsed.rows.filter((r) => removed.has(r.line));
  const toggle = (line: number) => setRemoved((cur) => { const next = new Set(cur); if (next.has(line)) next.delete(line); else next.add(line); return next; });
  const already = parsed.rows.filter((r) => known.has(r.displayName.toLowerCase()));
  const groups = [...new Map(rows.filter((r) => r.group).map((r) => [r.group!.toLowerCase(), r.group!])).values()];
  const newGroups = groups.filter((g) => !knownTeams.has(g.toLowerCase()));
  const withEmail = rows.filter((r) => r.email).length;

  async function submit() {
    const res = await run('POST', `/api/v1/workspaces/${wid}/athletes/import`, {
      timeZone, rows: rows.map((r) => ({ displayName: r.displayName, email: r.email, group: r.group })),
    });
    if (res) { setDone(res); window.scrollTo({ top: 0 }); }
  }
  async function copyOne(key: string, value: string) {
    if (await copy(value)) { setCopied(key); window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000); }
  }

  if (done) {
    const linked = done.items.filter((i) => i.link);
    const all = linked.map((i) => `${i.displayName} : ${i.link}`).join('\n');
    return (
      <Stack gap={5} role="status">
        <Banner tone="success" title={`${done.items.length} élève${done.items.length > 1 ? 's' : ''} ajouté${done.items.length > 1 ? 's' : ''}`}>
          {done.teamsCreated ? `${done.teamsCreated} groupe${done.teamsCreated > 1 ? 's' : ''} créé${done.teamsCreated > 1 ? 's' : ''}. ` : ''}
          {linked.length
            ? `Envoie à chacun son lien (SMS, WhatsApp, e-mail) : il sert une seule fois, à l’adresse indiquée, pendant 7 jours. Ces liens ne s’affichent qu’ici.`
            : 'Tu peux déjà préparer leurs séances. Pour les inviter, ouvre leur fiche et crée leur lien.'}
        </Banner>
        {linked.length ? (
          <>
            <Cluster gap={2}>
              <Button variant="primary" icon={copied === 'all' ? 'check' : 'copy'} onClick={() => void copyOne('all', all)}>
                {copied === 'all' ? 'Liens copiés' : `Copier les ${linked.length} liens`}
              </Button>
              <Text size="sm" muted>Une ligne par élève : « Nom : lien ».</Text>
            </Cluster>
            <DataTable caption="Liens d’invitation" head={['Élève', 'Groupe', 'Lien']}
              rows={linked.map((i) => ({
                key: i.athleteId,
                cells: [i.displayName, i.group ?? '—', (
                  <Button key="c" size="sm" icon={copied === i.athleteId ? 'check' : 'copy'} onClick={() => void copyOne(i.athleteId, i.link!)}>
                    {copied === i.athleteId ? 'Copié' : 'Copier'}
                  </Button>
                )],
              }))} />
          </>
        ) : null}
        <Cluster gap={2}>
          <LinkButton href={`/coach/${wid}/calendar`} variant={linked.length ? 'secondary' : 'primary'} icon="calendar">Préparer leurs séances</LinkButton>
          <LinkButton href={`/coach/${wid}/athletes`} variant="ghost">Voir mes élèves</LinkButton>
        </Cluster>
      </Stack>
    );
  }

  return (
    <Stack gap={5}>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <Field id="roster" label="Ta liste d’élèves" hint="Une ligne par élève : nom, puis adresse e-mail et groupe s’ils sont connus. Copie-colle depuis Google Docs, un tableur (avec ou sans ligne d’en-tête) ou un e-mail.">
        <Textarea id="roster" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} hasHint spellCheck={false} className={s.paste} />
      </Field>
      <Field id="import-tz" label="Fuseau horaire de ces élèves" hint="Modifiable ensuite sur chaque fiche">
        <Select id="import-tz" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-describedby="import-tz-hint">
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </Select>
      </Field>

      {text.trim() ? (
        <Stack gap={4} aria-live="polite">
          <Text>
            <strong>{rows.length} élève{rows.length > 1 ? 's' : ''} à ajouter</strong>
            {rows.length ? <>, dont {withEmail} avec une adresse (lien d’invitation prêt)</> : null}
            {groups.length ? <> · {groups.length} groupe{groups.length > 1 ? 's' : ''}{newGroups.length ? ` (${newGroups.length} nouveau${newGroups.length > 1 ? 'x' : ''})` : ''}</> : null}.
          </Text>
          {rows.length ? (
            <DataTable caption="Aperçu" head={['Élève', 'Adresse', 'Groupe', '']}
              rows={rows.map((r) => ({
                key: String(r.line),
                cells: [r.displayName, r.email ?? <Text as="span" size="sm" muted key="e">sans adresse</Text>, r.group ? (
                  <Cluster gap={1} key="g">{r.group}{!knownTeams.has(r.group.toLowerCase()) ? <Badge tone="info">nouveau</Badge> : null}</Cluster>
                ) : '—', (
                  <Button key="x" size="sm" variant="ghost" onClick={() => toggle(r.line)} aria-label={`Retirer ${r.displayName}`}>Retirer</Button>
                )],
              }))} />
          ) : null}
          {already.length || parsed.issues.length || dropped.length ? (
            <Banner tone="warning" title={(() => { const k = already.length + parsed.issues.length + dropped.length; return `${k} ligne${k > 1 ? 's' : ''} laissée${k > 1 ? 's' : ''} de côté`; })()}>
              <ul className={s.issues}>
                {dropped.map((r) => <li key={`d${r.line}`}>Ligne {r.line} · {r.displayName} : retirée par toi · <button type="button" className={s.linkish} onClick={() => toggle(r.line)}>Remettre</button></li>)}
                {already.map((r) => <li key={`a${r.line}`}>Ligne {r.line} · {r.displayName} : déjà dans ton espace</li>)}
                {parsed.issues.map((i) => <li key={`i${i.line}`}>Ligne {i.line} · « {i.text.slice(0, 60)} » : {i.reason}</li>)}
              </ul>
            </Banner>
          ) : null}
          {rows.length ? (
            <Cluster gap={3}>
              <Button variant="primary" size="lg" loading={pending} onClick={() => void submit()}>
                Ajouter {rows.length} élève{rows.length > 1 ? 's' : ''}
              </Button>
              <Text size="sm" muted>Rien n’est envoyé à tes élèves.</Text>
            </Cluster>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
