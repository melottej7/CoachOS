// Identités et espaces fictifs. Aucune donnée réelle.
// Deux espaces pour exercer l’isolation : coach A / athlètes affectés, coach B / athlète tiers.

export const WORKSPACE_A = '10000000-0000-4000-8000-00000000000a';
export const WORKSPACE_B = '10000000-0000-4000-8000-00000000000b';

export const USERS = {
  marine: '00000000-0000-4000-8000-000000000001', // coach propriétaire, espace A
  camille: '00000000-0000-4000-8000-000000000002', // athlète, espace A
  noah: '00000000-0000-4000-8000-000000000003', // athlète, espace A
  hugo: '00000000-0000-4000-8000-000000000004', // coach propriétaire, espace B
  lea: '00000000-0000-4000-8000-000000000005', // athlète, espace B
} as const;

export const ATHLETES = {
  camille: '20000000-0000-4000-8000-000000000001',
  noah: '20000000-0000-4000-8000-000000000002',
  ines: '20000000-0000-4000-8000-000000000003', // fiche invitée, sans compte
  lea: '20000000-0000-4000-8000-000000000004',
} as const;

export const TIME_ZONE = 'Europe/Brussels';

/** Comptes fictifs. Le domaine .test n’existe pas : en local, Mailpit capture tous les e-mails. */
export const PEOPLE: { id: string; name: string; email: string }[] = [
  { id: USERS.marine, name: 'Marine Roy', email: 'marine.roy@demo.coachos.test' },
  { id: USERS.camille, name: 'Camille Laurent', email: 'camille.laurent@demo.coachos.test' },
  { id: USERS.noah, name: 'Noah Dubois', email: 'noah.dubois@demo.coachos.test' },
  { id: USERS.hugo, name: 'Hugo Petit', email: 'hugo.petit@demo.coachos.test' },
  { id: USERS.lea, name: 'Léa Moreau', email: 'lea.moreau@demo.coachos.test' },
];

export interface DemoIdentity {
  userId: string;
  name: string;
  email: string;
  role: 'coach' | 'athlete';
  workspace: string;
  description: string;
}

export const DEMO_IDENTITIES: DemoIdentity[] = [
  { userId: USERS.marine, name: 'Marine Roy', email: 'marine.roy@demo.coachos.test', role: 'coach', workspace: 'Atelier Endurance', description: 'Coach de Camille, Noah et Inès' },
  { userId: USERS.camille, name: 'Camille Laurent', email: 'camille.laurent@demo.coachos.test', role: 'athlete', workspace: 'Atelier Endurance', description: 'Course à pied et trail' },
  { userId: USERS.noah, name: 'Noah Dubois', email: 'noah.dubois@demo.coachos.test', role: 'athlete', workspace: 'Atelier Endurance', description: 'Cyclisme' },
  { userId: USERS.hugo, name: 'Hugo Petit', email: 'hugo.petit@demo.coachos.test', role: 'coach', workspace: 'Club Trail Ardennes', description: 'Autre espace, pour vérifier l’isolation' },
  { userId: USERS.lea, name: 'Léa Moreau', email: 'lea.moreau@demo.coachos.test', role: 'athlete', workspace: 'Club Trail Ardennes', description: 'Athlète d’un autre espace' },
];
