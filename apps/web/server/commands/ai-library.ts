import { createHash } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import {
  AI_EXERCISE_JSON_SCHEMA, AI_EXERCISE_PROMPT_VERSION, AI_EXERCISE_SYSTEM_PROMPT, AI_IMPORT_JSON_SCHEMA, AI_IMPORT_MAX_BYTES, AI_IMPORT_PROMPT_VERSION,
  AI_IMPORT_SYSTEM_PROMPT, exerciseCuesRequestSchema, exerciseCuesSchema, exerciseCuesText, importOutputSchema, parseWith, simulateExerciseCues, simulateImport,
  sniffImportType, type ExerciseCues, type ImportOutput,
} from '@coachos/domain';
import { AI_COULD_NOT, askStructured, evidenceHash, recordSuggestion } from '../ai/call';
import { commandAs } from '../db/client';
import { invalid } from '../errors';
import { audit, type StoredResponse } from './idempotency';
import { requireCoach } from './portfolio';
import { readCoachMethod } from './coach-method';

/**
 * IA-5 (D-193) · Aides de la bibliothèque : recopier un programme depuis une photo ou un PDF, et proposer les consignes
 * d’un exercice. Rien n’est enregistré : le texte va dans l’aperçu d’import, les consignes dans le formulaire de
 * l’exercice, « À relire ». Le fichier n’est jamais conservé ; le journal garde son empreinte, pas son contenu.
 */

type Meta = { actorId: string; requestId: string; workspaceId: string };
const IMPORT_MANUAL = 'Tu peux recopier le programme à la main dans le champ texte';

/** transcribeProgramDocument · C : photo ou PDF → texte au format de l’import (rien n’est importé). */
export async function transcribeProgramDocument(meta: Meta, bytes: Uint8Array): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  await commandAs(meta.actorId, (tx) => requireCoach(tx, wid));
  if (!bytes.length) throw invalid([{ path: 'file', rule: 'Fichier vide' }]);
  if (bytes.length > AI_IMPORT_MAX_BYTES) throw invalid([{ path: 'file', rule: 'Fichier trop lourd (4 Mo au plus) : photographie une page à la fois' }]);
  const type = sniffImportType(bytes);
  if (!type) throw invalid([{ path: 'file', rule: 'Photo (JPEG, PNG, WebP) ou PDF seulement' }]);
  const data = Buffer.from(bytes).toString('base64');
  const block: Anthropic.Beta.BetaContentBlockParam = type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
    : { type: 'image', source: { type: 'base64', media_type: type, data } };
  const method = (await readCoachMethod(meta.actorId, wid)).method;
  const answer = await askStructured<ImportOutput>({
    actorId: meta.actorId, workspaceId: wid, manual: IMPORT_MANUAL, effort: 'low', maxTokens: 12_000,
    system: AI_IMPORT_SYSTEM_PROMPT, method,
    user: [block, { type: 'text', text: '<demande>Recopie ce programme au format de l’import.</demande>' }],
    extraInputTokens: type === 'application/pdf' ? Math.max(3000, Math.ceil(bytes.length / 30)) : 2000,
    jsonSchema: AI_IMPORT_JSON_SCHEMA as unknown as Record<string, unknown>, schema: importOutputSchema,
    simulate: () => simulateImport(),
  });
  const out: ImportOutput = answer.output ?? { status: 'abstain', texte: '', remarque: `${AI_COULD_NOT} ${IMPORT_MANUAL}.` };
  const fileHash = createHash('sha256').update(bytes).digest('hex');
  const id = await commandAs(meta.actorId, async (tx) => {
    // Journal : empreinte et type du fichier, jamais ses octets.
    const sid = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: null, module: 'import', model: answer.model, promptVersion: AI_IMPORT_PROMPT_VERSION, hash: evidenceHash({ fileHash, v: AI_IMPORT_PROMPT_VERSION }),
      output: { file: { type, bytes: bytes.length, sha256: fileHash }, source: answer.source, output: out, usage: answer.usage, declined: answer.declined },
    });
    await audit(tx, wid, meta.actorId, 'ai.import', sid, meta.requestId);
    return sid;
  });
  return { status: 200, body: { suggestionId: id, source: answer.source, status: out.status === 'ready' && out.texte.trim() ? 'ready' : 'abstain', text: out.status === 'ready' ? out.texte : '', note: out.remarque } };
}

/** proposeExerciseCues · C : consignes proposées pour un exercice, « À relire » ; rien n’est enregistré. */
export async function proposeExerciseCues(meta: Meta & { idempotencyKey: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(exerciseCuesRequestSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { name: string; muscle: string; equipment: string[] };
  const wid = meta.workspaceId;
  await commandAs(meta.actorId, (tx) => requireCoach(tx, wid));
  const name = v.name.replace(/<\/?\s*(demande|contexte)\s*>/gi, ' ');
  const answer = await askStructured<ExerciseCues>({
    actorId: meta.actorId, workspaceId: wid, manual: 'Tu peux écrire les consignes toi-même', effort: 'low', maxTokens: 2000,
    system: AI_EXERCISE_SYSTEM_PROMPT, user: `<contexte>${JSON.stringify({ muscle: v.muscle, materiel: v.equipment })}</contexte>\n<demande>${name}</demande>`,
    jsonSchema: AI_EXERCISE_JSON_SCHEMA as unknown as Record<string, unknown>, schema: exerciseCuesSchema,
    simulate: () => simulateExerciseCues(v.name, v.muscle),
  });
  const out: ExerciseCues = answer.output ?? { status: 'abstain', consignes: [], erreur: '', plusFacile: '', remarque: `${AI_COULD_NOT} Tu peux écrire les consignes toi-même.` };
  const id = await commandAs(meta.actorId, async (tx) => {
    const sid = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: null, module: 'exercise', model: answer.model, promptVersion: AI_EXERCISE_PROMPT_VERSION, hash: evidenceHash({ v, p: AI_EXERCISE_PROMPT_VERSION }),
      output: { request: v, source: answer.source, output: out, usage: answer.usage, declined: answer.declined },
    });
    await audit(tx, wid, meta.actorId, 'ai.exercise', sid, meta.requestId);
    return sid;
  });
  const ready = out.status === 'ready' && out.consignes.length > 0;
  return { status: 200, body: { suggestionId: id, source: answer.source, status: ready ? 'ready' : 'abstain', text: ready ? exerciseCuesText(out) : '', note: out.remarque } };
}
