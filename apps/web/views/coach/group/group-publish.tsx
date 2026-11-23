'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GROUP_ROW_LABELS, groupAnnouncement, type GroupSessionRowState } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Badge, Banner, Button, Checkbox, Cluster, Icon, LinkButton, Stack, Text, Textarea, type Tone } from '@/design';
import s from '@/views/coach/calendar/calendar.module.css';

// Lot G2 (D-042), refonte Chrono (D-148) : chaque élève et l’état de sa séance ; on choisit qui reçoit la publication.
// Les exceptions (non cochés, élèves sans séance) et les adaptations sont rappelées avant l’envoi.

export interface PublishRow {
  athleteId: string; name: string; workoutId: string; revision: number; state: GroupSessionRowState; title: string; base: boolean; editHref: string; viewHref: string;
}

const TONE: Record<GroupSessionRowState, Tone> = { draft: 'neutral', adapted: 'warning', published: 'success', changed: 'warning' };

export function GroupPublish({ wid, gid, rows, without, title, dateLabel, teamName }: {
  wid: string; gid: string; rows: PublishRow[]; without: string[]; title: string; dateLabel: string; teamName: string;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ published: number; announcementId: string | null }>();
  const open = rows.filter((r) => r.state !== 'published');
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(open.map((r) => r.workoutId)));
  const [done, setDone] = useState<number | null>(null);
  // Annonce dans le fil du groupe (D-049) : décochée par défaut, texte relu et modifiable avant l’envoi.
  const [announce, setAnnounce] = useState(false);
  const [text, setText] = useState(() => groupAnnouncement(title, dateLabel));
  const [announced, setAnnounced] = useState(false);
  const toggle = (id: string) => setChosen((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = open.filter((r) => chosen.has(r.workoutId));
  const skipped = open.filter((r) => !chosen.has(r.workoutId));
  const adapted = picked.filter((r) => !r.base);
  const first = (n: string) => n.split(' ')[0];

  async function publish() {
    const r = await run('POST', `/api/v1/workspaces/${wid}/group-sessions/${gid}/publish`, {
      items: picked.map((x) => ({ athleteId: x.athleteId, workoutId: x.workoutId, revision: x.revision })),
      announce: announce && text.trim() ? text.trim() : null,
    });
    if (r) { setDone(r.published); setAnnounced(Boolean(r.announcementId)); router.refresh(); }
  }

  return (
    <Stack gap={5}>
      <ul className={s.rows}>
        {rows.map((r) => (
          <li key={r.workoutId}>
            {r.state !== 'published'
              ? <Checkbox checked={chosen.has(r.workoutId)} onChange={() => toggle(r.workoutId)} label={<span className="ds-visually-hidden">Publier pour {r.name}</span>} />
              : <Icon name="check" size={20} />}
            <span className={s.rowText}>
              <span className={s.rowTitle}>{r.name} <Badge tone={TONE[r.state]}>{GROUP_ROW_LABELS[r.state]}</Badge></span>
              <span className={s.rowMeta}>{r.base ? 'Séance de base' : `Adaptée : ${r.title}`}</span>
            </span>
            <Cluster gap={2}>
              <LinkButton href={r.editHref} size="sm" icon="edit">Adapter</LinkButton>
              <LinkButton href={r.viewHref} size="sm" variant="ghost">Voir</LinkButton>
            </Cluster>
          </li>
        ))}
      </ul>
      {open.length ? (
        <Stack gap={3} aria-live="polite">
          <Text><strong>Publier pour {picked.length} élève{picked.length > 1 ? 's' : ''}</strong>{picked.length ? ` : ${picked.map((r) => first(r.name)).join(', ')}` : ''}.</Text>
          {adapted.length ? <Text size="sm">Dont {adapted.length} séance{adapted.length > 1 ? 's' : ''} adaptée{adapted.length > 1 ? 's' : ''} : {adapted.map((r) => first(r.name)).join(', ')} (publiée{adapted.length > 1 ? 's' : ''} telle{adapted.length > 1 ? 's' : ''} quelle{adapted.length > 1 ? 's' : ''}).</Text> : null}
          {skipped.length || without.length ? (
            <Banner tone="warning" title="Exceptions">{[...skipped.map((r) => `${first(r.name)} (non cochée)`), ...without.map((n) => `${first(n)} (pas de séance)`)].join(', ')}.</Banner>
          ) : <Text size="sm" muted>Aucune exception.</Text>}
          <Checkbox checked={announce} onChange={setAnnounce} label={`Annoncer dans le fil « ${teamName} »`} hint="Lu par tous les membres du groupe, même ceux qui n’ont pas cette séance." />
          {announce ? <Textarea aria-label="Message d’annonce" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /> : null}
          <Cluster>
            <Button variant="primary" icon="send" loading={pending} disabled={!picked.length || (announce && !text.trim())} onClick={() => void publish()}>
              Publier pour {picked.length} élève{picked.length > 1 ? 's' : ''}{announce ? ' et annoncer' : ''}
            </Button>
          </Cluster>
          {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
        </Stack>
      ) : <Banner tone="success" title="Toutes les séances sont publiées">{done ? `${done} publiée${done > 1 ? 's' : ''} à l’instant.` : ''}{announced ? ' Annonce envoyée dans le fil du groupe.' : ''}</Banner>}
      {done && open.length ? <Banner tone="success">{done} séance{done > 1 ? 's' : ''} publiée{done > 1 ? 's' : ''}.{announced ? ' Annonce envoyée dans le fil du groupe.' : ''}</Banner> : null}
    </Stack>
  );
}
