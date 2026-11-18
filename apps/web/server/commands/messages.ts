import {
  detectAudioType, formatVoiceDuration, parseWith, receiptSchema, sendMessageSchema, VOICE_MAX_BYTES, VOICE_MAX_SECONDS,
} from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

// Messagerie coach élève (CE-H-07, CE-E-02, CE-H-09, D-033).
// Fil privé : coach affecté ou élève lui-même. Fil de groupe : coach de l’espace ou élève membre.
// Tout envoi est explicite ; aucune donnée Strava ni message automatique.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

export interface MessageItem { id: string; createdAt: string; body: string; mine: boolean; voiceId?: string | null; voiceDurationS?: number | null; senderName?: string }

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

// ---------- Contrôles d’accès ----------

async function requireThreadAccess(tx: Tx, wid: string, aid: string) {
  const r = await tx.query<{ ok: boolean; state: string | null }>(
    `select (private.assigned($1, $2) or private.own_athlete($1, $2)) as ok,
            (select state from public.athletes where workspace_id = $1 and id = $2) as state`,
    [wid, aid],
  );
  if (!r.rows[0]?.ok || r.rows[0].state === 'archived') throw notVisible();
}

async function conversationAthlete(tx: Tx, wid: string, cid: string): Promise<string> {
  const r = await tx.query<{ athlete_id: string }>('select athlete_id from public.conversations where workspace_id = $1 and id = $2', [wid, cid]);
  const aid = r.rows[0]?.athlete_id;
  if (!aid) throw notVisible();
  await requireThreadAccess(tx, wid, aid);
  return aid;
}

/** Fil de groupe : coach de l’espace (rôle « coach ») ou élève membre (rôle « athlete »). Groupe archivé : lecture seule. */
async function teamAccess(tx: Tx, wid: string, tid: string): Promise<{ role: 'coach' | 'athlete'; name: string }> {
  const r = await tx.query<{ coach: boolean; member: boolean; archived: boolean | null; coach_name: string | null; athlete_name: string | null }>(
    `select private.current_coach($1) as coach, private.team_member($1, $2) as member,
            (select archived_at is not null from public.teams where workspace_id = $1 and id = $2) as archived,
            (select display_name from public.users where id = auth.uid()) as coach_name,
            (select a.display_name from public.athletes a where a.workspace_id = $1 and a.user_id = auth.uid()) as athlete_name`,
    [wid, tid],
  );
  const x = r.rows[0];
  if (!x || x.archived === null || x.archived || (!x.coach && !x.member)) throw notVisible();
  return x.coach ? { role: 'coach', name: x.coach_name ?? 'Coach' } : { role: 'athlete', name: x.athlete_name ?? 'Élève' };
}

// ---------- Fil privé ----------

/** openConversation · CA : le fil unique de l’élève dans l’espace (créé au besoin). */
export async function openConversation(meta: Meta & { athleteId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireThreadAccess(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'conversation.open', key: meta.idempotencyKey, body: { athleteId: meta.athleteId } }, async () => {
      await tx.query(
        `insert into public.conversations(workspace_id, athlete_id) values ($1, $2) on conflict (workspace_id, athlete_id) do nothing`,
        [wid, meta.athleteId],
      );
      const r = await tx.query<{ id: string }>('select id from public.conversations where workspace_id = $1 and athlete_id = $2', [wid, meta.athleteId]);
      return { status: 200, body: { id: r.rows[0]!.id } };
    });
  });
}

async function insertDirect(tx: Tx, wid: string, aid: string, cid: string, body: string, voice: { id: string; s: number } | null): Promise<MessageItem> {
  const r = await tx.query<{ id: string; created_at: Date }>(
    `insert into public.messages(workspace_id, athlete_id, conversation_id, sender_id, body, voice_id, voice_duration_s)
     values ($1, $2, $3, auth.uid(), $4, $5, $6) returning id, created_at`,
    [wid, aid, cid, body, voice?.id ?? null, voice?.s ?? null],
  );
  const m = r.rows[0]!;
  await tx.query('update public.conversations set last_activity_at = (select created_at from public.messages where workspace_id = $1 and id = $3) where workspace_id = $1 and id = $2', [wid, cid, m.id]);
  // L’expéditeur a lu son propre message.
  await tx.query(
    `insert into public.read_receipts(workspace_id, athlete_id, conversation_id, user_id, read_through_at, read_through_id)
     select $1, $2, $3, auth.uid(), m.created_at, m.id from public.messages m where m.workspace_id = $1 and m.id = $4
     on conflict (workspace_id, conversation_id, user_id) do update set read_through_at = excluded.read_through_at, read_through_id = excluded.read_through_id`,
    [wid, aid, cid, m.id],
  );
  return { id: m.id, createdAt: new Date(m.created_at).toISOString(), body, mine: true, voiceId: voice?.id ?? null, voiceDurationS: voice?.s ?? null };
}

/** sendMessage · CA : message texte dans le fil privé. */
export async function sendMessage(meta: Meta & { conversationId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ body: string }>(sendMessageSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const aid = await conversationAthlete(tx, wid, meta.conversationId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'message.send', key: meta.idempotencyKey, body: { cid: meta.conversationId, ...v } }, async () => {
      const item = await insertDirect(tx, wid, aid, meta.conversationId, v.body, null);
      await audit(tx, wid, meta.actorId, 'message.send', item.id, meta.requestId);
      return { status: 200, body: { item } };
    });
  });
}

/** saveReceipt · CA : lu jusqu’à ce message (n’avance que vers l’avant). */
export async function saveReceipt(meta: Meta & { conversationId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ messageId: string }>(receiptSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const aid = await conversationAthlete(tx, wid, meta.conversationId);
    const m = await tx.query('select 1 from public.messages where workspace_id = $1 and conversation_id = $2 and id = $3', [wid, meta.conversationId, v.messageId]);
    if (!m.rows[0]) throw notVisible();
    // Instant lu par la base elle-même (précision à la microseconde, pas d’arrondi côté serveur).
    await tx.query(
      `insert into public.read_receipts(workspace_id, athlete_id, conversation_id, user_id, read_through_at, read_through_id)
       select $1, $2, $3, auth.uid(), m.created_at, m.id from public.messages m where m.workspace_id = $1 and m.id = $4
       on conflict (workspace_id, conversation_id, user_id) do update set read_through_at = excluded.read_through_at, read_through_id = excluded.read_through_id
       where public.read_receipts.read_through_at < excluded.read_through_at`,
      [wid, aid, meta.conversationId, v.messageId],
    );
    const r = await tx.query<{ read_through_id: string }>(
      'select read_through_id from public.read_receipts where workspace_id = $1 and conversation_id = $2 and user_id = auth.uid()',
      [wid, meta.conversationId],
    );
    return { status: 200, body: { readThroughId: r.rows[0]!.read_through_id } };
  });
}

// ---------- Fil de groupe ----------

async function insertTeam(tx: Tx, wid: string, tid: string, who: { role: 'coach' | 'athlete'; name: string }, body: string, voice: { id: string; s: number } | null): Promise<MessageItem> {
  const r = await tx.query<{ id: string; created_at: Date }>(
    `insert into public.team_messages(workspace_id, team_id, sender_id, sender_name, sender_role, body, voice_id, voice_duration_s)
     values ($1, $2, auth.uid(), $3, $4, $5, $6, $7) returning id, created_at`,
    [wid, tid, who.name, who.role, body, voice?.id ?? null, voice?.s ?? null],
  );
  const m = r.rows[0]!;
  await tx.query(
    `insert into public.team_reads(workspace_id, team_id, user_id, read_through_at)
     select $1, $2, auth.uid(), created_at from public.team_messages where workspace_id = $1 and id = $3
     on conflict (workspace_id, team_id, user_id) do update set read_through_at = excluded.read_through_at`,
    [wid, tid, m.id],
  );
  return { id: m.id, createdAt: new Date(m.created_at).toISOString(), body, mine: true, voiceId: voice?.id ?? null, voiceDurationS: voice?.s ?? null, senderName: who.name };
}

/** sendTeamMessage · CA : message au groupe, lu par le coach et les élèves membres. */
export async function sendTeamMessage(meta: Meta & { teamId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ body: string }>(sendMessageSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const who = await teamAccess(tx, wid, meta.teamId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'team.message', key: meta.idempotencyKey, body: { tid: meta.teamId, ...v } }, async () => {
      const item = await insertTeam(tx, wid, meta.teamId, who, v.body, null);
      await audit(tx, wid, meta.actorId, 'team.message', item.id, meta.requestId);
      return { status: 200, body: { item } };
    });
  });
}

/** saveTeamReceipt · CA : lu jusqu’à ce message du groupe. */
export async function saveTeamReceipt(meta: Meta & { teamId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ messageId: string }>(receiptSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await teamAccess(tx, wid, meta.teamId);
    const m = await tx.query('select 1 from public.team_messages where workspace_id = $1 and team_id = $2 and id = $3', [wid, meta.teamId, v.messageId]);
    if (!m.rows[0]) throw notVisible();
    await tx.query(
      `insert into public.team_reads(workspace_id, team_id, user_id, read_through_at)
       select $1, $2, auth.uid(), created_at from public.team_messages where workspace_id = $1 and id = $3
       on conflict (workspace_id, team_id, user_id) do update set read_through_at = excluded.read_through_at
       where public.team_reads.read_through_at < excluded.read_through_at`,
      [wid, meta.teamId, v.messageId],
    );
    return { status: 200, body: { readThroughId: v.messageId } };
  });
}

// ---------- Vocaux ----------

function checkVoice(bytes: Uint8Array, seconds: number) {
  if (!bytes.length) throw invalid([{ path: 'voice', rule: 'Enregistrement vide' }]);
  if (bytes.length > VOICE_MAX_BYTES) throw invalid([{ path: 'voice', rule: 'Vocal trop lourd (3 Mio au plus)' }]);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > VOICE_MAX_SECONDS) throw invalid([{ path: 'voice', rule: 'Vocal de 3 minutes au plus' }]);
  const type = detectAudioType(bytes);
  if (!type) throw invalid([{ path: 'voice', rule: 'Format audio non reconnu' }]);
  return type;
}

async function storeVoice(tx: Tx, wid: string, type: string, bytes: Uint8Array, seconds: number): Promise<{ id: string; s: number }> {
  const r = await tx.query<{ id: string }>(
    'insert into public.voice_clips(workspace_id, sender_id, content_type, bytes, duration_s) values ($1, auth.uid(), $2, $3, $4) returning id',
    [wid, type, Buffer.from(bytes), seconds],
  );
  return { id: r.rows[0]!.id, s: seconds };
}

/** sendVoice · CA : vocal dans le fil privé (3 minutes au plus). */
export async function sendVoice(meta: { actorId: string; requestId: string; workspaceId: string; conversationId: string; seconds: number }, bytes: Uint8Array): Promise<StoredResponse> {
  const type = checkVoice(bytes, meta.seconds);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const aid = await conversationAthlete(tx, wid, meta.conversationId);
    const voice = await storeVoice(tx, wid, type, bytes, meta.seconds);
    const item = await insertDirect(tx, wid, aid, meta.conversationId, `🎤 Message vocal (${formatVoiceDuration(meta.seconds)})`, voice);
    await audit(tx, wid, meta.actorId, 'message.voice', item.id, meta.requestId);
    return { status: 200, body: { item } };
  });
}

/** sendTeamVoice · CA : vocal dans le fil d’un groupe. */
export async function sendTeamVoice(meta: { actorId: string; requestId: string; workspaceId: string; teamId: string; seconds: number }, bytes: Uint8Array): Promise<StoredResponse> {
  const type = checkVoice(bytes, meta.seconds);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const who = await teamAccess(tx, wid, meta.teamId);
    const voice = await storeVoice(tx, wid, type, bytes, meta.seconds);
    const item = await insertTeam(tx, wid, meta.teamId, who, `🎤 Message vocal (${formatVoiceDuration(meta.seconds)})`, voice);
    await audit(tx, wid, meta.actorId, 'team.voice', item.id, meta.requestId);
    return { status: 200, body: { item } };
  });
}
