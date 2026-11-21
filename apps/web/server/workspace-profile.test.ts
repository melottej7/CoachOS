import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { setMailer, type EmailMessage } from './email/send';
import { AppError } from './errors';
import { acceptInvitation, createAthlete, issueInvitation } from './commands/invitations';
import {
  deleteWorkspaceLogo, previewInvitation, readWorkspaceLogo, readWorkspacePublic, saveWorkspaceProfile, setWorkspaceLogo,
} from './commands/workspace-profile';

// D-022 : présentation de l’espace coach, logo, aperçu d’invitation.

let db: Db;
let mail: EmailMessage | null = null;
const meta = (actorId: string, workspaceId = WORKSPACE_A) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const profile = {
  name: 'Atelier Endurance', tagline: 'Running et trail, du premier 10 km à l’ultra', bio: 'Coach depuis 2015.', approach: 'Progressivité.',
  experienceYears: 10, certifications: ['BPJEPS AF'], sports: ['running', 'trail', 'trail'], audiences: ['beginner'], goals: ['trail', 'half'],
  city: 'Namur', languages: ['fr', 'en'], websiteUrl: 'https://exemple.test', socialUrl: null, contactEmail: 'Contact@Exemple.test', accent: 'ocean',
};
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  setMailer(async (m) => void (mail = m));
});

describe('présentation de l’espace', () => {
  it('le propriétaire enregistre ; doublons retirés, e-mail normalisé, nom d’espace modifiable', async () => {
    const r = await saveWorkspaceProfile(meta(USERS.marine), { ...profile, name: 'Atelier Endurance Namur' });
    expect(r.body).toMatchObject({ name: 'Atelier Endurance Namur', item: { sports: ['running', 'trail'], contactEmail: 'contact@exemple.test', accent: 'ocean', revision: 1 } });
    const again = await saveWorkspaceProfile(meta(USERS.marine), profile);
    expect(again.body).toMatchObject({ name: 'Atelier Endurance', item: { revision: 2 } });
  });

  it('lecture : coach et athlètes de l’espace seulement', async () => {
    expect((await readWorkspacePublic(USERS.camille, WORKSPACE_A))?.profile?.tagline).toBe(profile.tagline);
    expect((await readWorkspacePublic(USERS.camille, WORKSPACE_A))?.coachName).toBe('Marine Roy');
    expect(await readWorkspacePublic(USERS.lea, WORKSPACE_A)).toBeNull();
    expect(await readWorkspacePublic(USERS.hugo, WORKSPACE_A)).toBeNull();
  });

  it('écriture : ni un coach d’un autre espace, ni un athlète, ni un coach non propriétaire', async () => {
    expect(await codeOf(saveWorkspaceProfile(meta(USERS.hugo), profile))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveWorkspaceProfile(meta(USERS.camille), profile))).toBe('RESOURCE_NOT_VISIBLE');
    await db.query(`insert into public.memberships(workspace_id, user_id, role) values ($1, $2, 'coach')`, [WORKSPACE_B, USERS.marine]);
    expect(await codeOf(saveWorkspaceProfile(meta(USERS.marine, WORKSPACE_B), { ...profile, name: 'Club' }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
  });

  it('refuse lien non sécurisé, champ inconnu, valeur hors liste, trop de diplômes, nom vide', async () => {
    for (const bad of [
      { ...profile, websiteUrl: 'http://exemple.test' },
      { ...profile, socialUrl: 'javascript:alert(1)' },
      { ...profile, phone: '0470000000' },
      { ...profile, sports: ['golf'] },
      { ...profile, accent: '#ff0000' },
      { ...profile, certifications: Array.from({ length: 11 }, (_, i) => `D${i}`) },
      { ...profile, name: '  ' },
    ]) {
      expect(await codeOf(saveWorkspaceProfile(meta(USERS.marine), bad))).toBe('INVALID_FIELDS');
    }
  });
});

describe('logo', () => {
  it('accepte une image PNG du propriétaire, la sert, puis la retire', async () => {
    const r = await setWorkspaceLogo(meta(USERS.marine), PNG);
    expect((r.body as { logoVersion: string }).logoVersion).toMatch(/^\d+$/);
    const logo = await readWorkspaceLogo(WORKSPACE_A);
    expect(logo?.type).toBe('image/png');
    expect([...logo!.bytes]).toEqual([...PNG]);
    expect((await readWorkspacePublic(USERS.camille, WORKSPACE_A))?.logoVersion).toBeTruthy();
    await deleteWorkspaceLogo(meta(USERS.marine));
    expect(await readWorkspaceLogo(WORKSPACE_A)).toBeNull();
  });

  it('refuse SVG, GIF, fichier vide ou trop lourd, et tout autre que le propriétaire', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const gif = new TextEncoder().encode('GIF89a......');
    const big = new Uint8Array(512 * 1024 + 1); big.set(PNG);
    for (const bytes of [svg, gif, new Uint8Array(0), big]) expect(await codeOf(setWorkspaceLogo(meta(USERS.marine), bytes))).toBe('INVALID_FIELDS');
    expect(await codeOf(setWorkspaceLogo(meta(USERS.hugo), PNG))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(setWorkspaceLogo(meta(USERS.camille), PNG))).toBe('RESOURCE_NOT_VISIBLE');
  });
});

describe('invitation enrichie', () => {
  it('l’e-mail nomme le coach et reprend l’accroche ; l’aperçu par jeton montre l’espace, sans donnée d’athlète', async () => {
    const a = await createAthlete({ ...meta(USERS.marine) }, { displayName: 'Invitée', timeZone: TIME_ZONE });
    const aid = (a.body as { id: string }).id;
    await issueInvitation({ ...meta(USERS.marine), athleteId: aid, appOrigin: 'http://localhost:3000' }, { email: 'invitee@demo.coachos.test' });
    expect(mail?.subject).toBe('Marine Roy t’invite à rejoindre Atelier Endurance sur CoachOS');
    expect(mail?.text).toContain(profile.tagline);
    const token = /#token=([A-Za-z0-9_-]+)/.exec(mail!.text)![1]!;
    const view = await previewInvitation(token);
    expect(view).toMatchObject({ id: WORKSPACE_A, name: 'Atelier Endurance', coachName: 'Marine Roy' });
    expect(JSON.stringify(view)).not.toContain('invitee@');
    expect(JSON.stringify(view)).not.toContain(ATHLETES.camille);
    expect(await codeOf(previewInvitation('x'.repeat(40)))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(previewInvitation(undefined))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('un lien déjà utilisé ne donne plus d’aperçu', async () => {
    await db.query(`insert into auth.users(id, email) values ($1, 'utilise@demo.coachos.test')`, [USERS.noah.replace(/3$/, '9')]);
    const a = await createAthlete({ ...meta(USERS.marine) }, { displayName: 'Utilisé', timeZone: TIME_ZONE });
    await issueInvitation({ ...meta(USERS.marine), athleteId: (a.body as { id: string }).id, appOrigin: 'http://localhost:3000' }, { email: 'utilise@demo.coachos.test' });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(mail!.text)![1]!;
    const uid = USERS.noah.replace(/3$/, '9');
    await db.query(`insert into public.users(id, display_name) values ($1, 'Utilisé')`, [uid]);
    await acceptInvitation({ actorId: uid, idempotencyKey: randomUUID(), requestId: randomUUID() }, { token });
    expect(await codeOf(previewInvitation(token))).toBe('RESOURCE_NOT_VISIBLE');
  });
});

describe('modules de l’espace (D-102)', () => {
  it('les sports encadrés décident des modules : musculation seule, puis les deux', async () => {
    const { coachContext } = await import('./repo/context');
    await saveWorkspaceProfile(meta(USERS.marine), { ...profile, sports: ['strength'] });
    expect((await coachContext(USERS.marine, WORKSPACE_A))?.modules).toEqual({ endurance: false, strength: true });
    await saveWorkspaceProfile(meta(USERS.marine), { ...profile, sports: ['running', 'strength'] });
    expect((await coachContext(USERS.marine, WORKSPACE_A))?.modules).toEqual({ endurance: true, strength: true });
    await saveWorkspaceProfile(meta(USERS.marine), profile);
    expect((await coachContext(USERS.marine, WORKSPACE_A))?.modules).toEqual({ endurance: true, strength: false });
  });
});

