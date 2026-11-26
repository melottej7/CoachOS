import {
  AI_ASSISTANT_JSON_SCHEMA, AI_ASSISTANT_PROMPT_VERSION, AI_ASSISTANT_SYSTEM_PROMPT, assistantOutputSchema, assistantRequestSchema, namesToRefs, parseWith,
  refsToNames, type AssistantOutput, type Sport,
} from '@coachos/domain';
import { AI_COULD_NOT, evidenceHash, recordSuggestion, runWithTools } from '../ai/call';
import { ASSISTANT_TOOLS, assistantScope, type AssistantScope } from '../ai/assistant-tools';
import { openScope, READ_TOOLS } from '../ai/tools';
import { commandAs } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { readCoachMethod } from './coach-method';
import { coachContext } from '../repo/context';

/**
 * IA-4 (D-192) · « Demander » : question ou brouillon du coach. Rien n’est envoyé, publié ni créé : les brouillons
 * reviennent avec un lien vers l’endroit où le coach agit (conversation, éditeur, tâche). Les prénoms sont remis ici,
 * à l’affichage ; le modèle ne les a jamais vus. Chaque demande repart des données (pas de mémoire).
 */

const MANUAL = 'Tu peux chercher dans l’Accueil, le calendrier et les retours';
const TOOLS = [...READ_TOOLS, ...ASSISTANT_TOOLS];

export interface AssistantResponse {
  suggestionId: string; source: 'simulation' | 'claude'; status: 'ready' | 'insufficient'; answer: string;
  facts: { text: string; href: string | null }[];
  replies: { athleteId: string; name: string; text: string; href: string }[];
  sessions: { name: string; date: string; sport: Sport; title: string; notation: string; unread: string[]; href: string }[];
  tasks: { title: string; athleteId: string | null; dueOn: string | null }[];
}

type Call = (name: string, input: unknown) => Promise<unknown>;
const firstRef = (t: string) => t.match(/\bE\d{1,3}\b/)?.[0] ?? null;

/** IA simulée : règles pour les demandes courantes ; même chemin d’outils, mêmes droits, aucune écriture. */
async function simulate(q: string, call: Call): Promise<AssistantOutput> {
  const t = q.toLowerCase();
  const semaine = /(derni[eè]re|pass[ée]e)/.test(t) ? 'derniere' : /prochaine/.test(t) ? 'prochaine' : 'cette';
  const send = /(envoie|envoyer|envoi|publie|publier)/.test(t);
  if (/(r[ée]pon[sd]|r[ée]ponse)/.test(t) || (send && firstRef(q))) {
    const ref = firstRef(q);
    const list = await call('lireRetours', { eleve: ref }) as { retours?: { retour: string; eleve: string; traite: boolean; commentaire: boolean; effort: number | null }[] };
    const r = (list.retours ?? []).find((x) => x.commentaire) ?? list.retours?.[0];
    if (!r) return { status: 'insufficient', reponse: `Je ne trouve pas de retour récent${ref ? ` de ${ref}` : ''} : rien à quoi répondre.`, faits: [] };
    await call('lireRetour', { retour: r.retour });
    const effort = r.effort !== null ? (r.effort >= 8 ? 'Séance exigeante, bravo de l’avoir tenue.' : 'Merci pour ton retour, c’est bien noté.') : 'Merci pour ton retour.';
    await call('brouillonReponse', { retour: r.retour, texte: `${effort} On garde le cap pour la suite ; dis-moi si quelque chose te gêne.` });
    return { status: 'ready', reponse: `${send ? 'Je ne peux ni envoyer ni publier : ' : ''}brouillon de réponse prêt pour ${r.eleve}, à relire puis envoyer toi-même.`, faits: [{ texte: `Retour du ${r.retour}`, source: r.retour }] };
  }
  if (/(n[’']a pas|pas fait|manqu|sans retour|en retard)/.test(t)) {
    const w = await call('lireSemaine', { semaine, eleve: null, groupe: null }) as { eleves: { eleve: string; seances: { seance: string; etat: string; titre: string }[] }[] };
    const late = w.eleves.flatMap((e) => e.seances.filter((x) => x.etat === 'manquée' || x.etat === 'sans retour').map((x) => ({ e: e.eleve, x })));
    if (!late.length) return { status: 'ready', reponse: 'Personne n’a de séance manquée ou sans retour sur cette période.', faits: [] };
    const who = [...new Set(late.map((l) => l.e))];
    return { status: 'ready', reponse: `${who.join(', ')} : ${late.length} séance${late.length > 1 ? 's' : ''} manquée${late.length > 1 ? 's' : ''} ou sans retour.`, faits: late.slice(0, 12).map((l) => ({ texte: `${l.e} · ${l.x.titre} (${l.x.etat})`, source: l.x.seance })) };
  }
  if (/r[ée]sum/.test(t)) {
    const g = q.match(/groupe\s+([\p{L}\d’' -]{2,40}?)(?:\s*[?.!]|$)/u)?.[1]?.trim() ?? null;
    const w = await call('lireSemaine', { semaine, eleve: firstRef(q), groupe: g }) as { introuvable?: boolean; eleves?: { eleve: string; seances: { seance: string; etat: string }[] }[] };
    if (w.introuvable || !w.eleves) return { status: 'insufficient', reponse: g ? `Je ne trouve pas le groupe « ${g} ».` : 'Je ne sais pas de qui faire le résumé.', faits: [] };
    const all = w.eleves.flatMap((e) => e.seances);
    const done = all.filter((x) => x.etat === 'faite' || x.etat === 'partielle').length;
    if (!all.length) return { status: 'insufficient', reponse: 'Aucune séance sur cette période : données insuffisantes pour un résumé.', faits: [] };
    return { status: 'ready', reponse: `${done} séance${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${all.length} prévue${all.length > 1 ? 's' : ''}, pour ${w.eleves.length} élève${w.eleves.length > 1 ? 's' : ''}.`, faits: w.eleves.slice(0, 12).map((e) => ({ texte: `${e.eleve} · ${e.seances.filter((x) => x.etat === 'faite').length}/${e.seances.length} faites`, source: e.eleve })) };
  }
  if (/(t[âa]che|rappel)/.test(t)) {
    await call('proposerTache', { titre: q.replace(/^(cr[ée]e|ajoute|propose)\s+(une\s+)?(t[âa]che|rappel)\s*(:|pour)?\s*/i, '').slice(0, 200) || 'Tâche', eleve: firstRef(q), echeance: null });
    return { status: 'ready', reponse: 'Tâche proposée : crée-la d’un bouton si elle te convient.', faits: [] };
  }
  return { status: 'insufficient', reponse: 'Je n’ai pas compris la demande. Exemples : « Qui n’a pas fait ses séances cette semaine ? », « Résume la semaine du groupe Trail », « Prépare une réponse au retour de Camille ».', faits: [] };
}

/** askAssistant · C : réponse courte et brouillons, rien n’est envoyé, publié ni créé. */
export async function askAssistant(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(assistantRequestSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const wid = meta.workspaceId;
  const ctx = await coachContext(meta.actorId, wid);
  if (!ctx) throw notVisible();
  const scope: AssistantScope = await assistantScope(await openScope(meta.actorId, wid), ctx.workspace.timeZone);
  const question = namesToRefs((p.value as { text: string }).text, scope.people).replace(/<\/?\s*(demande|contexte)\s*>/gi, ' ');
  const method = (await readCoachMethod(meta.actorId, wid)).method;

  const answer = await runWithTools<AssistantOutput>({
    actorId: meta.actorId, workspaceId: wid, scope, tools: TOOLS, manual: MANUAL, effort: 'low', maxTokens: 4000, maxIterations: 6,
    system: AI_ASSISTANT_SYSTEM_PROMPT, method, user: `<contexte>${JSON.stringify({ eleves: scope.people.length })}</contexte>\n<demande>${question}</demande>`,
    jsonSchema: AI_ASSISTANT_JSON_SCHEMA as unknown as Record<string, unknown>, schema: assistantOutputSchema,
    simulate: (call) => simulate(question, call),
  });
  const out: AssistantOutput = answer.output ?? { status: 'insufficient', reponse: `${AI_COULD_NOT} ${MANUAL}.`, faits: [] };

  // Affichage : prénoms remis, sources reliées à leur page ; brouillons avec le lien où le coach agit.
  const byRef = new Map(scope.people.map((x) => [x.ref, x]));
  const names = Object.fromEntries(scope.people.map((x) => [x.ref, x.name.split(' ')[0] ?? x.name]));
  const base = `/coach/${wid}`;
  const hrefOf = (src: string): string | null => {
    const s = src.toUpperCase();
    if (/^E\d+$/.test(s)) { const a = byRef.get(s); return a ? `${base}/athletes/${a.id}` : null; }
    const w = s.startsWith('S') ? scope.seances.get(s) : s.startsWith('R') ? scope.retours.get(s) : undefined;
    return w ? `${base}/athletes/${w.athleteId}/workouts/${w.workoutId}` : null;
  };
  const resp: Omit<AssistantResponse, 'suggestionId'> = {
    source: answer.source, status: out.status,
    answer: refsToNames(out.reponse, names),
    facts: out.faits.map((f) => ({ text: refsToNames(f.texte, names), href: hrefOf(f.source) })),
    replies: scope.drafts.replies.flatMap((r) => {
      const hit = scope.retours.get(r.retour);
      const a = hit ? scope.people.find((x) => x.id === hit.athleteId) : null;
      return a ? [{ athleteId: a.id, name: a.name.split(' ')[0] ?? a.name, text: refsToNames(r.text, names), href: `${base}/messages/${a.id}` }] : [];
    }),
    sessions: scope.drafts.sessions.flatMap((d) => {
      const a = byRef.get(d.eleve);
      return a ? [{ name: a.name.split(' ')[0] ?? a.name, date: d.date, sport: d.sport, title: refsToNames(d.title, names), notation: d.notation, unread: d.unread,
        href: `${base}/athletes/${a.id}/workouts/new?date=${d.date}&sport=${d.sport}&titre=${encodeURIComponent(refsToNames(d.title, names))}&notation=${encodeURIComponent(d.notation)}` }] : [];
    }),
    tasks: scope.drafts.tasks.map((t) => ({ title: refsToNames(t.title, names), athleteId: t.eleve ? byRef.get(t.eleve)?.id ?? null : null, dueOn: t.dueOn })),
  };
  const hash = evidenceHash({ question, v: AI_ASSISTANT_PROMPT_VERSION });

  return commandAs(meta.actorId, async (tx) => idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.assistant', key: meta.idempotencyKey, body: { question } }, async () => {
    // Journal : la question et la réponse avec les références, jamais les prénoms.
    const id = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: null, module: 'summary', model: answer.model, promptVersion: AI_ASSISTANT_PROMPT_VERSION, hash,
      output: { request: question, source: answer.source, output: out, drafts: scope.drafts, usage: answer.usage, declined: answer.declined, toolCalls: answer.toolCalls },
    });
    await audit(tx, wid, meta.actorId, 'ai.assistant', id, meta.requestId);
    return { status: 200, body: { suggestionId: id, ...resp } };
  }));
}
