import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { repoRoot } from './db/migrate';
import { SEED_WORKOUTS } from './db/seed';
import { setMailer } from './email/send';
import { AppError } from './errors';
import { errorPayload } from './http';
import { markFeedbackReviewed, saveFeedback } from './commands/feedback';
import { acceptInvitation, createAthlete, createWorkspace, issueInvitation, revokeInvitation } from './commands/invitations';
import { createWorkout, publishWorkouts, updateWorkout } from './commands/workouts';
import { saveAthleteProfile } from './commands/athlete-profile';
import { saveAthleteReferences } from './commands/athlete-references';
import { confirmLevel, createGoal, createNote, createTeam, deleteNote, setTeamMember, updateGoal, updateTeam } from './commands/portfolio';
import { createAppointment, createTask, saveAutoRuleSettings, snoozeAutoTask, updateAppointment, updateTask } from './commands/tasks';
import { addStarterLibrary, createTemplate, templateFromWorkout, updateTemplate } from './commands/library';
import { createGroupSession, publishGroupSession, updateGroupBase } from './commands/group-sessions';
import { openConversation, saveReceipt, saveTeamReceipt, sendMessage, sendTeamMessage, sendTeamVoice, sendVoice } from './commands/messages';
import { deleteWorkspaceLogo, previewInvitation, saveWorkspaceProfile, setWorkspaceLogo } from './commands/workspace-profile';
import { todayIn } from '@coachos/domain';
import { coachWorkout } from './repo/coach';

// Test de contrat : chaque réponse réelle des commandes est validée contre contracts/openapi.json
// (statut attendu et schéma de réponse, propriétés inconnues interdites).

const spec = JSON.parse(fs.readFileSync(path.join(repoRoot(), 'contracts', 'openapi.json'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'openapi');

const ptr = (...parts: string[]) => parts.map((p) => encodeURIComponent(p.replace(/~/g, '~0').replace(/\//g, '~1'))).join('/');

function check(route: string, method: string, status: number, body: unknown) {
  const responses = spec.paths[route]?.[method]?.responses;
  expect(responses, `${method.toUpperCase()} ${route} absent du contrat`).toBeTruthy();
  expect(Object.keys(responses), `statut ${status} non prévu`).toContain(String(status));
  const validate = ajv.getSchema(`openapi#/${ptr('paths', route, method, 'responses', String(status), 'content', 'application/json', 'schema')}`)!;
  const ok = validate(body);
  expect(ok, JSON.stringify(validate.errors)).toBe(true);
}

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID() });
const W = '/workspaces/{wid}/athletes/{aid}/workouts';
let lastMail = '';

beforeAll(async () => {
  setDb(await openDatabase());
  setMailer(async (m) => void (lastMail = m.text));
});

describe('réponses conformes au contrat OpenAPI', () => {
  it('séances : créer, modifier, publier (durée réelle de 35 min incluse)', async () => {
    const data = { localDate: todayIn(TIME_ZONE), timeZone: TIME_ZONE, sport: 'running', title: 'Contrat', durationSeconds: 2100, intervals: [] };
    const m = { ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille };
    const created = await createWorkout(m, { data });
    check(W, 'post', created.status, created.body);
    const id = (created.body as { id: string }).id;
    const updated = await updateWorkout({ ...m, idempotencyKey: randomUUID(), workoutId: id }, { expectedRevision: 1, data });
    check(`${W}/{sid}`, 'patch', updated.status, updated.body);
    const pub = await publishWorkouts({ ...m, idempotencyKey: randomUUID() }, { changes: [{ id, revision: 2 }] });
    check('/workspaces/{wid}/athletes/{aid}/publications', 'post', pub.status, pub.body);
  });

  it('retour et revue (RPE 0 et commentaire)', async () => {
    const m = { ...meta(USERS.camille), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleToday };
    const fb = await saveFeedback(m, { publishedRevision: 1, state: 'completed', durationSeconds: 2100, rpe: 0, comment: 'ok' });
    check(`${W}/{sid}/feedback`, 'put', fb.status, fb.body);
    const autrement = await saveFeedback({ ...m, idempotencyKey: randomUUID() }, {
      publishedRevision: 1, expectedRevision: 1, state: 'partial', distanceM: 5000, changes: ['shorter', 'other_route'], actualSport: null, repeatsDone: [],
    });
    check(`${W}/{sid}/feedback`, 'put', autrement.status, autrement.body);
    // Mesures lues dans un fichier de montre (D-048) : provenance conservée et lue par le coach ; fichier sans mesure refusé.
    const montre = await saveFeedback({ ...m, idempotencyKey: randomUUID() }, {
      publishedRevision: 1, expectedRevision: 2, state: 'completed', durationSeconds: 2711, distanceM: 8123, measureFile: 'fit',
    });
    check(`${W}/{sid}/feedback`, 'put', montre.status, montre.body);
    expect((await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, SEED_WORKOUTS.camilleToday))!.feedback).toMatchObject({ measureFile: 'fit', durationSeconds: 2711 });
    await expect(saveFeedback({ ...m, idempotencyKey: randomUUID() }, { publishedRevision: 1, expectedRevision: 3, state: 'completed', measureFile: 'gpx' })).rejects.toMatchObject({ code: 'INVALID_FIELDS' });
    const manual = await saveFeedback({ ...m, idempotencyKey: randomUUID() }, { publishedRevision: 1, expectedRevision: 3, state: 'completed', durationSeconds: 2700 });
    expect((manual.body as { item: { measureFile: unknown } }).item.measureFile).toBeNull();
    const rv = await markFeedbackReviewed({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleToday }, { expectedRevision: 4 });
    check(`${W}/{sid}/feedback/review`, 'post', rv.status, rv.body);
  });

  it('espace, fiche, invitation, révocation, acceptation', async () => {
    const ws = await createWorkspace(meta(USERS.marine), { name: 'Contrat', timeZone: TIME_ZONE });
    check('/workspaces', 'post', ws.status, ws.body);
    const a = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Contrat', timeZone: TIME_ZONE });
    check('/workspaces/{wid}/athletes', 'post', a.status, a.body);
    const aid = (a.body as { id: string }).id;
    const inv = await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: 'http://localhost:3000' }, { email: 'lea.moreau@demo.coachos.test' });
    check('/workspaces/{wid}/athletes/{aid}/invite', 'post', inv.status, inv.body);
    const rv = await revokeInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, invitationId: (inv.body as { invitationId: string }).invitationId });
    check('/workspaces/{wid}/invitations/{iid}', 'delete', rv.status, rv.body);
    await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: 'http://localhost:3000' }, { email: 'lea.moreau@demo.coachos.test' });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(lastMail)![1]!;
    const acc = await acceptInvitation(meta(USERS.lea), { token });
    check('/invitations/accept', 'post', acc.status, acc.body);
  });

  it('profil sportif de l’athlète (minimal puis complet)', async () => {
    const m = { ...meta(USERS.noah), workspaceId: WORKSPACE_A };
    const minimal = await saveAthleteProfile(m, { sport: 'cycling', level: 'beginner', experience: 'lt1', weeklySessions: '0to1' });
    check('/workspaces/{wid}/athlete-profile', 'put', minimal.status, minimal.body);
    const full = await saveAthleteProfile({ ...m, idempotencyKey: randomUUID() }, {
      sport: 'cycling', level: 'intermediate', experience: '3to5', weeklySessions: '4to5', weeklyHours: '6to10',
      availableDays: [1, 3, 6], mainGoal: 'Gravel de 100 km', nextEventName: 'Gravel Ardennes', nextEventDate: '2027-05-02',
    });
    check('/workspaces/{wid}/athlete-profile', 'put', full.status, full.body);
  });

  it('repères d’entraînement fixés par le coach', async () => {
    const r = await saveAthleteReferences({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: ATHLETES.noah }, { vmaKmh: 14.5 });
    check('/workspaces/{wid}/athletes/{aid}/references', 'put', r.status, r.body);
  });

  it('lots G et H : groupes, niveau, objectif, note, tâche, suivi, rendez-vous', async () => {
    const m = () => ({ ...meta(USERS.marine), workspaceId: WORKSPACE_A });
    const id = (r: { body: unknown }) => (r.body as { id?: string; item?: { id: string } }).id ?? (r.body as { item: { id: string } }).item.id;
    const team = await createTeam(m(), { name: 'Contrat · groupe' });
    check('/workspaces/{wid}/teams', 'post', team.status, team.body);
    const tid = id(team);
    const up = await updateTeam({ ...m(), teamId: tid }, { sortOrder: 2 });
    check('/workspaces/{wid}/teams/{tid}', 'patch', up.status, up.body);
    const add = await setTeamMember({ ...m(), teamId: tid, athleteId: ATHLETES.noah }, true);
    check('/workspaces/{wid}/teams/{tid}/athletes/{aid}', 'put', add.status, add.body);
    const rm = await setTeamMember({ ...m(), teamId: tid, athleteId: ATHLETES.noah }, false);
    check('/workspaces/{wid}/teams/{tid}/athletes/{aid}', 'delete', rm.status, rm.body);
    const lvl = await confirmLevel({ ...m(), athleteId: ATHLETES.noah }, { sport: 'cycling', level: 'beginner' });
    check('/workspaces/{wid}/athletes/{aid}/levels', 'put', lvl.status, lvl.body);
    const goal = await createGoal({ ...m(), athleteId: ATHLETES.noah }, { title: 'Gravel 100 km', sport: 'cycling', targetDate: null });
    check('/workspaces/{wid}/athletes/{aid}/goals', 'post', goal.status, goal.body);
    const goalUp = await updateGoal({ ...m(), athleteId: ATHLETES.noah, goalId: id(goal) }, { state: 'canceled' });
    check('/workspaces/{wid}/athletes/{aid}/goals/{gid}', 'patch', goalUp.status, goalUp.body);
    const note = await createNote({ ...m(), athleteId: ATHLETES.noah }, { body: 'Note de contrat' });
    check('/workspaces/{wid}/athletes/{aid}/notes', 'post', note.status, note.body);
    const del = await deleteNote({ ...m(), athleteId: ATHLETES.noah, noteId: id(note) });
    check('/workspaces/{wid}/athletes/{aid}/notes/{nid}', 'delete', del.status, del.body);
    const task = await createTask(m(), { title: 'Préparer le bloc de décembre', kind: 'program', athleteId: ATHLETES.noah, dueOn: '2026-12-01', priority: 2, link: `/coach/${WORKSPACE_A}/calendar` });
    check('/workspaces/{wid}/tasks', 'post', task.status, task.body);
    const taskUp = await updateTask({ ...m(), taskId: id(task) }, { expectedRevision: 1, status: 'in_progress' });
    check('/workspaces/{wid}/tasks/{tid}', 'patch', taskUp.status, taskUp.body);
    const snooze = await snoozeAutoTask({ ...m(), sourceRef: ATHLETES.noah }, { rule: 'no_upcoming', until: '2026-12-01' });
    check('/workspaces/{wid}/auto-tasks/{ref}', 'put', snooze.status, snooze.body);
    const rules = await saveAutoRuleSettings(m(), { rules: [{ rule: 'feedback_review', enabled: true, delayDays: 3 }, { rule: 'vma_missing', enabled: false, delayDays: null }] });
    check('/workspaces/{wid}/auto-task-rules', 'put', rules.status, rules.body);
    const appt = await createAppointment(m(), { athleteId: ATHLETES.noah, title: 'Appel', kind: 'call', startsLocal: '2026-12-02T12:00', timeZone: TIME_ZONE, durationMin: 20 });
    check('/workspaces/{wid}/appointments', 'post', appt.status, appt.body);
    const apptUp = await updateAppointment({ ...m(), appointmentId: id(appt) }, { expectedRevision: 1, status: 'canceled' });
    check('/workspaces/{wid}/appointments/{pid}', 'patch', apptUp.status, apptUp.body);
  });

  it('messagerie : fil privé, groupe, lecture et vocaux', async () => {
    const m = (u: string) => ({ ...meta(u), workspaceId: WORKSPACE_A });
    const open = await openConversation({ ...m(USERS.noah), athleteId: ATHLETES.noah });
    check('/workspaces/{wid}/athletes/{aid}/conversations', 'post', open.status, open.body);
    const cid = (open.body as { id: string }).id;
    const sent = await sendMessage({ ...m(USERS.noah), conversationId: cid }, { body: 'Bonjour coach' });
    check('/workspaces/{wid}/conversations/{cid}/messages', 'post', sent.status, sent.body);
    const rec = await saveReceipt({ ...m(USERS.marine), conversationId: cid }, { messageId: (sent.body as { item: { id: string } }).item.id });
    check('/workspaces/{wid}/conversations/{cid}/receipt', 'put', rec.status, rec.body);
    const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array.from({ length: 30 }, () => 1)]);
    const v = await sendVoice({ ...m(USERS.marine), conversationId: cid, seconds: 5 }, audio);
    check('/workspaces/{wid}/conversations/{cid}/voice', 'post', v.status, v.body);
    const team = (await createTeam(m(USERS.marine), { name: 'Contrat · messages' })).body as { id: string };
    const tm = await sendTeamMessage({ ...m(USERS.marine), teamId: team.id }, { body: 'Bienvenue au groupe' });
    check('/workspaces/{wid}/teams/{tid}/messages', 'post', tm.status, tm.body);
    const tr = await saveTeamReceipt({ ...m(USERS.marine), teamId: team.id }, { messageId: (tm.body as { item: { id: string } }).item.id });
    check('/workspaces/{wid}/teams/{tid}/receipt', 'put', tr.status, tr.body);
    const tv = await sendTeamVoice({ ...m(USERS.marine), teamId: team.id, seconds: 3 }, audio);
    check('/workspaces/{wid}/teams/{tid}/voice', 'post', tv.status, tv.body);
  });

  it('bibliothèque de séances', async () => {
    const m = () => ({ ...meta(USERS.marine), workspaceId: WORKSPACE_A });
    const c = await createTemplate(m(), { category: 'tempo', workout: { sport: 'running', title: 'Tempo 3 × 10 min', intervals: [] } });
    check('/workspaces/{wid}/templates', 'post', c.status, c.body);
    const u = await updateTemplate({ ...m(), templateId: (c.body as { id: string }).id }, { expectedRevision: 1, category: 'threshold' });
    check('/workspaces/{wid}/templates/{tid}', 'patch', u.status, u.body);
    const st = await addStarterLibrary(m());
    check('/workspaces/{wid}/templates/starter', 'post', st.status, st.body);
    const fw = await templateFromWorkout({ ...m(), athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleLong }, { category: 'long' });
    check('/workspaces/{wid}/athletes/{aid}/workouts/{sid}/template', 'post', fw.status, fw.body);
  });

  it('séance de groupe : brouillons puis publication', async () => {
    const m = () => ({ ...meta(USERS.marine), workspaceId: WORKSPACE_A });
    const tid = (await createTeam(m(), { name: 'Contrat · séance de groupe' })).body as { id: string };
    await setTeamMember({ ...m(), teamId: tid.id, athleteId: ATHLETES.camille }, true);
    const c = await createGroupSession(m(), { teamId: tid.id, localDate: todayIn(TIME_ZONE), workout: { sport: 'running', title: 'Groupe · 6 × 1000 m', intervals: [] }, athleteIds: [ATHLETES.camille] });
    check('/workspaces/{wid}/group-sessions', 'post', c.status, c.body);
    const b = c.body as { id: string; items: { athleteId: string; workoutId: string }[] };
    const p = await publishGroupSession({ ...m(), groupSessionId: b.id }, { items: [{ ...b.items[0]!, revision: 1 }] });
    check('/workspaces/{wid}/group-sessions/{gid}/publish', 'post', p.status, p.body);
    const u = await updateGroupBase({ ...m(), groupSessionId: b.id }, { expectedRevision: 1, workout: { sport: 'running', title: 'Base modifiée', instructions: null, durationSeconds: null, distanceM: null, intervals: [] } });
    check('/workspaces/{wid}/group-sessions/{gid}', 'patch', u.status, u.body);
  });

  it('présentation d’espace, logo et aperçu d’invitation', async () => {
    const m = { ...meta(USERS.marine), workspaceId: WORKSPACE_A };
    const minimal = await saveWorkspaceProfile(m, { name: 'Atelier Endurance' });
    check('/workspaces/{wid}/profile', 'put', minimal.status, minimal.body);
    const full = await saveWorkspaceProfile({ ...m, idempotencyKey: randomUUID() }, {
      name: 'Atelier Endurance', tagline: 'Running et trail', bio: 'Bio', approach: 'Approche', experienceYears: 8, certifications: ['BPJEPS'],
      sports: ['running'], audiences: ['beginner'], goals: ['marathon'], city: 'Namur', languages: ['fr'], websiteUrl: 'https://exemple.test',
      socialUrl: 'https://social.exemple.test/coach', contactEmail: 'coach@exemple.test', accent: 'forest',
    });
    check('/workspaces/{wid}/profile', 'put', full.status, full.body);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    const up = await setWorkspaceLogo(m, png);
    check('/workspaces/{wid}/logo', 'put', up.status, up.body);
    const del = await deleteWorkspaceLogo(m);
    check('/workspaces/{wid}/logo', 'delete', del.status, del.body);
    const a = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Aperçu', timeZone: TIME_ZONE });
    await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: (a.body as { id: string }).id, appOrigin: 'http://localhost:3000' }, { email: 'apercu@demo.coachos.test' });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(lastMail)![1]!;
    check('/invitations/preview', 'post', 200, { workspace: await previewInvitation(token) });
  });

  it('erreurs : corps errorBody et statut prévus par route', async () => {
    const cases: [string, string, Promise<unknown>][] = [
      [`${W}`, 'post', createWorkout({ ...meta(USERS.hugo), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille }, { data: { title: '' } })],
      [`${W}`, 'post', createWorkout({ ...meta(USERS.hugo), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille }, { data: { localDate: '2026-11-17', timeZone: TIME_ZONE, sport: 'running', title: 'x', intervals: [] } })],
      [`${W}/{sid}/feedback`, 'put', saveFeedback({ ...meta(USERS.camille), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleLong }, { publishedRevision: 1, state: 'completed' })],
    ];
    for (const [route, method, p] of cases) {
      const err = await p.then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      const e = err as AppError;
      check(route, method, e.status, errorPayload(e, randomUUID()));
    }
  });
});
