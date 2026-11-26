import {
  AI_METHOD_JSON_SCHEMA, AI_METHOD_PROMPT_VERSION, AI_METHOD_SYSTEM_PROMPT, methodProposalSchema, proposalToNotes, simulateMethodProposal,
  parseWith, type LibrarySessionFact, type MethodNotes, type MethodProposal,
} from '@coachos/domain';
import { z } from 'zod';
import { invalid } from '../errors';
import { AI_COULD_NOT, evidenceHash, recordSuggestion, runWithTools } from '../ai/call';
import { commandAs } from '../db/client';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { readCoachMethod } from './coach-method';

/**
 * IA-2 (D-190) · « Proposer depuis ma bibliothèque » : l’IA lit les séances écrites par le coach (outil
 * lireSeancesBibliotheque, ses séances seulement) et propose sa méthode en six champs. Rien n’est enregistré dans la
 * méthode : le coach reprend la proposition dans le formulaire, corrige, puis enregistre une nouvelle version.
 */

const MANUAL = 'Tu peux écrire ta méthode à la main';

export interface MethodProposalResponse { suggestionId: string; source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; notes: MethodNotes; note: string }

/** proposeMethod · C : proposition de méthode depuis la bibliothèque du coach (rien n’est enregistré dans la méthode). */
export async function proposeMethod(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(z.object({}).strict(), body ?? {});
  if (!p.ok) throw invalid(p.fields);
  const wid = meta.workspaceId;
  const current = await readCoachMethod(meta.actorId, wid);
  const answer = await runWithTools<MethodProposal>({
    actorId: meta.actorId, workspaceId: wid, manual: MANUAL, effort: 'medium', maxTokens: 4000, maxIterations: 3,
    system: AI_METHOD_SYSTEM_PROMPT, method: current.method, user: '<demande>Propose ma méthode à partir de mes séances.</demande>',
    jsonSchema: AI_METHOD_JSON_SCHEMA as unknown as Record<string, unknown>, schema: methodProposalSchema,
    simulate: async (call) => simulateMethodProposal(((await call('lireSeancesBibliotheque', { limite: 20 })) as { seances: LibrarySessionFact[] }).seances),
  });
  const out: MethodProposal = answer.output ?? { status: 'abstain', notes: { principes: '', progression: '', echauffement: '', repos: '', vocabulaire: '', jamais: '' }, remarque: `${AI_COULD_NOT} ${MANUAL}.` };
  const notes = proposalToNotes(out);
  const empty = Object.values(notes).every((v) => !v);
  const hash = evidenceHash({ v: AI_METHOD_PROMPT_VERSION, version: current.version, calls: answer.toolCalls });
  return commandAs(meta.actorId, async (tx) => idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.method', key: meta.idempotencyKey, body: {} }, async () => {
    const id = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: null, module: 'method', model: answer.model, promptVersion: AI_METHOD_PROMPT_VERSION, hash,
      output: { source: answer.source, output: out, usage: answer.usage, declined: answer.declined, toolCalls: answer.toolCalls },
    });
    await audit(tx, wid, meta.actorId, 'ai.method', id, meta.requestId);
    const resp: MethodProposalResponse = { suggestionId: id, source: answer.source, status: out.status === 'ready' && !empty ? 'ready' : 'abstain', notes, note: out.remarque };
    return { status: 200, body: resp };
  }));
}
