import { gymMachine, MACHINE_EXERCISES, MUSCLES, strengthLogSchema, type StrengthEntry } from '@coachos/domain';
import { z } from 'zod';
import { commandAs, readAs } from '../db/client';
import { requireCoach } from '../commands/portfolio';

/**
 * IA-0 · Outils en lecture donnés au modèle (MARCHE_IA.md, règle 2 « nos droits, pas ceux de l’IA »).
 * Chaque outil s’exécute au serveur, dans une transaction de l’acteur sous RLS (`readAs` : rôle authenticated),
 * filtré sur l’espace de l’appel ; un élève n’est visible que par son coach affecté (private.assigned).
 * Le modèle ne reçoit jamais d’identifiant réutilisable : les élèves sont désignés par une référence courte (« E1 »)
 * propre à l’appel, et aucun nom ni prénom n’est rendu. Jamais de Strava, de santé, de note privée ni de message.
 */

/** Références courtes d’élèves, valables le temps d’un appel. */
export class AthleteRefs {
  private byRef = new Map<string, string>();
  private byId = new Map<string, string>();
  /** Référence d’un élève (créée au besoin). */
  ref(athleteId: string): string {
    let r = this.byId.get(athleteId);
    if (!r) { r = `E${this.byId.size + 1}`; this.byId.set(athleteId, r); this.byRef.set(r, athleteId); }
    return r;
  }
  id(ref: string): string | null { return this.byRef.get(ref.trim().toUpperCase()) ?? null; }
}

export interface AiScope { actorId: string; workspaceId: string; refs: AthleteRefs }

/** Ouvre la portée des outils : l’acteur doit être coach de l’espace (refus sinon, rien n’est lu). */
export async function openScope(actorId: string, workspaceId: string, refs = new AthleteRefs()): Promise<AiScope> {
  await commandAs(actorId, (tx) => requireCoach(tx, workspaceId));
  return { actorId, workspaceId, refs };
}

export interface AiReadTool<I = unknown> {
  name: string;
  description: string;
  /** Validation complète au serveur (bornes, motifs), avant toute lecture. */
  input: z.ZodType<I>;
  /**
   * Schéma envoyé au modèle (mode strict) : types et énumérations seulement, car l’API refuse en strict les bornes
   * de longueur et les motifs ; `input` reste la seule source de vérité.
   */
  wire: z.ZodObject;
  run: (scope: AiScope, input: I) => Promise<unknown>;
}

const MAX_ITEMS = 60;
const refSchema = z.string().trim().regex(/^E\d{1,3}$/i);
const refWire = z.string().describe('Référence courte de l’élève, par exemple « E1 »');
const notFound = { introuvable: true, aide: 'Aucun élève visible sous cette référence.' };

const listerExercices: AiReadTool<{ recherche: string | null; muscle: (typeof MUSCLES)[number] | null }> = {
  name: 'listerExercices',
  description: 'Exercices disponibles : la bibliothèque du coach (exercices de l’espace) et les machines de salle disponibles chez Basic-Fit. Filtre facultatif par mot du nom et par groupe musculaire.',
  input: z.object({ recherche: z.string().trim().max(60).nullable(), muscle: z.enum(MUSCLES).nullable() }).strict(),
  wire: z.object({
    recherche: z.string().nullable().describe('Mot à chercher dans le nom, ou null'),
    muscle: z.enum(MUSCLES).nullable().describe('Groupe musculaire, ou null'),
  }).strict(),
  run: async (scope, { recherche, muscle }) => {
    const q = recherche?.toLowerCase() || null;
    const keep = (name: string, m: string) => (!q || name.toLowerCase().includes(q)) && (!muscle || m === muscle);
    const rows = await readAs(scope.actorId, (tx) => tx.query<{ name: string; muscle: string; equipment: string[]; starter_key: string | null }>(
      'select name, muscle, equipment, starter_key from public.exercises where workspace_id = $1 and not archived order by lower(name), id', [scope.workspaceId],
    ));
    const bibliotheque = rows.rows.filter((x) => keep(x.name, x.muscle)).slice(0, MAX_ITEMS)
      .map((x) => ({ nom: x.name, muscle: x.muscle, materiel: x.equipment ?? [], machine: x.starter_key && MACHINE_EXERCISES.some((e) => e.key === x.starter_key) ? x.starter_key : null }));
    const machines = MACHINE_EXERCISES.filter((e) => gymMachine(e.machine)?.chains['basic-fit-be'] && keep(e.name, e.muscle)).slice(0, MAX_ITEMS)
      .map((e) => ({ cle: e.key, nom: e.name, machine: gymMachine(e.machine)!.name, muscle: e.muscle, niveau: e.level, alternative: e.alternative }));
    return { bibliotheque, machines };
  },
};

const lireGroupe: AiReadTool<{ nom: string }> = {
  name: 'lireGroupe',
  description: 'Membres d’un groupe d’élèves du coach (par son nom) : référence courte, sport et niveau de chacun, sans nom. Si le groupe n’existe pas, rend la liste des groupes.',
  input: z.object({ nom: z.string().trim().min(1).max(60) }).strict(),
  wire: z.object({ nom: z.string().describe('Nom du groupe') }).strict(),
  run: async (scope, { nom }) => readAs(scope.actorId, async (tx) => {
    const teams = await tx.query<{ id: string; name: string }>(
      'select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, lower(name)', [scope.workspaceId],
    );
    const team = teams.rows.find((t) => t.name.toLowerCase() === nom.toLowerCase());
    if (!team) return { introuvable: true, groupes: teams.rows.map((t) => t.name).slice(0, MAX_ITEMS) };
    const members = await tx.query<{ athlete_id: string; sport: string | null; declared: string | null; confirmed: string | null }>(
      `select ta.athlete_id, p.sport_code as sport, p.level as declared,
              (select l.level from public.athlete_sport_levels l where l.workspace_id = ta.workspace_id and l.athlete_id = ta.athlete_id and l.sport_code = p.sport_code) as confirmed
         from public.team_athletes ta
         join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id and a.state <> 'archived'
         left join public.athlete_profiles p on p.workspace_id = ta.workspace_id and p.athlete_id = ta.athlete_id
        where ta.workspace_id = $1 and ta.team_id = $2
        order by a.created_at, a.id`, [scope.workspaceId, team.id],
    );
    return {
      groupe: team.name,
      membres: members.rows.slice(0, MAX_ITEMS).map((m) => ({ eleve: scope.refs.ref(m.athlete_id), sport: m.sport, niveau: m.confirmed ?? m.declared, niveauConfirme: Boolean(m.confirmed) })),
    };
  }),
};

const lireEleve: AiReadTool<{ eleve: string }> = {
  name: 'lireEleve',
  description: 'Profil sportif d’un élève (par sa référence courte) : sport, niveau déclaré et confirmé, expérience, disponibilités, repères VMA, FTP, CSS, date du prochain objectif. Ni nom, ni santé, ni note.',
  input: z.object({ eleve: refSchema }).strict(),
  wire: z.object({ eleve: refWire }).strict(),
  run: async (scope, { eleve }) => {
    const aid = scope.refs.id(eleve);
    if (!aid) return notFound;
    return readAs(scope.actorId, async (tx) => {
      const a = await tx.query('select 1 from public.athletes where workspace_id = $1 and id = $2 and state <> \'archived\'', [scope.workspaceId, aid]);
      if (!a.rows.length) return notFound;
      const p = (await tx.query<{ sport_code: string; level: string; experience: string; weekly_sessions: string; weekly_hours: string | null; available_days: number[]; next_event_date: string | Date | null }>(
        'select sport_code, level, experience, weekly_sessions, weekly_hours, available_days, next_event_date from public.athlete_profiles where workspace_id = $1 and athlete_id = $2', [scope.workspaceId, aid],
      )).rows[0];
      const levels = (await tx.query<{ sport_code: string; level: string }>(
        'select sport_code, level from public.athlete_sport_levels where workspace_id = $1 and athlete_id = $2 order by sport_code', [scope.workspaceId, aid],
      )).rows;
      const r = (await tx.query<{ vma_kmh: string | null; ftp_w: number | null; css_sec_per_100: number | null }>(
        'select vma_kmh, ftp_w, css_sec_per_100 from public.athlete_references where workspace_id = $1 and athlete_id = $2', [scope.workspaceId, aid],
      )).rows[0];
      return {
        eleve: scope.refs.ref(aid),
        profil: p ? {
          sport: p.sport_code, niveauDeclare: p.level, experience: p.experience, seancesParSemaine: p.weekly_sessions, heuresParSemaine: p.weekly_hours,
          joursDisponibles: p.available_days ?? [], prochainObjectif: p.next_event_date ? isoDate(p.next_event_date) : null,
        } : null,
        niveauxConfirmes: levels.map((l) => ({ sport: l.sport_code, niveau: l.level })),
        reperes: { vmaKmh: r?.vma_kmh != null ? Number(r.vma_kmh) : null, ftpW: r?.ftp_w ?? null, cssSecPour100m: r?.css_sec_per_100 ?? null },
      };
    });
  },
};

const lireChargesRecentes: AiReadTool<{ eleve: string; exercice: string | null }> = {
  name: 'lireChargesRecentes',
  description: 'Séries réellement faites par un élève en musculation ces 60 derniers jours (D-184) : par exercice, les dernières séances avec répétitions, charge en kg et durée. Filtre facultatif par mot du nom de l’exercice.',
  input: z.object({ eleve: refSchema, exercice: z.string().trim().max(60).nullable() }).strict(),
  wire: z.object({ eleve: refWire, exercice: z.string().nullable().describe('Mot à chercher dans le nom de l’exercice, ou null') }).strict(),
  run: async (scope, { eleve, exercice }) => {
    const aid = scope.refs.id(eleve);
    if (!aid) return notFound;
    return readAs(scope.actorId, async (tx) => {
      const a = await tx.query('select 1 from public.athletes where workspace_id = $1 and id = $2 and state <> \'archived\'', [scope.workspaceId, aid]);
      if (!a.rows.length) return notFound;
      // Seulement le journal des séries : ni le commentaire, ni le ressenti de l’élève.
      const rows = await tx.query<{ created_at: string | Date; strength_log: unknown }>(
        `select created_at, strength_log from public.feedbacks
          where workspace_id = $1 and athlete_id = $2 and created_at >= now() - interval '60 days' and jsonb_array_length(strength_log) > 0
          order by created_at desc limit 20`, [scope.workspaceId, aid],
      );
      const q = exercice?.toLowerCase() || null;
      const byName = new Map<string, { date: string; series: { reps: number | null; kg: number | null; secondes: number | null }[] }[]>();
      for (const row of rows.rows) {
        const log = strengthLogSchema.safeParse(row.strength_log);
        if (!log.success) continue;
        for (const e of log.data as StrengthEntry[]) {
          if (q && !e.name.toLowerCase().includes(q)) continue;
          const list = byName.get(e.name) ?? [];
          if (!byName.has(e.name) && byName.size >= 12) continue;
          if (list.length < 5) list.push({ date: isoDate(row.created_at), series: e.sets.map((x) => ({ reps: x.reps, kg: x.kg, secondes: x.seconds })) });
          byName.set(e.name, list);
        }
      }
      return { eleve: scope.refs.ref(aid), exercices: [...byName].map(([nom, seances]) => ({ exercice: nom, seances })) };
    });
  },
};

const isoDate = (d: string | Date) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString()).slice(0, 10);

/** Les outils en lecture, dans un ordre fixe (le préfixe mis en cache n’en dépend pas d’un appel à l’autre). */
export const READ_TOOLS: readonly AiReadTool<never>[] = [listerExercices, lireGroupe, lireEleve, lireChargesRecentes] as unknown as AiReadTool<never>[];

export type ReadToolName = 'listerExercices' | 'lireGroupe' | 'lireEleve' | 'lireChargesRecentes';
export const READ_TOOL_NAMES: readonly ReadToolName[] = ['listerExercices', 'lireGroupe', 'lireEleve', 'lireChargesRecentes'];

/** Trace de ce que l’IA a lu (affichée avec le brouillon, gardée dans ai_suggestions). */
export interface ToolCallTrace { name: string; input: unknown; ok: boolean }

/**
 * Exécute un outil : entrée validée par son schéma, refus propre si invalide, trace gardée. Utilisé par le Tool Runner
 * et par la simulation (même chemin, mêmes droits).
 */
export async function invokeTool(scope: AiScope, tool: AiReadTool<never>, input: unknown, trace: ToolCallTrace[]): Promise<string> {
  const p = (tool.input as z.ZodType).safeParse(input);
  if (!p.success) { trace.push({ name: tool.name, input, ok: false }); return JSON.stringify({ erreur: 'Entrée invalide pour cet outil.' }); }
  const out = await tool.run(scope, p.data as never);
  trace.push({ name: tool.name, input: p.data, ok: true });
  return JSON.stringify(out);
}

