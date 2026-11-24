// D-163 · Restauration d'une sauvegarde (npm run db:backup) dans une base Supabase NEUVE.
// Usage : npm run db:restore -- <horodatage> "<adresse de la base cible>"
//   ex. : npm run db:restore -- 2026-11-24-07-30 "postgresql://postgres:MOT_DE_PASSE@db.xxxx.supabase.co:5432/postgres"
// Garde-fou : refuse toute base dont le schéma public contient déjà une table. Le script ne peut donc rien écraser.
// Tout se fait dans une seule transaction : en cas d'erreur, la base cible reste vide.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [stamp, url] = process.argv.slice(2);

function stop(message) {
  console.error(`Restauration refusée : ${message}`);
  process.exit(1);
}

if (!stamp || !url) stop('il faut l’horodatage de la sauvegarde et l’adresse de la base cible. Exemple : npm run db:restore -- 2026-11-24-07-30 "postgresql://…"');
if (!/^postgres(ql)?:\/\//.test(url)) stop('l’adresse de la base cible doit commencer par postgresql://');
const file = (part) => path.join(root, 'backups', `${stamp}-${part}.sql`);
for (const part of ['schema', 'data']) if (!existsSync(file(part))) stop(`fichier introuvable : backups/${stamp}-${part}.sql`);
const withHistory = existsSync(file('migrations'));

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, application_name: 'coachos-restore', ...(local ? {} : { ssl: { rejectUnauthorized: false } }) });

try {
  await client.connect();
} catch (e) {
  stop(`connexion impossible (${e.code ?? e.message}). Vérifie l’adresse et le mot de passe.`);
}

const busy = await client.query(`select count(*)::int as n from pg_tables where schemaname in ('public', 'private')`);
if (busy.rows[0].n > 0) {
  await client.end();
  stop(`la base cible contient déjà ${busy.rows[0].n} table(s). Restaure seulement dans un projet Supabase neuf.`);
}
const auth = await client.query(`select to_regclass('auth.users') is not null as ok`);
if (!auth.rows[0].ok) {
  await client.end();
  stop('la base cible n’a pas le socle de Supabase (auth.users). Crée d’abord un projet Supabase neuf.');
}

console.log(`Restauration de la sauvegarde ${stamp}…`);
try {
  await client.query('begin');
  await client.query(readFileSync(file('schema'), 'utf8'));
  await client.query('set session_replication_role = replica');
  await client.query(readFileSync(file('data'), 'utf8'));
  if (withHistory) {
    await client.query(`create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
    await client.query(readFileSync(file('migrations'), 'utf8'));
  }
  await client.query('set session_replication_role = origin');
  await client.query('commit');
} catch (e) {
  await client.query('rollback').catch(() => undefined);
  await client.end();
  stop(`erreur pendant la restauration, rien n’a été écrit (${e.message}).`);
}

const n = async (sql) => (await client.query(sql)).rows[0].n;
const summary = {
  comptes: await n('select count(*)::int as n from auth.users'),
  espaces: await n('select count(*)::int as n from public.workspaces'),
  eleves: await n('select count(*)::int as n from public.athletes'),
  seances: await n('select count(*)::int as n from public.workouts'),
  migrations: withHistory ? await n('select count(*)::int as n from supabase_migrations.schema_migrations') : 0,
};
await client.end();
console.log(`Restauration terminée : ${summary.comptes} comptes, ${summary.espaces} espaces, ${summary.eleves} élèves, ${summary.seances} séances, ${summary.migrations} migrations dans l’historique.`);
if (!withHistory) {
  console.log('Attention : cette sauvegarde n’a pas d’historique des migrations. Avant la prochaine mise en ligne, demande à Claude la commande « supabase migration repair ».');
}
