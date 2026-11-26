import {
  AI_DICTATION_JSON_SCHEMA, AI_DICTATION_PROMPT_VERSION, AI_DICTATION_SYSTEM_PROMPT, checkDictation, dictationOutputSchema, dictationRequestSchema,
  dictationUserMessage, MACHINE_EXERCISES, parseWith, redactNames, simulateDictation,
  type DictationFacts, type DictationOutput, type DictationRequest,
} from '@coachos/domain';
import { AI_COULD_NOT, evidenceHash, recordSuggestion, runWithTools } from '../ai/call';
import { AthleteRefs, openScope } from '../ai/tools';
import { commandAs, readAs } from '../db/client';
import { invalid } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { readCoachMethod } from './coach-method';

/**
 * IA-1 (D-189) · Dicter ou écrire une séance avec l’IA. Rien n’est enregistré dans la séance : la réponse est un
 * brouillon (lignes en notation relues par parseNotation) que le coach corrige puis insère lui-même ; la séance reste
 * un brouillon tant qu’il ne la publie pas. Tracé dans ai_suggestions (module « dictation »).
 */

const MANUAL = 'Tu peux écrire la séance à la main (« Écrire la séance en texte » ou les boutons)';
const MAX_TOKENS = 3000;

export interface DictationResponse {
  suggestionId: string;
  source: 'simulation' | 'claude';
  status: 'ready' | 'abstain';
  /** Lignes lues, séparées par « + » : ce que le coach relit et corrige. */
  notation: string;
  lines: { text: string; error: string | null }[];
  /** Exercices nommés : dans la bibliothèque, parmi les machines (à ajouter), ou inconnus. */
  exercises: { name: string; where: 'library' | 'machine' | 'unknown' }[];
  note: string;
}

/** dictateWorkout · C : brouillon de séance depuis le texte du coach (rien n’est enregistré dans la séance). */
export async function dictateWorkout(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(dictationRequestSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as DictationRequest;
  const wid = meta.workspaceId;
  const refs = new AthleteRefs();
  const scope = await openScope(meta.actorId, wid, refs); // coach de l’espace, sinon refus

  // Élève visé (facultatif) : affectation contrôlée ; niveau et repères sans nom ; son nom retiré du texte.
  let facts: DictationFacts = { sport: v.sport, eleve: null };
  let names: string[] = [];
  if (v.athleteId) {
    const aid = v.athleteId;
    await commandAs(meta.actorId, (tx) => requireAssigned(tx, wid, aid));
    const a = await readAs(meta.actorId, async (tx) => {
      const n = await tx.query<{ display_name: string }>('select display_name from public.athletes where workspace_id = $1 and id = $2', [wid, aid]);
      const lv = await tx.query<{ level: string }>(
        `select coalesce((select l.level from public.athlete_sport_levels l where l.workspace_id = $1 and l.athlete_id = $2 and l.sport_code = $3),
                         (select p.level from public.athlete_profiles p where p.workspace_id = $1 and p.athlete_id = $2)) as level`, [wid, aid, v.sport],
      );
      const r = await tx.query<{ vma_kmh: string | null; ftp_w: number | null; css_sec_per_100: number | null }>(
        'select vma_kmh, ftp_w, css_sec_per_100 from public.athlete_references where workspace_id = $1 and athlete_id = $2', [wid, aid],
      );
      return { name: n.rows[0]?.display_name ?? '', level: lv.rows[0]?.level ?? null, refs: r.rows[0] };
    });
    names = a.name ? [a.name] : [];
    facts = { sport: v.sport, eleve: { niveau: a.level, vmaKmh: a.refs?.vma_kmh != null ? Number(a.refs.vma_kmh) : null, ftpW: a.refs?.ftp_w ?? null, cssSecPer100: a.refs?.css_sec_per_100 ?? null } };
    refs.ref(aid); // « E1 » : l’élève de la séance, pour les outils
  }
  const text = redactNames(v.text, names);
  const method = (await readCoachMethod(meta.actorId, wid)).method;

  const answer = await runWithTools<DictationOutput>({
    actorId: meta.actorId, workspaceId: wid, scope, manual: MANUAL, effort: 'low', maxTokens: MAX_TOKENS, maxIterations: 3,
    system: AI_DICTATION_SYSTEM_PROMPT, method, user: dictationUserMessage(facts, text),
    jsonSchema: AI_DICTATION_JSON_SCHEMA as unknown as Record<string, unknown>, schema: dictationOutputSchema,
    simulate: async (call) => {
      const ex = await call('listerExercices', { recherche: null, muscle: null }) as { bibliotheque: { nom: string }[]; machines: { nom: string }[] };
      return simulateDictation(text, v.sport, [...ex.bibliotheque.map((x) => x.nom), ...ex.machines.map((x) => x.nom)]);
    },
  });
  const out: DictationOutput = answer.output ?? { status: 'abstain', lignes: [], remarque: `${AI_COULD_NOT} ${MANUAL}.` };
  const check = checkDictation(out.lignes, v.sport);

  // Où vit chaque exercice nommé : vérifié ici, jamais repris de la réponse du modèle.
  const library = await readAs(meta.actorId, (tx) => tx.query<{ name: string }>('select name from public.exercises where workspace_id = $1 and not archived', [wid]));
  const lib = new Set(library.rows.map((x) => x.name.toLowerCase()));
  const machines = new Set(MACHINE_EXERCISES.map((e) => e.name.toLowerCase()));
  const exercises = check.exerciseNames.map((name) => {
    const k = name.toLowerCase();
    const where: 'library' | 'machine' | 'unknown' = lib.has(k) || lib.has(k.replace(/s$/, '')) ? 'library' : machines.has(k) ? 'machine' : 'unknown';
    return { name, where };
  });
  const hash = evidenceHash({ facts, text, v: AI_DICTATION_PROMPT_VERSION });

  return commandAs(meta.actorId, async (tx) => idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.dictation', key: meta.idempotencyKey, body: v }, async () => {
    const id = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: v.athleteId, module: 'dictation', model: answer.model, promptVersion: AI_DICTATION_PROMPT_VERSION, hash,
      output: { request: text, facts, source: answer.source, output: out, lines: check.lines, usage: answer.usage, declined: answer.declined, toolCalls: answer.toolCalls },
    });
    await audit(tx, wid, meta.actorId, 'ai.dictation', id, meta.requestId);
    const resp: DictationResponse = {
      suggestionId: id, source: answer.source, status: out.status === 'ready' && check.notation ? 'ready' : 'abstain',
      notation: check.notation, lines: check.lines, exercises, note: out.remarque,
    };
    return { status: 200, body: resp };
  }));
}
